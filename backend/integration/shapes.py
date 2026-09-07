"""Database rows → the shapes docs/integration-api.openapi.yaml declares.

One function per contract object. Everything product-specific about MolarPlus
that the CRM must not learn — that an account is a promoted parent clinic, that
the billing cycle hides inside `plan_name`, that a lapsed subscription keeps
saying what it used to be — is resolved here and never crosses the wire.

`deleted` is always `false`. MolarPlus hard-deletes: `clinics` has no
soft-delete column and `services/cascade.py` removes the row and its children
outright, so a departed account cannot appear in an incremental response the
way the contract's `deleted: true` expects. `GET /meta` declares
`"deletions": false` for exactly this reason, and the CRM detects a vanished
account by reconciling against a full snapshot instead. It is a real gap, and
closing it means a `deleted_at` column in the product.
"""
from typing import Any, Dict, Optional

from core import plans

from . import plans_view

from . import org, vocab
from .wire import ext_id, micros, money, to_rfc3339

# The human-readable half of `plan_name`. The billing cycle is deliberately not
# folded in: MolarPlus encodes it inside the stored name (`pro` vs
# `pro_annual`), and the contract splits it into `billing_cycle` precisely so
# every tier does not appear twice in the CRM with nothing to say why.
PRODUCT_LABEL = "MolarPlus"

# Statuses that are billing right now. A trial pays nothing and a cancelled or
# expired subscription pays nothing, so their MRR is zero rather than the list
# price of the plan attached to them — `mrr` means recurring revenue, and
# reporting the price of a plan nobody is paying for is how a pipeline number
# ends up on a revenue chart. `past_due` keeps its price: that money is owed,
# not gone.
BILLING_STATUSES = ("active", "past_due")


def address(clinic) -> Optional[Dict[str, Any]]:
    """The structured address, falling back to the older free-text line.

    `clinics.address` predates internationalisation and is still the only thing
    populated for older clinics, so it becomes `street` when the structured
    fields are empty. Returns None rather than a dict of nulls — an absent
    address and an address of blanks are different, and Twenty renders the
    second one as an empty card.
    """
    street = " ".join(p for p in (clinic.address_line1, clinic.address_line2) if p)
    fields = {
        "street": street or clinic.address or None,
        "city": clinic.city or None,
        "state": clinic.state or None,
        "postcode": clinic.postal_code or None,
        "country_code": (clinic.country or None) and clinic.country.upper(),
    }
    present = dict((k, v) for k, v in fields.items() if v)
    return present or None


def contact(user) -> Optional[Dict[str, Any]]:
    """The account owner, upserted in the CRM as a Person."""
    if user is None:
        return None
    return {
        "external_id": ext_id(user.id),
        "first_name": user.first_name or "",
        "last_name": user.last_name or "",
        "email": user.email,
        "phone": getattr(user, "phone", None),
    }


def account(clinic, changed_at, branch_count: int, is_trial: bool = False,
            owner=None) -> Dict[str, Any]:
    """A MolarPlus account: a parent clinic, promoted. See integration/org.py.

    `updated_at` is the newest change anywhere in the group, not the parent
    clinic's own. Renaming a branch changes the account — it changes what
    `/branches` returns for it — and an account whose `updated_at` did not move
    would never appear in an incremental pull, so the CRM would keep showing
    the old branch forever.
    """
    return {
        "id": org.account_id(clinic.id),
        "name": clinic.name or "",
        "status": vocab.account_status(clinic.status, is_trial, clinic.id),
        "email": clinic.email,
        "phone": clinic.phone,
        "address": address(clinic),
        "tax_id": clinic.tax_id or clinic.gst_number,
        "currency": (clinic.currency_code or plans_view.billing_currency(clinic.country)).upper(),
        "timezone": clinic.timezone,
        "branch_count": int(branch_count or 0),
        "created_at": to_rfc3339(clinic.created_at),
        "updated_at": to_rfc3339(changed_at or clinic.updated_at or clinic.created_at),
        "deleted": False,
        "owner": contact(owner),
    }


