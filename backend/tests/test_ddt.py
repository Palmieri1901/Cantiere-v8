"""Backend tests for DDT & Foglio di destinazione module."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    r = sess.post(f"{API}/auth/login", json={"password": "admin"}, timeout=15)
    if r.status_code != 200:
        pytest.skip(f"login failed: {r.status_code} {r.text}")
    return sess


# tracking created ids to cleanup
_created_ind: list = []
_created_ddt: list = []


# ---------- Rubrica ----------
class TestRubrica:
    def test_create_missing_nome(self, s):
        r = s.post(f"{API}/ddt/indirizzi", json={"nome": "  "})
        assert r.status_code == 400

    def test_crud_indirizzo(self, s):
        payload = {"nome": "TEST_RUBRICA_X", "indirizzo": "Via A 1", "cap": "40100", "citta": "Bologna", "provincia": "BO"}
        r = s.post(f"{API}/ddt/indirizzi", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["nome"] == "TEST_RUBRICA_X"
        assert d["citta"] == "Bologna"
        aid = d["id"]
        _created_ind.append(aid)

        # GET with ?q=
        r = s.get(f"{API}/ddt/indirizzi", params={"q": "TEST_RUBRICA"})
        assert r.status_code == 200
        assert any(x["id"] == aid for x in r.json())

        # PUT
        r = s.put(f"{API}/ddt/indirizzi/{aid}", json={**payload, "citta": "Modena"})
        assert r.status_code == 200
        assert r.json()["citta"] == "Modena"

        # DELETE
        r = s.delete(f"{API}/ddt/indirizzi/{aid}")
        assert r.status_code == 200
        _created_ind.remove(aid)

        # deleted
        r = s.delete(f"{API}/ddt/indirizzi/{aid}")
        assert r.status_code == 404


# ---------- DDT CRUD ----------
class TestDdt:
    def test_prossimo_numero(self, s):
        r = s.get(f"{API}/ddt/prossimo-numero", params={"anno": 2026})
        assert r.status_code == 200
        assert "numero" in r.json() and r.json()["anno"] == 2026

    def test_create_auto_numero(self, s):
        r = s.get(f"{API}/ddt/prossimo-numero", params={"anno": 2026})
        expected = r.json()["numero"]
        payload = {
            "anno": 2026, "data": "2026-01-10",
            "cessionario": {"nome": "TEST_CES_A", "citta": "Bologna"},
            "righe": [{"quantita": 2, "descrizione": "Item test", "prezzo_unitario": 10}],
        }
        r = s.post(f"{API}/ddt", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["numero"] == expected
        assert d["anno"] == 2026
        _created_ddt.append(d["id"])

        # duplicate number
        r2 = s.post(f"{API}/ddt", json={**payload, "numero": d["numero"]})
        assert r2.status_code == 400

    def test_list_filters(self, s):
        r = s.get(f"{API}/ddt", params={"anno": 2026, "q": "TEST_CES_A"})
        assert r.status_code == 200
        arr = r.json()
        assert len(arr) >= 1
        assert all(x["anno"] == 2026 for x in arr)

    def test_anni(self, s):
        r = s.get(f"{API}/ddt/anni")
        assert r.status_code == 200
        assert 2026 in r.json()

    def test_update_without_data(self, s):
        assert _created_ddt, "no ddt created"
        did = _created_ddt[0]
        # get current
        cur = next((x for x in s.get(f"{API}/ddt").json() if x["id"] == did), None)
        assert cur
        payload = {
            "numero": cur["numero"], "anno": cur["anno"],
            "cessionario": cur["cessionario"],
            "note": "TEST_updated_no_date",
            "righe": cur["righe"],
        }
        r = s.put(f"{API}/ddt/{did}", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["note"] == "TEST_updated_no_date"

    def test_pdf_endpoints(self, s):
        did = _created_ddt[0]
        for path in [f"/ddt/{did}/pdf", f"/ddt/{did}/foglio-destinazione.pdf"]:
            r = s.get(f"{API}{path}")
            assert r.status_code == 200, path
            assert r.headers["content-type"].startswith("application/pdf")
            assert len(r.content) > 500

    def test_preview_pdfs(self, s):
        payload = {
            "cessionario": {"nome": "TEST_PREVIEW", "citta": "X"},
            "righe": [{"quantita": 1, "descrizione": "prev", "prezzo_unitario": 5}],
            "note_destinazione": "Consegna urgente",
        }
        r = s.post(f"{API}/ddt/preview-pdf", json=payload)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")

        r = s.post(f"{API}/ddt/preview-foglio-destinazione", json=payload)
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")

    def test_delete_ddt(self, s):
        did = _created_ddt.pop()
        r = s.delete(f"{API}/ddt/{did}")
        assert r.status_code == 200
        r = s.delete(f"{API}/ddt/{did}")
        assert r.status_code == 404


# ---------- Regression ----------
class TestRegression:
    def test_gommoni_preventivi(self, s):
        r = s.get(f"{API}/gommoni/preventivi")
        assert r.status_code == 200


def test_zz_cleanup(s):
    # safety net
    for aid in list(_created_ind):
        s.delete(f"{API}/ddt/indirizzi/{aid}")
    for did in list(_created_ddt):
        s.delete(f"{API}/ddt/{did}")
