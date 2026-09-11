"""Supplier bills on credit, and the payments that settle them.

Payables already existed here in one narrow form: costs derived from lab orders
and consultant fees, which are things the clinic incurs per *case*. This is the
other half — the dental materials order, the equipment AMC, the electricity
bill — which arrive per *supplier*, on terms, and are owed long before they are
paid.

The rule that keeps this honest: a bill is an obligation, an Expense is a
payment. Recording a bill moves no money and touches no ledger. Only paying it
writes an Expense, exactly as the lab and consultant settlement path does, so
the ledger, the CSV export and the dashboard Net card keep one source of truth
and cannot double-count.
"""
import datetime
import logging
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user, has_permission
from database import get_db
from domains.finance.services.payables import (
    SETTLED_EPSILON, ageing_summary, compute_due_date, days_overdue,
    outstanding, paid_amount, resolve_status, terms_from_due_date,
)
from models import Expense, PurchaseBill, PurchaseBillPayment, User, Vendor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/purchase-bills", tags=["purchase-bills"])


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

STATUSES = ('unpaid', 'partial', 'paid', 'cancelled')


class BillIn(BaseModel):
    vendor_id: int
    bill_number: Optional[str] = Field(None, max_length=64)
    bill_date: str                                   # YYYY-MM-DD
    terms_days: Optional[int] = Field(None, ge=0, le=365)
    due_date: Optional[str] = None                   # overrides terms_days
    subtotal: float = 0.0
    tax: float = 0.0
    amount: float = Field(..., gt=0)
    category: str = 'Other'
    notes: Optional[str] = None
    bill_file_url: Optional[str] = None


class BillPatch(BaseModel):
    bill_number: Optional[str] = Field(None, max_length=64)
    bill_date: Optional[str] = None
    terms_days: Optional[int] = Field(None, ge=0, le=365)
    due_date: Optional[str] = None
    subtotal: Optional[float] = None
    tax: Optional[float] = None
    amount: Optional[float] = Field(None, gt=0)
    category: Optional[str] = None
    notes: Optional[str] = None
    bill_file_url: Optional[str] = None


class PaymentIn(BaseModel):
    amount: float = Field(..., gt=0)
    paid_on: Optional[str] = None                    # defaults to today
    payment_method: str = 'Cash'
    reference: Optional[str] = Field(None, max_length=64)
    notes: Optional[str] = None
    from_petty_cash: bool = False


def _parse_date(value: str, field: str) -> datetime.date:
    try:
        return datetime.datetime.strptime(value, '%Y-%m-%d').date()
    except (TypeError, ValueError):
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")


def _get_bill(db: Session, bill_id: int, clinic_id: int) -> PurchaseBill:
    bill = db.query(PurchaseBill).filter(
        PurchaseBill.id == bill_id, PurchaseBill.clinic_id == clinic_id
    ).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    return bill


def serialise(bill: PurchaseBill, vendor: Optional[Vendor] = None,
              today: Optional[datetime.date] = None) -> dict:
    payments = list(bill.payments or [])
    return {
        'id': bill.id,
        'vendor_id': bill.vendor_id,
        'vendor_name': (vendor.name if vendor else
                        (bill.vendor.name if bill.vendor else 'Unknown')),
        'bill_number': bill.bill_number,
        'bill_date': bill.bill_date.isoformat() if bill.bill_date else None,
        'terms_days': bill.terms_days,
        'due_date': bill.due_date.isoformat() if bill.due_date else None,
        'subtotal': round(float(bill.subtotal or 0), 2),
        'tax': round(float(bill.tax or 0), 2),
        'amount': round(float(bill.amount or 0), 2),
        'paid': paid_amount(payments),
        'outstanding': outstanding(bill, payments),
        'status': bill.status,
        'days_overdue': days_overdue(bill, today),
        'category': bill.category,
        'notes': bill.notes,
        # The key is stored; a signed link goes out. See _sign_attachment.
        'bill_file_url': _sign_attachment(bill.bill_file_url),
        'has_attachment': bool(bill.bill_file_url),
        'payments': [{
            'id': p.id,
            'amount': round(float(p.amount or 0), 2),
            'paid_on': p.paid_on.isoformat() if p.paid_on else None,
            'payment_method': p.payment_method,
            'reference': p.reference,
            'notes': p.notes,
            'expense_id': p.expense_id,
        } for p in sorted(payments, key=lambda x: (x.paid_on or datetime.date.min, x.id))],
    }



