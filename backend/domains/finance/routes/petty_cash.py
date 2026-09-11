"""The cash drawer: a float, what came out of it, and the day's count.

Every clinic runs one and almost none of them record it, which is why the
question "where did the 2,000 go" has no answer by Friday. Three ideas and
nothing more:

  * the float goes up when it is topped up and down when it is spent,
  * the balance is the sum of those movements and is never stored, and
  * closing the day records what was actually counted against what should have
    been there, and does not quietly fix the difference.

That last one is the point of the feature. A drawer that is short by 200 is a
fact about the day. Writing a silent correction would leave the balance right
and destroy the only evidence that anything happened.
"""
import datetime
import logging
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user, has_permission
from database import get_db
from models import Expense, PettyCashClose, PettyCashEntry, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/petty-cash", tags=["petty-cash"])


def _ensure(current_user: User, action: str) -> None:
    """Money in and money out are the same permission.

    `has_permission` rather than a hand-rolled `permissions.get("billing")`:
    the role presets write `finance` and the permissions screen writes
    `billing`, and only that helper knows the two are the same module. Reading
    the key directly is how guards ended up testing a key no staff account has
    ever carried. See RESOURCE_ALIASES in core/auth_utils.
    """
    if not has_permission(current_user, action, "billing"):
        raise HTTPException(
            status_code=403,
            detail=f"Insufficient permissions. Required: billing.{action}",
        )

KINDS = ('top_up', 'spend', 'adjustment')


class EntryIn(BaseModel):
    kind: str
    # Always positive. The kind decides which way it moves the drawer, so a
    # top-up that reduces the float is not expressible.
    amount: float = Field(..., gt=0)
    occurred_on: Optional[str] = None                # defaults to today
    description: Optional[str] = Field(None, max_length=255)
    category: Optional[str] = None
    # Adjustments are the one kind that can go either way — a recount that finds
    # more than expected is as real as one that finds less.
    increases_float: bool = True


class CloseIn(BaseModel):
    counted_amount: float = Field(..., ge=0)
    closed_on: Optional[str] = None
    notes: Optional[str] = None


def _parse_date(value: str, field: str) -> datetime.date:
    try:
        return datetime.datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")


def current_balance(db: Session, clinic_id: int,
                    upto: Optional[datetime.date] = None) -> float:
    """What should be in the drawer. Derived, never stored."""
    q = db.query(func.coalesce(func.sum(PettyCashEntry.amount), 0.0)).filter(
        PettyCashEntry.clinic_id == clinic_id
    )
    if upto is not None:
        q = q.filter(PettyCashEntry.occurred_on <= upto)
    return round(float(q.scalar() or 0.0), 2)


def serialise(entry: PettyCashEntry) -> dict:
    return {
        'id': entry.id,
        'kind': entry.kind,
        'amount': round(float(entry.amount or 0), 2),   # signed
        'occurred_on': entry.occurred_on.isoformat() if entry.occurred_on else None,
        'description': entry.description,
        'category': entry.category,
        'expense_id': entry.expense_id,
    }


