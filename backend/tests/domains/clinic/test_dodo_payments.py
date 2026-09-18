"""Plans paid abroad through Dodo Payments, and plans paid in India still through Cashfree.

What these pin:

  * the webhook signature (Standard Webhooks): good, forged, stale, rotated,
    and no secret at all
  * routing by currency: a clinic abroad gets a Dodo checkout for the exact
    dollar amount from core.plans, an Indian clinic still gets Cashfree, and a
    box without Dodo keys refuses the dollar order up front
  * settlement: the webhook and the return page, replay-safe, booked in the
    currency and with the tax Dodo reports
  * a superseded checkout: paying the first of two open orders gets the first
    order's plan, not the second's
  * the Cashfree path through the shared activation, unchanged
"""
import base64
import json
import time

import pytest

from core import dodo_webhook
from domains.clinic.services.subscription_service import SubscriptionService


SECRET = "whsec_" + base64.b64encode(b"a-test-signing-key-of-some-length").decode()


# ── fakes ────────────────────────────────────────────────────────────────────

class FakeCashfree:
    orders = []
    status = {}

    def __init__(self):
        pass

    def create_order(self, amount, customer_id, order_id, notes=None, currency="INR"):
        FakeCashfree.orders.append({"amount": amount, "order_id": order_id, "currency": currency})
        return {"payment_session_id": f"session-{order_id}"}

    def get_subscription(self, order_id):
        return FakeCashfree.status.get(order_id, {"order_status": "ACTIVE"})


class FakeDodo:
    def __init__(self):
        self.checkouts = []
        self.sessions = {}
        self.payments = {}

    def create_checkout(self, **kw):
        self.checkouts.append(kw)
        sid = f"cks_{len(self.checkouts)}"
        self.sessions[sid] = {"id": sid, "payment_id": None, "payment_status": None}
        return {"session_id": sid, "checkout_url": f"https://checkout.dodo.test/{sid}"}

    def get_checkout(self, session_id):
        return self.sessions[session_id]

    def get_payment(self, payment_id):
        return self.payments[payment_id]

    def pay(self, session_id, checkout, total_cents, tax_cents=0):
        """The clinic pays: the session gets a payment, as Dodo's would."""
        pid = f"pay_{session_id}"
        self.sessions[session_id].update(payment_id=pid, payment_status="succeeded")
        self.payments[pid] = {
            "payment_id": pid,
            "status": "succeeded",
            "total_amount": total_cents,
            "tax": tax_cents,
            "currency": "USD",
            "checkout_session_id": session_id,
            "metadata": {"order_id": checkout["order_id"], **checkout["metadata"]},
            "created_at": "2026-09-19T10:00:00Z",
            "updated_at": "2026-09-19T10:00:05Z",
        }
        return self.payments[pid]


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.setenv("CASHFREE_APP_ID", "test")
    monkeypatch.setenv("CASHFREE_SECRET_KEY", "test")
    monkeypatch.setenv("DODO_PAYMENTS_API_KEY", "test")
    monkeypatch.setenv("DODO_PRODUCT_ID", "pdt_test")
    monkeypatch.setenv("DODO_PAYMENTS_WEBHOOK_KEY", SECRET)
    monkeypatch.setenv("CASHFREE_RETURN_URL", "https://app.test/subscription")
    monkeypatch.setattr("domains.clinic.services.subscription_service.CashfreeProvider", FakeCashfree)
    FakeCashfree.orders = []
    FakeCashfree.status = {}


@pytest.fixture
def dodo(monkeypatch):
    fake = FakeDodo()
    monkeypatch.setattr(SubscriptionService, "dodo", property(lambda self: fake))
    return fake


@pytest.fixture
def sub(db_session, test_clinic, test_user):
    """The owner on an ended Plus trial, owning the clinic, as most of prod is."""
    import datetime as dt
    from models import Subscription, user_clinics
    db_session.execute(user_clinics.insert().values(user_id=test_user.id, clinic_id=test_clinic.id,
                                                    role="clinic_owner"))
    row = Subscription(
        clinic_id=test_clinic.id, user_id=test_user.id, plan_name="plus", status="expired",
        provider="trial", is_trial=True, trial_used=True,
        current_start=dt.datetime.utcnow() - dt.timedelta(days=30),
        current_end=dt.datetime.utcnow() - dt.timedelta(days=23),
    )
    db_session.add(row)
    db_session.commit()
    return row


