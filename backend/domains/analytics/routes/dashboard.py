from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, case
from datetime import datetime, timedelta
from typing import Optional
import csv
import io
from database import get_db
from models import Patient, Report, Payment, User, TreatmentType, Appointment, Clinic, Invoice, LabOrder, InventoryItem, MedicationStock, CasePaper
from core.auth_utils import get_current_user
from core.clinic_time import clinic_today
from domains.scheduling.appointment_status import ARRIVED

router = APIRouter()


def period_range(period: str, now: datetime = None):
    """Single source of truth for period → (start, end, prev_start, prev_end).

    Shared by the KPI metrics endpoint AND the drawer detail endpoints so the
    card numbers and the drawer lists always cover the exact same window.
    Vocabulary matches the dashboard header: today | yesterday | 7days | all | month.
    """
    now = now or datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "today":
        start_date = today_start
        end_date = today_start + timedelta(days=1)
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "yesterday":
        start_date = today_start - timedelta(days=1)
        end_date = today_start
        prev_start = start_date - timedelta(days=1)
        prev_end = start_date
    elif period == "7days":
        start_date = today_start - timedelta(days=7)
        end_date = today_start + timedelta(days=1)
        prev_start = start_date - timedelta(days=7)
        prev_end = start_date
    elif period == "all":
        # All-time: no meaningful "previous" window, so prev == current → 0% delta.
        start_date = datetime(2000, 1, 1)
        end_date = today_start + timedelta(days=1)
        prev_start, prev_end = start_date, end_date
    else:  # month (calendar month-to-date)
        start_date = today_start.replace(day=1)
        end_date = today_start + timedelta(days=1)
        last_day_prev_month = start_date - timedelta(days=1)
        prev_start = last_day_prev_month.replace(day=1)
        prev_end = start_date

    return start_date, end_date, prev_start, prev_end


