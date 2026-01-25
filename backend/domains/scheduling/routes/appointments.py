from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from database import SessionLocal
from models import Appointment, Patient, User, Clinic
from typing import List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel
from core.auth_utils import get_current_user
from domains.communication.services.email_service import EmailService

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
    clinic_id: int  # Required for clinic-based booking
    doctor_id: Optional[int] = None
    treatment: str
    appointment_date: str  # YYYY-MM-DD
    start_time: str  # HH:MM
    end_time: str  # HH:MM
    duration: int = 60
    status: str = "confirmed"
    notes: Optional[str] = None

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
    rejection_reason: Optional[str] = None  # Custom message for rejection emails

class AppointmentOut(BaseModel):
    id: int
    clinic_id: int
    patient_id: Optional[int]
    patient_name: str
    patient_email: Optional[str]
    patient_phone: Optional[str]
    doctor_id: Optional[int]
    doctor_name: Optional[str]
    treatment: str
    appointment_date: str
    start_time: str
    end_time: str
    duration: int
    status: str
    notes: Optional[str]
    visit_number: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    synced_at: Optional[datetime] = None
    sync_status: str = "local"

    class Config:
        from_attributes = True

@router.post("/", response_model=AppointmentOut)
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
            status=appointment.status,
            notes=appointment.notes,
            visit_number=visit_number,
            created_by=current_user.id
        )
        
        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)
        
        # Get doctor name if assigned
        doctor_name = None
        if db_appointment.doctor_id:
            doctor = db.query(User).filter(User.id == db_appointment.doctor_id).first()
            if doctor:
                doctor_name = doctor.name
        
        # Get clinic information for email
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Send email notification for appointment scheduled
        if db_appointment.patient_email and clinic:
            try:
                email_service = EmailService()
                appointment_date_str = db_appointment.appointment_date.strftime("%B %d, %Y")
                appointment_time_str = db_appointment.start_time
                # Format time from 24-hour to 12-hour format
                try:
                    hour, minute = appointment_time_str.split(':')
                    hour_int = int(hour)
                    am_pm = 'AM' if hour_int < 12 else 'PM'
                    display_hour = hour_int if hour_int <= 12 else hour_int - 12
                    if display_hour == 0:
                        display_hour = 12
                    appointment_time_formatted = f"{display_hour}:{minute} {am_pm}"
                except:
                    appointment_time_formatted = appointment_time_str
                
                email_service.send_appointment_scheduled_email(
                    to_email=db_appointment.patient_email,
                    patient_name=db_appointment.patient_name,
                    clinic_name=clinic.name,
                    appointment_date=appointment_date_str,
                    appointment_time=appointment_time_formatted,
                    treatment=db_appointment.treatment,
                    clinic_phone=clinic.phone
                )
            except Exception as email_error:
                # Log error but don't fail the appointment creation
                print(f"Failed to send appointment scheduled email: {email_error}")
        
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
            created_at=db_appointment.created_at,
            updated_at=getattr(db_appointment, 'updated_at', db_appointment.created_at),
            synced_at=getattr(db_appointment, 'synced_at', None),
            sync_status=getattr(db_appointment, 'sync_status', 'local')
        )
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Error creating appointment: {str(e)}")

@router.get("/public", response_model=List[AppointmentOut])
async def get_public_appointments(
    date_from: str = Query(..., description="Start date (YYYY-MM-DD)"),
    date_to: str = Query(..., description="End date (YYYY-MM-DD)"),
    clinic_id: int = Query(..., description="Filter by clinic"),
    db: Session = Depends(get_db)
):
    """Get appointments for public booking page (no auth required)"""
    try:
        # Validate clinic exists
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            raise HTTPException(status_code=404, detail=f"Clinic with ID {clinic_id} not found")

        # Get all appointments for this clinic
        query = db.query(Appointment).filter(Appointment.clinic_id == clinic_id)

        # Apply date range filter
        if date_from:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Appointment.appointment_date >= from_date)

        if date_to:
            to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
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
    db: Session = Depends(get_db)
):
    """Create a new appointment from public booking page"""
    try:
        # For clinic-based booking, we expect clinic_id in the appointment data
        # If not provided, we can't create the appointment
        if not hasattr(appointment, 'clinic_id') or not appointment.clinic_id:
            raise HTTPException(status_code=400, detail="Clinic ID is required for public booking")

        # Validate clinic exists
        clinic = db.query(Clinic).filter(Clinic.id == appointment.clinic_id).first()
        if not clinic:
            raise HTTPException(status_code=404, detail="Clinic not found")

        # Parse the date and time
        appointment_datetime = datetime.strptime(
            f"{appointment.appointment_date} {appointment.start_time}",
            "%Y-%m-%d %H:%M"
        )

        # Create appointment for the clinic (doctor can be assigned later)
        db_appointment = Appointment(
            clinic_id=appointment.clinic_id,  # Use clinic directly
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
            status=appointment.status,
            notes=appointment.notes,
            visit_number=1,  # Public bookings start at visit 1
            created_by=None  # No logged-in user for public booking
        )

        db.add(db_appointment)
        db.commit()
        db.refresh(db_appointment)

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
    clinic_id: int = Query(..., description="Clinic ID"),
    date: str = Query(..., description="Date (YYYY-MM-DD)"),
    duration: int = Query(60, description="Duration in minutes"),
    db: Session = Depends(get_db)
):
    """Get the next available time slot for a clinic on a specific date"""
    try:
        # Validate clinic
        clinic = db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if not clinic:
            raise HTTPException(status_code=404, detail=f"Clinic with ID {clinic_id} not found")

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

