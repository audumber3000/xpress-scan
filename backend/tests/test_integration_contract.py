"""Conformance tests for MolarPlus's Integration API.

Runs the real router against a seeded SQLite database. Nothing here touches
production, and nothing needs the SSH tunnel — the point is that the contract's
behaviour is checkable on a laptop and in CI, not only against live data.

The checklist at the end of docs/INTEGRATION_API.md is what this file works
through: cursor pagination that is stable under concurrent writes, an inclusive
`updated_since`, money as integer micros, unknown amounts as null rather than
zero, `mrr` normalised to a month, an account whose `branch_count` matches what
`/branches` returns for it, retired plan names mapped onto the current three,
and actions that are idempotent under replay.

    backend/venv/bin/python -m pytest tests/ -q
"""
import datetime
import os
import sys

import pytest

HERE = os.path.dirname(os.path.abspath(__file__))
BACKEND = os.path.dirname(HERE)
sys.path.insert(0, BACKEND)

# Assigned, not setdefault: a developer with DATABASE_URL exported in their
# shell — the same variable the console reads to reach production — would
# otherwise have these tests build an engine against it at import time. The
# seeded SQLite database below is the only one this file may ever touch.
os.environ["DATABASE_URL"] = "sqlite://"
os.environ["INTEGRATION_TOKENS"] = "crm-sync=full-token"
os.environ["INTEGRATION_READONLY_TOKENS"] = "orchestrator=read-token"

from fastapi import FastAPI                                        # noqa: E402
from fastapi.responses import JSONResponse                         # noqa: E402
from fastapi.testclient import TestClient                          # noqa: E402
from sqlalchemy import create_engine                               # noqa: E402
from sqlalchemy.orm import sessionmaker                            # noqa: E402
from sqlalchemy.pool import StaticPool                             # noqa: E402

import integration                                                 # noqa: E402
from database import get_db                                        # noqa: E402
from integration.wire import ContractError                         # noqa: E402
from models import (Appointment, Base, Clinic, Invoice, Patient,   # noqa: E402
                    Subscription, SubscriptionPayment, User)
from integration.leads import GrowthLead                            # noqa: E402

FULL = {"Authorization": "Bearer full-token"}
READONLY = {"Authorization": "Bearer read-token"}

NOW = datetime.datetime(2026, 9, 5, 12, 0, 0)
LAST_YEAR = NOW - datetime.timedelta(days=365)
NEXT_MONTH = NOW + datetime.timedelta(days=30)


@pytest.fixture()
def db_session():
    engine = create_engine(
        "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool,
    )
    # Only the tables the contract reads. The product's full schema contains
    # Postgres-specific types that SQLite cannot create, and building all of it
    # would make this suite fail for reasons that have nothing to do with the
    # contract.
    Base.metadata.create_all(engine, tables=[
        Clinic.__table__, User.__table__, Subscription.__table__,
        SubscriptionPayment.__table__, Patient.__table__,
        Appointment.__table__, Invoice.__table__, GrowthLead.__table__,
    ])
    # The idempotency ledger and audit log the actions write to. Created the
    # same way the app creates them at boot, so the tests exercise the real
    # path rather than a hand-built copy.
    from integration.store import ensure_tables
    ensure_tables(engine)
    Session = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = Session()
    _seed(session)
    try:
        yield session
    finally:
        session.close()


@pytest.fixture()
def client(db_session):
    app = FastAPI()
    app.include_router(integration.router, prefix=integration.PREFIX)

    @app.exception_handler(ContractError)
    def _contract_error(request, exc):
        return JSONResponse(status_code=exc.status, content=exc.body())

    app.dependency_overrides[get_db] = lambda: db_session
    return TestClient(app)


def _clinic(session, clinic_id, name, **kw):
    defaults = dict(
        clinic_code="CLN-{}".format(clinic_id), status="active", country="IN",
        currency_code="INR", timezone="Asia/Kolkata",
        created_at=LAST_YEAR, updated_at=NOW - datetime.timedelta(days=clinic_id),
        subscription_plan="plus",
    )
    defaults.update(kw)
    row = Clinic(id=clinic_id, name=name, **defaults)
    session.add(row)
    return row


