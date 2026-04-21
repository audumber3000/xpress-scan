"""
Report stats service — computes real DB stats for weekly/monthly/review WA report templates.

Each function returns a dict whose keys map 1-to-1 to the template body params.
All date arithmetic uses UTC; caller passes `today` as a date object.
"""

import datetime as dt
from collections import Counter
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import Appointment, Invoice, InvoiceLineItem, Patient, GooglePlaceLink, GoogleReview


def _fmt_change(current: float, previous: float) -> str:
    """Returns '▲12%', '▼5%', or '—' (no change / no prior data)."""
    if not previous:
        return "—"
    pct = round((current - previous) / previous * 100)
    if pct > 0:
        return f"▲{pct}%"
    elif pct < 0:
        return f"▼{abs(pct)}%"
    return "—"


def _week_bounds(today: dt.date) -> tuple[dt.datetime, dt.datetime]:
    """Mon 00:00 → Sun 23:59:59 of the most-recently-completed week (Mon–Sun)."""
    # today is Monday (weekday 0) when automation runs; last week = 7 days back
    week_start = today - dt.timedelta(days=7)
    week_end = today - dt.timedelta(seconds=1)  # just before current Monday midnight
    return (
        dt.datetime.combine(week_start, dt.time.min),
        dt.datetime.combine(today, dt.time.min),
    )


def _month_bounds(month_offset: int, today: dt.date) -> tuple[dt.datetime, dt.datetime]:
    """Start and end of a calendar month. offset=0 → current month, offset=1 → last month."""
    year, month = today.year, today.month
    for _ in range(month_offset):
        month -= 1
        if month == 0:
            month = 12
            year -= 1
    start = dt.datetime(year, month, 1)
    if month == 12:
        end = dt.datetime(year + 1, 1, 1)
    else:
        end = dt.datetime(year, month + 1, 1)
    return start, end


# ─── Weekly stats ─────────────────────────────────────────────────────────────

def get_weekly_stats(db: Session, clinic_id: int, today: dt.date) -> dict:
    """
    Returns dict for molarplus_weekly_report_mk body params:
      week_date, appointments, appt_change, new_patients, patients_change,
      revenue, revenue_change, noshows, insight
    """
    w_start, w_end = _week_bounds(today)
    pw_start = w_start - dt.timedelta(days=7)
    pw_end = w_start

    def appt_count(start, end):
        return (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.clinic_id == clinic_id,
                Appointment.appointment_date >= start,
                Appointment.appointment_date < end,
                Appointment.status != "cancelled",
            )
            .scalar() or 0
        )

    def noshow_count(start, end):
        return (
            db.query(func.count(Appointment.id))
            .filter(
                Appointment.clinic_id == clinic_id,
                Appointment.appointment_date >= start,
                Appointment.appointment_date < end,
                Appointment.status == "no-show",
            )
            .scalar() or 0
        )

    def new_patient_count(start, end):
        return (
            db.query(func.count(Patient.id))
            .filter(
                Patient.clinic_id == clinic_id,
                Patient.created_at >= start,
                Patient.created_at < end,
            )
            .scalar() or 0
        )

    def revenue_sum(start, end):
        return (
            db.query(func.coalesce(func.sum(Invoice.total), 0.0))
            .filter(
                Invoice.clinic_id == clinic_id,
                Invoice.finalized_at >= start,
                Invoice.finalized_at < end,
                Invoice.status.notin_(["draft", "cancelled"]),
            )
            .scalar() or 0.0
        )

    appts = appt_count(w_start, w_end)
    prev_appts = appt_count(pw_start, pw_end)
    new_pts = new_patient_count(w_start, w_end)
    prev_new_pts = new_patient_count(pw_start, pw_end)
    rev = revenue_sum(w_start, w_end)
    prev_rev = revenue_sum(pw_start, pw_end)
    noshows = noshow_count(w_start, w_end)

    # Simple insight string
    if appts >= prev_appts and rev >= prev_rev:
        insight = "Great week! Keep it up."
    elif appts < prev_appts and rev < prev_rev:
        insight = "Slower week — consider follow-ups."
    else:
        insight = "Mixed results — check details."

    week_label = w_start.strftime("%d %b %Y")

    return {
        "week_date": week_label,
        "appointments": str(appts),
        "appt_change": _fmt_change(appts, prev_appts),
        "new_patients": str(new_pts),
        "patients_change": _fmt_change(new_pts, prev_new_pts),
        "revenue": f"{rev:,.0f}",
        "revenue_change": _fmt_change(rev, prev_rev),
        "noshows": str(noshows),
        "insight": insight,
    }