# ── The supplier's bill, as a file ──────────────────────────────────────────
#
# What a supplier actually sends: a PDF, or a phone photo of a paper bill. The
# column holds the storage KEY and the response carries a freshly signed link —
# this codebase has already stored a presigned URL twice and watched it 403
# some days later, so nothing here writes a link that can expire.

_ATTACH_MAX_BYTES = 10 * 1024 * 1024
_ATTACH_IMAGE_FORMATS = {"PNG", "JPEG", "WEBP"}


def _sign_attachment(key):
    if not key:
        return None
    try:
        from domains.infrastructure.services.r2_storage import get_presigned_url
        return get_presigned_url(key) or None
    except Exception:
        # A storage hiccup loses the link, not the bill.
        logger.warning("Could not sign bill attachment %s", key)
        return None


def _sniff_attachment(raw: bytes):
    """What the file really is, decided from its bytes.

    Not from the filename and not from the Content-Type, both of which the
    client chooses: a renamed executable claims to be `bill.pdf` just as easily
    as a real bill does. A PDF announces itself in its first five bytes; an
    image has to survive being decoded.
    """
    if raw[:5] == b"%PDF-":
        return "pdf", "application/pdf"
    try:
        from PIL import Image
        probe = Image.open(__import__("io").BytesIO(raw))
        probe.verify()
        fmt = (probe.format or "").upper()
    except Exception:
        return None, None
    if fmt not in _ATTACH_IMAGE_FORMATS:
        return None, None
    return ("jpg" if fmt == "JPEG" else fmt.lower()), f"image/{'jpeg' if fmt == 'JPEG' else fmt.lower()}"


# ── Bills ───────────────────────────────────────────────────────────────────

@router.get("")
def list_bills(
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    overdue_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "view")
    q = db.query(PurchaseBill).filter(PurchaseBill.clinic_id == current_user.clinic_id)
    if status:
        if status not in STATUSES:
            raise HTTPException(status_code=400, detail=f"status must be one of {STATUSES}")
        q = q.filter(PurchaseBill.status == status)
    if vendor_id:
        q = q.filter(PurchaseBill.vendor_id == vendor_id)

    today = datetime.date.today()
    bills = q.order_by(PurchaseBill.due_date.asc(), PurchaseBill.id.desc()).all()
    if overdue_only:
        bills = [b for b in bills
                 if b.status not in ('paid', 'cancelled') and b.due_date < today]

    rows = [serialise(b, today=today) for b in bills]
    return {
        'items': rows,
        'outstanding_total': round(sum(r['outstanding'] for r in rows
                                       if r['status'] not in ('paid', 'cancelled')), 2),
        'overdue_total': round(sum(r['outstanding'] for r in rows if r['days_overdue'] > 0), 2),
    }


