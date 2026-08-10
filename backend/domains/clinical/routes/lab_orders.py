import logging

from fastapi import APIRouter, HTTPException, Depends, status, Query
from sqlalchemy.orm import Session
from sqlalchemy import or_
from datetime import datetime, timedelta
from database import get_db
from models import LabOrder, User, Patient, Vendor, Clinic
from schemas import LabOrderCreate, LabOrderUpdate, LabOrderOut
from core.auth_utils import get_current_user
from typing import List, Optional

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lab-orders", tags=["lab-orders"])


def _notify_vendor_of_order(db: Session, order: LabOrder, clinic_id: int):
    """Tell the lab a new work order was placed.

    Off by default — it only fires when the clinic enables `lab_order_placed`
    in Notifications → Preferences (notify_event returns early otherwise).

    Never raises. A lab order must save even when the lab has no contact
    details, the wallet is empty, or Nexus is down.
    """
    try:
        vendor = order.vendor
        if not vendor:
            return
        # Nothing to send to — a vendor's email and phone are both optional.
        if not (vendor.email or vendor.phone):
            logger.info(f"lab_order_placed: vendor {vendor.id} has no email or phone, skipping")
            return

        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            return

        from core.notification_dispatch import notify_event

        notify_event(
            "lab_order_placed",
            db=db,
            clinic_id=clinic_id,
            to_phone=vendor.phone or "",
            to_email=vendor.email or "",
            to_name=vendor.contact_name or vendor.name or "",
            template_data={
                "clinic_name": clinic.name or "",
                "clinic_logo_url": clinic.logo_url or "",
                "clinic_phone": clinic.phone or "",
                "lab_name": vendor.contact_name or vendor.name or "",
                "work_type": order.work_type or "",
                "patient_name": order.patient.name if order.patient else "",
                "tooth_number": order.tooth_number or "",
                "shade": order.shade or "",
                "due_date": order.due_date.strftime("%d %b %Y") if order.due_date else "",
                "instructions": order.instructions or "",
            },
        )
    except Exception as exc:
        # Includes InsufficientWalletBalance — a low wallet must not block the order.
        logger.warning(f"lab_order_placed notify failed for order {order.id}: {exc}")


def _lab_line_description(order: LabOrder) -> str:
    """Human-readable invoice line for a lab order, e.g.
    'Lab work: Crown (Tooth #46), Precision Dental Lab'."""
    desc = f"Lab work: {order.work_type}"
    if order.tooth_number:
        desc += f" (Tooth #{order.tooth_number})"
    vendor_name = order.vendor.name if order.vendor else None
    if vendor_name:
        desc += f", {vendor_name}"
    return desc


def _sync_lab_order_billing(db: Session, order: LabOrder, clinic_id: int, user_id=None, create_if_missing=False):
    """Keep a lab order's line on the case paper's draft invoice in sync.

    An existing draft line is always kept in step with the order's cost/work
    type. A NEW line is only created when `create_if_missing` is set (i.e. the
    user opted the order into billing) — lab orders are not billed by default.
    If the linked invoice is no longer a draft, the line is left alone."""
    from domains.finance.routes.invoices import (
        get_or_create_draft_invoice, recalculate_invoice_totals,
    )
    from models import InvoiceLineItem, Invoice

    cost = float(order.cost or 0)
    desc = _lab_line_description(order)

    # Already has a line — update it in place (if its invoice is still editable).
    if order.invoice_line_item_id:
        line = db.query(InvoiceLineItem).filter(
            InvoiceLineItem.id == order.invoice_line_item_id
        ).first()
        if line and line.invoice and line.invoice.status == 'draft':
            line.description = desc
            line.quantity = 1
            line.unit_price = cost
            line.amount = cost
            db.flush()
            recalculate_invoice_totals(db, line.invoice)
        return

    # No line yet — only create one when explicitly billing, and only for a
    # case-paper order.
    if not create_if_missing or not order.case_paper_id:
        return
    inv = get_or_create_draft_invoice(db, clinic_id, order.patient_id, order.case_paper_id, created_by=user_id)
    line = InvoiceLineItem(invoice_id=inv.id, description=desc, quantity=1, unit_price=cost, amount=cost)
    db.add(line)
    db.flush()
    order.invoice_line_item_id = line.id
    recalculate_invoice_totals(db, inv)


