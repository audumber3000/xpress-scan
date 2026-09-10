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
import datetime
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

# What `GET /meta` declares, and the currency every comparable figure is
# reported in. One constant, because a total in a different currency from the
# one the response says it is in is the worst kind of wrong.
REPORTING_CURRENCY = plans.INR


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
        # The same figure in the product's reporting currency, so a total means
        # something. `mrr` is native and must stay native — a clinic billed in
        # dollars is billed in dollars — but summing native amounts adds rupees
        # to dollars and produces a number that is wrong in a direction nobody
        # notices. Every chart and every sort reads this one.
        #
        # Not an FX conversion: the catalogue publishes each plan's price in
        # every currency it sells in, so this is the same plan's list price
        # looked up in the reporting currency. A rate nobody maintains cannot
        # go stale.
        "mrr_base": micros(
            plans_view.monthly_mrr_micros(row.plan_name, REPORTING_CURRENCY)
            if status in BILLING_STATUSES else 0,
            REPORTING_CURRENCY),
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


# ── Support panels ───────────────────────────────────────────────────────────
#
# docs/INTEGRATION_API.md § Support panels. These are rendered on demand and
# stored nowhere, which is what lets them carry staff contact details at all —
# so the rule they each have to keep is the one about what they leave out.
# Read the omissions here as deliberate; every one of them is a field the
# retired console's payload carried.

# Sorting sentinel for "no device ever reported in". Only ever compared
# against, never formatted.
_NEVER = datetime.datetime.min

# MolarPlus's own event keys, given the wording the clinic sees in its
# settings screen. Display only: `event_code` is what the panel groups on, and
# a key with no label here still renders — as the key.
_EVENT_LABELS = {
    "appointment_confirmation": "Appointment Confirmation",
    "appointment_reminder": "Appointment Reminder",
    "invoice_notification": "Invoice",
    "prescription_notification": "Prescription",
    "google_review": "Google Review Request",
    "consent_form": "Consent Form",
    "daily_report": "Daily Report",
}


def operator_device(device) -> Dict[str, Any]:
    """One enrolled device.

    No `ip_address` and no coordinates, though `user_devices` stores all three.
    `location` is the coarse place name, which answers the question support
    actually has — is this sign-in from somewhere they have never worked? — and
    stops there.
    """
    return {
        "id": ext_id(device.id),
        "label": device.device_name or None,
        "form_factor": vocab.form_factor(device.device_type, device.device_platform),
        "platform": device.device_platform or None,
        "os": device.device_os or None,
        "is_online": bool(device.is_online),
        "last_seen_at": to_rfc3339(device.last_seen),
        "enrolled_at": to_rfc3339(device.enrolled_at or device.created_at),
        "location": device.location or None,
    }


def operator_session(log, kind: str, factor: str) -> Dict[str, Any]:
    return {
        "id": ext_id(log.id),
        "kind": kind,
        "at": to_rfc3339(log.created_at),
        "form_factor": factor,
    }


def operator(user, devices, sessions, branch_clinic_id=None) -> Dict[str, Any]:
    """One person with a login.

    `last_seen_at` is the newest across their devices rather than a column:
    MolarPlus has no `users.last_login_at`, and the honest answer to "when were
    they last here" is the freshest thing any of their devices reported.
    """
    last_seen = max(
        [d.last_seen for d in devices if d.last_seen] or [None],
        key=lambda value: value or _NEVER,
    )
    return {
        "id": ext_id(user.id),
        "name": user.name or " ".join(p for p in (user.first_name, user.last_name) if p) or "",
        "contact": contact(user),
        "role": vocab.operator_role(user.role, user.id),
        # The product's own word, kept beside the normalised one because
        # "receptionist" reads better on a call than "staff" — but only `role`
        # can be grouped on, and only `role` crosses products.
        "role_label": user.role or None,
        "is_active": bool(user.is_active),
        "branch_id": ext_id(branch_clinic_id) if branch_clinic_id else None,
        "joined_at": to_rfc3339(user.created_at),
        "last_seen_at": to_rfc3339(last_seen),
        "devices": [operator_device(d) for d in devices],
        "sessions": sessions,
    }