def _seed(session):
    """A three-branch group, a standalone US clinic, and an orphan.

    The orphan — `parent_clinic_id` pointing at a clinic that no longer exists
    — is not a contrivance. Clinics are hard-deleted, so a group whose parent
    was removed leaves its children pointing nowhere, and a child that belongs
    to no account would silently vanish from the CRM.
    """
    _clinic(session, 1, "Smile Dental Care", tax_id="27AAAPZ1234C1ZV",
            address_line1="12 MG Road", city="Pune", state="Maharashtra",
            postal_code="411001", email="owner@smiledental.in", phone="+919876543210")
    _clinic(session, 2, "Smile Dental — Kothrud", parent_clinic_id=1)
    _clinic(session, 3, "Smile Dental — Baner", parent_clinic_id=1)
    _clinic(session, 4, "Bright Smiles", country="US", currency_code="USD",
            timezone="America/New_York", address="500 Market St")
    _clinic(session, 5, "Orphaned Practice", parent_clinic_id=999)

    # A pipeline: one prospect with no clinic yet, one trial that already has
    # one, and a lead whose stage was typed by hand into a free-text column.
    session.add_all([
        GrowthLead(id=1, lead_name="Nagpur Dental Studio", contact_person="Dr Rao",
                   email="rao@example.in", phone="+919000000001", source="referral",
                   stage="demo_scheduled", owner="Anita", priority="high",
                   expected_mrr=999.0, next_follow_up_at=NOW + datetime.timedelta(days=2),
                   last_contact_at=NOW - datetime.timedelta(days=3),
                   created_at=LAST_YEAR, updated_at=NOW),
        GrowthLead(id=2, clinic_id=2, lead_name="Smile Dental — Kothrud",
                   contact_person="Priya", stage="trial_active", expected_mrr=399.0,
                   created_at=LAST_YEAR, updated_at=NOW),
        GrowthLead(id=3, lead_name="Typo Lead", stage="Demo Done ",
                   created_at=LAST_YEAR, updated_at=NOW),
    ])

    session.add_all([
        User(id=10, clinic_id=1, role="clinic_owner", is_active=True, first_name="Priya",
             last_name="Sharma", name="Priya Sharma", email="priya@smiledental.in"),
        # A second owner row, from a handover. The API must pick one and keep
        # picking the same one, or the CRM's Person record flickers.
        User(id=11, clinic_id=1, role="clinic_owner", is_active=True, first_name="Rahul",
             last_name="Desai", name="Rahul Desai", email="rahul@smiledental.in"),
        User(id=12, clinic_id=4, role="clinic_owner", is_active=True, first_name="Dana",
             last_name="Cole", name="Dana Cole", email="dana@brightsmiles.com"),
    ])

    session.add_all([
        Subscription(id=100, clinic_id=1, plan_name="pro", status="active",
                     provider="cashfree", provider_subscription_id="sub_9f2a",
                     current_start=NOW - datetime.timedelta(days=5), current_end=NEXT_MONTH,
                     quantity=1, is_trial=False, created_at=LAST_YEAR, updated_at=NOW),
        # A branch carrying its own subscription from before it joined the
        # group. Its MRR is real and must not disappear.
        Subscription(id=101, clinic_id=2, plan_name="plus_annual", status="active",
                     provider="razorpay", current_start=NOW, current_end=NEXT_MONTH,
                     quantity=1, is_trial=False, created_at=LAST_YEAR, updated_at=NOW),
        # A retired plan name still sitting in production.
        Subscription(id=102, clinic_id=4, plan_name="professional_annual", status="active",
                     provider="stripe", current_start=NOW, current_end=NEXT_MONTH,
                     quantity=1, is_trial=False, created_at=LAST_YEAR, updated_at=NOW),
        Subscription(id=103, clinic_id=5, plan_name="pro", status="active",
                     provider="manual", current_start=NOW, current_end=NEXT_MONTH,
                     quantity=1, is_trial=True, trial_ends_at=NOW + datetime.timedelta(days=7),
                     created_at=NOW, updated_at=NOW),
    ])

    session.add_all([
        SubscriptionPayment(id=200, clinic_id=1, subscription_id=100, provider="cashfree",
                            plan_name="pro", amount=1178.82, tax_amount=179.82,
                            currency="INR", status="paid", paid_at=NOW,
                            provider_payment_id="pay_4b1c", provider_order_id="ord_88e2",
                            created_at=NOW),
        # Predates the tax and discount columns. NULL means unknown, and the
        # contract forbids tidying it to zero.
        SubscriptionPayment(id=201, clinic_id=1, subscription_id=100, provider="razorpay",
                            plan_name="professional", amount=899.0, tax_amount=None,
                            discount_amount=None, currency="INR", status="paid",
                            paid_at=LAST_YEAR, created_at=LAST_YEAR),
        SubscriptionPayment(id=202, clinic_id=4, subscription_id=102, provider="stripe",
                            plan_name="professional_annual", amount=77.0, currency="USD",
                            status="paid", paid_at=NOW, created_at=NOW),
    ])

    # End-customer volume, per site. Only counts and sums ever leave the API.
    for clinic_id, patients, appointments, invoice_total in ((1, 3, 2, 5000.0),
                                                             (2, 2, 1, 2500.0),
                                                             (3, 1, 1, 1000.0)):
        for n in range(patients):
            session.add(Patient(clinic_id=clinic_id, name="P{}-{}".format(clinic_id, n),
                                phone="9", payment_type="cash",
                                created_at=NOW - datetime.timedelta(days=n)))
        for n in range(appointments):
            # start_time, end_time and duration are NOT NULL in the product's
            # schema. The contract never reads them — only the row count and
            # created_at — but the row still has to be creatable.
            session.add(Appointment(clinic_id=clinic_id, patient_name="P", status="completed",
                                    appointment_date=NOW, start_time="10:00",
                                    end_time="10:30", duration=30, created_at=NOW))
        session.add(Invoice(clinic_id=clinic_id, patient_id=1,
                            invoice_number="INV-{}".format(clinic_id),
                            status="paid_verified", total=invoice_total,
                            created_at=NOW - datetime.timedelta(days=2),
                            finalized_at=NOW - datetime.timedelta(days=2)))
    # Never billed, so never GMV.
    session.add(Invoice(clinic_id=1, patient_id=1, invoice_number="INV-DRAFT",
                        status="draft", total=9999.0,
                        created_at=NOW, finalized_at=None))
    session.commit()


