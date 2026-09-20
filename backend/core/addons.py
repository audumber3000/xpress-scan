"""
Add-ons: paid features a clinic buys on top of its plan, per clinic location.

The sibling of `core.plans`, and it follows the same rules. One module owns what
an add-on is called, what it costs and who already has it, and everything else
asks here: the Subscription page, checkout, the Cashfree webhook, and the
feature gates themselves (own-number WhatsApp today).

## Per location, not per owner

A plan belongs to the owner and covers every branch. An add-on belongs to one
clinic location, because what it sells is per location: each branch has its own
WhatsApp number and its own Google profile. `clinic_addons` is keyed on
(clinic_id, addon_key) for that reason.

## Included by plan

Some add-ons come free with a higher plan (own-number WhatsApp with Pro). That
is decided by the plan the clinic is entitled to RIGHT NOW, the same effective
plan the header shows, so a Pro trial includes it and an expired trial does not.

## Currency

India only, for now. Plans abroad are paid in dollars through Dodo Payments
(core.payment_gateways), but no add-on has a dollar price yet, so an add-on is
not offered outside India at all rather than quoted in a currency it has no
price in. Same rule as plans: an Indian clinic is never shown a dollar figure,
and here nobody is shown one.

## Coming soon

An add-on can be listed before it can be bought (`availability: coming_soon`).
The card shows what it will cost and who gets it included, and takes interest,
but checkout refuses it. Selling something that does not work yet is how a
clinic ends up paying for a promise.
"""
import datetime as _dt
from typing import Optional

from dateutil.relativedelta import relativedelta

from core import plans

LIVE = "live"
COMING_SOON = "coming_soon"

AUTO = "auto"          # the software does it the moment it is paid
MANAGED = "managed"    # our team does the work after purchase

# Prices are per month; annual is the TOTAL for a year, 20% off twelve months,
# the same discount the plans advertise. `price: None` means not priced yet.
#
# `included_from_rank`: the plan rank from which the add-on is free. None means
# it is never included, on any plan.
# Pro and above include every add-on. That is the whole shape of the ladder:
# Plus buys what it needs one at a time, Pro stops counting.
ADDONS = {
    "own_whatsapp": {
        "order": 1,
        "label": "Your own WhatsApp number",
        "description": "Patient reminders, invoices and prescriptions go out from your clinic's own WhatsApp number.",
        "icon": "whatsapp",
        "availability": LIVE,
        "fulfilment": AUTO,
        "price": {"INR": {"monthly": 289, "annual": 2774}},
        "included_from_rank": plans.PLANS["pro"]["rank"],
        "manage_link": "/admin/integrations/whatsapp",
    },
    "gbp_management": {
        "order": 2,
        "label": "Google Business Profile management",
        "description": "We get your phone number, timings and clinic details updated and approved on Google for you.",
        "icon": "google_business",
        "availability": LIVE,
        "fulfilment": MANAGED,
        "price": {"INR": {"monthly": 150, "annual": 1440}},
        "included_from_rank": plans.PLANS["pro"]["rank"],
        "manage_link": None,
    },
    "upi_payments": {
        "order": 3,
        "label": "UPI payments with QR",
        "description": "Patients pay by UPI QR at the desk, and the bill marks itself paid once the bank confirms.",
        "icon": "upi",
        "availability": COMING_SOON,
        "fulfilment": AUTO,
        # Included with Pro; a Plus clinic adds it.
        "price": {"INR": {"monthly": 200, "annual": 1920}},
        "included_from_rank": plans.PLANS["pro"]["rank"],
        "manage_link": "/admin/integrations/payments",
    },
    "xray_integration": {
        "order": 4,
        "label": "RVG and X-ray integration",
        "description": "Vatech, Carestream and other sensors, captured straight into the patient's file.",
        "icon": "xray",
        "availability": COMING_SOON,
        "fulfilment": AUTO,
        "price": {"INR": {"monthly": 350, "annual": 3360}},
        "included_from_rank": plans.PLANS["pro"]["rank"],
        "manage_link": "/admin/integrations/xray",
    },
}

CYCLES = ("monthly", "annual")
STATUS_ACTIVE = "active"
STATUS_EXPIRED = "expired"
STATUS_CANCELLED = "cancelled"

SOURCE_PAID = "paid"
SOURCE_GRACE = "grace"
SOURCE_SUPPORT = "support"

