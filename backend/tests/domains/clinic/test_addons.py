"""Add-ons (core.addons + addon_service): per-location paid features.

What these pin, in the order a clinic meets them:

  * the catalogue: rupees plus GST in India, nothing buyable abroad, coming-soon
    items listed but never sold, and "included" when the plan covers it
  * entitlement: plan, add-on, grace, expiry, Pro trial, a branch under a Pro parent
  * checkout: an add-on order never touches the plan's subscription row, so a
    plan checkout in progress survives it
  * settlement: webhook and return page, replay-safe, early renewal adds time,
    and paying the FIRST of two open orders still lands
  * Google Business Profile: a support ticket opened exactly once
  * the hourly sweep: reminders once per threshold, expiry once, nothing for
    clinics whose plan includes it
  * own-number WhatsApp actually gated on it
"""
import datetime as dt
import json

import pytest

from core import addons
from domains.clinic.services.addon_service import AddonService, AddonError


NOW = dt.datetime.utcnow


# ── helpers ──────────────────────────────────────────────────────────────────

def _subscribe(db, clinic, plan="pro", days=30, trial=False, provider="cashfree"):
    from models import Subscription
    sub = Subscription(
        clinic_id=clinic.id, plan_name=plan, status="active", provider=provider,
        is_trial=trial, current_start=NOW() - dt.timedelta(days=1),
        current_end=NOW() + dt.timedelta(days=days),
    )
    db.add(sub)
    db.commit()
    return sub


def _addon_row(db, clinic, key="own_whatsapp", days=10, status="active", source="paid", cycle="monthly"):
    from models import ClinicAddon
    row = ClinicAddon(clinic_id=clinic.id, addon_key=key, status=status, source=source, cycle=cycle,
                      current_start=NOW() - dt.timedelta(days=1), current_end=NOW() + dt.timedelta(days=days))
    db.add(row)
    db.commit()
    return row


def _item(catalogue, key):
    return next(i for i in catalogue["addons"] if i["key"] == key)


class FakeCashfree:
    def __init__(self):
        self.orders = []
        self.status = {}

    def create_order(self, amount, customer_id, order_id, notes=None, currency="INR"):
        self.orders.append({"amount": amount, "order_id": order_id, "notes": notes, "currency": currency})
        return {"payment_session_id": f"session-{order_id}"}

    def get_subscription(self, order_id):
        return self.status.get(order_id, {"order_status": "ACTIVE"})


@pytest.fixture
def cashfree(monkeypatch):
    fake = FakeCashfree()
    monkeypatch.setattr(AddonService, "provider", property(lambda self: fake))
    return fake


def _webhook(client, monkeypatch, order_id, amount, status="SUCCESS", payment_id="cfpay-1"):
    monkeypatch.setattr("core.cashfree_webhook.verify_request", lambda raw, headers: (True, ""))
    body = {"data": {"order": {"order_id": order_id},
                     "payment": {"payment_status": status, "cf_payment_id": payment_id,
                                 "payment_amount": amount}}}
    return client.post("/api/v1/subscriptions/webhook/cashfree", content=json.dumps(body),
                       headers={"Content-Type": "application/json"})


# ── catalogue ────────────────────────────────────────────────────────────────

def test_catalogue_prices_in_rupees_with_gst(db_session, test_clinic):
    cat = addons.catalogue(db_session, test_clinic)
    assert cat["currency"] == "INR" and cat["tax_label"] == "GST" and cat["tax_rate"] == 0.18
    wa = _item(cat, "own_whatsapp")
    assert (wa["monthly"], wa["annual_total"], wa["annual_pct_off"]) == (289.0, 2774.0, 20)
    gbp = _item(cat, "gbp_management")
    assert (gbp["monthly"], gbp["annual_total"]) == (150.0, 1440.0)
    upi = _item(cat, "upi_payments")
    assert (upi["monthly"], upi["annual_total"]) == (200.0, 1920.0)
    assert _item(cat, "xray_integration")["monthly"] == 350.0
    assert "USD" not in json.dumps(cat)


def test_catalogue_states_for_a_plus_clinic(db_session, test_clinic):
    cat = addons.catalogue(db_session, test_clinic)
    assert _item(cat, "own_whatsapp")["state"] == "not_bought"
    assert _item(cat, "own_whatsapp")["included_from_plan"] == "Pro"
    assert _item(cat, "gbp_management")["state"] == "not_bought"
    assert _item(cat, "upi_payments")["state"] == "coming_soon"
    assert _item(cat, "upi_payments")["priced"] is True
    assert _item(cat, "xray_integration")["state"] == "coming_soon"


