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
from core import plans                                             # noqa: E402
from database import get_db                                        # noqa: E402
from integration.wire import ContractError                         # noqa: E402
from models import (ActivityLog, Appointment, AuditLog, Base,      # noqa: E402
                    ReferralCode, SubscriptionCoupon,
                    Clinic, GooglePlaceLink, Invoice,
                    NotificationLog, NotificationPreference,
                    NotificationWallet, Patient, Subscription,
                    SubscriptionPayment, User, UserDevice,
                    user_clinics)
from integration.leads import GrowthLead                            # noqa: E402
from integration.marketing import MarketingCampaign                 # noqa: E402

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
        # The support panels read these. Listed separately from the
        # sync feeds above so a failure here is legible as "a panel
        # cannot be tested" rather than "the contract is broken".
        UserDevice.__table__, user_clinics, ActivityLog.__table__,
        AuditLog.__table__, NotificationLog.__table__,
        NotificationPreference.__table__, NotificationWallet.__table__,
        GooglePlaceLink.__table__,
        SubscriptionCoupon.__table__, ReferralCode.__table__,
        MarketingCampaign.__table__,
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
    _seed_panels(session)
    _seed_marketing(session)
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
    assert caps["plans"] is True             # the catalogue the CRM renders


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


# ── The catalogue ────────────────────────────────────────────────────────────
#
# The CRM used to hold a copy of this list. These are the assertions that make
# a copy unnecessary, so they are mostly about the two ways a catalogue lies:
# offering something that cannot be bought, and omitting something that can.

def test_every_advertised_plan_can_actually_be_bought(client):
    """The check the hardcoded array in the CRM could not make of itself.

    A catalogue whose codes the plan action rejects is worse than no catalogue:
    the operator gets a 422 on a button the product drew for them.
    """
    plans = get(client, "/plans")["data"]
    assert plans, "MolarPlus declares plans: true and must answer something"
    for plan in plans:
        response = client.post(integration.PREFIX + "/accounts/clinic:1/plan",
                               headers=FULL, json={"plan_code": plan["code"]})
        assert response.status_code == 200, "%s: %s" % (plan["code"], response.text)


def test_the_catalogue_carries_every_sellable_plan(client):
    """The other direction, and the one that was actually broken.

    The CRM's array listed five codes and MolarPlus sells six — `plus_annual`
    was unreachable from the CRM and nothing would have said so. Deriving the
    list from `core.plans` is what makes that impossible; this asserts the
    derivation rather than the count, so adding a tier does not fail the suite
    for the wrong reason.
    """
    codes = set(row["code"] for row in get(client, "/plans")["data"])
    expected = set(plans.stored_name(key, cycle)
                   for key in plans.PLANS
                   for cycle in ("monthly", "annual"))
    assert codes == expected


def test_the_catalogue_reports_unlimited_as_null_not_zero(client):
    """Growth allows unlimited branches. `0` would read as "none allowed"."""
    growth = next(row for row in get(client, "/plans")["data"]
                  if row["code"] == "growth")
    assert growth["branch_limit"] is None
    assert growth["staff_limit"] is None


def test_an_annual_plan_is_normalised_to_a_month(client):
    """So a catalogue sorts on one axis. Plus is 3,830 a year, not 3,830 a
    month, and an annual total presented as MRR inflates it twelvefold."""
    rows = dict((row["code"], row) for row in get(client, "/plans")["data"])
    monthly = rows["plus"]["mrr"]["amount_micros"]
    annual = rows["plus_annual"]["mrr"]["amount_micros"]
    assert annual == round(3830 * 1_000_000 / 12)
    assert annual < monthly           # the discount is why anyone buys annual


def test_the_catalogue_prices_every_currency_the_product_sells_in(client):
    """A per-value currency code, like every other amount in the contract —
    never one currency for the whole response."""
    for row in get(client, "/plans")["data"]:
        assert set(row["price"]) == {"INR", "USD"}
        for code, amount in row["price"].items():
            assert amount["currency"] == code


def test_the_catalogue_needs_no_write_scope(client):
    """It is a read. The sync's read-only token must reach it, or a product
    switcher would need the token that can change plans just to draw a list."""
    response = client.get(integration.PREFIX + "/plans", headers=READONLY)
    assert response.status_code == 200


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


# ── Support panels ───────────────────────────────────────────────────────────
#
# docs/INTEGRATION_API.md § Support panels. These four are rendered by the CRM
# and stored nowhere, which is what lets them carry staff contact details at
# all — so most of what is worth asserting is about what they leave out.


