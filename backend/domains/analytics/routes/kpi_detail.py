"""
What sits behind a dashboard KPI card.

Returns the same envelope as the Payments drawer (`series`, `keys`,
`narrative`, `rows`), so the dashboard can use the one drawer component the
rest of the app already uses instead of its own.

Replaces four ad-hoc endpoints, two of which were reading the wrong table.
`/dashboard/revenue/details` queried `payments`, which holds 0 rows: money has
lived in `invoice_payments` since part-payments were introduced. The card
totalled one source and its drawer listed another, so Revenue and Outstanding
opened empty while the card above them read three lakh.
"""
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, func
from sqlalchemy.orm import Session

from core.auth_utils import get_current_user
from database import get_db
from models import (Appointment, Clinic, Invoice, InvoicePayment, Patient, User)
from domains.scheduling.appointment_status import (CANCELLED, COMPLETED,
                                                   NO_SHOW, OPEN_STATUSES)

router = APIRouter()

NAVY_KEYS = ["value"]


def _symbol(db: Session, clinic_id: int) -> str:
    c = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    return getattr(c, "currency_symbol", None) or "₹"


def _money(sym: str, n: float) -> str:
    return f"{sym}{n:,.0f}"


def _window(period: str):
    """Start of the window, or None for all time."""
    today = date.today()
    if period == "today":
        return today
    if period == "7days":
        return today - timedelta(days=6)
    if period == "month":
        return today.replace(day=1)
    return None


def _buckets(start: Optional[date]):
    """(labels, keyfn) for the x-axis.

    Short windows are shown by day, long ones by month, so a 7 day chart is not
    a single bar and an all-time chart is not 400 of them.
    """
    today = date.today()
    if start and (today - start).days <= 31:
        days = [(start + timedelta(days=i)) for i in range((today - start).days + 1)]
        labels = [d.strftime("%-d %b") for d in days]
        index = {d: i for i, d in enumerate(days)}
        return labels, (lambda d: index.get(d))

    # Twelve months back, ending on the current one.
    months = []
    cur = today.replace(day=1)
    for _ in range(12):
        months.append(cur)
        cur = (cur - timedelta(days=1)).replace(day=1)
    months.reverse()
    labels = [m.strftime("%b") for m in months]
    index = {(m.year, m.month): i for i, m in enumerate(months)}
    return labels, (lambda d: index.get((d.year, d.month)))


