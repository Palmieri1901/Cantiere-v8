"""Tests: dipendenti CRUD, mobile API (X-Api-Key), lavori-pending queue and approva."""
import os
import uuid
import pytest
import requests

from tests.conftest import API, _login_session  # noqa: E402


TEST_PREFIX = "TEST_DIP_"


@pytest.fixture(scope="module")
def admin():
    return _login_session()


@pytest.fixture(scope="module")
def created_dip(admin):
    """Create a fresh test dipendente and return {id, nome, chiave}. Cleaned at teardown."""
    nome = f"{TEST_PREFIX}{uuid.uuid4().hex[:6]}"
    r = admin.post(f"{API}/dipendenti", json={"nome": nome})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["nome"] == nome
    assert data["chiave"].startswith("PM-")
    assert "id" in data and "key_hint" in data
    yield data
    # teardown
    admin.delete(f"{API}/dipendenti/{data['id']}")


@pytest.fixture(scope="module")
def sample_cliente(admin):
    r = admin.get(f"{API}/clienti")
    assert r.status_code == 200
    lst = r.json()
    if not lst:
        pytest.skip("Nessun cliente in DB per testare approva")
    return lst[0]


# ---------------- Dipendenti CRUD -----------------

class TestDipendentiCRUD:
    def test_list(self, admin):
        r = admin.get(f"{API}/dipendenti")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_create_hides_key_hash(self, admin, created_dip):
        r = admin.get(f"{API}/dipendenti")
        row = next((x for x in r.json() if x["id"] == created_dip["id"]), None)
        assert row is not None
        assert "key_hash" not in row
        assert row["key_hint"] == created_dip["chiave"][-4:]
        assert row["attivo"] is True

    def test_rigenera_chiave(self, admin, created_dip):
        r = admin.post(f"{API}/dipendenti/{created_dip['id']}/rigenera-chiave")
        assert r.status_code == 200
        new_key = r.json()["chiave"]
        assert new_key.startswith("PM-")
        assert new_key != created_dip["chiave"]
        # update fixture in place so subsequent tests use new key
        created_dip["chiave"] = new_key

    def test_toggle_active(self, admin, created_dip):
        r = admin.put(f"{API}/dipendenti/{created_dip['id']}", json={"nome": created_dip["nome"], "attivo": False})
        assert r.status_code == 200
        assert r.json()["attivo"] is False
        # reactivate
        r = admin.put(f"{API}/dipendenti/{created_dip['id']}", json={"nome": created_dip["nome"], "attivo": True})
        assert r.status_code == 200

    def test_create_empty_name_400(self, admin):
        r = admin.post(f"{API}/dipendenti", json={"nome": "   "})
        assert r.status_code == 400


# ---------------- Mobile API (X-Api-Key) -----------------

