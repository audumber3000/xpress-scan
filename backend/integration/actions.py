"""The write side: what a support agent does to an account from the CRM.

Actions are called by a Twenty logic function directly against MolarPlus. The
CRM never writes product state itself and never treats its own copy as
authoritative, so every action here returns the **full updated object** — the
CRM refreshes from the response instead of waiting for the nightly sync.

Three properties the contract requires of all of them:

* **Idempotent under replay.** The sync retries on network failure, and a lost
  response must not suspend an account twice or change a plan twice.
* **Audited.** Every write lands in `integration_audit_log` with the caller,
  the reason and what changed. Twenty's own event-log module is enterprise
  licensed; this is both free and closer to the write.
* **Narrow.** `PATCH` takes contact details and nothing else. Financial and
  lifecycle changes have their own endpoints because they have their own side
  effects.

## What `POST /accounts/{id}/plan` does not do

It does not touch the Cashfree mandate. Decided deliberately on 2026-09-05: in
MolarPlus a plan change runs through checkout and a provider webhook, and a
recurring mandate cannot be re-priced without the customer authorising it. So
this endpoint is an **admin override** — it moves the subscription row and the
clinic's entitlement, and records who did it and why. It is what an agent
actually does on a support call.

The customer therefore keeps being charged the old amount until the mandate is
updated through the product. That is a real gap, it is logged as a warning, and
the response carries `X-MolarPlus-Provider-Mandate: stale` when it applies.
Do not let it become invisible.
"""
import datetime
import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, Response
from pydantic import BaseModel
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from core import plans

from . import plans_view
from core.countries import apply_to_clinic
from database import get_db
from models import Clinic, Subscription

from . import org, reads, shapes, store
from .auth import Caller, require_write
from .store import IntegrationIdempotency
from .wire import ContractError

log = logging.getLogger("integration.actions")

router = APIRouter()

MANDATE_HEADER = "X-MolarPlus-Provider-Mandate"

# Statuses a live provider mandate can be sitting behind. Changing the plan on
# one of these leaves the customer paying the old amount.
LIVE_MANDATE_PROVIDERS = ("cashfree", "razorpay")


# ── Request bodies ───────────────────────────────────────────────────────────