@router.get("/kpi-detail")
def dashboard_kpi_detail(
    metric: str = Query(..., description="revenue | outstanding | patients | appointments"),
    period: str = Query("all", description="today | 7days | month | all"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    cid = current_user.clinic_id
    sym = _symbol(db, cid)
    start = _window(period)
    labels, bucket_of = _buckets(start)

    # ── Money collected ──────────────────────────────────────────────────────
    if metric == "revenue":
        q = db.query(InvoicePayment).filter(InvoicePayment.clinic_id == cid)
        if start:
            q = q.filter(InvoicePayment.paid_on >= start)

        vals = [0.0] * len(labels)
        for p in q.all():
            on = p.paid_on or (p.created_at.date() if p.created_at else None)
            if not on:
                continue
            i = bucket_of(on)
            if i is not None:
                vals[i] += float(p.amount or 0)

        series = [{"label": labels[i], "value": round(vals[i], 2), "total": round(vals[i], 2)}
                  for i in range(len(labels))]
        total = sum(vals)
        active = [s for s in series if s["total"] > 0]
        best = max(series, key=lambda s: s["total"]) if series else None

        billed_q = db.query(func.coalesce(func.sum(Invoice.total), 0.0)).filter(
            Invoice.clinic_id == cid, Invoice.status.notin_(("draft", "cancelled")))
        if start:
            billed_q = billed_q.filter(func.date(Invoice.created_at) >= start)
        billed = float(billed_q.scalar() or 0)
        gap = billed - total

        if total == 0:
            narrative = "No payments were received in this period."
        else:
            narrative = f"{_money(sym, total)} came in across {len(active)} active periods"
            if best and best["total"] > 0:
                narrative += f", the strongest being {best['label']} at {_money(sym, best['total'])}"
            narrative += ". "
            narrative += (f"Against {_money(sym, billed)} billed, {_money(sym, gap)} is still to be collected."
                          if gap > 0 else "Everything billed in this window has been collected.")

        rows = []
        for p, inv, pat in (
            db.query(InvoicePayment, Invoice, Patient)
            .join(Invoice, Invoice.id == InvoicePayment.invoice_id)
            .outerjoin(Patient, Patient.id == Invoice.patient_id)
            .filter(InvoicePayment.clinic_id == cid)
            .order_by(desc(InvoicePayment.paid_on), desc(InvoicePayment.id))
            .limit(60).all()
        ):
            on = p.paid_on or (p.created_at.date() if p.created_at else None)
            rows.append({
                "id": p.id,
                "title": pat.name if pat else "Unknown patient",
                "subtitle": f"{inv.invoice_number} · {p.method or 'Unrecorded'}",
                "amount": round(float(p.amount or 0), 2),
                "date": on.isoformat() if on else None,
                # Which bar this row belongs to, so clicking a bar can filter
                # the list without another request.
                "bucket": labels[bucket_of(on)] if on and bucket_of(on) is not None else None,
                "patient_id": pat.id if pat else None,
            })

        return {"metric": metric, "period": period, "series": series, "keys": NAVY_KEYS,
                "narrative": narrative, "rows": rows, "is_money": True,
                "row_label": "Recent payments"}

    # ── Money still owed ─────────────────────────────────────────────────────
    if metric == "outstanding":
        # Ageing, not a time series: with a debt the question is how old it is.
        q = db.query(Invoice, Patient).outerjoin(Patient, Patient.id == Invoice.patient_id).filter(
            Invoice.clinic_id == cid,
            Invoice.due_amount > 0,
            Invoice.status.notin_(("draft", "cancelled")),
        )
        buckets = [("Under 30 days", 0, 30), ("30 to 60", 30, 60),
                   ("60 to 90", 60, 90), ("Over 90 days", 90, 10 ** 6)]
        vals = [0.0] * len(buckets)
        rows, today = [], date.today()

        for inv, pat in q.order_by(desc(Invoice.due_amount)).all():
            created = inv.created_at.date() if inv.created_at else today
            age = (today - created).days
            idx = next((i for i, (_, lo, hi) in enumerate(buckets) if lo <= age < hi), len(buckets) - 1)
            vals[idx] += float(inv.due_amount or 0)
            if len(rows) < 60:
                rows.append({
                    "id": inv.id,
                    "title": pat.name if pat else "Unknown patient",
                    "subtitle": f"{inv.invoice_number} · {age} days old",
                    "amount": round(float(inv.due_amount or 0), 2),
                    "date": created.isoformat(),
                    "bucket": buckets[idx][0],
                    "patient_id": pat.id if pat else None,
                })

        series = [{"label": buckets[i][0], "value": round(vals[i], 2), "total": round(vals[i], 2)}
                  for i in range(len(buckets))]
        total = sum(vals)
        aged = sum(vals[1:])

        if total == 0:
            narrative = "Nothing is outstanding. Every finalised invoice has been paid."
        else:
            narrative = f"{_money(sym, total)} is owed across {len(rows)} invoices. "
            narrative += (f"{_money(sym, aged)} of that is more than 30 days old."
                          if aged > 0 else "All of it is less than 30 days old.")

        return {"metric": metric, "period": period, "series": series, "keys": NAVY_KEYS,
                "narrative": narrative, "rows": rows, "is_money": True,
                "row_label": "Unpaid invoices", "ageing": True}

    # ── People registered ────────────────────────────────────────────────────
    if metric == "patients":
        q = db.query(Patient).filter(Patient.clinic_id == cid)
        if start:
            q = q.filter(func.coalesce(Patient.registered_on, func.date(Patient.created_at)) >= start)

        vals = [0] * len(labels)
        people = q.order_by(desc(Patient.created_at)).all()
        for p in people:
            on = p.registered_on or (p.created_at.date() if p.created_at else None)
            if not on:
                continue
            i = bucket_of(on)
            if i is not None:
                vals[i] += 1

        series = [{"label": labels[i], "value": vals[i], "total": vals[i]} for i in range(len(labels))]
        total = sum(vals)
        best = max(series, key=lambda s: s["total"]) if series else None

        if total == 0:
            narrative = "No new patients registered in this period."
        else:
            narrative = f"{total} patient{'s' if total != 1 else ''} registered"
            if best and best["total"] > 0:
                narrative += f", most in {best['label']} with {best['total']}"
            narrative += "."

        rows = []
        for p in people[:60]:
            on = p.registered_on or (p.created_at.date() if p.created_at else None)
            bits = [b for b in [p.phone, p.village] if b]
            rows.append({
                "id": p.id,
                "title": p.name,
                "subtitle": " · ".join(bits) or "No contact details",
                "amount": None,
                "date": on.isoformat() if on else None,
                "bucket": labels[bucket_of(on)] if on and bucket_of(on) is not None else None,
                "patient_id": p.id,
            })

        return {"metric": metric, "period": period, "series": series, "keys": NAVY_KEYS,
                "narrative": narrative, "rows": rows, "is_money": False,
                "row_label": "Recently registered"}

    # ── Appointments ─────────────────────────────────────────────────────────
    if metric == "appointments":
        q = db.query(Appointment).filter(Appointment.clinic_id == cid)
        if start:
            q = q.filter(func.date(Appointment.appointment_date) >= start)
        appts = q.order_by(desc(Appointment.appointment_date)).all()

        vals = [0] * len(labels)
        for a in appts:
            on = a.appointment_date.date() if a.appointment_date else None
            if not on:
                continue
            i = bucket_of(on)
            if i is not None:
                vals[i] += 1

        series = [{"label": labels[i], "value": vals[i], "total": vals[i]} for i in range(len(labels))]
        total = sum(vals)
        seen = sum(1 for a in appts if a.status == COMPLETED)
        missed = sum(1 for a in appts if a.status == NO_SHOW)
        base = seen + missed

        if total == 0:
            narrative = "Nothing was booked in this period."
        else:
            narrative = f"{total} appointment{'s' if total != 1 else ''} booked. "
            narrative += (f"Of the {base} that should have been attended, {missed} did not show, "
                          f"which is {round(100 * missed / base)}%."
                          if base else "None have been closed off yet, so there is no attendance figure.")

        doc_names = {u.id: (u.name or u.email) for u in db.query(User).filter(User.clinic_id == cid).all()}
        rows = []
        for a in appts[:60]:
            on = a.appointment_date.date() if a.appointment_date else None
            bits = [b for b in [a.start_time, doc_names.get(a.doctor_id), a.treatment] if b]
            rows.append({
                "id": a.id,
                "title": a.patient_name,
                "subtitle": " · ".join(bits) or "No details",
                "amount": None,
                "date": on.isoformat() if on else None,
                "bucket": labels[bucket_of(on)] if on and bucket_of(on) is not None else None,
                "status": a.status,
                "patient_id": a.patient_id,
            })

        return {"metric": metric, "period": period, "series": series, "keys": NAVY_KEYS,
                "narrative": narrative, "rows": rows, "is_money": False,
                "row_label": "Appointments"}

    return {"metric": metric, "period": period, "series": [], "keys": NAVY_KEYS,
            "narrative": "", "rows": [], "is_money": False, "row_label": ""}
