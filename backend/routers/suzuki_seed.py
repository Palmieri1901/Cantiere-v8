"""Dati ufficiali Listino Suzuki Marine 2025-2026 (Italia).
Fonte: PDF/Excel forniti dal cliente ("Listino Suzuki Marine 2025-2026").
Contiene: sigla modello, HP, prezzo concessionario IVA escl., prezzo pubblico IVA incl.,
gambo, e (dove disponibili dalla scheda "Gamma & Specifiche") cilindrata L,
disposizione cilindri, alimentazione, peso kg, carburante.
"""
import re
from typing import List, Dict, Any

# Specifiche tecniche di famiglia (accorpate per potenza / famiglia)
_SPECS_BY_HP: Dict[int, Dict[str, Any]] = {
    2.5:  dict(cilindrata_cc=68,   cilindri="L1 OHV 2V",           alimentazione="Carburatore",           peso_kg=13.5, categoria="Portatile", carburante="91 RON"),
    4:    dict(cilindrata_cc=140,  cilindri="L2 OHV 2V",           alimentazione="Carburatore",           peso_kg=25,   categoria="Portatile", carburante="91 RON"),
    5:    dict(cilindrata_cc=140,  cilindri="L2 OHV 2V",           alimentazione="Carburatore",           peso_kg=25,   categoria="Portatile", carburante="91 RON"),
    6:    dict(cilindrata_cc=140,  cilindri="L2 OHV 2V",           alimentazione="Carburatore",           peso_kg=25,   categoria="Portatile", carburante="91 RON"),
    8:    dict(cilindrata_cc=327,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=38,   categoria="Portatile", carburante="91 RON"),
    9.9:  dict(cilindrata_cc=327,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=44,   categoria="Portatile", carburante="91 RON"),
    15:   dict(cilindrata_cc=327,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=48,   categoria="Portatile", carburante="91 RON"),
    20:   dict(cilindrata_cc=327,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=52,   categoria="Portatile", carburante="91 RON"),
    25:   dict(cilindrata_cc=490,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=71,   categoria="In-linea 2", carburante="91 RON"),
    30:   dict(cilindrata_cc=490,  cilindri="L2 SOHC 4V",          alimentazione="EFI senza batteria",    peso_kg=74,   categoria="In-linea 2", carburante="91 RON"),
    40:   dict(cilindrata_cc=941,  cilindri="L3 SOHC 6V",          alimentazione="EFI",                    peso_kg=104,  categoria="In-linea 3", carburante="91 RON"),
    50:   dict(cilindrata_cc=941,  cilindri="L3 SOHC 6V",          alimentazione="EFI",                    peso_kg=104,  categoria="In-linea 3", carburante="91 RON"),
    60:   dict(cilindrata_cc=941,  cilindri="L3 SOHC 6V",          alimentazione="EFI",                    peso_kg=104,  categoria="In-linea 3", carburante="91 RON"),
    70:   dict(cilindrata_cc=1502, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=156,  categoria="In-linea 4", carburante="91 RON"),
    80:   dict(cilindrata_cc=1502, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=156,  categoria="In-linea 4", carburante="91 RON"),
    90:   dict(cilindrata_cc=1502, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=156,  categoria="In-linea 4", carburante="91 RON"),
    100:  dict(cilindrata_cc=2044, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=191,  categoria="In-linea 4", carburante="91 RON"),
    115:  dict(cilindrata_cc=2044, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=194,  categoria="In-linea 4", carburante="91 RON"),
    140:  dict(cilindrata_cc=2044, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=194,  categoria="In-linea 4", carburante="91 RON"),
    150:  dict(cilindrata_cc=2867, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=240,  categoria="In-linea 4", carburante="91 RON"),
    175:  dict(cilindrata_cc=2867, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=240,  categoria="In-linea 4", carburante="91 RON"),
    200:  dict(cilindrata_cc=2867, cilindri="L4 DOHC 16V",         alimentazione="EFI",                    peso_kg=241,  categoria="In-linea 4", carburante="91 RON"),
    225:  dict(cilindrata_cc=3614, cilindri="V6 55° DOHC 24V",     alimentazione="EFI",                    peso_kg=274,  categoria="V6",         carburante="91 RON"),
    250:  dict(cilindrata_cc=3614, cilindri="V6 55° DOHC 24V",     alimentazione="EFI",                    peso_kg=279,  categoria="V6",         carburante="91 RON"),
    300:  dict(cilindrata_cc=4028, cilindri="V6 55° DOHC 24V",     alimentazione="EFI",                    peso_kg=292,  categoria="V6",         carburante="91 RON"),
    350:  dict(cilindrata_cc=4390, cilindri="V6 55° DOHC 24V",     alimentazione="EFI (doppio iniettore)", peso_kg=352,  categoria="V6 Flagship", carburante="95 RON"),
}


