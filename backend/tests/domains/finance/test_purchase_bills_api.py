"""Supplier bills through the API.

The invariant worth stating once: recording a bill moves no money. Only paying
it writes an Expense, and reversing that payment removes the Expense again. If
either half of that stops being true the ledger double-counts, and a clinic's
monthly costs become whatever the last person to touch a bill happened to do.
"""
import datetime

import pytest

from models import Expense, PettyCashEntry, PurchaseBill, Vendor

TODAY = datetime.date.today()


@pytest.fixture
def vendor(db_session, test_clinic):
    v = Vendor(clinic_id=test_clinic.id, name="Acme Dental Supplies",
               category="General", payment_terms_days=45)
    db_session.add(v)
    db_session.commit()
    db_session.refresh(v)
    return v


def make_bill(client, auth_headers, vendor, **over):
    body = {
        "vendor_id": vendor.id,
        "bill_number": "ACM-1",
        "bill_date": TODAY.isoformat(),
        "amount": 4000.0,
        "category": "Dental materials",
    }
    body.update(over)
    r = client.post("/api/v1/purchase-bills", json=body, headers=auth_headers)
    assert r.status_code == 200, r.text
    return r.json()


# ── Auth ────────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("method,path", [
    ("get", "/api/v1/purchase-bills"),
    ("post", "/api/v1/purchase-bills"),
    ("get", "/api/v1/purchase-bills/ageing"),
    ("get", "/api/v1/purchase-bills/1"),
    ("patch", "/api/v1/purchase-bills/1"),
    ("delete", "/api/v1/purchase-bills/1"),
    ("post", "/api/v1/purchase-bills/1/payments"),
    ("get", "/api/v1/purchase-bills/vendor/1/statement"),
])
def test_requires_auth(client, method, path):
    kwargs = {"json": {}} if method in ("post", "patch") else {}
    r = getattr(client, method)(path, **kwargs)
    assert r.status_code in (401, 403), f"{method.upper()} {path} -> {r.status_code}"


# ── Creating ────────────────────────────────────────────────────────────────

def test_terms_default_to_the_vendors_own(client, auth_headers, vendor):
    """The reason terms live on the vendor at all: nobody wants to retype 45
    on every bill from the supplier who always gives 45."""
    bill = make_bill(client, auth_headers, vendor)
    assert bill["terms_days"] == 45
    assert bill["due_date"] == (TODAY + datetime.timedelta(days=45)).isoformat()


def test_a_bill_can_override_the_vendor_terms(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor, terms_days=30)
    assert bill["terms_days"] == 30
    assert bill["due_date"] == (TODAY + datetime.timedelta(days=30)).isoformat()


def test_an_explicit_due_date_rewrites_the_terms_to_match(client, auth_headers, vendor):
    """Otherwise the bill shows a due date of one thing and terms of another."""
    due = TODAY + datetime.timedelta(days=10)
    bill = make_bill(client, auth_headers, vendor, due_date=due.isoformat())
    assert bill["due_date"] == due.isoformat()
    assert bill["terms_days"] == 10


def test_a_due_date_before_the_bill_date_is_refused(client, auth_headers, vendor):
    r = client.post("/api/v1/purchase-bills", json={
        "vendor_id": vendor.id, "bill_date": TODAY.isoformat(),
        "due_date": (TODAY - datetime.timedelta(days=1)).isoformat(),
        "amount": 100.0,
    }, headers=auth_headers)
    assert r.status_code == 400


def test_recording_a_bill_writes_no_expense(client, auth_headers, vendor, db_session, test_clinic):
    """A bill is an obligation, not a cost that has been incurred. Booking it
    as an Expense would overstate this month and understate the month it is
    actually paid in."""
    make_bill(client, auth_headers, vendor)
    assert db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).count() == 0


