from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Appointment, Patient, User, Clinic, CasePaper
from sqlalchemy import and_, or_, cast, Date
from datetime import datetime, timedelta
from typing import List, Optional
from core.posthog_client import track_event, EVENTS
from core.auth_utils import get_current_user, require_doctor_or_owner
from core.notification_dispatch import notify_event, fmt_appt_time
from domains.scheduling.availability import check_available, find_conflict
from domains.scheduling.appointment_status import (
    ALL_STATUSES, OPEN_STATUSES, TERMINAL_STATUSES, CANCELLED, NO_SHOW,
    COMPLETED, ARRIVED, CONFIRMED, SCHEDULED, normalize_status, is_terminal,
)
from pydantic import BaseModel, field_validator
import json
import logging

logger = logging.getLogger(__name__)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Pydantic schemas
class AppointmentCreate(BaseModel):
    patient_id: Optional[int] = None
    patient_name: str
    patient_email: Optional[str] = None
    patient_phone: Optional[str] = None
    clinic_id: Optional[int] = None  # Authenticated create uses the user's clinic; public booking resolves it from the URL code
    doctor_id: Optional[int] = None
    treatment: Optional[str] = None
    appointment_date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    duration: int = 60
    status: str = SCHEDULED
    notes: Optional[str] = None
    chair_number: Optional[str] = None
    patient_age: Optional[int] = None

class AppointmentUpdate(BaseModel):
    patient_id: Optional[int] = None
    patient_name: Optional[str] = None
    patient_email: Optional[str] = None
    patient_phone: Optional[str] = None
    doctor_id: Optional[int] = None
    treatment: Optional[str] = None
    appointment_date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    duration: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    chair_number: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_village: Optional[str] = None
    patient_referred_by: Optional[str] = None
    rejection_reason: Optional[str] = None

class AppointmentOut(BaseModel):
    id: int
    clinic_id: int
    patient_id: Optional[int]
    patient_name: str
    patient_email: Optional[str]
    patient_phone: Optional[str]
    doctor_id: Optional[int]
    doctor_name: Optional[str]
    treatment: Optional[str] = None
    appointment_date: str
    start_time: str
    end_time: str
    duration: int
    status: str
    notes: Optional[str]
    chair_number: Optional[str] = None
    patient_age: Optional[int] = None
    patient_gender: Optional[str] = None
    patient_village: Optional[str] = None
    patient_referred_by: Optional[str] = None
    visit_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    # Optional, not `str = "local"`. A default only applies when the field is
    # ABSENT; a stored NULL is still passed in and fails string validation, and
    # because this is a response model that failure 500s the WHOLE list rather
    # than the one bad row. A single appointment written without sync_status by
    # an import, a migration or a mobile sync would black out the calendar for
    # the entire clinic. Same failure mode as the patients list and a null phone.
    sync_status: Optional[str] = "local"

    @field_validator("sync_status", mode="before")
    @classmethod
    def _default_sync_status(cls, v):
        return v or "local"

    class Config:
        from_attributes = True

