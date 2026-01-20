from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import List, Optional
from datetime import datetime, timedelta, date
from database import get_db
from models import Attendance, User
from core.auth_utils import get_current_user
from schemas import AttendanceOut, AttendanceCreate, AttendanceUpdate

router = APIRouter()

@router.get("/", response_model=List[AttendanceOut])
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
                'phone': None,  # Add phone field to User model if needed
                'avatar': None,  # Add avatar field to User model if needed
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
    """Get attendance records for a specific week"""
    try:
        # Check if user has a clinic_id
        if not current_user.clinic_id:
            return {
                'week_start': week_start,
                'employees': []
            }
        
        start_date = datetime.strptime(week_start, "%Y-%m-%d")
        end_date = start_date + timedelta(days=7)
        
        # Get all employees
        employees = db.query(User).filter(
            User.clinic_id == current_user.clinic_id,
            User.is_active == True
        ).all()
        
        # Get attendance records for the week
        attendance_records = db.query(Attendance).filter(
            Attendance.clinic_id == current_user.clinic_id,
            Attendance.date >= start_date,
            Attendance.date < end_date
        ).all()
        
        # Build attendance map: {user_id: {date: {status, reason}}}
        attendance_map = {}
        for record in attendance_records:
            if record.user_id not in attendance_map:
                attendance_map[record.user_id] = {}
            date_key = record.date.strftime("%Y-%m-%d")
            attendance_map[record.user_id][date_key] = {
                'status': record.status,
                'reason': record.reason or ''
            }
        
        # Build result
        employees_data = []
        for employee in employees:
            employee_attendance = {}
            for day_offset in range(7):
                current_date = start_date + timedelta(days=day_offset)
                date_key = current_date.strftime("%Y-%m-%d")
                employee_attendance[date_key] = attendance_map.get(employee.id, {}).get(date_key, {
                    'status': 'on_time',
                    'reason': ''
                })
            
            employees_data.append({
                'id': employee.id,
                'name': employee.name,
                'email': employee.email,
                'role': employee.role,
                'phone': None,
                'avatar': None,
                'attendance': employee_attendance
            })
        
        return {
            'week_start': week_start,
            'employees': employees_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching week attendance: {str(e)}")

@router.post("/", response_model=AttendanceOut, status_code=201)
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
            # Update existing record
            existing.status = attendance.status
            existing.check_in_time = attendance.check_in_time
            existing.check_out_time = attendance.check_out_time
            existing.reason = attendance.reason
            existing.notes = attendance.notes
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



