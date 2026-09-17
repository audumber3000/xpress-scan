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
import datetime
import logging

from sqlalchemy import and_, case, func, not_, or_

from core import plan_state

log = logging.getLogger("integration.vocab")

# The provider MolarPlus writes on a subscription nobody is paying for.
#
# `trial` is the 7-day signup trial; `migration` is the introductory grant every
# clinic that existed on 2026-08-24 was put on, free, to a date somebody moves
# by hand. Both entitle a clinic to the product and neither is revenue, which is
# why they are named here rather than left to `provider()` below to flatten into
# `other`.
TRIAL_PROVIDER = "trial"
GRANT_PROVIDER = "migration"

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


def runs_to(sub):
    """The instant this subscription runs to.

    `current_end` is what the product enforces — `core.plan_state.evaluate` and
    `plans.effective_plan` both read it, and both trial routes write it and
    `trial_ends_at` to the same value. `trial_ends_at` is the fallback for a row
    where only it was set, so a trial with a known end date is never treated as
    endless.
    """
    return getattr(sub, "current_end", None) or getattr(sub, "trial_ends_at", None)


def ended(sub, now=None) -> bool:
    """Whether a subscription has run past the date it runs to.

    The same test `core.plan_state.evaluate` makes. A row with no end date has
    nothing to run out and is never ended — a support-granted plan with no
    expiry is a real state.
    """
    end = runs_to(sub)
    if end is None:
        return False
    return end < (now or datetime.datetime.utcnow())


def is_grant(provider) -> bool:
    """A clinic on the free introductory grant rather than a paid plan."""
    return _clean(provider) == GRANT_PROVIDER


def _grant_runs_out() -> bool:
    """Whether the grant's end date is enforced.

    It is off by default, and that is a business decision with a support cost
    rather than an oversight: every migrated clinic shares one `current_end`, so
    enforcing it blocks the entire estate at the same midnight, none of them
    having ever been invoiced. While it is off the product keeps letting them
    in, so the contract must keep calling them active — a CRM that reports a
    working clinic as expired sends somebody to win back a customer who never
    left.
    """
    return plan_state.ENFORCE_GRANT_END


def subscription_status(sub, row_id=None, now=None) -> str:
    """A subscription row → the contract's five subscription states.

    Takes the row rather than its status column, because the status column
    cannot answer the question on its own. MolarPlus writes `active`,
    `pending`, `expired` and (per the model comment) `paused` and `cancelled`.
    `pending` is a checkout that has not settled and `paused` is a mandate that
    stopped collecting; both are money we expect and have not received, which is
    what `past_due` means.

    **`active` is a claim about today, and the column cannot make it.** Nothing
    in MolarPlus ever rewrites `subscriptions.status` when a period simply runs
    out: `is_trial` is set at signup and cleared only by a payment, and `status`
    stays `active` for as long as the row exists. Expiry is evaluated from the
    dates at read time — `core.plan_state` does it to decide whether to block
    the clinic, `plans.effective_plan` does it to decide what the clinic may use
    — and this function did not, so a trial that ended in March was still
    reported as a live trial in September. Clinics sat in the CRM's Trial column
    while the product told them, on their own screen, that their trial was over.

    So the dates are read here too, by the same rule, and the three answers
    agree:

      a trial past its end        -> `expired`  (the product blocks it)
      a paid plan past its end    -> `past_due` (money owed, mandate may settle)
      a grant past its end        -> unchanged while the grant is not enforced

    `past_due` rather than `expired` for the paid case on purpose. A renewal
    that has not landed is not a customer who left, and `past_due` keeps its
    MRR — the contract's own words: "a renewal that has not been paid yet is a
    shop that still trades."
    """
    row_id = row_id if row_id is not None else getattr(sub, "id", None)
    value = _clean(getattr(sub, "status", None))
    is_trial = bool(getattr(sub, "is_trial", False))
    provider = getattr(sub, "provider", None)
    if value == "active":
        over = ended(sub, now) and not (is_grant(provider) and not _grant_runs_out())
        if over:
            return "expired" if is_trial else "past_due"
        return "trial" if is_trial else "active"
    if value in ("pending", "paused", "halted", "past_due", "on_hold"):
        return "past_due"
    if value in ("cancelled", "canceled"):
        return "cancelled"
    if value in ("expired", "completed", "ended"):
        return "expired"
    return _warn("subscriptions.status", getattr(sub, "status", None), row_id, "expired")


# The contract statuses that are money. A trial pays nothing and a cancelled or
# expired subscription pays nothing, so their MRR is zero rather than the list
# price of the plan attached to them. `past_due` keeps its price: that money is
# owed, not gone.
BILLING_STATUSES = ("active", "past_due")