@router.get("/metrics")
def get_dashboard_metrics(
    period: str = "month",  # today, yesterday, 7days, month
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get main dashboard metrics with period filtering - Dental clinic specific"""
    # Use provided clinic_id if owner, else default to user's clinic
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    # Calculate date ranges
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    start_date, end_date, prev_start, prev_end = period_range(period, now)

    # 1. Total Patients (registered in this period)
    patients_count = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= start_date,
            Patient.created_at < end_date
        )
    ).scalar() or 0
    
    prev_patients = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= prev_start,
            Patient.created_at < prev_end
        )
    ).scalar() or 0
    
    patient_change = calculate_trend(patients_count, prev_patients)
    
    # 2. Appointments (total in this period)
    appointments_count = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date < end_date
        )
    ).scalar() or 0
    
    prev_appointments = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= prev_start,
            Appointment.appointment_date < prev_end
        )
    ).scalar() or 0
    
    appointment_change = calculate_trend(appointments_count, prev_appointments)

    # 2b. Appointment outcome split, so the card can say what those bookings
    # actually became instead of only how many there were.
    outcome_rows = db.query(Appointment.status, func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date < end_date
        )
    ).group_by(Appointment.status).all()

    appt_completed = appt_missed = appt_scheduled = 0
    for raw_status, count in outcome_rows:
        s = (raw_status or 'confirmed').lower()
        if s == 'completed':
            appt_completed += int(count)
        elif s in ('no-show', 'no_show', 'cancelled'):
            appt_missed += int(count)
        else:
            appt_scheduled += int(count)

    # 2c. DEPRECATED: appointments in 'checking' status.
    #
    # The web dashboard dropped this card — it reads 0 almost every day, so it
    # was a quarter of the KPI row showing nothing. It stays in the payload
    # because the mobile app's home screen still renders it
    # (mobile-app/src/services/api/analytics.api.ts). Remove once mobile moves
    # to `outstanding`; until then dropping it would silently show 0 on a
    # screen people actually use, since mobile reads it with `|| 0`.
    checking_count = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.status == ARRIVED,
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date < end_date
        )
    ).scalar() or 0

    prev_checking = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.status == ARRIVED,
            Appointment.appointment_date >= prev_start,
            Appointment.appointment_date < prev_end
        )
    ).scalar() or 0

    checking_trend = calculate_trend(checking_count, prev_checking)

    # 3. Outstanding dues — finalized invoices still carrying a balance.
    #
    # Deliberately NOT period-filtered: money owed is owed regardless of which
    # window the header is showing, and an "outstanding" figure that shrank when
    # you switched to "Today" would be actively misleading. Same query shape as
    # /dashboard/today so the KPI and the attention queue can never disagree.
    dues_row = db.query(
        func.count(Invoice.id),
        func.coalesce(func.sum(Invoice.due_amount), 0.0),
    ).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
        )
    ).first()
    dues_count = int(dues_row[0] or 0)
    dues_amount = float(dues_row[1] or 0.0)

    # Aging: how much of that balance has been sitting for over 30 days, dated
    # from when the invoice was finalized (falling back to creation for older
    # rows that predate finalized_at).
    aged_cutoff = today_start - timedelta(days=30)
    invoice_date = func.coalesce(Invoice.finalized_at, Invoice.created_at)

    aged_amount = float(db.query(func.coalesce(func.sum(Invoice.due_amount), 0.0)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
            invoice_date < aged_cutoff,
        )
    ).scalar() or 0.0)

    oldest_dt = db.query(func.min(invoice_date)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
        )
    ).scalar()
    oldest_days = int((now - oldest_dt).days) if oldest_dt else 0

    # Compared against the balance as it stood one period ago, approximated by
    # excluding invoices raised inside the current window.
    prev_dues_amount = float(db.query(func.coalesce(func.sum(Invoice.due_amount), 0.0)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
            invoice_date < start_date,
        )
    ).scalar() or 0.0)
    dues_trend = calculate_trend(dues_amount, prev_dues_amount)

    # 4. Revenue (Sum of payments in this period)
    revenue_payments = db.query(func.sum(Payment.amount)).filter(
        and_(
            Payment.clinic_id == final_clinic_id,
            Payment.status == "success",
            Payment.created_at >= start_date,
            Payment.created_at < end_date
        )
    ).scalar() or 0
    
    revenue_invoices = db.query(func.sum(Invoice.total)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.status.in_(["paid_verified", "paid_unverified"]),
            Invoice.updated_at >= start_date,
            Invoice.updated_at < end_date
        )
    ).scalar() or 0
    
    revenue = float(revenue_payments) + float(revenue_invoices)
    
    prev_revenue_payments = db.query(func.sum(Payment.amount)).filter(
        and_(
            Payment.clinic_id == final_clinic_id,
            Payment.status == "success",
            Payment.created_at >= prev_start,
            Payment.created_at < prev_end
        )
    ).scalar() or 0
    
    prev_revenue_invoices = db.query(func.sum(Invoice.total)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.status.in_(["paid_verified", "paid_unverified"]),
            Invoice.updated_at >= prev_start,
            Invoice.updated_at < prev_end
        )
    ).scalar() or 0
    
    prev_revenue = float(prev_revenue_payments) + float(prev_revenue_invoices)

    revenue_trend = calculate_trend(revenue, prev_revenue)

    # Total billed in the window, so the card can show collected-of-billed
    # rather than a bare collected figure with nothing to size it against.
    billed = float(db.query(func.coalesce(func.sum(Invoice.total), 0.0)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.status.notin_(['draft', 'cancelled']),
            func.coalesce(Invoice.finalized_at, Invoice.created_at) >= start_date,
            func.coalesce(Invoice.finalized_at, Invoice.created_at) < end_date,
        )
    ).scalar() or 0.0)

    # Collected today, for the hero card's footer line.
    revenue_today = float(db.query(func.coalesce(func.sum(Payment.amount), 0.0)).filter(
        and_(
            Payment.clinic_id == final_clinic_id,
            Payment.status == "success",
            Payment.created_at >= today_start,
        )
    ).scalar() or 0.0)

    # New patients per day for the last 7 days — a shape, not a series anyone
    # reads values off, so 7 grouped counts is plenty.
    spark_start = today_start - timedelta(days=6)
    spark_rows = dict(
        db.query(func.date(Patient.created_at), func.count(Patient.id))
        .filter(
            and_(
                Patient.clinic_id == final_clinic_id,
                Patient.created_at >= spark_start,
            )
        )
        .group_by(func.date(Patient.created_at))
        .all()
    )
    # func.date() comes back as a date on Postgres and a string on SQLite.
    spark_by_day = {str(k): int(v) for k, v in spark_rows.items()}
    patients_sparkline = [
        spark_by_day.get(str((spark_start + timedelta(days=i)).date()), 0)
        for i in range(7)
    ]
    patients_last_30 = int(db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= today_start - timedelta(days=30),
        )
    ).scalar() or 0)

    return {
        "total_patients": {
            "value": patients_count,
            "change": patient_change,
            "change_type": "up" if patient_change >= 0 else "down",
            "sparkline": patients_sparkline,
            "last_30_days": patients_last_30,
        },
        "appointments": {
            "value": appointments_count,
            "change": appointment_change,
            "change_type": "up" if appointment_change >= 0 else "down",
            "completed": appt_completed,
            "scheduled": appt_scheduled,
            "missed": appt_missed,
        },
        # Deprecated — kept for the mobile home screen. See note above.
        "checking": {
            "value": checking_count,
            "change": checking_trend,
            "change_type": "up" if checking_trend >= 0 else "down",
        },
        # `invert` tells the card that a rise is bad news, so the delta pill
        # colours red on the way up instead of green.
        "outstanding": {
            "value": round(dues_amount, 2),
            "change": dues_trend,
            "change_type": "up" if dues_trend >= 0 else "down",
            "invert": True,
            "invoice_count": dues_count,
            "aged_amount": round(aged_amount, 2),
            "oldest_days": oldest_days,
        },
        "revenue": {
            "value": float(revenue),
            "change": revenue_trend,
            "change_type": "up" if revenue_trend >= 0 else "down",
            "billed": round(billed, 2),
            "collected_today": round(revenue_today, 2),
        },
    }

def calculate_trend(current, previous):
    if not previous or previous == 0:
        return 100 if current > 0 else 0
    return round(((current - previous) / previous) * 100, 1)


def _shift_months(d, n):
    """Return d shifted by -n months (n can be negative to go forward)."""
    idx = (d.year * 12 + (d.month - 1)) - n
    return d.replace(year=idx // 12, month=idx % 12 + 1)


def all_time_months(db, clinic_id, now):
    """Monthly buckets for the 'all' period — from the clinic's first patient to
    the current month, capped to the trailing 24 months. Returns [(label, start, end)]."""
    current_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    earliest = db.query(func.min(Patient.created_at)).filter(Patient.clinic_id == clinic_id).scalar()
    first_month = (earliest or current_month).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start = max(first_month, _shift_months(current_month, 23))

    buckets = []
    cur = start
    while cur <= current_month:
        nxt = _shift_months(cur, -1)
        buckets.append((cur.strftime("%b %y"), cur, nxt))
        cur = nxt
    return buckets

def period_buckets(period: str, db, clinic_id: int, now: datetime = None):
    """The x-axis for a chart at this period → [(label, start, end)].

    One place decides the granularity, so every chart on the page shares the same
    buckets: hourly for a single day, daily for a week or the current month,
    monthly for all-time. The header's filter is what drives it.
    """
    now = now or datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if period == "all":
        return all_time_months(db, clinic_id, now)

    if period in ("today", "yesterday"):
        day = today_start if period == "today" else today_start - timedelta(days=1)
        return [(f"{i:02d}:00", day + timedelta(hours=i), day + timedelta(hours=i + 1)) for i in range(24)]

    if period == "7days":
        return [
            ((today_start - timedelta(days=i)).strftime("%a"),
             today_start - timedelta(days=i),
             today_start - timedelta(days=i - 1))
            for i in range(6, -1, -1)
        ]

    month_start = today_start.replace(day=1)
    days_in_month = (today_start - month_start).days + 1
    return [
        ((month_start + timedelta(days=i)).strftime("%d %b"),
         month_start + timedelta(days=i),
         month_start + timedelta(days=i + 1))
        for i in range(days_in_month)
    ]


def _bucket_index(buckets, when):
    """Index of the bucket `when` falls into, or None. Buckets are contiguous and
    ordered, so a linear scan is fine at these sizes (24 max)."""
    if when is None:
        return None
    for i, (_, start, end) in enumerate(buckets):
        if start <= when < end:
            return i
    return None


@router.get("/patient-stats")
def get_patient_statistics(
    period: str = "month",  # today, yesterday, 7days, month, all
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Patient activity by time period: new registrations vs returning visits.

    - new:       patients first registered in the bucket
    - returning: existing patients (registered earlier) who had an appointment
                 in the bucket

    Two queries total, bucketed in Python. This used to run two queries *per
    bucket*, which was 48 round-trips for all-time and 62 for a full month — on
    the first screen anyone opens, and now the default. Bucketing in Python
    rather than SQL `date_trunc` keeps it working on both Postgres (server) and
    SQLite (bundled desktop build).
    """
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()

    buckets = period_buckets(period, db, final_clinic_id, now)
    if not buckets:
        return []

    range_start, range_end = buckets[0][1], buckets[-1][2]
    new_counts = [0] * len(buckets)
    returning_sets = [set() for _ in buckets]

    # 1. New registrations.
    for created_at, in db.query(Patient.created_at).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= range_start,
            Patient.created_at < range_end,
        )
    ).all():
        idx = _bucket_index(buckets, created_at)
        if idx is not None:
            new_counts[idx] += 1

    # 2. Returning visits. "Returning" is per-bucket (registered before *this*
    # bucket began), so the comparison has to happen after bucketing — hence
    # carrying created_at along rather than filtering in SQL. Distinct patients
    # per bucket, so a patient with three visits in a month counts once.
    for appt_date, patient_id, created_at in db.query(
        Appointment.appointment_date, Appointment.patient_id, Patient.created_at
    ).join(Patient, Patient.id == Appointment.patient_id).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= range_start,
            Appointment.appointment_date < range_end,
        )
    ).all():
        idx = _bucket_index(buckets, appt_date)
        if idx is not None and created_at is not None and created_at < buckets[idx][1]:
            returning_sets[idx].add(patient_id)

    return [
        {"label": label, "new": new_counts[i], "returning": len(returning_sets[i])}
        for i, (label, _, _) in enumerate(buckets)
    ]

