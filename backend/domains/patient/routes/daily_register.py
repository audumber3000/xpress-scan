"""Daily patient register.

The front desk's day book: who walked in today, and whether each is a new
registration or someone coming back. Deliberately separate from case papers
(clinical) and appointments (scheduling) — a walk-in who is registered and
leaves still belongs in the day's count without creating either.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from typing import Optional, List
from datetime import date as date_cls, datetime, timedelta
from html import escape as html_escape
import csv
import io
import os
from sqlalchemy import func, or_
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError
from pydantic import BaseModel

from database import get_db
from models import DailyVisit, Patient, User, Clinic, CasePaper, Invoice, InvoicePayment
from core.auth_utils import get_current_user, require_patients_view, require_patients_edit
from core.clinic_time import clinic_today, clinic_day_bounds_utc, clinic_now
from domains.infrastructure.services.pdf_service import html_template_to_pdf

router = APIRouter()


class DailyVisitCreate(BaseModel):
    patient_id: int
    reason: Optional[str] = None
    doctor_id: Optional[int] = None
    notes: Optional[str] = None
    # Defaults to the clinic's today. Back-dating is allowed so a register can be
    # caught up the next morning; future dates are rejected.
    visit_date: Optional[date_cls] = None


class DailyVisitUpdate(BaseModel):
    """Correctable fields on a register entry. Patient, day and is_repeat are
    deliberately absent — those define the entry rather than describe it."""
    reason: Optional[str] = None
    doctor_id: Optional[int] = None
    notes: Optional[str] = None


def is_repeat_patient(patient: Patient, on_date: date_cls) -> bool:
    """Repeat = the patient was already on the books before this day.

    Reads registered_on, falling back to created_at for rows that predate the
    column (the migration backfills these, but a restored DB may not have run it).
    """
    registered = getattr(patient, 'registered_on', None)
    if registered is None and patient.created_at:
        registered = patient.created_at.date()
    if registered is None:
        return False
    return registered < on_date


def record_daily_visit(
    db: Session,
    clinic: Clinic,
    patient: Patient,
    *,
    source: str = 'manual',
    appointment_id: Optional[int] = None,
    doctor_id: Optional[int] = None,
    reason: Optional[str] = None,
    notes: Optional[str] = None,
    created_by: Optional[int] = None,
    visit_date: Optional[date_cls] = None,
) -> Optional[DailyVisit]:
    """Add a patient to the register for a day, or return the existing entry.

    Idempotent per (clinic, patient, day) so a patient added by hand and then
    checked in on the calendar is counted once, not twice. Does not commit —
    the caller owns the transaction.
    """
    day = visit_date or clinic_today(clinic)

    existing = db.query(DailyVisit).filter(
        DailyVisit.clinic_id == clinic.id,
        DailyVisit.patient_id == patient.id,
        DailyVisit.visit_date == day,
    ).first()
    if existing:
        # A manual entry already carries the front desk's own reason/doctor —
        # a later automatic check-in shouldn't overwrite what staff typed.
        if existing.appointment_id is None and appointment_id is not None:
            existing.appointment_id = appointment_id
        return existing

    visit = DailyVisit(
        clinic_id=clinic.id,
        patient_id=patient.id,
        visit_date=day,
        is_repeat=is_repeat_patient(patient, day),
        doctor_id=doctor_id,
        reason=reason,
        source=source,
        appointment_id=appointment_id,
        notes=notes,
        created_by=created_by,
    )
    db.add(visit)
    db.flush()
    return visit


def day_activity(db: Session, clinic: Clinic, day: date_cls, patient_ids: list) -> dict:
    """What each of these patients actually produced on this day.

    Powers the "no case paper" / "not billed" markers, which are the close-of-day
    check: somebody walked in, did anyone record what happened and did anyone
    charge for it. Case papers and invoices are matched on the clinic's calendar
    day, not the server's UTC day.
    """
    if not patient_ids:
        return {}

    start_utc, end_utc = clinic_day_bounds_utc(clinic, day, day)
    activity = {
        pid: {'case_papers': 0, 'invoices': 0, 'billed': 0.0, 'due': 0.0,
              'collected': 0.0, 'paid_invoices': 0}
        for pid in patient_ids
    }

    cp_rows = (
        db.query(CasePaper.patient_id, func.count(CasePaper.id))
        .filter(
            CasePaper.clinic_id == clinic.id,
            CasePaper.patient_id.in_(patient_ids),
            CasePaper.date >= start_utc,
            CasePaper.date < end_utc,
        )
        .group_by(CasePaper.patient_id)
        .all()
    )
    for pid, count in cp_rows:
        activity[pid]['case_papers'] = int(count or 0)

    inv_rows = (
        db.query(
            Invoice.patient_id,
            func.count(Invoice.id),
            func.coalesce(func.sum(Invoice.total), 0),
            func.coalesce(func.sum(Invoice.due_amount), 0),
        )
        .filter(
            Invoice.clinic_id == clinic.id,
            Invoice.patient_id.in_(patient_ids),
            Invoice.status != 'cancelled',
            Invoice.created_at >= start_utc,
            Invoice.created_at < end_utc,
        )
        .group_by(Invoice.patient_id)
        .all()
    )
    for pid, count, billed, due in inv_rows:
        activity[pid]['invoices'] = int(count or 0)
        activity[pid]['billed'] = float(billed or 0)
        activity[pid]['due'] = float(due or 0)

    # Money actually collected from this patient on this day, keyed on the
    # payment date rather than the invoice date — a part payment taken today
    # against an older bill is still today's money, and still proof they came in.
    for pid, collected in collected_by_patient(db, clinic.id, day, patient_ids).items():
        activity[pid]['collected'] = collected

    for pid, count in paid_invoices_by_patient(db, clinic.id, start_utc, end_utc, patient_ids).items():
        activity[pid]['paid_invoices'] = count

    return activity


PAID_STATUSES = ('partially_paid', 'paid_verified', 'paid_unverified')


def collected_by_patient(db: Session, clinic_id: int, day: date_cls, patient_ids: list) -> dict:
    """{patient_id: amount collected from them on this day}."""
    if not patient_ids:
        return {}
    rows = (
        db.query(Invoice.patient_id, func.coalesce(func.sum(InvoicePayment.amount), 0))
        .join(InvoicePayment, InvoicePayment.invoice_id == Invoice.id)
        .filter(
            InvoicePayment.clinic_id == clinic_id,
            InvoicePayment.paid_on == day,
            Invoice.patient_id.in_(patient_ids),
        )
        .group_by(Invoice.patient_id)
        .all()
    )
    return {pid: float(amount or 0) for pid, amount in rows}


def paid_invoices_by_patient(db: Session, clinic_id: int, start_utc, end_utc, patient_ids: list) -> dict:
    """{patient_id: how many of this day's invoices carry money}.

    Counts by the invoice's own state rather than by payment date. A bill raised
    on the visit day and settled the next morning is still a paid bill for that
    visit — keying only on the payment date would leave that entry deletable.
    """
    if not patient_ids:
        return {}
    rows = (
        db.query(Invoice.patient_id, func.count(Invoice.id))
        .filter(
            Invoice.clinic_id == clinic_id,
            Invoice.patient_id.in_(patient_ids),
            Invoice.status != 'cancelled',
            Invoice.created_at >= start_utc,
            Invoice.created_at < end_utc,
            or_(Invoice.status.in_(PAID_STATUSES), Invoice.paid_amount > 0),
        )
        .group_by(Invoice.patient_id)
        .all()
    )
    return {pid: int(count or 0) for pid, count in rows}


def _serialize(visit: DailyVisit, activity: dict = None) -> dict:
    p = visit.patient
    act = (activity or {}).get(visit.patient_id) or {}
    return {
        'id': visit.id,
        'patient_id': visit.patient_id,
        'patient_name': p.name if p else None,
        'patient_phone': p.phone if p else None,
        'display_id': p.display_id if p else None,
        'age': p.age if p else None,
        'gender': p.gender if p else None,
        'village': p.village if p else None,
        'visit_date': visit.visit_date.isoformat() if visit.visit_date else None,
        'is_repeat': bool(visit.is_repeat),
        'doctor_id': visit.doctor_id,
        'doctor_name': visit.doctor.name if visit.doctor else None,
        'reason': visit.reason,
        'source': visit.source,
        'appointment_id': visit.appointment_id,
        'notes': visit.notes,
        'created_at': visit.created_at.isoformat() if visit.created_at else None,
        # Close-of-day markers: was anything recorded, was anything charged.
        'case_paper_count': act.get('case_papers', 0),
        'invoice_count': act.get('invoices', 0),
        'billed_amount': round(act.get('billed', 0.0), 2),
        'due_amount': round(act.get('due', 0.0), 2),
        # Money taken from them today. Non-zero means this entry is locked:
        # a payment is proof the visit happened.
        'collected_amount': round(act.get('collected', 0.0), 2),
        # This day's invoices that are paid or part paid. Also locks the entry,
        # and catches the bill settled a day later that `collected` would miss.
        'paid_invoice_count': act.get('paid_invoices', 0),
        'is_locked': act.get('collected', 0.0) > 0 or act.get('paid_invoices', 0) > 0,
    }


@router.get("")
async def list_daily_register(
    date: Optional[date_cls] = Query(None, description="Clinic-local day; defaults to today"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_view),
):
    """The register for one day, with the new/repeat/total counts on top."""
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    day = date or clinic_today(clinic)

    visits = (
        db.query(DailyVisit)
        .filter(DailyVisit.clinic_id == clinic.id, DailyVisit.visit_date == day)
        .order_by(DailyVisit.created_at.desc())
        .all()
    )

    def counts(rows):
        repeat = sum(1 for v in rows if v.is_repeat)
        return {'total': len(rows), 'new': len(rows) - repeat, 'repeat': repeat}

    # Compare against the same weekday a week earlier, not simply "yesterday":
    # a clinic's Saturday looks nothing like its Tuesday, so week-on-week is the
    # only comparison that says anything useful about whether today went well.
    prev_day = day - timedelta(days=7)
    prev_visits = (
        db.query(DailyVisit)
        .filter(DailyVisit.clinic_id == clinic.id, DailyVisit.visit_date == prev_day)
        .all()
    )

    activity = day_activity(db, clinic, day, [v.patient_id for v in visits])
    entries = [_serialize(v, activity) for v in visits]

    return {
        'date': day.isoformat(),
        'is_today': day == clinic_today(clinic),
        'kpis': counts(visits),
        'previous': {
            'date': prev_day.isoformat(),
            'kpis': counts(prev_visits),
        },
        # Close-of-day follow-ups: who has nothing recorded, who has no bill.
        'pending': {
            'no_case_paper': sum(1 for e in entries if e['case_paper_count'] == 0),
            'not_billed': sum(1 for e in entries if e['invoice_count'] == 0),
        },
        'entries': entries,
    }


@router.get("/patient/{patient_id}")
async def patient_daily_visits(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_view),
):
    """Every day this patient was recorded in the register, newest first.

    Feeds the visit history on their profile, so a walk-in who was seen briefly
    and left still leaves a trace even with no case paper and no bill.
    """
    patient = db.query(Patient).filter(
        Patient.id == patient_id, Patient.clinic_id == current_user.clinic_id
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    visits = (
        db.query(DailyVisit)
        .filter(DailyVisit.clinic_id == current_user.clinic_id, DailyVisit.patient_id == patient_id)
        .order_by(DailyVisit.visit_date.desc())
        .all()
    )
    return [_serialize(v) for v in visits]


@router.get("/export")
async def export_daily_register(
    date: Optional[date_cls] = Query(None, description="Clinic-local day; defaults to today"),
    format: str = Query("csv", description="csv | pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_view),
):
    """The day sheet: the register as a file, for printing or for the records.

    CSV for spreadsheets, PDF for the clinics still keeping a physical day book.
    """
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    day = date or clinic_today(clinic)
    visits = (
        db.query(DailyVisit)
        .filter(DailyVisit.clinic_id == clinic.id, DailyVisit.visit_date == day)
        .order_by(DailyVisit.created_at.asc())
        .all()
    )
    activity = day_activity(db, clinic, day, [v.patient_id for v in visits])
    rows = [_serialize(v, activity) for v in visits]

    repeat = sum(1 for r in rows if r['is_repeat'])
    totals = {
        'total': len(rows),
        'new': len(rows) - repeat,
        'repeat': repeat,
        'billed': round(sum(r['billed_amount'] for r in rows), 2),
    }
    day_label = day.strftime('%d %B %Y')
    fname = f"daily-register-{day.isoformat()}"

    if (format or "csv").lower() == "pdf":
        # Stamped in the clinic's timezone, not the server's UTC — a sheet
        # printed at 9 PM in India must not say 3:30 PM.
        generated_at = clinic_now(clinic).strftime('%d %b %Y at %I:%M %p').lstrip('0')
        generated_by = getattr(current_user, 'name', None) or getattr(current_user, 'email', '') or ''
        html = _day_sheet_html(clinic, day_label, rows, totals, generated_at, generated_by)
        try:
            # html_template_to_pdf writes to a temp file and hands back its path,
            # so read it out and clean up (same handling as the invoice PDF route).
            pdf_path = html_template_to_pdf(html)
            with open(pdf_path, 'rb') as fh:
                pdf_bytes = fh.read()
            try:
                os.remove(pdf_path)
            except OSError:
                pass
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not build the day sheet PDF: {e}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'},
        )

    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"Daily patient register — {clinic.name or 'Clinic'} — {day_label}"])
    w.writerow([f"Total: {totals['total']}", f"New: {totals['new']}", f"Repeat: {totals['repeat']}"])
    w.writerow([])
    # Columns follow the on-screen table, then the detail the screen can't fit.
    w.writerow(["#", "Time", "Patient ID", "Patient Name", "Phone", "Type",
                "Reason", "Doctor", "Pending", "Billed", "Due",
                "Village", "Source", "Case Papers", "Invoices", "Collected"])
    for i, r in enumerate(rows, 1):
        pending = []
        if r['case_paper_count'] == 0:
            pending.append('No case paper')
        if r['invoice_count'] == 0:
            pending.append('Not billed')
        w.writerow([
            i,
            r['created_at'][11:16] if r['created_at'] else '',
            r['display_id'] or '', r['patient_name'] or '', r['patient_phone'] or '',
            'Repeat' if r['is_repeat'] else 'New',
            r['reason'] or '', r['doctor_name'] or '',
            ', '.join(pending) or 'All done',
            f"{r['billed_amount']:.2f}", f"{r['due_amount']:.2f}",
            r['village'] or '', r['source'] or '',
            r['case_paper_count'], r['invoice_count'],
            f"{r.get('collected_amount', 0):.2f}",
        ])

    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'},
    )


def _day_sheet_html(clinic, day_label: str, rows: list, totals: dict,
                    generated_at: str = '', generated_by: str = '') -> str:
    """Printable day sheet on A4 portrait — the shape a clinic files or clips
    into a day book. WeasyPrint-safe HTML only (tables, no flex gap/grid).

    Columns are trimmed to what portrait can carry honestly: village sits under
    the name, and the "pending" flags become short markers rather than a column
    of sentences.
    """
    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    clinic_name = html_escape(clinic.name or 'Clinic')
    clinic_line = ' · '.join(filter(None, [
        html_escape(getattr(clinic, 'address', '') or ''),
        html_escape(getattr(clinic, 'phone', '') or ''),
    ]))

    body = ''
    for i, r in enumerate(rows, 1):
        flags = []
        if r['case_paper_count'] == 0:
            flags.append('<span class="flag">no case paper</span>')
        if r['invoice_count'] == 0:
            flags.append('<span class="flag">not billed</span>')
        type_cls = 'rep' if r['is_repeat'] else 'new'
        body += (
            f'<tr>'
            f'<td class="c">{i}</td>'
            f'<td class="c">{html_escape((r["created_at"] or "")[11:16])}</td>'
            f'<td class="c">{html_escape(r["display_id"] or "-")}</td>'
            f'<td><strong>{html_escape(r["patient_name"] or "")}</strong>'
            f'{("<br><span class=sub>" + html_escape(r["village"]) + "</span>") if r["village"] else ""}</td>'
            f'<td class="c">{html_escape(r["patient_phone"] or "-")}</td>'
            f'<td class="c"><span class="pill {type_cls}">{"Repeat" if r["is_repeat"] else "New"}</span></td>'
            f'<td>{html_escape(r["reason"] or "-")}'
            f'{("<br>" + " ".join(flags)) if flags else ""}</td>'
            f'<td>{html_escape(r["doctor_name"] or "-")}</td>'
            f'<td class="r">{currency} {r["billed_amount"]:,.2f}</td>'
            f'</tr>'
        )
    if not rows:
        body = '<tr><td colspan="9" class="empty">No patients were registered on this day.</td></tr>'

    foot_bits = []
    if generated_at:
        foot_bits.append(f'Generated {html_escape(generated_at)}')
    if generated_by:
        foot_bits.append(f'by {html_escape(generated_by)}')
    foot = ' '.join(foot_bits) or 'Generated'

    return f"""<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8">
<style>
@page {{ size: A4 portrait; margin: 12mm 10mm; }}
body {{ font-family: Helvetica, Arial, sans-serif; color: #111827; font-size: 10px; margin: 0; }}
h1 {{ font-size: 16px; margin: 0 0 2px; }}
.head {{ border-bottom: 2px solid #2a276e; padding-bottom: 8px; margin-bottom: 10px; }}
.sub {{ color: #6B7280; font-size: 9px; }}
.title {{ font-size: 11px; font-weight: bold; color: #2a276e; margin-top: 4px; }}
.kpis {{ width: 100%; border-collapse: separate; border-spacing: 5px 0; margin-bottom: 12px; }}
.kpis td {{ border: 1px solid #E5E7EB; padding: 7px 9px; width: 25%; }}
.kpis .n {{ font-size: 15px; font-weight: bold; }}
table.reg {{ width: 100%; border-collapse: collapse; }}
table.reg th {{ background: #F8FAFC; border-bottom: 1px solid #E5E7EB; padding: 5px 4px;
  text-align: left; font-size: 8px; text-transform: uppercase; color: #6B7280; letter-spacing: .04em; }}
table.reg th.c {{ text-align: center; }}
table.reg th.r {{ text-align: right; }}
table.reg td {{ border-bottom: 1px solid #F1F5F9; padding: 5px 4px; vertical-align: top; }}
table.reg td.c {{ text-align: center; }}
table.reg td.r {{ text-align: right; white-space: nowrap; }}
.pill {{ font-size: 8px; font-weight: bold; padding: 1px 5px; border-radius: 7px; }}
.pill.new {{ background: #ECFDF5; color: #047857; }}
.pill.rep {{ background: #FFFBEB; color: #B45309; }}
.flag {{ font-size: 8px; color: #B45309; background: #FFFBEB; padding: 1px 4px;
  border-radius: 3px; margin-right: 3px; }}
td.empty {{ padding: 24px; color: #6B7280; text-align: center; }}
.foot {{ margin-top: 12px; padding-top: 6px; border-top: 1px solid #F1F5F9;
  color: #9CA3AF; font-size: 8px; }}
.foot .right {{ float: right; }}
</style></head><body>
  <div class="head">
    <h1>{clinic_name}</h1>
    {f'<div class="sub">{clinic_line}</div>' if clinic_line else ''}
    <div class="title">Daily Patient Register &nbsp;·&nbsp; {day_label}</div>
  </div>

  <table class="kpis"><tr>
    <td><div class="sub">Total patients</div><div class="n">{totals['total']}</div></td>
    <td><div class="sub">New</div><div class="n">{totals['new']}</div></td>
    <td><div class="sub">Repeat</div><div class="n">{totals['repeat']}</div></td>
    <td><div class="sub">Billed</div><div class="n">{currency} {totals['billed']:,.2f}</div></td>
  </tr></table>

  <table class="reg">
    <thead><tr>
      <th class="c">#</th><th class="c">Time</th><th class="c">ID</th><th>Patient</th>
      <th class="c">Phone</th><th class="c">Type</th><th>Reason</th><th>Doctor</th>
      <th class="r">Billed</th>
    </tr></thead>
    <tbody>{body}</tbody>
  </table>

  <div class="foot">
    <span class="right">MolarPlus</span>
    {foot}
  </div>
</body></html>"""


@router.post("")
async def add_to_daily_register(
    payload: DailyVisitCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    """Register a patient for the day."""
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")

    patient = db.query(Patient).filter(
        Patient.id == payload.patient_id,
        Patient.clinic_id == clinic.id,
    ).first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    day = payload.visit_date or clinic_today(clinic)
    if day > clinic_today(clinic):
        raise HTTPException(status_code=400, detail="You can't register a patient for a future date")

    already = db.query(DailyVisit).filter(
        DailyVisit.clinic_id == clinic.id,
        DailyVisit.patient_id == patient.id,
        DailyVisit.visit_date == day,
    ).first()
    if already:
        raise HTTPException(
            status_code=400,
            detail=f"{patient.name} is already in the register for {day.strftime('%d %b %Y')}.",
        )

    visit = record_daily_visit(
        db, clinic, patient,
        source='manual',
        doctor_id=payload.doctor_id,
        reason=payload.reason,
        notes=payload.notes,
        created_by=current_user.id,
        visit_date=day,
    )
    try:
        db.commit()
    except IntegrityError:
        # Lost a race with a concurrent check-in for the same patient and day.
        db.rollback()
        raise HTTPException(status_code=400, detail=f"{patient.name} is already in the register for this day.")
    db.refresh(visit)
    return _serialize(visit)


@router.put("/{entry_id}")
async def update_daily_register_entry(
    entry_id: int,
    payload: DailyVisitUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    """Correct a register entry: reason, doctor, notes.

    Deliberately does not move the entry to another patient or another day —
    that isn't a correction, it's a different visit. Remove it and register the
    right one instead. `is_repeat` is likewise fixed at registration so past
    days' KPIs stay stable.
    """
    visit = db.query(DailyVisit).filter(
        DailyVisit.id == entry_id,
        DailyVisit.clinic_id == current_user.clinic_id,
    ).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Register entry not found")

    data = payload.dict(exclude_unset=True)

    if 'doctor_id' in data and data['doctor_id'] is not None:
        doctor = db.query(User).filter(
            User.id == data['doctor_id'], User.clinic_id == current_user.clinic_id
        ).first()
        if not doctor:
            raise HTTPException(status_code=400, detail="That doctor isn't part of this clinic")

    for field in ('reason', 'doctor_id', 'notes'):
        if field in data:
            setattr(visit, field, data[field])

    db.commit()
    db.refresh(visit)
    return _serialize(visit)


@router.delete("/{entry_id}")
async def remove_from_daily_register(
    entry_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_patients_edit),
):
    """Remove an entry added in error. The patient record itself is untouched.

    Refused once money has been taken from that patient that day. A payment is
    proof the visit happened, so deleting the entry would leave the day sheet
    claiming they were never here while Today's Collection shows their cash —
    the two screens would disagree with each other. Same principle the rest of
    the app already applies: a paid invoice can't be deleted, and neither can a
    patient with payments against them.

    An unpaid or draft bill is not blocked: nothing moved, and reception really
    does add the wrong person sometimes.
    """
    visit = db.query(DailyVisit).filter(
        DailyVisit.id == entry_id,
        DailyVisit.clinic_id == current_user.clinic_id,
    ).first()
    if not visit:
        raise HTTPException(status_code=404, detail="Register entry not found")

    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    currency = getattr(clinic, 'currency_symbol', None) or '₹'
    name = visit.patient.name if visit.patient else "This patient"

    collected = collected_by_patient(
        db, current_user.clinic_id, visit.visit_date, [visit.patient_id]
    ).get(visit.patient_id, 0.0)

    start_utc, end_utc = clinic_day_bounds_utc(clinic, visit.visit_date, visit.visit_date)
    paid_invoices = paid_invoices_by_patient(
        db, current_user.clinic_id, start_utc, end_utc, [visit.patient_id]
    ).get(visit.patient_id, 0)

    if collected > 0 or paid_invoices > 0:
        if collected > 0:
            reason = f"{name} paid {currency}{collected:,.2f} on this day"
        else:
            reason = f"{name} has a paid or part-paid invoice from this day"
        raise HTTPException(
            status_code=400,
            detail=(
                f"{reason}, so they can't be removed from the register. "
                f"Cancel or refund the invoice first."
            ),
        )

    db.delete(visit)
    db.commit()
    return {"message": "Removed from the register"}