@pytest.fixture
def abroad(db_session, test_clinic):
    test_clinic.country = "US"
    db_session.commit()
    return test_clinic


def _checkout(client, auth_headers, plan="pro", coupon=None):
    r = client.post("/api/v1/subscriptions/checkout", headers=auth_headers,
                    json={"plan_name": plan, "coupon_code": coupon})
    assert r.status_code == 200, r.text
    return r.json()


def _signed(body: dict, secret=SECRET, stamp=None, msg_id="msg_1"):
    raw = json.dumps(body).encode()
    stamp = str(stamp or int(time.time()))
    headers = {
        "Content-Type": "application/json",
        "webhook-id": msg_id,
        "webhook-timestamp": stamp,
        "webhook-signature": dodo_webhook.sign(secret, msg_id, stamp, raw),
    }
    return raw, headers


def _deliver(client, payment, event="payment.succeeded", **kw):
    body = {"business_id": "bus_1", "type": event, "timestamp": "2026-09-19T10:00:05Z",
            "data": {"payload_type": "Payment", **payment}}
    raw, headers = _signed(body, **kw)
    return client.post("/api/v1/subscriptions/webhook/dodo", content=raw, headers=headers)


def _payments(db_session, clinic):
    from models import SubscriptionPayment
    return db_session.query(SubscriptionPayment).filter(SubscriptionPayment.clinic_id == clinic.id).all()


# ── the signature ────────────────────────────────────────────────────────────

def test_a_correctly_signed_payload_verifies():
    raw = b'{"type":"payment.succeeded"}'
    stamp = str(int(time.time()))
    sig = dodo_webhook.sign(SECRET, "msg_1", stamp, raw)
    assert dodo_webhook.verify(raw, "msg_1", sig, stamp) == (True, "")


def test_a_forged_or_altered_payload_is_refused():
    raw = b'{"type":"payment.succeeded"}'
    stamp = str(int(time.time()))
    sig = dodo_webhook.sign(SECRET, "msg_1", stamp, raw)
    assert dodo_webhook.verify(raw + b" ", "msg_1", sig, stamp)[0] is False
    assert dodo_webhook.verify(raw, "msg_2", sig, stamp)[0] is False
    other = "whsec_" + base64.b64encode(b"somebody-else").decode()
    assert dodo_webhook.verify(raw, "msg_1", dodo_webhook.sign(other, "msg_1", stamp, raw), stamp)[0] is False


def test_a_stale_payload_is_refused():
    raw = b"{}"
    stamp = str(int(time.time()) - 3600)
    assert dodo_webhook.verify(raw, "m", dodo_webhook.sign(SECRET, "m", stamp, raw), stamp) == (
        False, "timestamp too old (3600s)")


def test_any_signature_in_a_rotation_header_is_enough():
    raw = b"{}"
    stamp = str(int(time.time()))
    header = "v1,bm90LXRoaXMtb25l " + dodo_webhook.sign(SECRET, "m", stamp, raw)
    assert dodo_webhook.verify(raw, "m", header, stamp)[0] is True


def test_no_secret_fails_closed(monkeypatch):
    monkeypatch.delenv("DODO_PAYMENTS_WEBHOOK_KEY")
    raw = b"{}"
    stamp = str(int(time.time()))
    assert dodo_webhook.verify(raw, "m", dodo_webhook.sign(SECRET, "m", stamp, raw), stamp)[0] is False


def test_the_route_rejects_an_unsigned_delivery(client):
    r = client.post("/api/v1/subscriptions/webhook/dodo", content=b'{"type":"payment.succeeded"}',
                    headers={"Content-Type": "application/json"})
    assert r.status_code == 401


# ── routing ──────────────────────────────────────────────────────────────────