def test_a_bill_for_another_clinics_vendor_is_refused(client, auth_headers, db_session):
    from models import Clinic
    other = Clinic(name="Other", address="x", phone="2", email="o@c.com",
                   specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    theirs = Vendor(clinic_id=other.id, name="Rival Supplies")
    db_session.add(theirs)
    db_session.commit()

    r = client.post("/api/v1/purchase-bills", json={
        "vendor_id": theirs.id, "bill_date": TODAY.isoformat(), "amount": 100.0,
    }, headers=auth_headers)
    assert r.status_code == 404


# ── Paying ──────────────────────────────────────────────────────────────────

def test_a_part_payment_reduces_the_outstanding(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                    json={"amount": 1500.0}, headers=auth_headers)
    assert r.status_code == 200, r.text
    after = r.json()
    assert after["paid"] == 1500.0
    assert after["outstanding"] == 2500.0
    assert after["status"] == "partial"


def test_settling_writes_exactly_one_expense(client, auth_headers, vendor,
                                             db_session, test_clinic):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 4000.0, "payment_method": "UPI"}, headers=auth_headers)

    rows = db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).all()
    assert len(rows) == 1
    assert rows[0].amount == 4000.0
    assert rows[0].vendor_id == vendor.id
    assert rows[0].payment_method == "UPI"
    # Categorised from the bill, so the ledger groups it with the rest of that
    # spend rather than dumping every supplier payment under "General".
    assert rows[0].category == "Dental materials"
    assert f"[purchase_bill:{bill['id']}]" in rows[0].notes


def test_two_part_payments_write_two_expenses_and_settle_the_bill(
        client, auth_headers, vendor, db_session, test_clinic):
    bill = make_bill(client, auth_headers, vendor)
    for amount in (2500.0, 1500.0):
        client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                    json={"amount": amount}, headers=auth_headers)

    got = client.get(f"/api/v1/purchase-bills/{bill['id']}", headers=auth_headers).json()
    assert got["status"] == "paid"
    assert got["outstanding"] == 0.0
    assert db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).count() == 2


def test_overpaying_is_refused_rather_than_absorbed(client, auth_headers, vendor):
    """Money in the ledger that no bill accounts for is how a reconciliation
    stops being possible."""
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                    json={"amount": 4500.0}, headers=auth_headers)
    assert r.status_code == 400
    assert "outstanding" in r.json()["detail"]


def test_paying_a_settled_bill_is_refused(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 4000.0}, headers=auth_headers)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                    json={"amount": 1.0}, headers=auth_headers)
    assert r.status_code == 400


def test_reversing_a_payment_removes_its_expense(client, auth_headers, vendor,
                                                 db_session, test_clinic):
    """Leaving it behind keeps money in the ledger for a payment that, as far
    as the supplier is concerned, never happened."""
    bill = make_bill(client, auth_headers, vendor)
    paid = client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                       json={"amount": 4000.0}, headers=auth_headers).json()
    payment_id = paid["payments"][0]["id"]

    r = client.delete(f"/api/v1/purchase-bills/{bill['id']}/payments/{payment_id}",
                      headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["status"] == "unpaid"
    assert r.json()["outstanding"] == 4000.0
    assert db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).count() == 0


def test_paying_from_petty_cash_takes_it_out_of_the_drawer(
        client, auth_headers, vendor, db_session, test_clinic):
    """Otherwise the float silently overstates itself until the next count
    finds it short and nobody can say why."""
    client.post("/api/v1/petty-cash", json={"kind": "top_up", "amount": 5000.0},
                headers=auth_headers)
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 4000.0, "from_petty_cash": True}, headers=auth_headers)

    balance = client.get("/api/v1/petty-cash/balance", headers=auth_headers).json()
    assert balance["balance"] == 1000.0
    spends = db_session.query(PettyCashEntry).filter(
        PettyCashEntry.clinic_id == test_clinic.id, PettyCashEntry.kind == "spend").all()
    assert len(spends) == 1 and spends[0].amount == -4000.0


def test_reversing_a_petty_cash_payment_puts_the_money_back(client, auth_headers, vendor):
    client.post("/api/v1/petty-cash", json={"kind": "top_up", "amount": 5000.0},
                headers=auth_headers)
    bill = make_bill(client, auth_headers, vendor)
    paid = client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                       json={"amount": 4000.0, "from_petty_cash": True},
                       headers=auth_headers).json()
    client.delete(f"/api/v1/purchase-bills/{bill['id']}/payments/{paid['payments'][0]['id']}",
                  headers=auth_headers)

    assert client.get("/api/v1/petty-cash/balance",
                      headers=auth_headers).json()["balance"] == 5000.0