@router.post("", response_model=AppointmentOut)
async def create_appointment(
    appointment: AppointmentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Create a new appointment"""
    try:
        # Parse the date and time
        appointment_datetime = datetime.strptime(
            f"{appointment.appointment_date} {appointment.start_time}", 
            "%Y-%m-%d %H:%M"
        )
        
        # Calculate visit number for this patient
        visit_number = 1
        if appointment.patient_id:
            # Get max visit number for this patient
            max_visit = db.query(Appointment).filter(
                Appointment.patient_id == appointment.patient_id,
                Appointment.visit_number.isnot(None)
            ).order_by(Appointment.visit_number.desc()).first()
            
            if max_visit and max_visit.visit_number:
                visit_number = max_visit.visit_number + 1
        
        # Availability and clashes are enforced HERE, not only in the UI.
        # Greying out a slot on the grid is a hint; this is the rule. Mobile,
        # the public booking page and a raw API call all land on this path, and
        # none of them may put a patient in front of a dentist who is on leave.
        _reason = check_available(
            db, current_user.clinic_id, appointment.doctor_id,
            appointment_datetime.date(), appointment.start_time, appointment.end_time,
        )
        if _reason:
            raise HTTPException(status_code=409, detail=_reason)

        _clash = find_conflict(
            db, current_user.clinic_id, appointment.doctor_id,
            appointment_datetime.date(), appointment.start_time, appointment.end_time,
        )
        if _clash:
            raise HTTPException(
                status_code=409,
                detail=f"Clashes with {_clash.patient_name} at {_clash.start_time} to {_clash.end_time}",
            )

        # Create appointment
        db_appointment = Appointment(
            clinic_id=current_user.clinic_id,
            patient_id=appointment.patient_id,
            patient_name=appointment.patient_name,
            patient_email=appointment.patient_email,
            patient_phone=appointment.patient_phone,
            doctor_id=appointment.doctor_id,
            treatment=appointment.treatment,
            appointment_date=appointment_datetime,
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            duration=appointment.duration,
            status=normalize_status(appointment.status),
            notes=appointment.notes,
            chair_number=appointment.chair_number,
            visit_number=visit_number,
            patient_age=appointment.patient_age,
            created_by=current_user.id
        )
        
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)

        track_event(
            str(current_user.id),
            EVENTS.APPOINTMENT_BOOKED,
            {"status": appointment.status, "treatment": appointment.treatment},
            clinic_id=current_user.clinic_id,
        )
        
        # Get doctor name if assigned
        doctor_name = None
        if db_appointment.doctor_id:
            doctor = db.query(User).filter(User.id == db_appointment.doctor_id).first()
            if doctor:
                doctor_name = doctor.name
        
        # Get clinic information for email
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # ── Push notification to all clinic devices ──────────────────
        from core.push_notify import push_to_clinic
        push_to_clinic(
            db, current_user.clinic_id,
            "📅 New Appointment",
            f"{db_appointment.patient_name} — {db_appointment.start_time}",
            {"type": "new_appointment", "appointment_id": str(db_appointment.id)},
        )

        # ── Notify patient of new appointment ──────────────────────────
        if clinic:
            appt_date_str = db_appointment.appointment_date.strftime("%d %b %Y")
            notify_event(
                "appointment_booked",
                db=db,
                clinic_id=current_user.clinic_id,
                to_phone=db_appointment.patient_phone or "",
                to_email=db_appointment.patient_email or "",
                to_name=db_appointment.patient_name,
                template_data={
                    "patient_name": db_appointment.patient_name,
                    "clinic_name": clinic.name,
                    "appointment_date": appt_date_str,
                    "appointment_time": fmt_appt_time(db_appointment.start_time),
                    "clinic_phone": clinic.phone or "",
                },
            )

        return AppointmentOut(
            id=db_appointment.id,
            clinic_id=db_appointment.clinic_id,
            patient_id=db_appointment.patient_id,
            patient_name=db_appointment.patient_name,
            patient_email=db_appointment.patient_email,
            patient_phone=db_appointment.patient_phone,
            doctor_id=db_appointment.doctor_id,
            doctor_name=doctor_name,
            treatment=db_appointment.treatment,
            appointment_date=db_appointment.appointment_date.strftime("%Y-%m-%d"),
            start_time=db_appointment.start_time,
            end_time=db_appointment.end_time,
            duration=db_appointment.duration,
            status=db_appointment.status,
            notes=db_appointment.notes,
            chair_number=db_appointment.chair_number,
            patient_age=db_appointment.patient_age,
            patient_gender=db_appointment.patient_gender,
            patient_village=db_appointment.patient_village,
            patient_referred_by=db_appointment.patient_referred_by,
            visit_number=db_appointment.visit_number,
            created_at=db_appointment.created_at,
            updated_at=getattr(db_appointment, 'updated_at', db_appointment.created_at),
            synced_at=getattr(db_appointment, 'synced_at', None),
            sync_status=getattr(db_appointment, 'sync_status', 'local')
        )
    except HTTPException:
        # A deliberate 409 for a clash or a day off must reach the caller as a
        # 409. Without this the blanket handler below re-wrapped it as a 500,
        # which reads to the UI as "something broke" rather than "that slot is
        # not free", and the front desk gets an error toast instead of a reason.
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating appointment: {str(e)}")

def _resolve_public_clinic(db: Session, clinic_code: str) -> Clinic:
    """Resolve a clinic for the public booking flow by its unguessable code.

    Public links use clinic_code (e.g. CLN-A3X9K2B7FQ), never the sequential
    numeric id, so the booking endpoints can't be enumerated as 1, 2, 3, ...
    """
    clinic = db.query(Clinic).filter(Clinic.clinic_code == clinic_code).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    return clinic


@router.get("/public/clinic-info")
async def get_public_clinic_info(
    clinic_code: str = Query(..., description="Clinic's public booking code"),
    db: Session = Depends(get_db)
):
    """Return public clinic info for the booking page"""
    clinic = _resolve_public_clinic(db, clinic_code)
    return {
        "clinic_code": clinic.clinic_code,
        "name": clinic.name,
        "address": clinic.address,
        "phone": clinic.phone,
        "email": clinic.email,
        "specialization": clinic.specialization,
        "logo_url": clinic.logo_url,
        "timings": clinic.timings,
    }

@router.get("/public", response_model=List[AppointmentOut])
async def get_public_appointments(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    clinic_code: str = Query(..., description="Clinic's public booking code"),
    db: Session = Depends(get_db)
):
    """Get appointments for public booking page (no auth required)"""
    try:
        # Validate clinic exists
        clinic = _resolve_public_clinic(db, clinic_code)
        clinic_id = clinic.id

        # Get all appointments for this clinic
        query = db.query(Appointment).filter(Appointment.clinic_id == clinic_id)

        # Apply date range filter — reject malformed dates as 400, not 500.
        if date_from:
            try:
                from_date = datetime.strptime(date_from, "%Y-%m-%d")
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid date_from '{date_from}'. Expected YYYY-MM-DD.")
            query = query.filter(Appointment.appointment_date >= from_date)

        if date_to:
            try:
                to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
            except ValueError:
                raise HTTPException(status_code=400, detail=f"Invalid date_to '{date_to}'. Expected YYYY-MM-DD.")
            query = query.filter(Appointment.appointment_date < to_date)

        appointments = query.order_by(Appointment.appointment_date.asc()).all()

        # Enrich with doctor names
        result = []
        for apt in appointments:
            # Get doctor name if doctor is assigned
            doctor_name = None
            if apt.doctor_id:
                doctor = db.query(User).filter(User.id == apt.doctor_id).first()
                if doctor:
                    doctor_name = doctor.name

            result.append(AppointmentOut(
                id=apt.id,
                clinic_id=apt.clinic_id,
                patient_id=apt.patient_id,
                patient_name=apt.patient_name,
                patient_email=apt.patient_email,
                patient_phone=apt.patient_phone,
                doctor_id=apt.doctor_id,
                doctor_name=doctor_name,
                treatment=apt.treatment,
                appointment_date=apt.appointment_date.strftime("%Y-%m-%d"),
                start_time=apt.start_time,
                end_time=apt.end_time,
                duration=apt.duration,
                status=apt.status,
                notes=apt.notes,
                chair_number=apt.chair_number,
                patient_age=apt.patient_age,
                patient_gender=apt.patient_gender,
                patient_village=apt.patient_village,
                patient_referred_by=apt.patient_referred_by,
                visit_number=apt.visit_number,
                created_at=apt.created_at
            ))

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching appointments: {str(e)}")

@router.post("/public", response_model=AppointmentOut)
async def create_public_appointment(
    appointment: AppointmentCreate,
    clinic_code: str = Query(..., description="Clinic's public booking code"),
    db: Session = Depends(get_db)
):
    """Create a new appointment from public booking page"""
    try:
        # The clinic is identified by its unguessable code in the URL, not by a
        # client-supplied numeric id in the body.
        clinic = _resolve_public_clinic(db, clinic_code)

        # Parse the date and time
        appointment_datetime = datetime.strptime(
            f"{appointment.appointment_date} {appointment.start_time}",
            "%Y-%m-%d %H:%M"
        )

        # Create appointment for the clinic (doctor can be assigned later)
        db_appointment = Appointment(
            clinic_id=clinic.id,  # Resolved from the public code
            patient_id=None,  # Public booking doesn't have patient_id yet
            patient_name=appointment.patient_name,
            patient_email=appointment.patient_email,
            patient_phone=appointment.patient_phone,
            doctor_id=appointment.doctor_id if hasattr(appointment, 'doctor_id') and appointment.doctor_id else None,  # Optional doctor
            treatment=appointment.treatment,
            appointment_date=appointment_datetime,
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            duration=appointment.duration,
            # Forced, never taken from the payload. This endpoint is public
            # and unauthenticated, so a booking could arrive already `confirmed`
            # just by asking, and the public page was sending exactly that.
            # Confirming is the clinic's call: a confirmation nobody at the desk
            # made is worse than no confirmation at all.
            status=SCHEDULED,
            # Where it came from, recorded at the one moment it is known.
            patient_referred_by='online',
            notes=appointment.notes,
            visit_number=1,  # Public bookings start at visit 1
            created_by=None  # No logged-in user for public booking
        )

        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)

        # ── Tell the clinic: nobody is watching the public booking page ──
        # This replaces a bare push_to_clinic call. notify() pushes as well, so
        # routing through it adds the bell entry the push never had, and avoids
        # the phone buzzing twice for one booking.
        from domains.notification.services.notification_center_service import (
            notify, FRONT_DESK, SEVERITY_ACTION,
        )
        notify(
            db,
            clinic_id=db_appointment.clinic_id,
            event_type="appointment_booked_online",
            severity=SEVERITY_ACTION,
            audience=FRONT_DESK,
            title="New online booking",
            body=f"{db_appointment.patient_name} at {db_appointment.start_time}"
                 f" on {db_appointment.appointment_date.strftime('%d %b')}",
            link="/appointments",
            entity_type="appointment",
            entity_id=db_appointment.id,
            # Several bookings in a quiet hour become one row with a count,
            # rather than pushing the rest of the bell off the screen.
            collapse_minutes=60,
        )
        db.commit()

        # Get doctor name if assigned
        doctor_name = None
        if db_appointment.doctor_id:
            doctor_user = db.query(User).filter(User.id == db_appointment.doctor_id).first()
            if doctor_user:
                doctor_name = doctor_user.name

        return AppointmentOut(
            id=db_appointment.id,
            clinic_id=db_appointment.clinic_id,
            patient_id=db_appointment.patient_id,
            patient_name=db_appointment.patient_name,
            patient_email=db_appointment.patient_email,
            patient_phone=db_appointment.patient_phone,
            doctor_id=db_appointment.doctor_id,
            doctor_name=doctor_name,
            treatment=db_appointment.treatment,
            appointment_date=db_appointment.appointment_date.strftime("%Y-%m-%d"),
            start_time=db_appointment.start_time,
            end_time=db_appointment.end_time,
            duration=db_appointment.duration,
            status=db_appointment.status,
            notes=db_appointment.notes,
            chair_number=db_appointment.chair_number,
            patient_age=db_appointment.patient_age,
            patient_gender=db_appointment.patient_gender,
            patient_village=db_appointment.patient_village,
            patient_referred_by=db_appointment.patient_referred_by,
            visit_number=db_appointment.visit_number,
            created_at=db_appointment.created_at,
            updated_at=getattr(db_appointment, 'updated_at', db_appointment.created_at),
            synced_at=getattr(db_appointment, 'synced_at', None),
            sync_status=getattr(db_appointment, 'sync_status', 'local')
        )

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating appointment: {str(e)}")

@router.get("/public/next-slot", response_model=dict)
async def get_next_available_slot(
    clinic_code: str = Query(..., description="Clinic's public booking code"),
    date: str = Query(..., description="Date (YYYY-MM-DD)"),
    duration: int = Query(60, description="Duration in minutes"),
    db: Session = Depends(get_db)
):
    """Get the next available time slot for a clinic on a specific date"""
    try:
        # Validate clinic
        clinic = _resolve_public_clinic(db, clinic_code)
        clinic_id = clinic.id

        # Use clinic timings
        clinic_timings = clinic.timings

        # Default timings if no clinic timings found
        if not clinic_timings:
            clinic_timings = {
                'monday': {'open': '08:00', 'close': '20:00', 'closed': False},
                'tuesday': {'open': '08:00', 'close': '20:00', 'closed': False},
                'wednesday': {'open': '08:00', 'close': '20:00', 'closed': False},
                'thursday': {'open': '08:00', 'close': '20:00', 'closed': False},
                'friday': {'open': '08:00', 'close': '20:00', 'closed': False},
                'saturday': {'open': '09:00', 'close': '17:00', 'closed': False},
                'sunday': {'open': '00:00', 'close': '00:00', 'closed': True}
            }

        # Parse date
        try:
            target_date = datetime.strptime(date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

        day_name = target_date.strftime("%A").lower()
        day_timings = clinic_timings.get(day_name, {})

        if not day_timings.get('closed', True):
            # Clinic is open
            open_time = day_timings.get('open', '08:00')
            close_time = day_timings.get('close', '20:00')

            # Convert to minutes since midnight
            open_minutes = int(open_time.split(':')[0]) * 60 + int(open_time.split(':')[1])
            close_minutes = int(close_time.split(':')[0]) * 60 + int(close_time.split(':')[1])

            # Get existing appointments for this clinic on this date
            existing_appointments = db.query(Appointment).filter(
                Appointment.clinic_id == clinic_id,
                Appointment.appointment_date >= datetime.combine(target_date, datetime.min.time()),
                Appointment.appointment_date < datetime.combine(target_date, datetime.max.time())
            ).all()

            # Start time (current time if today, otherwise clinic opening)
            start_minutes = open_minutes
            today = datetime.now().date()
            if target_date == today:
                current_minutes = datetime.now().hour * 60 + datetime.now().minute
                # Round up to next 30-minute interval
                start_minutes = max(start_minutes, ((current_minutes + 29) // 30) * 30)

            # Find next available slot
            slot_duration = duration
            for time_minutes in range(start_minutes, close_minutes - slot_duration + 1, 30):
                slot_start = f"{time_minutes // 60:02d}:{time_minutes % 60:02d}"
                slot_end_minutes = time_minutes + slot_duration
                slot_end = f"{slot_end_minutes // 60:02d}:{slot_end_minutes % 60:02d}"

                # Check for conflicts
                conflict = False
                for apt in existing_appointments:
                    apt_start = apt.start_time
                    apt_end = apt.end_time

                    # Convert to minutes for comparison
                    apt_start_min = int(apt_start.split(':')[0]) * 60 + int(apt_start.split(':')[1])
                    apt_end_min = int(apt_end.split(':')[0]) * 60 + int(apt_end.split(':')[1])

                    # Check overlap
                    if (time_minutes < apt_end_min and slot_end_minutes > apt_start_min):
                        conflict = True
                        break

                if not conflict:
                    return {
                        "next_slot": slot_start,
                        "clinic_open": True,
                        "clinic_hours": f"{open_time} - {close_time}"
                    }

            # No available slots found
            return {
                "next_slot": None,
                "clinic_open": True,
                "clinic_hours": f"{open_time} - {close_time}",
                "message": "No available slots for the selected date and duration"
            }
        else:
            # Clinic is closed
            return {
                "next_slot": None,
                "clinic_open": False,
                "clinic_hours": "Closed",
                "message": f"Clinic is closed on {day_name.title()}"
            }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error finding next slot: {str(e)}")

@router.get("", response_model=List[AppointmentOut])
async def get_appointments(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    doctor_id: Optional[int] = Query(None, description="Filter by doctor"),
    clinic_id: Optional[int] = Query(None, description="Explicitly filter by clinic branch"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all appointments for the clinic with optional filters"""
    # Parse date filters defensively: a malformed/truncated value (e.g. a
    # half-typed "2026-07-0" from the client) is a bad request, not a server
    # error. Do this BEFORE the try/except below so it surfaces as a clean 400
    # instead of being swallowed into a 500 (which also pollutes error tracking).
    from_date = None
    to_date = None
    if date_from:
        try:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_from '{date_from}'. Expected YYYY-MM-DD.")
    if date_to:
        try:
            to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid date_to '{date_to}'. Expected YYYY-MM-DD.")

    try:
        final_clinic_id = clinic_id if (clinic_id and current_user.role == 'clinic_owner') else current_user.clinic_id
        query = db.query(Appointment).filter(Appointment.clinic_id == final_clinic_id)

        # Apply date range filter
        if from_date:
            query = query.filter(Appointment.appointment_date >= from_date)

        if to_date:
            query = query.filter(Appointment.appointment_date < to_date)

        # Apply status filter
        if status:
            query = query.filter(Appointment.status == status)
        
        # Apply doctor filter
        if doctor_id:
            query = query.filter(Appointment.doctor_id == doctor_id)
        
        appointments = query.order_by(Appointment.appointment_date.asc()).all()
        
        # Enrich with doctor names
        result = []
        for apt in appointments:
            doctor_name = None
            if apt.doctor_id:
                doctor = db.query(User).filter(User.id == apt.doctor_id).first()
                if doctor:
                    doctor_name = doctor.name
            
            result.append(AppointmentOut(
                id=apt.id,
                clinic_id=apt.clinic_id,
                patient_id=apt.patient_id,
                patient_name=apt.patient_name,
                patient_email=apt.patient_email,
                patient_phone=apt.patient_phone,
                doctor_id=apt.doctor_id,
                doctor_name=doctor_name,
                treatment=apt.treatment,
                appointment_date=apt.appointment_date.strftime("%Y-%m-%d"),
                start_time=apt.start_time,
                end_time=apt.end_time,
                duration=apt.duration,
                status=apt.status,
                notes=apt.notes,
                chair_number=apt.chair_number,
                patient_age=apt.patient_age,
                patient_gender=apt.patient_gender,
                patient_village=apt.patient_village,
                patient_referred_by=apt.patient_referred_by,
                visit_number=apt.visit_number,
                created_at=apt.created_at,
                updated_at=getattr(apt, 'updated_at', apt.created_at),
                synced_at=getattr(apt, 'synced_at', None),
                sync_status=getattr(apt, 'sync_status', 'local')
            ))
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching appointments: {str(e)}")

@router.get("/needs-outcome")
def needs_outcome(
    limit: int = Query(50, le=200),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Past appointments nobody ever closed off.

    Declared above GET /{appointment_id} on purpose: FastAPI matches in
    declaration order, so a literal path behind a parameter route would be
    swallowed by it and 422 on the string.

    These are deliberately surfaced rather than auto-marked. Guessing a no-show
    on a clinic's behalf would poison the very number this whole change exists
    to earn, so the clinic says what happened and we only make it one tap.
    """
    now = datetime.utcnow()
    rows = (
        db.query(Appointment)
        .filter(
            Appointment.clinic_id == current_user.clinic_id,
            Appointment.status.in_(OPEN_STATUSES),
            Appointment.appointment_date < now,
        )
        .order_by(Appointment.appointment_date.desc())
        .limit(limit)
        .all()
    )
    return {
        "count": len(rows),
        "appointments": [
            {
                "id": a.id,
                "patient_name": a.patient_name,
                "patient_id": a.patient_id,
                "doctor_id": a.doctor_id,
                "treatment": a.treatment,
                "appointment_date": a.appointment_date.strftime("%Y-%m-%d"),
                "start_time": a.start_time,
                "status": normalize_status(a.status),
            }
            for a in rows
        ],
    }


class OutcomePayload(BaseModel):
    status: str                       # completed | no_show | cancelled
    cancel_reason: Optional[str] = None


@router.post("/{appointment_id}/outcome", response_model=AppointmentOut)
def set_outcome(
    appointment_id: int,
    payload: OutcomePayload,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Record how an appointment ended.

    Separate from the general update endpoint because an outcome is not just
    another editable field: it stamps who decided and when, and it is the one
    write that makes the no-show rate and utilisation figures possible.
    """
    status = normalize_status(payload.status)
    if status not in TERMINAL_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"An outcome must be one of: {', '.join(TERMINAL_STATUSES)}",
        )

    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current_user.clinic_id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appointment.status = status
    appointment.outcome_at = datetime.utcnow()
    appointment.outcome_by = current_user.id
    appointment.cancel_reason = (
        (payload.cancel_reason or "").strip() or None if status == CANCELLED else None
    )
    db.commit()
    db.refresh(appointment)

    # A cancelled or missed slot is a hole in the day somebody should fill, and
    # a no-show is somebody to chase. A completed appointment is not news, so it
    # notifies nothing: the whole point of the day is that they happen.
    if status in (CANCELLED, NO_SHOW):
        try:
            from domains.notification.services.notification_center_service import (
                notify, FRONT_DESK, OWNER, SEVERITY_ACTION, SEVERITY_INFO,
            )
            when = appointment.appointment_date.strftime("%d %b")
            if status == CANCELLED:
                reason = f" ({appointment.cancel_reason})" if appointment.cancel_reason else ""
                notify(
                    db,
                    clinic_id=appointment.clinic_id,
                    event_type="appointment_cancelled",
                    severity=SEVERITY_ACTION,
                    audience=FRONT_DESK,
                    actor_user_id=current_user.id,
                    title="Appointment cancelled",
                    body=f"{appointment.patient_name}, {when} at {appointment.start_time}{reason}",
                    link="/appointments",
                    entity_type="appointment",
                    entity_id=appointment.id,
                )
            else:
                notify(
                    db,
                    clinic_id=appointment.clinic_id,
                    event_type="appointment_no_show",
                    severity=SEVERITY_INFO,
                    audience=OWNER,
                    actor_user_id=current_user.id,
                    title="Patient did not turn up",
                    body=f"{appointment.patient_name} missed {when} at {appointment.start_time}",
                    link="/appointments",
                    entity_type="appointment",
                    entity_id=appointment.id,
                    # A run of no-shows in a morning is one line worth chasing,
                    # not six separate nudges.
                    collapse_minutes=240,
                )
            db.commit()
        except Exception:
            db.rollback()

    doctor = db.query(User).filter(User.id == appointment.doctor_id).first() if appointment.doctor_id else None
    return AppointmentOut(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        patient_name=appointment.patient_name,
        patient_email=appointment.patient_email,
        patient_phone=appointment.patient_phone,
        doctor_id=appointment.doctor_id,
        doctor_name=doctor.name if doctor else None,
        treatment=appointment.treatment,
        appointment_date=appointment.appointment_date.strftime("%Y-%m-%d"),
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        duration=appointment.duration,
        status=appointment.status,
        notes=appointment.notes,
        chair_number=appointment.chair_number,
        patient_age=appointment.patient_age,
        patient_gender=appointment.patient_gender,
        patient_village=appointment.patient_village,
        patient_referred_by=appointment.patient_referred_by,
        visit_number=appointment.visit_number,
        created_at=appointment.created_at,
        updated_at=getattr(appointment, "updated_at", appointment.created_at),
        synced_at=getattr(appointment, "synced_at", None),
        sync_status=getattr(appointment, "sync_status", "local"),
    )


@router.post("/{appointment_id}/start-visit")
def start_visit(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_doctor_or_owner()),
):
    """Turn a booking into the visit it was for.

    `case_papers.appointment_id` has been in the schema all along and was
    populated exactly 0 times out of 167: staff booked a patient, the patient
    arrived, and somebody hand-started an unrelated case paper, retyping the
    doctor and the treatment. That is why filling in the calendar bought a
    clinic nothing.

    Idempotent. Calling twice returns the case paper already started rather
    than opening a second clinical record for one visit.
    """
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current_user.clinic_id,
    ).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    existing = db.query(CasePaper).filter(
        CasePaper.appointment_id == appointment.id,
        CasePaper.clinic_id == current_user.clinic_id,
    ).first()
    if existing:
        return {"case_paper_id": existing.id, "created": False,
                "patient_id": existing.patient_id}

    if not appointment.patient_id:
        raise HTTPException(
            status_code=400,
            detail="Add a patient file to this booking before starting the visit",
        )

    # Seeded, not decided. The treatment on the booking is why they came, so it
    # belongs in the chief complaint as a starting point the dentist edits,
    # rather than something they have to remember and retype.
    seed = (appointment.treatment or "").strip()
    paper = CasePaper(
        clinic_id=current_user.clinic_id,
        patient_id=appointment.patient_id,
        appointment_id=appointment.id,
        dentist_id=appointment.doctor_id or current_user.id,
        date=datetime.utcnow(),
        status="In Progress",
        chief_complaint=json.dumps([seed]) if seed else None,
    )
    db.add(paper)

    # Starting the visit means they are here, so the booking catches up if the
    # front desk never marked them in.
    if normalize_status(appointment.status) in (SCHEDULED, CONFIRMED):
        appointment.status = ARRIVED

    db.commit()
    db.refresh(paper)

    # The patient was in the clinic, so the day's register should say so. Same
    # best-effort contract as create_case_paper: never block clinical work.
    try:
        from domains.patient.routes.daily_register import record_daily_visit
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        patient = db.query(Patient).filter(Patient.id == paper.patient_id).first()
        if clinic and patient:
            record_daily_visit(
                db, clinic, patient, source="appointment",
                doctor_id=paper.dentist_id, created_by=current_user.id,
            )
            db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.warning("daily register skipped for appointment %s: %s", appointment.id, exc)

    return {"case_paper_id": paper.id, "created": True, "patient_id": paper.patient_id}