def get(client, path, **params):
    response = client.get(integration.PREFIX + path, headers=FULL, params=params)
    assert response.status_code == 200, response.text
    return response.json()


# ── Auth ─────────────────────────────────────────────────────────────────────

def test_missing_token_is_401(client):
    assert client.get(integration.PREFIX + "/accounts").status_code == 401


def test_wrong_token_is_401(client):
    response = client.get(integration.PREFIX + "/accounts",
                          headers={"Authorization": "Bearer nope"})
    assert response.status_code == 401
    assert response.json()["error"]["code"] == "unauthenticated"


def test_readonly_token_reads_but_cannot_act(client):
    assert client.get(integration.PREFIX + "/accounts", headers=READONLY).status_code == 200
    response = client.post(integration.PREFIX + "/accounts/clinic:1/suspend",
                           headers=READONLY, json={"reason": "test"})
    assert response.status_code == 403
    assert response.json()["error"]["code"] == "insufficient_scope"


# ── Meta ─────────────────────────────────────────────────────────────────────

def test_meta_declares_what_is_built(client):
    meta = get(client, "/meta")
    assert meta["product_code"] == "molarplus"
    assert meta["contract_version"] == "1.0"
    caps = meta["capabilities"]
    assert caps["accounts"] and caps["subscriptions"] and caps["payments"]
    assert caps["tickets"] is False          # Phase 4
    assert caps["deletions"] is False        # MolarPlus hard-deletes


def test_tickets_answers_in_the_contract_envelope(client):
    response = client.get(integration.PREFIX + "/tickets", headers=FULL)
    assert response.status_code == 501
    assert response.json()["error"]["code"] == "not_implemented"


# ── Accounts and the parent-clinic shim ──────────────────────────────────────