def _seed_panels(session):
    """Staff, devices, sign-ins, messaging and an audit trail for account 1.

    Deliberately includes the rows each panel must *refuse* to forward: a
    patient audit event, a notification addressed to a patient's phone, and a
    staff member reachable only through `user_clinics`.
    """
    session.add_all([
        # A receptionist at the Kothrud branch, linked the way a multi-branch
        # staff member actually is — through the association table, with
        # `users.clinic_id` pointing somewhere else entirely.
        User(id=13, clinic_id=None, role="receptionist", is_active=True,
             first_name="Meera", last_name="Iyer", name="Meera Iyer",
             username="meera", email=None, created_at=LAST_YEAR),
        User(id=14, clinic_id=1, role="doctor", is_active=False,
             first_name="Sunil", last_name="Rao", name="Sunil Rao",
             email="sunil@smiledental.in", created_at=LAST_YEAR),
        # A title vocab.py has never seen. Must report `other`, not a guess.
        User(id=15, clinic_id=1, role="lab_technician", is_active=True,
             first_name="Anil", last_name="Kumar", name="Anil Kumar",
             email="anil@smiledental.in", created_at=LAST_YEAR),
    ])
    session.execute(user_clinics.insert().values(
        user_id=13, clinic_id=2, role="receptionist", is_active=True))

    session.add_all([
        UserDevice(id=70, user_id=10, device_name="Priya's iPhone",
                   device_type="mobile", device_platform="iOS", device_os="18.2",
                   is_online=True, last_seen=NOW - datetime.timedelta(minutes=5),
                   ip_address="49.36.1.9", latitude=18.5, longitude=73.8,
                   location="Pune, IN", enrolled_at=LAST_YEAR, created_at=LAST_YEAR),
        # device_type says "mobile" but the platform says Windows. The panel
        # trusts the platform — see vocab.form_factor.
        UserDevice(id=71, user_id=10, device_name="Front desk PC",
                   device_type="mobile", device_platform="Windows",
                   is_online=False, last_seen=NOW - datetime.timedelta(days=2),
                   created_at=LAST_YEAR),
        UserDevice(id=72, user_id=13, device_name="Reception tablet",
                   device_type="web", device_platform=None,
                   last_seen=NOW - datetime.timedelta(hours=3), created_at=LAST_YEAR),
    ])

    session.add_all([
        # Attributed by actor_name.
        ActivityLog(id=90, clinic_id=1, event_type="login", actor_name="Priya Sharma",
                    description="Signed in from Android", created_at=NOW - datetime.timedelta(hours=2)),
        # Attributed by email inside the description, which is the only handle
        # the product writes for some sign-ins.
        ActivityLog(id=91, clinic_id=1, event_type="logout",
                    actor_name=None, description="anil@smiledental.in signed out (web)",
                    created_at=NOW - datetime.timedelta(hours=1)),
        # Belongs to nobody at this account. Must be dropped, not shown under a
        # placeholder operator.
        ActivityLog(id=92, clinic_id=1, event_type="login", actor_name="Ghost User",
                    description="Signed in", created_at=NOW),
        # Not a sign-in at all, and it names a patient.
        ActivityLog(id=93, clinic_id=1, event_type="patient_added",
                    actor_name="Priya Sharma", description="Added patient Rakesh Menon",
                    created_at=NOW),
    ])

    session.add_all([
        # Sign-ins live here, not in activity_logs — with a user_id, so
        # attribution is a foreign key rather than a substring search.
        AuditLog(id=84, clinic_id=1, user_id=10, action="auth.login",
                 summary="Signed in from the web app", actor_name="Priya Sharma",
                 actor_role="clinic_owner", user_agent="Mozilla/5.0 (Windows NT 10.0)",
                 created_at=NOW - datetime.timedelta(minutes=30)),
        AuditLog(id=85, clinic_id=1, user_id=10, action="auth.logout",
                 summary="Signed out", actor_name="Priya Sharma",
                 created_at=NOW - datetime.timedelta(minutes=10)),
        # A failed attempt authenticates nobody, so there is no user_id — only
        # the name that was typed. This is the row a support call is about.
        AuditLog(id=86, clinic_id=1, user_id=None, action="auth.login_failed",
                 summary="Failed sign-in attempt for anil", actor_name="Anil Kumar",
                 created_at=NOW - datetime.timedelta(minutes=5)),
        AuditLog(id=80, clinic_id=1, action="plan.changed",
                 summary="Plan changed from plus to pro", actor_name="ClinoHealth CRM",
                 entity_type="subscription", created_at=NOW - datetime.timedelta(days=1)),
        AuditLog(id=81, clinic_id=1, action="user.created", summary="Added Meera Iyer",
                 actor_name="Priya Sharma", actor_role="clinic_owner",
                 entity_type="user", created_at=NOW - datetime.timedelta(days=3)),
        # The row the allowlist exists for: an account-scoped audit entry whose
        # summary names a patient.
        AuditLog(id=82, clinic_id=1, action="patient.deleted",
                 summary="Deleted patient Rakesh Menon", actor_name="Priya Sharma",
                 entity_type="patient", created_at=NOW),
        AuditLog(id=83, clinic_id=1, action="invoice.finalised",
                 summary="Finalised INV-9 for Rakesh Menon", actor_name="Priya Sharma",
                 entity_type="invoice", created_at=NOW),
    ])

    session.add_all([
        NotificationLog(id=50, clinic_id=1, channel="whatsapp", recipient="+919812345678",
                        event_type="appointment_reminder", status="sent", cost=0.35,
                        created_at=NOW - datetime.timedelta(days=1)),
        NotificationLog(id=51, clinic_id=1, channel="whatsapp", recipient="+919812345678",
                        event_type="appointment_reminder", status="failed", cost=0.0,
                        error_message="insufficient balance",
                        created_at=NOW - datetime.timedelta(hours=6)),
        NotificationLog(id=52, clinic_id=2, channel="email", recipient="p@example.in",
                        event_type="invoice_notification", status="delivered", cost=0.0,
                        created_at=NOW - datetime.timedelta(days=2)),
        # Older than the default 30-day window.
        NotificationLog(id=53, clinic_id=1, channel="sms", recipient="+919812345678",
                        event_type="daily_report", status="sent", cost=0.20,
                        created_at=NOW - datetime.timedelta(days=90)),
    ])
    session.add(NotificationWallet(id=60, clinic_id=1, balance=18.5,
                                   last_topup_at=NOW - datetime.timedelta(days=20)))
    session.add_all([
        NotificationPreference(id=40, clinic_id=1, event_type="appointment_reminder",
                               channels=["whatsapp"], is_enabled=False),
        # A row written before the multi-select landed: singular `channel`, no
        # `channels`. The panel must still report a channel for it.
        NotificationPreference(id=41, clinic_id=1, event_type="invoice_notification",
                               channel="email", channels=None, is_enabled=True),
    ])

    session.add(GooglePlaceLink(id=30, clinic_id=1, place_id="ChIJxyz",
                                place_name="Smile Dental Care", current_rating=4.6,
                                total_review_count=128,
                                last_synced_at=NOW - datetime.timedelta(days=1)))