# Declared above GET /{appointment_id}. FastAPI matches in declaration order, so a
# literal path sitting behind a parameter route is swallowed by it: this endpoint
# was returning 422 "not a valid integer" for every patient search in the booking
# form, because "search-patients" was being parsed as an appointment id.
@router.get("/search-patients")
async def search_patients_for_checkin(
    q: str = Query("", description="Name or phone to search"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Search existing patients by name or phone for check-in autocomplete.
    Returns top 5 matches with visit history summary.
    """
    q = q.strip()
    clinic_id = current_user.clinic_id
    print(f"DEBUG_SEARCH: q='{q}', clinic_id={clinic_id}")
    query = db.query(Patient).filter(Patient.clinic_id == clinic_id)

    if q:
        query = query.filter(
            (Patient.name.ilike(f"%{q}%")) | (Patient.phone.ilike(f"%{q}%"))
        )

    patients = query.limit(8).all()
    print(f"DEBUG_SEARCH: found {len(patients)} results")
    result = []
    for p in patients:
        # Count visits
        visit_count = db.query(Appointment).filter(
            Appointment.patient_id == p.id,
            Appointment.clinic_id == clinic_id
        ).count()

        last_appt = db.query(Appointment).filter(
            Appointment.patient_id == p.id,
            Appointment.clinic_id == clinic_id
        ).order_by(Appointment.appointment_date.desc()).first()

        result.append({
            "id": p.id,
            "name": p.name,
            "phone": p.phone,
            "age": p.age,
            "gender": p.gender,
            "village": p.village,
            "display_id": p.display_id,
            "visit_count": visit_count,
            "last_visit": last_appt.appointment_date.strftime("%Y-%m-%d") if last_appt else None,
            "last_treatment": last_appt.treatment if last_appt else None,
            "next_visit_number": visit_count + 1
        })

    return result


@router.get("/{appointment_id}", response_model=AppointmentOut)
async def get_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get a specific appointment"""
    appointment = db.query(Appointment).filter(
        Appointment.id == appointment_id,
        Appointment.clinic_id == current_user.clinic_id
    ).first()
    
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    
    doctor_name = None
    if appointment.doctor_id:
        doctor = db.query(User).filter(User.id == appointment.doctor_id).first()
        if doctor:
            doctor_name = doctor.name
    
    return AppointmentOut(
        id=appointment.id,
        clinic_id=appointment.clinic_id,
        patient_id=appointment.patient_id,
        patient_name=appointment.patient_name,
        patient_email=appointment.patient_email,
        patient_phone=appointment.patient_phone,
        doctor_id=appointment.doctor_id,
        doctor_name=doctor_name,
        treatment=appointment.treatment,
        appointment_date=appointment.appointment_date.strftime("%Y-%m-%d"),
        start_time=appointment.start_time,
        end_time=appointment.end_time,
        duration=appointment.duration,
        status=appointment.status,
        notes=appointment.notes,
        chair_number=appointment.chair_number,
        patient_age=appointment.patient_age,
        patient_gender=appointment.patient_gender,
        patient_village=appointment.patient_village,
        patient_referred_by=appointment.patient_referred_by,
        visit_number=appointment.visit_number,
        created_at=appointment.created_at,
        updated_at=getattr(appointment, 'updated_at', appointment.created_at),
        synced_at=getattr(appointment, 'synced_at', None),
        sync_status=getattr(appointment, 'sync_status', 'local')
    )

@router.put("/{appointment_id}", response_model=AppointmentOut)
async def update_appointment(
    appointment_id: int,
    appointment_update: AppointmentUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update an appointment"""
    try:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.clinic_id == current_user.clinic_id
        ).first()
        
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        # Update fields
        update_data = appointment_update.dict(exclude_unset=True)
        
        # Handle date/time update
        if appointment_update.appointment_date and appointment_update.start_time:
            appointment_datetime = datetime.strptime(
                f"{appointment_update.appointment_date} {appointment_update.start_time}",
                "%Y-%m-%d %H:%M"
            )
            appointment.appointment_date = appointment_datetime
        
        # Read the old status BEFORE the generic setattr loop writes over it.
        # This used to run afterwards, so old_status already held the new value,
        # status_changed was never True, and no confirmation or check-in message
        # was ever sent from this endpoint.
        old_status = normalize_status(appointment.status)
        requested_status = (
            normalize_status(appointment_update.status)
            if appointment_update.status else None
        )
        status_changed = bool(requested_status and requested_status != old_status)

        for key, value in update_data.items():
            if key not in ['appointment_date', 'start_time', 'status'] and value is not None:
                setattr(appointment, key, value)

        if requested_status:
            appointment.status = requested_status
            if is_terminal(requested_status):
                appointment.outcome_at = datetime.utcnow()
                appointment.outcome_by = current_user.id
            else:
                # Reopening clears the outcome, otherwise a mistakenly closed
                # appointment keeps a stale "settled at" long after it reopened.
                appointment.outcome_at = None
                appointment.outcome_by = None
                # And the reason with it: "patient rang to rearrange" is not
                # true of an appointment that is back on the books.
                appointment.cancel_reason = None

        if appointment_update.start_time:
            appointment.start_time = appointment_update.start_time
        if appointment_update.end_time:
            appointment.end_time = appointment_update.end_time

        # Same rule on the way through an edit. Dragging a card on the grid and
        # resizing it both arrive here, so this is what stops a drag landing
        # somewhere the doctor is not working.
        if any([appointment_update.appointment_date, appointment_update.start_time,
                appointment_update.end_time, appointment_update.doctor_id is not None]):
            _on = appointment.appointment_date.date()
            _reason = check_available(
                db, current_user.clinic_id, appointment.doctor_id,
                _on, appointment.start_time, appointment.end_time,
            )
            if _reason:
                db.rollback()
                raise HTTPException(status_code=409, detail=_reason)
            _clash = find_conflict(
                db, current_user.clinic_id, appointment.doctor_id,
                _on, appointment.start_time, appointment.end_time,
                exclude_id=appointment.id,
            )
            if _clash:
                db.rollback()
                raise HTTPException(
                    status_code=409,
                    detail=f"Clashes with {_clash.patient_name} at {_clash.start_time} to {_clash.end_time}",
                )

        # --- AUTO PATIENT CREATION LOGIC ---
        # Checking in someone who was booked without a patient file creates one.
        if appointment.status == ARRIVED and (appointment.patient_id is None):
            try:
                # Log to file for visibility
                with open("/tmp/auto_patient.log", "a") as logf:
                    logf.write(f"\n--- {datetime.utcnow()} ---\n")
                    logf.write(f"🔄 Attempting auto-patient creation for appointment {appointment.id}\n")
                    
                from domains.patient.services.patient_service import PatientService
                from domains.patient.repositories.patient_repository import PatientRepository
                from domains.clinic.repositories.clinic_repository import ClinicRepository
                from domains.finance.repositories.payment_repository import PaymentRepository
                
                patient_repo = PatientRepository(db)
                clinic_repo = ClinicRepository(db)
                payment_repo = PaymentRepository(db)
                patient_svc = PatientService(patient_repo, clinic_repo, payment_repo)
                
                patient_data = {
                    "name": appointment.patient_name,
                    "phone": appointment.patient_phone or "0000000000",
                    "treatment_type": "General Consultation",
                    "age": appointment.patient_age or 0,
                    "gender": appointment.patient_gender or "Other",
                    "village": appointment.patient_village or "Unknown",
                    "referred_by": appointment.patient_referred_by or "Walk-in",
                    "payment_type": "Cash", # Default
                    "notes": appointment.notes or "Automatically created from appointment"
                }
                
                with open("/tmp/auto_patient.log", "a") as logf:
                    logf.write(f"Data: {patient_data}\n")
                    logf.write(f"Clinic ID: {appointment.clinic_id}\n")
                
                # Use appointment.clinic_id to ensure consistency
                new_patient = patient_svc.create_patient(patient_data, appointment.clinic_id)
                appointment.patient_id = new_patient.id
                db.flush() # Ensure the ID is linked before commit
                
                with open("/tmp/auto_patient.log", "a") as logf:
                    logf.write(f"✅ Successfully created patient {new_patient.id}\n")
                print(f"✅ Successfully created patient {new_patient.id} for appointment {appointment.id}")
            except Exception as e:
                import traceback
                error_msg = f"⚠️ Error auto-creating patient: {str(e)}"
                print(error_msg)
                with open("/tmp/auto_patient.log", "a") as logf:
                    logf.write(f"{error_msg}\n")
                    logf.write(traceback.format_exc())
                traceback.print_exc()
        
        # ── Daily register ───────────────────────────────────────────
        # Checking a patient in is them arriving at the clinic, so they belong in
        # the day's register. Idempotent per patient per day, so a walk-in the
        # front desk already added by hand isn't counted twice. Best-effort: a
        # failure here must never block the check-in itself.
        if appointment.status == ARRIVED and appointment.patient_id:
            try:
                from domains.patient.routes.daily_register import record_daily_visit
                reg_clinic = db.query(Clinic).filter(Clinic.id == appointment.clinic_id).first()
                reg_patient = db.query(Patient).filter(Patient.id == appointment.patient_id).first()
                if reg_clinic and reg_patient:
                    record_daily_visit(
                        db, reg_clinic, reg_patient,
                        source='check_in',
                        appointment_id=appointment.id,
                        doctor_id=appointment.doctor_id,
                        reason=appointment.treatment,
                        created_by=current_user.id,
                    )
            except Exception as e:
                print(f"⚠️ Could not add appointment {appointment.id} to the daily register: {e}")

        db.commit()
        db.refresh(appointment)

        doctor_name = None
        if appointment.doctor_id:
            doctor = db.query(User).filter(User.id == appointment.doctor_id).first()
            if doctor:
                doctor_name = doctor.name

        # Get clinic information for email
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # ── Notify patient of status change ──────────────────────────
        if status_changed and clinic:
            appt_date_str = appointment.appointment_date.strftime("%d %b %Y")
            td = {
                "patient_name": appointment.patient_name,
                "clinic_name": clinic.name,
                "appointment_date": appt_date_str,
                "appointment_time": fmt_appt_time(appointment.start_time),
                "doctor_name": doctor_name or "our team",
                "clinic_phone": clinic.phone or "",
            }
            if appointment.status == CONFIRMED:
                notify_event(
                    "appointment_confirmation",
                    db=db, clinic_id=current_user.clinic_id,
                    to_phone=appointment.patient_phone or "",
                    to_email=appointment.patient_email or "",
                    to_name=appointment.patient_name,
                    template_data=td,
                )
            elif appointment.status == ARRIVED:
                notify_event(
                    "checked_in",
                    db=db, clinic_id=current_user.clinic_id,
                    to_phone=appointment.patient_phone or "",
                    to_email=appointment.patient_email or "",
                    to_name=appointment.patient_name,
                    template_data=td,
                )

        
        return AppointmentOut(
            id=appointment.id,
            clinic_id=appointment.clinic_id,
            patient_id=appointment.patient_id,
            patient_name=appointment.patient_name,
            patient_email=appointment.patient_email,
            patient_phone=appointment.patient_phone,
            doctor_id=appointment.doctor_id,
            doctor_name=doctor_name,
            treatment=appointment.treatment,
            appointment_date=appointment.appointment_date.strftime("%Y-%m-%d"),
            start_time=appointment.start_time,
            end_time=appointment.end_time,
            duration=appointment.duration,
            status=appointment.status,
            notes=appointment.notes,
            chair_number=appointment.chair_number,
            patient_age=appointment.patient_age,
            patient_gender=appointment.patient_gender,
            patient_village=appointment.patient_village,
            patient_referred_by=appointment.patient_referred_by,
            visit_number=appointment.visit_number,
            created_at=appointment.created_at,
            updated_at=getattr(appointment, 'updated_at', appointment.created_at),
            synced_at=getattr(appointment, 'synced_at', None),
            sync_status=getattr(appointment, 'sync_status', 'local')
        )
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating appointment: {str(e)}")

@router.delete("/{appointment_id}")
async def delete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete an appointment"""
    try:
        appointment = db.query(Appointment).filter(
            Appointment.id == appointment_id,
            Appointment.clinic_id == current_user.clinic_id
        ).first()
        
        if not appointment:
            raise HTTPException(status_code=404, detail="Appointment not found")
        
        db.delete(appointment)
        db.commit()
        
        return {"message": "Appointment deleted successfully"}
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting appointment: {str(e)}")


@router.get("/patient-visits/{patient_id}")
async def get_patient_visits(
    patient_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Return list of all appointments (visits) for a patient — newest first."""
    appts = db.query(Appointment).filter(
        Appointment.patient_id == patient_id,
        Appointment.clinic_id == current_user.clinic_id
    ).order_by(Appointment.appointment_date.desc()).all()

    # Get clinic name once
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    clinic_name = clinic.name if clinic else "Clinic"

    return [
        {
            "id": a.id,
            "display_id": f"VISIT-{a.id}",
            "visit_number": a.visit_number,
            "appointment_date": a.appointment_date.strftime("%Y-%m-%d") if a.appointment_date else None,
            "start_time": a.start_time,
            "end_time": getattr(a, 'end_time', None),
            "status": a.status,
            "treatment": a.treatment or "Consultation",
            "chair_number": a.chair_number,
            "notes": a.notes,
            "doctor_id": a.doctor_id,
            "clinic_name": clinic_name
        }
        for a in appts
    ]
