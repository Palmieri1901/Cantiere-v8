"""Modulo Fuoribordo Suzuki: catalogo modelli, sconti, preventivi, PDF."""
import base64
import io
import json
import os
import re
from datetime import datetime, timezone
from typing import List, Optional, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from database import db
from helpers import serialize
from models import (
    SuzukiModello, SuzukiModelloCreate, SuzukiModelloUpdate,
    SuzukiPreventivo, SuzukiPreventivoCreate,
    SuzukiImportRequest, SuzukiBulkCreate,
)
from routers import suzuki_seed

router = APIRouter(prefix="/suzuki", tags=["Suzuki"])


# ---------------------------------------------------------------------------
# CRUD MODELLI
# ---------------------------------------------------------------------------
@router.get("/modelli", response_model=List[SuzukiModello])
async def list_modelli(categoria: Optional[str] = None, q: Optional[str] = None):
    query: dict = {}
    if categoria:
        query["categoria"] = categoria
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"modello": rx}, {"codice": rx}, {"note": rx}]
    docs = await db.suzuki_modelli.find(query, {"_id": 0}).sort([("potenza_hp", 1), ("modello", 1)]).to_list(5000)
    result = []
    for d in docs:
        try:
            result.append(SuzukiModello(**d))
        except Exception:
            pass
    return result


@router.get("/modelli/{mid}", response_model=SuzukiModello)
async def get_modello(mid: str):
    doc = await db.suzuki_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Modello non trovato")
    return SuzukiModello(**doc)


@router.post("/modelli", response_model=SuzukiModello)
async def create_modello(payload: SuzukiModelloCreate):
    if not payload.modello or not payload.modello.strip():
        raise HTTPException(400, "Il nome del modello è obbligatorio")
    m = SuzukiModello(**payload.model_dump())
    await db.suzuki_modelli.insert_one(serialize(m))
    return m


