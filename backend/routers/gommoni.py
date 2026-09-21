"""Modulo Gommoni GEB: catalogo, accessori, listini (pubblico/cantiere), import AI, preventivi PDF."""
import base64
import io
import os
from datetime import datetime, timezone
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorGridFSBucket

from database import db
from helpers import serialize
from models import (
    GommoneModello, GommoneModelloCreate, GommoneBulkCreate,
    GommoneAccessorio, GommoneAccessorioCreate, GommoneSconti,
    GommonePreventivo, GommonePreventivoCreate, SuzukiImportRequest,
)
from routers.suzuki import (
    _logo_flowable, _fmt_eur, _get_condizioni_preventivo,
    _pdf_pages_to_images_b64, _extract_json_array,
)

router = APIRouter(prefix="/gommoni", tags=["Gommoni"])

CATEGORIE_SCONTO = {"privati": "Privati", "lavoro": "Lavoro", "concessionari": "Concessionari"}


# ---------------------------------------------------------------------------
# CATALOGO MODELLI
# ---------------------------------------------------------------------------
@router.get("/modelli", response_model=List[GommoneModello])
async def list_modelli():
    docs = await db.gommoni_modelli.find({}, {"_id": 0}).sort([("ordine", 1), ("lunghezza_m", 1), ("modello", 1)]).to_list(1000)
    return [GommoneModello(**d) for d in docs]


@router.post("/modelli", response_model=GommoneModello)
async def create_modello(payload: GommoneModelloCreate):
    m = GommoneModello(**payload.model_dump())
    await db.gommoni_modelli.insert_one(serialize(m))
    return m


@router.post("/modelli/bulk", response_model=List[GommoneModello])
async def bulk_modelli(payload: GommoneBulkCreate):
    out = []
    for p in payload.modelli:
        if not p.modello.strip():
            continue
        m = GommoneModello(**p.model_dump())
        await db.gommoni_modelli.insert_one(serialize(m))
        out.append(m)
    return out


@router.put("/modelli/{mid}", response_model=GommoneModello)
async def update_modello(mid: str, payload: GommoneModelloCreate):
    doc = await db.gommoni_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Modello non trovato")
    m = GommoneModello(**{**doc, **payload.model_dump(), "updated_at": datetime.now(timezone.utc)})
    await db.gommoni_modelli.update_one({"id": mid}, {"$set": serialize(m)})
    return m


@router.delete("/modelli/{mid}")
async def delete_modello(mid: str):
    doc = await db.gommoni_modelli.find_one({"id": mid}, {"_id": 0, "omologazione_file_id": 1})
    res = await db.gommoni_modelli.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Modello non trovato")
    if doc and doc.get("omologazione_file_id"):
        await _delete_gridfs(doc["omologazione_file_id"])
    return {"ok": True}


# ---------------------------------------------------------------------------
# OMOLOGAZIONE PDF (GridFS)
# ---------------------------------------------------------------------------
def _bucket() -> AsyncIOMotorGridFSBucket:
    return AsyncIOMotorGridFSBucket(db, bucket_name="gommoni_omologazioni")


async def _delete_gridfs(fid: str):
    try:
        await _bucket().delete(ObjectId(fid))
    except Exception:
        pass


@router.post("/modelli/{mid}/omologazione")
async def upload_omologazione(mid: str, file: UploadFile = File(...)):
    doc = await db.gommoni_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Modello non trovato")
    data = await file.read()
    if data[:4] != b"%PDF":
        raise HTTPException(400, "Il file deve essere un PDF")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(400, "File troppo grande (max 20 MB)")
    if doc.get("omologazione_file_id"):
        await _delete_gridfs(doc["omologazione_file_id"])
    fid = await _bucket().upload_from_stream(file.filename or "omologazione.pdf", data, metadata={"modello_id": mid})
    await db.gommoni_modelli.update_one({"id": mid}, {"$set": {
        "omologazione_file_id": str(fid), "omologazione_nome": file.filename or "omologazione.pdf",
        "updated_at": datetime.now(timezone.utc)}})
    return {"ok": True, "file_id": str(fid), "nome": file.filename}