def _lab_billing_locked(db: Session, order: LabOrder) -> bool:
    """True when the order is billed onto an invoice that's past draft, so its
    charge can no longer be changed from the case paper."""
    if not order.invoice_line_item_id:
        return False
    from models import InvoiceLineItem
    line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == order.invoice_line_item_id).first()
    return bool(line and line.invoice and line.invoice.status != 'draft')


def _enrich_lab_order(db: Session, order: LabOrder):
    """Attach display names + the bill this order sits on (number + status)."""
    order.patient_name = order.patient.name if order.patient else "Unknown"
    order.vendor_name = order.vendor.name if order.vendor else "Unknown"
    order.invoice_id = None
    order.invoice_number = None
    order.invoice_status = None
    if order.invoice_line_item_id:
        from models import InvoiceLineItem
        line = db.query(InvoiceLineItem).filter(InvoiceLineItem.id == order.invoice_line_item_id).first()
        if line and line.invoice:
            order.invoice_id = line.invoice.id
            order.invoice_number = line.invoice.invoice_number
            order.invoice_status = line.invoice.status
    return order


def _remove_lab_order_billing(db: Session, order: LabOrder):
    """Drop a lab order's billed line when the order is deleted — but only while
    its invoice is still a draft; a finalised bill keeps the charge."""
    if not order.invoice_line_item_id:
        return
    from domains.finance.routes.invoices import recalculate_invoice_totals
    from models import InvoiceLineItem
    line = db.query(InvoiceLineItem).filter(
        InvoiceLineItem.id == order.invoice_line_item_id
    ).first()
    # Detach the order's reference FIRST — otherwise deleting the line below
    # violates the FK (the order still points at it).
    order.invoice_line_item_id = None
    db.flush()
    if line and line.invoice and line.invoice.status == 'draft':
        inv = line.invoice
        db.delete(line)
        db.flush()
        recalculate_invoice_totals(db, inv)

