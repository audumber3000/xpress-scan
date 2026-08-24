"""
The subscription catalogue: what the three plans cost, and what they allow.

One module, because plan names used to be string literals in about twenty
places across both stacks, two of which were real feature gates (who may add a
branch, who may send WhatsApp from their own number). A pricing change meant
finding all twenty, and the two gates were the ones nobody would notice going
wrong until a customer paid for something they did not get.

Everything that needs to know about a plan asks here.

## Currency, and the one rule that is not negotiable

An Indian clinic is never shown a dollar figure. Not as an estimate, not in
brackets, not as a "roughly". `catalogue()` returns prices in the clinic's own
billing currency and nothing else, so a USD number is not merely hidden from
Indian clinics, it never leaves the server for them.

Outside India the reverse holds: those clinics are billed in USD and shown USD.
The old behaviour of quoting a converted rupee price is gone, along with the bug
it caused (a Canadian clinic quoted $10, then $899, then debited CA$14.60).

## Plan names on the wire

A stored `plan_name` carries the billing cycle: `plus`, `plus_annual`, `pro`,
`pro_annual`, and so on. That matches the shape the database already holds
(`professional` / `professional_annual`) so no row has to be rewritten to be
readable, and `resolve()` splits it back into (key, cycle).

`LEGACY_ALIASES` maps every name production has ever stored onto the new three.
It is what stops an old subscription row, or a mobile build from before this
change, from 500-ing. Do not delete it: rows written in 2025 outlive the code
that wrote them.
"""
import datetime as _dt
from typing import Optional, Tuple

# ── The catalogue ────────────────────────────────────────────────────────────
#
# Prices are per month in the plan's own currency. Annual figures are the TOTAL
# billed once a year, not a monthly equivalent, because that is the number that
# leaves the customer's account.
#
# The annual totals are 20% off twelve months, which is what the pricing page
# advertises. Worth checking the arithmetic when these move: an annual price
# that equals monthly x 12 while the page claims a saving is the kind of thing
# a customer with a calculator finds before we do.
#
# A limit of None means unlimited, and is rendered as "Unlimited" rather than
# as a number. Nothing enforces these yet; they are the figures the usage
# meters and the over-limit nudge measure against.
PLANS = {
    "plus": {
        "rank": 1,
        "label": "Plus",
        "tagline": "Everything one clinic needs to run its day",
        "popular": True,
        "price": {
            "INR": {"monthly": 399, "annual": 3830},
            "USD": {"monthly": 4, "annual": 38},
        },
        "limits": {
            "branches": 1,
            "staff": 5,
            "patients": 500,
            "appointments": 500,
            "storage_gb": 100,
            "report_months": 12,
        },
        "features": [
            "1 clinic location",
            "5 staff logins",
            "500 new patients and 500 appointments a month",
            "100 GB storage",
            "12 months of report history",
            "WhatsApp and email reminders from the MolarPlus number",
            "3 ready-made role presets",
        ],
    },
    "pro": {
        "rank": 2,
        "label": "Pro",
        "tagline": "For clinics running more than one branch",
        "popular": False,
        "price": {
            "INR": {"monthly": 999, "annual": 9590},
            "USD": {"monthly": 8, "annual": 77},
        },
        "limits": {
            "branches": 5,
            "staff": 10,
            "patients": 1000,
            "appointments": 1000,
            "storage_gb": 150,
            "report_months": None,
        },
        "features": [
            "Everything in Plus, plus:",
            "Up to 5 branches",
            "10 staff logins",
            "1,000 new patients and appointments a month",
            "150 GB storage",
            "WhatsApp from your own number",
            "Per-person permissions across 13 modules",
            "One inbox for email and WhatsApp",
            "Local competitor tracking",
            "Your own clinic website",
            "Unlimited reports and bulk export",
            "Priority support",
        ],
    },
    "growth": {
        "rank": 3,
        "label": "Growth",
        "tagline": "For clinic groups scaling without limits",
        "popular": False,
        "price": {
            "INR": {"monthly": 1500, "annual": 14400},
            "USD": {"monthly": 12, "annual": 115},
        },
        "limits": {
            "branches": None,
            "staff": None,
            "patients": None,
            "appointments": None,
            "storage_gb": None,
            "report_months": None,
        },
        "features": [
            "Everything in Pro, plus:",
            "Unlimited branches",
            "Unlimited staff logins",
            "Unlimited patients and appointments",
            "Unlimited storage",
            "Cross-branch reporting",
            "Assisted onboarding and migration",
            "A named support contact",
        ],
    },
}