class TestMobileAPI:
    def _mob(self, key):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "X-Api-Key": key})
        return s

    def test_missing_key_401(self):
        r = requests.get(f"{API}/mobile/me", timeout=15)
        assert r.status_code == 401

    def test_wrong_key_401(self):
        r = self._mob("PM-XXXX-YYYY-ZZZZ").get(f"{API}/mobile/me")
        assert r.status_code == 401

    def test_me(self, created_dip):
        r = self._mob(created_dip["chiave"]).get(f"{API}/mobile/me")
        assert r.status_code == 200, r.text
        assert r.json()["nome"] == created_dip["nome"]

    def test_clienti_deduped(self, created_dip):
        r = self._mob(created_dip["chiave"]).get(f"{API}/mobile/clienti")
        assert r.status_code == 200
        lst = r.json()
        seen = set()
        for c in lst:
            k = ((c.get("cognome") or "").strip().lower(), (c.get("nome") or "").strip().lower())
            assert k not in seen, f"Duplicated client key {k}"
            seen.add(k)

    def test_articoli(self, created_dip):
        r = self._mob(created_dip["chiave"]).get(f"{API}/mobile/articoli")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_lavori_post_and_dedupe(self, created_dip, sample_cliente):
        client_uid = f"TEST-{uuid.uuid4()}"
        payload = {"lavori": [{
            "client_uid": client_uid,
            "cliente_id": sample_cliente["id"],
            "data": "2026-01-10",
            "tipo": "Riparazione",
            "descrizione": "TEST_DIP invio test",
            "ore": 2.5,
            "materiali": "note",
            "articoli_magazzino": [],
        }]}
        s = self._mob(created_dip["chiave"])
        r = s.post(f"{API}/mobile/lavori", json=payload)
        assert r.status_code == 200, r.text
        assert r.json()["nuovi"] == 1
        # dedupe
        r2 = s.post(f"{API}/mobile/lavori", json=payload)
        assert r2.status_code == 200
        assert r2.json()["nuovi"] == 0

    def test_disattivato_401(self, admin, created_dip):
        admin.put(f"{API}/dipendenti/{created_dip['id']}", json={"nome": created_dip["nome"], "attivo": False})
        try:
            r = self._mob(created_dip["chiave"]).get(f"{API}/mobile/me")
            assert r.status_code == 401
        finally:
            admin.put(f"{API}/dipendenti/{created_dip['id']}", json={"nome": created_dip["nome"], "attivo": True})


# ---------------- Admin queue + approva -----------------

class TestPendingQueue:
    def test_list_and_count(self, admin):
        r = admin.get(f"{API}/lavori-pending")
        assert r.status_code == 200
        r2 = admin.get(f"{API}/lavori-pending/count")
        assert r2.status_code == 200
        assert "count" in r2.json()

    def test_full_approve_flow(self, admin, created_dip, sample_cliente):
        # inject via mobile
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "X-Api-Key": created_dip["chiave"]})
        client_uid = f"TEST-APR-{uuid.uuid4()}"
        r = s.post(f"{API}/mobile/lavori", json={"lavori": [{
            "client_uid": client_uid, "cliente_id": sample_cliente["id"],
            "data": "2026-01-11", "tipo": "Manutenzione motore",
            "descrizione": "TEST_DIP approva flow", "ore": 3.0, "materiali": "",
        }]})
        assert r.status_code == 200
        # find pending
        r = admin.get(f"{API}/lavori-pending")
        pending = next((p for p in r.json() if p["client_uid"] == client_uid), None)
        assert pending is not None
        pid = pending["id"]

        # approve with costo override
        r = admin.post(f"{API}/lavori-pending/{pid}/approva", json={"costo": 250.0, "ore": 3.5})
        assert r.status_code == 200, r.text
        lavoro = r.json()
        assert lavoro["costo"] == 250.0
        assert lavoro["ore"] == 3.5
        assert lavoro["dipendente"] == created_dip["nome"]

        # verify in cliente lavori
        r = admin.get(f"{API}/clienti/{sample_cliente['id']}/lavori")
        assert r.status_code == 200
        found = next((l for l in r.json() if l["id"] == lavoro["id"]), None)
        assert found is not None
        assert found["ore"] == 3.5
        assert found["dipendente"] == created_dip["nome"]

        # approve twice -> 404
        r = admin.post(f"{API}/lavori-pending/{pid}/approva", json={})
        assert r.status_code == 404

        # cleanup created lavoro
        admin.delete(f"{API}/lavori/{lavoro['id']}")

    def test_approva_invalid_cliente_400(self, admin, created_dip):
        # create pending with bogus cliente
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "X-Api-Key": created_dip["chiave"]})
        client_uid = f"TEST-INV-{uuid.uuid4()}"
        r = s.post(f"{API}/mobile/lavori", json={"lavori": [{
            "client_uid": client_uid, "cliente_id": None,
            "data": "2026-01-11", "tipo": "Altro", "descrizione": "no cliente", "ore": 1,
        }]})
        assert r.status_code == 200
        pending = next(p for p in admin.get(f"{API}/lavori-pending").json() if p["client_uid"] == client_uid)
        pid = pending["id"]
        # approve without body override -> 400
        r = admin.post(f"{API}/lavori-pending/{pid}/approva", json={})
        assert r.status_code == 400
        # cleanup
        admin.delete(f"{API}/lavori-pending/{pid}")

    def test_rifiuta(self, admin, created_dip):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json", "X-Api-Key": created_dip["chiave"]})
        client_uid = f"TEST-REF-{uuid.uuid4()}"
        s.post(f"{API}/mobile/lavori", json={"lavori": [{
            "client_uid": client_uid, "cliente_id": None, "data": "2026-01-11",
            "tipo": "Altro", "descrizione": "rifiuto", "ore": 1,
        }]})
        pid = next(p["id"] for p in admin.get(f"{API}/lavori-pending").json() if p["client_uid"] == client_uid)
        r = admin.post(f"{API}/lavori-pending/{pid}/rifiuta")
        assert r.status_code == 200
        # cannot rifiuta twice
        r2 = admin.post(f"{API}/lavori-pending/{pid}/rifiuta")
        assert r2.status_code == 404
        admin.delete(f"{API}/lavori-pending/{pid}")

    def test_import_qr(self, admin, created_dip):
        client_uid = f"TEST-QR-{uuid.uuid4()}"
        body = {
            "dipendente_nome": created_dip["nome"],
            "lavori": [{"client_uid": client_uid, "cliente_id": None, "data": "2026-01-11",
                        "tipo": "Riparazione", "descrizione": "qr import", "ore": 2}]
        }
        r = admin.post(f"{API}/lavori-pending/import-qr", json=body)
        assert r.status_code == 200
        assert r.json()["nuovi"] == 1
        # dedupe
        r2 = admin.post(f"{API}/lavori-pending/import-qr", json=body)
        assert r2.json()["nuovi"] == 0
        # origine qr
        row = next(p for p in admin.get(f"{API}/lavori-pending").json() if p["client_uid"] == client_uid)
        assert row["origine"] == "qr"
        assert row["dipendente_nome"] == created_dip["nome"]
        admin.delete(f"{API}/lavori-pending/{row['id']}")


