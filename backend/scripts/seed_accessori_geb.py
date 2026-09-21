"""Seed accessori Gommoni GEB da 'PREZZI ACCESSORI SERIE SIRIO/TSUNAMI' (IVA esclusa). Upsert per (serie, nome)."""
import asyncio
import uuid
from datetime import datetime, timezone

from dotenv import dotenv_values
from motor.motor_asyncio import AsyncIOMotorClient

S = "SERIE"  # di serie / incluso
# (nome, specifiche, {taglia: prezzo | S})
TSUNAMI = [
    ("Frigorifero incasso 42 lt", "Montato", {"700": 1000, "800": 1000}),
    ("Timoneria idraulica", "Montata", {"620": 1250, "700": 1400, "800": 1400}),
    ("Stacca batterie a scomparsa", "Montato", {"620": 90, "700": 90, "800": 90}),
    ("Stacca batterie settoriale", "Montato", {"620": 120, "700": 120, "800": 120}),
    ("Amplificatore Bluetooth con casse acustiche", "Montato", {"620": 450, "700": 450, "800": 450}),
    ("Tendalino 3 archi alluminio", "Montato", {"620": 250}),
    ("Tendalino inox con supporti", "Montato", {"620": 800, "700": 900, "800": 900}),
    ("Ecoscandaglio Garmin Echo Strike 4", "Montato", {"620": 250, "700": 250, "800": 250}),
    ("Eco/Chartplotter Garmin Echomap UHD2 92sv", "Montato", {"700": 1700, "800": 1700}),
    ("Impianto doccia con serbatoio e autoclave", "Montato", {"620": 650, "700": 650, "800": 650}),
    ("Roll-bar acciaio con tendalino in colore", "Montato", {"620": 2950, "700": 2950, "800": 2950}),
    ("Puntale VTR", "Montato", {"620": S, "700": S, "800": S}),
    ("Fornello portatile", "", {"620": 80, "700": 80, "800": 80}),
    ("Fornello incassato con vano bombola", "Montato", {"620": 500, "700": 500, "800": 500}),
    ("Luci di navigazione", "Montate", {"620": 200, "700": 200, "800": 250}),
    ("Pannello elettrico 6 int. Osculati", "Montato", {"620": 150, "700": 150, "800": S}),
    ("Serbatoio PVC fuel con indicatore di livello", "Montato", {"620": 700, "700": 1000, "800": 1200}),
    ("Accendisigari inox", "Montato", {"620": 50, "700": 50, "800": 50}),
    ("Pompa di sentina", "Montata", {"620": 90, "700": 90, "800": 90}),
    ("Copri consolle", "", {"620": 190}),
    ("Eco/Chartplotter configurato con motore in NMEA2000", "Montato", {"700": 2500, "800": 2500}),
    ("Luci sottomarine", "Montato", {"620": 150, "700": 200, "800": 200}),
    ("Tromba", "Montata", {"620": 70, "700": 70, "800": 70}),
    ("WC chimico", "", {"700": 80, "800": 80}),
    ("WC manuale scarico mare", "Montato", {"700": 400, "800": 400}),
    ("WC elettrico scarico mare", "Montato", {"700": 600, "800": 600}),
    ("Tappeto EVA", "Montato", {"620": 850, "700": 1500, "800": 2000}),
    ("Serbatoio WC con maceratore", "Montato", {"700": 500, "800": 500}),
]
SIRIO = [
    ("N° 2 pedane VTR su tubolari", "Montate", {"530": 1200, "570": 1000, "600": S}),
    ("Pedane VTR di poppa per scaletta", "Completa", {"440": 150, "500": 150, "530": 150, "570": 150, "600": S}),
    ("Stacca batterie a scomparsa", "Montato", {"440": 70, "500": 70, "530": 70, "570": 70, "600": 70}),
    ("Stereo tondo con casse acustiche", "Montato", {"440": 450, "500": 450, "530": 450, "570": 450, "600": 450}),
    ("Telo notte", "", {"440": 800, "500": 800, "530": 1000, "570": 1100, "600": 1200}),
    ("Tendalino 3 archi alluminio", "Montato", {"440": 250, "500": 250, "530": 250, "570": 250, "600": 250}),
    ("Ecoscandaglio Garmin Echo Strike 4", "Montato", {"440": 250, "500": 250, "530": 250, "570": 250, "600": 250}),
    ("Impianto doccia con serbatoio e autoclave", "Montato", {"440": 650, "500": 650, "530": 650, "570": 650, "600": 650}),
    ("Roll-bar acciaio", "Montato", {"440": 700, "500": 700, "530": 700, "570": 700, "600": 700}),
    ("Puntale VTR", "Montato", {"440": 350, "500": 350, "530": 350, "570": 350, "600": 350}),
    ("Luci di navigazione", "Montate", {"440": 200, "500": 200, "530": 200, "570": 200, "600": 200}),
    ("Pannello elettrico 6 int. Osculati", "Montato", {"440": 150, "500": 150, "530": 150, "570": 150, "600": 150}),
    ("Serbatoio PVC fuel con indicatore di livello", "Montato", {"500": 700, "530": 800, "570": 800, "600": 800}),
    ("Accendisigari inox", "Montato", {"440": 50, "500": 50, "530": 50, "570": 50, "600": 50}),
    ("Pompa di sentina", "Montata", {"440": 90, "500": 90, "530": 90, "570": 90, "600": 90}),
    ("Copri consolle", "", {"440": 120, "500": 130, "530": 170, "570": 170, "600": 170}),
    ("Tromba", "Montata", {"440": 70, "500": 70, "530": 70, "570": 70, "600": 70}),
]


async def main():
    env = dotenv_values("/app/backend/.env")
    db = AsyncIOMotorClient(env["MONGO_URL"])[env["DB_NAME"]]
    now = datetime.now(timezone.utc)
    n = 0
    for serie, rows in (("Tsunami", TSUNAMI), ("Sirio", SIRIO)):
        for nome, spec, prezzi in rows:
            ppm = {t: float(v) for t, v in prezzi.items() if v != S}
            di_serie = [t for t, v in prezzi.items() if v == S]
            doc = {"nome": nome, "serie": serie, "specifiche": spec, "categoria": "", "descrizione": "",
                   "prezzo": min(ppm.values()) if ppm else 0, "prezzi_per_modello": ppm, "di_serie": di_serie, "updated_at": now}
            ex = await db.gommoni_accessori.find_one({"serie": serie, "nome": nome})
            if ex:
                await db.gommoni_accessori.update_one({"id": ex["id"]}, {"$set": doc})
            else:
                await db.gommoni_accessori.insert_one({**doc, "id": str(uuid.uuid4()), "created_at": now})
            n += 1
    await db.gommoni_accessori.delete_many({"nome": "Tendalino", "serie": {"$in": ["", None]}})
    print("ok", n, await db.gommoni_accessori.count_documents({}))


asyncio.run(main())
