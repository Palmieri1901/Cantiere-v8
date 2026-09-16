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
    metri = float(p.metri or 0)
    tot = float(p.prezzo_al_metro) * metri
    if p.tessuto == "orca":
        # Supplemento ORCA calcolato al metro lineare
        tot += float(p.supplemento_orca) * metri
    if p.include_rifinitura_strisciato:
        # Rifinitura interna strisciato calcolata al metro lineare
        tot += float(p.prezzo_rifinitura_strisciato) * metri
    if p.include_bottazzo_doppio:
        # Bottazzo doppio h 90 mm calcolato al metro lineare
        tot += float(p.prezzo_bottazzo_doppio or 0) * metri
    if p.include_pezze_velocita:
        tot += float(p.prezzo_pezze_velocita or 0)
    if p.maniglioni_aggiuntivi and p.maniglioni_aggiuntivi > 0:
        tot += float(p.maniglioni_aggiuntivi) * float(p.prezzo_maniglione)
    if p.scritte_loghi_laser:
        tot += float(p.prezzo_scritte_loghi or 0)
    if p.colori_tubo_differenti:
        tot += float(p.prezzo_colori_tubo_differenti or 0)
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
        "prezzo_pezze_velocita": cfg.apposizione_pezze_velocita,
        "prezzo_scritte_loghi": cfg.scritte_loghi_taglio_laser,
        "prezzo_colori_tubo_differenti": cfg.colori_tubo_differenti,
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
    """Formatta il valore in stile italiano: 6.375,00 € (simbolo dopo l'importo)."""
    n = f"{v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{n} €"


@router.get("/preventivi/{pid}/pdf")
async def preventivo_pdf(pid: str):
    doc = await db.preventivi_tubolari.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    p = PreventivoTubolare(**doc)
    cfg = await _get_or_create_config()
    cantiere = await db.cantiere.find_one({"id": "default"}, {"_id": 0}) or {}
    pdf_bytes = _build_preventivo_pdf(p, cfg, cantiere)
    filename = f"preventivo_tubolari_{p.numero or p.id[:8]}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/preview-pdf")
async def preview_pdf(payload: PreventivoTubolareCreate):
    """Genera un PDF di anteprima senza salvare nel DB.
    Usato dal form del preventivo per la preview live."""
    data = payload.model_dump()
    data = await _apply_defaults_from_config(data)
    if not data.get("data"):
        data["data"] = datetime.now().strftime("%Y-%m-%d")
    if not data.get("numero"):
        data["numero"] = "ANTEPRIMA"
    p = PreventivoTubolare(**{k: v for k, v in data.items() if v is not None})
    p.totale = _calc_totale(p)
    cfg = await _get_or_create_config()
    cantiere = await db.cantiere.find_one({"id": "default"}, {"_id": 0}) or {}
    pdf_bytes = _build_preventivo_pdf(p, cfg, cantiere)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf")


