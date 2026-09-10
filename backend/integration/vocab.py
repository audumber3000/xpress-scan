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

from sqlalchemy import and_, case, func, not_, or_

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


# ── Support panel vocabularies ───────────────────────────────────────────────
#
# The four panels in docs/INTEGRATION_API.md § Support panels. Same rule as
# everything above: MolarPlus's words are translated here, at the boundary, so
# the CRM never learns that a `receptionist` exists.

OPERATOR_ROLES = ("owner", "practitioner", "staff", "other")
DEVICE_FORM_FACTORS = ("mobile", "desktop", "web", "other")
MESSAGE_CHANNELS = ("whatsapp", "email", "sms", "push", "other")
MESSAGE_STATUSES = ("queued", "sent", "delivered", "read", "failed")
EVENT_CATEGORIES = ("access", "billing", "configuration", "staffing", "support", "other")

_OPERATOR_ROLE = {
    "clinic_owner": "owner",
    "owner": "owner",
    "admin": "owner",
    "doctor": "practitioner",
    "dentist": "practitioner",
    "hygienist": "practitioner",
    # A visiting consultant performs the service the account sells, and is paid
    # per case rather than salaried. Same rung as a doctor: what matters to the
    # ladder is what they do, not how they are paid.
    "consultant": "practitioner",
    "receptionist": "staff",
    "assistant": "staff",
    "staff": "staff",
    "nurse": "staff",
    # ClinoHealth's own people, not the account's. Mapped explicitly rather
    # than left to fall through, because falling through logs it as an unmapped
    # role every time the panel opens — and it is not unmapped, it genuinely
    # has no rung on a ladder that describes the customer's own staff. It still
    # surfaces: `role_label` carries the word, so support can see why somebody
    # from ClinoHealth has a login on this account.
    "super_admin": "other",
}


def operator_role(role, row_id=None) -> str:
    """`users.role` → the contract's four-rung ladder.

    `other` rather than `staff` for an unrecognised title, and it is warned
    about. Guessing `staff` would silently fold a role that can change billing
    into one that cannot, which is the wrong way for this particular fallback
    to be wrong.
    """
    value = _clean(role)
    mapped = _OPERATOR_ROLE.get(value)
    if mapped is None:
        return _warn("users.role", role, row_id, "other")
    return mapped


def form_factor(device_type, device_platform=None) -> str:
    """`user_devices.device_type` + `device_platform` → mobile/desktop/web/other.

    Platform wins over type. MolarPlus writes `mobile` for a phone and also for
    a tablet running the web app, while `device_platform` names the OS
    outright — and the question the panel is answering ("they said they are on
    the app") is about the OS, not about the form of the request.
    """
    platform = _clean(device_platform)
    if platform in ("android", "ios", "iphone", "ipad"):
        return "mobile"
    if platform in ("windows", "macos", "mac os", "darwin", "linux"):
        return "desktop"

    value = _clean(device_type)
    if value in ("mobile", "phone", "tablet"):
        return "mobile"
    if value in ("desktop", "laptop"):
        return "desktop"
    if value in ("web", "browser"):
        return "web"
    # Not warned: an unenrolled device legitimately has neither column set, and
    # a log line per anonymous sign-in would drown the ones that matter.
    return "other"


def message_channel(channel, row_id=None) -> str:
    value = _clean(channel)
    if value in MESSAGE_CHANNELS:
        return value
    if value in ("wa", "whatsapp_cloud", "wareach"):
        return "whatsapp"
    if value in ("mail", "smtp"):
        return "email"
    if value in ("text", "msg91_sms"):
        return "sms"
    return _warn("notification_logs.channel", channel, row_id, "other")


def message_status(status, row_id=None) -> str:
    """`notification_logs.status` → the contract's five delivery states.

    Unknown falls to `failed`, downward like every other fallback here: a
    message the product cannot account for should show up in the failure count
    somebody investigates, not in the sent count nobody looks at.
    """
    value = _clean(status)
    if value in MESSAGE_STATUSES:
        return value
    if value in ("pending", "queue", "accepted", "submitted"):
        return "queued"
    if value in ("success", "sent_to_provider", "delivered_to_provider"):
        return "sent"
    if value in ("seen", "opened"):
        return "read"
    return _warn("notification_logs.status", status, row_id, "failed")


# ── The same vocabulary, as SQL ──────────────────────────────────────────────
#
# A filter has to speak the contract's words, not MolarPlus's. `status=active`
# from the CRM means the five-value contract enum, and translating it back to
# the raw column is not optional: `subscriptions.status` says "active" for both
# an active subscription and a trial, and "pending" for something the contract
# calls `past_due`. Filtering on the raw column returns rows the response then
# labels something else — a list that does not contain what its own filter says.
#
# Written from the same table `subscription_status()` reads above, so the two
# cannot disagree about what a word means.

# contract status -> the raw values that produce it
_SUBSCRIPTION_SOURCES = {
    "active": ("active",),
    "trial": ("active",),
    "past_due": ("pending", "paused", "halted", "past_due", "on_hold"),
    "cancelled": ("cancelled", "canceled"),
    "expired": ("expired", "completed", "ended"),
}