def test_accounts_are_organisations_not_sites(client):
    data = get(client, "/accounts")["data"]
    by_id = dict((a["id"], a) for a in data)
    # Clinics 2 and 3 are branches of 1; 1, 4 and 5 are accounts.
    assert sorted(by_id) == ["clinic:1", "clinic:4", "clinic:5"]
    assert by_id["clinic:1"]["branch_count"] == 3
    assert by_id["clinic:4"]["branch_count"] == 1


def test_orphaned_clinic_is_its_own_account(client):
    """A clinic whose parent was deleted must not vanish from the CRM."""
    assert "clinic:5" in [a["id"] for a in get(client, "/accounts")["data"]]


def test_account_carries_contract_fields(client):
    account = get(client, "/accounts/clinic:1")
    assert account["name"] == "Smile Dental Care"
    assert account["status"] == "active"
    assert account["currency"] == "INR"
    assert account["tax_id"] == "27AAAPZ1234C1ZV"
    assert account["address"] == {
        "street": "12 MG Road", "city": "Pune", "state": "Maharashtra",
        "postcode": "411001", "country_code": "IN",
    }
    assert account["owner"]["email"] == "priya@smiledental.in"   # lowest id wins
    assert account["updated_at"].endswith("Z")
    assert account["deleted"] is False


def test_trial_subscription_makes_the_account_a_trial(client):
    assert get(client, "/accounts/clinic:5")["status"] == "trial"


def test_branch_id_is_not_an_account_id(client):
    """`clinic:2` is a branch. Asking for it as an account is a 404, not a
    silently wrong answer about its parent."""
    response = client.get(integration.PREFIX + "/accounts/clinic:2", headers=FULL)
    assert response.status_code == 404


def test_bare_numeric_account_id_is_rejected(client):
    """Accepting "1" as well as "clinic:1" would work today and become a silent
    mis-match the day account ids stop being clinic ids."""
    assert client.get(integration.PREFIX + "/accounts/1", headers=FULL).status_code == 404


# ── Pagination ───────────────────────────────────────────────────────────────

def test_cursor_pagination_walks_every_account_exactly_once(client):
    seen, cursor, pages = [], None, 0
    while True:
        params = {"limit": 1}
        if cursor:
            params["cursor"] = cursor
        body = get(client, "/accounts", **params)
        seen.extend(a["id"] for a in body["data"])
        pages += 1
        if not body["has_more"]:
            assert body["next_cursor"] is None
            break
        cursor = body["next_cursor"]
        assert cursor
        assert pages < 10, "pagination did not terminate"
    assert sorted(seen) == ["clinic:1", "clinic:4", "clinic:5"]
    assert len(seen) == len(set(seen))