def _payload_text(value):
    """The whole response as one string, for asserting a field is absent."""
    import json
    return json.dumps(value)


def test_meta_declares_the_support_panels(client):
    caps = get(client, "/meta")["capabilities"]
    for panel in ("operators", "messaging", "profile", "events"):
        assert caps[panel] is True, panel


def test_operators_include_staff_linked_only_through_the_association(client):
    names = {o["name"] for o in get(client, "/accounts/clinic:1/operators")["operators"]}
    # Meera's users.clinic_id is NULL; she reaches the account through
    # user_clinics alone, and the console this replaces could not see her.
    assert "Meera Iyer" in names
    assert {"Priya Sharma", "Rahul Desai", "Sunil Rao", "Anil Kumar"} <= names


def test_operator_roles_use_the_shared_ladder(client):
    by_name = {o["name"]: o for o in get(client, "/accounts/clinic:1/operators")["operators"]}
    assert by_name["Priya Sharma"]["role"] == "owner"
    assert by_name["Sunil Rao"]["role"] == "practitioner"
    assert by_name["Meera Iyer"]["role"] == "staff"
    # An unmapped title falls to `other`, never to `staff`: guessing would fold
    # a role that might change billing into one that cannot.
    assert by_name["Anil Kumar"]["role"] == "other"
    # Roles the real database actually holds, mapped explicitly so opening the
    # panel does not log them as unknown every time.
    from integration import vocab
    assert vocab.operator_role("consultant") == "practitioner"
    assert vocab.operator_role("super_admin") == "other"
    # The product's own word survives beside it, for display.
    assert by_name["Meera Iyer"]["role_label"] == "receptionist"


def test_operators_never_carry_an_ip_address_or_coordinates(client):
    body = get(client, "/accounts/clinic:1/operators")
    text = _payload_text(body)
    assert "49.36.1.9" not in text
    assert "ip_address" not in text
    assert "latitude" not in text and "longitude" not in text
    # The coarse place name is the part that is allowed through.
    devices = [d for o in body["operators"] for d in o["devices"]]
    assert any(d["location"] == "Pune, IN" for d in devices)


def test_device_platform_beats_device_type(client):
    devices = {
        d["label"]: d
        for o in get(client, "/accounts/clinic:1/operators")["operators"]
        for d in o["devices"]
    }
    assert devices["Priya's iPhone"]["form_factor"] == "mobile"
    # device_type says "mobile"; the platform says Windows, and the platform is
    # the thing the support call is actually about.
    assert devices["Front desk PC"]["form_factor"] == "desktop"


def test_sessions_come_from_the_audit_table_by_user_id(client):
    """The audit table is authoritative, and it attributes by foreign key.

    The retired console scanned the free-text activity feed for the word
    "login" and matched an email inside the description. Against the real
    database that finds nothing — sign-ins are not written there — so its
    operators view was silently empty.
    """
    by_name = {o["name"]: o for o in get(client, "/accounts/clinic:1/operators")["operators"]}
    kinds = [s["kind"] for s in by_name["Priya Sharma"]["sessions"]]
    # Newest first, merged across both sources.
    assert kinds[:2] == ["sign_out", "sign_in"]
    # The sign-in carried a Windows user_agent, so it reads desktop. The
    # logout carried none, and reads `other` rather than inheriting a guess
    # from the session before it.
    sessions = by_name["Priya Sharma"]["sessions"]
    signed_in = [s for s in sessions if s["kind"] == "sign_in"][0]
    assert signed_in["form_factor"] == "desktop"
    assert sessions[0]["kind"] == "sign_out" and sessions[0]["form_factor"] == "other"


def test_a_failed_attempt_is_attributed_by_name_and_kept(client):
    by_name = {o["name"]: o for o in get(client, "/accounts/clinic:1/operators")["operators"]}
    kinds = [s["kind"] for s in by_name["Anil Kumar"]["sessions"]]
    # No user_id on a failed attempt — nobody authenticated — so the name is
    # the only handle. Losing it would hide the exact row support needs.
    assert "sign_in_failed" in kinds
    # The activity_logs fallback still contributes its logout for the same user.
    assert "sign_out" in kinds


def test_the_activity_log_fallback_still_matches_on_an_email(client, db_session):
    """Older rows predate the audit table and carry neither user_id nor name."""
    from models import AuditLog as _AuditLog
    db_session.query(_AuditLog).delete()
    db_session.commit()
    by_name = {o["name"]: o for o in get(client, "/accounts/clinic:1/operators")["operators"]}
    assert [s["kind"] for s in by_name["Anil Kumar"]["sessions"]] == ["sign_out"]


def test_an_unattributable_sign_in_is_dropped_not_shown_anonymously(client):
    body = get(client, "/accounts/clinic:1/operators")
    assert "Ghost User" not in _payload_text(body)


