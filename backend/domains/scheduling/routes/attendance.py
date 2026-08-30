from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import List, Optional
from datetime import datetime, timedelta, date
from calendar import monthrange
from html import escape as html_escape
import csv
import io
import os

from database import get_db
from models import Attendance, User, Clinic
from core.auth_utils import get_current_user
from core.clinic_time import clinic_today
from schemas import AttendanceOut, AttendanceCreate, AttendanceUpdate
from domains.scheduling.services.attendance_view import (
    serialize_day,
    summarise,
    fmt_duration,
    day_keys,
)

router = APIRouter()

# How far a single request may reach. A year of days across a large team is a
# lot of rows to build in memory and a lot of columns to draw, and nobody asks
# for it deliberately — it is what a mistyped date range looks like.
MAX_RANGE_DAYS = 366


def _parse_day(value: str, field: str) -> date:
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        raise HTTPException(status_code=400, detail=f"{field} must be YYYY-MM-DD")


def _clinic_of(db: Session, current_user: User) -> Clinic:
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


def _build_range(db: Session, clinic: Clinic, start: date, end: date,
                 user_id: Optional[int] = None) -> dict:
    """Every employee's attendance across [start, end], day by day.

    The one loader behind the week grid, the month grid and both exports, so
    the four can never disagree about what a day says.

    A day is one of three things, and the difference is load-bearing for the UI:
      None  the day is in the future — nothing to mark yet
      {}    past or present, no record — the empty cell that invites a mark
      {...} a record, serialized by attendance_view.serialize_day
    """
    if start > end:
        raise HTTPException(status_code=400, detail="start must be on or before end")
    if (end - start).days + 1 > MAX_RANGE_DAYS:
        raise HTTPException(
            status_code=400,
            detail=f"Range too large. Ask for {MAX_RANGE_DAYS} days or fewer.",
        )

    employees_q = db.query(User).filter(
        User.clinic_id == clinic.id,
        User.is_active == True,  # noqa: E712
    )
    if user_id:
        employees_q = employees_q.filter(User.id == user_id)
    employees = employees_q.order_by(User.name.asc()).all()

    # Records are bucketed by the `date` column, which both write paths store as
    # midnight of the calendar day. The end bound is exclusive of the day after,
    # so the whole of `end` is included.
    records_q = db.query(Attendance).filter(
        Attendance.clinic_id == clinic.id,
        Attendance.date >= datetime.combine(start, datetime.min.time()),
        Attendance.date < datetime.combine(end + timedelta(days=1), datetime.min.time()),
    )
    if user_id:
        records_q = records_q.filter(Attendance.user_id == user_id)
    records = records_q.all()

    # Names for the "marked by" line, fetched once rather than per record.
    marker_ids = {r.marked_by for r in records if r.marked_by}
    user_names = {}
    if marker_ids:
        user_names = {
            u.id: u.name
            for u in db.query(User).filter(User.id.in_(marker_ids)).all()
        }

    by_user: dict = {}
    for record in records:
        key = record.date.strftime("%Y-%m-%d")
        # A day can hold more than one row: the phone opens a fresh record on a
        # second clock-in after a clock-out. The one still open wins, otherwise
        # the latest, so a day that is still running never reads as finished.
        bucket = by_user.setdefault(record.user_id, {})
        existing = bucket.get(key)
        if existing is None or _supersedes(record, existing):
            bucket[key] = record

    today = clinic_today(clinic)
    keys = day_keys(start, end)

    out = []
    for employee in employees:
        rows = by_user.get(employee.id, {})
        attendance = {}
        for key in keys:
            if datetime.strptime(key, "%Y-%m-%d").date() > today:
                attendance[key] = None
                continue
            record = rows.get(key)
            attendance[key] = serialize_day(record, clinic, user_names) if record else {}
        out.append({
            "id": employee.id,
            "name": employee.name,
            "email": employee.email,
            "role": employee.role,
            "phone": employee.phone,
            "avatar_url": employee.avatar_url,
            "attendance": attendance,
            "summary": summarise(list(attendance.values())),
        })

    return {
        "start": start.strftime("%Y-%m-%d"),
        "end": end.strftime("%Y-%m-%d"),
        "days": keys,
        "employees": out,
    }