_KNOWN_SUBSCRIPTION_RAW = tuple(
    sorted(set(value for values in _SUBSCRIPTION_SOURCES.values() for value in values))
)


def subscription_status_filter(status_column, is_trial_column, wanted):
    """SQL for "the contract would call this row one of `wanted`".

    Two details that are easy to get wrong and expensive to miss:

    `active` and `trial` share a raw value and are told apart by `is_trial`, so
    each carries that condition rather than both matching every active row.

    An unrecognised raw status is reported as `expired` — the vocabulary falls
    back downward on purpose — so the `expired` filter must also match rows
    whose status this module has never seen. Otherwise a row the response calls
    expired is missing from the expired list, which is the kind of gap nobody
    finds by looking.
    """
    normalised = func.lower(func.trim(status_column))
    clauses = []
    for value in wanted:
        sources = _SUBSCRIPTION_SOURCES.get(value)
        if sources is None:
            continue
        clause = normalised.in_(sources)
        if value == "active":
            clause = and_(clause, or_(is_trial_column.is_(False),
                                      is_trial_column.is_(None)))
        elif value == "trial":
            clause = and_(clause, is_trial_column.is_(True))
        elif value == "expired":
            clause = or_(clause, not_(normalised.in_(_KNOWN_SUBSCRIPTION_RAW)))
        clauses.append(clause)
    if not clauses:
        # A filter naming nothing the contract knows must return nothing, not
        # everything. Silently dropping it would widen the list.
        return or_(False)
    return or_(*clauses)


# The same shape for the two vocabularies with no is_trial twist. Each names the
# raw values that produce a contract value, and each declares which contract
# value an unrecognised raw status falls back to — because that fallback is what
# the response reports, so the filter has to match it or the list disagrees with
# the rows in it.
_BRANCH_SOURCES = {
    "active": ("active",),
    "suspended": ("suspended",),
    "closed": ("cancelled", "canceled", "closed", "deleted", "inactive"),
}

_PAYMENT_SOURCES = {
    "paid": ("paid", "success", "successful", "captured", "settled"),
    "pending": ("pending", "created", "initiated", "processing", "active"),
    "failed": ("failed", "failure", "cancelled", "canceled", "expired", "dropped"),
    "refunded": ("refunded", "refund", "reversed", "chargeback"),
}


def _status_filter(column, wanted, sources, fallback):
    normalised = func.lower(func.trim(column))
    known = tuple(sorted(set(v for values in sources.values() for v in values)))
    clauses = []
    for value in wanted:
        raw = sources.get(value)
        if raw is None:
            continue
        clause = normalised.in_(raw)
        if value == fallback:
            clause = or_(clause, not_(normalised.in_(known)))
        clauses.append(clause)
    return or_(*clauses) if clauses else or_(False)


def branch_status_filter(column, wanted):
    """`closed` is the fallback: see `branch_status` above."""
    return _status_filter(column, wanted, _BRANCH_SOURCES, "closed")


def payment_status_filter(column, wanted):
    """`failed` is the fallback: an unrecognised payment status is not money in."""
    return _status_filter(column, wanted, _PAYMENT_SOURCES, "failed")


def _status_case(column, sources, fallback, extra=None):
    """A CASE mapping the product's raw column onto the contract's value.

    Grouping needs this for the same reason filtering does, and getting it wrong
    is quieter: `group_by=status` on the raw column labels a bucket "active"
    that contains trials, and clicking through to `status=active` then returns
    fewer rows than the header promised. A count that disagrees with the list
    behind it is the kind of thing nobody reports and everybody stops trusting.

    `else_` is the vocabulary's fallback, so an unrecognised raw value lands in
    the same bucket the response would label it.
    """
    normalised = func.lower(func.trim(column))
    whens = list(extra or [])
    for value, raw in sources.items():
        if value == fallback:
            continue
        whens.append((normalised.in_(raw), value))
    return case(*whens, else_=fallback)


def branch_status_expression(column):
    return _status_case(column, _BRANCH_SOURCES, "closed")


def payment_status_expression(column):
    return _status_case(column, _PAYMENT_SOURCES, "failed")


def subscription_status_expression(status_column, is_trial_column):
    """As above, with the twist that makes subscriptions different: `active` and
    `trial` share a raw value and are told apart by `is_trial`."""
    normalised = func.lower(func.trim(status_column))
    return _status_case(
        status_column, _SUBSCRIPTION_SOURCES, "expired",
        extra=[
            (and_(normalised.in_(("active",)), is_trial_column.is_(True)), "trial"),
            (normalised.in_(("active",)), "active"),
        ],
    )


def subscription_is_billing(status_column, is_trial_column):
    """Whether MRR is real money. Trials, cancellations and expiries pay nothing.

    `shapes.subscription` reports `mrr` as zero for these, so an ORDER BY that
    used list price regardless would sort a list by numbers it does not show.
    """
    return subscription_status_filter(status_column, is_trial_column,
                                      ("active", "past_due"))