@router.get("/ageing")
def ageing(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """What is owed, by how long it has been on the book."""
    _ensure(current_user, "view")
    bills = db.query(PurchaseBill).filter(
        PurchaseBill.clinic_id == current_user.clinic_id,
        PurchaseBill.status != 'cancelled',
    ).all()
    today = datetime.date.today()

    by_vendor = {}
    for bill in bills:
        left = outstanding(bill)
        if left <= SETTLED_EPSILON:
            continue
        name = bill.vendor.name if bill.vendor else 'Unknown'
        e = by_vendor.setdefault(bill.vendor_id, {
            'vendor_id': bill.vendor_id, 'vendor': name,
            'count': 0, 'outstanding': 0.0, 'overdue': 0.0,
        })
        e['count'] += 1
        e['outstanding'] = round(e['outstanding'] + left, 2)
        if days_overdue(bill, today) > 0:
            e['overdue'] = round(e['overdue'] + left, 2)

    summary = ageing_summary(bills, today)
    summary['by_vendor'] = sorted(by_vendor.values(), key=lambda x: -x['outstanding'])
    return summary


@router.get("/vendor/{vendor_id}/statement")
def vendor_statement(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Every bill and payment for one supplier, oldest first.

    This is what gets read down the phone when a supplier disputes a balance,
    so it shows the movements rather than only the total.
    """
    _ensure(current_user, "view")
    vendor = db.query(Vendor).filter(
        Vendor.id == vendor_id, Vendor.clinic_id == current_user.clinic_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    bills = db.query(PurchaseBill).filter(
        PurchaseBill.clinic_id == current_user.clinic_id,
        PurchaseBill.vendor_id == vendor_id,
    ).order_by(PurchaseBill.bill_date.asc(), PurchaseBill.id.asc()).all()

    today = datetime.date.today()
    rows = [serialise(b, vendor, today) for b in bills]
    live = [r for r in rows if r['status'] != 'cancelled']
    return {
        'vendor': {
            'id': vendor.id, 'name': vendor.name,
            'payment_terms_days': vendor.payment_terms_days,
            'credit_limit': vendor.credit_limit,
        },
        'bills': rows,
        'billed_total': round(sum(r['amount'] for r in live), 2),
        'paid_total': round(sum(r['paid'] for r in live), 2),
        'outstanding_total': round(sum(r['outstanding'] for r in live), 2),
        # Only meaningful once a limit is set, and it is what is *owed* against
        # the limit, not what has ever been billed.
        'over_limit': bool(
            vendor.credit_limit
            and sum(r['outstanding'] for r in live) > float(vendor.credit_limit)
        ),
    }


@router.get("/{bill_id}")
def get_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "view")
    return serialise(_get_bill(db, bill_id, current_user.clinic_id))


@router.post("")
def create_bill(
    payload: BillIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "edit")
    vendor = db.query(Vendor).filter(
        Vendor.id == payload.vendor_id, Vendor.clinic_id == current_user.clinic_id
    ).first()
    if not vendor:
        raise HTTPException(status_code=404, detail="Vendor not found")

    bill_date = _parse_date(payload.bill_date, 'bill_date')
    # Terms fall back to whatever this supplier normally gives, which is the
    # whole point of storing them on the vendor — but the bill keeps its own
    # copy, so changing the vendor later never re-dates a bill already entered.
    terms = payload.terms_days
    if terms is None:
        terms = vendor.payment_terms_days or 0

    if payload.due_date:
        due = _parse_date(payload.due_date, 'due_date')
        if due < bill_date:
            raise HTTPException(status_code=400, detail="due_date cannot precede bill_date")
        terms = terms_from_due_date(bill_date, due)
    else:
        due = compute_due_date(bill_date, terms)

    bill = PurchaseBill(
        clinic_id=current_user.clinic_id,
        vendor_id=vendor.id,
        bill_number=(payload.bill_number or '').strip() or None,
        bill_date=bill_date,
        terms_days=terms,
        due_date=due,
        subtotal=round(float(payload.subtotal or 0), 2),
        tax=round(float(payload.tax or 0), 2),
        amount=round(float(payload.amount), 2),
        status='unpaid',
        category=payload.category or 'Other',
        notes=payload.notes,
        bill_file_url=payload.bill_file_url,
        created_by=current_user.id,
    )
    db.add(bill)
    db.commit()
    db.refresh(bill)
    return serialise(bill, vendor)


@router.patch("/{bill_id}")
def update_bill(
    bill_id: int,
    payload: BillPatch,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "edit")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    data = payload.model_dump(exclude_unset=True)

    if 'amount' in data:
        new_amount = round(float(data['amount']), 2)
        if new_amount < paid_amount(bill.payments or []) - SETTLED_EPSILON:
            raise HTTPException(
                status_code=400,
                detail="Bill total cannot be less than what has already been paid against it",
            )
        bill.amount = new_amount

    for field in ('bill_number', 'subtotal', 'tax', 'category', 'notes', 'bill_file_url'):
        if field in data:
            setattr(bill, field, data[field])

    if 'bill_date' in data:
        bill.bill_date = _parse_date(data['bill_date'], 'bill_date')
    if 'terms_days' in data:
        bill.terms_days = max(0, int(data['terms_days'] or 0))
    # Recomputed whenever either side of the pair moves, so they cannot drift.
    if 'due_date' in data and data['due_date']:
        due = _parse_date(data['due_date'], 'due_date')
        if due < bill.bill_date:
            raise HTTPException(status_code=400, detail="due_date cannot precede bill_date")
        bill.due_date = due
        bill.terms_days = terms_from_due_date(bill.bill_date, due)
    elif 'bill_date' in data or 'terms_days' in data:
        bill.due_date = compute_due_date(bill.bill_date, bill.terms_days)

    bill.status = resolve_status(bill)
    db.commit()
    db.refresh(bill)
    return serialise(bill)


@router.post("/{bill_id}/cancel")
def cancel_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Cancel a bill that should never have been entered.

    Refused once money has moved against it: the payments are real, and a
    cancelled bill holding real payments would drop them out of every total
    while leaving the Expenses in the ledger.
    """
    _ensure(current_user, "edit")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    if bill.payments:
        raise HTTPException(
            status_code=400,
            detail="Reverse the payments before cancelling this bill",
        )
    bill.status = 'cancelled'
    db.commit()
    db.refresh(bill)
    return serialise(bill)


@router.delete("/{bill_id}")
def delete_bill(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _ensure(current_user, "delete")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    if bill.payments:
        raise HTTPException(
            status_code=400,
            detail="Reverse the payments before deleting this bill",
        )
    db.delete(bill)
    db.commit()
    return {"ok": True}



@router.post("/{bill_id}/attachment")
async def attach_bill_file(
    bill_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Attach the supplier's own bill — a PDF or a photo of the paper one."""
    _ensure(current_user, "edit")
    bill = _get_bill(db, bill_id, current_user.clinic_id)

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="empty upload")
    if len(raw) > _ATTACH_MAX_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"file too large (max {_ATTACH_MAX_BYTES // (1024 * 1024)} MB)",
        )

    ext, content_type = _sniff_attachment(raw)
    if not ext:
        raise HTTPException(status_code=400, detail="Attach a PDF or a photo (JPEG, PNG or WEBP)")

    from domains.infrastructure.services.r2_storage import StorageCategory, upload_bytes_to_r2
    key = upload_bytes_to_r2(
        data=raw,
        filename=f"purchase_bill_{bill.id}_{int(datetime.datetime.utcnow().timestamp())}.{ext}",
        content_type=content_type,
        clinic_id=current_user.clinic_id,
        category=StorageCategory.EXPENSES,
    )
    if not key:
        raise HTTPException(status_code=502, detail="Could not store that file. Try again.")

    bill.bill_file_url = key
    # A bill already paid carries the attachment through to the ledger rows it
    # wrote, so the expense in the Ledger opens the same document.
    for payment in (bill.payments or []):
        if payment.expense_id:
            exp = db.query(Expense).filter(
                Expense.id == payment.expense_id,
                Expense.clinic_id == current_user.clinic_id,
            ).first()
            if exp and not exp.bill_file_url:
                exp.bill_file_url = key
    db.commit()
    db.refresh(bill)
    return serialise(bill)


@router.delete("/{bill_id}/attachment")
def remove_bill_file(
    bill_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Detach the file. The object stays in storage: it is also the document
    behind any expense this bill has already written, and those keep it."""
    _ensure(current_user, "edit")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    bill.bill_file_url = None
    db.commit()
    db.refresh(bill)
    return serialise(bill)


# ── Payments ────────────────────────────────────────────────────────────────

@router.post("/{bill_id}/payments")
def add_payment(
    bill_id: int,
    payload: PaymentIn,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Pay some or all of a bill, writing the Expense that records the money."""
    _ensure(current_user, "edit")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    if bill.status == 'cancelled':
        raise HTTPException(status_code=400, detail="This bill is cancelled")

    amount = round(float(payload.amount), 2)
    left = outstanding(bill)
    if left <= SETTLED_EPSILON:
        raise HTTPException(status_code=400, detail="This bill is already settled")
    # Overpaying is refused rather than absorbed: a supplier paid more than they
    # billed is either a typo or a credit note, and silently swallowing it would
    # put money in the ledger that no bill accounts for.
    if amount > left + SETTLED_EPSILON:
        raise HTTPException(
            status_code=400,
            detail=f"That is more than the {left:.2f} still outstanding on this bill",
        )

    paid_on = (_parse_date(payload.paid_on, 'paid_on') if payload.paid_on
               else datetime.date.today())

    vendor = db.query(Vendor).filter(Vendor.id == bill.vendor_id).first()
    expense = Expense(
        clinic_id=current_user.clinic_id,
        vendor_id=bill.vendor_id,
        amount=amount,
        payment_method=payload.payment_method or 'Cash',
        category=bill.category or 'Other',
        notes="; ".join(filter(None, [
            f"Bill {bill.bill_number}" if bill.bill_number else "Supplier bill",
            vendor.name if vendor else None,
            payload.reference,
            f"[purchase_bill:{bill.id}]",
        ])),
        from_petty_cash=bool(payload.from_petty_cash),
        # The supplier's bill travels with the payment, so the Ledger row for
        # this money opens the document that justifies it.
        bill_file_url=bill.bill_file_url,
        date=datetime.datetime.combine(paid_on, datetime.time.min),
        created_by=current_user.id,
    )
    db.add(expense)
    db.flush()

    payment = PurchaseBillPayment(
        clinic_id=current_user.clinic_id,
        bill_id=bill.id,
        amount=amount,
        paid_on=paid_on,
        payment_method=payload.payment_method or 'Cash',
        reference=(payload.reference or '').strip() or None,
        notes=payload.notes,
        expense_id=expense.id,
        created_by=current_user.id,
    )
    db.add(payment)
    db.flush()

    # Paying a supplier out of the drawer has to come off the drawer, or the
    # float silently overstates itself until the next count finds it short.
    if payload.from_petty_cash:
        from models import PettyCashEntry
        db.add(PettyCashEntry(
            clinic_id=current_user.clinic_id,
            kind='spend',
            amount=-amount,
            occurred_on=paid_on,
            description=f"Paid {vendor.name if vendor else 'supplier'}"
                        + (f" bill {bill.bill_number}" if bill.bill_number else ""),
            category=bill.category or 'Other',
            expense_id=expense.id,
            created_by=current_user.id,
        ))

    db.refresh(bill)
    bill.status = resolve_status(bill)
    db.commit()
    db.refresh(bill)
    return serialise(bill)


@router.delete("/{bill_id}/payments/{payment_id}")
def reverse_payment(
    bill_id: int,
    payment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Undo a payment, removing the Expense it wrote.

    The Expense goes with it. Leaving it behind would keep the money in the
    ledger for a payment that, as far as the supplier is concerned, never
    happened — which is the same double-count the settlement path avoids.
    """
    _ensure(current_user, "delete")
    bill = _get_bill(db, bill_id, current_user.clinic_id)
    payment = db.query(PurchaseBillPayment).filter(
        PurchaseBillPayment.id == payment_id,
        PurchaseBillPayment.bill_id == bill.id,
        PurchaseBillPayment.clinic_id == current_user.clinic_id,
    ).first()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")

    # Everything holding a reference to the Expense goes before the Expense
    # itself: both the payment and any petty-cash movement carry the foreign
    # key, and there is no relationship declared for SQLAlchemy to order the
    # deletes from, so emitting them the other way round fails the constraint.
    from models import PettyCashEntry
    expense_id = payment.expense_id
    if expense_id:
        for entry in db.query(PettyCashEntry).filter(
            PettyCashEntry.expense_id == expense_id,
            PettyCashEntry.clinic_id == current_user.clinic_id,
        ).all():
            db.delete(entry)

    db.delete(payment)
    db.flush()

    if expense_id:
        exp = db.query(Expense).filter(
            Expense.id == expense_id,
            Expense.clinic_id == current_user.clinic_id,
        ).first()
        if exp:
            db.delete(exp)
        db.flush()
    db.refresh(bill)
    bill.status = resolve_status(bill)
    db.commit()
    db.refresh(bill)
    return serialise(bill)