def _supersedes(candidate: Attendance, current: Attendance) -> bool:
    """Which of two records for the same day should be shown."""
    candidate_open = candidate.check_in_time and not candidate.check_out_time
    current_open = current.check_in_time and not current.check_out_time
    if candidate_open != current_open:
        return bool(candidate_open)
    return (candidate.updated_at or candidate.created_at or datetime.min) >= (
        current.updated_at or current.created_at or datetime.min
    )

@router.get("", response_model=List[AttendanceOut])
def get_attendance(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    user_id: Optional[int] = Query(None, description="Filter by user ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance records for the current clinic"""
    try:
        query = db.query(Attendance).filter(Attendance.clinic_id == current_user.clinic_id)
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
            query = query.filter(Attendance.date >= start_dt)
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d") + timedelta(days=1)
            query = query.filter(Attendance.date < end_dt)
        
        if user_id:
            query = query.filter(Attendance.user_id == user_id)
        
        attendance_records = query.order_by(Attendance.date.desc()).all()
        
        # Enrich with user info
        result = []
        for record in attendance_records:
            user = db.query(User).filter(User.id == record.user_id).first()
            attendance_dict = {
                'id': record.id,
                'clinic_id': record.clinic_id,
                'user_id': record.user_id,
                'date': record.date,
                'status': record.status,
                'check_in_time': record.check_in_time,
                'check_out_time': record.check_out_time,
                'reason': record.reason,
                'notes': record.notes,
                'marked_by': record.marked_by,
                'created_at': record.created_at,
                'updated_at': record.updated_at,
                'user_name': user.name if user else None,
                'user_role': user.role if user else None,
            }
            result.append(AttendanceOut(**attendance_dict))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching attendance: {str(e)}")

@router.get("/employees", response_model=List[dict])
def get_employees(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all employees (users) for the current clinic"""
    try:
        # Check if user has a clinic_id
        if not current_user.clinic_id:
            return []
        
        users = db.query(User).filter(
            User.clinic_id == current_user.clinic_id,
            User.is_active == True
        ).all()
        
        result = []
        for user in users:
            result.append({
                'id': user.id,
                'name': user.name,
                'email': user.email,
                'role': user.role,
                'phone': user.phone,
                'avatar_url': user.avatar_url,
            })
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching employees: {str(e)}")

@router.get("/week", response_model=dict)
def get_attendance_week(
    week_start: str = Query(..., description="Week start date (YYYY-MM-DD)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """One week, Monday to Sunday. A thin wrapper over the range loader.

    Kept as its own route because the web grid has always called it, and it now
    returns the same per-day shape as /calendar rather than the status-and-reason
    pair it used to. That pair was why an owner could see that somebody was
    present but not when they arrived, how long they stayed, or whether the
    record came from their phone or from the front desk.
    """
    if not current_user.clinic_id:
        return {"week_start": week_start, "employees": []}

    clinic = _clinic_of(db, current_user)
    start = _parse_day(week_start, "week_start")
    payload = _build_range(db, clinic, start, start + timedelta(days=6))
    payload["week_start"] = week_start
    return payload


@router.get("/calendar", response_model=dict)
def get_attendance_calendar(
    start: Optional[str] = Query(None, description="First day (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="Last day, inclusive (YYYY-MM-DD)"),
    month: Optional[str] = Query(None, description="Whole month, as YYYY-MM"),
    user_id: Optional[int] = Query(None, description="Limit to one employee"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Any date range, day by day. Backs both the week and the month view.

    `month=YYYY-MM` is shorthand for that month's first to last day, so the
    caller does not have to know how long February is this year.
    """
    if not current_user.clinic_id:
        return {"start": start, "end": end, "days": [], "employees": []}

    clinic = _clinic_of(db, current_user)
    first, last = _resolve_range(start, end, month)
    return _build_range(db, clinic, first, last, user_id)


def _resolve_range(start: Optional[str], end: Optional[str], month: Optional[str]):
    """Turn the three ways of asking for a range into one pair of dates."""
    if month:
        try:
            year_s, month_s = month.split("-")[:2]
            year, mon = int(year_s), int(month_s)
            first = date(year, mon, 1)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="month must be YYYY-MM")
        return first, date(year, mon, monthrange(year, mon)[1])

    if not start or not end:
        raise HTTPException(
            status_code=400,
            detail="Provide either month=YYYY-MM or both start and end.",
        )
    return _parse_day(start, "start"), _parse_day(end, "end")


@router.get("/export")
def export_attendance(
    start: Optional[str] = Query(None, description="First day (YYYY-MM-DD)"),
    end: Optional[str] = Query(None, description="Last day, inclusive (YYYY-MM-DD)"),
    month: Optional[str] = Query(None, description="Whole month, as YYYY-MM"),
    user_id: Optional[int] = Query(None, description="Limit to one employee"),
    format: str = Query("csv", description="csv | pdf"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """The attendance register as a file.

    CSV is one row per employee per day, with the clock-in detail spread across
    columns — the shape you sort and total in a spreadsheet when working out
    payroll. PDF is the grid as it looks on screen plus a per-employee summary,
    which is the shape you print, sign and file.
    """
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")

    clinic = _clinic_of(db, current_user)
    first, last = _resolve_range(start, end, month)
    data = _build_range(db, clinic, first, last, user_id)

    span = (
        first.strftime("%d %b %Y")
        if first == last
        else f"{first.strftime('%d %b %Y')} to {last.strftime('%d %b %Y')}"
    )
    fname = f"attendance-{first.isoformat()}-to-{last.isoformat()}"

    if (format or "csv").lower() == "pdf":
        from domains.infrastructure.services.pdf_service import html_template_to_pdf
        from core.clinic_time import clinic_now

        generated_at = clinic_now(clinic).strftime("%d %b %Y at %I:%M %p").lstrip("0")
        generated_by = getattr(current_user, "name", None) or getattr(current_user, "email", "") or ""
        html = _attendance_sheet_html(clinic, span, data, generated_at, generated_by)
        try:
            pdf_path = html_template_to_pdf(html)
            with open(pdf_path, "rb") as fh:
                pdf_bytes = fh.read()
            try:
                os.remove(pdf_path)
            except OSError:
                pass
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Could not build the attendance PDF: {e}")
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{fname}.pdf"'},
        )

    return Response(
        content=_attendance_csv(clinic, span, data),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{fname}.csv"'},
    )


# ── Export renderers ─────────────────────────────────────────────────────────

_STATUS_LABELS = {
    "on_time": "Present",
    "late": "Late",
    "absent": "Absent",
    "holiday": "Holiday",
}


def _status_label(day: dict) -> str:
    """What a cell says. An unmarked past day is 'Not marked', not blank — a
    blank in an exported register reads as a printing fault."""
    if day is None:
        return ""
    if not day:
        return "Not marked"
    return _STATUS_LABELS.get(day.get("status"), day.get("status") or "Not marked")


def _attendance_csv(clinic, span: str, data: dict) -> str:
    """One row per employee per day. Long rather than wide on purpose: a grid
    with a column per date cannot be filtered or pivoted, and a month of it does
    not fit on a screen."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow([f"Attendance register — {clinic.name or 'Clinic'} — {span}"])
    w.writerow([])
    w.writerow([
        "Date", "Employee", "Role", "Status", "Clock in", "Clock out",
        "Hours worked", "Opens at", "Late by (min)", "Recorded by",
        "Marked by", "Distance at clock-in (m)", "GPS accuracy (m)",
        "Outside clinic area", "Clock-in location", "Reason", "Notes",
    ])

    for emp in data["employees"]:
        for key in data["days"]:
            day = emp["attendance"].get(key)
            if day is None:          # future — nothing happened yet
                continue
            clock_in = (day.get("clock_in") or {}) if day else {}
            w.writerow([
                key,
                emp["name"] or "",
                emp["role"] or "",
                _status_label(day),
                day.get("check_in") or "" if day else "",
                (day.get("check_out") or ("Still clocked in" if day.get("is_open_shift") else "")) if day else "",
                fmt_duration(day.get("worked_minutes")) if day else "",
                day.get("expected_open") or "" if day else "",
                "" if not day or day.get("late_by_minutes") is None else day["late_by_minutes"],
                (("Phone" if day.get("source") == "mobile" else "Marked manually") if day else ""),
                day.get("marked_by_name") or "" if day else "",
                "" if not clock_in.get("distance_m") else round(clock_in["distance_m"]),
                "" if not clock_in.get("accuracy_m") else round(clock_in["accuracy_m"]),
                "" if not clock_in or clock_in.get("outside_geofence") is None
                else ("Yes" if clock_in["outside_geofence"] else "No"),
                clock_in.get("address") or "",
                day.get("reason") or "" if day else "",
                day.get("notes") or "" if day else "",
            ])

    w.writerow([])
    w.writerow(["Summary"])
    w.writerow(["Employee", "Days marked", "Present", "On time", "Late",
                "Absent", "Total hours", "Total late (min)"])
    for emp in data["employees"]:
        sm = emp["summary"]
        w.writerow([
            emp["name"] or "", sm["marked_days"], sm["present"], sm["on_time"],
            sm["late"], sm["absent"], fmt_duration(sm["worked_minutes"]) or "0h 00m",
            sm["total_late_minutes"],
        ])

    return buf.getvalue()


def _attendance_sheet_html(clinic, span: str, data: dict,
                           generated_at: str = "", generated_by: str = "") -> str:
    """Printable register on A4 landscape.

    Landscape because this is a grid with a column per day; portrait would fit
    about ten days before the columns became unreadable. WeasyPrint-safe HTML
    only: tables, no flex gap, no grid.
    """
    clinic_name = html_escape(clinic.name or "Clinic")
    days = data["days"]

    # A month of columns is already tight on landscape A4, so the header is the
    # day number with the weekday initial under it rather than a full date.
    head_cells = ""
    for key in days:
        d = datetime.strptime(key, "%Y-%m-%d").date()
        head_cells += (
            f'<th class="d"><span class="dn">{d.day}</span>'
            f'<span class="dw">{d.strftime("%a")[0]}</span></th>'
        )

    body_rows = ""
    for emp in data["employees"]:
        cells = ""
        for key in days:
            day = emp["attendance"].get(key)
            if day is None:
                cells += '<td class="c future">·</td>'
            elif not day:
                cells += '<td class="c none">–</td>'
            else:
                status = day.get("status") or ""
                mark = {"on_time": "P", "late": "L", "absent": "A", "holiday": "H"}.get(status, "?")
                times = day.get("check_in") or ""
                if day.get("check_out"):
                    times += f'–{day["check_out"]}'
                elif day.get("is_open_shift"):
                    times += "–…"
                phone = "" if day.get("source") == "mobile" else '<span class="m">m</span>'
                cells += (
                    f'<td class="c {status}"><span class="mk">{mark}</span>{phone}'
                    f'<span class="t">{html_escape(times)}</span></td>'
                )
        sm = emp["summary"]
        body_rows += (
            f'<tr><td class="emp">{html_escape(emp["name"] or "")}'
            f'<span class="role">{html_escape(emp["role"] or "")}</span></td>'
            f'{cells}'
            f'<td class="sum">{sm["present"]}/{sm["marked_days"]}</td>'
            f'<td class="sum">{html_escape(fmt_duration(sm["worked_minutes"]) or "0h 00m")}</td></tr>'
        )

    if not data["employees"]:
        body_rows = (
            f'<tr><td class="empty" colspan="{len(days) + 3}">'
            f'No active employees in this clinic.</td></tr>'
        )

    footer_bits = " · ".join(filter(None, [
        f"Generated {html_escape(generated_at)}" if generated_at else "",
        f"by {html_escape(generated_by)}" if generated_by else "",
    ]))

    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Attendance — {clinic_name}</title>
<style>
  @page {{ size: A4 landscape; margin: 12mm 10mm; }}
  body {{ font-family: Helvetica, Arial, sans-serif; color: #111; font-size: 8pt; margin: 0; }}
  h1 {{ font-size: 14pt; margin: 0 0 2px; }}
  .sub {{ color: #555; font-size: 8.5pt; margin: 0 0 10px; }}
  table {{ width: 100%; border-collapse: collapse; }}
  th, td {{ border: 1px solid #d8dde3; padding: 3px 2px; text-align: center; vertical-align: middle; }}
  th {{ background: #f2f5f7; font-size: 7.5pt; font-weight: bold; }}
  th.d .dn {{ display: block; font-size: 8pt; }}
  th.d .dw {{ display: block; color: #778; font-size: 6.5pt; font-weight: normal; }}
  td.emp {{ text-align: left; font-weight: bold; white-space: nowrap; padding: 4px 6px; }}
  td.emp .role {{ display: block; font-weight: normal; color: #778; font-size: 6.5pt; text-transform: capitalize; }}
  th.emp-h, td.sum {{ white-space: nowrap; }}
  td.c {{ width: 20px; }}
  td.c .mk {{ display: block; font-weight: bold; font-size: 8pt; }}
  td.c .t {{ display: block; color: #555; font-size: 5.6pt; }}
  td.c .m {{ display: block; color: #8a6d1f; font-size: 5.6pt; }}
  td.on_time {{ background: #eafaf1; }}
  td.late    {{ background: #fdf6e3; }}
  td.absent  {{ background: #fdeeee; }}
  td.holiday {{ background: #eef1f4; }}
  td.none, td.future {{ color: #bbb; }}
  td.sum {{ background: #f7f9fb; font-weight: bold; }}
  td.empty {{ padding: 18px; color: #666; }}
  .legend {{ margin-top: 8px; color: #555; font-size: 7pt; }}
  .foot {{ margin-top: 10px; color: #888; font-size: 7pt; }}
</style></head>
<body>
  <h1>Attendance register</h1>
  <p class="sub">{clinic_name} · {html_escape(span)}</p>
  <table>
    <thead><tr>
      <th class="emp-h">Employee</th>{head_cells}
      <th>Present</th><th>Hours</th>
    </tr></thead>
    <tbody>{body_rows}</tbody>
  </table>
  <p class="legend">
    P present · L late · A absent · H holiday · – not marked · · future day.
    Times under each mark are clock-in and clock-out. A trailing … means the
    shift was never clocked out. An <strong>m</strong> means the day was marked
    by hand rather than clocked in from a phone.
  </p>
  <p class="foot">{footer_bits}</p>
</body></html>"""


@router.post("", response_model=AttendanceOut, status_code=201)
def create_attendance(
    attendance: AttendanceCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create or update an attendance record"""
    try:
        # Check if user belongs to the clinic
        user = db.query(User).filter(
            User.id == attendance.user_id,
            User.clinic_id == current_user.clinic_id
        ).first()
        
        if not user:
            raise HTTPException(status_code=404, detail="Employee not found")
        
        # Check if attendance record already exists for this date
        date_start = attendance.date.replace(hour=0, minute=0, second=0, microsecond=0)
        date_end = date_start + timedelta(days=1)
        
        existing = db.query(Attendance).filter(
            Attendance.clinic_id == current_user.clinic_id,
            Attendance.user_id == attendance.user_id,
            Attendance.date >= date_start,
            Attendance.date < date_end
        ).first()
        
        if existing:
            # Only overwrite what the caller actually sent.
            #
            # This used to assign every field unconditionally, and check_in_time
            # and check_out_time default to None on the request model. The web
            # grid does not send them — it sends a status and a reason — so
            # marking somebody "late" silently erased the clock-in and clock-out
            # their phone had recorded. That went unnoticed while the web screen
            # showed neither. It shows both now, which means an owner opening a
            # day to look at it and pressing Save would have destroyed the very
            # record they came to read.
            #
            # exclude_unset distinguishes "not sent" from "sent as null", so
            # clearing a time deliberately still works.
            sent = attendance.dict(exclude_unset=True)
            for field in ("status", "check_in_time", "check_out_time", "reason", "notes"):
                if field in sent:
                    setattr(existing, field, sent[field])
            existing.marked_by = current_user.id
            existing.updated_at = datetime.utcnow()
            db.commit()
            db.refresh(existing)
            
            attendance_dict = {
                'id': existing.id,
                'clinic_id': existing.clinic_id,
                'user_id': existing.user_id,
                'date': existing.date,
                'status': existing.status,
                'check_in_time': existing.check_in_time,
                'check_out_time': existing.check_out_time,
                'reason': existing.reason,
                'notes': existing.notes,
                'marked_by': existing.marked_by,
                'created_at': existing.created_at,
                'updated_at': existing.updated_at,
                'user_name': user.name,
                'user_role': user.role,
            }
            return AttendanceOut(**attendance_dict)
        else:
            # Create new record
            new_attendance = Attendance(
                clinic_id=current_user.clinic_id,
                user_id=attendance.user_id,
                date=attendance.date,
                status=attendance.status,
                check_in_time=attendance.check_in_time,
                check_out_time=attendance.check_out_time,
                reason=attendance.reason,
                notes=attendance.notes,
                marked_by=current_user.id
            )
            db.add(new_attendance)
            db.commit()
            db.refresh(new_attendance)
            
            attendance_dict = {
                'id': new_attendance.id,
                'clinic_id': new_attendance.clinic_id,
                'user_id': new_attendance.user_id,
                'date': new_attendance.date,
                'status': new_attendance.status,
                'check_in_time': new_attendance.check_in_time,
                'check_out_time': new_attendance.check_out_time,
                'reason': new_attendance.reason,
                'notes': new_attendance.notes,
                'marked_by': new_attendance.marked_by,
                'created_at': new_attendance.created_at,
                'updated_at': new_attendance.updated_at,
                'user_name': user.name,
                'user_role': user.role,
            }
            return AttendanceOut(**attendance_dict)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating attendance: {str(e)}")

@router.put("/{attendance_id}", response_model=AttendanceOut)
def update_attendance(
    attendance_id: int,
    attendance_update: AttendanceUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an attendance record"""
    try:
        attendance = db.query(Attendance).filter(
            Attendance.id == attendance_id,
            Attendance.clinic_id == current_user.clinic_id
        ).first()
        
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        update_data = attendance_update.dict(exclude_unset=True)
        for key, value in update_data.items():
            setattr(attendance, key, value)
        
        attendance.marked_by = current_user.id
        attendance.updated_at = datetime.utcnow()
        
        db.commit()
        db.refresh(attendance)
        
        user = db.query(User).filter(User.id == attendance.user_id).first()
        attendance_dict = {
            'id': attendance.id,
            'clinic_id': attendance.clinic_id,
            'user_id': attendance.user_id,
            'date': attendance.date,
            'status': attendance.status,
            'check_in_time': attendance.check_in_time,
            'check_out_time': attendance.check_out_time,
            'reason': attendance.reason,
            'notes': attendance.notes,
            'marked_by': attendance.marked_by,
            'created_at': attendance.created_at,
            'updated_at': attendance.updated_at,
            'user_name': user.name if user else None,
            'user_role': user.role if user else None,
        }
        return AttendanceOut(**attendance_dict)
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating attendance: {str(e)}")

@router.delete("/{attendance_id}", status_code=204)
def delete_attendance(
    attendance_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an attendance record"""
    try:
        attendance = db.query(Attendance).filter(
            Attendance.id == attendance_id,
            Attendance.clinic_id == current_user.clinic_id
        ).first()
        
        if not attendance:
            raise HTTPException(status_code=404, detail="Attendance record not found")
        
        db.delete(attendance)
        db.commit()
        return None
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting attendance: {str(e)}")



