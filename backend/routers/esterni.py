"""Lavorazioni esterne: clienti non in archivio (solo nominativo) con i relativi lavori."""
import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from database import db

router = APIRouter()


class EsternoIn(BaseModel):
    nome: str
    telefono: Optional[str] = ""
    note: Optional[str] = ""


async def crea_esterno(nome: str, telefono: str = "", note: str = "") -> dict:
    nome = (nome or "").strip()
    if not nome:
        raise HTTPException(400, "Nominativo obbligatorio")
    doc = {"id": str(uuid.uuid4()), "nome": nome, "telefono": telefono or "", "note": note or "",
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.clienti_esterni.insert_one(doc)
    doc.pop("_id", None)
    return doc


@router.get("/esterni")
async def list_esterni():
    docs = await db.clienti_esterni.find({}, {"_id": 0}).sort("nome", 1).to_list(2000)
    ids = [d["id"] for d in docs]
    lavori = await db.lavori.find({"cliente_id": {"$in": ids}}, {"_id": 0, "cliente_id": 1, "costo": 1, "ore": 1, "data": 1}).to_list(10000)
    agg = {}
    for l in lavori:
        a = agg.setdefault(l["cliente_id"], {"n": 0, "totale": 0.0, "ore": 0.0, "ultimo": ""})
        a["n"] += 1
        a["totale"] += float(l.get("costo") or 0)
        a["ore"] += float(l.get("ore") or 0)
        a["ultimo"] = max(a["ultimo"], l.get("data") or "")
    for d in docs:
        d.update(agg.get(d["id"], {"n": 0, "totale": 0.0, "ore": 0.0, "ultimo": ""}))
        d["totale"] = round(d["totale"], 2)
    return docs


@router.post("/esterni")
async def create_esterno(payload: EsternoIn):
    return await crea_esterno(payload.nome, payload.telefono, payload.note)


@router.put("/esterni/{eid}")
async def update_esterno(eid: str, payload: EsternoIn):
    r = await db.clienti_esterni.update_one({"id": eid}, {"$set": {"nome": payload.nome.strip(), "telefono": payload.telefono or "", "note": payload.note or ""}})
    if not r.matched_count:
        raise HTTPException(404, "Cliente esterno non trovato")
    return await db.clienti_esterni.find_one({"id": eid}, {"_id": 0})


@router.delete("/esterni/{eid}")
async def delete_esterno(eid: str):
    n = await db.lavori.count_documents({"cliente_id": eid})
    if n > 0:
        raise HTTPException(400, f"Elimina prima i {n} lavori collegati")
    await db.clienti_esterni.delete_one({"id": eid})
    return {"ok": True}
