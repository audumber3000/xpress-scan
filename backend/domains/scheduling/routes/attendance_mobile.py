from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from database import get_db
from models import Attendance, User, Clinic
from schemas import AttendanceOut
from core.auth_utils import get_current_user
from pydantic import BaseModel

router = APIRouter()

class ClockInRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None

class ClockOutRequest(BaseModel):
    latitude: float
    longitude: float
    accuracy: Optional[float] = None
    address: Optional[str] = None

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in meters using Haversine formula"""
    from math import radians, cos, sin, asin, sqrt
    
    R = 6371000  # Earth radius in meters
    
    lat1_rad = radians(lat1)
    lat2_rad = radians(lat2)
    delta_lat = radians(lat2 - lat1)
    delta_lon = radians(lon2 - lon1)
    
    a = sin(delta_lat / 2) ** 2 + cos(lat1_rad) * cos(lat2_rad) * sin(delta_lon / 2) ** 2
    c = 2 * asin(sqrt(a))
    
    return R * c

def is_within_clinic_radius(clinic: Clinic, latitude: float, longitude: float, max_radius: float = 100.0):
    """Check if coordinates are within clinic's geofence radius (default 100 meters)"""
    if not clinic.latitude or not clinic.longitude:
        # If clinic doesn't have location set, allow clock in/out from anywhere
        # Admin should set clinic location in settings
        return True
    
    distance = calculate_distance(
        clinic.latitude, 
        clinic.longitude, 
        latitude, 
        longitude
    )
    
    return distance <= max_radius

@router.post("/clock-in", response_model=AttendanceOut)
async def clock_in(
    request: ClockInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock in with location verification"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Check if user is within clinic radius (geofencing)
    if not is_within_clinic_radius(clinic, request.latitude, request.longitude):
        raise HTTPException(
            status_code=403, 
            detail=f"You must be within {100} meters of the clinic to clock in"
        )
    
    # Check if user is already clocked in today
    today = datetime.now().date()
    existing_attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.check_out_time == None
    ).first()
    
    if existing_attendance:
        raise HTTPException(status_code=400, detail="You are already clocked in today")
    
    # Create attendance record
    attendance = Attendance(
        user_id=current_user.id,
        clinic_id=current_user.clinic_id,
        date=today,
        check_in_time=datetime.now(),
        clock_in_latitude=request.latitude,
        clock_in_longitude=request.longitude,
        clock_in_address=request.address,
        clock_in_accuracy=request.accuracy
    )
    
    db.add(attendance)
    db.commit()
    db.refresh(attendance)
    
    return attendance

@router.post("/clock-out", response_model=AttendanceOut)
async def clock_out(
    request: ClockOutRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Clock out with location verification"""
    if not current_user.clinic_id:
        raise HTTPException(status_code=400, detail="User is not associated with a clinic")
    
    clinic = db.query(Clinic).filter(Clinic.id == current_user.clinic_id).first()
    if not clinic:
        raise HTTPException(status_code=404, detail="Clinic not found")
    
    # Check if user is within clinic radius (geofencing)
    if not is_within_clinic_radius(clinic, request.latitude, request.longitude):
        raise HTTPException(
            status_code=403, 
            detail=f"You must be within {100} meters of the clinic to clock out"
        )
    
    # Find today's attendance record
    today = datetime.now().date()
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.check_out_time == None
    ).first()
    
    if not attendance:
        raise HTTPException(status_code=400, detail="You are not clocked in today")
    
    # Update attendance record
    attendance.check_out_time = datetime.now()
    attendance.clock_out_latitude = request.latitude
    attendance.clock_out_longitude = request.longitude
    attendance.clock_out_address = request.address
    attendance.clock_out_accuracy = request.accuracy
    
    # Calculate hours worked
    if attendance.check_in_time:
        time_diff = attendance.check_out_time - attendance.check_in_time
        attendance.hours_worked = time_diff.total_seconds() / 3600
    
    db.commit()
    db.refresh(attendance)
    
    return attendance

@router.get("/status")
async def get_clock_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get current clock in/out status"""
    today = datetime.now().date()
    attendance = db.query(Attendance).filter(
        Attendance.user_id == current_user.id,
        Attendance.date == today,
        Attendance.check_out_time == None
    ).first()
    
    return {
        "is_clocked_in": attendance is not None,
        "attendance_id": attendance.id if attendance else None,
        "clock_in_time": attendance.check_in_time.isoformat() if attendance and attendance.check_in_time else None
    }

@router.get("/history")
async def get_attendance_history(
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get attendance history for current user"""
    attendances = db.query(Attendance).filter(
        Attendance.user_id == current_user.id
    ).order_by(Attendance.date.desc()).offset(skip).limit(limit).all()
    
    return attendances