def test_pro_includes_every_addon(db_session, test_clinic):
    _subscribe(db_session, test_clinic, "pro")
    cat = addons.catalogue(db_session, test_clinic)
    assert _item(cat, "own_whatsapp")["state"] == "included"
    assert _item(cat, "gbp_management")["state"] == "included"
    for key in ("own_whatsapp", "gbp_management", "upi_payments", "xray_integration"):
        assert addons.entitled(db_session, test_clinic, key) is True
    # Included, but not yet built: the card says coming soon, not "in your plan".
    for key in ("upi_payments", "xray_integration"):
        assert _item(cat, key)["state"] == "coming_soon"
        assert _item(cat, key)["included_by_plan"] is True


def test_nothing_is_sold_outside_india_and_no_dollar_figure_appears(db_session, test_clinic):
    test_clinic.country = "AE"
    db_session.commit()
    cat = addons.catalogue(db_session, test_clinic)
    gbp = _item(cat, "gbp_management")
    assert gbp["state"] == "unavailable"
    assert gbp["monthly"] is None and gbp["currency"] is None
    with pytest.raises(AddonError):
        AddonService(db_session).quote(test_clinic, "gbp_management", "monthly")


def test_an_opened_but_unpaid_checkout_still_reads_as_not_bought(client, auth_headers, db_session, test_clinic, cashfree):
    client.post("/api/v1/subscriptions/addons/checkout", headers=auth_headers,
                json={"addon_key": "gbp_management", "cycle": "monthly"})
    db_session.expire_all()
    assert _item(addons.catalogue(db_session, test_clinic), "gbp_management")["state"] == "not_bought"


# ── entitlement ──────────────────────────────────────────────────────────────

def test_entitlement_matrix(db_session, test_clinic):
    key = "own_whatsapp"
    assert addons.entitled(db_session, test_clinic, key) is False, "Plus with nothing bought"

    row = _addon_row(db_session, test_clinic, key, days=5)
    assert addons.entitled(db_session, test_clinic, key) is True, "Plus with the add-on"

    row.current_end = NOW() - dt.timedelta(minutes=1)
    db_session.commit()
    assert addons.entitled(db_session, test_clinic, key) is False, "add-on ran out"

    row.current_end = NOW() + dt.timedelta(days=3)
    row.source = "grace"
    db_session.commit()
    assert addons.entitled(db_session, test_clinic, key) is True, "free grace period"


def test_pro_trial_includes_it_until_the_trial_ends(db_session, test_clinic):
    sub = _subscribe(db_session, test_clinic, "pro", days=3, trial=True, provider="trial")
    assert addons.entitled(db_session, test_clinic, "own_whatsapp") is True
    sub.current_end = NOW() - dt.timedelta(hours=1)
    db_session.commit()
    assert addons.entitled(db_session, test_clinic, "own_whatsapp") is False


def test_a_branch_inherits_its_parents_pro_plan(db_session, test_clinic):
    from models import Clinic
    _subscribe(db_session, test_clinic, "pro")
    branch = Clinic(name="Branch", address="x", phone="1", email="b@x.com", specialization="dental",
                    parent_clinic_id=test_clinic.id)
    db_session.add(branch)
    db_session.commit()
    assert addons.entitled(db_session, branch, "own_whatsapp") is True


# ── checkout ─────────────────────────────────────────────────────────────────