class AddressPatch(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postcode: Optional[str] = None
    country_code: Optional[str] = None


class AccountPatch(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[AddressPatch] = None


class PlanChange(BaseModel):
    plan_code: str
    effective: Optional[str] = None
    reason: Optional[str] = None


class SuspendBody(BaseModel):
    reason: Optional[str] = None


def _body(model: BaseModel) -> dict:
    """The request as a plain dict, for the idempotency fingerprint.

    Pydantic 2 spells this `model_dump`; 1 spells it `dict`, and
    `requirements.txt` pins neither.
    """
    return model.model_dump() if hasattr(model, "model_dump") else model.dict()


def _explicit(model: BaseModel) -> set:
    """Which fields the caller actually sent.

    The contract distinguishes omitted (leave alone) from null (clear), and a
    plain `None` cannot tell them apart. Pydantic 2 calls this
    `model_fields_set`; 1 calls it `__fields_set__`, and production installs
    whichever `requirements.txt` resolves to today.
    """
    if hasattr(model, "model_fields_set"):
        return model.model_fields_set
    return model.__fields_set__


# ── Idempotency ──────────────────────────────────────────────────────────────

def _replayed(db: Session, key: Optional[str], endpoint: str,
              payload: Optional[dict], response: Optional[Response] = None):
    """The stored result for this `Idempotency-Key`, if there is one.

    Called **before** any state validation, which is the whole point. A retry
    of a suspend that already succeeded must return the original response, not
    the 409 that "this account is already suspended" would otherwise produce —
    the sync retries on network failure, and the second attempt is the same
    request, not a second one.

    A key replayed with a *different* request is a 409 instead. Silently
    answering the wrong question is worse than having no idempotency at all: it
    would let a retry of "suspend" return the stored result of "activate".
    """
    if not key:
        return None
    seen = db.query(IntegrationIdempotency).filter(IntegrationIdempotency.key == key).first()
    if seen is None:
        return None
    if seen.endpoint != endpoint or seen.request_fingerprint != store.fingerprint(payload):
        raise ContractError(
            409, "idempotency_key_reused",
            "This Idempotency-Key was already used for a different request.",
            {"key": key, "original_endpoint": seen.endpoint},
        )
    if response is not None:
        for name, value in (seen.response_headers or {}).items():
            response.headers[name] = value
    return seen.response_body


def _commit(db: Session, key: Optional[str], endpoint: str, payload: Optional[dict],
            caller: Caller, result: dict, headers: Optional[dict] = None) -> dict:
    """Commit the change, its audit row and its idempotency record together.

    One transaction, so a crash between them cannot leave a change that is
    unaudited, or a key that replays a write which never happened.
    """
    if not key:
        db.commit()
        return result

    db.add(IntegrationIdempotency(
        key=key, endpoint=endpoint, request_fingerprint=store.fingerprint(payload),
        status_code=200, response_body=result, response_headers=headers or {},
        caller=caller.label,
    ))
    try:
        db.commit()
    except IntegrityError:
        # Two identical requests raced. The other one won, and its side effect
        # is the one that happened; ours rolls back and we return theirs.
        db.rollback()
        seen = db.query(IntegrationIdempotency).filter(IntegrationIdempotency.key == key).first()
        if seen is None:
            raise
        return seen.response_body
    return result


def _account_clinic(db: Session, account_id: str) -> Clinic:
    clinic_id = org.parse_account_id(account_id)
    clinic = (
        db.query(Clinic)
        .filter(Clinic.id == clinic_id)
        .filter(org.is_account_root())
        .first()
    )
    if clinic is None:
        raise ContractError(
            404, "account_not_found",
            "No account with id {}. A branch clinic is not an account — "
            "see integration/org.py.".format(account_id),
            {"account_id": account_id},
        )
    return clinic


def _account_response(db: Session, account_id: str) -> dict:
    """Re-read and serialise the account, so the CRM refreshes from the write."""
    return reads._serialise_accounts(db, [reads._load_account(db, account_id)])[0]


# ── PATCH /accounts/{id} ─────────────────────────────────────────────────────

@router.patch("/accounts/{account_id}", tags=["actions"], operation_id="updateAccount")
def update_account(account_id: str, body: AccountPatch,
                   idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                   db: Session = Depends(get_db),
                   caller: Caller = Depends(require_write)):
    """Contact details — the fields a support agent legitimately corrects.

    `address.country_code` is the one field here with a financial edge: changing
    a clinic's country cascades its currency, timezone and tax label, and the
    currency is what `Subscription.mrr` is reported in. It is allowed because
    the console has always allowed it and an agent fixing a wrongly-onboarded
    clinic needs it — but it goes through the same cascade the console uses and
    it is audited like any other write.
    """
    payload = _body(body)
    replayed = _replayed(db, idempotency_key, "PATCH /accounts", payload)
    if replayed is not None:
        return replayed

    clinic = _account_clinic(db, account_id)
    sent = _explicit(body)
    before, after = {}, {}

    def assign(field, value):
        current = getattr(clinic, field)
        if current == value:
            return
        before[field] = current
        after[field] = value
        setattr(clinic, field, value)

    for field in ("name", "email", "phone"):
        if field in sent:
            assign(field, getattr(body, field))

    if "address" in sent and body.address is not None:
        parts = _explicit(body.address)
        if "street" in parts:
            assign("address_line1", body.address.street)
            assign("address_line2", None)
            # The legacy single-line column is still what the console renders.
            # Leaving it stale would make the two disagree about the same
            # clinic on the same screen.
            assign("address", body.address.street)
        if "city" in parts:
            assign("city", body.address.city)
        if "state" in parts:
            assign("state", body.address.state)
        if "postcode" in parts:
            assign("postal_code", body.address.postcode)
        if "country_code" in parts and body.address.country_code:
            code = body.address.country_code.upper()
            if code != (clinic.country or "").upper():
                before["country"] = clinic.country
                apply_to_clinic(clinic, code)
                after["country"] = clinic.country
                after["currency_code"] = clinic.currency_code

    if after:
        clinic.updated_at = datetime.datetime.utcnow()
        store.record(db, caller, "update_contact", account_id, clinic.id,
                     before=before, after=after)
        db.flush()

    result = _account_response(db, account_id)
    return _commit(db, idempotency_key, "PATCH /accounts", payload, caller, result)


# ── POST /accounts/{id}/plan ─────────────────────────────────────────────────

@router.post("/accounts/{account_id}/plan", tags=["actions"], operation_id="changePlan")
def change_plan(account_id: str, body: PlanChange, response: Response,
                idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                db: Session = Depends(get_db),
                caller: Caller = Depends(require_write)):
    """Move the account onto a different plan. An admin override — see the
    module docstring for what it deliberately does not do."""
    payload = _body(body)
    replayed = _replayed(db, idempotency_key, "POST /accounts/plan", payload, response)
    if replayed is not None:
        return replayed

    clinic = _account_clinic(db, account_id)

    if not plans_view.is_known(body.plan_code):
        raise ContractError(
            422, "unknown_plan_code",
            "MolarPlus does not offer the plan {!r}.".format(body.plan_code),
            {"plan_code": body.plan_code,
             "offered": sorted(plans.PLANS) + [k + "_annual" for k in sorted(plans.PLANS)]},
        )

    if body.effective and body.effective != "immediate":
        # `next_cycle` needs somewhere to hold the pending plan until renewal.
        # SyrupDesk has `pending_plan`; MolarPlus has no such column, and
        # pretending to defer a change that actually applies now would be worse
        # than refusing it.
        raise ContractError(
            422, "effective_not_supported",
            "MolarPlus applies plan changes immediately; it has no pending-plan "
            "column. Send effective=immediate or omit it.",
            {"effective": body.effective},
        )

    subscription = (
        db.query(Subscription)
        .filter(Subscription.clinic_id == clinic.id)
        .order_by(Subscription.id.desc())
        .first()
    )
    if subscription is None:
        raise ContractError(
            409, "no_subscription",
            "Account {} has no subscription to change.".format(account_id),
            {"account_id": account_id},
        )

    tier, cycle = plans.resolve(body.plan_code)
    target = plans.stored_name(tier, cycle)
    currency = plans_view.billing_currency(clinic.country)
    old_micros = plans_view.monthly_mrr_micros(subscription.plan_name, currency)
    new_micros = plans_view.monthly_mrr_micros(target, currency)

    mandate_live = bool(
        subscription.provider_subscription_id
        and (subscription.provider or "").lower() in LIVE_MANDATE_PROVIDERS
    )
    mandate_state = "stale" if (mandate_live and old_micros != new_micros) else "unchanged"

    before = {"plan_name": subscription.plan_name,
              "subscription_plan": clinic.subscription_plan}
    subscription.plan_name = target
    subscription.updated_at = datetime.datetime.utcnow()
    # `clinics.subscription_plan` is the entitlement column the product gates
    # features on; `subscriptions.plan_name` is what was bought. Both move, or
    # the header says one thing and the subscription page another — a bug this
    # product has already had once.
    #
    # Only this clinic's entitlement moves. Branch clinics keep their own,
    # because MolarPlus bills per clinic and group billing does not exist yet;
    # see integration/org.py.
    clinic.subscription_plan = tier
    clinic.updated_at = datetime.datetime.utcnow()

    store.record(
        db, caller, "change_plan", account_id, clinic.id, reason=body.reason,
        before=before,
        after={"plan_name": target, "subscription_plan": tier,
               "mrr_micros": new_micros, "currency": currency,
               "provider_mandate": mandate_state},
    )
    if mandate_state == "stale":
        log.warning(
            "account %s moved to %s by %s, but its %s mandate %s still collects "
            "the old amount (%s -> %s micros). The customer must re-authorise "
            "through the product.",
            account_id, target, caller.label, subscription.provider,
            subscription.provider_subscription_id, old_micros, new_micros,
        )
    db.flush()

    result = shapes.subscription(subscription, clinic.id, clinic)
    headers = {MANDATE_HEADER: mandate_state}
    response.headers[MANDATE_HEADER] = mandate_state
    return _commit(db, idempotency_key, "POST /accounts/plan", payload, caller,
                   result, headers)


# ── POST /accounts/{id}/suspend · /activate ──────────────────────────────────

def _set_group_status(db: Session, clinic: Clinic, target: str,
                      only_from: Optional[str] = None) -> List[int]:
    """Apply a status to every clinic in the account's group.

    Suspension has to reach the branches. MolarPlus gates access on each
    clinic's own `status`, so suspending the parent alone leaves every branch
    of a group still working — which is not what "suspend this account" means
    to the person asking for it.
    """
    changed = []
    for member in db.query(Clinic).filter(org.belongs_to(Clinic, clinic.id)).all():
        if only_from is not None and (member.status or "").lower() != only_from:
            continue
        if (member.status or "").lower() == target:
            continue
        member.status = target
        member.updated_at = datetime.datetime.utcnow()
        changed.append(member.id)
    return changed


@router.post("/accounts/{account_id}/suspend", tags=["actions"], operation_id="suspendAccount")
def suspend_account(account_id: str, body: SuspendBody,
                    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                    db: Session = Depends(get_db),
                    caller: Caller = Depends(require_write)):
    """Cut the account off. `reason` is required.

    Suspending cuts a real business off from its own software, and six months
    later somebody will need to know why. A 422 for a missing reason is a
    smaller cost than an unexplained suspension.
    """
    payload = _body(body)
    replayed = _replayed(db, idempotency_key, "POST /accounts/suspend", payload)
    if replayed is not None:
        return replayed

    clinic = _account_clinic(db, account_id)
    if not (body.reason or "").strip():
        raise ContractError(422, "reason_required",
                            "A reason is required to suspend an account.")
    if (clinic.status or "").lower() == "suspended":
        raise ContractError(409, "already_suspended",
                            "Account {} is already suspended.".format(account_id))

    was = clinic.status
    changed = _set_group_status(db, clinic, "suspended")
    store.record(db, caller, "suspend", account_id, clinic.id, reason=body.reason,
                 before={"status": was},
                 after={"status": "suspended", "clinics_changed": changed})
    db.flush()

    result = _account_response(db, account_id)
    return _commit(db, idempotency_key, "POST /accounts/suspend", payload, caller, result)


@router.post("/accounts/{account_id}/activate", tags=["actions"], operation_id="activateAccount")
def activate_account(account_id: str, body: Optional[SuspendBody] = None,
                     idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                     db: Session = Depends(get_db),
                     caller: Caller = Depends(require_write)):
    """Reverse a suspension.

    Only clinics that are actually suspended come back. A branch that was
    closed down stays closed — reactivating an account is not a reason to
    reopen a site somebody deliberately shut.
    """
    reason = body.reason if body else None
    payload = {"reason": reason}
    replayed = _replayed(db, idempotency_key, "POST /accounts/activate", payload)
    if replayed is not None:
        return replayed

    clinic = _account_clinic(db, account_id)
    if (clinic.status or "").lower() == "active":
        raise ContractError(409, "already_active",
                            "Account {} is already active.".format(account_id))

    was = clinic.status
    changed = _set_group_status(db, clinic, "active", only_from="suspended")
    if clinic.id not in changed:
        # The account row itself was in some other state — cancelled, say.
        clinic.status = "active"
        clinic.updated_at = datetime.datetime.utcnow()
        changed.append(clinic.id)
    store.record(db, caller, "activate", account_id, clinic.id, reason=reason,
                 before={"status": was},
                 after={"status": "active", "clinics_changed": changed})
    db.flush()

    result = _account_response(db, account_id)
    return _commit(db, idempotency_key, "POST /accounts/activate", payload, caller, result)