@router.get("")
def list_entries(
    days: int = Query(60, ge=1, le=730),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Recent movements, newest first, each with the balance after it.

    The running balance is computed forward from the opening figure rather than
    stored per row: a back-dated entry has to change every balance after it, and
    a stored column would leave the older rows quietly wrong.
    """
    _ensure(current_user, "view")
    cid = current_user.clinic_id
    since = datetime.date.today() - datetime.timedelta(days=days)

    # Everything before the window, collapsed into one opening number.
    opening = round(float(
        db.query(func.coalesce(func.sum(PettyCashEntry.amount), 0.0))
        .filter(PettyCashEntry.clinic_id == cid,
                PettyCashEntry.occurred_on < since).scalar() or 0.0), 2)

    rows = db.query(PettyCashEntry).filter(
        PettyCashEntry.clinic_id == cid, PettyCashEntry.occurred_on >= since
    ).order_by(PettyCashEntry.occurred_on.asc(), PettyCashEntry.id.asc()).all()

    running, out = opening, []
    for entry in rows:
        running = round(running + float(entry.amount or 0), 2)
        item = serialise(entry)
        item['balance_after'] = running
        out.append(item)

    return {
        'opening_balance': opening,
        'balance': running,
        'items': list(reversed(out)),
        'topped_up': round(sum(float(r.amount) for r in rows if r.kind == 'top_up'), 2),
        'spent': round(-sum(float(r.amount) for r in rows if r.kind == 'spend'), 2),
    }


@router.get("/balance")
def balance(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What should be in the drawer right now, and when it was last counted."""
    _ensure(current_user, "view")
    cid = current_user.clinic_id
    last = db.query(PettyCashClose).filter(
        PettyCashClose.clinic_id == cid
    ).order_by(PettyCashClose.closed_on.desc(), PettyCashClose.id.desc()).first()

    return {
        'balance': current_balance(db, cid),
        'last_close': {
            'closed_on': last.closed_on.isoformat(),
            'counted_amount': round(float(last.counted_amount), 2),
            'expected_amount': round(float(last.expected_amount), 2),
            'variance': round(float(last.variance), 2),
        } if last else None,
    }


@router.post("")
def add_entry(
    payload: EntryIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "edit")
    if payload.kind not in KINDS:
        raise HTTPException(status_code=400, detail=f"kind must be one of {KINDS}")

    amount = round(float(payload.amount), 2)
    if payload.kind == 'top_up':
        signed = amount
    elif payload.kind == 'spend':
        signed = -amount
    else:
        signed = amount if payload.increases_float else -amount

    when = (_parse_date(payload.occurred_on, 'occurred_on') if payload.occurred_on
            else datetime.date.today())

    # A drawer cannot hold less than nothing. Refusing here is what turns "the
    # balance looks wrong" into "this spend is the one that does not fit".
    if signed < 0:
        available = current_balance(db, current_user.clinic_id)
        if amount > available + 0.01:
            raise HTTPException(
                status_code=400,
                detail=f"Only {available:.2f} in the float. Top it up first, "
                       f"or record an adjustment if the drawer really holds more.",
            )

    entry = PettyCashEntry(
        clinic_id=current_user.clinic_id,
        kind=payload.kind,
        amount=signed,
        occurred_on=when,
        description=(payload.description or '').strip() or None,
        category=payload.category,
        created_by=current_user.id,
    )

    # A spend is a real cost, so it belongs in the ledger like any other. A
    # top-up is not: it moves money from the bank into the drawer, and counting
    # it as an expense would book the same rupee twice, once on the way in and
    # again when it is spent.
    if payload.kind == 'spend':
        expense = Expense(
            clinic_id=current_user.clinic_id,
            amount=amount,
            payment_method='Cash',
            category=payload.category or 'Other',
            notes="; ".join(filter(None, [payload.description, '[petty_cash]'])),
            from_petty_cash=True,
            date=datetime.datetime.combine(when, datetime.time.min),
            created_by=current_user.id,
        )
        db.add(expense)
        db.flush()
        entry.expense_id = expense.id

    db.add(entry)
    db.commit()
    db.refresh(entry)
    out = serialise(entry)
    out['balance'] = current_balance(db, current_user.clinic_id)
    return out


@router.delete("/{entry_id}")
def delete_entry(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Remove a movement, and the ledger row it wrote."""
    _ensure(current_user, "delete")
    entry = db.query(PettyCashEntry).filter(
        PettyCashEntry.id == entry_id,
        PettyCashEntry.clinic_id == current_user.clinic_id,
    ).first()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")

    # Order matters: the entry holds the foreign key, so it has to go first.
    # SQLAlchemy has no declared relationship between the two to sort the
    # deletes for it, and emitting them the other way round makes the commit
    # fail on the constraint.
    expense_id = entry.expense_id
    db.delete(entry)
    db.flush()

    if expense_id:
        exp = db.query(Expense).filter(
            Expense.id == expense_id,
            Expense.clinic_id == current_user.clinic_id,
        ).first()
        if exp:
            db.delete(exp)

    db.commit()
    return {"ok": True, "balance": current_balance(db, current_user.clinic_id)}


# ── The day close ───────────────────────────────────────────────────────────

@router.get("/closes")
def list_closes(
    limit: int = Query(30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "view")
    rows = db.query(PettyCashClose).filter(
        PettyCashClose.clinic_id == current_user.clinic_id
    ).order_by(PettyCashClose.closed_on.desc(), PettyCashClose.id.desc()).limit(limit).all()

    return {'items': [{
        'id': r.id,
        'closed_on': r.closed_on.isoformat(),
        'counted_amount': round(float(r.counted_amount), 2),
        'expected_amount': round(float(r.expected_amount), 2),
        'variance': round(float(r.variance), 2),
        'notes': r.notes,
        'closed_by': (db.query(User).filter(User.id == r.closed_by).first().name
                      if r.closed_by else None),
    } for r in rows]}


@router.post("/close")
def close_day(
    payload: CloseIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record the count. The variance is reported, not corrected.

    Nothing is written to the float here, so the balance after a short close is
    still what the movements say it should be. Putting that right is a separate
    adjustment somebody has to choose to make — which is the difference between
    a discrepancy that was noticed and one that was papered over.
    """
    _ensure(current_user, "edit")
    cid = current_user.clinic_id
    closed_on = (_parse_date(payload.closed_on, 'closed_on') if payload.closed_on
                 else datetime.date.today())

    existing = db.query(PettyCashClose).filter(
        PettyCashClose.clinic_id == cid, PettyCashClose.closed_on == closed_on
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="That day has already been closed")

    expected = current_balance(db, cid, upto=closed_on)
    counted = round(float(payload.counted_amount), 2)

    row = PettyCashClose(
        clinic_id=cid,
        closed_on=closed_on,
        counted_amount=counted,
        expected_amount=expected,
        variance=round(counted - expected, 2),
        notes=payload.notes,
        closed_by=current_user.id,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return {
        'id': row.id,
        'closed_on': row.closed_on.isoformat(),
        'counted_amount': counted,
        'expected_amount': expected,
        'variance': row.variance,
        'notes': row.notes,
        # Unchanged by the close, on purpose.
        'balance': current_balance(db, cid),
    }
