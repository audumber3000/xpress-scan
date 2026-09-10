"""Discount codes and broadcast history: `GET /promotions`, `GET /campaigns`.

Two of the three tables here are MolarPlus's own (`subscription_coupons`,
`referral_codes`). The third, `marketing_campaigns`, is not — the support
console created it and was the only thing that ever wrote to it, exactly like
`growth_leads` in `leads.py`. It is declared in this package rather than in the
product's `models.py` to say so: a table we read for a migration, not part of
the product's domain.

**Coupons and referral codes are one resource on the wire.** To the CRM they
are the same thing — a string somebody types at checkout that reduces the bill,
with a usage count and an active flag — and the only structural difference is
that a referral names the partner who earns from it. Two endpoints would double
every view in the CRM to express one nullable field.

**Neither table has an `updated_at`.** So `updated_since` filters on
`created_at` here, which means an edit to an existing code — deactivating one,
raising its limit — does not bring it back in an incremental pull. That is the
same gap `subscription_payments` has and it is declared the same way: the CRM
reconciles these against a full snapshot rather than trusting a delta. Adding
the column in the product is the real fix.
"""
import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import (Boolean, Column, DateTime, Float, Integer, JSON,
                        String, func)
from sqlalchemy.orm import Session

from database import get_db
from models import Base, Clinic, ReferralCode, SubscriptionCoupon

from . import org, shapes, store
from .auth import Caller, require_read
from .wire import (DEFAULT_LIMIT, MAX_LIMIT, apply_keyset, envelope, ext_id,
                   parse_rfc3339, to_rfc3339)

router = APIRouter()


class MarketingCampaign(Base):
    """The console's broadcast audit log. See the module docstring."""

    __tablename__ = "marketing_campaigns"
    __table_args__ = {"extend_existing": True}

    id = Column(Integer, primary_key=True)
    channel = Column(String)
    template_name = Column(String)
    subject = Column(String)
    target_kind = Column(String)
    target_filter = Column(JSON)
    total_recipients = Column(Integer)
    sent_count = Column(Integer)
    failed_count = Column(Integer)
    skipped_count = Column(Integer)
    errors_summary = Column(JSON)
    sent_by = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


