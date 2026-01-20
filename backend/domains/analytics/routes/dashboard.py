from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract, case
from datetime import datetime, timedelta
from typing import Optional
from database import get_db
from models import Patient, Report, Payment, User, TreatmentType, Appointment, Clinic
from core.auth_utils import get_current_user

router = APIRouter()

@router.get("/metrics")
def get_dashboard_metrics(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get main dashboard metrics with trends - Dental clinic specific"""
    clinic_id = current_user.clinic_id
    
    # Calculate date ranges
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    yesterday_start = today_start - timedelta(days=1)
    week_ago = now - timedelta(days=7)
    two_weeks_ago = now - timedelta(days=14)
    
    # Total Patients
    total_patients = db.query(func.count(Patient.id)).filter(
        Patient.clinic_id == clinic_id
    ).scalar() or 0
    
    # Patients this week
    patients_this_week = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= week_ago
        )
    ).scalar() or 0
    
    # Patients last week
    patients_last_week = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= two_weeks_ago,
            Patient.created_at < week_ago
        )
    ).scalar() or 0
    
    # Calculate patient trend
    patient_change = 0
    if patients_last_week > 0:
        patient_change = ((patients_this_week - patients_last_week) / patients_last_week) * 100
    elif patients_this_week > 0:
        patient_change = 100
    
    # Total Reports
    total_reports = db.query(func.count(Report.id)).filter(
        Report.clinic_id == clinic_id
    ).scalar() or 0
    
    # Reports this week
    reports_this_week = db.query(func.count(Report.id)).filter(
        and_(
            Report.clinic_id == clinic_id,
            Report.created_at >= week_ago
        )
    ).scalar() or 0
    
    # Reports last week
    reports_last_week = db.query(func.count(Report.id)).filter(
        and_(
            Report.clinic_id == clinic_id,
            Report.created_at >= two_weeks_ago,
            Report.created_at < week_ago
        )
    ).scalar() or 0
    
    # Calculate report trend
    report_change = 0
    if reports_last_week > 0:
        report_change = ((reports_this_week - reports_last_week) / reports_last_week) * 100
    elif reports_this_week > 0:
        report_change = 100
    
    # Pending Reports (status = 'pending' or 'draft')
    pending_reports = db.query(func.count(Report.id)).filter(
        and_(
            Report.clinic_id == clinic_id,
            Report.status.in_(['pending', 'draft'])
        )
    ).scalar() or 0
    
    # Pending reports this week
    pending_this_week = db.query(func.count(Report.id)).filter(
        and_(
            Report.clinic_id == clinic_id,
            Report.status.in_(['pending', 'draft']),
            Report.created_at >= week_ago
        )
    ).scalar() or 0
    
    # Pending reports last week
    pending_last_week = db.query(func.count(Report.id)).filter(
        and_(
            Report.clinic_id == clinic_id,
            Report.status.in_(['pending', 'draft']),
            Report.created_at >= two_weeks_ago,
            Report.created_at < week_ago
        )
    ).scalar() or 0
    
    # Calculate pending trend
    pending_change = 0
    if pending_last_week > 0:
        pending_change = ((pending_this_week - pending_last_week) / pending_last_week) * 100
    elif pending_this_week > 0:
        pending_change = 100
    
    # Appointments Today - count appointments scheduled FOR today
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_start + timedelta(days=1)
        )
    ).scalar() or 0

    appointments_yesterday = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= yesterday_start,
            Appointment.appointment_date < today_start
        )
    ).scalar() or 0
    
    # Calculate appointment trend
    appointment_change = 0
    if appointments_yesterday > 0:
        appointment_change = ((appointments_today - appointments_yesterday) / appointments_yesterday) * 100
    elif appointments_today > 0:
        appointment_change = 100
    
    # Chair Capacity (configurable per clinic, default 5 chairs)
    total_chairs = 5  # Can be made configurable via clinic settings
    # Estimate chairs occupied based on concurrent appointments
    # For simplicity, assume appointments are distributed throughout the day
    chairs_occupied = min(max(1, appointments_today // 2), total_chairs) if appointments_today > 0 else 0
    chair_utilization = int((chairs_occupied / total_chairs) * 100) if total_chairs > 0 else 0
    
    return {
        "total_patients": {
            "value": total_patients,
            "change": round(patient_change, 1),
            "change_type": "up" if patient_change >= 0 else "down",
            "this_week": patients_this_week,
            "last_week": patients_last_week
        },
        "appointments_today": {
            "value": appointments_today,
            "change": round(abs(appointment_change), 1),
            "change_type": "up" if appointment_change >= 0 else "down",
            "today": appointments_today,
            "yesterday": appointments_yesterday
        },
        "chair_capacity": {
            "utilization": chair_utilization,
            "chairs_occupied": chairs_occupied,
            "total_chairs": total_chairs,
            "chairs_available": total_chairs - chairs_occupied
        }
    }

@router.get("/patient-stats")
def get_patient_statistics(
    period: str = "months",  # months, week, currentWeek
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get patient registration statistics by time period"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    
    if period == "months":
        # Last 12 months
        data = []
        for i in range(11, -1, -1):
            month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1)
            month_end = (month_start + timedelta(days=32)).replace(day=1)
            
            count = db.query(func.count(Patient.id)).filter(
                and_(
                    Patient.clinic_id == clinic_id,
                    Patient.created_at >= month_start,
                    Patient.created_at < month_end
                )
            ).scalar() or 0
            
            data.append({
                "month": month_start.strftime("%b"),
                "patient": count,
                "inpatient": 0  # Can be extended for inpatient tracking
            })
        return data
    
    elif period == "week":
        # Last 7 days of the week (Sun-Sat)
        data = []
        days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        for i in range(7):
            day_start = (now - timedelta(days=6-i)).replace(hour=0, minute=0, second=0, microsecond=0)
            day_end = day_start + timedelta(days=1)
            
            count = db.query(func.count(Patient.id)).filter(
                and_(
                    Patient.clinic_id == clinic_id,
                    Patient.created_at >= day_start,
                    Patient.created_at < day_end
                )
            ).scalar() or 0
            
            data.append({
                "day": days[day_start.weekday() if day_start.weekday() != 6 else 0],
                "patient": count,
                "inpatient": 0
            })
        return data
    
    else:  # currentWeek
        # Current week (Mon-Sun)
        data = []
        # Find Monday of current week
        days_since_monday = now.weekday()
        monday = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)
        
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        for i in range(7):
            day_start = monday + timedelta(days=i)
            day_end = day_start + timedelta(days=1)
            
            count = db.query(func.count(Patient.id)).filter(
                and_(
                    Patient.clinic_id == clinic_id,
                    Patient.created_at >= day_start,
                    Patient.created_at < day_end
                )
            ).scalar() or 0
            
            data.append({
                "day": days[i],
                "patient": count,
                "inpatient": 0
            })
        return data

@router.get("/demographics")
def get_patient_demographics(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get patient demographics (gender distribution)"""
    clinic_id = current_user.clinic_id
    
    # Count by gender
    male_count = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.gender == "Male"
        )
    ).scalar() or 0
    
    female_count = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.gender == "Female"
        )
    ).scalar() or 0
    
    other_count = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.gender.notin_(["Male", "Female"])
        )
    ).scalar() or 0
    
    return [
        {"name": "Male", "value": male_count, "color": "#1d8a99"},
        {"name": "Female", "value": female_count, "color": "#6ee7b7"},
        {"name": "Others", "value": other_count, "color": "#d1fae5"}
    ]