# Free-text `gender` normalised to the three slices the donut shows. The column
# has no constraint, so real data holds "Male", "male", "M", "f", "" and NULL.
_GENDER_ALIASES = {
    'm': 'Male', 'male': 'Male', 'man': 'Male', 'boy': 'Male',
    'f': 'Female', 'female': 'Female', 'woman': 'Female', 'girl': 'Female',
}


@router.get("/demographics")
def get_patient_demographics(
    period: str = "month",  # accepted for API compatibility; see note below
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Gender split across the clinic's whole patient base.

    Deliberately NOT period-filtered. "Who are my patients" is a property of the
    roster, not of a date window — filtering it by registration date made the
    chart answer a different question ("who did I register this month") while
    still being labelled as the patient base. `period` is still accepted so the
    frontend can pass it uniformly with the other charts.

    Anything that isn't recognisably male or female lands in "Not recorded"
    rather than being dropped, so the slices always sum to the patient count and
    the gap in the data stays visible instead of silently vanishing.
    """
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    rows = (
        db.query(Patient.gender, func.count(Patient.id))
        .filter(Patient.clinic_id == final_clinic_id)
        .group_by(Patient.gender)
        .all()
    )

    buckets = {'Female': 0, 'Male': 0, 'Not recorded': 0}
    for raw, count in rows:
        key = _GENDER_ALIASES.get((raw or '').strip().lower(), 'Not recorded')
        buckets[key] += int(count or 0)

    palette = {'Female': '#2a276e', 'Male': '#9B8CFF', 'Not recorded': '#e4e3ee'}
    # Keep every slice, including empty ones, so the legend layout is stable as
    # data arrives instead of the card reflowing on each refetch.
    return [
        {"name": name, "value": buckets[name], "color": palette[name]}
        for name in ('Female', 'Male', 'Not recorded')
    ]

@router.get("/revenue")
def get_revenue_analytics(
    period: str = "week",  # week, month, year
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Revenue analytics by time period.

    Returns two series per bucket so the chart can show the collection gap:
      - collected: money actually received (successful payments + paid invoices)
      - billed:    value invoiced in that bucket (finalized, non-cancelled)
    The space between billed and collected is the period's receivable.
    """
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Dynamic target: 10k default, or 20% more than average if data exists
    avg_rev = db.query(func.avg(Payment.amount)).filter(
        and_(Payment.clinic_id == final_clinic_id, Payment.status == "success")
    ).scalar() or 0

    buckets = period_buckets(period, db, final_clinic_id, now)
    if not buckets:
        return []

    target = max(10000.0, float(avg_rev) * 1.2)
    if period in ("today", "yesterday"):
        target = target / 24

    range_start, range_end = buckets[0][1], buckets[-1][2]
    collected = [0.0] * len(buckets)
    billed = [0.0] * len(buckets)

    # Three queries for the whole chart instead of three per bucket.
    for created_at, amount in db.query(Payment.created_at, Payment.amount).filter(
        and_(Payment.clinic_id == final_clinic_id, Payment.status == "success",
             Payment.created_at >= range_start, Payment.created_at < range_end)
    ).all():
        idx = _bucket_index(buckets, created_at)
        if idx is not None:
            collected[idx] += float(amount or 0)

    for updated_at, total in db.query(Invoice.updated_at, Invoice.total).filter(
        and_(Invoice.clinic_id == final_clinic_id,
             Invoice.status.in_(["paid_verified", "paid_unverified"]),
             Invoice.updated_at >= range_start, Invoice.updated_at < range_end)
    ).all():
        idx = _bucket_index(buckets, updated_at)
        if idx is not None:
            collected[idx] += float(total or 0)

    for created_at, total in db.query(Invoice.created_at, Invoice.total).filter(
        and_(Invoice.clinic_id == final_clinic_id,
             Invoice.status.notin_(["draft", "cancelled"]),
             Invoice.created_at >= range_start, Invoice.created_at < range_end)
    ).all():
        idx = _bucket_index(buckets, created_at)
        if idx is not None:
            billed[idx] += float(total or 0)

    return [
        {
            "label": label,
            "collected": round(collected[i], 2),
            "billed": round(billed[i], 2),
            "revenue": round(collected[i], 2),  # backwards-compat alias
            "target": target,
        }
        for i, (label, _, _) in enumerate(buckets)
    ]

@router.get("/capacity")
def get_clinic_capacity(
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get current clinic capacity utilization based on scheduled appointments"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    # Get today's appointments
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end
        )
    ).scalar() or 0

    # Assume max capacity of 50 appointment slots per day (can be configured)
    max_capacity = 50
    utilization = min(int((appointments_today / max_capacity) * 100), 100) if max_capacity > 0 else 0

    return {
        "utilization": utilization,
        "appointments_today": appointments_today,
        "max_capacity": max_capacity
    }