# ─── Monthly stats ────────────────────────────────────────────────────────────

def get_monthly_stats(db: Session, clinic_id: int, today: dt.date) -> dict:
    """
    Returns dict for molarplus_monthly_report_mk body params:
      month, total_patients, new_patients, returning_patients, total_revenue,
      avg_revenue, change, top_treatments, noshows, noshows_pct
    """
    m_start, m_end = _month_bounds(1, today)   # last completed month
    pm_start, pm_end = _month_bounds(2, today)  # month before that
    month_label = m_start.strftime("%B %Y")

    total_appts = (
        db.query(func.count(Appointment.id))
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= m_start,
            Appointment.appointment_date < m_end,
            Appointment.status != "cancelled",
        )
        .scalar() or 0
    )

    noshows = (
        db.query(func.count(Appointment.id))
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= m_start,
            Appointment.appointment_date < m_end,
            Appointment.status == "no-show",
        )
        .scalar() or 0
    )

    new_pts = (
        db.query(func.count(Patient.id))
        .filter(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= m_start,
            Patient.created_at < m_end,
        )
        .scalar() or 0
    )

    # Total unique patients who had an appointment this month
    total_pts_rows = (
        db.query(Appointment.patient_id)
        .filter(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= m_start,
            Appointment.appointment_date < m_end,
            Appointment.status != "cancelled",
            Appointment.patient_id.isnot(None),
        )
        .distinct()
        .count()
    )
    returning_pts = max(0, total_pts_rows - new_pts)

    rev = (
        db.query(func.coalesce(func.sum(Invoice.total), 0.0))
        .filter(
            Invoice.clinic_id == clinic_id,
            Invoice.finalized_at >= m_start,
            Invoice.finalized_at < m_end,
            Invoice.status.notin_(["draft", "cancelled"]),
        )
        .scalar() or 0.0
    )

    prev_rev = (
        db.query(func.coalesce(func.sum(Invoice.total), 0.0))
        .filter(
            Invoice.clinic_id == clinic_id,
            Invoice.finalized_at >= pm_start,
            Invoice.finalized_at < pm_end,
            Invoice.status.notin_(["draft", "cancelled"]),
        )
        .scalar() or 0.0
    )

    avg_rev = round(rev / total_pts_rows) if total_pts_rows else 0

    # Top 3 treatments by line item frequency
    line_items = (
        db.query(InvoiceLineItem.description)
        .join(Invoice, Invoice.id == InvoiceLineItem.invoice_id)
        .filter(
            Invoice.clinic_id == clinic_id,
            Invoice.finalized_at >= m_start,
            Invoice.finalized_at < m_end,
            Invoice.status.notin_(["draft", "cancelled"]),
        )
        .all()
    )
    counts = Counter(r[0] for r in line_items if r[0])
    top3 = [name for name, _ in counts.most_common(3)]
    top_treatments = ", ".join(top3) if top3 else "—"

    noshows_pct = round(noshows / total_appts * 100) if total_appts else 0

    return {
        "month": month_label,
        "total_patients": str(total_pts_rows),
        "new_patients": str(new_pts),
        "returning_patients": str(returning_pts),
        "total_revenue": f"{rev:,.0f}",
        "avg_revenue": f"{avg_rev:,.0f}",
        "change": _fmt_change(rev, prev_rev),
        "top_treatments": top_treatments,
        "noshows": str(noshows),
        "noshows_pct": str(noshows_pct),
    }


# ─── Review stats ─────────────────────────────────────────────────────────────