@router.get("/modelli/{mid}/omologazione.pdf")
async def get_omologazione(mid: str):
    doc = await db.gommoni_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc or not doc.get("omologazione_file_id"):
        raise HTTPException(404, "Omologazione non caricata")
    try:
        stream = await _bucket().open_download_stream(ObjectId(doc["omologazione_file_id"]))
        data = await stream.read()
    except Exception:
        raise HTTPException(404, "File non trovato")
    nome = (doc.get("omologazione_nome") or "omologazione.pdf").replace('"', "")
    return StreamingResponse(io.BytesIO(data), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="{nome}"'})


@router.delete("/modelli/{mid}/omologazione")
async def delete_omologazione(mid: str):
    doc = await db.gommoni_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Modello non trovato")
    if doc.get("omologazione_file_id"):
        await _delete_gridfs(doc["omologazione_file_id"])
    await db.gommoni_modelli.update_one({"id": mid}, {"$set": {"omologazione_file_id": "", "omologazione_nome": ""}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# ACCESSORI OPTIONAL
# ---------------------------------------------------------------------------
@router.get("/accessori", response_model=List[GommoneAccessorio])
async def list_accessori():
    docs = await db.gommoni_accessori.find({}, {"_id": 0}).sort([("categoria", 1), ("nome", 1)]).to_list(2000)
    return [GommoneAccessorio(**d) for d in docs]


@router.post("/accessori", response_model=GommoneAccessorio)
async def create_accessorio(payload: GommoneAccessorioCreate):
    a = GommoneAccessorio(**payload.model_dump())
    await db.gommoni_accessori.insert_one(serialize(a))
    return a


@router.put("/accessori/{aid}", response_model=GommoneAccessorio)
async def update_accessorio(aid: str, payload: GommoneAccessorioCreate):
    doc = await db.gommoni_accessori.find_one({"id": aid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Accessorio non trovato")
    a = GommoneAccessorio(**{**doc, **payload.model_dump(), "updated_at": datetime.now(timezone.utc)})
    await db.gommoni_accessori.update_one({"id": aid}, {"$set": serialize(a)})
    return a


@router.delete("/accessori/{aid}")
async def delete_accessorio(aid: str):
    res = await db.gommoni_accessori.delete_one({"id": aid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Accessorio non trovato")
    return {"ok": True}


# ---------------------------------------------------------------------------
# SCONTI PER TIPOLOGIA CLIENTE
# ---------------------------------------------------------------------------
async def _get_sconti() -> GommoneSconti:
    doc = await db.gommoni_settings.find_one({"id": "sconti"}, {"_id": 0, "id": 0, "updated_at": 0}) or {}
    return GommoneSconti(**doc)


@router.get("/sconti", response_model=GommoneSconti)
async def get_sconti():
    return await _get_sconti()


@router.put("/sconti", response_model=GommoneSconti)
async def save_sconti(payload: GommoneSconti):
    for v in (payload.privati, payload.lavoro, payload.concessionari):
        if not (0 <= v <= 100):
            raise HTTPException(400, "Percentuali fuori range 0-100")
    await db.gommoni_settings.update_one(
        {"id": "sconti"},
        {"$set": {**payload.model_dump(), "updated_at": datetime.now(timezone.utc)}},
        upsert=True,
    )
    return payload


# ---------------------------------------------------------------------------
# IMPORT AI
# ---------------------------------------------------------------------------
_IMPORT_PROMPT = (
    "Sei un assistente che analizza listini e schede tecniche di GOMMONI (battelli pneumatici) in italiano.\n"
    "Estrai la lista di TUTTI i modelli visibili nella pagina fornita, con TUTTE le caratteristiche tecniche riportate.\n"
    "Rispondi SOLO con un array JSON, ogni elemento con le chiavi:\n"
    '  "modello": nome del gommone (stringa)\n'
    '  "lunghezza_m": lunghezza fuori tutto in metri (numero)\n'
    '  "larghezza_m": larghezza in metri (numero)\n'
    '  "diametro_tubolare_cm": diametro tubolare in cm (numero)\n'
    '  "compartimenti": numero compartimenti (intero)\n'
    '  "portata_persone": persone trasportabili (intero)\n'
    '  "potenza_max_hp": potenza massima motore in HP (numero)\n'
    '  "peso_kg": peso in kg (numero)\n'
    '  "carena": tipo di carena, categoria di progettazione CE, lunghezza interna se presenti (stringa)\n'
    '  "tessuto": tessuto tubolare es. PVC, Hypalon/Neoprene (H) con grammatura (stringa)\n'
    '  "lunghezza_interna_cm": misura interna in cm (numero)\n'
    '  "categoria_ce": categoria di progettazione CE es. C, C/B (stringa)\n'
    '  "potenza_min_hp": potenza minima motore in HP (numero)\n'
    '  "specchio": gambo/specchio di poppa es. L, XL, XXL (stringa)\n'
    '  "dotazioni": elenco COMPLETO delle dotazioni di serie e delle caratteristiche descrittive (stringa, separate da virgola)\n'
    '  "prezzo_pubblico": prezzo al pubblico in euro IVA inclusa (numero, 0 se assente)\n'
    '  "note": altre informazioni tecniche utili non rientranti nelle chiavi precedenti (stringa)\n'
    "Se un dato non è presente, usa stringa vuota o 0.\n"
    "NON aggiungere testo prima o dopo il JSON. NON usare fenced code block."
)


async def _run_vision(images_b64: List[str]) -> List[dict]:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY non configurata")
    rows: List[dict] = []
    for idx, b64 in enumerate(images_b64):
        clean = b64.split(",", 1)[-1] if "," in b64 else b64
        chat = LlmChat(
            api_key=api_key,
            session_id=f"gommoni-import-{datetime.now().timestamp()}-{idx}",
            system_message="Sei un OCR avanzato specializzato in listini e schede tecniche di gommoni. Preciso e sintetico.",
        ).with_model("gemini", "gemini-3-flash-preview")
        msg = UserMessage(text=_IMPORT_PROMPT, file_contents=[ImageContent(image_base64=clean)])
        chunks: List[str] = []
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                chunks.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        parsed = _extract_json_array("".join(chunks).strip())
        if isinstance(parsed, list):
            rows.extend([r for r in parsed if isinstance(r, dict)])
    return rows


@router.post("/import-ai")
async def import_ai(payload: SuzukiImportRequest):
    rows = await _import_rows(payload)
    return {"count": len(rows), "modelli": rows}


@router.post("/import-ai-scheda")
async def import_ai_scheda(payload: SuzukiImportRequest):
    """Analizza la scheda tecnica di UN gommone e ritorna le caratteristiche (per compilare il form)."""
    rows = await _import_rows(payload)
    if not rows:
        raise HTTPException(400, "Nessuna caratteristica riconosciuta nel file")
    merged: dict = {}
    for r in rows:
        for k, v in r.items():
            if v not in ("", 0, None) and k not in merged:
                merged[k] = v
    return {"caratteristiche": merged}


async def _import_rows(payload: SuzukiImportRequest) -> List[dict]:
    if not payload.file_base64:
        raise HTTPException(400, "File mancante")
    raw = payload.file_base64.split(",", 1)[-1] if "," in payload.file_base64 else payload.file_base64
    try:
        data = base64.b64decode(raw)
    except Exception:
        raise HTTPException(400, "Base64 non valido")
    if (payload.file_name or "").lower().endswith(".pdf") or data[:4] == b"%PDF":
        images = _pdf_pages_to_images_b64(data)
        if not images:
            raise HTTPException(400, "PDF vuoto o non leggibile")
    else:
        images = [raw]
    return await _run_vision(images)


# ---------------------------------------------------------------------------
# PDF LISTINI E CARATTERISTICHE
# ---------------------------------------------------------------------------
def _pdf_header(story, title: str, subtitle: str, color, styles):
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import Paragraph, Spacer, Table, TableStyle

    logo = _logo_flowable(max_w_mm=42, max_h_mm=22)
    t = Paragraph(f"<b>{title}</b>", ParagraphStyle("t", parent=styles["Heading1"], fontSize=14, textColor=color, spaceAfter=2))
    s = Paragraph(subtitle, ParagraphStyle("s", parent=styles["Normal"], fontSize=9, textColor=colors.grey))
    if logo:
        head = Table([[logo, [t, s]]], colWidths=[46*mm, 140*mm])
        head.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 0)]))
        story.append(head)
    else:
        story += [t, s]
    story.append(Spacer(1, 8))


def _fmt_n(v, suffix=""):
    try:
        f = float(v)
        if f > 0:
            return f"{f:g}{suffix}"
    except Exception:
        pass
    return "—"


async def _build_listino_pdf(categoria: Optional[str] = None):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    docs = await db.gommoni_modelli.find({}, {"_id": 0}).sort([("ordine", 1), ("lunghezza_m", 1)]).to_list(1000)
    if not docs:
        raise HTTPException(400, "Nessun gommone in catalogo.")
    styles = getSampleStyleSheet()
    NAVY = colors.HexColor("#0F2A47")
    ACCENT = colors.HexColor("#C62828")
    LIGHT = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")

    cantiere = categoria is not None
    sconti = await _get_sconti() if cantiere else None
    sc = float(getattr(sconti, categoria, 0)) if cantiere else 0.0

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)
    story = []
    if cantiere:
        title = f"GOMMONI GEB — Listino Cantiere · {CATEGORIE_SCONTO.get(categoria, categoria)} (sconto {sc:g}%)"
        sub = "GEB di Palmieri Sandro · <b>DOCUMENTO RISERVATO</b>"
    else:
        title = "GOMMONI GEB — Listino Pubblico"
        sub = "GEB di Palmieri Sandro · Costruzione gommoni a marchio proprio"
    _pdf_header(story, title, sub, ACCENT if cantiere else NAVY, styles)

    st_head = ParagraphStyle("hd", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=8, leading=9.5, textColor=colors.white, alignment=TA_CENTER)
    head = ["Modello", "Lungh.", "Largh.", "Ø Tub.", "Persone", "HP max", "Peso", "Pubblico € (IVA incl.)"]
    widths = [40*mm, 18*mm, 18*mm, 18*mm, 18*mm, 18*mm, 18*mm, 38*mm]
    if cantiere:
        head += [f"Sconto {sc:g}%", "Netto € (IVA incl.)"]
        widths = [34*mm, 15*mm, 15*mm, 15*mm, 15*mm, 15*mm, 15*mm, 28*mm, 20*mm, 28*mm]
    data = [[Paragraph(h, st_head) for h in head]]
    for r in docs:
        pub = float(r.get("prezzo_pubblico") or 0)
        row = [
            r.get("modello", ""),
            _fmt_n(r.get("lunghezza_m"), " m"), _fmt_n(r.get("larghezza_m"), " m"),
            _fmt_n(r.get("diametro_tubolare_cm"), " cm"), _fmt_n(r.get("portata_persone")),
            _fmt_n(r.get("potenza_max_hp")), _fmt_n(r.get("peso_kg"), " kg"),
            _fmt_eur(pub) if pub else "—",
        ]
        if cantiere:
            netto = pub * (1 - sc/100)
            row += ["− " + _fmt_eur(pub - netto) if pub else "—", _fmt_eur(netto) if pub else "—"]
        data.append(row)
    t = Table(data, colWidths=widths, repeatRows=1)
    style = [
        ("BACKGROUND", (0,0), (-1,0), ACCENT if cantiere else NAVY),
        ("FONTSIZE", (0,0), (-1,-1), 8.5),
        ("ALIGN", (1,1), (-1,-1), "CENTER"),
        ("ALIGN", (7,1), (-1,-1), "RIGHT"),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
        ("GRID", (0,0), (-1,-1), 0.25, BORDER),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4),
        ("FONTNAME", (0,1), (0,-1), "Helvetica-Bold"),
    ]
    if cantiere:
        style += [("BACKGROUND", (9,1), (9,-1), colors.HexColor("#FDECEC")), ("TEXTCOLOR", (9,1), (9,-1), ACCENT), ("FONTNAME", (9,1), (9,-1), "Helvetica-Bold")]
    t.setStyle(TableStyle(style))
    story.append(t)
    story.append(Spacer(1, 8))
    story.append(Paragraph("<i>Prezzi IVA inclusa, salvo variazioni. Gommoni costruiti da GEB di Palmieri Sandro. Accessori optional quotati a parte.</i>",
                           ParagraphStyle("note", parent=styles["Normal"], fontSize=8, textColor=colors.grey)))

    acc = await db.gommoni_accessori.find({}, {"_id": 0}).sort([("categoria", 1), ("nome", 1)]).to_list(2000)
    if acc:
        story.append(Spacer(1, 10))
        story.append(Paragraph("<b>ACCESSORI OPTIONAL</b>", ParagraphStyle("cat", parent=styles["Heading3"], fontSize=11, textColor=NAVY, spaceAfter=4)))
        adata = [[Paragraph(h, st_head) for h in ["Accessorio", "Categoria", "Descrizione", "Prezzo € (IVA incl.)"]]]
        for a in acc:
            adata.append([a.get("nome", ""), a.get("categoria", "") or "—", a.get("descrizione", "") or "—", _fmt_eur(a.get("prezzo") or 0)])
        ta = Table(adata, colWidths=[50*mm, 30*mm, 70*mm, 36*mm], repeatRows=1)
        ta.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY), ("FONTSIZE", (0,0), (-1,-1), 8.5),
            ("ALIGN", (3,1), (3,-1), "RIGHT"), ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
            ("GRID", (0,0), (-1,-1), 0.25, BORDER), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(ta)

    doc.build(story)
    buf.seek(0)
    fn = f"listino_gommoni_geb_{categoria or 'pubblico'}.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'inline; filename="{fn}"'})


