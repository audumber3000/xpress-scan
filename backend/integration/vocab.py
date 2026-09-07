"""MolarPlus's internal values, translated into the contract's vocabulary.

The CRM does not map strings. That is the point of the normalised vocabularies
in docs/INTEGRATION_API.md: every product emits the same words, so the sync can
reject anything it does not recognise instead of quietly inventing a meaning.
Translation therefore happens here, at the product boundary, and nowhere else.

**Unknown values fall back downward, never upward.** A status this module has
never seen resolves to the more pessimistic contract value — `expired` rather
than `active`, `other` rather than a named provider — and logs the row that
caused it. Under-reporting is a visible anomaly somebody investigates;
over-reporting revenue is the exact failure the contract exists to prevent, and
it looks like success until the quarter closes.
"""
import logging

log = logging.getLogger("integration.vocab")

# The contract's enums, repeated here so a typo is a NameError rather than a
# record the CRM rejects at sync time. These must match
# crm-app/src/constants/universal-identifiers.ts; scripts/check-contract.rb is
# what proves they still do.
ACCOUNT_STATUSES = ("active", "trial", "suspended", "churned")
BRANCH_STATUSES = ("active", "suspended", "closed")
SUBSCRIPTION_STATUSES = ("active", "trial", "past_due", "cancelled", "expired")
PAYMENT_STATUSES = ("paid", "pending", "failed", "refunded")
PROVIDERS = ("cashfree", "razorpay", "stripe", "manual", "other")


def _warn(kind: str, raw, row_id, fallback: str) -> str:
    log.warning(
        "unmapped %s %r on row %s; reporting %r. Add it to integration/vocab.py "
        "rather than letting it reach the CRM.", kind, raw, row_id, fallback,
    )
    return fallback


def _clean(raw) -> str:
    return (raw or "").strip().lower()


_ACCOUNT_STATUS = {
    "active": "active",
    "trial": "trial",
    "suspended": "suspended",
    "cancelled": "churned",
    "canceled": "churned",
    "closed": "churned",
    "deleted": "churned",
    "inactive": "churned",
}


def account_status(clinic_status, is_trial: bool = False, row_id=None) -> str:
    """`clinics.status` → the contract's four account states.

    `trial` wins over `active` when the account's subscription is a trial,
    because the clinic row says nothing about trials — MolarPlus keeps that on
    the subscription — and the CRM needs the two separated to chart trial→paid
    conversion at all.

    A suspended clinic that is also on a trial is reported suspended: it cannot
    use the product, which is the more urgent fact about it.
    """
    value = _clean(clinic_status)
    mapped = _ACCOUNT_STATUS.get(value)
    if mapped is None:
        return _warn("clinics.status", clinic_status, row_id, "churned")
    if mapped == "active" and is_trial:
        return "trial"
    return mapped


def branch_status(clinic_status, row_id=None) -> str:
    """`clinics.status` → the contract's three site states.

    A closed branch is not a churned account. MolarPlus writes `cancelled` on
    both a shut-down site and a departed customer, so `cancelled` becomes
    `closed` here and `churned` in `account_status` — same column, two
    questions.
    """
    value = _clean(clinic_status)
    if value in ("active",):
        return "active"
    if value in ("suspended",):
        return "suspended"
    if value in ("cancelled", "canceled", "closed", "deleted", "inactive"):
        return "closed"
    return _warn("clinics.status", clinic_status, row_id, "closed")


def subscription_status(status, is_trial: bool = False, row_id=None) -> str:
    """`subscriptions.status` → the contract's five subscription states.

    MolarPlus writes `active`, `pending`, `expired` and (per the model comment)
    `paused` and `cancelled`. `pending` is a checkout that has not settled and
    `paused` is a mandate that stopped collecting; both are money we expect and
    have not received, which is what `past_due` means.
    """
    value = _clean(status)
    if value == "active":
        return "trial" if is_trial else "active"
    if value in ("pending", "paused", "halted", "past_due", "on_hold"):
        return "past_due"
    if value in ("cancelled", "canceled"):
        return "cancelled"
    if value in ("expired", "completed", "ended"):
        return "expired"
    return _warn("subscriptions.status", status, row_id, "expired")


def payment_status(status, row_id=None) -> str:
    value = _clean(status)
    if value in ("paid", "success", "successful", "captured", "settled"):
        return "paid"
    if value in ("pending", "created", "initiated", "processing", "active"):
        return "pending"
    if value in ("failed", "failure", "cancelled", "canceled", "expired", "dropped"):
        return "failed"
    if value in ("refunded", "refund", "reversed", "chargeback"):
        return "refunded"
    return _warn("subscription_payments.status", status, row_id, "failed")


def provider(name, row_id=None) -> str:
    """A payment provider name, or `other`.

    `other` is a legitimate answer rather than a fallback failure, so an
    unrecognised provider is not warned about the way a status is — the enum
    exists to stop the CRM guessing, not to enumerate every gateway.
    """
    value = _clean(name)
    if value in PROVIDERS:
        return value
    if value in ("", "none", "null"):
        return "manual"
    return "other"