@router.get("/promotions", tags=["marketing"], operation_id="listPromotions")
def list_promotions(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: str = Query(None),
    updated_since: str = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """Every discount code, of both kinds, newest first within the cursor.

    The two tables are paged as one sequence by fetching a page from each and
    merging. That is honest about the cost — it reads `limit + 1` from both —
    and it is bounded, because neither table is large: these are codes somebody
    types by hand, not rows a product generates.
    """
    since = parse_rfc3339(updated_since)

    coupons = db.query(SubscriptionCoupon)
    referrals = db.query(ReferralCode)
    if since is not None:
        coupons = coupons.filter(SubscriptionCoupon.created_at >= since)
        referrals = referrals.filter(ReferralCode.created_at >= since)

    rows = [("promotion", row) for row in coupons.all()]
    rows += [("referral", row) for row in referrals.all()]

    # A single ordering across both tables. The id is namespaced by kind, so
    # coupon 7 and referral 7 cannot collide in the CRM.
    rows.sort(key=lambda pair: (pair[1].created_at or _EPOCH,
                                "{}:{}".format(pair[0], pair[1].id)))

    after = _decoded(cursor)
    if after is not None:
        rows = [pair for pair in rows
                if (pair[1].created_at or _EPOCH,
                    "{}:{}".format(pair[0], pair[1].id)) > after]

    return envelope(
        rows[:limit + 1], limit,
        lambda page: [shapes.promotion(kind, row) for kind, row in page],
        lambda pair: (pair[1].created_at or _EPOCH,
                      "{}:{}".format(pair[0], pair[1].id)),
    )


_EPOCH = datetime.datetime(1970, 1, 1)


def _decoded(cursor):
    from .wire import decode_cursor
    position = decode_cursor(cursor)
    return None if position is None else (position[0] or _EPOCH, position[1])


@router.get("/campaigns", tags=["marketing"], operation_id="listCampaigns")
def list_campaigns(
    limit: int = Query(DEFAULT_LIMIT, ge=1, le=MAX_LIMIT),
    cursor: str = Query(None),
    updated_since: str = Query(None),
    db: Session = Depends(get_db),
    caller: Caller = Depends(require_read),
):
    """What has been broadcast, and how much of it landed."""
    since = parse_rfc3339(updated_since)
    query = db.query(MarketingCampaign)
    if since is not None:
        query = query.filter(MarketingCampaign.created_at >= since)

    sort = MarketingCampaign.created_at
    query = apply_keyset(query, sort, MarketingCampaign.id, cursor)
    rows = query.limit(limit + 1).all()

    return envelope(
        rows, limit,
        lambda page: [shapes.campaign(row) for row in page],
        lambda row: (row.created_at, row.id),
    )


# ── Writes ───────────────────────────────────────────────────────────────────
#
# Built here rather than waiting for a port of the retired console's routes,
# because the console reads a database it does not own over a tunnel and is
# being switched off — and these three tables are MolarPlus's own. The console's
# version of this is ~200 lines across six routes; what follows is the same
# behaviour with the contract's envelope, an idempotency key and an audit row.

import random
import string

from fastapi import Header, Response
from pydantic import BaseModel
from typing import Any, Dict, Optional

from models import SubscriptionPayment
from .actions import _body, _commit, _explicit, _replayed
from .auth import require_write
from .wire import ContractError, money

PROMOTION_KINDS = ("promotion", "referral")

# Length of an auto-generated referral code. Eight is what the console used and
# what partners already have printed on things; changing it would make the old
# and new codes look like different schemes.
GENERATED_CODE_LENGTH = 8

# No I, O, 0 or 1. These get read aloud on calls and written on flyers, and a
# code somebody mistypes is a partner who does not get paid.
CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


class PromotionBody(BaseModel):
    code: Optional[str] = None
    kind: Optional[str] = None
    partner_name: Optional[str] = None
    discount_percent: Optional[float] = None
    discount_amount: Optional[float] = None
    usage_limit: Optional[int] = None
    is_active: Optional[bool] = None
    is_featured: Optional[bool] = None
    expires_at: Optional[str] = None
    reward: Optional[Dict[str, Any]] = None


def _split_id(raw: str):
    """`"referral:7"` → `("referral", 7)`.

    The prefix is what decides which table a write lands in:
    `subscription_coupons` and `referral_codes` have independent primary keys
    and both have a row 1. A bare id is rejected rather than guessed at.
    """
    kind, _, tail = (raw or "").partition(":")
    if kind not in PROMOTION_KINDS or not tail.isdigit():
        raise ContractError(
            404, "promotion_not_found",
            "No promotion with id {}. Ids look like 'promotion:7' or "
            "'referral:7' — the prefix says which table it is in.".format(raw),
            {"promotion_id": raw},
        )
    return kind, int(tail)


def _model_for(kind: str):
    return SubscriptionCoupon if kind == "promotion" else ReferralCode


def _load(db: Session, promotion_id: str):
    kind, row_id = _split_id(promotion_id)
    model = _model_for(kind)
    row = db.query(model).filter(model.id == row_id).first()
    if row is None:
        raise ContractError(404, "promotion_not_found",
                            "No promotion with id {}".format(promotion_id),
                            {"promotion_id": promotion_id})
    return kind, row


def _assert_one_discount(body: PromotionBody, sent) -> None:
    """A code carries a percentage or an amount, never both.

    Both is ambiguous at checkout, and the CRM deliberately does not reconcile
    them — it shows whichever is set. Refusing here is the only place the
    ambiguity can be prevented rather than discovered by a customer.
    """
    if "discount_percent" in sent and "discount_amount" in sent \
            and body.discount_percent is not None and body.discount_amount is not None:
        raise ContractError(
            422, "ambiguous_discount",
            "A code carries a percentage or a flat amount, not both.",
            {"discount_percent": body.discount_percent,
             "discount_amount": body.discount_amount},
        )


def _assert_code_free(db: Session, code: str, skip=None) -> None:
    """Codes are unique across both tables, case-insensitively.

    Customers type them in any case and the product upper-cases on the wire, so
    `summer10` and `SUMMER10` are the same code to everybody except a
    case-sensitive uniqueness check.
    """
    wanted = (code or "").strip().upper()
    for model in (SubscriptionCoupon, ReferralCode):
        for row in db.query(model).all():
            if (row.code or "").strip().upper() != wanted:
                continue
            if skip is not None and type(row) is type(skip) and row.id == skip.id:
                continue
            raise ContractError(422, "code_taken",
                                "The code {} is already in use.".format(wanted),
                                {"code": wanted})


def _generate_code(db: Session) -> str:
    for _ in range(20):
        candidate = "".join(random.choice(CODE_ALPHABET)
                            for _ in range(GENERATED_CODE_LENGTH))
        try:
            _assert_code_free(db, candidate)
            return candidate
        except ContractError:
            continue
    raise ContractError(500, "code_generation_failed",
                        "Could not generate an unused referral code.")


def _reject_wrong_fields(kind: str, sent) -> None:
    """`kind` decides the table, and therefore which fields exist.

    `referral_codes` has no `usage_limit`, no `is_featured` and no expiry;
    `subscription_coupons` has no partner and no reward. Silently dropping them
    would leave the CRM showing a limit the product never stored.
    """
    if kind == "referral":
        offending = [f for f in ("usage_limit", "is_featured", "expires_at") if f in sent]
        if offending:
            raise ContractError(
                422, "field_not_on_kind",
                "referral_codes has no {}.".format(", ".join(offending)),
                {"kind": kind, "fields": offending},
            )
    else:
        offending = [f for f in ("partner_name", "reward") if f in sent]
        if offending:
            raise ContractError(
                422, "field_not_on_kind",
                "subscription_coupons has no {}.".format(", ".join(offending)),
                {"kind": kind, "fields": offending},
            )


def _apply(row, kind: str, body: PromotionBody, sent) -> None:
    if "code" in sent and body.code:
        row.code = body.code.strip().upper()
    if "discount_percent" in sent:
        row.discount_percent = body.discount_percent
    if "is_active" in sent and body.is_active is not None:
        row.is_active = body.is_active
    if kind == "referral":
        if "partner_name" in sent:
            row.creator_name = body.partner_name
        if "reward" in sent:
            row.reward_details = body.reward
        return
    if "discount_amount" in sent:
        row.discount_amount = body.discount_amount
    if "usage_limit" in sent:
        row.usage_limit = body.usage_limit
    if "is_featured" in sent and body.is_featured is not None:
        row.is_featured = body.is_featured
    if "expires_at" in sent:
        row.expiry_date = parse_rfc3339(body.expires_at, "expires_at")


@router.post("/promotions", tags=["marketing"], operation_id="createPromotion")
def create_promotion(body: PromotionBody, response: Response,
                     idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                     db: Session = Depends(get_db),
                     caller: Caller = Depends(require_write)):
    """Issue a discount code, of either kind."""
    payload = _body(body)
    replayed = _replayed(db, idempotency_key, "POST /promotions", payload, response)
    if replayed is not None:
        return replayed

    kind = (body.kind or "promotion").strip().lower()
    if kind not in PROMOTION_KINDS:
        raise ContractError(422, "unknown_kind",
                            "kind must be one of {}.".format(", ".join(PROMOTION_KINDS)),
                            {"kind": body.kind})

    sent = _explicit(body)
    _reject_wrong_fields(kind, sent)
    _assert_one_discount(body, sent)

    # A blank code on a referral means generate one — that is the common path,
    # because nobody wants to invent a unique string by hand.
    code = (body.code or "").strip().upper()
    if not code:
        if kind != "referral":
            raise ContractError(422, "code_required",
                                "A promotion needs a code; only referral codes are generated.")
        code = _generate_code(db)
    else:
        _assert_code_free(db, code)

    if kind == "referral":
        if not (body.partner_name or "").strip():
            raise ContractError(422, "partner_required",
                                "A referral code names the partner who earns from it.")
        row = ReferralCode(code=code, creator_name=body.partner_name,
                           discount_percent=body.discount_percent,
                           reward_details=body.reward,
                           is_active=True if body.is_active is None else body.is_active,
                           usage_count=0)
    else:
        row = SubscriptionCoupon(
            code=code, discount_percent=body.discount_percent,
            discount_amount=body.discount_amount,
            usage_limit=body.usage_limit if body.usage_limit is not None else 100,
            used_count=0,
            is_active=True if body.is_active is None else body.is_active,
            is_featured=bool(body.is_featured),
            expiry_date=parse_rfc3339(body.expires_at, "expires_at"),
        )
    db.add(row)
    db.flush()

    store.record(db, caller, "create_promotion", None, None,
                 after={"id": "{}:{}".format(kind, row.id), "code": code, "kind": kind})
    result = shapes.promotion(kind, row)
    return _commit(db, idempotency_key, "POST /promotions", payload, caller, result)


@router.patch("/promotions/{promotion_id}", tags=["marketing"],
              operation_id="updatePromotion")
def update_promotion(promotion_id: str, body: PromotionBody,
                     idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                     db: Session = Depends(get_db),
                     caller: Caller = Depends(require_write)):
    """Change a code. Deactivating is `{"is_active": false}` and is most of the traffic."""
    payload = _body(body)
    replayed = _replayed(db, idempotency_key, "PATCH /promotions", payload)
    if replayed is not None:
        return replayed

    kind, row = _load(db, promotion_id)
    sent = _explicit(body)
    if "kind" in sent:
        raise ContractError(422, "kind_immutable",
                            "A code cannot change kind — it would move table and id.")
    _reject_wrong_fields(kind, sent)
    _assert_one_discount(body, sent)
    if "code" in sent and body.code:
        _assert_code_free(db, body.code, skip=row)

    before = shapes.promotion(kind, row)
    _apply(row, kind, body, sent)
    db.flush()
    after = shapes.promotion(kind, row)

    store.record(db, caller, "update_promotion", None, None,
                 before={"code": before["code"], "is_active": before["is_active"]},
                 after={"code": after["code"], "is_active": after["is_active"]})
    return _commit(db, idempotency_key, "PATCH /promotions", payload, caller, after)


@router.delete("/promotions/{promotion_id}", tags=["marketing"],
               operation_id="deletePromotion")
def delete_promotion(promotion_id: str, force: bool = Query(False),
                     idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
                     db: Session = Depends(get_db),
                     caller: Caller = Depends(require_write)):
    """Remove a code.

    Refused once it has been redeemed. A hard delete orphans the discount on
    every payment that used it, and those payments are the record of what the
    customer was actually charged — deactivating is almost always what was
    meant, and it keeps the history intact.
    """
    payload = {"force": force}
    replayed = _replayed(db, idempotency_key, "DELETE /promotions", payload)
    if replayed is not None:
        return replayed

    kind, row = _load(db, promotion_id)
    used = int((row.usage_count if kind == "referral" else row.used_count) or 0)
    if used > 0 and not force:
        raise ContractError(
            409, "code_in_use",
            "{} has been redeemed {} time(s). Deactivate it instead, or pass "
            "force=true to delete it and orphan the discount on those "
            "payments.".format(row.code, used),
            {"usage_count": used},
        )

    snapshot = shapes.promotion(kind, row)
    db.delete(row)
    db.flush()
    store.record(db, caller, "delete_promotion", None, None,
                 before={"code": snapshot["code"], "kind": kind, "usage_count": used})
    result = dict(snapshot, deleted=True)
    return _commit(db, idempotency_key, "DELETE /promotions", payload, caller, result)


@router.get("/promotions/{promotion_id}/redemptions", tags=["marketing"],
            operation_id="listPromotionRedemptions")
def list_promotion_redemptions(promotion_id: str, db: Session = Depends(get_db),
                               caller: Caller = Depends(require_read)):
    """Which accounts used this code.

    The question that follows immediately from seeing `12 / 100`: which twelve?
    Joined on `subscription_payments.coupon_code`, so it reports codes that
    were actually charged against rather than a counter somebody incremented.

    Accounts only. A promocode discounts a ClinoHealth subscription, so
    everyone who redeemed one is a customer of ours — there is nothing
    patient-shaped in this answer.
    """
    kind, row = _load(db, promotion_id)
    code = (row.code or "").strip().upper()

    payments = (
        db.query(SubscriptionPayment)
        .filter(func.upper(SubscriptionPayment.coupon_code) == code)
        .order_by(SubscriptionPayment.created_at.desc())
        .all()
    )
    clinic_ids = {p.clinic_id for p in payments if p.clinic_id}
    names = dict(
        db.query(Clinic.id, Clinic.name).filter(Clinic.id.in_(clinic_ids)).all()
    ) if clinic_ids else {}

    return {
        "promotion_id": promotion_id,
        "redemptions": [
            {
                "account_id": org.account_id(
                    org.account_of(db, db.query(Clinic).filter(
                        Clinic.id == p.clinic_id).first()).id
                ) if p.clinic_id else None,
                "account_name": names.get(p.clinic_id),
                "redeemed_at": to_rfc3339(p.paid_at or p.created_at),
                "discount_applied": money(p.discount_amount, p.currency),
                "payment_id": ext_id(p.id),
            }
            for p in payments
        ],
        "total": len(payments),
    }
