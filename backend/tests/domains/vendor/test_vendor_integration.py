"""Integration tests for the vendor domain (previously zero coverage).

Reading vendors.py while writing these turned up a real cross-tenant data
isolation bug: get/update/delete only filtered by Vendor.id, never by
clinic_id, so any authenticated user (in any clinic) could read, edit, or
deactivate another clinic's vendor by guessing its id — and list_vendors
accepted an unchecked `clinic_id` query param that let any user enumerate
another clinic's vendor list outright. Fixed in the same change as these
tests; test_cross_clinic_vendor_* below are the regression tests for it.
"""
import pytest


@pytest.fixture
def other_clinic_vendor(db_session):
    """A vendor that belongs to a DIFFERENT clinic than the test fixtures'."""
    from models import Clinic, Vendor

    other_clinic = Clinic(name="Other Clinic", address="x", phone="2", email="other@clinic.com",
                           specialization="dental", subscription_plan="free")
    db_session.add(other_clinic)
    db_session.commit()
    db_session.refresh(other_clinic)

    vendor = Vendor(clinic_id=other_clinic.id, name="Rival Supplies", category="General")
    db_session.add(vendor)
    db_session.commit()
    db_session.refresh(vendor)
    return vendor


@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/vendors"),
    ("post", "/api/v1/vendors"),
    ("get", "/api/v1/vendors/1"),
    ("put", "/api/v1/vendors/1"),
    ("delete", "/api/v1/vendors/1"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {}} if method in ("post", "put") else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} returned {r.status_code}"


def test_create_vendor_is_scoped_to_the_caller_clinic(client, auth_headers, test_clinic):
    r = client.post("/api/v1/vendors", json={"name": "Acme Dental Supplies"}, headers=auth_headers)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["clinic_id"] == test_clinic.id
    assert data["is_active"] is True


def test_get_update_delete_vendor_lifecycle(client, auth_headers):
    created = client.post("/api/v1/vendors", json={"name": "Acme"}, headers=auth_headers).json()

    got = client.get(f"/api/v1/vendors/{created['id']}", headers=auth_headers)
    assert got.status_code == 200
    assert got.json()["name"] == "Acme"

    updated = client.put(
        f"/api/v1/vendors/{created['id']}", json={"name": "Acme Renamed"}, headers=auth_headers
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "Acme Renamed"

    deleted = client.delete(f"/api/v1/vendors/{created['id']}", headers=auth_headers)
    assert deleted.status_code == 200

    # Soft delete: the vendor still exists but is_active flips false.
    after = client.get(f"/api/v1/vendors/{created['id']}", headers=auth_headers)
    assert after.status_code == 200
    assert after.json()["is_active"] is False


def test_list_vendors_only_returns_the_caller_clinic(client, auth_headers, other_clinic_vendor):
    client.post("/api/v1/vendors", json={"name": "Mine"}, headers=auth_headers)

    r = client.get("/api/v1/vendors", headers=auth_headers)
    assert r.status_code == 200
    names = [v["name"] for v in r.json()]
    assert "Mine" in names
    assert "Rival Supplies" not in names


def test_list_vendors_ignores_a_clinic_id_override_attempt(client, auth_headers, other_clinic_vendor):
    r = client.get(f"/api/v1/vendors?clinic_id={other_clinic_vendor.clinic_id}", headers=auth_headers)
    assert r.status_code == 200
    assert all(v["clinic_id"] != other_clinic_vendor.clinic_id for v in r.json())


def test_cross_clinic_get_is_blocked(client, auth_headers, other_clinic_vendor):
    r = client.get(f"/api/v1/vendors/{other_clinic_vendor.id}", headers=auth_headers)
    assert r.status_code == 404


def test_cross_clinic_update_is_blocked(client, auth_headers, other_clinic_vendor):
    r = client.put(
        f"/api/v1/vendors/{other_clinic_vendor.id}", json={"name": "Hijacked"}, headers=auth_headers
    )
    assert r.status_code == 404


def test_cross_clinic_delete_is_blocked(client, auth_headers, other_clinic_vendor, db_session):
    r = client.delete(f"/api/v1/vendors/{other_clinic_vendor.id}", headers=auth_headers)
    assert r.status_code == 404

    db_session.refresh(other_clinic_vendor)
    assert other_clinic_vendor.is_active is True, "the other clinic's vendor must be untouched"
