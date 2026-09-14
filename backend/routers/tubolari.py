"""Modulo Rifacimento Tubolari: config prezzi, CRUD preventivi, PDF."""
import io
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from database import db
from models import (
    TubolariConfig, TubolariConfigUpdate,
    PreventivoTubolare, PreventivoTubolareCreate,
)
from helpers import serialize

router = APIRouter(prefix="/tubolari", tags=["Tubolari"])


# --------------------------------------------------------------------------
# CONFIG (singleton id=default)
# --------------------------------------------------------------------------
async def _get_or_create_config() -> TubolariConfig:
    doc = await db.tubolari_config.find_one({"id": "default"}, {"_id": 0})
    if not doc:
        cfg = TubolariConfig()
        await db.tubolari_config.insert_one(serialize(cfg))
        return cfg
    return TubolariConfig(**doc)


@router.get("/config", response_model=TubolariConfig)
async def get_config():
    return await _get_or_create_config()


@router.put("/config", response_model=TubolariConfig)
async def update_config(payload: TubolariConfigUpdate):
    current = await _get_or_create_config()
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    new_data = {**current.model_dump(), **updates, "updated_at": datetime.now(timezone.utc)}
    cfg = TubolariConfig(**new_data)
    await db.tubolari_config.update_one({"id": "default"}, {"$set": serialize(cfg)}, upsert=True)
    return cfg


# --------------------------------------------------------------------------
# UTIL: calcolo totale
# --------------------------------------------------------------------------
def _calc_totale(p: PreventivoTubolare) -> float:
    tot = float(p.prezzo_al_metro) * float(p.metri or 0)
    if p.tessuto == "orca":
        tot += float(p.supplemento_orca)
    if p.include_rifinitura_strisciato:
        tot += float(p.prezzo_rifinitura_strisciato)
    if p.include_bottazzo_doppio:
        tot += float(p.prezzo_bottazzo_doppio)
    if p.include_pezze_velocita:
        tot += float(p.prezzo_pezze_velocita or 0)
    if p.maniglioni_aggiuntivi and p.maniglioni_aggiuntivi > 0:
        tot += float(p.maniglioni_aggiuntivi) * float(p.prezzo_maniglione)
    if p.scritte_loghi_laser:
        tot += float(p.prezzo_scritte_loghi or 0)
    if p.grafiche_particolari:
        tot += float(p.prezzo_grafiche_particolari or 0)
    if p.rinforzi_diving:
        tot += float(p.prezzo_rinforzi_diving or 0)
    return round(tot, 2)


async def _apply_defaults_from_config(payload_dict: dict) -> dict:
    cfg = await _get_or_create_config()
    fallbacks = {
        "prezzo_al_metro": cfg.prezzo_al_metro,
        "supplemento_orca": cfg.supplemento_orca,
        "prezzo_rifinitura_strisciato": cfg.rifinitura_interna_strisciato,
        "prezzo_bottazzo_doppio": cfg.bottazzo_doppio_90mm,
        "prezzo_maniglione": cfg.maniglione_aggiuntivo_cad,
    }
    out = {**payload_dict}
    for k, v in fallbacks.items():
        if out.get(k) is None:
            out[k] = v
    return out


async def _next_numero() -> str:
    year = datetime.now().year
    n = await db.preventivi_tubolari.count_documents({
        "data": {"$regex": f"^{year}-"}
    })
    return f"T{year}-{n+1:03d}"


# --------------------------------------------------------------------------
# CRUD PREVENTIVI
# --------------------------------------------------------------------------
@router.get("/preventivi", response_model=List[PreventivoTubolare])
async def list_preventivi(stato: Optional[str] = None):
    q = {}
    if stato:
        q["stato"] = stato
    docs = await db.preventivi_tubolari.find(q, {"_id": 0}).sort("data", -1).to_list(2000)
    result = []
    for d in docs:
        try:
            result.append(PreventivoTubolare(**d))
        except Exception:
            pass
    return result


@router.get("/preventivi/{pid}", response_model=PreventivoTubolare)
async def get_preventivo(pid: str):
    doc = await db.preventivi_tubolari.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    return PreventivoTubolare(**doc)


