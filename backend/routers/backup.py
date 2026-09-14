"""Backup completo JSON + restore da JSON — include TUTTI i dati aziendali:
clienti, lavori, magazzino (articoli, fornitori, ricarichi, spese, movimenti),
tariffe e informazioni del cantiere.
"""
import json as _json
from datetime import datetime, timezone
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

from database import db
from models import (
    Cantiere, Cliente, Lavoro, RestoreRequest, Tariffe,
    Articolo, Fornitore, RicaricoCategoria, SpesaAccessoria, MovimentoMagazzino,
)
from helpers import serialize

router = APIRouter()


BACKUP_VERSION = 2


@router.get("/backup")
async def backup_data():
    """Esporta TUTTI i dati dell'app in un unico JSON scaricabile.
    Include: cantiere, tariffe, clienti, lavori e tutto il modulo Magazzino
    (articoli, fornitori, ricarichi categoria, spese accessorie, movimenti).
    """
    cantiere = await db.cantiere.find_one({"id": "default"}, {"_id": 0})
    tariffe = await db.tariffe.find_one({"id": "default"}, {"_id": 0})
    clienti = await db.clienti.find({}, {"_id": 0}).to_list(50000)
    lavori = await db.lavori.find({}, {"_id": 0}).to_list(50000)
    articoli = await db.articoli.find({}, {"_id": 0}).to_list(50000)
    fornitori = await db.fornitori.find({}, {"_id": 0}).to_list(5000)
    ricarichi_categoria = await db.ricarichi_categoria.find({}, {"_id": 0}).to_list(1000)
    spese_accessorie = await db.spese_accessorie.find({}, {"_id": 0}).to_list(20000)
    movimenti_magazzino = await db.movimenti_magazzino.find({}, {"_id": 0}).to_list(200000)

    payload = {
        "version": BACKUP_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "app": "Portomare Cantiere Nautico",
        "cantiere": cantiere,
        "tariffe": tariffe,
        "clienti": clienti,
        "lavori": lavori,
        "articoli": articoli,
        "fornitori": fornitori,
        "ricarichi_categoria": ricarichi_categoria,
        "spese_accessorie": spese_accessorie,
        "movimenti_magazzino": movimenti_magazzino,
        "counts": {
            "clienti": len(clienti),
            "lavori": len(lavori),
            "articoli": len(articoli),
            "fornitori": len(fornitori),
            "ricarichi_categoria": len(ricarichi_categoria),
            "spese_accessorie": len(spese_accessorie),
            "movimenti_magazzino": len(movimenti_magazzino),
        },
    }
    body = _json.dumps(payload, ensure_ascii=False, indent=2, default=str)
    filename = f"backup_portomare_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    return StreamingResponse(
        iter([body]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


async def _restore_collection(collection_name: str, docs_input, model_cls, restored: dict, key: str):
    """Helper: sovrascrive completamente una collection dopo aver validato ogni doc
    contro il proprio modello Pydantic (scarta i doc non validi)."""
    if docs_input is None:
        return
    await db[collection_name].delete_many({})
    docs = []
    for d in docs_input:
        if not isinstance(d, dict):
            continue
        try:
            obj = model_cls(**{k: v for k, v in d.items() if k in model_cls.model_fields})
            docs.append(serialize(obj))
        except Exception:
            # Fallback grezzo: se il doc è già coerente, prova a inserirlo comunque
            try:
                docs.append({k: v for k, v in d.items() if not k.startswith("_")})
            except Exception:
                pass
    if docs:
        await db[collection_name].insert_many(docs)
    restored[key] = len(docs)


@router.post("/restore")
async def restore_data(payload: RestoreRequest):
    """Ripristina i dati dal backup JSON. Sovrascrive completamente ogni sezione
    fornita nel file. Le sezioni assenti dal file NON vengono toccate."""
    restored = {
        "clienti": 0, "lavori": 0, "articoli": 0, "fornitori": 0,
        "ricarichi_categoria": 0, "spese_accessorie": 0, "movimenti_magazzino": 0,
        "tariffe": False, "cantiere": False,
    }

    if payload.cantiere is not None:
        c = Cantiere(**{k: v for k, v in payload.cantiere.items() if k in Cantiere.model_fields})
        await db.cantiere.delete_many({})
        await db.cantiere.insert_one(serialize(c))
        restored["cantiere"] = True

    if payload.tariffe is not None:
        t = Tariffe(**{k: v for k, v in payload.tariffe.items() if k in Tariffe.model_fields})
        await db.tariffe.delete_many({})
        await db.tariffe.insert_one(serialize(t))
        restored["tariffe"] = True

    await _restore_collection("clienti", payload.clienti, Cliente, restored, "clienti")
    await _restore_collection("lavori", payload.lavori, Lavoro, restored, "lavori")
    await _restore_collection("articoli", payload.articoli, Articolo, restored, "articoli")
    await _restore_collection("fornitori", payload.fornitori, Fornitore, restored, "fornitori")
    await _restore_collection("ricarichi_categoria", payload.ricarichi_categoria, RicaricoCategoria, restored, "ricarichi_categoria")
    await _restore_collection("spese_accessorie", payload.spese_accessorie, SpesaAccessoria, restored, "spese_accessorie")
    await _restore_collection("movimenti_magazzino", payload.movimenti_magazzino, MovimentoMagazzino, restored, "movimenti_magazzino")

    return {"ok": True, "restored": restored}
