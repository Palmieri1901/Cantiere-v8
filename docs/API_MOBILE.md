# API per l'app dipendenti (`/api/mobile/*`)

Autenticazione: header `X-Api-Key: PM-XXXX-XXXX-XXXX` (chiave generata in *Lavori dal cantiere → Dipendenti e chiavi*).
Risposte JSON. Errori: `401` chiave mancante/non valida/disattivata.

| Metodo | Endpoint | Descrizione |
|---|---|---|
| GET | `/api/mobile/me` | `{id, nome, cantiere}` — verifica chiave |
| GET | `/api/mobile/clienti` | Elenco clienti (uno per persona, anno più recente): `[{id, nome, cognome, tipo_barca, lunghezza, anno, posto_barca}]` |
| GET | `/api/mobile/articoli` | Articoli magazzino: `[{id, codice, nome, quantita, unita}]` |
| POST | `/api/mobile/lavori` | Invio lavori (vedi sotto). Risposta `{ok, ricevuti, nuovi}` |

## POST /api/mobile/lavori
```json
{
  "lavori": [
    {
      "client_uid": "uuid generato dall'app (idempotenza: reinvii = ignorati)",
      "cliente_id": "id cliente da /clienti",
      "cliente_nome": "Rossi Mario",
      "data": "2026-06-10",
      "tipo": "Riparazione | Manutenzione motore | Antivegetativa | Pulizia | Elettrico | Altro",
      "descrizione": "Sostituita pompa sentina, riparazione motore",
      "ore": 10,
      "materiali": "note libere",
      "articoli_magazzino": [{ "articolo_id": "…", "quantita": 1 }]
    }
  ]
}
```
I lavori entrano nella coda **Da approvare**; dopo l'approvazione dell'amministratore finiscono nello storico del cliente
(campi `ore` e `dipendente` compilati; gli articoli vengono scaricati dal magazzino).

## QR offline
Formato del QR generato dall'app (una o più pagine):
```json
{ "t": "pm-lavori", "d": "Nome Dipendente", "p": 0, "n": 2, "items": [ …stessi oggetti di sopra… ] }
```
QR della chiave (mostrato dall'amministratore): `{ "t": "pm-key", "u": "https://genbnautica.it", "k": "PM-…", "n": "Nome" }`.