# Google Business Profile management, as the team works through it.
SERVICE_STEPS = ("requested", "access_given", "in_progress", "done")

ORDER_PREFIX = "ADD_"
_PAYMENT_PREFIX = "addon:"


# ── The catalogue ────────────────────────────────────────────────────────────
def get(key: Optional[str]) -> Optional[dict]:
    return ADDONS.get(key or "")


def is_addon_order(order_id: Optional[str]) -> bool:
    return bool(order_id) and str(order_id).startswith(ORDER_PREFIX)


def _base36(n: int) -> str:
    chars = "0123456789abcdefghijklmnopqrstuvwxyz"
    out = ""
    while n:
        n, r = divmod(n, 36)
        out = chars[r] + out
    return out or "0"


def order_id(clinic_id: int, key: str, cycle: str, nonce: str) -> str:
    """`ADD_<clinic>_<addon key>_<m|a>_<time base36>_<nonce>`.

    The order says what it is for. Looking an order up through a column that
    the next checkout overwrites is how a paid first attempt gets lost when a
    clinic opens a second one before paying, so the webhook reads the clinic,
    the add-on and the cycle straight out of the id. Kept under Cashfree's
    45-character limit.
    """
    stamp = _base36(int(_dt.datetime.utcnow().timestamp()))
    return f"{ORDER_PREFIX}{int(clinic_id)}_{key}_{'a' if cycle == 'annual' else 'm'}_{stamp}_{nonce}"


def parse_order_id(order: Optional[str]):
    """(clinic_id, addon_key, cycle) from an add-on order id, or None."""
    if not is_addon_order(order):
        return None
    parts = str(order)[len(ORDER_PREFIX):].split("_")
    # clinic, key (may contain underscores), cycle flag, stamp, nonce
    if len(parts) < 5 or not parts[0].isdigit() or parts[-3] not in ("m", "a"):
        return None
    key = "_".join(parts[1:-3])
    if key not in ADDONS:
        return None
    return int(parts[0]), key, ("annual" if parts[-3] == "a" else "monthly")


def price(key: str, cycle: str, currency: str = plans.INR) -> Optional[float]:
    """List price before tax, or None when this add-on cannot be bought in
    `currency` (not priced, or not offered there)."""
    item = get(key)
    if not item or cycle not in CYCLES or not item.get("price"):
        return None
    table = item["price"].get(currency)
    return float(table[cycle]) if table else None


def payment_plan_name(key: str, cycle: str) -> str:
    """What an add-on payment stores in `subscription_payments.plan_name`,
    which is NOT NULL and shared with plan payments."""
    return f"{_PAYMENT_PREFIX}{key}_{cycle}"


def label_for_payment(plan_name: Optional[str]) -> Optional[str]:
    """"Your own WhatsApp number, annual" for an add-on payment row, else None."""
    raw = plan_name or ""
    if not raw.startswith(_PAYMENT_PREFIX):
        return None
    rest = raw[len(_PAYMENT_PREFIX):]
    for cycle in CYCLES:
        suffix = f"_{cycle}"
        if rest.endswith(suffix):
            item = get(rest[: -len(suffix)])
            if item:
                return f"{item['label']}, {cycle}"
    return "Add-on"


def period_end(start: _dt.datetime, cycle: str) -> _dt.datetime:
    return start + (relativedelta(years=1) if cycle == "annual" else relativedelta(months=1))


# ── Who has what ─────────────────────────────────────────────────────────────
def effective_plan_for(db, clinic) -> str:
    """The plan this clinic may use right now, walking up to the parent clinic's
    subscription for a branch, exactly as the plan lock does."""
    from core import plan_state
    sub = plan_state.subscription_for(db, clinic)
    if sub is None:
        return plans.DEFAULT_PLAN
    return plans.effective_plan(sub.plan_name, sub.status, sub.current_end)


def included_by_plan(db, clinic, key: str, plan_key: Optional[str] = None) -> bool:
    item = get(key)
    if not item or clinic is None or item.get("included_from_rank") is None:
        return False
    plan_key = plan_key or effective_plan_for(db, clinic)
    return plans.rank(plan_key) >= item["included_from_rank"]