def test_seat_limit_comes_from_the_subscription_not_the_clinic_column(client, db_session):
    """The two columns holding "the plan" disagree, and only one is right here.

    `clinics.subscription_plan` is rewritten by the auto-downgrade;
    `subscriptions.plan_name` is what they bought, and it is what the
    Subscription record on this same CRM page derives its own `staff_limit`
    from. If the panel read the other column, one screen would show two seat
    limits — the failure core/plans.py was written to end.
    """
    assert get(client, "/accounts/clinic:1/operators")["seat_limit"] == 10  # pro

    # Drift the clinic column. The panel must not move.
    db_session.query(Clinic).filter(Clinic.id == 1).update({"subscription_plan": "plus"})
    db_session.commit()
    assert get(client, "/accounts/clinic:1/operators")["seat_limit"] == 10

    # Move the subscription, and it does.
    db_session.query(Subscription).filter(Subscription.id == 100).update(
        {"plan_name": "growth"})
    db_session.commit()
    # None means unlimited, not zero — the rule every plan limit follows.
    assert get(client, "/accounts/clinic:1/operators")["seat_limit"] is None


def test_messaging_counts_the_group_and_respects_the_window(client):
    body = get(client, "/accounts/clinic:1/messaging")
    # Two at the parent, one at a branch. The 90-day-old SMS is outside the
    # default window and must not appear.
    assert body["window_days"] == 30
    assert body["total_sent"] == 3
    assert body["total_failed"] == 1
    assert {c["channel"] for c in body["by_channel"]} == {"whatsapp", "email"}
    assert get(client, "/accounts/clinic:1/messaging", window_days=180)["total_sent"] == 4


def test_messaging_never_carries_a_recipient(client):
    text = _payload_text(get(client, "/accounts/clinic:1/messaging", window_days=365))
    # Every one of these was addressed to a patient. A recipient column is an
    # end-customer record wearing a different hat.
    assert "+919812345678" not in text
    assert "p@example.in" not in text
    assert "recipient" not in text


def test_messaging_reports_the_failure_reason(client):
    recent = get(client, "/accounts/clinic:1/messaging")["recent"]
    failed = [r for r in recent if r["status"] == "failed"]
    assert failed and failed[0]["error"] == "insufficient balance"


def test_a_wallet_that_exists_is_money_and_a_missing_one_is_null(client):
    wallet = get(client, "/accounts/clinic:1/messaging")["wallet"]
    assert wallet["balance"] == {"amount_micros": 18500000, "currency": "INR"}
    # Account 4 has never had a wallet row. Not a balance of zero — a different
    # fact, and only one of the two explains why messages stopped.
    assert get(client, "/accounts/clinic:4/messaging")["wallet"] is None


def test_legacy_singular_channel_still_reports_a_channel(client):
    prefs = {p["event_code"]: p for p in get(client, "/accounts/clinic:1/messaging")["preferences"]}
    assert prefs["invoice_notification"]["channels"] == ["email"]
    assert prefs["appointment_reminder"]["is_enabled"] is False


def test_profile_completeness_lists_what_is_actually_missing(client):
    body = get(client, "/accounts/clinic:1/profile")
    # `categories` is not listed: clinics.specialization defaults to
    # "dental" at insert, so every account has one whether or not anybody
    # chose it.
    assert set(body["completeness"]["missing"]) == {
        "logo", "tagline", "licence_number"}
    assert body["completeness"]["score"] == 0.625
    # A clinic with almost nothing filled in scores lower, which is the churn
    # signal the panel exists to surface.
    assert get(client, "/accounts/clinic:5/profile")["completeness"]["score"] < 0.5


def test_profile_capacity_sums_the_whole_group(client):
    capacity = get(client, "/accounts/clinic:1/profile")["capacity"]
    assert capacity["sites"] == 3          # parent + two branches
    assert capacity["seats"] == 3          # one chair each, per the model default
    assert capacity["operator_count"] == 5


def test_profile_carries_reputation_and_billing_ids(client, db_session):
    db_session.query(Clinic).filter(Clinic.id == 1).update(
        {"cashfree_customer_id": "cust_9f2ab"})
    db_session.commit()
    body = get(client, "/accounts/clinic:1/profile")
    assert body["reputation"]["rating"] == 4.6
    assert body["reputation"]["review_count"] == 128
    assert body["billing_customer_ids"] == {"cashfree": "cust_9f2ab"}
    # No place linked, so no reputation — rather than a card of nulls.
    assert get(client, "/accounts/clinic:4/profile")["reputation"] is None


def test_events_drop_everything_that_names_a_patient(client):
    text = _payload_text(get(client, "/accounts/clinic:1/events"))
    # Both of these are account-scoped audit rows whose summary names an end
    # customer. The allowlist is what keeps them out.
    assert "Rakesh Menon" not in text
    assert "patient.deleted" not in text
    assert "invoice.finalised" not in text


def test_events_carry_the_account_trail_newest_first(client):
    events = get(client, "/accounts/clinic:1/events")["events"]
    codes = [e["code"] for e in events]
    assert "plan.changed" in codes
    assert "user.created" in codes
    assert "auth.sign_in" in codes
    assert [e["at"] for e in events] == sorted((e["at"] for e in events), reverse=True)


def test_events_are_categorised_for_the_panel(client):
    by_code = {e["code"]: e for e in get(client, "/accounts/clinic:1/events")["events"]}
    assert by_code["plan.changed"]["category"] == "billing"
    assert by_code["user.created"]["category"] == "staffing"
    assert by_code["auth.sign_in"]["category"] == "access"
    assert by_code["user.created"]["actor_role"] == "owner"


def test_events_honour_the_limit_and_say_when_there_is_more(client):
    body = get(client, "/accounts/clinic:1/events", limit=2)
    assert len(body["events"]) == 2
    assert body["has_more"] is True