def account_operators(account_id: str, operators, device_totals,
                      seat_limit, as_of) -> Dict[str, Any]:
    return {
        "account_id": account_id,
        "as_of": to_rfc3339(as_of),
        # None means unlimited, not zero — the same rule the plan limits keep
        # everywhere else, and the panel renders the two differently.
        "seat_limit": seat_limit,
        "device_totals": device_totals,
        "operators": operators,
    }


def messaging_channel_stats(channel: str, sent: int, failed: int,
                            cost, currency: str) -> Dict[str, Any]:
    return {
        "channel": channel,
        "sent": int(sent),
        "failed": int(failed),
        "cost": money(cost, currency),
    }


def messaging_preference(row) -> Dict[str, Any]:
    """One event the account can switch on or off.

    `channels` is the JSON column, with the legacy singular `channel` folded in
    for rows written before the multi-select landed. A preference showing no
    channels reads as "sends nothing", which is exactly what such a row means.
    """
    channels = list(row.channels or ([row.channel] if row.channel else []))
    return {
        "event_code": row.event_type,
        "label": _EVENT_LABELS.get(row.event_type),
        "channels": [vocab.message_channel(c, row.id) for c in channels],
        "is_enabled": bool(row.is_enabled),
    }


def message_record(row, currency: str) -> Dict[str, Any]:
    """One send, without its recipient.

    `notification_logs.recipient` holds a patient's phone number or email. It
    is the single field on this endpoint that would turn a diagnostic panel
    into an end-customer feed, so it is not read, not shaped and not sent.
    """
    return {
        "id": ext_id(row.id),
        "channel": vocab.message_channel(row.channel, row.id),
        "event_code": row.event_type or None,
        "status": vocab.message_status(row.status, row.id),
        "cost": money(row.cost, currency) if row.cost is not None else None,
        "error": row.error_message or None,
        "at": to_rfc3339(row.created_at),
    }


def account_messaging(account_id: str, window_days: int, totals, by_channel,
                      wallet, preferences, recent, currency: str,
                      as_of) -> Dict[str, Any]:
    sent, failed, cost = totals
    return {
        "account_id": account_id,
        "as_of": to_rfc3339(as_of),
        "window_days": int(window_days),
        "total_sent": int(sent),
        "total_failed": int(failed),
        "total_cost": money(cost, currency),
        "by_channel": by_channel,
        # None where the account has no wallet row at all. Distinct from a
        # balance of zero: one has never topped up, the other has run out, and
        # only the second is why their reminders stopped.
        "wallet": None if wallet is None else {
            "balance": money(wallet.balance or 0.0, currency),
            "last_topped_up_at": to_rfc3339(wallet.last_topup_at),
        },
        "preferences": preferences,
        "recent": recent,
    }


def reputation(place) -> Optional[Dict[str, Any]]:
    if place is None:
        return None
    return {
        "source": "google",
        "place_name": place.place_name or None,
        "rating": place.current_rating,
        "review_count": place.total_review_count,
        "last_synced_at": to_rfc3339(place.last_synced_at),
    }


def account_profile(account_id: str, clinic, completeness, capacity,
                    place, as_of) -> Dict[str, Any]:
    """The account's own setup, and how it is seen.

    `billing_customer_ids` is keyed by provider rather than flattened into one
    `customer_id`, because a clinic that migrated from Razorpay to Cashfree has
    both and somebody chasing an old refund needs the one that is no longer
    current.
    """
    billing_ids = dict(
        (provider, value)
        for provider, value in (
            ("cashfree", clinic.cashfree_customer_id),
            ("razorpay", clinic.razorpay_customer_id),
        )
        if value
    )
    return {
        "account_id": account_id,
        "as_of": to_rfc3339(as_of),
        "completeness": completeness,
        "logo_url": clinic.logo_url or None,
        "tagline": clinic.tagline or None,
        "categories": [clinic.specialization] if clinic.specialization else [],
        "capacity": capacity,
        "registration": {
            "external_code": clinic.clinic_code or None,
            "tax_id": clinic.tax_id or clinic.gst_number or None,
            "tax_label": clinic.tax_label or None,
            "licence_number": clinic.license_number or None,
            "licence_authority": clinic.license_authority or None,
            "licence_expires_at": (
                clinic.license_expiry.isoformat() if clinic.license_expiry else None
            ),
        },
        "timezone": clinic.timezone or None,
        "billing_customer_ids": billing_ids,
        "reputation": reputation(place),
        "created_at": to_rfc3339(clinic.created_at),
        "updated_at": to_rfc3339(clinic.updated_at),
    }