@router.get("/revenue")
def get_revenue_analytics(
    period: str = "week",  # week, month, year
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get revenue analytics by time period - shows payments received during the period"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()

    if period == "week":
        # Current week (Monday to Sunday)
        data = []
        days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

        # Find Monday of current week
        days_since_monday = now.weekday()
        monday = (now - timedelta(days=days_since_monday)).replace(hour=0, minute=0, second=0, microsecond=0)

        for i in range(7):
            day_start = monday + timedelta(days=i)
            day_end = day_start + timedelta(days=1)

            # Get payments received during this day (when they were actually paid)
            revenue = db.query(func.sum(Payment.amount)).filter(
                and_(
                    Payment.clinic_id == clinic_id,
                    Payment.status == "success",
                    Payment.created_at >= day_start,
                    Payment.created_at < day_end
                )
            ).scalar() or 0

            # Target can be configured per clinic (for now, use average)
            target = 50000  # Default target

            data.append({
                "day": days[i],
                "revenue": float(revenue),
                "target": target
            })
        return data

    elif period == "month":
        # Current month (daily breakdown)
        data = []
        # Get first day of current month
        month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
        # Get last day of current month
        next_month = (month_start + timedelta(days=32)).replace(day=1)
        month_end = next_month - timedelta(days=1)

        current_date = month_start
        day_count = 1

        while current_date <= month_end and current_date <= now:
            day_end = current_date + timedelta(days=1)

            # Get payments received during this day
            revenue = db.query(func.sum(Payment.amount)).filter(
                and_(
                    Payment.clinic_id == clinic_id,
                    Payment.status == "success",
                    Payment.created_at >= current_date,
                    Payment.created_at < day_end
                )
            ).scalar() or 0

            # Target scales with days in month
            days_in_month = (month_end - month_start).days + 1
            target = (50000 / 30) * days_in_month  # Scale target based on month length

            data.append({
                "day": f"{day_count}",
                "revenue": float(revenue),
                "target": target
            })

            current_date = day_end
            day_count += 1

        return data

    elif period == "year":
        # Current year (monthly breakdown)
        data = []
        months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

        for i in range(12):
            # Get first day of the month
            if i == 0:  # Current month might be partial
                month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                # Go back i months from current month start
                month_start = (now.replace(day=1) - timedelta(days=i*30)).replace(day=1)

            # Get last day of the month
            next_month = (month_start + timedelta(days=32)).replace(day=1)
            month_end = next_month - timedelta(days=1)

            # Don't go beyond current date for current month
            if month_start.year == now.year and month_start.month == now.month:
                month_end = min(month_end, now.replace(hour=23, minute=59, second=59, microsecond=999999))

            # Get payments received during this month
            revenue = db.query(func.sum(Payment.amount)).filter(
                and_(
                    Payment.clinic_id == clinic_id,
                    Payment.status == "success",
                    Payment.created_at >= month_start,
                    Payment.created_at <= month_end
                )
            ).scalar() or 0

            # Monthly target
            target = 50000 * 30  # Rough monthly target

            data.append({
                "day": months[11-i],  # Reverse order so current month is last
                "revenue": float(revenue),
                "target": target
            })

        return data[::-1]  # Reverse to show chronological order

    return []

@router.get("/capacity")
def get_clinic_capacity(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get current clinic capacity utilization based on scheduled appointments"""
    clinic_id = current_user.clinic_id

    # Get today's appointments
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed patient list for drawer view"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    
    query = db.query(Patient).filter(Patient.clinic_id == clinic_id)
    
    if period == "today":
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        query = query.filter(Patient.created_at >= today_start)
    elif period == "week":
        week_ago = now - timedelta(days=7)
        query = query.filter(Patient.created_at >= week_ago)
    elif period == "month":
        month_ago = now - timedelta(days=30)
        query = query.filter(Patient.created_at >= month_ago)
    
    patients = query.order_by(Patient.created_at.desc()).limit(100).all()
    
    return [{
        "id": p.id,
        "name": p.name,
        "age": p.age,
        "gender": p.gender,
        "phone": p.phone,
        "village": p.village,
        "treatment_type": p.scan_type,
        "created_at": p.created_at.isoformat() if p.created_at else None
    } for p in patients]

@router.get("/reports/details")
def get_reports_details(
    status: Optional[str] = None,  # pending, completed, all
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get detailed report list for drawer view"""
    clinic_id = current_user.clinic_id
    
    query = db.query(Report).filter(Report.clinic_id == clinic_id)
    
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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get today's appointments for drawer view"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    # Get appointments scheduled for today
    appointments = db.query(Appointment).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end
        )
    ).order_by(Appointment.start_time.asc()).all()

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