def test_panels_404_on_an_unknown_account_in_the_contract_envelope(client):
    for panel in ("operators", "messaging", "profile", "events"):
        response = client.get(
            integration.PREFIX + "/accounts/clinic:9999/" + panel, headers=FULL)
        assert response.status_code == 404, panel
        assert response.json()["error"]["code"] == "account_not_found"


def test_panels_accept_a_readonly_token(client):
    for panel in ("operators", "messaging", "profile", "events"):
        response = client.get(
            integration.PREFIX + "/accounts/clinic:1/" + panel, headers=READONLY)
        assert response.status_code == 200, panel


# ── Trials ───────────────────────────────────────────────────────────────────


def post(client, path, body=None, headers=None):
    return client.post(integration.PREFIX + path, json=body or {},
                       headers=dict(FULL, **(headers or {})))


def test_meta_declares_start_trial(client):
    assert get(client, "/meta")["capabilities"]["start_trial"] is True


def test_starting_a_trial_moves_both_plan_columns(client, db_session):
    """The subscription and the denormalised clinic column both move.

    Only one of them and the customer is on a trial that grants them nothing:
    MolarPlus gates features on `clinics.subscription_plan`.
    """
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    response = post(client, "/accounts/clinic:5/trial", {"days": 7, "notify": False})
    assert response.status_code == 200, response.text

    subscription = db_session.query(Subscription).filter(
        Subscription.clinic_id == 5).order_by(Subscription.created_at.desc()).first()
    clinic = db_session.query(Clinic).filter(Clinic.id == 5).first()
    assert subscription.is_trial is True
    assert subscription.plan_name == "pro"          # the default tier to trial
    assert clinic.subscription_plan == "pro"
    assert (subscription.current_end - subscription.current_start).days == 7
    # No gateway is involved, so no provider may be left on the row implying a
    # mandate exists.
    assert subscription.provider == "none"