@router.put("/modelli/{mid}", response_model=SuzukiModello)
async def update_modello(mid: str, payload: SuzukiModelloUpdate):
    doc = await db.suzuki_modelli.find_one({"id": mid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Modello non trovato")
    updates = {k: v for k, v in payload.model_dump().items() if v is not None}
    new_data = {**doc, **updates, "updated_at": datetime.now(timezone.utc)}
    m = SuzukiModello(**new_data)
    await db.suzuki_modelli.update_one({"id": mid}, {"$set": serialize(m)})
    return m


@router.delete("/modelli/{mid}")
async def delete_modello(mid: str):
    res = await db.suzuki_modelli.delete_one({"id": mid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Modello non trovato")
    return {"ok": True}


@router.post("/modelli/bulk", response_model=List[SuzukiModello])
async def bulk_create_modelli(payload: SuzukiBulkCreate):
    """Crea più modelli in una sola chiamata (usato dopo import AI/CSV)."""
    created: List[SuzukiModello] = []
    for row in payload.modelli:
        if not row.modello or not row.modello.strip():
            continue
        m = SuzukiModello(**row.model_dump())
        await db.suzuki_modelli.insert_one(serialize(m))
        created.append(m)
    return created


@router.post("/seed-listino-2025-2026")
async def seed_listino():
    """Popola il DB con i 61 modelli ufficiali del Listino Suzuki Marine 2025-2026
    (prezzo concessionario IVA escl., prezzo pubblico IVA incl., specifiche tecniche).
    Aggiorna quelli esistenti (match per `modello`) e crea i mancanti."""
    rows = suzuki_seed.build_seed_rows()
    created, updated = 0, 0
    for r in rows:
        existing = await db.suzuki_modelli.find_one({"modello": r["modello"]}, {"_id": 0})
        if existing:
            merged = {**existing, **r, "updated_at": datetime.now(timezone.utc)}
            m = SuzukiModello(**merged)
            await db.suzuki_modelli.update_one({"id": existing["id"]}, {"$set": serialize(m)})
            updated += 1
        else:
            m = SuzukiModello(**r)
            await db.suzuki_modelli.insert_one(serialize(m))
            created += 1
    return {"ok": True, "created": created, "updated": updated, "total": len(rows)}


@router.get("/listino.pdf")
async def listino_pdf():
    """PDF ufficiale del listino gamma Suzuki Marine, raggruppato per categoria HP."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak

    docs = await db.suzuki_modelli.find({}, {"_id": 0}).sort([("potenza_hp", 1), ("modello", 1)]).to_list(1000)
    if not docs:
        raise HTTPException(400, "Nessun modello in catalogo. Popola prima il listino.")

    styles = getSampleStyleSheet()
    NAVY = colors.HexColor("#0F2A47")
    LIGHT = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=12*mm, rightMargin=12*mm, topMargin=12*mm, bottomMargin=12*mm)

    story = [
        Paragraph("<b>SUZUKI MARINE — Listino Gamma Fuoribordo 2025-2026</b>",
                  ParagraphStyle("t", parent=styles["Heading1"], fontSize=15, textColor=NAVY, spaceAfter=2)),
        Paragraph("GEB di Palmieri Sandro · Concessionario Suzuki Marine",
                  ParagraphStyle("s", parent=styles["Normal"], fontSize=9, textColor=colors.grey)),
        Spacer(1, 8),
    ]

    # Raggruppa per categoria
    gruppi: Dict[str, List[dict]] = {}
    for d in docs:
        gruppi.setdefault(d.get("categoria") or "Altro", []).append(d)
    ordine_cat = ["Portatile", "In-linea 2", "In-linea 3", "In-linea 4", "V6", "V6 Flagship", "Altro"]

    for cat in [c for c in ordine_cat if c in gruppi]:
        rows = sorted(gruppi[cat], key=lambda x: (x.get("potenza_hp") or 0, x.get("modello") or ""))
        story.append(Paragraph(f"<b>{cat.upper()}</b>",
                               ParagraphStyle("cat", parent=styles["Heading3"], fontSize=11, textColor=NAVY, spaceBefore=6, spaceAfter=4)))
        head = ["Modello", "HP", "Cilindrata", "Gambo", "Peso", "Listino € (IVA escl.)", "Pubblico € (IVA incl.)"]
        data = [head]
        for r in rows:
            data.append([
                r.get("modello", ""),
                f"{r.get('potenza_hp',0):g}",
                f"{r.get('cilindrata_cc',0):g} cc" if r.get("cilindrata_cc") else "—",
                r.get("gambo", "") or "—",
                f"{r.get('peso_kg',0):g} kg" if r.get("peso_kg") else "—",
                _fmt_eur(r.get("prezzo_listino", 0)) if r.get("prezzo_listino") else "—",
                _fmt_eur(r.get("prezzo_pubblico", 0)) if r.get("prezzo_pubblico") else "—",
            ])
        t = Table(data, colWidths=[38*mm, 12*mm, 22*mm, 22*mm, 16*mm, 38*mm, 38*mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 8.5),
            ("ALIGN", (1,1), (-1,-1), "CENTER"),
            ("ALIGN", (5,1), (-1,-1), "RIGHT"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
            ("GRID", (0,0), (-1,-1), 0.25, BORDER),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 5),
            ("RIGHTPADDING", (0,0), (-1,-1), 5),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(t)

    story.append(Spacer(1, 8))
    story.append(Paragraph(
        "<i>Prezzi Suzuki Italia validi dal listino 2025-2026 salvo variazioni. "
        "Il prezzo IVA inclusa è indicativo per il cliente finale; il concessionario applica le proprie condizioni.</i>",
        ParagraphStyle("note", parent=styles["Normal"], fontSize=8, textColor=colors.grey)))

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": 'inline; filename="listino_suzuki_2025-2026.pdf"'})


@router.get("/caratteristiche.pdf")
async def caratteristiche_pdf():
    """PDF caratteristiche tecniche della gamma Suzuki Marine, raggruppato per categoria."""
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    docs = await db.suzuki_modelli.find({}, {"_id": 0}).sort([("potenza_hp", 1), ("modello", 1)]).to_list(1000)
    if not docs:
        raise HTTPException(400, "Nessun modello in catalogo. Popola prima il listino.")

    styles = getSampleStyleSheet()
    NAVY = colors.HexColor("#0F2A47")
    LIGHT = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=10*mm, rightMargin=10*mm, topMargin=12*mm, bottomMargin=12*mm)

    story = [
        Paragraph("<b>SUZUKI MARINE — Caratteristiche Tecniche Gamma 2025-2026</b>",
                  ParagraphStyle("t", parent=styles["Heading1"], fontSize=14, textColor=NAVY, spaceAfter=2)),
        Paragraph("GEB di Palmieri Sandro · Concessionario Suzuki Marine",
                  ParagraphStyle("s", parent=styles["Normal"], fontSize=9, textColor=colors.grey)),
        Spacer(1, 8),
    ]

    gruppi: Dict[str, List[dict]] = {}
    for d in docs:
        gruppi.setdefault(d.get("categoria") or "Altro", []).append(d)
    ordine_cat = ["Portatile", "In-linea 2", "In-linea 3", "In-linea 4", "V6", "V6 Flagship", "Altro"]

    for cat in [c for c in ordine_cat if c in gruppi]:
        rows = sorted(gruppi[cat], key=lambda x: (x.get("potenza_hp") or 0, x.get("modello") or ""))
        story.append(Paragraph(f"<b>{cat.upper()}</b>",
                               ParagraphStyle("cat", parent=styles["Heading3"], fontSize=11, textColor=NAVY, spaceBefore=6, spaceAfter=4)))
        head = ["Modello", "HP", "Cilindrata", "Cilindri", "Alimentazione", "Peso", "Gambo", "Carburante"]
        data = [head]
        for r in rows:
            data.append([
                r.get("modello", ""),
                f"{r.get('potenza_hp',0):g}",
                f"{r.get('cilindrata_cc',0):g} cc" if r.get("cilindrata_cc") else "—",
                r.get("cilindri", "") or "—",
                r.get("alimentazione", "") or "—",
                f"{r.get('peso_kg',0):g} kg" if r.get("peso_kg") else "—",
                r.get("gambo", "") or "—",
                r.get("carburante", "") or "—",
            ])
        t = Table(data, colWidths=[30*mm, 11*mm, 21*mm, 40*mm, 32*mm, 15*mm, 20*mm, 21*mm], repeatRows=1)
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,0), NAVY),
            ("TEXTCOLOR", (0,0), (-1,0), colors.white),
            ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"),
            ("FONTSIZE", (0,0), (-1,-1), 7.8),
            ("ALIGN", (1,1), (2,-1), "CENTER"),
            ("ALIGN", (5,1), (7,-1), "CENTER"),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, LIGHT]),
            ("GRID", (0,0), (-1,-1), 0.25, BORDER),
            ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
            ("LEFTPADDING", (0,0), (-1,-1), 4),
            ("RIGHTPADDING", (0,0), (-1,-1), 4),
            ("TOPPADDING", (0,0), (-1,-1), 3),
            ("BOTTOMPADDING", (0,0), (-1,-1), 3),
        ]))
        story.append(t)

    doc.build(story)
    buf.seek(0)
    return StreamingResponse(buf, media_type="application/pdf",
                             headers={"Content-Disposition": 'inline; filename="caratteristiche_suzuki_2025-2026.pdf"'})


# ---------------------------------------------------------------------------
# IMPORT AI (PDF/immagine listino Suzuki)
# ---------------------------------------------------------------------------
_IMPORT_PROMPT = (
    "Sei un assistente che analizza il listino ufficiale dei fuoribordo SUZUKI in italiano.\n"
    "Estrai la lista di TUTTI i modelli visibili nella pagina fornita.\n"
    "Rispondi SOLO con un array JSON, ogni elemento con le chiavi:\n"
    '  "codice": codice articolo Suzuki se presente (stringa, altrimenti "")\n'
    '  "modello": sigla del motore (es. "DF150ATL", "DF9.9BS")\n'
    '  "potenza_hp": potenza in HP (numero, es. 150)\n'
    '  "cilindrata_cc": cilindrata in cc (numero se presente, altrimenti 0)\n'
    '  "cilindri": es. "4 in linea", "V6" (stringa)\n'
    '  "alimentazione": es. "EFI", "carburatore" (stringa)\n'
    '  "peso_kg": peso in kg (numero se presente, altrimenti 0)\n'
    '  "avviamento": "elettrico", "manuale" oppure "elettrico + manuale"\n'
    '  "gambo": lunghezza gambo ("S", "L", "UL", "XL")\n'
    '  "trim": es. "PT&T", "idraulico", "manuale"\n'
    '  "comandi": "a distanza" o "da barra"\n'
    '  "alternatore_A": ampere alternatore (numero se presente)\n'
    '  "categoria": es. "Portable", "Mid range", "V6" se ricavabile\n'
    '  "prezzo_listino": prezzo in euro IVA esclusa (numero)\n'
    '  "note": eventuali note utili (stringa breve, altrimenti "")\n'
    "Se un dato non è presente nella pagina, usa stringa vuota o 0.\n"
    "NON aggiungere testo prima o dopo il JSON. NON usare fenced code block."
)


async def _run_vision_images(images_b64: List[str]) -> List[dict]:
    """Invia una o più pagine al modello Gemini e concatena i risultati JSON."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY non configurata")

    all_rows: List[dict] = []
    for idx, b64 in enumerate(images_b64):
        clean_b64 = b64.split(",", 1)[-1] if "," in b64 else b64
        chat = (
            LlmChat(
                api_key=api_key,
                session_id=f"suzuki-import-{datetime.now().timestamp()}-{idx}",
                system_message=(
                    "Sei un OCR avanzato specializzato nell'estrazione di dati tecnici "
                    "dai listini ufficiali dei motori marini Suzuki. Sei preciso e sintetico."
                ),
            )
            .with_model("gemini", "gemini-3-flash-preview")
        )
        msg = UserMessage(text=_IMPORT_PROMPT, file_contents=[ImageContent(image_base64=clean_b64)])
        chunks: List[str] = []
        async for ev in chat.stream_message(msg):
            if isinstance(ev, TextDelta):
                chunks.append(ev.content)
            elif isinstance(ev, StreamDone):
                break
        text = "".join(chunks).strip()
        parsed = _extract_json_array(text)
        if isinstance(parsed, list):
            all_rows.extend([r for r in parsed if isinstance(r, dict)])
    return all_rows


def _extract_json_array(text: str):
    if not text:
        return None
    m = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    candidate = m.group(1) if m else text
    i = candidate.find("[")
    if i == -1:
        return None
    depth = 0
    for j in range(i, len(candidate)):
        if candidate[j] == "[":
            depth += 1
        elif candidate[j] == "]":
            depth -= 1
            if depth == 0:
                try:
                    return json.loads(candidate[i:j+1])
                except Exception:
                    return None
    return None


def _pdf_pages_to_images_b64(pdf_bytes: bytes, max_pages: int = 20) -> List[str]:
    """Renderizza le pagine PDF come PNG base64 usando pymupdf."""
    import pymupdf
    doc = pymupdf.open(stream=pdf_bytes, filetype="pdf")
    images: List[str] = []
    zoom = pymupdf.Matrix(2, 2)  # 2x per leggibilità OCR
    for i, page in enumerate(doc):
        if i >= max_pages:
            break
        pix = page.get_pixmap(matrix=zoom)
        images.append(base64.b64encode(pix.tobytes("png")).decode("ascii"))
    doc.close()
    return images


@router.post("/import-ai")
async def import_ai(payload: SuzukiImportRequest):
    """Analizza un file (PDF/immagine) in base64 e restituisce la lista dei
    modelli riconosciuti (NON salva ancora nel DB — l'utente conferma prima)."""
    if not payload.file_base64:
        raise HTTPException(400, "File mancante")
    raw = payload.file_base64.split(",", 1)[-1] if "," in payload.file_base64 else payload.file_base64
    try:
        data = base64.b64decode(raw)
    except Exception:
        raise HTTPException(400, "Base64 non valido")

    name_lower = (payload.file_name or "").lower()
    if name_lower.endswith(".pdf") or data[:4] == b"%PDF":
        images = _pdf_pages_to_images_b64(data)
        if not images:
            raise HTTPException(400, "PDF vuoto o non leggibile")
    else:
        # immagine singola
        images = [raw]

    rows = await _run_vision_images(images)
    return {"count": len(rows), "modelli": rows}


# ---------------------------------------------------------------------------
# CRUD PREVENTIVI
# ---------------------------------------------------------------------------
def _calc_totale(p: SuzukiPreventivo) -> dict:
    listino = float(p.prezzo_listino or 0)
    s1 = float(p.sconto_perc_1 or 0)
    s2 = float(p.sconto_perc_2 or 0)
    dopo_s1 = listino * (1 - s1 / 100)
    dopo_s2 = dopo_s1 * (1 - s2 / 100)
    netto = round(dopo_s2, 2)
    montaggio = float(p.montaggio or 0)
    totale = round(netto + montaggio, 2)
    return {
        "prezzo_listino": listino,
        "importo_sconto_1": round(listino - dopo_s1, 2),
        "importo_sconto_2": round(dopo_s1 - dopo_s2, 2),
        "netto_motore": netto,
        "montaggio": montaggio,
        "totale_iva_esclusa": totale,
    }


async def _next_numero() -> str:
    year = datetime.now().year
    n = await db.suzuki_preventivi.count_documents({"data": {"$regex": f"^{year}-"}})
    return f"S{year}-{n+1:03d}"


@router.get("/preventivi", response_model=List[SuzukiPreventivo])
async def list_preventivi(stato: Optional[str] = None):
    q: dict = {}
    if stato:
        q["stato"] = stato
    docs = await db.suzuki_preventivi.find(q, {"_id": 0}).sort("data", -1).to_list(2000)
    return [SuzukiPreventivo(**d) for d in docs]


@router.get("/preventivi/{pid}", response_model=SuzukiPreventivo)
async def get_preventivo(pid: str):
    doc = await db.suzuki_preventivi.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    return SuzukiPreventivo(**doc)


@router.post("/preventivi", response_model=SuzukiPreventivo)
async def create_preventivo(payload: SuzukiPreventivoCreate):
    data = payload.model_dump()
    if not data.get("data"):
        data["data"] = datetime.now(timezone.utc).date().isoformat()
    if not data.get("numero"):
        data["numero"] = await _next_numero()
    prev = SuzukiPreventivo(**data)
    await db.suzuki_preventivi.insert_one(serialize(prev))
    return prev


@router.put("/preventivi/{pid}", response_model=SuzukiPreventivo)
async def update_preventivo(pid: str, payload: SuzukiPreventivoCreate):
    doc = await db.suzuki_preventivi.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    data = payload.model_dump()
    new_data = {**doc, **data, "updated_at": datetime.now(timezone.utc)}
    prev = SuzukiPreventivo(**new_data)
    await db.suzuki_preventivi.update_one({"id": pid}, {"$set": serialize(prev)})
    return prev


@router.delete("/preventivi/{pid}")
async def delete_preventivo(pid: str):
    res = await db.suzuki_preventivi.delete_one({"id": pid})
    if res.deleted_count == 0:
        raise HTTPException(404, "Preventivo non trovato")
    return {"ok": True}


@router.post("/preventivi/preview-pdf")
async def preview_pdf(payload: SuzukiPreventivoCreate):
    """Genera un PDF senza salvare il preventivo."""
    data = payload.model_dump()
    if not data.get("data"):
        data["data"] = datetime.now(timezone.utc).date().isoformat()
    if not data.get("numero"):
        data["numero"] = "ANTEPRIMA"
    prev = SuzukiPreventivo(**data)
    pdf_bytes = _build_pdf(prev)
    return StreamingResponse(io.BytesIO(pdf_bytes), media_type="application/pdf")


@router.get("/preventivi/{pid}/pdf")
async def get_preventivo_pdf(pid: str):
    doc = await db.suzuki_preventivi.find_one({"id": pid}, {"_id": 0})
    if not doc:
        raise HTTPException(404, "Preventivo non trovato")
    prev = SuzukiPreventivo(**doc)
    pdf_bytes = _build_pdf(prev)
    filename = f"preventivo_suzuki_{prev.numero or prev.id}.pdf"
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# PDF BUILDER
# ---------------------------------------------------------------------------
def _fmt_eur(v: float) -> str:
    s = f"{float(v or 0):,.2f}"
    s = s.replace(",", "X").replace(".", ",").replace("X", ".")
    return f"{s} €"


def _build_pdf(p: SuzukiPreventivo) -> bytes:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_LEFT, TA_RIGHT, TA_CENTER
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable

    NAVY = colors.HexColor("#0F2A47")
    NAVY_LIGHT = colors.HexColor("#26466B")
    LIGHT_GREY = colors.HexColor("#F2F4F7")
    BORDER = colors.HexColor("#D0D5DD")
    TEXT_MUTED = colors.HexColor("#667085")

    styles = getSampleStyleSheet()
    st_label = ParagraphStyle("lab", parent=styles["Normal"], fontSize=8, textColor=TEXT_MUTED, leading=10)
    st_val = ParagraphStyle("val", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10, leading=13)
    st_title = ParagraphStyle("t", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=NAVY, alignment=TA_LEFT)
    st_sub = ParagraphStyle("s", parent=styles["Normal"], fontSize=9, leading=11, textColor=TEXT_MUTED)
    st_row = ParagraphStyle("row", parent=styles["Normal"], fontSize=9, leading=12)
    st_row_bold = ParagraphStyle("rb", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=9, leading=12)
    st_section = ParagraphStyle("sec", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.5, textColor=colors.white, leading=13)
    st_total_lab = ParagraphStyle("tl", parent=styles["Normal"], fontSize=11, textColor=colors.white, alignment=TA_RIGHT)
    st_total_val = ParagraphStyle("tv", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=15, textColor=colors.white, alignment=TA_RIGHT)
    st_footer = ParagraphStyle("f", parent=styles["Normal"], fontSize=8, textColor=TEXT_MUTED, leading=11)

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=14*mm, rightMargin=14*mm, topMargin=10*mm, bottomMargin=10*mm)

    def section_header(text: str, bg=NAVY):
        t = Table([[Paragraph(text, st_section)]], colWidths=[182*mm])
        t.setStyle(TableStyle([
            ("BACKGROUND", (0,0), (-1,-1), bg),
            ("TOPPADDING", (0,0), (-1,-1), 4),
            ("BOTTOMPADDING", (0,0), (-1,-1), 4),
            ("LEFTPADDING", (0,0), (-1,-1), 10),
            ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ]))
        return t

    story = []

    # HEADER
    left = [
        Paragraph("<b>GEB di Palmieri Sandro</b>", st_val),
        Paragraph("VIA DEGLI ARTIGIANI, 1 · 57034 CAMPO NELL'ELBA (LI)", st_sub),
        Paragraph("Tel. 347 260 08 72 · info@genbnautica.it · www.genbnautica.it", st_sub),
    ]
    data_it = "—"
    try:
        d = datetime.fromisoformat((p.data or "")[:10])
        data_it = d.strftime("%d/%m/%Y")
    except Exception:
        pass
    right = Table(
        [[Paragraph("PREVENTIVO", st_title)],
         [Paragraph("Fuoribordo Suzuki", st_sub)],
         [Spacer(1, 4)],
         [Table([
             [Paragraph("N°", st_label), Paragraph(p.numero or "—", st_val)],
             [Paragraph("Data", st_label), Paragraph(data_it, st_val)],
         ], colWidths=[18*mm, 50*mm], style=TableStyle([
             ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
             ("LEFTPADDING", (0,0), (-1,-1), 0),
             ("RIGHTPADDING", (0,0), (-1,-1), 0),
             ("TOPPADDING", (0,0), (-1,-1), 1.5),
             ("BOTTOMPADDING", (0,0), (-1,-1), 1.5),
         ]))]],
        colWidths=[70*mm],
        style=TableStyle([
            ("VALIGN", (0,0), (-1,-1), "TOP"),
            ("LEFTPADDING", (0,0), (-1,-1), 0),
            ("RIGHTPADDING", (0,0), (-1,-1), 0),
            ("TOPPADDING", (0,0), (-1,-1), 0),
            ("BOTTOMPADDING", (0,0), (-1,-1), 0),
        ]),
    )
    header = Table([[left, right]], colWidths=[112*mm, 70*mm])
    header.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
    ]))
    story.append(header)
    story.append(Spacer(1, 6))
    story.append(HRFlowable(width="100%", thickness=0.8, color=BORDER, spaceBefore=0, spaceAfter=6))

    # CLIENTE
    cliente_lines = [Paragraph(f"<b>{p.cliente_nome or '—'}</b>", st_val)]
    if p.cliente_telefono:
        cliente_lines.append(Paragraph(f"Tel. {p.cliente_telefono}", st_row))
    if p.cliente_email:
        cliente_lines.append(Paragraph(f"Email: {p.cliente_email}", st_row))
    cliente_box = Table([[cliente_lines]], colWidths=[182*mm])
    cliente_box.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), LIGHT_GREY),
        ("BOX", (0,0), (-1,-1), 0.6, BORDER),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 6),
        ("BOTTOMPADDING", (0,0), (-1,-1), 6),
        ("VALIGN", (0,0), (-1,-1), "TOP"),
    ]))
    story.append(cliente_box)
    story.append(Spacer(1, 8))

    # MODELLO + SPECIFICHE
    story.append(section_header("MODELLO SUZUKI"))
    specs = []
    if p.codice:
        specs.append(("Codice articolo", p.codice))
    specs.append(("Modello", p.modello or "—"))
    if p.potenza_hp:
        specs.append(("Potenza", f"{p.potenza_hp:g} HP"))
    if p.specifiche:
        specs.append(("Dettagli tecnici", p.specifiche))
    specs_rows = [[Paragraph(k, st_row), Paragraph(v, st_row_bold)] for k, v in specs]
    tspecs = Table(specs_rows, colWidths=[45*mm, 137*mm])
    tspecs.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.4, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT_GREY]),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(tspecs)
    story.append(Spacer(1, 10))

    # CALCOLO PREZZO
    calc = _calc_totale(p)
    story.append(section_header("CALCOLO PREZZO"))
    rows = [
        [Paragraph("Prezzo di listino Suzuki (IVA esclusa)", st_row),
         Paragraph(_fmt_eur(calc["prezzo_listino"]), st_row_bold)],
    ]
    if p.sconto_perc_1:
        rows.append([Paragraph(f"Sconto 1: <b>{p.sconto_perc_1:g}%</b>", st_row),
                     Paragraph("− " + _fmt_eur(calc["importo_sconto_1"]), st_row_bold)])
    if p.sconto_perc_2:
        rows.append([Paragraph(f"Sconto 2: <b>{p.sconto_perc_2:g}%</b>", st_row),
                     Paragraph("− " + _fmt_eur(calc["importo_sconto_2"]), st_row_bold)])
    rows.append([Paragraph("<b>Netto motore scontato</b>", st_row_bold),
                 Paragraph("<b>" + _fmt_eur(calc["netto_motore"]) + "</b>", st_row_bold)])
    if calc["montaggio"] > 0:
        rows.append([Paragraph("Montaggio, messa in acqua e collaudo", st_row),
                     Paragraph("+ " + _fmt_eur(calc["montaggio"]), st_row_bold)])
    tcalc = Table(rows, colWidths=[140*mm, 42*mm])
    tcalc.setStyle(TableStyle([
        ("BOX", (0,0), (-1,-1), 0.4, BORDER),
        ("INNERGRID", (0,0), (-1,-1), 0.25, BORDER),
        ("ROWBACKGROUNDS", (0,0), (-1,-1), [colors.white, LIGHT_GREY]),
        ("ALIGN", (1,0), (1,-1), "RIGHT"),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("LEFTPADDING", (0,0), (-1,-1), 10),
        ("RIGHTPADDING", (0,0), (-1,-1), 10),
        ("TOPPADDING", (0,0), (-1,-1), 3),
        ("BOTTOMPADDING", (0,0), (-1,-1), 3),
    ]))
    story.append(tcalc)
    story.append(Spacer(1, 6))

    # TOTALE FINALE
    tot_tbl = Table(
        [[Paragraph("TOTALE PREVENTIVO", st_total_lab),
          Paragraph(_fmt_eur(calc["totale_iva_esclusa"]), st_total_val)],
         ["", Paragraph("+ IVA", ParagraphStyle("iva", parent=styles["Normal"], fontSize=9, textColor=colors.white, alignment=TA_RIGHT))]],
        colWidths=[130*mm, 52*mm],
    )
    tot_tbl.setStyle(TableStyle([
        ("BACKGROUND", (0,0), (-1,-1), NAVY),
        ("VALIGN", (0,0), (-1,-1), "MIDDLE"),
        ("TOPPADDING", (0,0), (-1,-1), 5),
        ("BOTTOMPADDING", (0,0), (-1,-1), 5),
        ("LEFTPADDING", (0,0), (-1,-1), 14),
        ("RIGHTPADDING", (0,0), (-1,-1), 14),
    ]))
    story.append(tot_tbl)
    story.append(Spacer(1, 10))

    # NOTE
    if p.note:
        story.append(Paragraph(f"<b>Note:</b> {p.note}", st_row))
        story.append(Spacer(1, 6))

    # FOOTER — condizioni + firma
    condizioni = [
        "Preventivo valido 30 giorni salvo esaurimento scorte.",
        "Consegna e montaggio da concordare. Garanzia ufficiale Suzuki secondo condizioni di casa madre.",
        "Il montaggio comprende collaudo in acqua e primo tagliando come da programma di manutenzione.",
        "Il pagamento avviene: 30% all'ordine, saldo alla consegna del motore.",
    ]
    cond_paras = [Paragraph(t, st_footer) for t in condizioni]
    firma_cell = [
        Paragraph("Il titolare", ParagraphStyle("fl", parent=styles["Normal"], fontSize=9, textColor=TEXT_MUTED, alignment=TA_CENTER)),
        Spacer(1, 22),
        Paragraph("<b>Sandro Palmieri</b>", ParagraphStyle("fn", parent=styles["Normal"], fontName="Helvetica-Bold", fontSize=10.5, textColor=NAVY, alignment=TA_CENTER)),
        HRFlowable(width="80%", thickness=0.5, color=BORDER, spaceBefore=2, spaceAfter=0, hAlign="CENTER"),
    ]
    footer = Table([[cond_paras, firma_cell]], colWidths=[120*mm, 62*mm])
    footer.setStyle(TableStyle([
        ("VALIGN", (0,0), (-1,-1), "TOP"),
        ("LEFTPADDING", (0,0), (-1,-1), 0),
        ("RIGHTPADDING", (0,0), (-1,-1), 0),
        ("LINEABOVE", (0,0), (-1,0), 0.6, BORDER),
        ("TOPPADDING", (0,0), (-1,-1), 6),
    ]))
    story.append(footer)

    doc.build(story)
    return buf.getvalue()
