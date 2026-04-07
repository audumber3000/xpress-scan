"""
Clinic repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func, or_
from datetime import datetime
from models import Clinic, User
from core.interfaces import ClinicRepositoryProtocol
from domains.infrastructure.repositories.base_repository import BaseRepository


class ClinicRepository(BaseRepository[Clinic], ClinicRepositoryProtocol):
    """Clinic repository with specific clinic operations"""

    def __init__(self, db: Session):
        super().__init__(db, Clinic)

    def get_with_users(self, clinic_id: int) -> Optional[Clinic]:
        """Get clinic with related users"""
        return self.db.query(Clinic).options(
            joinedload(Clinic.users)
        ).filter(Clinic.id == clinic_id).first()

    def get_active_clinics(self, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Get all active clinics"""
        return self.db.query(Clinic).filter(
            Clinic.status == 'active'
        ).offset(skip).limit(limit).all()

    def get_by_subscription_plan(self, plan: str, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Get clinics by subscription plan"""
        return self.db.query(Clinic).filter(
            Clinic.subscription_plan == plan
        ).offset(skip).limit(limit).all()

    def get_clinic_stats(self, clinic_id: int) -> Dict[str, Any]:
        """Get comprehensive clinic statistics"""
        clinic = self.get_by_id(clinic_id)
        if not clinic:
            return {}

        user_count = self.db.query(func.count(User.id)).filter(
            User.clinic_id == clinic_id
        ).scalar()

        # Calculate if clinic is open
        is_open = False
        # Adjust day name to full name for the default timings dict
        full_days = {
            'mon': 'monday', 'tue': 'tuesday', 'wed': 'wednesday',
            'thu': 'thursday', 'fri': 'friday', 'sat': 'saturday', 'sun': 'sunday'
        }
        day_short = datetime.utcnow().strftime('%a').lower()
        day_name = full_days.get(day_short, 'monday')
        
        timings = clinic.timings or {}
        day_config = timings.get(day_name, {})
        
        if day_config and not day_config.get('closed', False):
            # IST is UTC+5:30. 
            now = datetime.utcnow()
            current_time_str = now.strftime('%H:%M')
            open_time = day_config.get('open', '08:00')
            close_time = day_config.get('close', '20:00')
            
            if open_time <= current_time_str <= close_time:
                is_open = True

        return {
            'clinic_info': {
                'id': clinic.id,
                'name': clinic.name,
                'subscription_plan': clinic.subscription_plan,
                'status': clinic.status,
                'created_at': clinic.created_at,
                'address': clinic.address,
                'phone': clinic.phone
            },
            'user_count': user_count,
            'specialization': clinic.specialization,
            'is_open': is_open,
            'timings': timings
        }

    def update_clinic_subscription(self, clinic_id: int, new_plan: str, razorpay_subscription_id: Optional[str] = None) -> bool:
        """Update clinic subscription plan"""
        clinic = self.get_by_id(clinic_id)
        if not clinic:
            return False

        clinic.subscription_plan = new_plan
        if razorpay_subscription_id:
            clinic.razorpay_subscription_id = razorpay_subscription_id

        self.db.commit()
        return True

    def search_clinics(self, query: str, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Search clinics by name or email"""
        search_term = f"%{query}%"
        return self.db.query(Clinic).filter(
            and_(
                Clinic.status == 'active',
                or_(
                    Clinic.name.ilike(search_term),
                    Clinic.email.ilike(search_term)
                )
            )
        ).offset(skip).limit(limit).all()