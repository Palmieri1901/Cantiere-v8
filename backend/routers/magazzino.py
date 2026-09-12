"""Endpoints magazzino: articoli, fornitori, movimenti, scan AI, export PDF/Excel."""
import io
import os
import base64
import json
import re
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse

from database import db
from models import (
    Articolo, ArticoloCreate,
    Fornitore, FornitoreCreate,
    MovimentoMagazzino, MovimentoCreate,
    ScanArticoloRequest, ScanDDTRequest,
)


def _to_dt(d: dict, keys=("created_at", "updated_at")):
    """Converte in datetime le chiavi ISO string (per rifare passare Articolo/Fornitore)."""
    for k in keys:
        v = d.get(k)
        if isinstance(v, str):
            try:
                d[k] = datetime.fromisoformat(v.replace("Z", "+00:00"))
            except Exception:
                pass
    return d

router = APIRouter(prefix="/magazzino")


# ---------------------------------------------------------------------------
# FORNITORI
# ---------------------------------------------------------------------------

@router.get("/fornitori", response_model=List[Fornitore])
async def list_fornitori():
    docs = await db.fornitori.find({}, {"_id": 0}).sort("nome", 1).to_list(1000)
    return [Fornitore(**_to_dt(d)) for d in docs]


@router.post("/fornitori", response_model=Fornitore)
async def create_fornitore(payload: FornitoreCreate):
    if not payload.nome.strip():
        raise HTTPException(400, "Nome fornitore obbligatorio")
    f = Fornitore(**payload.model_dump())
    await db.fornitori.insert_one(f.model_dump())
    return f