@router.get("/listino.pdf")
async def listino_pdf():
    return await _build_listino_pdf(None)


@router.get("/listino-cantiere.pdf")
async def listino_cantiere_pdf(categoria: str = "privati"):
    if categoria not in CATEGORIE_SCONTO:
        raise HTTPException(400, "Categoria non valida")
    return await _build_listino_pdf(categoria)


@router.get("/caratteristiche.pdf")
async def caratteristiche_pdf():
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether

    docs = await db.gommoni_modelli.find({}, {"_id": 0}).sort([("ordine", 1), ("lunghezza_m", 1)]).to_list(1000)
    if not docs:
        raise HTTPException(400, "Nessun gommone in catalogo.")
    styles = getSampleStyleSheet()
    NAVY = colors.HexColor("#0F2A47")
    LIGHT = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")
    st_lab = ParagraphStyle("l", parent=styles["Normal"], fontSize=7.5, textColor=colors.HexColor("#667085"))
    st_val = ParagraphStyle("v", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9.5)
    st_txt = ParagraphStyle("x", parent=styles["Normal"], fontSize=8.5, leading=11)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)
    story = []
    _pdf_header(story, "GOMMONI GEB — Caratteristiche tecniche", "GEB di Palmieri Sandro · Costruzione gommoni a marchio proprio", NAVY, styles)

    def cell(l, v):
        return [Paragraph(l.upper(), st_lab), Paragraph(v or "—", st_val)]

    for r in docs:
        block = [Paragraph(f"<b>{r.get('modello','')}</b>", ParagraphStyle("m", parent=styles["Heading3"], fontSize=12, textColor=NAVY, spaceBefore=6, spaceAfter=3))]
        cells = [
            cell("Misura esterna", f"{_fmt_n(r.get('lunghezza_m'), ' m')} × {_fmt_n(r.get('larghezza_m'), ' m')}"), cell("Misura interna", _fmt_n(r.get("lunghezza_interna_cm"), " cm")),
            cell("Ø tubolare", _fmt_n(r.get("diametro_tubolare_cm"), " cm")), cell("Camere", _fmt_n(r.get("compartimenti"))),
            cell("Portata persone", _fmt_n(r.get("portata_persone"))), cell("CV min – max", f"{_fmt_n(r.get('potenza_min_hp'))} – {_fmt_n(r.get('potenza_max_hp'))} HP"),
            cell("Massa", _fmt_n(r.get("peso_kg"), " kg")), cell("Carena", r.get("carena") or "—"),
            cell("Materiale tub.", r.get("tessuto") or "—"), cell("Categoria CE", r.get("categoria_ce") or "—"),
            cell("Specchio", r.get("specchio") or "—"), cell("Prezzo pubblico", _fmt_eur(r.get("prezzo_pubblico") or 0)),
        ]
        rows = [cells[i:i+4] for i in range(0, 12, 4)]
        tg = Table(rows, colWidths=[46.5*mm]*4)
        tg.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.4, BORDER), ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT]), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        block.append(tg)
        if r.get("dotazioni"):
            block.append(Spacer(1, 3))
            block.append(Paragraph(f"<b>Dotazioni di serie:</b> {r['dotazioni']}", st_txt))
        if r.get("note"):
            block.append(Paragraph(f"<b>Note:</b> {r['note']}", st_txt))
        story.append(KeepTogether(block))
        story.append(Spacer(1, 4))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": 'inline; filename="caratteristiche_gommoni_geb.pdf"'})