# ── Editing, cancelling ─────────────────────────────────────────────────────

def test_a_bill_cannot_be_cut_below_what_has_been_paid(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 3000.0}, headers=auth_headers)
    r = client.patch(f"/api/v1/purchase-bills/{bill['id']}",
                     json={"amount": 1000.0}, headers=auth_headers)
    assert r.status_code == 400


def test_editing_the_bill_date_moves_the_due_date_with_it(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor, terms_days=30)
    moved = TODAY - datetime.timedelta(days=10)
    r = client.patch(f"/api/v1/purchase-bills/{bill['id']}",
                     json={"bill_date": moved.isoformat()}, headers=auth_headers)
    assert r.json()["due_date"] == (moved + datetime.timedelta(days=30)).isoformat()


def test_a_bill_with_payments_cannot_be_cancelled_or_deleted(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 100.0}, headers=auth_headers)
    assert client.post(f"/api/v1/purchase-bills/{bill['id']}/cancel",
                       headers=auth_headers).status_code == 400
    assert client.delete(f"/api/v1/purchase-bills/{bill['id']}",
                         headers=auth_headers).status_code == 400


# ── Ageing and statements ───────────────────────────────────────────────────

def test_ageing_puts_a_61_day_old_bill_in_61_90(client, auth_headers, vendor):
    old = TODAY - datetime.timedelta(days=61)
    make_bill(client, auth_headers, vendor, bill_date=old.isoformat())
    buckets = {b["bucket"]: b for b in
               client.get("/api/v1/purchase-bills/ageing", headers=auth_headers).json()["buckets"]}
    assert buckets["61-90"]["amount"] == 4000.0
    assert buckets["0-30"]["amount"] == 0.0


def test_ageing_reports_by_vendor_too(client, auth_headers, vendor):
    make_bill(client, auth_headers, vendor)
    data = client.get("/api/v1/purchase-bills/ageing", headers=auth_headers).json()
    assert data["by_vendor"][0]["vendor"] == "Acme Dental Supplies"
    assert data["by_vendor"][0]["outstanding"] == 4000.0


def test_the_vendor_statement_shows_bills_and_payments(client, auth_headers, vendor):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 1000.0, "reference": "CHQ-77"}, headers=auth_headers)

    st = client.get(f"/api/v1/purchase-bills/vendor/{vendor.id}/statement",
                    headers=auth_headers).json()
    assert st["billed_total"] == 4000.0
    assert st["paid_total"] == 1000.0
    assert st["outstanding_total"] == 3000.0
    assert st["bills"][0]["payments"][0]["reference"] == "CHQ-77"


def test_the_statement_flags_a_vendor_over_their_credit_limit(
        client, auth_headers, vendor, db_session):
    vendor.credit_limit = 1000.0
    db_session.commit()
    make_bill(client, auth_headers, vendor)
    st = client.get(f"/api/v1/purchase-bills/vendor/{vendor.id}/statement",
                    headers=auth_headers).json()
    assert st["over_limit"] is True


def test_the_limit_measures_what_is_owed_not_what_was_ever_billed(
        client, auth_headers, vendor, db_session):
    vendor.credit_limit = 1000.0
    db_session.commit()
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 3500.0}, headers=auth_headers)
    st = client.get(f"/api/v1/purchase-bills/vendor/{vendor.id}/statement",
                    headers=auth_headers).json()
    assert st["outstanding_total"] == 500.0
    assert st["over_limit"] is False


# ── The supplier's bill as a file ───────────────────────────────────────────
#
# A PDF or a phone photo of the paper bill. Decided from the bytes, not from
# the filename or Content-Type the client chose, and stored as a storage KEY
# with a signed link handed back — never a presigned URL written to the row.

import io as _io

PDF = b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF"