def test_a_bad_cursor_is_a_400_not_an_empty_page(client):
    response = client.get(integration.PREFIX + "/accounts", headers=FULL,
                          params={"cursor": "not-a-cursor"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_cursor"


def test_a_bad_updated_since_is_a_400(client):
    """Treating it as absent would return a full snapshot where a delta was
    asked for, and the caller could not tell."""
    response = client.get(integration.PREFIX + "/accounts", headers=FULL,
                          params={"updated_since": "yesterday"})
    assert response.status_code == 400
    assert response.json()["error"]["code"] == "bad_timestamp"


# ── updated_since ────────────────────────────────────────────────────────────

def test_updated_since_is_inclusive(client, db_session):
    account = get(client, "/accounts/clinic:1")
    body = get(client, "/accounts", updated_since=account["updated_at"])
    assert "clinic:1" in [a["id"] for a in body["data"]]


def test_editing_a_branch_brings_its_account_back(client, db_session):
    """The account's `updated_at` is the newest change anywhere in the group.

    Renaming a branch changes what `/branches` returns for the account, so an
    account whose timestamp did not move would leave the CRM showing the old
    branch forever.
    """
    later = NOW + datetime.timedelta(hours=1)
    branch = db_session.query(Clinic).filter(Clinic.id == 3).first()
    branch.name = "Smile Dental — Baner (renamed)"
    branch.updated_at = later
    db_session.commit()

    body = get(client, "/accounts", updated_since=later.strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert [a["id"] for a in body["data"]] == ["clinic:1"]


def test_an_edit_one_second_ago_is_visible(client, db_session):
    """The real test that `updated_at` moves on write, per the checklist."""
    clinic = db_session.query(Clinic).filter(Clinic.id == 4).first()
    clinic.phone = "+1 555 0100"
    db_session.commit()          # onupdate fires here
    db_session.refresh(clinic)
    one_second_earlier = clinic.updated_at - datetime.timedelta(seconds=1)
    body = get(client, "/accounts",
               updated_since=one_second_earlier.strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert "clinic:4" in [a["id"] for a in body["data"]]


# ── Branches ─────────────────────────────────────────────────────────────────

def test_every_clinic_is_a_branch_of_exactly_one_account(client):
    branches = get(client, "/branches")["data"]
    assert len(branches) == 5
    owner_of = dict((b["id"], b["account_id"]) for b in branches)
    assert owner_of == {"1": "clinic:1", "2": "clinic:1", "3": "clinic:1",
                        "4": "clinic:4", "5": "clinic:5"}


def test_branch_count_matches_what_branches_returns(client):
    account = get(client, "/accounts/clinic:1")
    branches = get(client, "/branches", account_id="clinic:1")["data"]
    assert account["branch_count"] == len(branches) == 3


def test_branch_carries_its_own_numbers(client):
    branches = dict((b["id"], b) for b in get(client, "/branches")["data"])
    assert branches["1"]["end_customer_count"] == 3
    assert branches["2"]["end_customer_count"] == 2
    assert branches["3"]["transaction_count"] == 1
    assert branches["1"]["monthly_gmv"] == {"amount_micros": 5000000000, "currency": "INR"}
    assert branches["1"]["code"] == "CLN-1"


# ── Stats ────────────────────────────────────────────────────────────────────

def test_account_stats_equal_the_sum_of_its_branches(client):
    stats = get(client, "/accounts/clinic:1/stats")
    branches = get(client, "/branches", account_id="clinic:1")["data"]
    assert stats["end_customer_count"] == sum(b["end_customer_count"] for b in branches) == 6
    assert stats["transaction_count"] == sum(b["transaction_count"] for b in branches) == 4
    assert stats["monthly_gmv"]["amount_micros"] == sum(
        b["monthly_gmv"]["amount_micros"] for b in branches)
    assert stats["as_of"].endswith("Z")


def test_draft_invoices_are_not_gmv(client):
    """An invoice that was never issued is not money the clinic billed."""
    stats = get(client, "/accounts/clinic:1/stats")
    assert stats["monthly_gmv"]["amount_micros"] == 8500000000   # 5000 + 2500 + 1000


# ── Subscriptions ────────────────────────────────────────────────────────────

def test_monthly_plan_reports_its_own_price(client):
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    pro = subs["100"]
    assert pro["plan_tier"] == "pro"
    assert pro["billing_cycle"] == "monthly"
    assert pro["mrr"] == {"amount_micros": 999000000, "currency": "INR"}
    assert pro["branch_limit"] == 5 and pro["staff_limit"] == 10


def test_annual_plan_is_normalised_to_a_month(client):
    """Reporting the annual total would inflate group MRR twelvefold."""
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    plus_annual = subs["101"]
    assert plus_annual["billing_cycle"] == "annual"
    assert plus_annual["mrr"]["amount_micros"] == round(3830 * 1_000_000 / 12)


def test_growth_plan_reports_unlimited_as_null_not_zero(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 100).first().plan_name = "growth"
    db_session.commit()
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    assert subs["100"]["branch_limit"] is None
    assert subs["100"]["staff_limit"] is None


def test_retired_plan_names_never_reach_the_crm(client):
    """Production still holds `professional_annual`. The CRM must not see it."""
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    legacy = subs["102"]
    assert legacy["plan_tier"] == "pro"
    assert legacy["plan_code"] == "pro_annual"
    assert legacy["billing_cycle"] == "annual"
    assert legacy["plan_name"] == "MolarPlus Pro"


def test_plan_tier_is_only_ever_one_of_three(client):
    tiers = set(s["plan_tier"] for s in get(client, "/subscriptions")["data"])
    assert tiers <= {"plus", "pro", "growth"}


def test_a_us_account_is_priced_in_dollars(client):
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    assert subs["102"]["mrr"]["currency"] == "USD"
    assert subs["102"]["mrr"]["amount_micros"] == round(77 * 1_000_000 / 12)


def test_a_trial_has_no_mrr(client):
    """A trial pays nothing. Reporting the list price of the plan attached to it
    is how a pipeline number ends up on a revenue chart."""
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    trial = subs["103"]
    assert trial["status"] == "trial"
    assert trial["is_trial"] is True
    assert trial["mrr"]["amount_micros"] == 0
    assert trial["trial_ends_at"].endswith("Z")


def test_a_branch_subscription_belongs_to_the_account(client):
    """Dropping it would delete real MRR from the CRM's totals."""
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    assert subs["101"]["account_id"] == "clinic:1"


def test_effective_tier_shows_a_lapse(client, db_session):
    """A lapsed account is a win-back target, not a churned one — so what they
    bought and what they may use are reported separately."""
    sub = db_session.query(Subscription).filter(Subscription.id == 100).first()
    sub.current_end = NOW - datetime.timedelta(days=1)
    sub.status = "expired"
    db_session.commit()
    subs = dict((s["id"], s) for s in get(client, "/subscriptions")["data"])
    assert subs["100"]["plan_tier"] == "pro"          # what they bought
    assert subs["100"]["effective_tier"] == "plus"    # what they may use
    assert subs["100"]["status"] == "expired"
    assert subs["100"]["mrr"]["amount_micros"] == 0


def test_subscriptions_filter_by_account(client):
    subs = get(client, "/subscriptions", account_id="clinic:1")["data"]
    assert sorted(s["id"] for s in subs) == ["100", "101"]


# ── Payments ─────────────────────────────────────────────────────────────────

def test_payment_amounts_are_integer_micros(client):
    payments = dict((p["id"], p) for p in get(client, "/payments")["data"])
    assert payments["200"]["amount"] == {"amount_micros": 1178820000, "currency": "INR"}
    assert payments["200"]["tax_amount"] == {"amount_micros": 179820000, "currency": "INR"}


def test_unknown_tax_stays_null(client):
    """Sending 0 would turn "never recorded" into "there was no tax", and every
    net-revenue figure downstream would inherit the error permanently."""
    payments = dict((p["id"], p) for p in get(client, "/payments")["data"])
    assert payments["201"]["tax_amount"] is None
    assert payments["201"]["discount_amount"] is None


def test_payments_carry_their_account_and_provider(client):
    payments = dict((p["id"], p) for p in get(client, "/payments")["data"])
    assert payments["200"]["account_id"] == "clinic:1"
    assert payments["200"]["provider"] == "cashfree"
    assert payments["202"]["account_id"] == "clinic:4"


def test_paid_after_filters(client):
    recent = get(client, "/payments", paid_after="2026-01-01T00:00:00Z")["data"]
    assert sorted(p["id"] for p in recent) == ["200", "202"]


# ── Actions ──────────────────────────────────────────────────────────────────

def test_patch_updates_contact_details_and_returns_the_account(client):
    response = client.patch(
        integration.PREFIX + "/accounts/clinic:1", headers=FULL,
        json={"phone": "+919000000000", "address": {"city": "Mumbai"}},
    )
    assert response.status_code == 200, response.text
    account = response.json()
    assert account["phone"] == "+919000000000"
    assert account["address"]["city"] == "Mumbai"
    assert account["address"]["street"] == "12 MG Road"   # untouched


def test_patch_writes_an_audit_row(client, db_session):
    from integration.store import IntegrationAuditLog
    client.patch(integration.PREFIX + "/accounts/clinic:1", headers=FULL,
                 json={"name": "Smile Dental Group"})
    row = db_session.query(IntegrationAuditLog).filter(
        IntegrationAuditLog.action == "update_contact").first()
    assert row.caller == "crm-sync"
    assert row.before["name"] == "Smile Dental Care"
    assert row.after["name"] == "Smile Dental Group"


def test_change_plan_moves_both_columns(client, db_session):
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=FULL,
                           json={"plan_code": "growth", "reason": "Upgraded on a call"})
    assert response.status_code == 200, response.text
    subscription = response.json()
    assert subscription["plan_tier"] == "growth"
    assert subscription["mrr"]["amount_micros"] == 1500000000
    # What was bought and what may be used both move, or the header says one
    # thing and the subscription page another.
    assert db_session.query(Clinic).filter(Clinic.id == 1).first().subscription_plan == "growth"


def test_change_plan_flags_a_mandate_it_did_not_touch(client):
    """The admin override does not re-price the Cashfree mandate, so the
    customer keeps paying the old amount until they re-authorise."""
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=FULL,
                           json={"plan_code": "growth"})
    assert response.headers["X-MolarPlus-Provider-Mandate"] == "stale"


def test_unknown_plan_code_is_422(client):
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=FULL,
                           json={"plan_code": "platinum"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_plan_code"


def test_next_cycle_is_refused_rather_than_faked(client):
    """MolarPlus has no pending-plan column. Pretending to defer a change that
    actually applies now would be worse than refusing it."""
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=FULL,
                           json={"plan_code": "growth", "effective": "next_cycle"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "effective_not_supported"


def test_account_without_a_subscription_is_409(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 100).delete()
    db_session.commit()
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=FULL,
                           json={"plan_code": "pro"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "no_subscription"


def test_suspend_requires_a_reason(client):
    response = client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                           json={})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "reason_required"


def test_suspend_reaches_every_branch(client, db_session):
    """Suspending the parent alone leaves every branch of a group still
    working, which is not what "suspend this account" means."""
    response = client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                           json={"reason": "Non-payment, 45 days overdue"})
    assert response.status_code == 200
    assert response.json()["status"] == "suspended"
    statuses = [c.status for c in db_session.query(Clinic).filter(Clinic.id.in_([1, 2, 3])).all()]
    assert statuses == ["suspended"] * 3


def test_suspending_a_suspended_account_is_409(client):
    client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                json={"reason": "first"})
    response = client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                           json={"reason": "second"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "already_suspended"


def test_activate_restores_the_group(client, db_session):
    client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                json={"reason": "Non-payment"})
    response = client.post(integration.PREFIX + "/accounts/clinic:1/activate", headers=FULL,
                           json={"reason": "Paid"})
    assert response.status_code == 200
    assert response.json()["status"] == "active"
    statuses = [c.status for c in db_session.query(Clinic).filter(Clinic.id.in_([1, 2, 3])).all()]
    assert statuses == ["active"] * 3


def test_suspend_reason_is_recorded(client, db_session):
    from integration.store import IntegrationAuditLog
    client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=FULL,
                json={"reason": "Non-payment, 45 days overdue"})
    row = db_session.query(IntegrationAuditLog).filter(
        IntegrationAuditLog.action == "suspend").first()
    assert row.reason == "Non-payment, 45 days overdue"
    assert sorted(row.after["clinics_changed"]) == [1, 2, 3]


# ── Idempotency ──────────────────────────────────────────────────────────────

def test_replaying_a_key_does_not_repeat_the_side_effect(client, db_session):
    key = {"Idempotency-Key": "11111111-1111-1111-1111-111111111111"}
    headers = dict(FULL, **key)
    body = {"plan_code": "growth", "reason": "Upgraded on a call"}

    first = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers, json=body)
    assert first.status_code == 200
    db_session.query(Clinic).filter(Clinic.id == 1).first().subscription_plan = "plus"
    db_session.commit()

    second = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers, json=body)
    assert second.status_code == 200
    assert second.json() == first.json()
    # The stored response came back without the write running again.
    assert db_session.query(Clinic).filter(Clinic.id == 1).first().subscription_plan == "plus"