@router.get("/patients/details")
def get_patients_details(
    period: Optional[str] = None,  # today, week, month
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed patient list for drawer view"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    query = db.query(Patient).filter(Patient.clinic_id == final_clinic_id)

    # Same window as the KPI card, so counts match.
    if period:
        start_date, end_date, _, _ = period_range(period)
        query = query.filter(Patient.created_at >= start_date, Patient.created_at < end_date)

    patients = query.order_by(Patient.created_at.desc()).limit(100).all()
    
    return [{
        "id": p.id,
        "name": p.name,
        "age": p.age,
        "gender": p.gender,
        "phone": p.phone,
        "village": p.village,
        "treatment_type": p.treatment_type,
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in patients]

@router.get("/revenue/details")
def get_revenue_details(
    period: Optional[str] = None,  # today, week, month
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Recent payments for the Revenue card drawer."""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    query = db.query(Payment).filter(Payment.clinic_id == final_clinic_id)

    # Same window as the KPI card, so the total matches.
    if period:
        start_date, end_date, _, _ = period_range(period)
        query = query.filter(Payment.created_at >= start_date, Payment.created_at < end_date)

    payments = query.order_by(Payment.created_at.desc()).limit(100).all()

    return [{
        "id": p.id,
        "patient_name": p.patient.name if p.patient else f"Patient #{p.patient_id}",
        "amount": float(p.amount or 0),
        "payment_method": p.payment_method,
        "status": p.status,
        "treatment_type": p.treatment_type.name if p.treatment_type else None,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    } for p in payments]

@router.get("/reports/details")
def get_reports_details(
    status: Optional[str] = None,  # pending, completed, all
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed report list for drawer view"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    
    query = db.query(Report).filter(Report.clinic_id == final_clinic_id)
    
    if status == "pending":
        query = query.filter(Report.status.in_(['pending', 'draft']))
    elif status == "completed":
        query = query.filter(Report.status == 'completed')
    
    reports = query.order_by(Report.created_at.desc()).limit(100).all()
    
    return [{
        "id": r.id,
        "patient_id": r.patient_id,
        "status": r.status,
        "created_at": r.created_at.isoformat() if r.created_at else None,
        "updated_at": r.updated_at.isoformat() if r.updated_at else None
    } for r in reports]

@router.get("/appointments/today")
def get_appointments_today(
    period: Optional[str] = None,  # today, yesterday, 7days, month, all
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Appointments for the drawer view. Defaults to today; honors the same
    period as the KPI card so the list matches the Appointments count."""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if period:
        win_start, win_end, _, _ = period_range(period, now)
    else:
        win_start, win_end = today_start, today_start + timedelta(days=1)

    appointments = db.query(Appointment).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= win_start,
            Appointment.appointment_date < win_end
        )
    ).order_by(Appointment.appointment_date.desc(), Appointment.start_time.asc()).all()

    result = []
    for apt in appointments:
        # Get doctor name if assigned
        doctor_name = None
        if apt.doctor_id:
            doctor = db.query(User).filter(User.id == apt.doctor_id).first()
            if doctor:
                doctor_name = doctor.name

        result.append({
            "id": apt.id,
            "name": apt.patient_name,
            "age": None,  # Age not stored in appointment, would need to get from patient
            "gender": None,  # Gender not stored in appointment
            "phone": apt.patient_phone,
            "treatment_type": apt.treatment,
            "doctor_name": doctor_name,
            "time": apt.start_time,
            "status": apt.status,
            "created_at": apt.created_at.isoformat() if apt.created_at else None
        })

    return result

@router.get("/today")
def get_today_overview(
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Today's schedule + a 'needs attention' action queue for the dashboard.

    Combines today's appointments with the most actionable follow-ups:
    outstanding payments, overdue lab cases, and today's no-shows.
    """
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # ── Today's appointments ──
    appts = db.query(Appointment).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end,
        )
    ).order_by(Appointment.start_time.asc()).all()

    DONE = {'completed'}
    OFF = {'cancelled', 'no-show', 'no_show'}

    # Batched: a name lookup per appointment would be N queries for a panel
    # that exists to be glanced at.
    _doc_ids = {a.doctor_id for a in appts if a.doctor_id}
    doctor_names = {
        u.id: (u.name or u.email)
        for u in db.query(User).filter(User.id.in_(_doc_ids)).all()
    } if _doc_ids else {}

    _appt_ids = [a.id for a in appts]
    started_ids = {
        row[0] for row in db.query(CasePaper.appointment_id).filter(
            CasePaper.appointment_id.in_(_appt_ids)
        ).all()
    } if _appt_ids else set()

    appointments = []
    completed = 0
    remaining = 0
    no_shows = 0
    for a in appts:
        status = (a.status or 'confirmed').lower()
        if status in DONE:
            completed += 1
        elif status in OFF:
            if status in ('no-show', 'no_show'):
                no_shows += 1
        else:
            remaining += 1
        appointments.append({
            "id": a.id,
            "name": a.patient_name,
            "time": a.start_time,
            "end_time": a.end_time,
            "duration": a.duration,
            "status": status,
            "treatment": a.treatment,
            "patient_id": a.patient_id,
            "phone": a.patient_phone,
            "doctor_id": a.doctor_id,
            # Resolved here rather than left as an id: the dashboard row is a
            # glance, and "who is seeing them" is one of the four things worth
            # knowing on it.
            "doctor_name": doctor_names.get(a.doctor_id),
            # Whether the visit has actually been started, so the row can offer
            # the right next step instead of the same one for everybody.
            "visit_started": a.id in started_ids,
        })

    # ── Outstanding dues: finalized invoices still carrying a balance ──
    dues = db.query(
        func.count(Invoice.id), func.coalesce(func.sum(Invoice.due_amount), 0.0)
    ).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
        )
    ).first()
    dues_count = int(dues[0] or 0)
    dues_amount = float(dues[1] or 0.0)

    # ── Overdue lab cases: sent/draft work past its due date ──
    overdue_labs = db.query(func.count(LabOrder.id)).filter(
        and_(
            LabOrder.clinic_id == final_clinic_id,
            LabOrder.status.in_(['Draft', 'Sent']),
            LabOrder.due_date.isnot(None),
            LabOrder.due_date < now,
        )
    ).scalar() or 0

    # ── Inventory: low stock (at/below reorder level) and expiry (within 30
    # days or already expired), across general stock and medication stock. ──
    clinic = db.query(Clinic).filter(Clinic.id == final_clinic_id).first()
    soon = clinic_today(clinic) + timedelta(days=30)

    low_stock = (
        (db.query(func.count(InventoryItem.id)).filter(
            InventoryItem.clinic_id == final_clinic_id,
            InventoryItem.min_stock_level > 0,
            InventoryItem.quantity <= InventoryItem.min_stock_level,
        ).scalar() or 0)
        + (db.query(func.count(MedicationStock.id)).filter(
            MedicationStock.clinic_id == final_clinic_id,
            MedicationStock.min_stock_level > 0,
            MedicationStock.quantity <= MedicationStock.min_stock_level,
        ).scalar() or 0)
    )
    expiring = (
        (db.query(func.count(InventoryItem.id)).filter(
            InventoryItem.clinic_id == final_clinic_id,
            InventoryItem.expiry_date.isnot(None),
            InventoryItem.expiry_date <= soon,
        ).scalar() or 0)
        + (db.query(func.count(MedicationStock.id)).filter(
            MedicationStock.clinic_id == final_clinic_id,
            MedicationStock.expiry_date.isnot(None),
            MedicationStock.expiry_date <= soon,
        ).scalar() or 0)
    )

    # ── Month activity, for the calendar dots ──
    # One row per day of the current month carrying what is booked that day, so
    # the calendar can show at a glance that Thursday is packed and Friday empty.
    # Three grouped queries for the month, not three per day.
    month_start = today_start.replace(day=1)
    next_month = _shift_months(month_start, -1)
    days_in_month = (next_month - month_start).days

    activity = {
        (month_start + timedelta(days=i)).date().isoformat(): {"appointments": 0, "labs": 0, "dues": 0}
        for i in range(days_in_month)
    }

    def _bump(key, when, amount=1):
        if when is None:
            return
        day = (when.date() if hasattr(when, 'date') else when).isoformat()
        if day in activity:
            activity[day][key] += amount

    for (appt_date,) in db.query(Appointment.appointment_date).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= month_start,
            Appointment.appointment_date < next_month,
        )
    ).all():
        _bump("appointments", appt_date)

    for (due_date,) in db.query(LabOrder.due_date).filter(
        and_(
            LabOrder.clinic_id == final_clinic_id,
            LabOrder.due_date.isnot(None),
            LabOrder.due_date >= month_start,
            LabOrder.due_date < next_month,
        )
    ).all():
        _bump("labs", due_date)

    for (inv_date,) in db.query(func.coalesce(Invoice.finalized_at, Invoice.created_at)).filter(
        and_(
            Invoice.clinic_id == final_clinic_id,
            Invoice.due_amount > 0,
            Invoice.status.notin_(['draft', 'cancelled']),
            func.coalesce(Invoice.finalized_at, Invoice.created_at) >= month_start,
            func.coalesce(Invoice.finalized_at, Invoice.created_at) < next_month,
        )
    ).all():
        _bump("dues", inv_date)

    month_activity = [
        {"date": day, **counts}
        for day, counts in sorted(activity.items())
    ]

    return {
        "summary": {
            "total": len(appts),
            "completed": completed,
            "remaining": remaining,
        },
        "appointments": appointments,
        "month": {
            "year": month_start.year,
            "month": month_start.month,
            "today": today_start.date().isoformat(),
            "days": month_activity,
        },
        "attention": {
            "outstanding_dues": {"count": dues_count, "amount": round(dues_amount, 2)},
            "overdue_labs": int(overdue_labs),
            "no_shows_today": no_shows,
            "low_stock": int(low_stock),
            "expiring_soon": int(expiring),
        },
    }


@router.get("/chairs/status")
def get_chairs_status(
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get dental chair status with detailed utilization metrics based on scheduled appointments"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get today's scheduled appointments
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_start + timedelta(days=1)
        )
    ).scalar() or 0

    # Simulate chair status (5 chairs)
    total_chairs = 5
    # Estimate occupied chairs based on concurrent appointments
    chairs_occupied = min(max(1, appointments_today // 2), total_chairs) if appointments_today > 0 else 0
    chairs_idle = total_chairs - chairs_occupied

    # Calculate utilization metrics
    utilization_percent = int((chairs_occupied / total_chairs) * 100)
    idle_percent = 100 - utilization_percent

    # Simulate active hours (assuming 8-hour workday)
    total_hours = 8
    active_hours = (chairs_occupied / total_chairs) * total_hours
    idle_hours = total_hours - active_hours

    chairs = []
    for i in range(1, total_chairs + 1):
        status = "occupied" if i <= chairs_occupied else "idle"
        chairs.append({
            "chair_number": i,
            "status": status,
            "patient_name": f"Patient {i}" if status == "occupied" else None,
            "active_time": f"{int(active_hours)}h {int((active_hours % 1) * 60)}m" if status == "occupied" else "0h 0m"
        })

    return {
        "total_chairs": total_chairs,
        "chairs_occupied": chairs_occupied,
        "chairs_idle": chairs_idle,
        "chairs_available": chairs_idle,
        "utilization_percent": utilization_percent,
        "idle_percent": idle_percent,
        "active_hours": round(active_hours, 1),
        "idle_hours": round(idle_hours, 1),
        "total_hours": total_hours,
        "chairs": chairs
    }

@router.get("/treatments/stats")
def get_treatment_statistics(
    period: str = "week",  # week, month, year
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get treatment type statistics"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    
    # Calculate date range
    if period == "week":
        start_date = now - timedelta(days=7)
    elif period == "month":
        start_date = now - timedelta(days=30)
    else:  # year
        start_date = now - timedelta(days=365)
    
    # Get treatment type counts
    treatment_counts = db.query(
        Patient.treatment_type,
        func.count(Patient.id).label('count')
    ).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= start_date,
            Patient.treatment_type.isnot(None)
        )
    ).group_by(Patient.treatment_type).all()
    
    # Format response
    treatments = []
    total = sum([t.count for t in treatment_counts])
    
    # Common dental treatment colors
    colors = ['#1d8a99', '#6ee7b7', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']
    
    for idx, treatment in enumerate(treatment_counts):
        percentage = (treatment.count / total * 100) if total > 0 else 0
        treatments.append({
            "name": treatment.treatment_type,
            "count": treatment.count,
            "percentage": round(percentage, 1),
            "color": colors[idx % len(colors)]
        })
    
    return {
        "total_treatments": total,
        "period": period,
        "treatments": sorted(treatments, key=lambda x: x['count'], reverse=True)
    }

@router.get("/appointments/trends")
def get_appointment_trends(
    period: str = "month",  # today, yesterday, 7days, month
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get appointment trends by time slots or days based on period"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    MISSED = {"no-show", "no_show", "cancelled"}

    def categorize(status):
        s = (status or "").lower()
        if s == "completed":
            return "completed"
        if s in MISSED:
            return "missed"
        return "scheduled"

    if period in ("today", "yesterday"):
        # This chart groups a single day into 2-hour clinic-hours windows rather
        # than the hourly buckets the other charts use, so it builds its own.
        day = today_start if period == "today" else today_start - timedelta(days=1)
        buckets = [
            (f"{h % 12 or 12}{'AM' if h < 12 else 'PM'}", day + timedelta(hours=h), day + timedelta(hours=h + 2))
            for h in range(8, 22, 2)
        ]
    else:
        buckets = period_buckets(period, db, final_clinic_id, now)

    if not buckets:
        return []

    out = [
        {"time": label, "completed": 0, "missed": 0, "scheduled": 0, "bookings": 0}
        for (label, _, _) in buckets
    ]

    # One query for the whole chart. Grouping by (bucket, status) in SQL would
    # need date_trunc, which the bundled SQLite desktop build doesn't have, so
    # the bucketing happens here.
    for appt_date, status in db.query(Appointment.appointment_date, Appointment.status).filter(
        and_(
            Appointment.clinic_id == final_clinic_id,
            Appointment.appointment_date >= buckets[0][1],
            Appointment.appointment_date < buckets[-1][2],
        )
    ).all():
        idx = _bucket_index(buckets, appt_date)
        if idx is not None:
            out[idx][categorize(status)] += 1

    for row in out:
        row["bookings"] = row["completed"] + row["missed"] + row["scheduled"]
    return out

@router.get("/appointments/quality")
def get_appointment_quality(
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get appointment quality metrics"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Total appointments (using patient registrations as proxy)
    total_appointments = db.query(func.count(Patient.id)).filter(
        Patient.clinic_id == final_clinic_id
    ).scalar() or 0
    
    # This week's appointments
    appointments_this_week = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= week_ago
        )
    ).scalar() or 0
    
    # This month's appointments
    appointments_this_month = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.created_at >= month_ago
        )
    ).scalar() or 0
    
    # Calculate quality metrics (simplified)
    # In real scenario, you'd track actual appointment status
    completed_rate = 85  # Placeholder - would come from actual appointment completions
    on_time_rate = 78    # Placeholder - would track actual appointment timing
    satisfaction_rate = 92  # Placeholder - would come from patient feedback
    
    return {
        "total_appointments": total_appointments,
        "this_week": appointments_this_week,
        "this_month": appointments_this_month,
        "completion_rate": completed_rate,
        "on_time_rate": on_time_rate,
        "satisfaction_rate": satisfaction_rate,
        "quality_score": round((completed_rate + on_time_rate + satisfaction_rate) / 3, 1)
    }

@router.get("/preferences")
def get_dashboard_preferences(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get user's dashboard preferences"""
    user = db.query(User).filter(User.id == current_user.id).first()
    
    if user and getattr(user, 'dashboard_preferences', None):
        return user.dashboard_preferences
    
    # Return default preferences if none exist
    return {
        "visible_widgets": {
            "patientStats": True,
            "demographics": True,
            "revenue": True,
            "appointments": True,
            "dentalChairs": True,
            "chairUtilization": True,
            "treatments": True,
            "quality": True
        }
    }

@router.post("/preferences")
def save_dashboard_preferences(
    preferences: dict,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Save user's dashboard preferences"""
    user = db.query(User).filter(User.id == current_user.id).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    try:
        user.dashboard_preferences = preferences
        db.commit()
    except Exception:
        db.rollback()
        return {"message": "Preferences not persisted (column unavailable)", "preferences": preferences}
    
    return {"message": "Preferences saved successfully", "preferences": preferences}

@router.get("/clinic-performance")
def get_clinic_performance(
    compare_clinic_ids: str = None,  # Comma-separated clinic IDs to compare with
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get clinic performance metrics for comparison"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get current clinic metrics
    current_metrics = _calculate_clinic_metrics(db, final_clinic_id, month_start, now)

    result = {
        "current_clinic": {
            "id": final_clinic_id,
            "name": current_metrics["name"],
            "metrics": current_metrics
        },
        "comparisons": []
    }

    # Get comparison clinics if specified
    if compare_clinic_ids:
        clinic_ids = [int(id.strip()) for id in compare_clinic_ids.split(',') if id.strip()]

        for clinic_id in clinic_ids[:3]:  # Limit to 3 comparisons
            try:
                metrics = _calculate_clinic_metrics(db, clinic_id, month_start, now)
                result["comparisons"].append({
                    "id": clinic_id,
                    "name": metrics["name"],
                    "metrics": metrics
                })
            except:
                # Skip clinics that can't be accessed or don't exist
                continue

    return result

def _calculate_clinic_metrics(db, clinic_id, start_date, end_date):
    """Calculate performance metrics for a clinic"""
    # Get clinic name
    clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
    clinic_name = clinic.name if clinic else f"Clinic {clinic_id}"

    # Appointments this month
    appointments_count = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= start_date,
            Appointment.appointment_date <= end_date
        )
    ).scalar() or 0

    # Revenue this month
    revenue = db.query(func.sum(Payment.amount)).filter(
        and_(
            Payment.clinic_id == clinic_id,
            Payment.status == "success",
            Payment.created_at >= start_date,
            Payment.created_at <= end_date
        )
    ).scalar() or 0

    # Patient satisfaction (placeholder - would come from actual feedback)
    satisfaction_score = 85 + (clinic_id % 10)  # Mock data with some variation

    # Chair utilization
    total_chairs = 5
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0),
            Appointment.appointment_date < datetime.utcnow().replace(hour=23, minute=59, second=59, microsecond=999999)
        )
    ).scalar() or 0

    utilization = min(int((appointments_today / max(1, total_chairs * 2)) * 100), 100)

    return {
        "name": clinic_name,
        "appointments_count": appointments_count,
        "revenue": float(revenue),
        "satisfaction_score": satisfaction_score,
        "chair_utilization": utilization
    }