def test_checkout_opens_an_addon_order_and_leaves_the_plan_row_alone(client, auth_headers, db_session, test_clinic, test_user, cashfree):
    from models import Subscription, ClinicAddon
    sub = _subscribe(db_session, test_clinic, "plus", provider="trial", trial=True)
    sub.user_id = test_user.id
    sub.provider_order_id = "SUB_plan_checkout_in_progress"
    sub.notes = {"pending_plan": "pro"}
    db_session.commit()

    r = client.post("/api/v1/subscriptions/addons/checkout", headers=auth_headers,
                    json={"addon_key": "own_whatsapp", "cycle": "annual"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["order_id"].startswith("ADD_") and data["payment_session_id"]
    assert (data["base"], data["tax"], data["amount"]) == (2774.0, 499.32, 3273.32)
    assert addons.parse_order_id(data["order_id"]) == (test_clinic.id, "own_whatsapp", "annual")
    assert cashfree.orders[0]["amount"] == 3273.32
    assert "tab=addons" in cashfree.orders[0]["notes"]["return_url"]

    db_session.expire_all()
    sub = db_session.query(Subscription).filter(Subscription.id == sub.id).first()
    assert sub.provider_order_id == "SUB_plan_checkout_in_progress"
    assert sub.notes == {"pending_plan": "pro"}
    row = db_session.query(ClinicAddon).filter(ClinicAddon.clinic_id == test_clinic.id).first()
    assert data["order_id"] in row.pending
    assert addons.entitled(db_session, test_clinic, "own_whatsapp") is False, "nothing until money arrives"


@pytest.mark.parametrize("key,setup,message", [
    ("upi_payments", None, "coming soon"),
    ("xray_integration", None, "coming soon"),
    ("own_whatsapp", "pro", "already included"),
    ("nonsense", None, "does not exist"),
])
def test_checkout_refusals(client, auth_headers, db_session, test_clinic, cashfree, key, setup, message):
    if setup:
        _subscribe(db_session, test_clinic, setup)
    r = client.post("/api/v1/subscriptions/addons/checkout", headers=auth_headers,
                    json={"addon_key": key, "cycle": "monthly"})
    assert r.status_code == 400
    assert message in r.json()["detail"]
    assert cashfree.orders == []


def test_only_the_owner_can_buy(client, db_session, test_clinic, cashfree):
    from domains.auth.services.auth_service import AuthService
    from models import User
    staff = User(clinic_id=test_clinic.id, email="staff@example.com", first_name="Staff", last_name="Member",
                 name="Staff Member", role="receptionist", is_active=True, password_hash="x")
    db_session.add(staff)
    db_session.commit()
    token = AuthService(None, None, None).create_jwt_token(staff.id)
    r = client.post("/api/v1/subscriptions/addons/checkout", headers={"Authorization": f"Bearer {token}"},
                    json={"addon_key": "gbp_management", "cycle": "monthly"})
    assert r.status_code == 403


# ── settlement ───────────────────────────────────────────────────────────────

def _checkout(client, auth_headers, key="own_whatsapp", cycle="monthly"):
    r = client.post("/api/v1/subscriptions/addons/checkout", headers=auth_headers,
                    json={"addon_key": key, "cycle": cycle})
    assert r.status_code == 200, r.text
    return r.json()


def test_webhook_activates_and_books_the_payment_once(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    from models import SubscriptionPayment, ClinicAddon
    order = _checkout(client, auth_headers)
    for _ in range(2):
        assert _webhook(client, monkeypatch, order["order_id"], order["amount"]).status_code == 200

    db_session.expire_all()
    payments = db_session.query(SubscriptionPayment).filter(SubscriptionPayment.provider_order_id == order["order_id"]).all()
    assert len(payments) == 1, "a replayed webhook must not book twice"
    p = payments[0]
    assert (p.item_type, p.addon_key, p.plan_name) == ("addon", "own_whatsapp", "addon:own_whatsapp_monthly")
    assert (p.amount, p.tax_amount, p.currency) == (341.02, 52.02, "INR")
    row = db_session.query(ClinicAddon).filter(ClinicAddon.clinic_id == test_clinic.id).first()
    assert row.status == "active" and row.source == "paid" and not row.pending
    assert 27 <= (row.current_end - NOW()).days <= 31
    assert addons.entitled(db_session, test_clinic, "own_whatsapp") is True


def test_early_renewal_adds_time_instead_of_restarting(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    from models import ClinicAddon
    row = _addon_row(db_session, test_clinic, "own_whatsapp", days=10)
    old_end = row.current_end
    order = _checkout(client, auth_headers)
    _webhook(client, monkeypatch, order["order_id"], order["amount"])
    db_session.expire_all()
    row = db_session.query(ClinicAddon).filter(ClinicAddon.id == row.id).first()
    assert row.current_end > old_end + dt.timedelta(days=27)


def test_paying_the_first_of_two_open_orders_still_lands(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    first = _checkout(client, auth_headers, cycle="monthly")
    second = _checkout(client, auth_headers, cycle="annual")
    assert first["order_id"] != second["order_id"]
    _webhook(client, monkeypatch, first["order_id"], first["amount"])
    db_session.expire_all()
    from models import ClinicAddon
    row = db_session.query(ClinicAddon).filter(ClinicAddon.clinic_id == test_clinic.id).first()
    assert row.status == "active" and row.cycle == "monthly"
    assert second["order_id"] in (row.pending or {}), "the other open order is still payable"


def test_failed_payment_changes_nothing(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    order = _checkout(client, auth_headers)
    r = _webhook(client, monkeypatch, order["order_id"], order["amount"], status="FAILED")
    assert r.status_code == 200
    assert addons.entitled(db_session, test_clinic, "own_whatsapp") is False


def test_plan_webhooks_still_take_the_plan_path(client, db_session, monkeypatch):
    seen = []
    monkeypatch.setattr("domains.clinic.services.subscription_service.SubscriptionService.handle_webhook",
                        lambda self, provider, payload: seen.append(payload) or True)
    r = _webhook(client, monkeypatch, "SUB_1_1757830000_abc123", 470.82)
    assert r.status_code == 200 and len(seen) == 1


def test_return_page_verifies_an_addon_order(client, auth_headers, db_session, test_clinic, cashfree):
    order = _checkout(client, auth_headers, key="gbp_management")
    cashfree.status[order["order_id"]] = {"order_status": "PAID", "order_amount": order["amount"], "cf_order_id": "cf-9"}
    r = client.get(f"/api/v1/subscriptions/verify-status?order_id={order['order_id']}", headers=auth_headers)
    assert r.status_code == 200 and r.json()["addon"] is True
    assert addons.entitled(db_session, test_clinic, "gbp_management") is True


def test_return_page_refuses_another_clinics_order(client, auth_headers, cashfree):
    r = client.get("/api/v1/subscriptions/verify-status?order_id=ADD_999999_own_whatsapp_m_abc_123456",
                   headers=auth_headers)
    assert r.status_code == 400


def test_billing_history_names_the_addon(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    order = _checkout(client, auth_headers, key="gbp_management", cycle="annual")
    _webhook(client, monkeypatch, order["order_id"], order["amount"])
    history = client.get("/api/v1/subscriptions/history", headers=auth_headers).json()["history"]
    assert history[0]["plan"] == "Google Business Profile management, annual"


# ── Google Business Profile: the team's work order ───────────────────────────

def test_gbp_purchase_opens_one_support_ticket(client, auth_headers, db_session, test_clinic, cashfree, monkeypatch):
    from models import SupportTicket, ClinicAddon
    order = _checkout(client, auth_headers, key="gbp_management")
    _webhook(client, monkeypatch, order["order_id"], order["amount"])
    renewal = _checkout(client, auth_headers, key="gbp_management")
    _webhook(client, monkeypatch, renewal["order_id"], renewal["amount"], payment_id="cfpay-2")

    db_session.expire_all()
    tickets = db_session.query(SupportTicket).filter(SupportTicket.clinic_id == test_clinic.id).all()
    assert len(tickets) == 1, "a renewal is not a new request"
    assert tickets[0].category == "setup" and "Google Business Profile" in tickets[0].title
    row = db_session.query(ClinicAddon).filter(ClinicAddon.addon_key == "gbp_management").first()
    assert row.service_status == "requested" and row.support_ticket_id == tickets[0].id


def test_support_moves_the_service_status_and_can_grant(db_session, test_clinic):
    svc = AddonService(db_session)
    row = svc.grant(test_clinic, "gbp_management", days=30, service_status="access_given")
    assert (row.status, row.source, row.service_status) == ("active", "support", "access_given")
    with pytest.raises(AddonError):
        svc.grant(test_clinic, "gbp_management", service_status="teleported")
    with pytest.raises(AddonError):
        svc.grant(test_clinic, "own_whatsapp", service_status="done")


# ── the hourly sweep ─────────────────────────────────────────────────────────

def _notes(db, clinic, event):
    from models import Notification
    return db.query(Notification).filter(Notification.clinic_id == clinic.id, Notification.event_type == event).count()


def test_reminders_fire_once_per_threshold(db_session, test_clinic, test_user):
    row = _addon_row(db_session, test_clinic, "gbp_management", days=6)
    svc = AddonService(db_session)
    svc.sweep()
    svc.sweep()
    assert _notes(db_session, test_clinic, "addon_renewal_due") == 1, "7-day reminder once"
    row.current_end = NOW() + dt.timedelta(hours=20)
    db_session.commit()
    svc.sweep()
    svc.sweep()
    assert _notes(db_session, test_clinic, "addon_renewal_due") == 2, "then the 1-day one, once"


def test_expiry_is_announced_once_and_ends_entitlement(db_session, test_clinic, test_user):
    row = _addon_row(db_session, test_clinic, "own_whatsapp", days=1)
    row.current_end = NOW() - dt.timedelta(minutes=5)
    db_session.commit()
    svc = AddonService(db_session)
    svc.sweep()
    svc.sweep()
    db_session.refresh(row)
    assert row.status == "expired"
    assert _notes(db_session, test_clinic, "addon_expired") == 1


def test_clinics_whose_plan_includes_it_hear_nothing(db_session, test_clinic, test_user):
    _subscribe(db_session, test_clinic, "pro")
    row = _addon_row(db_session, test_clinic, "own_whatsapp", days=2, source="grace")
    AddonService(db_session).sweep()
    assert _notes(db_session, test_clinic, "addon_renewal_due") == 0
    row.current_end = NOW() - dt.timedelta(minutes=1)
    db_session.commit()
    AddonService(db_session).sweep()
    assert _notes(db_session, test_clinic, "addon_expired") == 0


def test_a_connected_number_that_lost_its_plan_is_told_once(db_session, test_clinic, test_user):
    from models import WhatsAppIntegration
    db_session.add(WhatsAppIntegration(clinic_id=test_clinic.id, status="connected", session_id="ws"))
    db_session.commit()
    svc = AddonService(db_session)
    svc.sweep()
    svc.sweep()
    assert _notes(db_session, test_clinic, "own_number_not_included") == 1


# ── own-number WhatsApp is really gated ──────────────────────────────────────

@pytest.fixture
def wareach_configured(monkeypatch):
    from domains.notification.services import wareach_service
    monkeypatch.setattr(wareach_service, "WAREACH_URL", "http://wareach.test:3000")
    monkeypatch.setattr(wareach_service, "WAREACH_PARTNER_KEY", "partner-key")
    monkeypatch.setattr(wareach_service, "WAREACH_MOCK", False)
    return wareach_service


def _connected(db, clinic, wareach_service):
    from models import WhatsAppIntegration
    db.add(WhatsAppIntegration(clinic_id=clinic.id, status="connected", session_id="ws-1",
                               api_key_enc=wareach_service.encrypt_key("wr_key")))
    db.commit()


def test_plus_without_the_addon_routes_to_msg91(db_session, test_clinic, wareach_configured):
    _connected(db_session, test_clinic, wareach_configured)
    assert wareach_configured.get_active_integration(db_session, test_clinic.id) is None
    _addon_row(db_session, test_clinic, "own_whatsapp", days=5, source="grace")
    assert wareach_configured.get_active_integration(db_session, test_clinic.id) is not None


def test_connect_asks_for_the_addon_on_plus(client, auth_headers, wareach_configured):
    r = client.post("/api/v1/integrations/wareach/connect", headers=auth_headers)
    assert r.status_code == 402
    assert "add-on" in r.json()["detail"]
    status = client.get("/api/v1/integrations/wareach/status", headers=auth_headers).json()
    assert status["entitled"] is False and status["included_by_plan"] is False


def test_status_reports_the_grace_period(client, auth_headers, db_session, test_clinic, wareach_configured):
    _addon_row(db_session, test_clinic, "own_whatsapp", days=12, source="grace")
    status = client.get("/api/v1/integrations/wareach/status", headers=auth_headers).json()
    assert status["entitled"] is True and status["addon_source"] == "grace" and status["addon_until"]


def test_addons_endpoint_is_readable_by_the_clinic(client, auth_headers):
    r = client.get("/api/v1/subscriptions/addons", headers=auth_headers)
    assert r.status_code == 200
    assert [i["key"] for i in r.json()["addons"]] == ["own_whatsapp", "gbp_management", "upi_payments", "xray_integration"]


def test_order_ids_round_trip_and_fit_cashfree():
    for key in addons.ADDONS:
        for cycle in addons.CYCLES:
            oid = addons.order_id(99999, key, cycle, "abcdef")
            assert len(oid) <= 45
            assert addons.parse_order_id(oid) == (99999, key, cycle)
    assert addons.parse_order_id("SUB_1_2_abc") is None
    assert addons.parse_order_id("ADD_1_not_a_thing_m_x_y") is None