def test_a_clinic_abroad_gets_a_dodo_checkout_for_the_exact_dollar_price(client, auth_headers, abroad, sub, dodo):
    data = _checkout(client, auth_headers, "pro_annual")
    assert data["provider"] == "dodo"
    assert data["checkout_url"].startswith("https://checkout.dodo.test/")
    assert (data["currency"], data["tax"], data["amount"]) == ("USD", 0, 77.0)

    sent = dodo.checkouts[0]
    assert sent["amount"] == 77.0 and sent["plan_key"] == "pro"
    assert sent["return_url"] == f"https://app.test/subscription?order_id={data['order_id']}"
    assert sent["metadata"]["plan"] == "pro_annual"
    assert FakeCashfree.orders == [], "a dollar order never reaches Cashfree"


def test_an_indian_clinic_still_pays_through_cashfree(client, auth_headers, sub, dodo):
    data = _checkout(client, auth_headers, "plus")
    assert data["provider"] == "cashfree" and data["payment_session_id"]
    assert (data["currency"], data["amount"]) == ("INR", 470.82)
    assert dodo.checkouts == []


def test_without_dodo_keys_a_dollar_order_is_refused_up_front(client, auth_headers, abroad, sub, monkeypatch):
    monkeypatch.delenv("DODO_PRODUCT_ID")
    r = client.post("/api/v1/subscriptions/checkout", headers=auth_headers, json={"plan_name": "pro"})
    assert r.status_code == 400 and "not enabled yet" in r.json()["detail"]


def test_opening_a_dodo_checkout_leaves_the_live_plan_alone(client, auth_headers, db_session, abroad, sub, dodo):
    data = _checkout(client, auth_headers, "growth")
    db_session.refresh(sub)
    assert (sub.plan_name, sub.status, sub.provider) == ("plus", "expired", "trial")
    assert sub.notes["pending_plan"] == "growth"
    assert sub.notes["pending_checkout"] == {"gateway": "dodo", "order_id": data["order_id"], "session_id": "cks_1"}


# ── settlement ───────────────────────────────────────────────────────────────

def test_the_webhook_activates_the_plan_and_books_it_once(client, auth_headers, db_session, abroad, sub, dodo):
    data = _checkout(client, auth_headers, "pro")
    payment = dodo.pay("cks_1", dodo.checkouts[0], total_cents=800, tax_cents=120)

    for msg in ("msg_1", "msg_1_retry"):
        r = _deliver(client, payment, msg_id=msg)
        assert r.status_code == 200, r.text

    db_session.refresh(sub)
    assert (sub.plan_name, sub.status, sub.provider, sub.is_trial) == ("pro", "active", "dodo", False)
    assert sub.provider_subscription_id == payment["payment_id"]
    assert "pending_plan" not in sub.notes and "pending_checkout" not in sub.notes
    assert abroad.subscription_plan == "pro"

    [paid] = _payments(db_session, abroad)
    assert (paid.provider, paid.provider_order_id, paid.amount, paid.tax_amount, paid.currency) == (
        "dodo", data["order_id"], 8.0, 1.2, "USD")


def test_the_return_page_settles_it_when_the_webhook_is_late(client, auth_headers, db_session, abroad, sub, dodo):
    data = _checkout(client, auth_headers, "plus_annual")
    r = client.get(f"/api/v1/subscriptions/verify-status?order_id={data['order_id']}", headers=auth_headers)
    assert r.status_code == 400, "nothing paid yet"

    payment = dodo.pay("cks_1", dodo.checkouts[0], total_cents=3800)
    r = client.get(f"/api/v1/subscriptions/verify-status?order_id={data['order_id']}", headers=auth_headers)
    assert r.status_code == 200 and r.json()["success"] is True
    db_session.refresh(sub)
    assert (sub.plan_name, sub.provider) == ("plus_annual", "dodo")

    # The webhook arriving afterwards changes nothing, and the page asked
    # again still says paid, although the parked checkout is gone.
    end = sub.current_end
    assert _deliver(client, payment).status_code == 200
    r = client.get(f"/api/v1/subscriptions/verify-status?order_id={data['order_id']}", headers=auth_headers)
    assert r.status_code == 200
    db_session.refresh(sub)
    assert sub.current_end == end and len(_payments(db_session, abroad)) == 1