def test_a_key_reused_for_a_different_request_is_409(client):
    """Silently answering the wrong question is worse than having no
    idempotency at all."""
    headers = dict(FULL, **{"Idempotency-Key": "22222222-2222-2222-2222-222222222222"})
    client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers,
                json={"plan_code": "growth"})
    response = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers,
                           json={"plan_code": "plus"})
    assert response.status_code == 409
    assert response.json()["error"]["code"] == "idempotency_key_reused"


def test_suspend_is_idempotent_under_replay(client):
    headers = dict(FULL, **{"Idempotency-Key": "33333333-3333-3333-3333-333333333333"})
    body = {"reason": "Non-payment"}
    first = client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=headers, json=body)
    second = client.post(integration.PREFIX + "/accounts/clinic:1/suspend", headers=headers, json=body)
    assert first.status_code == second.status_code == 200
    assert first.json() == second.json()


# ── The hard rule ────────────────────────────────────────────────────────────

def test_no_endpoint_returns_an_end_customer_record(client):
    """Patient data is health data. The contract has no endpoint that returns
    it, and adding one is not a change to make later."""
    import json
    for path in ("/accounts", "/branches", "/subscriptions", "/payments"):
        body = json.dumps(get(client, path))
        for name in ("P1-0", "P2-0", "P3-0"):
            assert name not in body, "{} leaked a patient name".format(path)
    stats = json.dumps(get(client, "/accounts/clinic:1/stats"))
    assert "P1-0" not in stats