def account_event(event_id: str, at, code: str, category: str, summary: str,
                  actor_name=None, actor_role=None,
                  branch_clinic_id=None) -> Dict[str, Any]:
    return {
        "id": event_id,
        "at": to_rfc3339(at),
        "code": code,
        "category": category,
        "summary": summary,
        "actor_name": actor_name or None,
        "actor_role": actor_role,
        "branch_id": ext_id(branch_clinic_id) if branch_clinic_id else None,
    }


def account_events(account_id: str, events, has_more: bool, as_of) -> Dict[str, Any]:
    return {
        "account_id": account_id,
        "as_of": to_rfc3339(as_of),
        "events": events,
        "has_more": bool(has_more),
    }


# ── Marketing ────────────────────────────────────────────────────────────────

_CAMPAIGN_AUDIENCE = {
    "clinics": "accounts",
    "accounts": "accounts",
    "leads": "leads",
    "numbers": "numbers",
    "test": "test",
    "push": "accounts",
}


def promotion(kind: str, row) -> Dict[str, Any]:
    """A coupon or a referral code, as one shape.

    The id is namespaced by kind because the two tables have independent
    primary keys: coupon 7 and referral 7 both exist, and an unnamespaced id
    would make the CRM treat them as one record and overwrite whichever synced
    second.

    `discount_amount` is money and `discount_percent` is not. A code carrying
    both is a product-side mistake; nothing here reconciles them, because
    guessing which the customer actually got is worse than showing both.
    """
    referral = kind == "referral"
    amount = None if referral else getattr(row, "discount_amount", None)
    return {
        "id": "{}:{}".format(kind, row.id),
        "code": (row.code or "").upper(),
        "kind": kind,
        "partner_name": row.creator_name if referral else None,
        "discount_percent": row.discount_percent,
        "discount_amount": money(amount, "INR"),
        # None is unlimited, not zero. A referral code has no limit column at
        # all, which is the same fact and reported the same way.
        "usage_limit": None if referral else getattr(row, "usage_limit", None),
        "usage_count": int(
            (getattr(row, "usage_count", None) if referral
             else getattr(row, "used_count", None)) or 0
        ),
        "is_active": bool(row.is_active),
        "is_featured": bool(getattr(row, "is_featured", False)),
        "expires_at": to_rfc3339(getattr(row, "expiry_date", None)),
        "reward": getattr(row, "reward_details", None) if referral else None,
        "created_at": to_rfc3339(row.created_at),
        # Neither table has an updated_at. Reporting created_at as though it
        # were one would tell the CRM a stale record is fresh, so this is null
        # and the CRM reconciles against a full snapshot instead.
        "updated_at": None,
        "deleted": False,
    }


def campaign(row) -> Dict[str, Any]:
    """One broadcast that has already gone out.

    `skipped` and `failed` stay separate: skipped was never attempted — no
    number on file, a duplicate, an opt-out — and failed was attempted and
    rejected. Only one of the two is worth retrying, and summing them loses
    exactly that.
    """
    return {
        "id": ext_id(row.id),
        "channel": vocab.message_channel(row.channel, row.id),
        "template_name": row.template_name or None,
        "subject": row.subject or None,
        "audience": _CAMPAIGN_AUDIENCE.get((row.target_kind or "").lower(), "other"),
        "audience_filter": row.target_filter or None,
        "total_recipients": int(row.total_recipients or 0),
        "sent_count": int(row.sent_count or 0),
        "failed_count": int(row.failed_count or 0),
        "skipped_count": int(row.skipped_count or 0),
        "sent_by": row.sent_by or None,
        "sent_at": to_rfc3339(row.created_at),
        "deleted": False,
    }