@router.get("/patient-locations")
def get_patient_locations(
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get patient locations for map visualization"""
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id

    # Get patients with location data (using village as location proxy)
    patients = db.query(Patient).filter(
        and_(
            Patient.clinic_id == final_clinic_id,
            Patient.village.isnot(None)
        )
    ).all()

    # Group patients by location
    location_data = {}
    for patient in patients:
        location = patient.village.strip()
        if location not in location_data:
            location_data[location] = {
                "location": location,
                "count": 0,
                "patients": []
            }

        location_data[location]["count"] += 1
        location_data[location]["patients"].append({
            "id": patient.id,
            "name": patient.name,
            "age": patient.age,
            "gender": patient.gender
        })

    # Convert to list and add mock coordinates (in real app, you'd geocode addresses)
    result = []
    for location, data in location_data.items():
        # Mock coordinates based on location name (in production, use geocoding API)
        # For demo purposes, we'll use some Indian cities coordinates
        mock_coords = _get_mock_coordinates(location)

        result.append({
            "location": location,
            "count": data["count"],
            "latitude": mock_coords["lat"],
            "longitude": mock_coords["lon"],
            "patients": data["patients"][:5]  # Show max 5 patients per location
        })

    return result

def _get_mock_coordinates(location):
    """Get mock coordinates for locations (replace with real geocoding in production)"""
    # Mock coordinates for common Indian locations
    mock_locations = {
        "Mumbai": {"lat": 19.0760, "lon": 72.8777},
        "Delhi": {"lat": 28.7041, "lon": 77.1025},
        "Bangalore": {"lat": 12.9716, "lon": 77.5946},
        "Chennai": {"lat": 13.0827, "lon": 80.2707},
        "Kolkata": {"lat": 22.5726, "lon": 88.3639},
        "Pune": {"lat": 18.5204, "lon": 73.8567},
        "Ahmedabad": {"lat": 23.0225, "lon": 72.5714},
        "Jaipur": {"lat": 26.9124, "lon": 75.7873},
        "Surat": {"lat": 21.1702, "lon": 72.8311},
        "Kanpur": {"lat": 26.4499, "lon": 80.3319},
        "Nagpur": {"lat": 21.1458, "lon": 79.0882},
        "Indore": {"lat": 22.7196, "lon": 75.8577},
        "Thane": {"lat": 19.2183, "lon": 72.9781},
        "Bhopal": {"lat": 23.2599, "lon": 77.4126},
        "Visakhapatnam": {"lat": 17.6868, "lon": 83.2185},
        "Patna": {"lat": 25.5941, "lon": 85.1376},
        "Vadodara": {"lat": 22.3072, "lon": 73.1812},
        "Ghaziabad": {"lat": 28.6692, "lon": 77.4538},
        "Ludhiana": {"lat": 30.9010, "lon": 75.8573},
        "Agra": {"lat": 27.1767, "lon": 78.0081},
        "Nashik": {"lat": 19.9975, "lon": 73.7898},
        "Faridabad": {"lat": 28.4089, "lon": 77.3178},
        "Meerut": {"lat": 28.9845, "lon": 77.7064},
        "Rajkot": {"lat": 22.3039, "lon": 70.8022},
        "Kalyan-Dombivli": {"lat": 19.2350, "lon": 73.1297},
        "Vasai-Virar": {"lat": 19.3919, "lon": 72.8397},
        "Varanasi": {"lat": 25.3176, "lon": 82.9739},
        "Srinagar": {"lat": 34.0837, "lon": 74.7973},
        "Aurangabad": {"lat": 19.8762, "lon": 75.3433},
        "Dhanbad": {"lat": 23.7957, "lon": 86.4304},
        "Amritsar": {"lat": 31.6340, "lon": 74.8723},
        "Navi Mumbai": {"lat": 19.0330, "lon": 73.0297},
        "Allahabad": {"lat": 25.4358, "lon": 81.8463},
        "Ranchi": {"lat": 23.3441, "lon": 85.3096},
        "Howrah": {"lat": 22.5958, "lon": 88.2636},
        "Coimbatore": {"lat": 11.0168, "lon": 76.9558},
        "Jabalpur": {"lat": 23.1815, "lon": 79.9864},
        "Gwalior": {"lat": 26.2183, "lon": 78.1828},
        "Vijayawada": {"lat": 16.5062, "lon": 80.6480},
        "Jodhpur": {"lat": 26.2389, "lon": 73.0243},
        "Madurai": {"lat": 9.9252, "lon": 78.1198},
        "Raipur": {"lat": 21.2514, "lon": 81.6296},
        "Kota": {"lat": 25.2138, "lon": 75.8648},
        "Guwahati": {"lat": 26.1445, "lon": 91.7362},
        "Chandigarh": {"lat": 30.7333, "lon": 76.7794},
        "Solapur": {"lat": 17.6599, "lon": 75.9064},
        "Hubli-Dharwad": {"lat": 15.3647, "lon": 75.1240},
        "Bareilly": {"lat": 28.3670, "lon": 79.4304},
        "Moradabad": {"lat": 28.8386, "lon": 78.7733},
        "Mysore": {"lat": 12.2958, "lon": 76.6394},
        "Gurgaon": {"lat": 28.4595, "lon": 77.0266},
        "Aligarh": {"lat": 27.8974, "lon": 78.0880},
        "Jalandhar": {"lat": 31.3260, "lon": 75.5762},
        "Tiruchirappalli": {"lat": 10.7905, "lon": 78.7047},
        "Bhubaneswar": {"lat": 20.2961, "lon": 85.8245},
        "Salem": {"lat": 11.6643, "lon": 78.1460},
        "Warangal": {"lat": 17.9784, "lon": 79.5941},
        "Guntur": {"lat": 16.3067, "lon": 80.4365},
        "Bhiwandi": {"lat": 19.2813, "lon": 73.0483},
        "Saharanpur": {"lat": 29.9679, "lon": 77.5460},
        "Gorakhpur": {"lat": 26.7606, "lon": 83.3732},
        "Bikaner": {"lat": 28.0229, "lon": 73.3119},
        "Amravati": {"lat": 20.9374, "lon": 77.7796},
        "Noida": {"lat": 28.5355, "lon": 77.3910},
        "Jamshedpur": {"lat": 22.8046, "lon": 86.2029},
        "Bhilai": {"lat": 21.1938, "lon": 81.3509},
        "Cuttack": {"lat": 20.4625, "lon": 85.8830},
        "Firozabad": {"lat": 27.1509, "lon": 78.3978},
        "Kochi": {"lat": 9.9312, "lon": 76.2673},
        "Nellore": {"lat": 14.4426, "lon": 79.9865},
        "Bhavnagar": {"lat": 21.7645, "lon": 72.1519},
        "Dehradun": {"lat": 30.3165, "lon": 78.0322},
        "Durgapur": {"lat": 23.5204, "lon": 87.3119},
        "Asansol": {"lat": 23.6739, "lon": 86.9524},
        "Rourkela": {"lat": 22.2604, "lon": 84.8536},
        "Nanded": {"lat": 19.1383, "lon": 77.3210},
        "Kolhapur": {"lat": 16.7050, "lon": 74.2433},
        "Ajmer": {"lat": 26.4499, "lon": 74.6399},
        "Akola": {"lat": 20.7002, "lon": 77.0082},
        "Gulbarga": {"lat": 17.3297, "lon": 76.8343},
        "Jamnagar": {"lat": 22.4707, "lon": 70.0577},
        "Ujjain": {"lat": 23.1765, "lon": 75.7885},
        "Loni": {"lat": 28.7525, "lon": 77.2880},
        "Siliguri": {"lat": 26.7271, "lon": 88.3953},
        "Jhansi": {"lat": 25.4484, "lon": 78.5685},
        "Ulhasnagar": {"lat": 19.2215, "lon": 73.1645},
        "Jammu": {"lat": 32.7266, "lon": 74.8570},
        "Sangli-Miraj & Kupwad": {"lat": 16.8609, "lon": 74.5658},
        "Mangalore": {"lat": 12.9141, "lon": 74.8550},
        "Erode": {"lat": 11.3410, "lon": 77.7172},
        "Belgaum": {"lat": 15.8497, "lon": 74.4977},
        "Ambattur": {"lat": 13.1143, "lon": 80.1481},
        "Tirunelveli": {"lat": 8.7139, "lon": 77.7567},
        "Malegaon": {"lat": 20.5540, "lon": 74.5250},
        "Gaya": {"lat": 24.7914, "lon": 85.0002},
        "Thiruvananthapuram": {"lat": 8.5241, "lon": 76.9366},
        "Kurnool": {"lat": 15.8281, "lon": 78.0373},
        "Udaipur": {"lat": 24.5854, "lon": 73.7125},
        "Kakinada": {"lat": 16.9891, "lon": 82.2475},
        "Nizamabad": {"lat": 18.6725, "lon": 78.0941},
        "Parbhani": {"lat": 19.2686, "lon": 76.7708},
        "Tumkur": {"lat": 13.3379, "lon": 77.1173},
        "Khammam": {"lat": 17.2473, "lon": 80.1514},
        "Ozhukarai": {"lat": 11.9489, "lon": 79.8304},
        "Bihar Sharif": {"lat": 25.1971, "lon": 85.5149},
        "Panipat": {"lat": 29.3909, "lon": 76.9635},
        "Darbhanga": {"lat": 26.1520, "lon": 85.8970},
        "Bally": {"lat": 22.6544, "lon": 88.3407},
        "Aizawl": {"lat": 23.7271, "lon": 92.7176},
        "Dewas": {"lat": 22.9676, "lon": 76.0534},
        "Ichalkaranji": {"lat": 16.6915, "lon": 74.4597},
        "Karnal": {"lat": 29.6857, "lon": 76.9905},
        "Bathinda": {"lat": 30.2100, "lon": 74.9455},
        "Jalna": {"lat": 19.8347, "lon": 75.8800},
        "Eluru": {"lat": 16.7107, "lon": 81.0952},
        "Barasat": {"lat": 22.7225, "lon": 88.4822},
        "Purnia": {"lat": 25.7771, "lon": 87.4753},
        "Satna": {"lat": 24.6005, "lon": 80.8322},
        "Mau": {"lat": 25.9417, "lon": 83.5611},
        "Sonipat": {"lat": 28.9283, "lon": 77.0919},
        "Farrukhabad": {"lat": 27.3829, "lon": 79.5944},
        "Sagar": {"lat": 23.8388, "lon": 78.7378},
        "Rourkela": {"lat": 22.2604, "lon": 84.8536},
        "Durg": {"lat": 21.1904, "lon": 81.2849},
        "Imphal": {"lat": 24.8170, "lon": 93.9368},
        "Ratlam": {"lat": 23.3342, "lon": 75.0370},
        "Hapur": {"lat": 28.7306, "lon": 77.7759},
        "Arrah": {"lat": 25.5560, "lon": 84.6667},
        "Karimnagar": {"lat": 18.4386, "lon": 79.1288},
        "Anantapur": {"lat": 14.6819, "lon": 77.6006},
        "Etawah": {"lat": 26.7769, "lon": 79.0213},
        "Ambernath": {"lat": 19.1877, "lon": 73.1926},
        "North Dumdum": {"lat": 22.6625, "lon": 88.4194},
        "Bharatpur": {"lat": 27.2173, "lon": 77.4901},
        "Begusarai": {"lat": 25.4187, "lon": 86.1279},
        "New Delhi": {"lat": 28.6139, "lon": 77.2090},
        "Gandhidham": {"lat": 23.0753, "lon": 70.1337},
        "Baranagar": {"lat": 22.6413, "lon": 88.3654},
        "Tiruvottiyur": {"lat": 13.1643, "lon": 80.3006},
        "Puducherry": {"lat": 11.9139, "lon": 79.8145},
        "Sikar": {"lat": 27.6094, "lon": 75.1399},
        "Thoothukudi": {"lat": 8.7642, "lon": 78.1348},
        "Rewa": {"lat": 24.5362, "lon": 81.3037},
        "Mirzapur": {"lat": 25.1460, "lon": 82.5698},
        "Raichur": {"lat": 16.2076, "lon": 77.3463},
        "Pallavaram": {"lat": 12.9675, "lon": 80.1491},
        "Palanpur": {"lat": 24.1724, "lon": 72.4349},
        "Falakata": {"lat": 26.5196, "lon": 89.2040},
        "Sivakasi": {"lat": 9.4571, "lon": 77.7956},
        "Ramagundam": {"lat": 18.7550, "lon": 79.4740},
        "Suryapet": {"lat": 17.1405, "lon": 79.6236},
        "Chittur-Thathamangalam": {"lat": 10.6997, "lon": 76.7386},
        "Vellore": {"lat": 12.9165, "lon": 79.1325},
        "Kavali": {"lat": 14.9132, "lon": 79.9927},
        "Tezpur": {"lat": 26.6528, "lon": 92.7926},
        "Kayamkulam": {"lat": 9.1745, "lon": 76.5009},
        "Kanhangad": {"lat": 12.3094, "lon": 75.0923},
        "Kunnamkulam": {"lat": 10.6497, "lon": 76.0718},
        "Adoni": {"lat": 15.6322, "lon": 77.2749},
        "Udupi": {"lat": 13.3409, "lon": 74.7421},
        "Tenali": {"lat": 16.2430, "lon": 80.6400},
        "Robertsonpet": {"lat": 12.9563, "lon": 78.2754},
        "North Barrackpur": {"lat": 22.7890, "lon": 88.3627},
        "Nagaon": {"lat": 26.3464, "lon": 92.6840},
        "Bangaon": {"lat": 23.0455, "lon": 88.8300},
        "Karawal Nagar": {"lat": 28.7283, "lon": 77.2767},
        "Mandya": {"lat": 12.5223, "lon": 76.8970},
        "Chennai": {"lat": 13.0827, "lon": 80.2707},
    }

    # Try to find exact match first
    if location in mock_locations:
        return mock_locations[location]

    # For unknown locations, generate pseudo-random coordinates within India
    # Using location name hash to create consistent coordinates
    hash_value = 0
    for i in range(len(location)):
        hash_value = ((hash_value << 5) - hash_value) + ord(location[i])
        hash_value = hash_value & 0xFFFFFFFF  # Convert to 32bit integer

    # Generate coordinates within India bounds (roughly)
    lat = 8.4 + (hash_value % 1000) / 1000 * (37.6 - 8.4)  # 8.4°N to 37.6°N
    lon = 68.7 + (hash_value % 1000) / 1000 * (97.25 - 68.7)  # 68.7°E to 97.25°E

    return {"lat": lat, "lon": lon}


PERIOD_LABELS = {
    "today": "Today",
    "yesterday": "Yesterday",
    "7days": "Last 7 days",
    "month": "This month",
    "all": "All time",
}


@router.get("/export")
def export_dashboard(
    period: str = "all",
    clinic_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Everything on the dashboard for this period, as one CSV.

    Synchronous and self-contained on purpose. The existing /dashboard-reports
    pipeline hands off to nexus-service for AI-written PDFs, which is the right
    tool for a monthly report but the wrong one for a button labelled "Export"
    that should hand you a file immediately and work when nexus is down.

    Sections are separated by blank lines so the file stays readable in Excel
    while each block still parses as its own table.
    """
    final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
    clinic = db.query(Clinic).filter(Clinic.id == final_clinic_id).first()

    metrics = get_dashboard_metrics(period=period, clinic_id=clinic_id, db=db, current_user=current_user)
    patient_stats = get_patient_statistics(period=period, clinic_id=clinic_id, db=db, current_user=current_user)
    genders = get_patient_demographics(period=period, clinic_id=clinic_id, db=db, current_user=current_user)
    revenue = get_revenue_analytics(period=period, clinic_id=clinic_id, db=db, current_user=current_user)
    appts = get_appointment_trends(period=period, clinic_id=clinic_id, db=db, current_user=current_user)

    buf = io.StringIO()
    w = csv.writer(buf)

    w.writerow([f"{clinic.name if clinic else 'Clinic'} — dashboard export"])
    w.writerow(["Period", PERIOD_LABELS.get(period, period)])
    w.writerow(["Generated", datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")])
    w.writerow([])

    w.writerow(["Summary"])
    w.writerow(["Metric", "Value", "Change %"])
    w.writerow(["Revenue collected", metrics["revenue"]["value"], metrics["revenue"]["change"]])
    w.writerow(["Revenue billed", metrics["revenue"]["billed"], ""])
    w.writerow(["Total patients", metrics["total_patients"]["value"], metrics["total_patients"]["change"]])
    w.writerow(["Outstanding dues", metrics["outstanding"]["value"], metrics["outstanding"]["change"]])
    w.writerow(["Outstanding invoices", metrics["outstanding"]["invoice_count"], ""])
    w.writerow(["Outstanding over 30 days", metrics["outstanding"]["aged_amount"], ""])
    w.writerow(["Appointments", metrics["appointments"]["value"], metrics["appointments"]["change"]])
    w.writerow(["  Completed", metrics["appointments"]["completed"], ""])
    w.writerow(["  Scheduled", metrics["appointments"]["scheduled"], ""])
    w.writerow(["  No-show / cancelled", metrics["appointments"]["missed"], ""])
    w.writerow([])

    w.writerow(["New vs returning patients"])
    w.writerow(["Period", "New", "Returning"])
    for row in patient_stats:
        w.writerow([row["label"], row["new"], row["returning"]])
    w.writerow([])

    w.writerow(["Patients by gender"])
    w.writerow(["Gender", "Patients"])
    for row in genders:
        w.writerow([row["name"], row["value"]])
    w.writerow([])

    w.writerow(["Revenue"])
    w.writerow(["Period", "Billed", "Collected"])
    for row in revenue:
        w.writerow([row["label"], row["billed"], row["collected"]])
    w.writerow([])

    w.writerow(["Appointment outcomes"])
    w.writerow(["Period", "Completed", "Scheduled", "No-show / cancelled", "Total"])
    for row in appts:
        w.writerow([row["time"], row["completed"], row["scheduled"], row["missed"], row["bookings"]])

    slug = "".join(c if c.isalnum() else "-" for c in (clinic.name if clinic else "clinic")).strip("-").lower()
    filename = f"{slug}-dashboard-{period}-{datetime.utcnow():%Y%m%d}.csv"

    # BOM so Excel opens rupee amounts and patient names as UTF-8 instead of
    # mangling them into Latin-1.
    return Response(
        content="﻿" + buf.getvalue(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