@router.post("/preventivi", response_model=PreventivoTubolare)
async def create_preventivo(payload: PreventivoTubolareCreate):
    data = payload.model_dump()
    data = await _apply_defaults_from_config(data)
    if not data.get("data"):
        data["data"] = datetime.now().strftime("%Y-%m-%d")
    if not data.get("numero"):
        data["numero"] = await _next_numero()
    prev = PreventivoTubolare(**{k: v for k, v in data.items() if v is not None})
    prev.totale = _calc_totale(prev)
    await db.preventivi_tubolari.insert_one(serialize(prev))
    return prev


@router.put("/preventivi/{pid}", response_model=PreventivoTubolare)
async def update_preventivo(pid: str, payload: PreventivoTubolareCreate):
    existing = await db.preventivi_tubolari.find_one({"id": pid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Preventivo non trovato")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    merged = {**existing, **updates, "id": pid, "updated_at": datetime.now(timezone.utc)}
    prev = PreventivoTubolare(**merged)
    prev.totale = _calc_totale(prev)
    await db.preventivi_tubolari.update_one({"id": pid}, {"$set": serialize(prev)})
    return prev


@router.delete("/preventivi/{pid}")
async def delete_preventivo(pid: str):
    r = await db.preventivi_tubolari.delete_one({"id": pid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Preventivo non trovato")
    return {"ok": True}


# --------------------------------------------------------------------------
# PDF
# --------------------------------------------------------------------------
def _fmt_eur(v: float) -> str:
    return f"€ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


@router.get("/preventivi/{pid}/pdf")
async def preventivo_pdf(pid: str):
    doc = await db.preventivi_tubolari.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    p = PreventivoTubolare(**doc)
    cfg = await _get_or_create_config()
    cantiere = await db.cantiere.find_one({"id": "default"}, {"_id": 0}) or {}

    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image,
    )
    import base64 as _b64

    buf = io.BytesIO()
    docp = SimpleDocTemplate(buf, pagesize=A4, leftMargin=18*mm, rightMargin=18*mm, topMargin=14*mm, bottomMargin=14*mm)
    styles = getSampleStyleSheet()
    story = []

    # Logo (se presente)
    logo_b64 = cantiere.get("logo_base64") or ""
    if logo_b64 and logo_b64.startswith("data:image"):
        try:
            _, b64d = logo_b64.split(",", 1)
            img_bytes = _b64.b64decode(b64d)
            img = Image(io.BytesIO(img_bytes), width=45*mm, height=45*mm, kind="proportional")
            img.hAlign = "CENTER"
            story.append(img)
        except Exception:
            pass

    # Intestazione azienda
    header_style = ParagraphStyle("h", parent=styles["Normal"], alignment=TA_CENTER, fontSize=9)
    intest = []
    if cantiere.get("nome"):
        intest.append(f"<b>{cantiere['nome']}</b>")
    addr_parts = [cantiere.get("indirizzo",""), cantiere.get("cap",""), cantiere.get("citta",""), f"({cantiere.get('provincia','')})" if cantiere.get('provincia') else ""]
    addr = " ".join(x for x in addr_parts if x).strip()
    tel = cantiere.get("telefono","")
    if addr or tel:
        line = " · ".join(x for x in [addr, f"Tel {tel}" if tel else ""] if x)
        intest.append(line)
    email_web = " · ".join(x for x in [cantiere.get("email",""), cantiere.get("sito","")] if x)
    if email_web:
        intest.append(email_web)
    for line in intest:
        story.append(Paragraph(line, header_style))
    story.append(Spacer(1, 6))

    # Titolo box
    titolo = Paragraph("<b>SOSTITUZIONE TUBOLARI</b>", ParagraphStyle("tit", parent=styles["Normal"], alignment=TA_CENTER, fontSize=12))
    t = Table([[titolo]], colWidths=[70*mm])
    t.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 1, colors.black),
        ("ALIGN", (0,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("BACKGROUND", (0,0), (-1,-1), colors.HexColor("#fff4c2")),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
    ]))
    t.hAlign = "CENTER"
    story.append(t)
    story.append(Spacer(1, 8))

    # Riga saluto + data + destinatario
    data_it = "-"
    try:
        d = datetime.strptime(p.data, "%Y-%m-%d")
        data_it = d.strftime("%d/%m/%y")
    except Exception:
        pass
    saluto = f"Buongiorno,     data <b>{data_it}</b>"
    if p.cliente_nome:
        saluto = f"Buongiorno <b>{p.cliente_nome}</b>,     data <b>{data_it}</b>"
    if p.numero:
        saluto += f"     Prev. <b>{p.numero}</b>"
    story.append(Paragraph(saluto, styles["Normal"]))
    story.append(Spacer(1, 2))
    story.append(Paragraph("Come da gradita richiesta, allego preventivo per :", styles["Normal"]))
    story.append(Spacer(1, 4))

    # Riga barca
    marca = p.marca_gommone or "—"
    mod = p.modello_gommone or ""
    barca_txt = f"sostituzione tubolare del  Gommone   <b>{marca}</b>"
    if mod:
        barca_txt += f" {mod}"
    barca_txt += f"     metri   <b>{p.metri:g}</b>"
    story.append(Paragraph(barca_txt, styles["Normal"]))
    story.append(Spacer(1, 6))

    # Tabella A) sostituzione base
    base = float(p.prezzo_al_metro) * float(p.metri or 0)
    rows_a = [
        ["A)  Sostituzione tubolare con :", "", ""],
        ["gomma pesante grammatura 1670 colore grigio o crema", "inclusi", ""],
        ["4 maniglioni", "inclusi", ""],
        ["bottazzo singolo h 90 mm o doppio h 60 mm", "incluso", ""],
        ["rifinitura interna con profilo a unghia (non strisciato interno)", "incluso", ""],
        ["colore di finitura a scelta", "inclusa", ""],
        ["grafica GEB standard", "inclusa", ""],
        ["Scritte / Loghi con taglio laser",
         _fmt_eur(p.prezzo_scritte_loghi) if p.scritte_loghi_laser and p.prezzo_scritte_loghi > 0 else "da valutare",
         "+ iva" if p.scritte_loghi_laser and p.prezzo_scritte_loghi > 0 else ""],
        ["", "", ""],
        ["", f"totale  {_fmt_eur(base)}", "+ iva"],
        ["per colori del tubo differenti o graffiati (carbon, perlage, ecc.)", "Da valutare variazione prezzi", ""],
    ]
    ta = Table(rows_a, colWidths=[110*mm, 45*mm, 15*mm])
    ta.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("FONTNAME", (0,0), (0,0), "Helvetica-Bold"),
        ("BOX", (1,1), (1,7), 0.4, colors.grey),
        ("BOX", (1,9), (1,9), 0.6, colors.black),
        ("BACKGROUND", (1,9), (1,9), colors.HexColor("#fff4c2")),
        ("ALIGN", (1,0), (2,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 3),
        ("RIGHTPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(ta)
    story.append(Spacer(1, 6))

    # Tabella MATERIALI IMPIEGATI
    orca_val = _fmt_eur(p.supplemento_orca) if p.tessuto == "orca" else _fmt_eur(p.supplemento_orca)
    rows_m = [
        [Paragraph("<b>MATERIALI IMPIEGATI:</b>", styles["Normal"]), "", ""],
        ["neoprene hypalon 1° scelta tessuto NOVURANIA",
         "incluso" if p.tessuto == "hypalon" else "—", ""],
        ["per tessuti ORCA (da aggiungere al preventivo in caso di scelta)",
         orca_val, "+ iva"],
    ]
    tm = Table(rows_m, colWidths=[110*mm, 45*mm, 15*mm])
    tm.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#fff4c2")),
        ("SPAN", (0,0), (-1,0)),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("BOX", (1,1), (1,-1), 0.4, colors.grey),
        ("ALIGN", (1,0), (2,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 3),
        ("RIGHTPADDING", (0,0), (-1,-1), 3),
        ("BOX", (0,0), (-1,-1), 0.4, colors.grey),
    ]))
    story.append(tm)
    story.append(Spacer(1, 6))

    # Tabella Lavorazioni extra
    def _extra_val(flag, price, etichetta="da valutare"):
        if flag and price > 0:
            return _fmt_eur(price)
        if flag:
            return "da valutare"
        return "—"

    rows_e = [
        [Paragraph("<b>Lavorazioni extra da aggiungere al preventivo in caso di richiesta</b>", styles["Normal"]), "", ""],
        ["B) Rifinitura interna strisciato",
         _extra_val(p.include_rifinitura_strisciato, p.prezzo_rifinitura_strisciato), "+ iva"],
        ["C) Bottazzo doppio h 90 mm",
         _extra_val(p.include_bottazzo_doppio, p.prezzo_bottazzo_doppio), "+ iva"],
        ["D) Apposizione pezze di velocità su coni dx-sx (se necessarie)",
         _extra_val(p.include_pezze_velocita, p.prezzo_pezze_velocita), "+ iva"],
        [f"E) Maniglioni aggiuntivi ({p.maniglioni_aggiuntivi} pz)" if p.maniglioni_aggiuntivi > 0 else "E) Maniglioni aggiuntivi   cad",
         (_fmt_eur(p.prezzo_maniglione * p.maniglioni_aggiuntivi) if p.maniglioni_aggiuntivi > 0 else _fmt_eur(p.prezzo_maniglione)),
         "+ iva"],
        ["Per grafiche particolari o repliche originali",
         _extra_val(p.grafiche_particolari, p.prezzo_grafiche_particolari), ""],
        ["Rinforzi per gommoni diving",
         _extra_val(p.rinforzi_diving, p.prezzo_rinforzi_diving), ""],
    ]
    te = Table(rows_e, colWidths=[110*mm, 45*mm, 15*mm])
    te.setStyle(TableStyle([
        ("FONTSIZE", (0,0), (-1,-1), 9),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#fff4c2")),
        ("SPAN", (0,0), (-1,0)),
        ("ALIGN", (0,0), (-1,0), "CENTER"),
        ("BOX", (1,1), (1,-1), 0.4, colors.grey),
        ("ALIGN", (1,0), (2,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 3),
        ("RIGHTPADDING", (0,0), (-1,-1), 3),
        ("BOX", (0,0), (-1,-1), 0.4, colors.grey),
    ]))
    story.append(te)
    story.append(Spacer(1, 8))

    # TOTALE evidenziato
    totale_style = ParagraphStyle("tot", parent=styles["Normal"], fontSize=11, alignment=TA_RIGHT)
    story.append(Paragraph(f"<b>TOTALE PREVENTIVO:  {_fmt_eur(p.totale)}  + IVA</b>", totale_style))
    story.append(Spacer(1, 8))

    # Note eventuali
    if p.note:
        story.append(Paragraph(f"<b>Note:</b>", styles["Normal"]))
        for line in p.note.split("\n"):
            story.append(Paragraph(line.replace(" ", "&nbsp;"), styles["Normal"]))
        story.append(Spacer(1, 6))

    # Note standard (tempi/garanzia)
    note_std_style = ParagraphStyle("nstd", parent=styles["Normal"], fontSize=9)
    story.append(Paragraph(f"Tempi di esecuzione {cfg.tempi_esecuzione_giorni} gg circa da consegna battello in cantiere.", note_std_style))
    for line in (cfg.note_standard or "").split("\n"):
        if line.strip():
            story.append(Paragraph(line, note_std_style))
    story.append(Spacer(1, 12))

    # Firma
    firma_style = ParagraphStyle("firma", parent=styles["Normal"], fontSize=9, alignment=TA_CENTER)
    firma = cantiere.get("firma_nome") or cantiere.get("nome") or ""
    story.append(Paragraph(f"il titolare      <b>{firma}</b>", firma_style))

    docp.build(story)
    buf.seek(0)
    filename = f"preventivo_tubolari_{p.numero or p.id[:8]}.pdf"
    return StreamingResponse(
        buf, media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