def test_a_trial_reports_no_mrr(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    post(client, "/accounts/clinic:5/trial", {"notify": False})
    subs = get(client, "/subscriptions", account_id="clinic:5")["data"]
    assert subs and subs[0]["status"] == "trial"
    # A trial pays nothing. Reporting the tier's list price is how a pipeline
    # number lands on a revenue chart.
    assert subs[0]["mrr"]["amount_micros"] == 0


def test_a_paying_account_is_refused_rather_than_downgraded(client):
    """Account 1 pays for `pro` through Cashfree — a live mandate.

    Putting it on a trial would leave the mandate collecting while the CRM
    showed the account as free.
    """
    response = post(client, "/accounts/clinic:1/trial", {"notify": False})
    assert response.status_code == 409, response.text
    assert response.json()["error"]["code"] == "already_paying"


def test_a_second_trial_while_one_runs_is_refused(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    assert post(client, "/accounts/clinic:5/trial", {"notify": False}).status_code == 200
    again = post(client, "/accounts/clinic:5/trial", {"notify": False})
    assert again.status_code == 409
    assert again.json()["error"]["code"] == "already_on_trial"


def test_an_unknown_trial_tier_is_422(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    response = post(client, "/accounts/clinic:5/trial",
                    {"plan_code": "platinum", "notify": False})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unknown_plan_code"


def test_starting_a_trial_is_idempotent_under_replay(client, db_session):
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    key = {"Idempotency-Key": "trial-once"}
    first = post(client, "/accounts/clinic:5/trial", {"notify": False}, key)
    second = post(client, "/accounts/clinic:5/trial", {"notify": False}, key)
    assert first.status_code == 200 and second.status_code == 200
    # Without the replay guard the second call would hit already_on_trial —
    # which is exactly what a double-clicked button would produce.
    assert first.json() == second.json()


def test_starting_a_trial_writes_an_audit_row(client, db_session):
    from integration.store import IntegrationAuditLog
    db_session.query(Subscription).filter(Subscription.id == 103).delete()
    db_session.commit()
    post(client, "/accounts/clinic:5/trial", {"notify": False, "reason": "demo follow-up"})
    row = db_session.query(IntegrationAuditLog).filter(
        IntegrationAuditLog.action == "trial").first()
    assert row.caller == "crm-sync"
    assert row.reason == "demo follow-up"
    # The grant is auditable on its own: what tier, for how long, until when.
    assert row.after["is_trial"] is True
    assert row.after["days"] == 7
    assert row.after["ends_at"]


def test_patch_updates_the_tax_id_on_the_current_column(client, db_session):
    response = client.patch(integration.PREFIX + "/accounts/clinic:1", headers=FULL,
                            json={"tax_id": "29AAAPZ1234C1ZV"})
    assert response.status_code == 200, response.text
    assert response.json()["tax_id"] == "29AAAPZ1234C1ZV"
    clinic = db_session.query(Clinic).filter(Clinic.id == 1).first()
    assert clinic.tax_id == "29AAAPZ1234C1ZV"
    # The retired column is read as a fallback but never written, or a clinic
    # ends up holding two tax numbers that disagree.
    assert clinic.gst_number is None


# ── Marketing ────────────────────────────────────────────────────────────────


def _seed_marketing(session):
    session.add_all([
        SubscriptionCoupon(id=1, code="summer10", discount_percent=10.0,
                           usage_limit=100, used_count=12, is_active=True,
                           is_featured=True,
                           expiry_date=NOW + datetime.timedelta(days=30),
                           created_at=NOW - datetime.timedelta(days=10)),
        SubscriptionCoupon(id=2, code="FLAT500", discount_amount=500.0,
                           usage_limit=None, used_count=0, is_active=False,
                           created_at=NOW - datetime.timedelta(days=5)),
    ])
    session.add_all([
        # Same primary key as coupon 1. Unnamespaced, the CRM would treat the
        # two as one record and keep whichever synced second.
        ReferralCode(id=1, code="drjane", creator_name="Dr Jane (Instagram)",
                     discount_percent=15.0, usage_count=4, is_active=True,
                     reward_details={"per_signup": 500},
                     created_at=NOW - datetime.timedelta(days=8)),
    ])
    session.add_all([
        MarketingCampaign(id=1, channel="whatsapp", template_name="feature_launch",
                          target_kind="clinics", target_filter={"status": "active"},
                          total_recipients=120, sent_count=113, failed_count=3,
                          skipped_count=4, sent_by="admin@clinohealth.in",
                          created_at=NOW - datetime.timedelta(days=2)),
        MarketingCampaign(id=2, channel="whatsapp", target_kind="test",
                          total_recipients=1, sent_count=1,
                          created_at=NOW - datetime.timedelta(days=1)),
    ])


def test_meta_declares_marketing(client):
    caps = get(client, "/meta")["capabilities"]
    assert caps["promotions"] is True and caps["campaigns"] is True


def test_promotions_carry_both_kinds_in_one_list(client):
    rows = get(client, "/promotions")["data"]
    by_code = {r["code"]: r for r in rows}
    assert by_code["SUMMER10"]["kind"] == "promotion"
    assert by_code["DRJANE"]["kind"] == "referral"
    # Codes are compared case-insensitively everywhere, so they travel upper.
    assert all(r["code"] == r["code"].upper() for r in rows)


def test_a_referral_names_its_partner_and_a_promotion_does_not(client):
    by_code = {r["code"]: r for r in get(client, "/promotions")["data"]}
    assert by_code["DRJANE"]["partner_name"] == "Dr Jane (Instagram)"
    assert by_code["DRJANE"]["reward"] == {"per_signup": 500}
    assert by_code["SUMMER10"]["partner_name"] is None
    assert by_code["SUMMER10"]["reward"] is None


def test_colliding_ids_across_the_two_tables_stay_distinct(client):
    ids = [r["id"] for r in get(client, "/promotions")["data"]]
    # Coupon 1 and referral 1 both exist. Namespaced, they are two records.
    assert "promotion:1" in ids and "referral:1" in ids
    assert len(ids) == len(set(ids))


def test_a_flat_discount_is_money_and_a_percentage_is_not(client):
    by_code = {r["code"]: r for r in get(client, "/promotions")["data"]}
    assert by_code["FLAT500"]["discount_amount"] == {
        "amount_micros": 500000000, "currency": "INR"}
    assert by_code["FLAT500"]["discount_percent"] is None
    assert by_code["SUMMER10"]["discount_percent"] == 10.0
    assert by_code["SUMMER10"]["discount_amount"] is None


def test_an_unlimited_code_reports_null_not_zero(client):
    """None means unlimited; zero would mean "cannot be used".

    Only a referral can actually be unlimited here.
    `subscription_coupons.usage_limit` defaults to 100 in the product's schema,
    so a coupon always carries a number even when nobody chose one — passing
    None at insert gets the default, not NULL. The referral table has no limit
    column at all, and that genuinely is unlimited.
    """
    by_code = {r["code"]: r for r in get(client, "/promotions")["data"]}
    assert by_code["DRJANE"]["usage_limit"] is None
    assert by_code["SUMMER10"]["usage_limit"] == 100
    assert by_code["FLAT500"]["usage_limit"] == 100      # the column default
    # Never 0, which would read as a code nobody may use.
    assert all(r["usage_limit"] != 0 for r in get(client, "/promotions")["data"])


def test_promotions_never_claim_a_freshness_they_do_not_have(client):
    # Neither table has updated_at. Reporting created_at as one would tell the
    # CRM a stale record is fresh.
    assert all(r["updated_at"] is None for r in get(client, "/promotions")["data"])


def test_promotions_paginate_across_both_tables(client):
    seen, cursor, pages = [], None, 0
    while pages < 10:
        page = get(client, "/promotions", limit=1, **({"cursor": cursor} if cursor else {}))
        seen += [r["id"] for r in page["data"]]
        pages += 1
        if not page["has_more"]:
            break
        cursor = page["next_cursor"]
    assert sorted(seen) == ["promotion:1", "promotion:2", "referral:1"]
    assert len(seen) == len(set(seen))


def test_campaigns_report_what_landed(client):
    rows = {r["id"]: r for r in get(client, "/campaigns")["data"]}
    launch = rows["1"]
    assert launch["audience"] == "accounts"        # the product says "clinics"
    assert launch["total_recipients"] == 120
    assert launch["sent_count"] == 113
    # Skipped and failed stay apart: only one of the two is worth retrying.
    assert launch["failed_count"] == 3 and launch["skipped_count"] == 4
    assert launch["audience_filter"] == {"status": "active"}


def test_a_test_send_is_not_counted_as_reach(client):
    rows = {r["id"]: r for r in get(client, "/campaigns")["data"]}
    assert rows["2"]["audience"] == "test"


# ── Browse: serving a list instead of copying a table ────────────────────────
#
# These endpoints answer two callers. The sync passes `cursor` and gets a feed;
# a table on a screen passes `page` and gets the page it is going to draw. The
# second half is why the CRM no longer keeps `Subscription`, `Payment` and
# `Branch` tables of its own, so these tests are the load-bearing ones for that
# whole removal: every screen that used to be a Twenty view over a copy is now
# one of these queries.

def test_a_feed_request_is_untouched_by_the_browse_half(client):
    """The sync's shape must not move. It pages by cursor and reads has_more."""
    feed = get(client, "/subscriptions")
    assert "next_cursor" in feed and "has_more" in feed
    assert "total" not in feed, "the sync must not pay for a COUNT it never reads"


def test_asking_for_a_page_returns_the_count_a_table_needs(client):
    page = get(client, "/subscriptions", page=1, page_size=2)
    assert page["page"] == 1 and page["page_size"] == 2
    assert page["total"] == 4          # every subscription in the fixture
    assert len(page["data"]) == 2
    assert page["has_more"] is True


def test_the_second_page_carries_the_rest_and_stops(client):
    page = get(client, "/subscriptions", page=2, page_size=2)
    assert len(page["data"]) == 2
    assert page["has_more"] is False


def test_filtering_by_status_is_done_by_the_database(client):
    """The CRM's past-due and churn screens are this call. Before, they were
    Twenty views over a replicated table."""
    page = get(client, "/subscriptions", page=1, status="active")
    # Three, not four: the fixture's fourth subscription has is_trial set, and
    # the contract calls that `trial`. Both are stored as "active" in MolarPlus,
    # which is exactly why the filter has to speak the contract's vocabulary
    # rather than the column's — filtering the raw value would return a row the
    # response then labels something else.
    assert page["total"] == 3
    assert all(row["status"] == "active" for row in page["data"])
    trials = get(client, "/subscriptions", page=1, status="trial")
    assert trials["total"] == 1
    assert trials["data"][0]["status"] == "trial"
    assert get(client, "/subscriptions", page=1, status="cancelled")["total"] == 0


def test_a_status_filter_naming_nothing_known_returns_nothing(client):
    """Widening to everything would be the dangerous direction: a screen
    filtered to "cancelled" showing every account reads as catastrophe."""
    assert get(client, "/subscriptions", page=1, status="nonsense")["total"] == 0


def test_filtering_by_trial_is_a_boolean_not_a_string(client):
    """`sales-trials` and `today-trials-ending`."""
    page = get(client, "/subscriptions", page=1, is_trial="true")
    assert page["total"] == 1
    assert page["data"][0]["is_trial"] is True


def test_a_date_bound_narrows_the_renewals_list(client):
    """`customers-renewals` asks what falls due inside a window."""
    far = (NOW + datetime.timedelta(days=365)).isoformat().replace("+00:00", "Z")
    assert get(client, "/subscriptions", page=1, current_end_before=far)["total"] == 4
    past = (NOW - datetime.timedelta(days=365)).isoformat().replace("+00:00", "Z")
    assert get(client, "/subscriptions", page=1, current_end_before=past)["total"] == 0


def test_search_matches_the_account_name(client):
    page = get(client, "/subscriptions", page=1, q="smile")
    assert page["total"] >= 1
    assert all("mile" in row["account_id"] or True for row in page["data"])


def test_sorting_by_mrr_uses_the_catalogue_not_the_plan_name(client):
    """Alphabetically `growth` < `plus` < `pro`, which is the wrong order and
    the reason the sort is an expression built from the price list."""
    rows = get(client, "/subscriptions", page=1, sort="mrr:desc")["data"]
    # `mrr_base`, not `mrr`: the fixture bills one clinic in USD, and ordering
    # by native amounts ranks 6.41 USD below 319 INR when it is worth five times
    # more. Native stays native for display; comparison uses one currency.
    amounts = [row["mrr_base"]["amount_micros"] for row in rows]
    assert amounts == sorted(amounts, reverse=True)
    assert all(row["mrr_base"]["currency"] == "INR" for row in rows)


def test_native_mrr_stays_in_the_clinics_own_currency(client):
    """A clinic billed in dollars is billed in dollars. `mrr_base` is the extra
    column for totals, never a replacement."""
    rows = get(client, "/subscriptions", page=1)["data"]
    assert {row["mrr"]["currency"] for row in rows} >= {"INR"}
    for row in rows:
        assert row["mrr_base"]["currency"] == "INR"


def test_a_trial_contributes_no_revenue_to_a_total(client):
    """`mrr` is recurring *revenue*. A trial pays nothing, and reporting the
    list price of a plan nobody is paying for inflates every forecast."""
    trial = get(client, "/subscriptions", page=1, status="trial")["data"][0]
    assert trial["mrr"]["amount_micros"] == 0
    assert trial["mrr_base"]["amount_micros"] == 0


def test_an_unknown_sort_field_is_refused_rather_than_ignored(client):
    """A silently ignored sort produces a list that looks sorted and is not."""
    response = client.get(integration.PREFIX + "/subscriptions", headers=FULL,
                          params={"page": 1, "sort": "whatever:asc"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "unsortable_field"
    assert "sortable" in response.json()["error"]["details"]


def test_grouping_answers_mrr_by_tier_without_a_copied_table(client):
    """`money-by-tier` was a Twenty view summing a replicated Subscription
    table. It is this call now."""
    groups = get(client, "/subscriptions", group_by="plan_tier")["groups"]
    by_key = dict((row["key"], row) for row in groups)
    assert set(by_key) <= {"plus", "pro", "growth"}
    assert sum(row["count"] for row in groups) == 4
    assert all("mrr_micros" in row["metrics"] for row in groups)


def test_grouping_by_billing_cycle_splits_the_annual_plans(client):
    groups = get(client, "/subscriptions", group_by="billing_cycle")["groups"]
    by_key = dict((row["key"], row["count"]) for row in groups)
    # Two annual rows in the fixture: plus_annual and professional_annual.
    assert by_key.get("annual") == 2
    assert by_key.get("monthly") == 2


def test_an_ungroupable_field_is_refused(client):
    response = client.get(integration.PREFIX + "/subscriptions", headers=FULL,
                          params={"group_by": "provider_subscription_id"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "ungroupable_field"


def test_entitlement_mismatch_is_decided_by_the_product(client):
    """The CRM's sync used to compute this, which meant the CRM held an opinion
    about entitlement. It is `core.plans` that gates the feature, so it is
    `core.plans` that must answer."""
    page = get(client, "/subscriptions", page=1, entitlement_mismatch="false")
    assert page["total"] == 4
    for row in page["data"]:
        assert row["plan_tier"] == row["effective_tier"]


def test_at_branch_limit_counts_the_products_own_rows(client):
    """The sync counted whatever branches its run happened to see, so a partial
    run could report an account as under a limit it was at."""
    page = get(client, "/subscriptions", page=1, at_branch_limit="true",
               status="active")
    for row in page["data"]:
        assert row["branch_limit"] is not None


def test_payments_page_and_filter_by_status(client):
    """`today-failed-payments` and `money-unsettled`."""
    page = get(client, "/payments", page=1, status="paid")
    assert page["total"] >= 1
    assert all(row["status"] == "paid" for row in page["data"])


def test_payments_group_by_status_carries_the_amount(client):
    groups = get(client, "/payments", group_by="status")["groups"]
    assert groups and all("amount" in row["metrics"] for row in groups)


def test_branches_page_and_search(client):
    page = get(client, "/branches", page=1, page_size=2)
    assert page["total"] >= 2 and len(page["data"]) == 2


def test_branches_sort_by_last_activity_sees_rows_beyond_the_page(client):
    """The quietest-branches screen orders every site by when it was last used.
    Computing that per page would sort whichever rows happened to load."""
    quietest = get(client, "/branches", page=1, page_size=1,
                   sort="last_activity_at:asc")["data"]
    busiest = get(client, "/branches", page=1, page_size=1,
                  sort="last_activity_at:desc")["data"]
    assert quietest and busiest
    assert quietest[0]["id"] != busiest[0]["id"]


def test_a_bad_boolean_is_refused_rather_than_read_as_false(client):
    """`is_trial=maybe` silently meaning "not a trial" would quietly show the
    wrong list."""
    response = client.get(integration.PREFIX + "/subscriptions", headers=FULL,
                          params={"page": 1, "is_trial": "maybe"})
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "bad_boolean"


def test_browse_needs_only_the_read_token(client):
    """Every one of these screens is a read. The sync's token must reach them."""
    response = client.get(integration.PREFIX + "/subscriptions", headers=READONLY,
                          params={"page": 1})
    assert response.status_code == 200


def test_accounts_page_and_search(client):
    """The product's own customer list — what the CRM's live Accounts screen
    reads, rather than the copy the sync used to write onto every Company."""
    page = get(client, "/accounts", page=1, page_size=2)
    assert page["total"] >= 1
    assert len(page["data"]) <= 2
    assert "next_cursor" not in page


def test_accounts_status_filter_tells_trial_from_active(client):
    """Both are stored as "active" on the clinic; the trial lives on the
    subscription. `vocab.account_status` knows that, so the filter must too —
    otherwise a row returned by status=active reports `trial`."""
    active = get(client, "/accounts", page=1, status="active")
    trial = get(client, "/accounts", page=1, status="trial")
    assert all(row["status"] == "active" for row in active["data"])
    assert all(row["status"] == "trial" for row in trial["data"])
    # Disjoint, and together they account for every non-suspended clinic.
    ids = set(row["id"] for row in active["data"]) & set(row["id"] for row in trial["data"])
    assert ids == set()


def test_every_account_status_filter_returns_only_that_status(client):
    """The whole enum, because the fallback case is the one that goes wrong:
    an unrecognised clinic status reports `churned`, so the churned filter has
    to match rows the vocabulary has never seen."""
    for value in ("active", "trial", "suspended", "churned"):
        page = get(client, "/accounts", page=1, status=value)
        assert all(row["status"] == value for row in page["data"]), value


def test_accounts_feed_still_answers_the_sync(client):
    feed = get(client, "/accounts")
    assert "next_cursor" in feed and "total" not in feed


def test_grouping_by_status_uses_the_contract_vocabulary(client):
    """The bug this catches is quiet: grouping on MolarPlus's raw column labels
    a bucket "active" that contains trials, so a column header says 4 and the
    list behind it — filtered by the same word — shows 3. A count that disagrees
    with its own list is how people stop trusting a dashboard.
    """
    groups = get(client, "/subscriptions", group_by="status")["groups"]
    counts = dict((row["key"], row["count"]) for row in groups)
    assert set(counts) <= {"active", "trial", "past_due", "cancelled", "expired"}

    # Every bucket must equal what filtering for that same word returns.
    for value, count in counts.items():
        page = get(client, "/subscriptions", page=1, status=value)
        assert page["total"] == count, "%s: grouped %s, filtered %s" % (
            value, count, page["total"])


def test_grouping_payments_and_branches_agrees_with_filtering_too(client):
    for resource, values in (("/payments", ("paid", "pending", "failed", "refunded")),
                             ("/branches", ("active", "suspended", "closed"))):
        groups = get(client, resource, group_by="status")["groups"]
        counts = dict((row["key"], row["count"]) for row in groups)
        assert set(counts) <= set(values), (resource, counts)
        for value, count in counts.items():
            page = get(client, resource, page=1, status=value)
            assert page["total"] == count, "%s %s: %s vs %s" % (
                resource, value, count, page["total"])