def active_row(db, clinic_id: int, key: str, now: Optional[_dt.datetime] = None):
    """The clinic's add-on row if it is running right now, else None."""
    from models import ClinicAddon
    now = now or _dt.datetime.utcnow()
    row = (
        db.query(ClinicAddon)
        .filter(ClinicAddon.clinic_id == clinic_id, ClinicAddon.addon_key == key)
        .first()
    )
    if not row or row.status != STATUS_ACTIVE:
        return None
    if row.current_end and row.current_end <= now:
        return None
    return row


def entitled(db, clinic, key: str, now: Optional[_dt.datetime] = None) -> bool:
    """May this clinic use `key` right now: included in its plan, or bought (or
    granted) and still running."""
    if clinic is None or not get(key):
        return False
    if included_by_plan(db, clinic, key):
        return True
    return active_row(db, clinic.id, key, now) is not None


# ── For the client ───────────────────────────────────────────────────────────
def _state_of(item: dict, row, included: bool, available: bool, now: _dt.datetime) -> str:
    if item["availability"] == COMING_SOON:
        # Even for a plan that includes it. "In your plan" about something a
        # clinic cannot switch on yet reads as a feature that is broken.
        return "coming_soon"
    if included:
        return "included"
    if row is not None and row.status == STATUS_ACTIVE and (not row.current_end or row.current_end > now):
        return "grace" if row.source == SOURCE_GRACE else "active"
    if not available:
        return "unavailable"
    if row is not None and row.current_end is not None and row.status in (STATUS_ACTIVE, STATUS_EXPIRED):
        return "expired"
    return "not_bought"


def catalogue(db, clinic, now: Optional[_dt.datetime] = None) -> dict:
    """Every add-on, priced for this clinic and carrying this clinic's state.

    `state` is one of included | active | grace | expired | not_bought |
    coming_soon | unavailable, decided here so the web page, the mobile app
    and the checkout all read the same answer.
    """
    import os
    from models import ClinicAddon

    now = now or _dt.datetime.utcnow()
    currency = plans.billing_currency(clinic) if clinic is not None else plans.INR
    india = currency == plans.INR
    plan_key = effective_plan_for(db, clinic) if clinic is not None else plans.DEFAULT_PLAN
    rows = {}
    if clinic is not None:
        rows = {
            r.addon_key: r
            for r in db.query(ClinicAddon).filter(ClinicAddon.clinic_id == clinic.id).all()
        }

    items = []
    for key, item in sorted(ADDONS.items(), key=lambda kv: kv[1]["order"]):
        monthly = price(key, "monthly", currency) if india else None
        annual = price(key, "annual", currency) if india else None
        priced = monthly is not None
        included = included_by_plan(db, clinic, key, plan_key) if clinic is not None else False
        included_rank = item.get("included_from_rank")
        included_plan = next(
            (p["label"] for p in plans.PLANS.values() if p["rank"] == included_rank), None
        ) if included_rank is not None else None
        row = rows.get(key)
        state = _state_of(item, row, included, india and priced, now)

        items.append({
            "key": key,
            "label": item["label"],
            "description": item["description"],
            "icon": item["icon"],
            "availability": item["availability"],
            "fulfilment": item["fulfilment"],
            "currency": currency if priced else None,
            "monthly": monthly,
            "annual_total": annual,
            "annual_monthly": round(annual / 12, 2) if annual else None,
            "annual_pct_off": round((1 - annual / (monthly * 12)) * 100) if (annual and monthly) else None,
            "priced": priced,
            "included_by_plan": included,
            "included_from_plan": included_plan,
            "state": state,
            "cycle": getattr(row, "cycle", None),
            "source": getattr(row, "source", None),
            "current_end": row.current_end.isoformat() if row is not None and row.current_end else None,
            "service_status": getattr(row, "service_status", None) if item["fulfilment"] == MANAGED else None,
            "manage_link": item["manage_link"],
        })

    return {
        "currency": currency,
        "tax_rate": plans.gst_rate(clinic) if clinic is not None else plans.GST_RATE,
        "tax_label": "GST" if india else None,
        "plan": plan_key,
        "service_steps": list(SERVICE_STEPS),
        # Who the clinic adds as a manager on its Google profile. Blank until
        # ops sets it, and the card then says the team will be in touch.
        "gbp_manager_email": os.getenv("GBP_MANAGER_EMAIL") or None,
        "addons": items,
    }
