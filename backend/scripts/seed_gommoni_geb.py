"""Seed catalogo Gommoni GEB da 'CARATTERISTICHE GOMMONI G.E.B.' (upsert per modello)."""
import asyncio
import uuid
from datetime import datetime, timezone

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

# modello, mis_ext, mis_int, d_tub, camere, persone, massa, categoria, cv_min, cv_max, specchio
ROWS = [
    ("440 Job", "440x213", 113, 50, 4, 6, 150, "C", 40, 40, "L"),
    ("500 Job", "500x223", 115, 55, 5, 8, 220, "C", 40, 60, "L"),
    ("530 Job", "532x236", 116, 56, 5, 8, 300, "C", 40, 70, "L"),
    ("570 Job", "570x240", 130, 60, 5, 10, 400, "C", 60, 115, "L"),
    ("600 Job", "600x250", 130, 60, 5, 10, 450, "C", 70, 115, "L"),
    ("440 Sirio", "440x213", 113, 50, 4, 6, 195, "C", 40, 40, "L"),
    ("500 Sirio", "500x223", 115, 55, 5, 8, 270, "C", 40, 60, "L"),
    ("530 Sirio", "532x236", 116, 56, 5, 8, 350, "C", 40, 70, "L"),
    ("570 Sirio", "570x240", 130, 60, 5, 9, 450, "C", 60, 115, "L"),
    ("600 Sirio", "600x250", 130, 60, 5, 10, 500, "C", 70, 115, "L"),
    ("620 Tsunami", "610x250", 140, 57, 6, 10, 600, "C", 70, 140, "L"),
    ("700 Tsunami", "700x280", 180, 58, 6, 14, 1000, "C", 150, 225, "XL"),
    ("780 Tsunami", "780x300", 184, 60, 6, 16, 1100, "C/B", 175, 250, "XL"),
    ("800 Tsunami", "800x318", 184, 58, 6, 16, 1200, "C/B", 220, 400, "XXL"),
]


async def main():
    env = dotenv_values("/app/backend/.env")
    db = AsyncIOMotorClient(env["MONGO_URL"])[env["DB_NAME"]]
    now = datetime.now(timezone.utc)
    for i, (mod, ext, mint, dtub, cam, pers, massa, cat, cvmin, cvmax, spec) in enumerate(ROWS):
        L, W = ext.lower().split("x")
        doc = {
            "modello": f"GEB {mod}", "lunghezza_m": int(L) / 100, "larghezza_m": int(W) / 100,
            "lunghezza_interna_cm": mint, "diametro_tubolare_cm": dtub, "compartimenti": cam,
            "portata_persone": pers, "peso_kg": massa, "categoria_ce": cat,
            "potenza_min_hp": cvmin, "potenza_max_hp": cvmax, "specchio": spec,
            "carena": "VTR", "tessuto": "H (Hypalon)", "ordine": i + 1, "updated_at": now,
        }
        existing = await db.gommoni_modelli.find_one({"modello": doc["modello"]})
        if existing:
            await db.gommoni_modelli.update_one({"id": existing["id"]}, {"$set": doc})
        else:
            await db.gommoni_modelli.insert_one({**doc, "id": str(uuid.uuid4()), "dotazioni": "", "note": "", "prezzo_pubblico": 0, "created_at": now})
    await db.gommoni_modelli.delete_many({"modello": "GEB 620 Open"})
    print("ok", await db.gommoni_modelli.count_documents({}))


asyncio.run(main())