LISTINO_2025_2026: List[Dict[str, Any]] = [
    # sigla, hp, listino €, pubblico €, gambo
    ("DF2.5",     2.5, 624.84,   990.00,  "S/L"),
    ("DF4A",      4,   1041.39,  1650.00, "S/L"),
    ("DF5A",      5,   1161.31,  1840.00, "S/L"),
    ("DF6A",      6,   1293.85,  2050.00, "S/L"),
    ("DF8A",      8,   1777.21,  2930.00, "S/L"),
    ("DF8AR",     8,   2177.54,  3590.00, "L"),
    ("DF9.9A",    9.9, 1868.20,  3080.00, "S/L"),
    ("DF9.9B",    9.9, 2025.90,  3340.00, "S/L"),
    ("DF9.9BE",   9.9, 2147.21,  3540.00, "S"),
    ("DF9.9BR",   9.9, 2329.18,  3840.00, "S/L"),
    ("DF15A",     15,  2153.28,  3550.00, "S/L"),
    ("DF15AE",    15,  2426.23,  4000.00, "S/L"),
    ("DF15AR",    15,  2499.02,  4120.00, "S/L"),
    ("DF15AT",    15,  2814.43,  4640.00, "L"),
    ("DF20A",     20,  2268.52,  3740.00, "S/L"),
    ("DF20AE",    20,  2499.02,  4120.00, "S/L"),
    ("DF20AR",    20,  2596.07,  4280.00, "S/L"),
    ("DF20ATH",   20,  2741.64,  4520.00, "L"),
    ("DF20AT S",  20,  2893.28,  4770.00, "S"),
    ("DF20AT L",  20,  2893.28,  4770.00, "L"),
    ("DF25A",     25,  3117.70,  5140.00, "S/L"),
    ("DF25AT",    25,  3548.36,  5850.00, "L"),
    ("DF30AQHE",  30,  3427.05,  5650.00, "L"),
    ("DF30ATH",   30,  3487.70,  5750.00, "L"),
    ("DF30AT",    30,  3609.02,  5950.00, "S/L"),
    ("DF40A EVO",           40,  3363.67,  4500.00, "EVO S/L"),
    ("DF40A EVO barra",     40,  3391.25,  4730.00, "EVO barra S/L"),
    ("DF40A ARI",           40,  5798.31,  7750.00, "ARI L"),
    ("DF40A ARI RR",        40,  5775.24,  8100.00, "ARI RR L"),
    ("DF40A ARI barra",     40,  5650.24,  7900.00, "ARI barra L"),
    ("DF60AT",    60,  4865.75,  7700.00, "L"),
    ("DF70AT",    70,  6500.17,  10350.00, "L"),
    ("DF80AT",    80,  6742.79,  10750.00, "L"),
    ("DF90AT",    90,  7167.38,  11450.00, "L/X"),
    ("DF100BT",   100, 7531.32,  12050.00, "L/X"),
    ("DF100CT",   100, 8157.82,  12950.00, "L/X"),
    ("DF115BT",   115, 8764.38,  13950.00, "L/X"),
    ("DF115BZ",   115, 8764.38,  13950.00, "L/X"),
    ("DF115BTG",  115, 9436.90,  14850.00, "L/X"),
    ("DF115BZG",  115, 9436.90,  14850.00, "L/X"),
    ("DF140BT",   140, 9522.57,  15200.00, "L/X"),
    ("DF140BZ",   140, 9522.57,  15200.00, "L/X"),
    ("DF140BTG",  140, 10134.44, 16000.00, "L/X"),
    ("DF140BZG",  140, 10134.44, 16000.00, "L/X"),
    ("DF150AT",   150, 10379.55, 16600.00, "L/X"),
    ("DF150AZ",   150, 10379.55, 16600.00, "L/X"),
    ("DF150AP",   150, 11567.65, 18350.00, "L/X"),
    ("DF175AT/Z", 175, 11532.01, 18500.00, "L/X"),
    ("DF175AP",   175, 12841.42, 20450.00, "L/X"),
    ("DF200AT",   200, 12472.18, 20050.00, "L/X"),
    ("DF200AZ",   200, 12472.18, 20050.00, "X"),
    ("DF200AP",   200, 13872.57, 22150.00, "L/X"),
    ("DF200T",    200, 12896.77, 20750.00, "L/X/ZX"),
    ("DF225T",    225, 13200.04, 21250.00, "X/ZX"),
    ("DF250T",    250, 13685.29, 22050.00, "X/XX/ZX"),
    ("DF250AP",     250, 15965.19, 25600.00, "X/XX"),
    ("DF250AP EVO", 250, 15965.19, 25600.00, "EVO X/XX"),
    ("DF250AUN KURO", 250, 16389.78, 0,   "L/X"),
    ("DF300AP",     300, 16935.68, 27200.00, "X/XX"),
    ("DF300AP EVO", 300, 17360.27, 27900.00, "EVO X/XX"),
    ("DF300BGMD",   300, 21328.93, 34100.00, "X/XX"),
    ("DF350AGMD",   350, 23937.12, 38400.00, "X/XX"),
]