@router.get("", response_model=List[LabOrderOut])
def get_lab_orders(
    patient_id: Optional[int] = None,
    case_paper_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(LabOrder).filter(LabOrder.clinic_id == current_user.clinic_id)
    if patient_id:
        query = query.filter(LabOrder.patient_id == patient_id)
    if case_paper_id:
        query = query.filter(LabOrder.case_paper_id == case_paper_id)
    
    orders = query.order_by(LabOrder.created_at.desc()).all()

    # Enrichment for frontend display (names + the bill it's on).
    for o in orders:
        _enrich_lab_order(db, o)

    return orders

@router.post("", response_model=LabOrderOut)
def create_lab_order(
    order: LabOrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    data = order.model_dump(exclude={"clinic_id", "add_to_billing"})
    db_order = LabOrder(**data, clinic_id=current_user.clinic_id)
    db.add(db_order)
    db.flush()

    # Only bill it onto the case paper's draft invoice when the user opted in.
    if order.add_to_billing:
        _sync_lab_order_billing(db, db_order, current_user.clinic_id, user_id=current_user.id, create_if_missing=True)

    db.commit()
    db.refresh(db_order)

    # Only after the order is safely committed — the lab shouldn't hear about
    # an order that failed to save. And only for a placed order ('Sent'); a
    # Draft is still being prepared and mustn't ping the lab.
    if db_order.status == 'Sent':
        _notify_vendor_of_order(db, db_order, current_user.clinic_id)

    _enrich_lab_order(db, db_order)
    return db_order

@router.put("/{order_id}", response_model=LabOrderOut)
def update_lab_order(
    order_id: int,
    order_update: LabOrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    update_data = order_update.model_dump(exclude_unset=True)
    want_billing = update_data.pop("add_to_billing", None)  # None = leave as-is
    currently_billed = bool(db_order.invoice_line_item_id)

    # Only a CHANGE to the billing state is blocked when the invoice is locked;
    # editing other fields on a billed-and-paid order is still fine.
    if want_billing is not None and want_billing != currently_billed and _lab_billing_locked(db, db_order):
        raise HTTPException(
            status_code=400,
            detail="This order is billed on a finalized or paid invoice and can't be changed here.",
        )

    prev_status = db_order.status
    for key, value in update_data.items():
        setattr(db_order, key, value)
    db.flush()

    if want_billing is False and currently_billed:
        # Opted out of billing — pull its draft line (keeps the lab order).
        _remove_lab_order_billing(db, db_order)
    else:
        # Keep an existing draft line in step; create one only if opting in now.
        _sync_lab_order_billing(
            db, db_order, current_user.clinic_id, user_id=current_user.id,
            create_if_missing=bool(want_billing),
        )

    db.commit()
    db.refresh(db_order)

    # Notify the lab the moment the order transitions into 'Sent' (e.g. a Draft
    # that's now been placed). Re-saving an already-Sent order won't re-ping.
    if prev_status != 'Sent' and db_order.status == 'Sent':
        _notify_vendor_of_order(db, db_order, current_user.clinic_id)

    _enrich_lab_order(db, db_order)
    return db_order

@router.delete("/{order_id}")
def delete_lab_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    db_order = db.query(LabOrder).filter(
        LabOrder.id == order_id,
        LabOrder.clinic_id == current_user.clinic_id
    ).first()
    
    if not db_order:
        raise HTTPException(status_code=404, detail="Lab order not found")

    # Pull its charge off the draft invoice before removing the order.
    _remove_lab_order_billing(db, db_order)

    db.delete(db_order)
    db.commit()
    return {"message": "Lab order deleted successfully"}


# ─── KPI cards and their detail drawer ───────────────────────────────────────
# Same envelope as the Payments KPI endpoints (series / keys / narrative / rows)
# so the one shared drawer component renders all three sections.

OPEN_STATUSES = ('Draft', 'Sent')
DONE_STATUSES = ('Received', 'Completed')


def _lab_filtered(db: Session, clinic_id: int, *, status: Optional[str] = None,
                  vendor_id: Optional[int] = None, search: Optional[str] = None):
    """The lab-order query with the page's filters applied.

    One helper so the cards and the list underneath them always describe the
    same population — the same reason the Payments summary shares its filter
    helper with the invoice list.
    """
    q = db.query(LabOrder).filter(LabOrder.clinic_id == clinic_id)
    if status:
        q = q.filter(LabOrder.status == status)
    if vendor_id:
        q = q.filter(LabOrder.vendor_id == vendor_id)
    if search and len(search.strip()) >= 2:
        like = f"%{search.strip()}%"
        q = q.outerjoin(Patient, Patient.id == LabOrder.patient_id).filter(
            or_(LabOrder.work_type.ilike(like), Patient.name.ilike(like))
        )
    return q


def _turnaround_days(order) -> Optional[int]:
    """How long a finished case took.

    NOTE: approximated as created_at → updated_at. LabOrder has no `sent_at` or
    `received_at`, so any later edit to a finished order moves `updated_at` and
    inflates its apparent turnaround. Good enough to rank labs and spot
    outliers; not good enough to quote to one. Adding the two timestamps on
    status transition is the proper fix.
    """
    if not order.created_at or not order.updated_at:
        return None
    days = (order.updated_at - order.created_at).days
    return max(days, 0)


@router.get("/summary")
def lab_summary(
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Everything the Lab KPI cards need, in one call."""
    cid = current_user.clinic_id
    now = datetime.utcnow()
    orders = _lab_filtered(db, cid, status=status, vendor_id=vendor_id, search=search).all()

    open_orders = [o for o in orders if (o.status or 'Draft') in OPEN_STATUSES]
    overdue = [o for o in open_orders if o.due_date and o.due_date < now]
    oldest_overdue = max(((now - o.due_date).days for o in overdue), default=0)

    done = [o for o in orders if (o.status or '') in DONE_STATUSES]
    turnarounds = sorted(d for d in (_turnaround_days(o) for o in done) if d is not None)
    median_tat = turnarounds[len(turnarounds) // 2] if turnarounds else 0

    # Cancelled work was never really spend, so it is left out of the total.
    billable = [o for o in orders if (o.status or '') != 'Cancelled']
    spend = sum(float(o.cost or 0) for o in billable)
    unbilled = [o for o in billable if o.invoice_line_item_id is None]
    unbilled_amount = sum(float(o.cost or 0) for o in unbilled)

    by_vendor = {}
    for o in billable:
        v = o.vendor
        name = (v.name if v else None) or 'Unassigned'
        entry = by_vendor.setdefault(name, {"vendor": name, "cases": 0, "cost": 0.0})
        entry["cases"] += 1
        entry["cost"] += float(o.cost or 0)

    # Distribution of turnaround times, for the card's mini chart.
    buckets = [("0-7d", 0, 7), ("8-14d", 8, 14), ("15-30d", 15, 30), ("30d+", 31, None)]
    histogram = []
    for label, lo, hi in buckets:
        n = sum(1 for d in turnarounds if d >= lo and (hi is None or d <= hi))
        histogram.append({"label": label, "cases": n})

    return {
        "open": {
            "count": len(open_orders),
            "overdue": len(overdue),
            "oldest_overdue_days": oldest_overdue,
        },
        "turnaround": {
            "median_days": median_tat,
            "min_days": turnarounds[0] if turnarounds else 0,
            "max_days": turnarounds[-1] if turnarounds else 0,
            "completed": len(turnarounds),
            "histogram": histogram,
            # Surfaced so the UI can caveat the number rather than imply
            # precision the data doesn't have.
            "approximated": True,
        },
        "spend": {
            "total": round(spend, 2),
            "cases": len(billable),
            "unbilled_count": len(unbilled),
            "unbilled_amount": round(unbilled_amount, 2),
        },
        "vendors": sorted(by_vendor.values(), key=lambda x: -x["cost"]),
    }


@router.get("/kpi-detail")
def lab_kpi_detail(
    metric: str = Query(..., description="open | turnaround | spend | vendors"),
    period: str = Query("all"),
    status: Optional[str] = None,
    vendor_id: Optional[int] = None,
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = current_user.clinic_id
    now = datetime.utcnow()
    orders = _lab_filtered(db, cid, status=status, vendor_id=vendor_id, search=search).all()
    clinic = db.query(Clinic).filter(Clinic.id == cid).first()
    cur = (clinic.currency_symbol if clinic and clinic.currency_symbol else '₹')

    def money(v):
        return f"{cur}{int(round(v)):,}"

    def patient_name(o):
        return o.patient.name if o.patient else 'Unknown patient'

    def vendor_name(o):
        return o.vendor.name if o.vendor else 'Unassigned'

    # ── Open cases, bucketed by how late they are ──
    if metric == "open":
        open_orders = [o for o in orders if (o.status or 'Draft') in OPEN_STATUSES]
        bands = [("On time", None), ("1-7d late", 7), ("8-30d late", 30), ("30d+ late", None)]
        counts = [0, 0, 0, 0]
        for o in open_orders:
            if not o.due_date or o.due_date >= now:
                counts[0] += 1
                continue
            late = (now - o.due_date).days
            counts[1 if late <= 7 else 2 if late <= 30 else 3] += 1
        series = [{"label": bands[i][0], "total": counts[i]} for i in range(4)]

        overdue_n = sum(counts[1:])
        worst_late = max(
            ((now - o.due_date).days for o in open_orders if o.due_date and o.due_date < now),
            default=0,
        )
        if not open_orders:
            narrative = "Nothing is open with the lab right now."
        elif overdue_n == 0:
            narrative = f"All {len(open_orders)} open cases are still within their due date."
        else:
            narrative = (
                f"{overdue_n} of {len(open_orders)} open "
                f"{'case is' if len(open_orders) == 1 else 'cases are'} past due, "
                f"the worst by {worst_late} {'day' if worst_late == 1 else 'days'}. "
                "Chasing these is the fastest thing you can do here."
            )

        rows = []
        for o in sorted(open_orders, key=lambda x: (x.due_date or now)):
            late = (now - o.due_date).days if o.due_date and o.due_date < now else 0
            rows.append({
                "id": o.id,
                "title": patient_name(o),
                "subtitle": f"{o.work_type or 'Lab work'} · {vendor_name(o)}"
                            + (f" · {late}d late" if late else " · on time"),
                "amount": round(float(o.cost or 0), 2),
                "amount_is_money": True,
            })
        return {"metric": metric, "period": period, "series": series, "keys": ["total"],
                "narrative": narrative, "rows": rows, "is_money": False,
                "row_label": "Open cases, most overdue first"}

    # ── Turnaround distribution ──
    if metric == "turnaround":
        done = [o for o in orders if (o.status or '') in DONE_STATUSES]
        pairs = [(o, _turnaround_days(o)) for o in done]
        pairs = [(o, d) for o, d in pairs if d is not None]
        days = sorted(d for _, d in pairs)

        buckets = [("0-7d", 0, 7), ("8-14d", 8, 14), ("15-30d", 15, 30), ("30d+", 31, None)]
        series = [
            {"label": lbl, "total": sum(1 for d in days if d >= lo and (hi is None or d <= hi))}
            for lbl, lo, hi in buckets
        ]

        if not days:
            narrative = "No case has come back yet, so there is no turnaround to measure."
        else:
            med = days[len(days) // 2]
            narrative = (
                f"Half your cases come back within {med} "
                f"{'day' if med == 1 else 'days'}, but the spread is wide: "
                f"the quickest took {days[0]}, the slowest {days[-1]}. "
                "Measured from when the order was raised to when it was last "
                "updated, so treat it as a guide rather than a contract."
            )

        rows = [{
            "id": o.id,
            "title": f"{o.work_type or 'Lab work'} · {patient_name(o)}",
            "subtitle": f"{vendor_name(o)} · {d} {'day' if d == 1 else 'days'}",
            "display": f"{d}d",
        } for o, d in sorted(pairs, key=lambda x: -x[1])]

        return {"metric": metric, "period": period, "series": series, "keys": ["total"],
                "narrative": narrative, "rows": rows, "is_money": False,
                "x_label": "turnaround time", "row_label": "Completed cases, slowest first"}

    # ── Spend, billed against unbilled ──
    if metric == "spend":
        billable = [o for o in orders if (o.status or '') != 'Cancelled']
        months = []
        cur_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        for _ in range(12):
            months.append(cur_month)
            cur_month = (cur_month - timedelta(days=1)).replace(day=1)
        months.reverse()
        bounds = []
        for i, m in enumerate(months):
            nxt = months[i + 1] if i + 1 < len(months) else (
                m.replace(year=m.year + 1, month=1) if m.month == 12 else m.replace(month=m.month + 1))
            bounds.append((m.strftime("%b"), m, nxt))

        billed_v = [0.0] * len(bounds)
        unbilled_v = [0.0] * len(bounds)
        for o in billable:
            when = o.created_at
            if not when:
                continue
            for i, (_, s, e) in enumerate(bounds):
                if s <= when < e:
                    if o.invoice_line_item_id is None:
                        unbilled_v[i] += float(o.cost or 0)
                    else:
                        billed_v[i] += float(o.cost or 0)
                    break

        series = [{"label": bounds[i][0], "cash": round(billed_v[i], 2),
                   "digital": round(unbilled_v[i], 2),
                   "total": round(billed_v[i] + unbilled_v[i], 2)} for i in range(len(bounds))]

        total = sum(float(o.cost or 0) for o in billable)
        unbilled = [o for o in billable if o.invoice_line_item_id is None]
        unbilled_amt = sum(float(o.cost or 0) for o in unbilled)

        if total == 0:
            narrative = "No lab cost has been recorded."
        elif not unbilled:
            narrative = f"{money(total)} of lab work, all of it charged on to a patient."
        else:
            narrative = (
                f"{money(total)} sent to labs, and {money(unbilled_amt)} of it across "
                f"{len(unbilled)} {'case' if len(unbilled) == 1 else 'cases'} never reached a "
                "patient invoice. That is cost the clinic absorbed."
            )

        rows = []
        for o in sorted(billable, key=lambda x: (x.invoice_line_item_id is not None, -float(x.cost or 0))):
            rows.append({
                "id": o.id,
                "title": f"{o.work_type or 'Lab work'} · {patient_name(o)}",
                "subtitle": vendor_name(o) + (" · not billed" if o.invoice_line_item_id is None else " · billed"),
                "amount": round(float(o.cost or 0), 2),
                "amount_is_money": True,
                "stalled": o.invoice_line_item_id is None,
            })
        return {"metric": metric, "period": period, "series": series,
                "keys": ["cash", "digital"], "narrative": narrative, "rows": rows,
                "is_money": True, "row_label": "Unbilled cases first"}

    # ── Per-vendor comparison ──
    if metric == "vendors":
        billable = [o for o in orders if (o.status or '') != 'Cancelled']
        agg = {}
        for o in billable:
            name = vendor_name(o)
            e = agg.setdefault(name, {"cases": 0, "cost": 0.0, "tats": []})
            e["cases"] += 1
            e["cost"] += float(o.cost or 0)
            if (o.status or '') in DONE_STATUSES:
                d = _turnaround_days(o)
                if d is not None:
                    e["tats"].append(d)

        series = [{"label": k, "total": v["cases"]} for k, v in
                  sorted(agg.items(), key=lambda x: -x[1]["cases"])]

        if len(agg) <= 1:
            only = next(iter(agg), None)
            narrative = (f"All lab work goes to {only}, so there is nothing to compare yet. "
                         "Add a second lab and this becomes a cost and speed comparison."
                         ) if only else "No lab work recorded."
        else:
            ranked = sorted(agg.items(), key=lambda x: -x[1]["cost"])
            narrative = (f"{ranked[0][0]} takes the most of your spend at "
                         f"{money(ranked[0][1]['cost'])} across {ranked[0][1]['cases']} cases.")

        rows = []
        for name, v in sorted(agg.items(), key=lambda x: -x[1]["cost"]):
            tats = sorted(v["tats"])
            med = tats[len(tats) // 2] if tats else None
            rows.append({
                "id": name,
                "title": name,
                "subtitle": f"{v['cases']} {'case' if v['cases'] == 1 else 'cases'}"
                            + (f" · {med}d median" if med is not None else " · no completed cases"),
                "amount": round(v["cost"], 2),
                "amount_is_money": True,
            })
        return {"metric": metric, "period": period, "series": series, "keys": ["total"],
                "narrative": narrative, "rows": rows, "is_money": False,
                "x_label": "cases per lab", "row_label": "By lab"}

    raise HTTPException(status_code=400, detail=f"Unknown metric '{metric}'")