def test_paying_a_superseded_checkout_gets_that_checkouts_plan(client, auth_headers, db_session, abroad, sub, dodo):
    first = _checkout(client, auth_headers, "growth")
    _checkout(client, auth_headers, "plus")      # opened afterwards, never paid
    payment = dodo.pay("cks_1", dodo.checkouts[0], total_cents=1200)

    assert _deliver(client, payment).status_code == 200
    db_session.refresh(sub)
    assert sub.plan_name == "growth"
    [paid] = _payments(db_session, abroad)
    assert paid.provider_order_id == first["order_id"]


def test_a_coupon_is_counted_and_printed_from_its_own_order(client, auth_headers, db_session, abroad, sub, dodo):
    from models import SubscriptionCoupon
    db_session.add(SubscriptionCoupon(code="HALF", discount_percent=50, is_active=True, used_count=0))
    db_session.commit()

    data = _checkout(client, auth_headers, "pro", coupon="HALF")
    assert data["amount"] == 4.0 and dodo.checkouts[0]["amount"] == 4.0
    payment = dodo.pay("cks_1", dodo.checkouts[0], total_cents=400)
    assert _deliver(client, payment).status_code == 200

    [paid] = _payments(db_session, abroad)
    assert (paid.coupon_code, paid.discount_amount) == ("HALF", 4.0)
    coupon = db_session.query(SubscriptionCoupon).filter(SubscriptionCoupon.code == "HALF").first()
    db_session.refresh(coupon)
    assert coupon.used_count == 1


def test_a_failed_payment_tells_the_owner_and_changes_nothing(client, auth_headers, db_session, abroad, sub, dodo):
    from models import Notification
    data = _checkout(client, auth_headers, "pro")
    r = _deliver(client, {"payment_id": "pay_x", "status": "failed", "error_message": "Card declined",
                          "metadata": {"order_id": data["order_id"]}}, event="payment.failed")
    assert r.status_code == 200
    db_session.refresh(sub)
    assert (sub.plan_name, sub.status) == ("plus", "expired")
    assert _payments(db_session, abroad) == []
    note = db_session.query(Notification).filter(Notification.event_type == "subscription_payment_failed").first()
    assert note is not None and "Card declined" in note.body


def test_events_we_do_not_handle_are_acknowledged(client):
    r = _deliver(client, {"refund_id": "ref_1"}, event="refund.succeeded")
    assert r.status_code == 200


# ── Cashfree, through the same activation ────────────────────────────────────

def test_cashfree_webhook_still_activates_and_splits_gst(client, auth_headers, db_session, test_clinic, sub, monkeypatch):
    data = _checkout(client, auth_headers, "plus")
    monkeypatch.setattr("core.cashfree_webhook.verify_request", lambda raw, headers: (True, ""))
    body = {"data": {"order": {"order_id": data["order_id"]},
                     "payment": {"payment_status": "SUCCESS", "cf_payment_id": "cf-1",
                                 "payment_amount": 470.82}}}
    for _ in range(2):
        r = client.post("/api/v1/subscriptions/webhook/cashfree", content=json.dumps(body),
                        headers={"Content-Type": "application/json"})
        assert r.status_code == 200

    db_session.refresh(sub)
    assert (sub.plan_name, sub.status, sub.provider, sub.provider_subscription_id) == ("plus", "active", "cashfree", "cf-1")
    [paid] = _payments(db_session, test_clinic)
    assert (paid.amount, paid.tax_amount, paid.currency) == (470.82, 71.82, "INR")


def test_cashfree_return_page_still_activates(client, auth_headers, db_session, test_clinic, sub):
    data = _checkout(client, auth_headers, "pro")
    FakeCashfree.status[data["order_id"]] = {"order_status": "PAID", "order_amount": 1178.82, "cf_order_id": "cf-o"}
    r = client.get(f"/api/v1/subscriptions/verify-status?order_id={data['order_id']}", headers=auth_headers)
    assert r.status_code == 200
    db_session.refresh(sub)
    assert (sub.plan_name, sub.provider) == ("pro", "cashfree")
    assert sub.provider_subscription_id is None, "the return page never set it, and still does not"
    [paid] = _payments(db_session, test_clinic)
    assert (paid.provider_payment_id, paid.amount) == ("cf-o", 1178.82)