@router.get("/chairs/status")
def get_chairs_status(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get dental chair status with detailed utilization metrics based on scheduled appointments"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    # Get today's scheduled appointments
    appointments_today = db.query(func.count(Appointment.id)).filter(
        and_(
            Appointment.clinic_id == clinic_id,
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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get treatment type statistics"""
    clinic_id = current_user.clinic_id
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
        Patient.scan_type,
        func.count(Patient.id).label('count')
    ).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= start_date,
            Patient.scan_type.isnot(None)
        )
    ).group_by(Patient.scan_type).all()
    
    # Format response
    treatments = []
    total = sum([t.count for t in treatment_counts])
    
    # Common dental treatment colors
    colors = ['#1d8a99', '#6ee7b7', '#fbbf24', '#f87171', '#a78bfa', '#fb923c']
    
    for idx, treatment in enumerate(treatment_counts):
        percentage = (treatment.count / total * 100) if total > 0 else 0
        treatments.append({
            "name": treatment.scan_type,
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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get appointment trends by time slots for today"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)
    
    # Get all appointments for today
    appointments = db.query(Appointment).filter(
        and_(
            Appointment.clinic_id == clinic_id,
            Appointment.appointment_date >= today_start,
            Appointment.appointment_date < today_end
        )
    ).all()
    
    # Define time slots (hourly from 9 AM to 5 PM)
    time_slots = [
        ("9 AM", 9), ("10 AM", 10), ("11 AM", 11), ("12 PM", 12),
        ("1 PM", 13), ("2 PM", 14), ("3 PM", 15), ("4 PM", 16), ("5 PM", 17)
    ]
    
    # Initialize data structure
    trends_data = []
    
    for slot_label, hour in time_slots:
        # Count bookings in this hour
        bookings = 0
        for apt in appointments:
            # Parse start_time string (e.g., "09:00" or "14:30") to get hour
            try:
                if apt.start_time:
                    # Parse time string like "09:00" or "14:30"
                    time_parts = apt.start_time.split(":")
                    if len(time_parts) >= 1:
                        apt_hour = int(time_parts[0])
                        if apt_hour == hour:
                            bookings += 1
            except (ValueError, AttributeError):
                # Fallback to appointment_date hour if start_time parsing fails
                try:
                    apt_hour = apt.appointment_date.hour
                    if apt_hour == hour:
                        bookings += 1
                except:
                    pass
        
        # Estimate capacity (can be made configurable)
        # For now, assume varying capacity based on time of day
        if hour >= 9 and hour <= 11:  # Morning slots
            capacity = 20
        elif hour == 12:  # Lunch time
            capacity = 12
        else:  # Afternoon slots
            capacity = 18
        
        trends_data.append({
            "time": slot_label,
            "bookings": bookings,
            "capacity": capacity
        })
    
    return trends_data

@router.get("/appointments/quality")
def get_appointment_quality(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get appointment quality metrics"""
    clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = now - timedelta(days=7)
    month_ago = now - timedelta(days=30)
    
    # Total appointments (using patient registrations as proxy)
    total_appointments = db.query(func.count(Patient.id)).filter(
        Patient.clinic_id == clinic_id
    ).scalar() or 0
    
    # This week's appointments
    appointments_this_week = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
            Patient.created_at >= week_ago
        )
    ).scalar() or 0
    
    # This month's appointments
    appointments_this_month = db.query(func.count(Patient.id)).filter(
        and_(
            Patient.clinic_id == clinic_id,
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
    
    if user and user.dashboard_preferences:
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
    
    user.dashboard_preferences = preferences
    db.commit()
    
    return {"message": "Preferences saved successfully", "preferences": preferences}

@router.get("/clinic-performance")
def get_clinic_performance(
    compare_clinic_ids: str = None,  # Comma-separated clinic IDs to compare with
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get clinic performance metrics for comparison"""
    current_clinic_id = current_user.clinic_id
    now = datetime.utcnow()
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    # Get current clinic metrics
    current_metrics = _calculate_clinic_metrics(db, current_clinic_id, month_start, now)

    result = {
        "current_clinic": {
            "id": current_clinic_id,
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
    db: Session = Depends(get_db),
    current_user = Depends(get_current_user)
):
    """Get patient locations for map visualization"""
    clinic_id = current_user.clinic_id

    # Get patients with location data (using village as location proxy)
    patients = db.query(Patient).filter(
        and_(
            Patient.clinic_id == clinic_id,
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
