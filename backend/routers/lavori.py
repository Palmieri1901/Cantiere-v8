"""Endpoints CRUD lavori (storico strutturato) + integrazione magazzino."""
from datetime import datetime
from typing import List
from fastapi import APIRouter, HTTPException

from database import db
from models import Lavoro, LavoroCreate, MovimentoMagazzino
from helpers import serialize

router = APIRouter()


async def _scarica_articoli_magazzino(articoli: list, cliente: dict, lavoro_id: str, data: str) -> tuple[float, list]:
    """Per ogni articolo di magazzino usato: valida stock, decrementa la giacenza
    e crea un movimento di scarico. Restituisce (costo_totale, lista_snapshot).
    """
    if not articoli:
        return 0.0, []

    costo_extra = 0.0
    snapshot = []
    cliente_nome = f"{cliente.get('cognome','')} {cliente.get('nome','')}".strip() or "Cliente"

    for item in articoli:
        aid = item.get("articolo_id")
        qt = float(item.get("quantita") or 0)
        if not aid or qt <= 0:
            continue

        art = await db.articoli.find_one({"id": aid}, {"_id": 0})
        if not art:
            raise HTTPException(400, f"Articolo {aid} non trovato in magazzino")

        prezzo_unit = float(item.get("prezzo_unitario") or art.get("prezzo_listino") or 0)
        nuova_giacenza = float(art.get("quantita", 0)) - qt

        await db.articoli.update_one(
            {"id": aid},
            {"$set": {"quantita": nuova_giacenza, "updated_at": datetime.utcnow()}},
        )

        mv = MovimentoMagazzino(
            articolo_id=aid, tipo="scarico", quantita=-qt,
            quantita_dopo=nuova_giacenza,
            motivo=f"Lavoro cliente {cliente_nome}",
            data=data,
            cliente_id=cliente.get("id"),
            cliente_nome=cliente_nome,
            lavoro_id=lavoro_id,
        )
        await db.movimenti_magazzino.insert_one(mv.model_dump())

        costo_extra += qt * prezzo_unit
        snapshot.append({
            "articolo_id": aid,
            "codice": art.get("codice", ""),
            "nome": art.get("nome", ""),
            "quantita": qt,
            "prezzo_unitario": prezzo_unit,
            "totale": qt * prezzo_unit,
        })

    return costo_extra, snapshot


@router.get("/clienti/{cliente_id}/lavori", response_model=List[Lavoro])
async def list_lavori(cliente_id: str):
    docs = await db.lavori.find({"cliente_id": cliente_id}, {"_id": 0}).sort("data", -1).to_list(1000)
    for d in docs:
        if isinstance(d.get("created_at"), str):
            try:
                d["created_at"] = datetime.fromisoformat(d["created_at"])
            except Exception:
                pass
    return [Lavoro(**d) for d in docs]


@router.post("/lavori", response_model=Lavoro)
async def create_lavoro(payload: LavoroCreate):
    if payload.stato not in ("pianificato", "in_corso", "completato"):
        raise HTTPException(400, "Stato non valido")
    c = await db.clienti.find_one({"id": payload.cliente_id})
    if not c:
        raise HTTPException(404, "Cliente non trovato")

    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    articoli_input = data.pop("articoli_magazzino", None) or []

    lavoro = Lavoro(**data)
    # Prima creo il record poi decurto il magazzino (così il lavoro_id è disponibile)
    await db.lavori.insert_one(serialize(lavoro))

    costo_extra, snapshot = await _scarica_articoli_magazzino(
        articoli_input, c, lavoro.id, payload.data,
    )

    if snapshot:
        lavoro.articoli_magazzino = snapshot
        lavoro.costo = float(lavoro.costo or 0) + costo_extra
        await db.lavori.update_one(
            {"id": lavoro.id},
            {"$set": {"articoli_magazzino": snapshot, "costo": lavoro.costo}},
        )
    return lavoro


@router.put("/lavori/{lavoro_id}", response_model=Lavoro)
async def update_lavoro(lavoro_id: str, payload: LavoroCreate):
    existing = await db.lavori.find_one({"id": lavoro_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Lavoro non trovato")
    if payload.stato not in ("pianificato", "in_corso", "completato"):
        raise HTTPException(400, "Stato non valido")
    # Gli articoli di magazzino già scaricati restano invariati: si gestiscono
    # solo dalla creazione lavoro per evitare doppi scarichi. Ignoriamo il campo in PUT.
    payload_data = payload.model_dump()
    payload_data.pop("articoli_magazzino", None)
    merged = {**existing, **{k: v for k, v in payload_data.items() if v is not None}}
    merged["id"] = lavoro_id
    lavoro = Lavoro(**merged)
    await db.lavori.update_one({"id": lavoro_id}, {"$set": serialize(lavoro)})
    return lavoro


@router.delete("/lavori/{lavoro_id}")
async def delete_lavoro(lavoro_id: str):
    existing = await db.lavori.find_one({"id": lavoro_id}, {"_id": 0})
    if not existing:
        raise HTTPException(404, "Lavoro non trovato")

    # Ripristina la giacenza di ogni articolo scaricato al momento della creazione
    ripristinati = 0
    saltati = 0
    articoli_usati = existing.get("articoli_magazzino") or []
    cliente = await db.clienti.find_one({"id": existing.get("cliente_id")}, {"_id": 0}) or {}
    cliente_nome = f"{cliente.get('cognome','')} {cliente.get('nome','')}".strip() or "Cliente"

    for item in articoli_usati:
        aid = item.get("articolo_id")
        qt = float(item.get("quantita") or 0)
        if not aid or qt <= 0:
            continue
        art = await db.articoli.find_one({"id": aid}, {"_id": 0})
        if not art:
            # Articolo eliminato dal magazzino nel frattempo: non ripristiniamo
            saltati += 1
            continue
        nuova_giacenza = float(art.get("quantita", 0)) + qt
        await db.articoli.update_one(
            {"id": aid},
            {"$set": {"quantita": nuova_giacenza, "updated_at": datetime.utcnow()}},
        )
        mv = MovimentoMagazzino(
            articolo_id=aid, tipo="carico", quantita=qt,
            quantita_dopo=nuova_giacenza,
            motivo=f"Storno lavoro eliminato · Cliente {cliente_nome}",
            data=datetime.now().strftime("%Y-%m-%d"),
            cliente_id=cliente.get("id"),
            cliente_nome=cliente_nome,
            lavoro_id=lavoro_id,
        )
        await db.movimenti_magazzino.insert_one(mv.model_dump())
        ripristinati += 1

    await db.lavori.delete_one({"id": lavoro_id})
    return {"ok": True, "giacenze_ripristinate": ripristinati, "articoli_saltati": saltati}