def test_replay_returns_the_original_headers_too(client):
    """The mandate warning was true of the first call. Recomputing it on replay
    would answer about the state after the change, not the state the caller was
    told about."""
    headers = dict(FULL, **{"Idempotency-Key": "44444444-4444-4444-4444-444444444444"})
    body = {"plan_code": "growth"}
    first = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers, json=body)
    second = client.post(integration.PREFIX + "/accounts/clinic:1/plan", headers=headers, json=body)
    assert first.headers["X-MolarPlus-Provider-Mandate"] == "stale"
    assert second.headers["X-MolarPlus-Provider-Mandate"] == "stale"


def test_actions_without_a_key_still_work(client):
    """`Idempotency-Key` is optional by contract."""
    response = client.patch(integration.PREFIX + "/accounts/clinic:1", headers=FULL,
                            json={"phone": "+919111111111"})
    assert response.status_code == 200
    assert response.json()["phone"] == "+919111111111"


# ── Leads ────────────────────────────────────────────────────────────────────

def test_leads_are_listed(client):
    body = client.get("/integration/v1/leads", headers=READONLY).json()
    assert [row["name"] for row in body["data"]] == [
        "Nagpur Dental Studio", "Smile Dental — Kothrud", "Typo Lead"]


def test_a_prospect_has_no_account_yet(client):
    """The normal case before a trial: there is no clinic to point at."""
    body = client.get("/integration/v1/leads", headers=READONLY).json()
    prospect = next(r for r in body["data"] if r["id"] == "1")
    assert prospect["account_id"] is None


