"""Integration tests for the inventory domain (previously zero coverage).

Same cross-tenant bug as vendors.py, copy-pasted into this file too:
get/update/delete only filtered by id, never by clinic_id, and list
accepted an unchecked clinic_id override. Fixed alongside these tests;
test_cross_clinic_* below are the regression tests. medications.py had the
same list-override bug but its get/update/delete were already correctly
scoped. medication_groups.py and transactions.py were already correct
throughout.
"""
import pytest


@pytest.fixture
def other_clinic_item(db_session):
    from models import Clinic, InventoryItem

    other = Clinic(name="Other Clinic", address="x", phone="2", email="other2@clinic.com",
                    specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)

    item = InventoryItem(clinic_id=other.id, name="Rival Gloves", quantity=100, unit="box")
    db_session.add(item)
    db_session.commit()
    db_session.refresh(item)
    return item


# ── Auth boundary ───────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/inventory"),
    ("post", "/api/v1/inventory"),
    ("get", "/api/v1/inventory/1"),
    ("put", "/api/v1/inventory/1"),
    ("delete", "/api/v1/inventory/1"),
    ("get", "/api/v1/inventory/summary"),
    ("get", "/api/v1/medication-stock"),
    ("post", "/api/v1/medication-stock"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {}} if method in ("post", "put") else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code}"


# ── Inventory items: CRUD + ledger side effects ─────────────────────────────

def test_create_item_scoped_to_caller_clinic_and_logs_opening_stock(client, auth_headers, test_clinic):
    r = client.post(
        "/api/v1/inventory",
        json={"name": "Nitrile Gloves", "quantity": 50, "unit": "box", "min_stock_level": 10},
        headers=auth_headers,
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["clinic_id"] == test_clinic.id
    assert data["quantity"] == 50

    txns = client.get("/api/v1/inventory/transactions", headers=auth_headers)
    assert txns.status_code == 200
    assert any(t["note"] == "Opening stock" for t in txns.json())


def test_get_update_delete_item_lifecycle(client, auth_headers):
    created = client.post("/api/v1/inventory", json={"name": "Cotton Rolls", "quantity": 20}, headers=auth_headers).json()

    got = client.get(f"/api/v1/inventory/{created['id']}", headers=auth_headers)
    assert got.status_code == 200

    updated = client.put(f"/api/v1/inventory/{created['id']}", json={"quantity": 5}, headers=auth_headers)
    assert updated.status_code == 200
    assert updated.json()["quantity"] == 5

    deleted = client.delete(f"/api/v1/inventory/{created['id']}", headers=auth_headers)
    assert deleted.status_code == 200
    assert client.get(f"/api/v1/inventory/{created['id']}", headers=auth_headers).status_code == 404


def test_updating_quantity_logs_the_delta_to_the_ledger(client, auth_headers):
    created = client.post("/api/v1/inventory", json={"name": "Masks", "quantity": 100}, headers=auth_headers).json()
    client.put(f"/api/v1/inventory/{created['id']}", json={"quantity": 60}, headers=auth_headers)

    txns = client.get(f"/api/v1/inventory/transactions?inventory_item_id={created['id']}", headers=auth_headers)
    assert txns.status_code == 200
    directions = [t["direction"] for t in txns.json()]
    assert "out" in directions  # the 100 -> 60 drop


def test_list_inventory_ignores_a_clinic_id_override_attempt(client, auth_headers, other_clinic_item):
    r = client.get(f"/api/v1/inventory?clinic_id={other_clinic_item.clinic_id}", headers=auth_headers)
    assert r.status_code == 200
    assert all(i["clinic_id"] != other_clinic_item.clinic_id for i in r.json())


def test_cross_clinic_get_is_blocked(client, auth_headers, other_clinic_item):
    r = client.get(f"/api/v1/inventory/{other_clinic_item.id}", headers=auth_headers)
    assert r.status_code == 404


def test_cross_clinic_update_is_blocked(client, auth_headers, other_clinic_item, db_session):
    r = client.put(f"/api/v1/inventory/{other_clinic_item.id}", json={"quantity": 0}, headers=auth_headers)
    assert r.status_code == 404
    db_session.refresh(other_clinic_item)
    assert other_clinic_item.quantity == 100, "the other clinic's stock must be untouched"


def test_cross_clinic_delete_is_blocked(client, auth_headers, other_clinic_item):
    r = client.delete(f"/api/v1/inventory/{other_clinic_item.id}", headers=auth_headers)
    assert r.status_code == 404


# ── Medication stock ─────────────────────────────────────────────────────────

def test_medication_stock_crud(client, auth_headers, test_clinic):
    created = client.post(
        "/api/v1/medication-stock",
        json={"name": "Amoxicillin 500mg", "quantity": 200, "unit": "tablet"},
        headers=auth_headers,
    )
    assert created.status_code == 201, created.text
    data = created.json()
    assert data["clinic_id"] == test_clinic.id

    listed = client.get("/api/v1/medication-stock", headers=auth_headers)
    assert listed.status_code == 200
    assert any(m["id"] == data["id"] for m in listed.json())

    deleted = client.delete(f"/api/v1/medication-stock/{data['id']}", headers=auth_headers)
    assert deleted.status_code == 200


def test_medication_stock_list_ignores_clinic_id_override(client, auth_headers, db_session):
    from models import Clinic, MedicationStock

    other = Clinic(name="Other Clinic 2", address="x", phone="3", email="other3@clinic.com",
                    specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    db_session.refresh(other)
    med = MedicationStock(clinic_id=other.id, name="Rival Med", quantity=10)
    db_session.add(med)
    db_session.commit()

    r = client.get(f"/api/v1/medication-stock?clinic_id={other.id}", headers=auth_headers)
    assert r.status_code == 200
    assert all(m["clinic_id"] != other.id for m in r.json())