@router.put("/fornitori/{fid}", response_model=Fornitore)
async def update_fornitore(fid: str, payload: FornitoreCreate):
    existing = await db.fornitori.find_one({"id": fid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Fornitore non trovato")
    data = {**existing, **payload.model_dump(exclude_unset=True)}
    f = Fornitore(**_to_dt(data))
    await db.fornitori.update_one({"id": fid}, {"$set": f.model_dump()})
    return f


@router.delete("/fornitori/{fid}")
async def delete_fornitore(fid: str):
    r = await db.fornitori.delete_one({"id": fid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Fornitore non trovato")
    # Distacca gli articoli collegati
    await db.articoli.update_many({"fornitore_id": fid}, {"$set": {"fornitore_id": None}})
    return {"ok": True}


# ---------------------------------------------------------------------------
# ARTICOLI
# ---------------------------------------------------------------------------

@router.get("/articoli", response_model=List[Articolo])
async def list_articoli(
    q: Optional[str] = None,
    fornitore_id: Optional[str] = None,
    categoria: Optional[str] = None,
    sotto_scorta: Optional[bool] = False,
):
    query = {}
    if fornitore_id:
        query["fornitore_id"] = fornitore_id
    if categoria:
        query["categoria"] = categoria
    if q:
        rx = {"$regex": re.escape(q), "$options": "i"}
        query["$or"] = [{"codice": rx}, {"nome": rx}, {"descrizione": rx}]
    docs = await db.articoli.find(query, {"_id": 0}).sort("nome", 1).to_list(5000)
    articoli = [Articolo(**_to_dt(d)) for d in docs]
    if sotto_scorta:
        articoli = [a for a in articoli if a.quantita <= a.scorta_minima]
    return articoli


@router.get("/articoli/categorie", response_model=List[str])
async def list_categorie():
    cats = await db.articoli.distinct("categoria")
    return sorted([c for c in cats if c])


@router.get("/articoli/count-sotto-scorta")
async def count_sotto_scorta():
    docs = await db.articoli.find({}, {"_id": 0, "quantita": 1, "scorta_minima": 1}).to_list(5000)
    n = sum(1 for d in docs if d.get("quantita", 0) <= d.get("scorta_minima", 0))
    return {"count": n, "total": len(docs)}


@router.post("/articoli", response_model=Articolo)
async def create_articolo(payload: ArticoloCreate):
    if not payload.nome.strip():
        raise HTTPException(400, "Il nome dell'articolo è obbligatorio")
    art = Articolo(**payload.model_dump())
    await db.articoli.insert_one(art.model_dump())
    # Movimento iniziale se quantità > 0
    if art.quantita > 0:
        mv = MovimentoMagazzino(
            articolo_id=art.id, tipo="carico", quantita=art.quantita,
            quantita_dopo=art.quantita, motivo="Giacenza iniziale",
            data=datetime.now().strftime("%Y-%m-%d"),
        )
        await db.movimenti_magazzino.insert_one(mv.model_dump())
    return art


@router.put("/articoli/{aid}", response_model=Articolo)
async def update_articolo(aid: str, payload: ArticoloCreate):
    existing = await db.articoli.find_one({"id": aid}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Articolo non trovato")
    data = {**existing, **payload.model_dump(exclude_unset=True)}
    data["updated_at"] = datetime.now(timezone.utc)
    art = Articolo(**_to_dt(data))
    await db.articoli.update_one({"id": aid}, {"$set": art.model_dump()})
    return art


@router.delete("/articoli/{aid}")
async def delete_articolo(aid: str):
    r = await db.articoli.delete_one({"id": aid})
    if r.deleted_count == 0:
        raise HTTPException(404, "Articolo non trovato")
    await db.movimenti_magazzino.delete_many({"articolo_id": aid})
    return {"ok": True}


# ---------------------------------------------------------------------------
# MOVIMENTI (carico/scarico/rettifica)
# ---------------------------------------------------------------------------

@router.get("/movimenti", response_model=List[MovimentoMagazzino])
async def list_movimenti(articolo_id: Optional[str] = None, limit: int = 200):
    query = {"articolo_id": articolo_id} if articolo_id else {}
    docs = await db.movimenti_magazzino.find(query, {"_id": 0}).sort("created_at", -1).to_list(limit)
    return [MovimentoMagazzino(**_to_dt(d)) for d in docs]


@router.post("/movimenti", response_model=MovimentoMagazzino)
async def create_movimento(payload: MovimentoCreate):
    art = await db.articoli.find_one({"id": payload.articolo_id}, {"_id": 0})
    if not art:
        raise HTTPException(404, "Articolo non trovato")
    if payload.tipo not in ("carico", "scarico", "rettifica"):
        raise HTTPException(400, "Tipo movimento non valido")

    qt_prima = float(art.get("quantita", 0))
    if payload.tipo == "carico":
        nuova = qt_prima + abs(payload.quantita)
    elif payload.tipo == "scarico":
        nuova = qt_prima - abs(payload.quantita)
    else:  # rettifica: quantita è il valore assoluto finale
        nuova = float(payload.quantita)

    mv = MovimentoMagazzino(
        articolo_id=payload.articolo_id,
        tipo=payload.tipo,
        quantita=payload.quantita,
        quantita_dopo=nuova,
        motivo=payload.motivo or "",
        data=payload.data or datetime.now().strftime("%Y-%m-%d"),
        note=payload.note or "",
    )
    await db.movimenti_magazzino.insert_one(mv.model_dump())
    await db.articoli.update_one(
        {"id": payload.articolo_id},
        {"$set": {"quantita": nuova, "updated_at": datetime.now(timezone.utc)}},
    )
    return mv


# ---------------------------------------------------------------------------
# AI SCAN (Gemini 3 Flash via Emergent LLM key)
# ---------------------------------------------------------------------------

async def _run_vision(prompt: str, image_base64: str) -> str:
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent, TextDelta, StreamDone

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        raise HTTPException(500, "EMERGENT_LLM_KEY non configurata")

    # Rimuove eventuale prefisso data URL
    b64 = image_base64.split(",", 1)[-1] if "," in image_base64 else image_base64

    chat = (
        LlmChat(
            api_key=api_key,
            session_id=f"magazzino-{datetime.now().timestamp()}",
            system_message=(
                "Sei un assistente esperto di magazzino nautico. "
                "Analizzi foto di articoli o Documenti Di Trasporto (DDT) italiani "
                "ed estrai i dati in JSON preciso senza aggiungere commenti."
            ),
        )
        .with_model("gemini", "gemini-3-flash-preview")
    )

    image = ImageContent(image_base64=b64)
    msg = UserMessage(text=prompt, file_contents=[image])

    chunks: List[str] = []
    async for ev in chat.stream_message(msg):
        if isinstance(ev, TextDelta):
            chunks.append(ev.content)
        elif isinstance(ev, StreamDone):
            break
    return "".join(chunks)


def _extract_json(text: str):
    """Estrae il primo blocco JSON valido (oggetto o array) dal testo dell'LLM."""
    if not text:
        return None
    # Rimuovi fenced code block
    m = re.search(r"```(?:json)?\s*(.+?)```", text, re.S)
    candidate = m.group(1) if m else text
    # Trova primo { o [
    for open_ch, close_ch in (("{", "}"), ("[", "]")):
        i = candidate.find(open_ch)
        if i == -1:
            continue
        depth = 0
        for j in range(i, len(candidate)):
            if candidate[j] == open_ch:
                depth += 1
            elif candidate[j] == close_ch:
                depth -= 1
                if depth == 0:
                    try:
                        return json.loads(candidate[i:j+1])
                    except Exception:
                        break
    try:
        return json.loads(candidate.strip())
    except Exception:
        return None


@router.post("/scan-articolo")
async def scan_articolo(payload: ScanArticoloRequest):
    """Analizza la foto di un articolo/etichetta e restituisce codice, nome,
    descrizione, prezzo suggerito."""
    prompt = (
        "Analizza questa foto di un articolo nautico o della sua confezione/etichetta. "
        "Estrai i dati che vedi e rispondi SOLO con un oggetto JSON con le chiavi:\n"
        '{"codice": "", "nome": "", "descrizione": "", "categoria": "", "prezzo_listino": 0}\n\n'
        "Regole:\n"
        "- Se non riesci a leggere un campo lascialo stringa vuota (o 0 per il prezzo).\n"
        "- codice: sigla/codice prodotto stampato (es. 'RX-1234').\n"
        "- nome: nome dell'articolo (es. 'Bussola magnetica 100mm').\n"
        "- descrizione: caratteristiche principali visibili sulla confezione.\n"
        "- categoria: 1-3 parole (es. 'Ferramenta', 'Ricambi motore', 'Vernici', 'Elettronica').\n"
        "- prezzo_listino: se leggi un prezzo stampato, altrimenti 0.\n"
        "Rispondi SOLO con il JSON, nessun testo aggiuntivo."
    )
    try:
        raw = await _run_vision(prompt, payload.image_base64)
    except Exception as e:
        raise HTTPException(502, f"Errore AI vision: {e}")

    data = _extract_json(raw) or {}
    return {
        "codice": str(data.get("codice", "") or ""),
        "nome": str(data.get("nome", "") or ""),
        "descrizione": str(data.get("descrizione", "") or ""),
        "categoria": str(data.get("categoria", "") or ""),
        "prezzo_listino": float(data.get("prezzo_listino", 0) or 0),
        "raw": raw,
    }


@router.post("/scan-ddt")
async def scan_ddt(payload: ScanDDTRequest):
    """Analizza la foto di un DDT italiano ed estrae la lista articoli."""
    prompt = (
        "Analizza questa foto di un Documento Di Trasporto (DDT) italiano. "
        "Estrai TUTTE le righe articolo della bolla. Rispondi SOLO con un oggetto JSON:\n"
        '{"fornitore": "", "numero_ddt": "", "data": "", "articoli": [\n'
        '  {"codice": "", "nome": "", "descrizione": "", "quantita": 0, "prezzo_unitario": 0}\n'
        "]}\n\n"
        "Regole:\n"
        "- fornitore: nome/ragione sociale del mittente in alto.\n"
        "- numero_ddt e data: se visibili in intestazione.\n"
        "- Per ogni riga della tabella articoli, riporta codice/nome/quantità e prezzo se presente.\n"
        "- Ignora totali, sconti aggregati e note in coda.\n"
        "- Se un valore non è leggibile lascialo vuoto o 0.\n"
        "Rispondi SOLO con il JSON, nessun testo aggiuntivo."
    )
    try:
        raw = await _run_vision(prompt, payload.image_base64)
    except Exception as e:
        raise HTTPException(502, f"Errore AI vision: {e}")

    data = _extract_json(raw) or {}
    articoli_raw = data.get("articoli") or []
    articoli = []
    for a in articoli_raw if isinstance(articoli_raw, list) else []:
        if not isinstance(a, dict):
            continue
        articoli.append({
            "codice": str(a.get("codice", "") or ""),
            "nome": str(a.get("nome", "") or ""),
            "descrizione": str(a.get("descrizione", "") or ""),
            "quantita": float(a.get("quantita", 0) or 0),
            "prezzo_unitario": float(a.get("prezzo_unitario", 0) or 0),
        })
    return {
        "fornitore": str(data.get("fornitore", "") or ""),
        "numero_ddt": str(data.get("numero_ddt", "") or ""),
        "data": str(data.get("data", "") or ""),
        "articoli": articoli,
        "raw": raw,
    }


class ImportDDTRequest(ScanDDTRequest.__base__ if False else object):
    pass


from pydantic import BaseModel as _BM


class ImportArticoliRequest(_BM):
    fornitore_id: Optional[str] = None
    articoli: List[dict]


@router.post("/importa-articoli")
async def importa_articoli(payload: ImportArticoliRequest):
    """Importa in blocco articoli dopo scan DDT. Se codice esiste già → carico
    quantità; se nuovo → crea articolo."""
    created, updated = 0, 0
    for a in payload.articoli:
        codice = (a.get("codice") or "").strip()
        nome = (a.get("nome") or "").strip()
        if not nome and not codice:
            continue
        qt = float(a.get("quantita") or 0)
        prezzo = float(a.get("prezzo_unitario") or 0)

        existing = None
        if codice:
            existing = await db.articoli.find_one({"codice": codice}, {"_id": 0})
        if existing:
            nuova_qt = float(existing.get("quantita", 0)) + qt
            await db.articoli.update_one(
                {"id": existing["id"]},
                {"$set": {
                    "quantita": nuova_qt,
                    "prezzo_acquisto": prezzo if prezzo > 0 else existing.get("prezzo_acquisto", 0),
                    "fornitore_id": payload.fornitore_id or existing.get("fornitore_id"),
                    "updated_at": datetime.now(timezone.utc),
                }},
            )
            mv = MovimentoMagazzino(
                articolo_id=existing["id"], tipo="carico", quantita=qt,
                quantita_dopo=nuova_qt, motivo="Carico da DDT",
                data=datetime.now().strftime("%Y-%m-%d"),
                note=a.get("descrizione", ""),
            )
            await db.movimenti_magazzino.insert_one(mv.model_dump())
            updated += 1
        else:
            art = Articolo(
                codice=codice, nome=nome or codice,
                descrizione=a.get("descrizione", ""),
                fornitore_id=payload.fornitore_id,
                prezzo_acquisto=prezzo, prezzo_listino=prezzo,
                quantita=qt,
            )
            await db.articoli.insert_one(art.model_dump())
            if qt > 0:
                mv = MovimentoMagazzino(
                    articolo_id=art.id, tipo="carico", quantita=qt,
                    quantita_dopo=qt, motivo="Carico da DDT",
                    data=datetime.now().strftime("%Y-%m-%d"),
                )
                await db.movimenti_magazzino.insert_one(mv.model_dump())
            created += 1
    return {"created": created, "updated": updated}


# ---------------------------------------------------------------------------
# EXPORT: Listino PDF e Inventario Excel
# ---------------------------------------------------------------------------

@router.get("/listino.pdf")
async def listino_pdf(
    fornitore_id: Optional[str] = None,
    categoria: Optional[str] = None,
):
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.styles import getSampleStyleSheet
    from reportlab.lib.units import mm
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle

    query = {}
    if fornitore_id:
        query["fornitore_id"] = fornitore_id
    if categoria:
        query["categoria"] = categoria
    docs = await db.articoli.find(query, {"_id": 0}).sort([("categoria", 1), ("nome", 1)]).to_list(5000)
    cantiere = await db.cantiere.find_one({"id": "default"}, {"_id": 0}) or {}
    fornitore = None
    if fornitore_id:
        fornitore = await db.fornitori.find_one({"id": fornitore_id}, {"_id": 0})

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=15*mm, rightMargin=15*mm, topMargin=15*mm, bottomMargin=15*mm)
    styles = getSampleStyleSheet()
    story = []

    nome_cantiere = cantiere.get("nome") or "Portomare"
    story.append(Paragraph(f"<b>{nome_cantiere}</b>", styles["Title"]))
    subtitle = "Listino accessori nautici"
    if fornitore:
        subtitle += f" — Fornitore: {fornitore.get('nome')}"
    if categoria:
        subtitle += f" — Categoria: {categoria}"
    story.append(Paragraph(subtitle, styles["Heading3"]))
    story.append(Paragraph(datetime.now().strftime("Aggiornato al %d/%m/%Y"), styles["Normal"]))
    story.append(Spacer(1, 8))

    headers = ["Codice", "Nome", "Descrizione", "Cat.", "U.M.", "Prezzo €"]
    data = [headers]
    for d in docs:
        data.append([
            d.get("codice", "") or "",
            d.get("nome", "") or "",
            (d.get("descrizione", "") or "")[:80],
            d.get("categoria", "") or "",
            d.get("unita_misura", "pz") or "pz",
            f"{float(d.get('prezzo_listino', 0)):.2f}",
        ])
    table = Table(data, colWidths=[25*mm, 45*mm, 55*mm, 25*mm, 15*mm, 20*mm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#0f172a")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ALIGN", (-1, 1), (-1, -1), "RIGHT"),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#cbd5e1")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(table)

    doc.build(story)
    buf.seek(0)
    fname = "listino_accessori.pdf"
    return StreamingResponse(buf, media_type="application/pdf", headers={"Content-Disposition": f'attachment; filename="{fname}"'})


@router.get("/inventario.xlsx")
async def inventario_xlsx():
    from openpyxl import Workbook
    from openpyxl.styles import Font, PatternFill, Alignment
    from openpyxl.utils import get_column_letter

    articoli = await db.articoli.find({}, {"_id": 0}).sort("nome", 1).to_list(5000)
    fornitori = await db.fornitori.find({}, {"_id": 0}).to_list(1000)
    forn_map = {f["id"]: f["nome"] for f in fornitori}

    wb = Workbook()
    ws = wb.active
    ws.title = "Inventario"

    headers = ["Codice", "Nome", "Descrizione", "Categoria", "Fornitore",
               "U.M.", "Quantità", "Scorta min.", "Prezzo acquisto €",
               "Prezzo listino €", "Valore giacenza €", "Sotto scorta"]
    ws.append(headers)
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="0F172A")
    for col in range(1, len(headers)+1):
        c = ws.cell(row=1, column=col)
        c.font = header_font
        c.fill = header_fill
        c.alignment = Alignment(horizontal="center", vertical="center")

    tot_valore = 0.0
    for a in articoli:
        q = float(a.get("quantita", 0))
        p = float(a.get("prezzo_acquisto", 0))
        val = q * p
        tot_valore += val
        ws.append([
            a.get("codice", ""), a.get("nome", ""), a.get("descrizione", ""),
            a.get("categoria", ""),
            forn_map.get(a.get("fornitore_id"), ""),
            a.get("unita_misura", "pz"),
            q, float(a.get("scorta_minima", 0)),
            p, float(a.get("prezzo_listino", 0)),
            val,
            "SÌ" if q <= float(a.get("scorta_minima", 0)) else "",
        ])

    last = ws.max_row + 1
    ws.cell(row=last, column=10, value="TOTALE VALORE").font = Font(bold=True)
    ws.cell(row=last, column=11, value=tot_valore).font = Font(bold=True)
    ws.cell(row=last, column=11).number_format = '#,##0.00 "€"'

    for i in range(9, 12):
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, min_col=i, max_col=i):
            for cell in row:
                cell.number_format = '#,##0.00 "€"'

    widths = [12, 30, 40, 18, 22, 6, 10, 10, 15, 15, 18, 12]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.freeze_panes = "A2"

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": 'attachment; filename="inventario_magazzino.xlsx"'},
    )