# Printed once under the three cards. The point of this list is that nothing
# clinical is behind a higher plan, which is the single most reassuring thing
# on the page and the reason a small clinic can pick Plus without worrying.
INCLUDED_IN_EVERY_PLAN = [
    "Full clinical suite: charting, treatment plans, prescriptions",
    "Invoicing, expenses, inventory, and vendor management",
    "Lab order tracking",
    "E-sign consent forms",
    "Online booking page for patients",
    "Google Reviews integration",
    "12 practice reports, plus attendance and audit logs",
    "Apps for Web, iOS, Android, and Windows",
]

DEFAULT_PLAN = "plus"
TRIAL_PLAN = "pro"      # every trial is a Pro trial
TRIAL_DAYS = 7

# Every plan_name production has ever written, mapped onto the current three.
# `free` becomes plus because that is what the migration grants: the old free
# tier is the new entry tier, not a fourth plan.
LEGACY_ALIASES = {
    "free": "plus",
    "starter": "plus",
    "professional": "pro",
    "professional_annual": "pro_annual",
    "enterprise": "growth",
}

CYCLES = ("monthly", "annual")
_ANNUAL_SUFFIX = "_annual"


# ── Reading a plan name ──────────────────────────────────────────────────────
def resolve(plan_name: Optional[str]) -> Tuple[str, str]:
    """Split any stored plan name into (key, cycle).

    Total by design: an unknown or missing name resolves to the default plan on
    a monthly cycle rather than raising. A subscription screen that 500s is
    worse than one showing the entry plan, and this is called from read paths
    (auth/me, the header badge) where there is nothing useful to do with an
    exception.
    """
    raw = (plan_name or "").strip().lower()
    raw = LEGACY_ALIASES.get(raw, raw)

    cycle = "monthly"
    if raw.endswith(_ANNUAL_SUFFIX):
        cycle = "annual"
        raw = raw[: -len(_ANNUAL_SUFFIX)]

    return (raw if raw in PLANS else DEFAULT_PLAN), cycle


def key_of(plan_name: Optional[str]) -> str:
    return resolve(plan_name)[0]


def cycle_of(plan_name: Optional[str]) -> str:
    return resolve(plan_name)[1]


def stored_name(key: str, cycle: str = "monthly") -> str:
    """The inverse: what to write to `subscriptions.plan_name`."""
    key = key if key in PLANS else DEFAULT_PLAN
    return f"{key}{_ANNUAL_SUFFIX}" if cycle == "annual" else key


def effective_plan(
    plan_name: Optional[str],
    status: Optional[str] = None,
    current_end: Optional["_dt.datetime"] = None,
    now: Optional["_dt.datetime"] = None,
) -> str:
    """What a clinic is entitled to RIGHT NOW, which is not always what it bought.

    Two columns hold "the plan" and they legitimately disagree.
    `subscriptions.plan_name` is the last thing the clinic bought or trialled and
    keeps saying so after it lapses, which is the record you want when asking
    "what did they have". `clinics.subscription_plan` is rewritten to the entry
    plan by the auto-downgrade, which is the answer you want when asking "what
    can they do".

    Reading the wrong one is how the header came to say Plus while the
    Subscription page said Pro for the same clinic on the same screen. Anything
    answering "what plan is this" calls here instead of picking a column.

    An expired subscription resolves to the entry plan: the trial is over, and
    what is left is what everybody has.
    """
    now = now or _dt.datetime.utcnow()
    expired = bool(current_end and current_end < now) or status == "expired"
    return DEFAULT_PLAN if expired else key_of(plan_name)


def label(plan_name: Optional[str]) -> str:
    """"Pro, annual" — for invoices, billing history and the header badge."""
    key, cycle = resolve(plan_name)
    return f"{PLANS[key]['label']}, annual" if cycle == "annual" else PLANS[key]["label"]


def rank(plan_name: Optional[str]) -> int:
    return PLANS[key_of(plan_name)]["rank"]


# ── What a plan allows ───────────────────────────────────────────────────────
def limit(plan_name: Optional[str], field: str) -> Optional[int]:
    """The cap for `field`, or None for unlimited."""
    return PLANS[key_of(plan_name)]["limits"].get(field)