# ---------------------------------------------------------------------------
# PREVENTIVI
# ---------------------------------------------------------------------------
def _calc(p: GommonePreventivo) -> dict:
    pub = float(p.prezzo_gommone or 0)
    sc = float(p.sconto_perc or 0)
    sconto = round(pub * sc / 100, 2)
    netto_gommone = round(pub - sconto, 2)
    accessori = round(sum(float(a.prezzo or 0) * int(a.quantita or 1) for a in p.accessori), 2)
    motore = float(p.motore_prezzo or 0)
    msc = float(p.motore_sconto_perc or 0)
    motore_netto = round(motore * (1 - msc/100), 2)
    montaggio = float(p.montaggio or 0)
    totale = round(netto_gommone + accessori + motore_netto + montaggio, 2)
    return {"pubblico": pub, "sconto": sconto, "netto_gommone": netto_gommone, "accessori": accessori,
            "motore": motore, "motore_netto": motore_netto, "montaggio": montaggio, "totale": totale}


async def _next_numero() -> str:
    year = datetime.now().year
    n = await db.gommoni_preventivi.count_documents({"data": {"$regex": f"^{year}-"}})
    return f"G{year}-{n+1:03d}"


@router.get("/preventivi", response_model=List[GommonePreventivo])
async def list_preventivi():
    docs = await db.gommoni_preventivi.find({}, {"_id": 0}).sort("data", -1).to_list(2000)
    return [GommonePreventivo(**d) for d in docs]