def _build_preventivo_pdf(p: PreventivoTubolare, cfg: TubolariConfig, cantiere: dict) -> bytes:
    """PDF preventivo tubolari — layout professionale."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, Image, HRFlowable,
    )
    import base64 as _b64

    # Palette
    NAVY = colors.HexColor("#0f2c4d")
    NAVY_LIGHT = colors.HexColor("#1e4b7a")
    ACCENT = colors.HexColor("#c9a349")
    LIGHT_GREY = colors.HexColor("#f4f6f8")
    BORDER = colors.HexColor("#d5dae0")
    TEXT_MUTED = colors.HexColor("#5a6672")
    GREEN_BG = colors.HexColor("#e8f2ea")
    GREEN_HEAD = colors.HexColor("#2e6b3e")

    buf = io.BytesIO()
    docp = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=12*mm, rightMargin=12*mm,
        topMargin=6*mm, bottomMargin=6*mm,
    )
    styles = getSampleStyleSheet()
    story = []
    metri_val = float(p.metri or 0)
    base = float(p.prezzo_al_metro) * metri_val

    # ------------------------------------------------------------------
    # STILI
    # ------------------------------------------------------------------
    st_company_name = ParagraphStyle("cname", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=14, textColor=NAVY, leading=16)
    st_company_meta = ParagraphStyle("cmeta", parent=styles["Normal"], fontSize=8.5, textColor=TEXT_MUTED, leading=11)
    st_doc_title = ParagraphStyle("dtitle", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY, alignment=TA_LEFT, spaceBefore=0, spaceAfter=2)
    st_doc_sub = ParagraphStyle("dsub", parent=styles["Normal"], fontSize=9, leading=11, textColor=TEXT_MUTED, alignment=TA_LEFT, spaceBefore=0, spaceAfter=0)
    st_meta_label = ParagraphStyle("mlab", parent=styles["Normal"], fontSize=8, textColor=TEXT_MUTED, alignment=TA_LEFT)
    st_meta_val = ParagraphStyle("mval", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, alignment=TA_LEFT)
    st_section = ParagraphStyle("sec", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=colors.white, alignment=TA_LEFT, leading=13)
    st_row = ParagraphStyle("row", parent=styles["Normal"], fontSize=8.5, leading=11)
    st_row_bold = ParagraphStyle("rowb", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8.5, leading=11)
    st_note_small = ParagraphStyle("ns", parent=styles["Normal"], fontSize=8.5, textColor=TEXT_MUTED, leading=11)
    st_footer_terms = ParagraphStyle("ft", parent=styles["Normal"], fontSize=8, textColor=TEXT_MUTED, leading=10)
    st_totale_val = ParagraphStyle("tv", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=16, textColor=colors.white, alignment=TA_RIGHT)
    st_totale_label = ParagraphStyle("tl", parent=styles["Normal"], fontSize=9, textColor=colors.white, alignment=TA_RIGHT)

    # ------------------------------------------------------------------
    # HEADER: Logo + info azienda a sinistra, blocco preventivo a destra
    # ------------------------------------------------------------------
    logo_flowable = ""
    logo_b64 = cantiere.get("logo_base64") or ""
    if logo_b64 and logo_b64.startswith("data:image"):
        try:
            _, b64d = logo_b64.split(",", 1)
            img_bytes = _b64.b64decode(b64d)
            logo_flowable = Image(io.BytesIO(img_bytes), width=32*mm, height=32*mm, kind="proportional")
        except Exception:
            logo_flowable = ""

    nome_az = cantiere.get("nome") or ""
    addr = " ".join(x for x in [cantiere.get("indirizzo",""), cantiere.get("cap",""), cantiere.get("citta",""), (f"({cantiere.get('provincia','')})" if cantiere.get('provincia') else "")] if x).strip()
    tel = cantiere.get("telefono","")
    email = cantiere.get("email","")
    piva = cantiere.get("piva","") or cantiere.get("partita_iva","")
    left_cell = []
    if nome_az:
        left_cell.append(Paragraph(nome_az, st_company_name))
    if addr:
        left_cell.append(Paragraph(addr, st_company_meta))
    contact_parts = []
    if tel: contact_parts.append(f"Tel {tel}")
    if email: contact_parts.append(email)
    if contact_parts:
        left_cell.append(Paragraph(" · ".join(contact_parts), st_company_meta))
    if piva:
        left_cell.append(Paragraph(f"P.IVA {piva}", st_company_meta))

    if logo_flowable:
        header_left = Table([[logo_flowable, left_cell]], colWidths=[35*mm, 65*mm])
        header_left.setStyle(TableStyle([
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ]))
    else:
        header_left = left_cell

    # Data italiana
    try:
        data_it = datetime.strptime(p.data, "%Y-%m-%d").strftime("%d/%m/%Y")
    except Exception:
        data_it = p.data or ""

    meta_table = Table([
        [Paragraph("N° preventivo", st_meta_label), Paragraph(p.numero or "—", st_meta_val)],
        [Paragraph("Data", st_meta_label), Paragraph(data_it, st_meta_val)],
        [Paragraph("Validità", st_meta_label), Paragraph(f"{cfg.validita_giorni} giorni", st_meta_val)],
    ], colWidths=[26*mm, 40*mm], style=TableStyle([
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 1.5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1.5),
    ]))
    # Right column as a proper single-column Table to guarantee vertical stacking
    right_data = Table(
        [[Paragraph("PREVENTIVO", st_doc_title)],
         [Paragraph("Rifacimento tubolari — sostituzione", st_doc_sub)],
         [Spacer(1, 4)],
         [meta_table]],
        colWidths=[68*mm],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING", (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ]),
    )

    header = Table(
        [[header_left, right_data]],
        colWidths=[110*mm, 68*mm],
    )
    header.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("TOPPADDING", (0,0), (-1,-1), 0),
        ("BOTTOMPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 4))
    story.append(HRFlowable(width="100%", thickness=1.5, color=NAVY, spaceBefore=0, spaceAfter=4))

    # ------------------------------------------------------------------
    # DESTINATARIO + IMBARCAZIONE
    # ------------------------------------------------------------------
    dest_cell = [Paragraph("<b>CLIENTE</b>", ParagraphStyle("dl", parent=styles["Normal"], fontSize=8, textColor=NAVY, leading=10))]
    if p.cliente_nome:
        dest_cell.append(Paragraph(f"<b>{p.cliente_nome}</b>", st_row_bold))
    if p.cliente_telefono:
        dest_cell.append(Paragraph(f"Tel. {p.cliente_telefono}", st_note_small))
    if p.cliente_email:
        dest_cell.append(Paragraph(p.cliente_email, st_note_small))

    barca_cell = [Paragraph("<b>IMBARCAZIONE</b>", ParagraphStyle("bl", parent=styles["Normal"], fontSize=8, textColor=NAVY, leading=10))]
    marca = p.marca_gommone or "—"
    mod = p.modello_gommone or ""
    label_barca = f"Gommone <b>{marca}</b>" + (f" {mod}" if mod else "")
    barca_cell.append(Paragraph(label_barca, st_row_bold))
    barca_cell.append(Paragraph(f"Lunghezza: <b>{metri_val:g} Mt</b>  ·  Tessuto: <b>{'ORCA' if p.tessuto=='orca' else 'Hypalon 1670'}</b>", st_row))

    dest_tbl = Table([[dest_cell, barca_cell]], colWidths=[92*mm, 94*mm])
    dest_tbl.setStyle(TableStyle([
        ("BOX", (0,0), (0,0), 0.6, BORDER),
        ("BOX", (1,0), (1,0), 0.6, BORDER),
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_GREY),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING", (0,0), (-1,-1), 6),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(dest_tbl)
    story.append(Spacer(1, 4))

    # ------------------------------------------------------------------
    # SEZIONE A) BASE
    # ------------------------------------------------------------------
    story.append(_section_header("A) SOSTITUZIONE TUBOLARE — VOCI INCLUSE", NAVY, st_section))

    def _stato_prezzo(cfg_val: float) -> str:
        return _fmt_eur(cfg_val) if cfg_val and cfg_val > 0 else "da valutare"

    inclusi = [
        ("Tessuto gommato neoprene hypalon grammatura pesante 866 1670 nei colori (grigio o crema)", "incluso"),
        ("4 maniglioni", "inclusi"),
        ("Bottazzo singolo h 90 mm o doppio h 60 mm", "incluso"),
        ("Rifinitura interna con profilo guarnizione a pressione", "incluso"),
        ("Colore di finitura a scelta", "incluso"),
        ("Grafica GEB standard", "inclusa"),
    ]
    rows_a = [[Paragraph(f"•  {desc}", st_row), Paragraph(stato, st_row_bold)] for desc, stato in inclusi]
    ta = Table(rows_a, colWidths=[141*mm, 45*mm])
    ta.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.4, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT_GREY]),
        ("ALIGN", (1,0), (1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 1.5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1.5),
    ]))
    story.append(ta)

    # Totale base — sotto la tabella A) in una fascia colorata a destra
    tot_a_tbl = Table(
        [[Paragraph(f"Totale sostituzione base ({metri_val:g} Mt × {_fmt_eur(p.prezzo_al_metro)} / Mt)", ParagraphStyle("tab", parent=styles["Normal"], fontSize=10, textColor=colors.white, alignment=TA_RIGHT)),
          Paragraph(f"<b>{_fmt_eur(base)}</b>&nbsp;&nbsp;+ IVA", ParagraphStyle("tav", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=12, textColor=colors.white, alignment=TA_RIGHT))]],
        colWidths=[130*mm, 56*mm],
    )
    tot_a_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY_LIGHT),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4),
        ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
    ]))
    story.append(tot_a_tbl)
    story.append(Spacer(1, 4))

    # ------------------------------------------------------------------
    # LISTINO VARIABILI (materiali + lavorazioni extra)
    # ------------------------------------------------------------------
    story.append(_section_header("LISTINO OPZIONI E VARIANTI NON INCLUSE NEL PREVENTIVO", NAVY, st_section))

    orca_totale = float(p.supplemento_orca) * metri_val
    rif_totale = float(p.prezzo_rifinitura_strisciato) * metri_val
    bot_totale = float(p.prezzo_bottazzo_doppio or 0) * metri_val

    listino_rows = [
        # Tessuti
        [Paragraph("<b>TESSUTI DISPONIBILI</b>", st_row_bold), "", ""],
        [Paragraph("Tessuto Novurania hypair hypalon 1° scelta", st_row),
         Paragraph("incluso", st_row_bold), ""],
        [Paragraph(f"Tessuto ORCA (al metro lineare — {metri_val:g} Mt)", st_row),
         Paragraph(_fmt_eur(orca_totale), st_row_bold), ""],
        # Lavorazioni
        [Paragraph("<b>LAVORAZIONI EXTRA</b>", st_row_bold), "", ""],
        [Paragraph(f"A) Rifinitura interna strisciato (al metro lineare — {metri_val:g} Mt)", st_row),
         Paragraph(_fmt_eur(rif_totale), st_row_bold), ""],
        [Paragraph(f"B) Bottazzo doppio h 90 mm (al metro lineare — {metri_val:g} Mt)", st_row),
         Paragraph(_fmt_eur(bot_totale), st_row_bold), ""],
        [Paragraph("C) Apposizione pezze di velocità su coni dx-sx", st_row),
         Paragraph(_stato_prezzo(cfg.apposizione_pezze_velocita), st_row_bold), ""],
        [Paragraph("D) Maniglioni aggiuntivi (cad.)", st_row),
         Paragraph(_fmt_eur(p.prezzo_maniglione), st_row_bold), ""],
        [Paragraph("E) Scritte / Loghi con taglio laser", st_row),
         Paragraph(_stato_prezzo(cfg.scritte_loghi_taglio_laser), st_row_bold), ""],
        [Paragraph("F) Colori tubo differenti / graffiati (carbon, perlage…)", st_row),
         Paragraph(_stato_prezzo(cfg.colori_tubo_differenti), st_row_bold), ""],
        [Paragraph("G) Grafiche particolari / repliche originali", st_row),
         Paragraph("da valutare", st_row_bold), ""],
        [Paragraph("H) Rinforzi per gommoni diving", st_row),
         Paragraph("da valutare", st_row_bold), ""],
    ]
    tl = Table(listino_rows, colWidths=[106*mm, 42*mm, 38*mm])
    tl_style = [
        ("BOX", (0,0), (-1,-1), 0.4, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e6ebf1")),
        ("SPAN", (0,0), (-1,0)),
        ("BACKGROUND", (0,3), (-1,3), colors.HexColor("#e6ebf1")),
        ("SPAN", (0,3), (-1,3)),
        ("ALIGN", (1,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 2.5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 2.5),
        ("TEXTCOLOR", (0,0), (-1,0), NAVY),
        ("TEXTCOLOR", (0,3), (-1,3), NAVY),
    ]
    tl.setStyle(TableStyle(tl_style))
    tl_style = [
        ("BOX", (0,0), (-1,-1), 0.4, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
        ("BACKGROUND", (0,0), (-1,0), colors.HexColor("#e6ebf1")),
        ("SPAN", (0,0), (-1,0)),
        ("BACKGROUND", (0,3), (-1,3), colors.HexColor("#e6ebf1")),
        ("SPAN", (0,3), (-1,3)),
        ("ALIGN", (1,0), (-1,-1), "CENTER"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
        ("TOPPADDING", (0,0), (-1,-1), 1.3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 1.3),
        ("TEXTCOLOR", (0,0), (-1,0), NAVY),
        ("TEXTCOLOR", (0,3), (-1,3), NAVY),
    ]
    tl.setStyle(TableStyle(tl_style))
    story.append(tl)
    story.append(Spacer(1, 3))

    # ------------------------------------------------------------------
    # OPZIONI SCELTE (solo se ce ne sono)
    # ------------------------------------------------------------------
    scelte_rows_data = []
    if p.tessuto == "orca":
        scelte_rows_data.append((f"Tessuto ORCA  ({_fmt_eur(p.supplemento_orca)} / Mt × {metri_val:g} Mt)", _fmt_eur(orca_totale)))
    if p.include_rifinitura_strisciato:
        scelte_rows_data.append((f"A) Rifinitura interna strisciato  ({_fmt_eur(p.prezzo_rifinitura_strisciato)} / Mt × {metri_val:g} Mt)", _fmt_eur(rif_totale)))
    if p.include_bottazzo_doppio:
        scelte_rows_data.append((f"B) Bottazzo doppio h 90 mm  ({_fmt_eur(p.prezzo_bottazzo_doppio)} / Mt × {metri_val:g} Mt)", _fmt_eur(bot_totale)))
    if p.include_pezze_velocita:
        val = float(p.prezzo_pezze_velocita or 0)
        scelte_rows_data.append(("C) Apposizione pezze di velocità", _fmt_eur(val) if val > 0 else "da valutare"))
    if p.maniglioni_aggiuntivi and p.maniglioni_aggiuntivi > 0:
        scelte_rows_data.append((f"D) Maniglioni aggiuntivi ({p.maniglioni_aggiuntivi} × {_fmt_eur(p.prezzo_maniglione)})", _fmt_eur(p.prezzo_maniglione * p.maniglioni_aggiuntivi)))
    if p.scritte_loghi_laser:
        val = float(p.prezzo_scritte_loghi or 0)
        scelte_rows_data.append(("E) Scritte / Loghi con taglio laser", _fmt_eur(val) if val > 0 else "da valutare"))
    if p.colori_tubo_differenti:
        val = float(p.prezzo_colori_tubo_differenti or 0)
        scelte_rows_data.append(("F) Colori tubo differenti / graffiati", _fmt_eur(val) if val > 0 else "da valutare"))
    if p.grafiche_particolari and p.prezzo_grafiche_particolari > 0:
        scelte_rows_data.append(("G) Grafiche particolari / repliche originali", _fmt_eur(p.prezzo_grafiche_particolari)))
    if p.rinforzi_diving and p.prezzo_rinforzi_diving > 0:
        scelte_rows_data.append(("H) Rinforzi per gommoni diving", _fmt_eur(p.prezzo_rinforzi_diving)))

    if scelte_rows_data:
        story.append(_section_header("OPZIONI SCELTE PER QUESTO PREVENTIVO", GREEN_HEAD, st_section))
        scelte_tbl_rows = [
            [Paragraph("Sostituzione tubolare (base)", st_row),
             Paragraph(_fmt_eur(base), st_row_bold)],
        ]
        for lbl, val in scelte_rows_data:
            scelte_tbl_rows.append([Paragraph(lbl, st_row), Paragraph(val, st_row_bold)])
        ts = Table(scelte_tbl_rows, colWidths=[151*mm, 35*mm])
        ts.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.4, BORDER),
            ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, GREEN_BG]),
            ("ALIGN", (1,0), (1,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 8),
            ("RIGHTPADDING", (0,0), (-1,-1), 8),
            ("TOPPADDING", (0,0), (-1,-1), 1.3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 1.3),
        ]))
        story.append(ts)
        story.append(Spacer(1, 3))

    # ------------------------------------------------------------------
    # TOTALE finale — box scuro con etichetta + valore
    # ------------------------------------------------------------------
    totale_finale = p.totale if scelte_rows_data else base
    label_tot = "TOTALE PREVENTIVO — Con opzioni scelte" if scelte_rows_data else "TOTALE PREVENTIVO"
    tot_tbl = Table(
        [[Paragraph(label_tot, st_totale_label),
          Paragraph(f"{_fmt_eur(totale_finale)}", st_totale_val)],
         ["",
          Paragraph("+ IVA", ParagraphStyle("iva", parent=styles["Normal"], fontSize=9, textColor=colors.white, alignment=TA_RIGHT))]],
        colWidths=[130*mm, 56*mm],
    )
    tot_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING", (0,0), (-1,-1), 12),
        ("RIGHTPADDING", (0,0), (-1,-1), 12),
        ("LINEBELOW", (0,0), (-1,0), 0, colors.transparent),
    ]))
    story.append(tot_tbl)
    story.append(Spacer(1, 3))

    # ------------------------------------------------------------------
    # NOTE del preventivo (opzionali)
    # ------------------------------------------------------------------
    if p.note and p.note.strip():
        story.append(Paragraph("<b>Note</b>", ParagraphStyle("nh", parent=styles["Normal"], fontSize=9, textColor=NAVY, leading=11)))
        for line in p.note.split("\n"):
            if line.strip():
                story.append(Paragraph(line, st_row))
        story.append(Spacer(1, 4))

    # ------------------------------------------------------------------
    # CONDIZIONI + FIRMA (due colonne)
    # ------------------------------------------------------------------
    cond_lines = []
    cond_lines.append(f"•  Tempi di esecuzione: {cfg.tempi_esecuzione_giorni} gg circa dalla consegna del battello in cantiere")
    for line in (cfg.note_standard or "").split("\n"):
        s = line.strip().lstrip("-").strip()
        if s:
            cond_lines.append(f"•  {s}")
    cond_paras = [Paragraph("<b>CONDIZIONI</b>", ParagraphStyle("ch", parent=styles["Normal"], fontSize=8, textColor=NAVY, leading=10))]
    for c in cond_lines:
        cond_paras.append(Paragraph(c, st_footer_terms))

    firma_nome = cantiere.get("firma_nome") or nome_az or ""
    firma_cell = [
        Paragraph("Il titolare", ParagraphStyle("fl", parent=styles["Normal"], fontSize=8, textColor=TEXT_MUTED, alignment=TA_CENTER)),
        Spacer(1, 18),
        Paragraph(f"<b>{firma_nome}</b>", ParagraphStyle("fn", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, textColor=NAVY, alignment=TA_CENTER)),
        HRFlowable(width="80%", thickness=0.5, color=BORDER, spaceBefore=2, spaceAfter=0, hAlign="CENTER"),
    ]

    footer = Table([[cond_paras, firma_cell]], colWidths=[124*mm, 62*mm])
    footer.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("LINEABOVE", (0,0), (-1,0), 0.6, BORDER),
        ("TOPPADDING", (0,0), (-1,-1), 4),
    ]))
    story.append(footer)

    docp.build(story)
    buf.seek(0)
    return buf.getvalue()


def _section_header(text: str, bg_color, style):
    """Header di sezione: barra colorata con testo in bianco."""
    from reportlab.platypus import Table, TableStyle, Paragraph
    from reportlab.lib.units import mm
    t = Table([[Paragraph(text, style)]], colWidths=[186*mm])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), bg_color),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING", (0,0), (-1,-1), 8),
    ]))
    return t