# ---------------- Lavori regression (ore + dipendente) -----------------

class TestLavoriRegression:
    def test_create_with_ore_and_dipendente(self, admin, sample_cliente):
        r = admin.post(f"{API}/lavori", json={
            "cliente_id": sample_cliente["id"], "data": "2026-01-12",
            "tipo": "Pulizia", "descrizione": "TEST_DIP regression",
            "costo": 50.0, "materiali": "", "stato": "completato",
            "ore": 4.5, "dipendente": "TEST_DIP_MARIO",
        })
        assert r.status_code == 200, r.text
        lavoro = r.json()
        assert lavoro["ore"] == 4.5
        assert lavoro["dipendente"] == "TEST_DIP_MARIO"
        # update
        r = admin.put(f"{API}/lavori/{lavoro['id']}", json={
            "cliente_id": sample_cliente["id"], "data": "2026-01-12",
            "tipo": "Pulizia", "descrizione": "TEST_DIP regression upd",
            "costo": 60.0, "materiali": "", "stato": "completato",
            "ore": 5.0, "dipendente": "TEST_DIP_LUIGI",
        })
        assert r.status_code == 200
        assert r.json()["ore"] == 5.0
        assert r.json()["dipendente"] == "TEST_DIP_LUIGI"
        admin.delete(f"{API}/lavori/{lavoro['id']}")

    def test_backup_includes_new_collections(self, admin):
        r = admin.post(f"{API}/backup", json={})
        # backup may be GET or POST — try both
        if r.status_code == 405:
            r = admin.get(f"{API}/backup")
        assert r.status_code == 200, r.text
        data = r.json()
        # Should mention dipendenti + lavori_pending somewhere in structure
        txt = str(data)
        assert "dipendenti" in txt
        assert "lavori_pending" in txt
