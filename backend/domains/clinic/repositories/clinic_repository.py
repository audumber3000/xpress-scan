"""
Clinic repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, func
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

        return {
            'clinic_info': {
                'id': clinic.id,
                'name': clinic.name,
                'subscription_plan': clinic.subscription_plan,
                'status': clinic.status,
                'created_at': clinic.created_at
            },
            'user_count': user_count,
            'specialization': clinic.specialization
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