def test_a_lead_on_a_branch_reports_the_group_account(client):
    """Clinic 2 is a branch of the group rooted at clinic 1, and the CRM keys
    everything on the organisation rather than the site."""
    body = client.get("/integration/v1/leads", headers=READONLY).json()
    trial = next(r for r in body["data"] if r["id"] == "2")
    assert trial["account_id"] == "clinic:1"


def test_an_unrecognised_stage_falls_back_rather_than_escaping(client):
    """`growth_leads.stage` is free text, so a typo has always been able to
    invent a stage. The CRM's field is a real SELECT and would reject the whole
    record, so the contract reports a value inside the enum."""
    body = client.get("/integration/v1/leads", headers=READONLY).json()
    typo = next(r for r in body["data"] if r["id"] == "3")
    assert typo["stage"] == "new_lead"


def test_expected_mrr_is_money_not_a_float(client):
    body = client.get("/integration/v1/leads", headers=READONLY).json()
    lead = next(r for r in body["data"] if r["id"] == "1")
    assert lead["expected_mrr"] == {"amount_micros": 999000000, "currency": "INR"}


def test_leads_paginate_like_every_other_list(client):
    first = client.get("/integration/v1/leads?limit=2", headers=READONLY).json()
    assert first["has_more"] is True and len(first["data"]) == 2
    second = client.get(
        "/integration/v1/leads?limit=2&cursor=%s" % first["next_cursor"],
        headers=READONLY).json()
    assert [r["id"] for r in second["data"]] == ["3"]


def test_meta_declares_leads(client):
    body = client.get("/integration/v1/meta", headers=READONLY).json()
    assert body["capabilities"]["leads"] is True