@router.post("/preventivi", response_model=GommonePreventivo)
async def create_preventivo(payload: GommonePreventivoCreate):
    data = payload.model_dump()
    data["data"] = data.get("data") or datetime.now(timezone.utc).date().isoformat()
    data["numero"] = data.get("numero") or await _next_numero()
    p = GommonePreventivo(**data)
    await db.gommoni_preventivi.insert_one(serialize(p))
    return p


@router.put("/preventivi/{pid}", response_model=GommonePreventivo)
async def update_preventivo(pid: str, payload: GommonePreventivoCreate):
    doc = await db.gommoni_preventivi.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    data = payload.model_dump(exclude_none=True)
    p = GommonePreventivo(**{**doc, **data, "updated_at": datetime.now(timezone.utc)})
    await db.gommoni_preventivi.update_one({"id": pid}, {"$set": serialize(p)})
    return p


@router.delete("/preventivi/{pid}")
async def delete_preventivo(pid: str):
    res = await db.gommoni_preventivi.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Preventivo non trovato")
    return {"ok": True}


@router.post("/preventivi/preview-pdf")
async def preview_pdf(payload: GommonePreventivoCreate):
    data = payload.model_dump()
    data["data"] = data.get("data") or datetime.now(timezone.utc).date().isoformat()
    data["numero"] = data.get("numero") or "ANTEPRIMA"
    pdf = await _build_preventivo_pdf(GommonePreventivo(**data))
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": 'inline; filename="anteprima_preventivo_gommone.pdf"'})