def derive_specs(sigla: str, hp: float) -> Dict[str, str]:
    """Deriva trim, avviamento e comandi dalla nomenclatura Suzuki
    (E=avviamento elettrico, R=comando a distanza, T=Power Trim & Tilt, H/barra=barra)."""
    s = sigla.upper()
    base = s.split(" ")[0]
    m = re.match(r"DF[\d.]+[ABC]?(.*)", base)
    flags = m.group(1) if m else ""
    barra = "BARRA" in s or "H" in flags
    big = hp >= 40
    has_t = "T" in flags or "Z" in flags or "P" in flags or "G" in flags
    if big or has_t or "E" in flags or "R" in flags:
        avviamento = "elettrico"
    else:
        avviamento = "manuale"
    trim = "Power Trim & Tilt" if (big or has_t) else "manuale"
    if barra or (not big and not has_t and "R" not in flags):
        comandi = "da barra"
    else:
        comandi = "a distanza"
    return {"trim": trim, "avviamento": avviamento, "comandi": comandi}


def build_seed_rows() -> List[Dict[str, Any]]:
    """Restituisce la lista di dict pronti per essere serializzati come SuzukiModello."""
    out: List[Dict[str, Any]] = []
    for row in LISTINO_2025_2026:
        sigla, hp, listino, pubblico, gambo = row
        specs = _SPECS_BY_HP.get(float(hp) if isinstance(hp, (int, float)) and hp % 1 else hp, None)
        if specs is None:
            # prova match diretto (25 == 25, 9.9 == 9.9)
            specs = _SPECS_BY_HP.get(hp, {})
        out.append({
            "codice": sigla,
            "modello": sigla,
            "potenza_hp": float(hp),
            "cilindrata_cc": specs.get("cilindrata_cc", 0),
            "cilindri": specs.get("cilindri", ""),
            "alimentazione": specs.get("alimentazione", ""),
            "peso_kg": specs.get("peso_kg", 0),
            "gambo": gambo,
            "categoria": specs.get("categoria", ""),
            "carburante": specs.get("carburante", ""),
            **derive_specs(sigla, float(hp)),
            "prezzo_listino": float(listino or 0),
            "prezzo_pubblico": float(pubblico or 0),
            "sconto_perc_1": 0,
            "sconto_perc_2": 0,
        })
    return out