def branch(clinic, account_clinic_id: int, metrics) -> Dict[str, Any]:
    """A site. In MolarPlus every clinic row is one, the account's own included.

    A closed branch is not a churned account: `clinics.status` answers both
    questions and `vocab` splits them, so `cancelled` on a site whose account is
    still active reports `closed` here and leaves the account alone.
    """
    currency = (clinic.currency_code or plans_view.billing_currency(clinic.country)).upper()
    return {
        "id": ext_id(clinic.id),
        "account_id": org.account_id(account_clinic_id),
        "name": clinic.name or "",
        "code": clinic.clinic_code,
        "status": vocab.branch_status(clinic.status, clinic.id),
        "address": address(clinic),
        "end_customer_count": metrics.end_customer_count,
        "transaction_count": metrics.transaction_count,
        "monthly_gmv": money(metrics.gmv, currency),
        "last_activity_at": to_rfc3339(metrics.last_activity_at),
        "created_at": to_rfc3339(clinic.created_at),
        "updated_at": to_rfc3339(clinic.updated_at or clinic.created_at),
        "deleted": False,
    }


def account_stats(account_id: str, totals, currency: str, as_of) -> Dict[str, Any]:
    return {
        "account_id": account_id,
        "end_customer_count": totals.end_customer_count,
        "transaction_count": totals.transaction_count,
        "monthly_gmv": money(totals.gmv, currency),
        "last_activity_at": to_rfc3339(totals.last_activity_at),
        "as_of": to_rfc3339(as_of),
    }


def subscription(row, account_clinic_id: int, clinic) -> Dict[str, Any]:
    """What an account pays ClinoHealth.

    Four plan fields because they answer four different questions, and the
    product is the only place that can tell them apart:

      `plan_code`      the stored key, and what POST /plan accepts back
      `plan_tier`      the shared plus/pro/growth ladder — what they bought
      `effective_tier` what they may use now, after any auto-downgrade
      `plan_name`      what a human reads

    Retired names never leave here. Production still holds `free`, `starter`,
    `professional`, `professional_annual` and `enterprise`; `plans.resolve`
    maps every one onto the current three, because a value outside the enum is
    rejected by the sync and rows written in 2025 outlive the code that wrote
    them.
    """
    tier, cycle = plans.resolve(row.plan_name)
    status = vocab.subscription_status(row.status, bool(row.is_trial), row.id)
    currency = plans_view.billing_currency(clinic.country if clinic is not None else None)
    mrr_micros = plans_view.monthly_mrr_micros(row.plan_name, currency) if status in BILLING_STATUSES else 0

    return {
        "id": ext_id(row.id),
        "account_id": org.account_id(account_clinic_id),
        "plan_code": plans.stored_name(tier, cycle),
        "plan_tier": tier,
        "effective_tier": plans.effective_plan(row.plan_name, row.status, row.current_end),
        "plan_name": "{} {}".format(PRODUCT_LABEL, plans.PLANS[tier]["label"]),
        "billing_cycle": cycle,
        "status": status,
        "mrr": micros(mrr_micros, currency),
        "branch_limit": plans.limit(row.plan_name, "branches"),
        "staff_limit": plans.limit(row.plan_name, "staff"),
        "quantity": int(row.quantity or 1),
        "is_trial": bool(row.is_trial),
        "trial_ends_at": to_rfc3339(row.trial_ends_at),
        "current_start": to_rfc3339(row.current_start),
        "current_end": to_rfc3339(row.current_end),
        "provider": vocab.provider(row.provider, row.id),
        "provider_subscription_id": row.provider_subscription_id,
        "created_at": to_rfc3339(row.created_at),
        "updated_at": to_rfc3339(row.updated_at or row.created_at),
        "deleted": False,
    }