def allows_branches(plan_name: Optional[str]) -> bool:
    """May this plan run more than one clinic?

    Replaces the `PAID_PLANS` tuple that used to sit inline in clinics.py. The
    question is about branches, so ask it that way rather than about payment:
    under the old free-for-one-clinic model those were the same question, and
    they no longer are.
    """
    max_branches = limit(plan_name, "branches")
    return max_branches is None or max_branches > 1


def max_branches(plan_name: Optional[str]) -> Optional[int]:
    return limit(plan_name, "branches")


def has_own_whatsapp_number(plan_name: Optional[str]) -> bool:
    """WA Reach, which is Pro and above. Was `PRO_PLANS` in wareach_service."""
    return rank(plan_name) >= PLANS["pro"]["rank"]


# ── Money ────────────────────────────────────────────────────────────────────
INR = "INR"
USD = "USD"
GST_RATE = 0.18          # India only, added at checkout
_INDIA = "IN"


def billing_currency(clinic) -> str:
    """What this clinic is charged in, and therefore all it is ever shown.

    India pays in rupees. Everywhere else pays in US dollars.

    An unknown or missing country counts as India. That is the safe direction
    twice over: `clinics.country` defaults to 'IN' so a NULL almost certainly
    IS an Indian clinic, and if it is not, showing rupees to somebody abroad is
    a smaller failure than showing dollars to somebody in India, which is the
    one thing this must never do.
    """
    country = (getattr(clinic, "country", None) or _INDIA).upper()
    return INR if country == _INDIA else USD


def is_india(clinic) -> bool:
    return billing_currency(clinic) == INR


def gst_rate(clinic) -> float:
    """18% on Indian invoices, nothing elsewhere.

    Clinics abroad owe their own local tax, which we neither compute nor
    collect. Returning 0 here says exactly that, rather than pretending the
    question does not exist.
    """
    return GST_RATE if is_india(clinic) else 0.0


def price(plan_name: Optional[str], currency: str = INR) -> float:
    """List price for the plan and cycle encoded in `plan_name`, before tax."""
    key, cycle = resolve(plan_name)
    table = PLANS[key]["price"].get(currency) or PLANS[key]["price"][INR]
    return float(table[cycle])


def price_with_tax(plan_name: Optional[str], clinic) -> dict:
    """What actually gets charged, itemised.

    Returned as three numbers rather than one so the checkout screen and the
    invoice can show the tax line separately. They have to agree, and the only
    way to guarantee that is for both to read the same function.
    """
    currency = billing_currency(clinic)
    base = price(plan_name, currency)
    tax = round(base * gst_rate(clinic), 2)
    return {
        "currency": currency,
        "base": round(base, 2),
        "tax": tax,
        "tax_rate": gst_rate(clinic),
        "total": round(base + tax, 2),
    }


# ── For the client ───────────────────────────────────────────────────────────
def catalogue(clinic=None) -> dict:
    """The three plans, priced in this clinic's currency and no other.

    The currency filtering is the enforcement point for the rule at the top of
    this module. An Indian clinic's response contains no USD field at all, so
    no frontend bug, cached bundle or third-party client can put a dollar sign
    in front of an Indian dentist.
    """
    currency = billing_currency(clinic) if clinic is not None else INR
    monthly_of = lambda p: p["price"][currency]["monthly"]  # noqa: E731

    plans = []
    for key, plan in sorted(PLANS.items(), key=lambda kv: kv[1]["rank"]):
        monthly = monthly_of(plan)
        annual = plan["price"][currency]["annual"]
        plans.append({
            "key": key,
            "label": plan["label"],
            "tagline": plan["tagline"],
            "popular": plan["popular"],
            "rank": plan["rank"],
            "currency": currency,
            "monthly": monthly,
            "annual_total": annual,
            # The number the card leads with on the annual toggle. Rounded
            # because a price per month is a comparison aid, not an amount
            # anybody is charged.
            "annual_monthly": round(annual / 12, 2),
            "annual_pct_off": (
                round((1 - annual / (monthly * 12)) * 100) if monthly else 0
            ),
            "limits": plan["limits"],
            "features": plan["features"],
        })

    return {
        "currency": currency,
        "tax_rate": gst_rate(clinic) if clinic is not None else GST_RATE,
        "tax_label": "GST" if currency == INR else None,
        "trial_plan": TRIAL_PLAN,
        "trial_days": TRIAL_DAYS,
        "included_in_every_plan": INCLUDED_IN_EVERY_PLAN,
        "plans": plans,
    }