def is_billing(status: str, provider=None) -> bool:
    """Whether this subscription is revenue. The Python twin of
    `subscription_is_billing` below — see it for why the grant is the case the
    status alone cannot tell you about."""
    return status in BILLING_STATUSES and not is_grant(provider)


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


def subscription_over(model, now=None):
    """SQL for `ended()` above: this row is past the date it runs to.

    `model` is the Subscription mapper (or an alias of it) — the same object the
    Python side takes a row of, so the two read the same four columns and cannot
    drift apart over which ones matter.

    The grant carve-out is here rather than at the call sites because there are
    three of them — the filter, the CASE and the billing test — and a rule that
    holds in two of them produces a list whose rows are labelled something other
    than what was filtered for.
    """
    now = now or datetime.datetime.utcnow()
    runs_to_column = func.coalesce(model.current_end, model.trial_ends_at)
    over = and_(runs_to_column.isnot(None), runs_to_column < now)
    if not _grant_runs_out():
        over = and_(over, func.lower(func.trim(
            func.coalesce(model.provider, ""))) != GRANT_PROVIDER)
    return over


def _subscription_clauses(model, now=None):
    """Every contract status as SQL, paired with its name, in CASE order.

    One definition, read by the filter and by the CASE, because the two
    disagreeing is the failure that hides best: a bucket headed "Trial 214"
    whose list shows 38 rows, and nobody can say which number is wrong.

    Mirrors `subscription_status()` line for line. If you change one, change
    both — `tests/test_integration_contract.py` runs the pair over the same
    rows and fails if they disagree.
    """
    normalised = func.lower(func.trim(model.status))
    raw_active = normalised.in_(_SUBSCRIPTION_SOURCES["active"])
    trial_flag = model.is_trial.is_(True)
    not_trial = or_(model.is_trial.is_(False), model.is_trial.is_(None))
    over = subscription_over(model, now)
    live = not_(over)

    return [
        ("trial", and_(raw_active, trial_flag, live)),
        ("active", and_(raw_active, not_trial, live)),
        # Two ways to owe money: a mandate that stopped collecting, and a paid
        # period that simply ran out while the row still said `active`.
        ("past_due", or_(normalised.in_(_SUBSCRIPTION_SOURCES["past_due"]),
                         and_(raw_active, not_trial, over))),
        ("cancelled", normalised.in_(_SUBSCRIPTION_SOURCES["cancelled"])),
        # The fallback, and it has to catch three things: the raw values that
        # mean expired, a trial whose end date has passed, and any status this
        # module has never seen — because that is what the response reports for
        # it, and a row missing from the list its own label names is the kind of
        # gap nobody finds by looking.
        ("expired", or_(normalised.in_(_SUBSCRIPTION_SOURCES["expired"]),
                        and_(raw_active, trial_flag, over),
                        not_(normalised.in_(_KNOWN_SUBSCRIPTION_RAW)))),
    ]


def subscription_status_filter(model, wanted, now=None):
    """SQL for "the contract would call this row one of `wanted`".

    `active` and `trial` share a raw value and are told apart by `is_trial` and
    by whether the period has run out — see `subscription_status()` for why the
    dates have to be read here and cannot be left to the column.
    """
    by_name = dict(_subscription_clauses(model, now))
    clauses = [by_name[value] for value in wanted if value in by_name]
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


def subscription_status_expression(model, now=None):
    """The same five states as a CASE, for `group_by=status`.

    Not `_status_case` like the other three vocabularies: subscriptions are the
    one whose status is not a function of its own column, so the conditions come
    from `_subscription_clauses` and the last one becomes the `else_`.
    """
    clauses = _subscription_clauses(model, now)
    whens = [(condition, value) for value, condition in clauses[:-1]]
    return case(*whens, else_=clauses[-1][0])


def subscription_is_billing(model, now=None):
    """Whether MRR is real money. Trials, grants, cancellations and expiries are not.

    `shapes.subscription` reports `mrr` as zero for these, so an ORDER BY that
    used list price regardless would sort a list by numbers it does not show.

    **The grant is the one that is not visible from the status.** Every clinic
    that existed on 2026-08-24 was put on Plus free, with `provider='migration'`
    and `status='active'` and `is_trial` false — indistinguishable from a paying
    customer to anything that reads the status alone, which is how the whole
    introductory cohort came to be counted at list price on the CRM's revenue
    dashboard. They pay nothing. Their MRR is nothing.
    """
    return and_(
        subscription_status_filter(model, BILLING_STATUSES, now),
        func.lower(func.trim(func.coalesce(model.provider, ""))) != GRANT_PROVIDER,
    )