@router.get("/", response_model=List[AppointmentOut])
async def get_appointments(
    date_from: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    date_to: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    status: Optional[str] = Query(None, description="Filter by status"),
    doctor_id: Optional[int] = Query(None, description="Filter by doctor"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all appointments for the clinic with optional filters"""
    try:
        query = db.query(Appointment).filter(Appointment.clinic_id == current_user.clinic_id)
        
        # Apply date range filter
        if date_from:
            from_date = datetime.strptime(date_from, "%Y-%m-%d")
            query = query.filter(Appointment.appointment_date >= from_date)
        
        if date_to:
            to_date = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
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
                created_at=apt.created_at,
                updated_at=getattr(apt, 'updated_at', apt.created_at),
                synced_at=getattr(apt, 'synced_at', None),
                sync_status=getattr(apt, 'sync_status', 'local')
            ))
        
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching appointments: {str(e)}")

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
        
        for key, value in update_data.items():
            if key not in ['appointment_date', 'start_time'] and value is not None:
                setattr(appointment, key, value)
        
        if appointment_update.start_time:
            appointment.start_time = appointment_update.start_time
        if appointment_update.end_time:
            appointment.end_time = appointment_update.end_time
        
        # Track if status changed for email notifications
        status_changed = False
        old_status = appointment.status
        if appointment_update.status and appointment_update.status != appointment.status:
            status_changed = True
            appointment.status = appointment_update.status
        
        db.commit()
        db.refresh(appointment)
        
        doctor_name = None
        if appointment.doctor_id:
            doctor = db.query(User).filter(User.id == appointment.doctor_id).first()
            if doctor:
                doctor_name = doctor.name
        
        # Get clinic information for email
        clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
        
        # Send email notifications if status changed and patient email exists
        if status_changed and appointment.patient_email and clinic:
            try:
                email_service = EmailService()
                appointment_date_str = appointment.appointment_date.strftime("%B %d, %Y")
                appointment_time_str = appointment.start_time
                # Format time from 24-hour to 12-hour format
                try:
                    hour, minute = appointment_time_str.split(':')
                    hour_int = int(hour)
                    am_pm = 'AM' if hour_int < 12 else 'PM'
                    display_hour = hour_int if hour_int <= 12 else hour_int - 12
                    if display_hour == 0:
                        display_hour = 12
                    appointment_time_formatted = f"{display_hour}:{minute} {am_pm}"
                except:
                    appointment_time_formatted = appointment_time_str
                
                if appointment.status == 'accepted':
                    # Send appointment accepted email
                    email_service.send_appointment_accepted_email(
                        to_email=appointment.patient_email,
                        patient_name=appointment.patient_name,
                        clinic_name=clinic.name,
                        appointment_date=appointment_date_str,
                        appointment_time=appointment_time_formatted,
                        treatment=appointment.treatment,
                        doctor_name=doctor_name,
                        clinic_phone=clinic.phone
                    )
                elif appointment.status == 'rejected':
                    # Send appointment rejected email with custom reason if provided
                    rejection_reason = appointment_update.rejection_reason
                    email_service.send_appointment_rejected_email(
                        to_email=appointment.patient_email,
                        patient_name=appointment.patient_name,
                        clinic_name=clinic.name,
                        appointment_date=appointment_date_str,
                        appointment_time=appointment_time_formatted,
                        treatment=appointment.treatment,
                        rejection_reason=rejection_reason,
                        clinic_phone=clinic.phone
                    )
            except Exception as email_error:
                # Log error but don't fail the appointment update
                print(f"Failed to send appointment status email: {email_error}")
        
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