_POSITIVE_KEYWORDS = [
    ("Friendly staff", ["friendly", "staff", "team", "helpful", "polite", "kind"]),
    ("Clean clinic", ["clean", "hygienic", "neat", "tidy", "sanitized"]),
    ("Quick service", ["quick", "fast", "prompt", "efficient", "wait"]),
    ("Painless treatment", ["painless", "comfortable", "gentle", "no pain"]),
    ("Good doctor", ["doctor", "dentist", "expertise", "skilled", "knowledgeable"]),
    ("Affordable", ["affordable", "price", "cost", "value", "cheap"]),
]

_NEGATIVE_KEYWORDS = [
    ("Waiting time", ["wait", "slow", "late", "delay", "long"]),
    ("Communication", ["communication", "response", "inform", "update"]),
    ("Billing", ["billing", "bill", "overcharge", "expensive"]),
]


def _match_themes(reviews: list[str], theme_list: list[tuple]) -> list[str]:
    matched = []
    for label, keywords in theme_list:
        if any(kw in r.lower() for r in reviews for kw in keywords):
            matched.append(label)
    return matched


def get_review_stats(db: Session, clinic_id: int, today: dt.date) -> dict:
    """
    Returns dict for molarplus_review_report_mk body params:
      month, rating, new_reviews, change, loved1, loved2, area_to_watch
    """
    m_start, m_end = _month_bounds(1, today)
    pm_start, pm_end = _month_bounds(2, today)
    month_label = m_start.strftime("%B %Y")

    place_link: Optional[GooglePlaceLink] = (
        db.query(GooglePlaceLink)
        .filter(GooglePlaceLink.clinic_id == clinic_id)
        .first()
    )

    current_rating = f"{place_link.current_rating:.1f}" if place_link and place_link.current_rating else "—"

    new_reviews = (
        db.query(func.count(GoogleReview.id))
        .filter(
            GoogleReview.clinic_id == clinic_id,
            GoogleReview.review_time >= m_start,
            GoogleReview.review_time < m_end,
        )
        .scalar() or 0
    )

    prev_reviews = (
        db.query(func.count(GoogleReview.id))
        .filter(
            GoogleReview.clinic_id == clinic_id,
            GoogleReview.review_time >= pm_start,
            GoogleReview.review_time < pm_end,
        )
        .scalar() or 0
    )

    change = _fmt_change(new_reviews, prev_reviews)
    if new_reviews > prev_reviews:
        diff = new_reviews - prev_reviews
        change = f"▲{diff} vs last month"
    elif new_reviews < prev_reviews:
        diff = prev_reviews - new_reviews
        change = f"▼{diff} vs last month"
    else:
        change = "Same as last month"

    # Positive + negative theme extraction from this month's review texts
    review_texts = [
        r[0] or ""
        for r in db.query(GoogleReview.text)
        .filter(
            GoogleReview.clinic_id == clinic_id,
            GoogleReview.review_time >= m_start,
            GoogleReview.review_time < m_end,
            GoogleReview.rating >= 4,
        )
        .all()
    ]

    pos_themes = _match_themes(review_texts, _POSITIVE_KEYWORDS)
    loved1 = pos_themes[0] if len(pos_themes) > 0 else "Overall experience"
    loved2 = pos_themes[1] if len(pos_themes) > 1 else "Treatment quality"

    neg_texts = [
        r[0] or ""
        for r in db.query(GoogleReview.text)
        .filter(
            GoogleReview.clinic_id == clinic_id,
            GoogleReview.review_time >= m_start,
            GoogleReview.review_time < m_end,
            GoogleReview.rating <= 3,
        )
        .all()
    ]
    neg_themes = _match_themes(neg_texts, _NEGATIVE_KEYWORDS)
    area_to_watch = neg_themes[0] if neg_themes else "No issues flagged"

    return {
        "month": month_label,
        "rating": current_rating,
        "new_reviews": str(new_reviews),
        "change": change,
        "loved1": loved1,
        "loved2": loved2,
        "area_to_watch": area_to_watch,
    }