def payment(row, account_clinic_id: int) -> Dict[str, Any]:
    """Settled money — what MRR, ARR and revenue-over-time are actually built from.

    `amount` is what the provider settled: tax included, discount already
    deducted. `tax_amount` and `discount_amount` are the components of it where
    the product recorded them, and `null` where it did not — those columns were
    added after payments were already being taken, and sending `0` to tidy the
    response would turn "never recorded" into "there was no tax", an error every
    net-revenue figure downstream would inherit permanently.

    `subscription_payments` has no `updated_at` column, in this schema or the
    product's, so `updated_at` is derived from `paid_at` or `created_at`. A
    later status change — a refund, most importantly — does not move it and so
    does not appear in an incremental pull. Refunds are picked up by the full
    snapshot; `GET /meta` declares `"deletions": false` for the same underlying
    reason.
    """
    changed_at = row.paid_at or row.created_at
    return {
        "id": ext_id(row.id),
        "account_id": org.account_id(account_clinic_id),
        "subscription_id": ext_id(row.subscription_id),
        "plan_name": row.plan_name,
        "amount": money(row.amount, row.currency),
        "tax_amount": money(row.tax_amount, row.currency),
        "discount_amount": money(row.discount_amount, row.currency),
        "coupon_code": row.coupon_code,
        "status": vocab.payment_status(row.status, row.id),
        "paid_at": to_rfc3339(row.paid_at),
        "provider": vocab.provider(row.provider, row.id),
        "provider_payment_id": row.provider_payment_id,
        "provider_order_id": row.provider_order_id,
        "created_at": to_rfc3339(row.created_at),
        "updated_at": to_rfc3339(changed_at),
        "deleted": False,
    }


# The stage vocabulary the CRM's pipeline is built on. MolarPlus stores stage as
# free text validated against a Python list (`routes/growth.py`), so a typo has
# always been able to invent a stage. Anything unrecognised is reported as
# `new_lead` rather than passed through: the CRM's field is a real SELECT, and a
# value outside the enum would be rejected for the whole record.
LEAD_STAGES = (
    "new_lead", "contact_attempted", "connected", "demo_scheduled", "demo_done",
    "trial_started", "trial_active", "trial_expired", "negotiation", "won",
    "lost", "nurture",
)


def lead(row, account_clinic_id: Optional[int]) -> Dict[str, Any]:
    """A row of `growth_leads` as the contract's Lead.

    A lead is the one object here that need not belong to an account: most of
    them are prospects who have never signed up, so `account_id` is null until
    the clinic exists. That is also why a lead carries its own contact details
    rather than pointing at a Contact — there is nobody in `users` to point at.

    `expected_mrr` is a bare float in the product, in INR, with no currency
    column beside it. It is reported in the product's reporting currency for
    exactly that reason, and the CRM converts from there like any other money.
    """
    stage = (row.stage or "").strip().lower()
    return {
        "id": str(row.id),
        "account_id": org.account_id(account_clinic_id) if account_clinic_id else None,
        "name": row.lead_name,
        "contact_name": row.contact_person,
        "email": row.email,
        "phone": row.phone,
        "source": row.source,
        "stage": stage if stage in LEAD_STAGES else "new_lead",
        "owner": row.owner,
        "priority": row.priority,
        "expected_mrr": money(row.expected_mrr, "INR"),
        "trial_start": to_rfc3339(row.trial_start),
        "trial_end": to_rfc3339(row.trial_end),
        "next_follow_up_at": to_rfc3339(row.next_follow_up_at),
        "last_contact_at": to_rfc3339(row.last_contact_at),
        "lost_reason": row.lost_reason,
        "notes": row.notes,
        "created_at": to_rfc3339(row.created_at),
        "updated_at": to_rfc3339(row.updated_at or row.created_at),
        "deleted": False,
    }