@router.get("/preventivi/{pid}/pdf")
async def preventivo_pdf(pid: str):
    doc = await db.gommoni_preventivi.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    p = GommonePreventivo(**doc)
    pdf = await _build_preventivo_pdf(p)
    return StreamingResponse(io.BytesIO(pdf), media_type="application/pdf",
                             headers={"Content-Disposition": f'inline; filename="preventivo_gommone_{p.numero or p.id}.pdf"'})


async def _build_preventivo_pdf(p: GommonePreventivo) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

    NAVY = colors.HexColor("#0F2A47")
    NAVY_LIGHT = colors.HexColor("#26466B")
    LIGHT = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")
    MUTED = colors.HexColor("#667085")
    styles = getSampleStyleSheet()
    st_label = ParagraphStyle("lab", parent=styles["Normal"], fontSize=8, textColor=MUTED, leading=10)
    st_val = ParagraphStyle("val", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13)
    st_title = ParagraphStyle("t", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY)
    st_sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=9, leading=11, textColor=MUTED)
    st_row = ParagraphStyle("row", parent=styles["Normal"], fontSize=9, leading=12)
    st_row_b = ParagraphStyle("rb", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12)
    st_sec = ParagraphStyle("sec", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.5, textColor=colors.white, leading=13)
    st_footer = ParagraphStyle("f", parent=styles["Normal"], fontSize=8, textColor=MUTED, leading=11)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14*mm, rightMargin=14*mm, topMargin=10*mm, bottomMargin=10*mm)

    def section(text):
        t = Table([[Paragraph(text, st_sec)]], colWidths=[182*mm])
        t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), NAVY), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4), ("LEFTPADDING", (0,0), (-1,-1), 10)]))
        return t

    def money_table(rows):
        t = Table(rows, colWidths=[140*mm, 42*mm])
        t.setStyle(TableStyle([
            ("BOX", (0,0), (-1,-1), 0.4, BORDER), ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT]), ("ALIGN", (1,0), (1,-1), "RIGHT"),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
            ("TOPPADDING", (0,0), (-1,-1), 3), ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        return t

    def highlight(label, value, bg=NAVY_LIGHT, size=13):
        t = Table([[Paragraph(label, ParagraphStyle("hl", parent=st_sec, fontSize=11)),
                    Paragraph(value, ParagraphStyle("hv", parent=st_sec, fontSize=size, alignment=TA_RIGHT))]], colWidths=[140*mm, 42*mm])
        t.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), bg), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                               ("LEFTPADDING", (0,0), (-1,-1), 10), ("RIGHTPADDING", (0,0), (-1,-1), 10),
                               ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
        return t

    story = []
    left_text = [Paragraph("VIA DEGLI ARTIGIANI, 1 · 57034 CAMPO NELL'ELBA (LI)", st_sub),
                 Paragraph("Tel. 347 260 08 72 · info@genbnautica.it · www.genbnautica.it", st_sub)]
    logo = _logo_flowable(max_w_mm=44, max_h_mm=22)
    left = Table([[logo], [left_text]], colWidths=[110*mm]) if logo else [Paragraph("<b>GEB di Palmieri Sandro</b>", st_val), *left_text]
    if logo:
        left.setStyle(TableStyle([("LEFTPADDING", (0,0), (-1,-1), 0), ("TOPPADDING", (0,0), (-1,-1), 0), ("BOTTOMPADDING", (0,0), (-1,-1), 2)]))
    try:
        data_it = datetime.fromisoformat((p.data or "")[:10]).strftime("%d/%m/%Y")
    except Exception:
        data_it = "—"
    right = [Paragraph("PREVENTIVO", st_title), Paragraph("Gommone GEB", st_sub), Spacer(1, 4),
             Table([[Paragraph("N°", st_label), Paragraph(p.numero or "—", st_val)],
                    [Paragraph("Data", st_label), Paragraph(data_it, st_val)]], colWidths=[18*mm, 50*mm],
                   style=TableStyle([("LEFTPADDING", (0,0), (-1,-1), 0), ("TOPPADDING", (0,0), (-1,-1), 1.5), ("BOTTOMPADDING", (0,0), (-1,-1), 1.5)]))]
    header = Table([[left, right]], colWidths=[112*mm, 70*mm])
    header.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0), ("RIGHTPADDING", (0,0), (-1,-1), 0)]))
    story += [header, Spacer(1, 6), HRFlowable(width="100%", thickness=0.8, color=BORDER, spaceAfter=6)]

    cl = [Paragraph("Spettabile", st_label), Paragraph(f"<b>{p.cliente_nome or '—'}</b>", st_val)]
    if p.cliente_telefono:
        cl.append(Paragraph(f"Tel. {p.cliente_telefono}", st_row))
    if p.cliente_email:
        cl.append(Paragraph(f"Email: {p.cliente_email}", st_row))
    cl.append(Paragraph(f"Tipologia: {CATEGORIE_SCONTO.get(p.tipo_cliente or '', p.tipo_cliente or '—')}", st_row))
    cb = Table([[cl]], colWidths=[182*mm])
    cb.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), LIGHT), ("BOX", (0,0), (-1,-1), 0.6, BORDER),
                            ("LEFTPADDING", (0,0), (-1,-1), 10), ("TOPPADDING", (0,0), (-1,-1), 6), ("BOTTOMPADDING", (0,0), (-1,-1), 6)]))
    story += [cb, Spacer(1, 8), section("GOMMONE GEB")]

    def cell(l, v):
        return [Paragraph(l.upper(), st_label), Paragraph(v or "—", st_val)]
    cells = [
        cell("Modello", p.modello), cell("Misura esterna", f"{_fmt_n(p.lunghezza_m, ' m')} × {_fmt_n(p.larghezza_m, ' m')}"), cell("Misura interna", _fmt_n(p.lunghezza_interna_cm, " cm")),
        cell("Ø tubolare", _fmt_n(p.diametro_tubolare_cm, " cm")), cell("Camere", _fmt_n(p.compartimenti)), cell("Portata persone", _fmt_n(p.portata_persone)),
        cell("CV min – max", f"{_fmt_n(p.potenza_min_hp)} – {_fmt_n(p.potenza_max_hp)} HP"), cell("Massa", _fmt_n(p.peso_kg, " kg")), cell("Carena", p.carena or "—"),
        cell("Materiale tub.", p.tessuto or "—"), cell("Categoria CE", p.categoria_ce or "—"), cell("Specchio", p.specchio or "—"),
    ]
    tg = Table([cells[i:i+3] for i in range(0, 12, 3)], colWidths=[60.66*mm]*3)
    tg.setStyle(TableStyle([("BOX", (0,0), (-1,-1), 0.4, BORDER), ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
                            ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT]), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                            ("LEFTPADDING", (0,0), (-1,-1), 8), ("TOPPADDING", (0,0), (-1,-1), 4), ("BOTTOMPADDING", (0,0), (-1,-1), 4)]))
    story.append(tg)
    if p.dotazioni:
        story.append(Spacer(1, 3))
        story.append(Paragraph(f"<b>Dotazioni di serie:</b> {p.dotazioni}", st_row))
    story.append(Spacer(1, 8))

    calc = _calc(p)
    story.append(section("COSTO GOMMONE"))
    rows = [[Paragraph("Prezzo pubblico gommone (IVA inclusa)", st_row), Paragraph(_fmt_eur(calc["pubblico"]), st_row_b)]]
    if p.sconto_perc:
        rows.append([Paragraph(f"Sconto {CATEGORIE_SCONTO.get(p.tipo_cliente or '', '')}: <b>{p.sconto_perc:g}%</b>", st_row), Paragraph("− " + _fmt_eur(calc["sconto"]), st_row_b)])
    story.append(money_table(rows))
    story.append(highlight("NETTO GOMMONE", _fmt_eur(calc["netto_gommone"])))
    story.append(Spacer(1, 8))

    if p.accessori:
        story.append(section("ACCESSORI OPTIONAL"))
        rows = [[Paragraph(f"{a.nome}" + (f" × {a.quantita}" if (a.quantita or 1) > 1 else ""), st_row),
                 Paragraph("+ " + _fmt_eur(float(a.prezzo or 0) * int(a.quantita or 1)), st_row_b)] for a in p.accessori]
        rows.append([Paragraph("<b>Totale accessori</b>", st_row), Paragraph(_fmt_eur(calc["accessori"]), st_row_b)])
        story.append(money_table(rows))
        story.append(Spacer(1, 8))

    if p.motore_modello or calc["motore"] > 0 or calc["montaggio"] > 0:
        story.append(section("MOTORIZZAZIONE"))
        rows = []
        if p.motore_modello or calc["motore"] > 0:
            rows.append([Paragraph(f"Motore {p.motore_modello or ''} (IVA inclusa)", st_row), Paragraph("+ " + _fmt_eur(calc["motore"]), st_row_b)])
        if p.motore_sconto_perc:
            rows.append([Paragraph(f"Sconto motore <b>{p.motore_sconto_perc:g}%</b>", st_row), Paragraph("− " + _fmt_eur(calc["motore"] - calc["motore_netto"]), st_row_b)])
        if calc["montaggio"] > 0:
            rows.append([Paragraph("Montaggio, collaudo e cavetteria", st_row), Paragraph("+ " + _fmt_eur(calc["montaggio"]), st_row_b)])
        story.append(money_table(rows))
        story.append(Spacer(1, 8))

    tot = Table([[Paragraph("TOTALE PREVENTIVO", ParagraphStyle("tl", parent=st_sec, fontSize=11, alignment=TA_RIGHT)),
                  Paragraph(_fmt_eur(calc["totale"]), ParagraphStyle("tv", parent=st_sec, fontSize=15, alignment=TA_RIGHT))],
                 ["", Paragraph("IVA compresa", ParagraphStyle("iva", parent=styles["Normal"], fontSize=9, textColor=colors.white, alignment=TA_RIGHT))]],
                colWidths=[130*mm, 52*mm])
    tot.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,-1), NAVY), ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
                             ("TOPPADDING", (0,0), (-1,-1), 5), ("BOTTOMPADDING", (0,0), (-1,-1), 5), ("RIGHTPADDING", (0,0), (-1,-1), 14)]))
    story += [tot, Spacer(1, 10)]
    if p.note:
        story += [Paragraph(f"<b>Note:</b> {p.note}", st_row), Spacer(1, 6)]

    condizioni = await _get_condizioni_preventivo()
    cond = [Paragraph(t, st_footer) for t in condizioni if t and t.strip()]
    firma = [Paragraph("Il titolare", ParagraphStyle("fl", parent=styles["Normal"], fontSize=9, textColor=MUTED, alignment=TA_CENTER)), Spacer(1, 22),
             Paragraph("<b>Sandro Palmieri</b>", ParagraphStyle("fn", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.5, textColor=NAVY, alignment=TA_CENTER)),
             HRFlowable(width="80%", thickness=0.5, color=BORDER, spaceBefore=2, hAlign="CENTER")]
    footer = Table([[cond, firma]], colWidths=[120*mm, 62*mm])
    footer.setStyle(TableStyle([("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 0), ("LINEABOVE", (0,0), (-1,0), 0.6, BORDER), ("TOPPADDING", (0,0), (-1,-1), 6)]))
    story.append(footer)
    doc.build(story)
    return buf.getvalue()