def _png():
    from PIL import Image
    buf = _io.BytesIO()
    Image.new("RGB", (20, 20), (200, 100, 50)).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def fake_storage(monkeypatch):
    import domains.infrastructure.services.r2_storage as r2
    stored = {}

    def upload(**kw):
        stored["kw"] = kw
        return f"clinics/{kw['clinic_id']}/finance/expenses/{kw['filename']}"

    monkeypatch.setattr(r2, "upload_bytes_to_r2", upload)
    monkeypatch.setattr(r2, "get_presigned_url", lambda k, **kw: f"https://r2.example/{k}?sig=1")
    return stored


def test_a_pdf_bill_can_be_attached(client, auth_headers, vendor, fake_storage, db_session):
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                    files={"file": ("bill.pdf", PDF, "application/pdf")})
    assert r.status_code == 200, r.text
    assert r.json()["has_attachment"] is True
    assert r.json()["bill_file_url"].startswith("https://r2.example/")
    assert fake_storage["kw"]["content_type"] == "application/pdf"

    stored = db_session.query(PurchaseBill).get(bill["id"]).bill_file_url
    assert "sig=" not in stored, "the row must hold the key, not a signed link"


def test_a_photo_of_the_paper_bill_can_be_attached(client, auth_headers, vendor, fake_storage):
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                    files={"file": ("photo.png", _png(), "image/png")})
    assert r.status_code == 200, r.text


def test_the_type_is_decided_by_the_bytes_not_the_name(client, auth_headers, vendor, fake_storage):
    """A renamed executable claims to be bill.pdf just as easily as a bill does."""
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                    files={"file": ("bill.pdf", b"MZ\x90\x00 not a pdf", "application/pdf")})
    assert r.status_code == 400
    assert "PDF or a photo" in r.json()["detail"]


def test_an_oversized_file_is_refused(client, auth_headers, vendor, fake_storage):
    bill = make_bill(client, auth_headers, vendor)
    r = client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                    files={"file": ("big.pdf", PDF + b"x" * (11 * 1024 * 1024), "application/pdf")})
    assert r.status_code == 413


def test_a_payment_carries_the_bill_into_the_ledger(
        client, auth_headers, vendor, fake_storage, db_session, test_clinic):
    """The expense a payment writes opens the supplier's own bill."""
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                files={"file": ("bill.pdf", PDF, "application/pdf")})
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 4000.0}, headers=auth_headers)

    exp = db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).one()
    assert exp.bill_file_url == db_session.query(PurchaseBill).get(bill["id"]).bill_file_url


def test_attaching_after_payment_backfills_the_ledger(
        client, auth_headers, vendor, fake_storage, db_session, test_clinic):
    """The usual order in real life: pay first, find the bill in the email later."""
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/payments",
                json={"amount": 1000.0}, headers=auth_headers)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                files={"file": ("bill.pdf", PDF, "application/pdf")})

    exp = db_session.query(Expense).filter(Expense.clinic_id == test_clinic.id).one()
    assert exp.bill_file_url is not None


def test_the_file_can_be_removed(client, auth_headers, vendor, fake_storage):
    bill = make_bill(client, auth_headers, vendor)
    client.post(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers,
                files={"file": ("bill.pdf", PDF, "application/pdf")})
    r = client.delete(f"/api/v1/purchase-bills/{bill['id']}/attachment", headers=auth_headers)
    assert r.status_code == 200
    assert r.json()["has_attachment"] is False
    assert r.json()["bill_file_url"] is None


def test_another_clinics_bill_cannot_take_an_attachment(
        client, auth_headers, db_session, fake_storage, test_user):
    from models import Clinic
    other = Clinic(name="Other", address="x", phone="2", email="o@c.com",
                   specialization="dental", subscription_plan="free")
    db_session.add(other)
    db_session.commit()
    v = Vendor(clinic_id=other.id, name="Rival")
    db_session.add(v)
    db_session.commit()
    import datetime as _dt
    theirs = PurchaseBill(clinic_id=other.id, vendor_id=v.id, bill_date=_dt.date.today(),
                          due_date=_dt.date.today(), amount=100.0, created_by=test_user.id)
    db_session.add(theirs)
    db_session.commit()

    r = client.post(f"/api/v1/purchase-bills/{theirs.id}/attachment", headers=auth_headers,
                    files={"file": ("bill.pdf", PDF, "application/pdf")})
    assert r.status_code == 404
