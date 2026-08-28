"""
User repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from models import User, Clinic
from core.interfaces import UserRepositoryProtocol
from core.login_identifier import find_active_user_by_identifier, find_user_by_email
from core.passwords import verify_password
from domains.infrastructure.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User], UserRepositoryProtocol):
    """User repository with specific user operations"""

    def __init__(self, db: Session):
        super().__init__(db, User)

    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address, ignoring case and stray whitespace."""
        return find_user_by_email(self.db, email)

    def get_by_clinic_id_and_role(self, clinic_id: int, role: str) -> List[User]:
        """Get users by clinic and role"""
        return self.db.query(User).filter(
            and_(
                User.clinic_id == clinic_id,
                User.role == role,
                User.is_active == True
            )
        ).all()

    def get_clinic_owners(self, clinic_id: int) -> List[User]:
        """Get clinic owners for a specific clinic"""
        return self.get_by_clinic_id_and_role(clinic_id, 'clinic_owner')

    def get_doctors(self, clinic_id: int) -> List[User]:
        """Get doctors for a specific clinic"""
        return self.get_by_clinic_id_and_role(clinic_id, 'doctor')

    def authenticate_user(self, identifier: str, password: str) -> Optional[User]:
        """Find the account, then verify the password. See AuthRepository."""
        user = find_active_user_by_identifier(self.db, identifier)
        if not user or not user.password_hash:
            return None
        return user if verify_password(password, user.password_hash) else None

    def update_user_permissions(self, user_id: int, permissions: Dict[str, Any]) -> bool:
        """Update user permissions"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        user.permissions = permissions
        self.db.commit()
        return True

    def get_users_without_clinic(self) -> List[User]:
        """Get users who haven't completed clinic onboarding"""
        return self.db.query(User).filter(
            and_(
                User.clinic_id.is_(None),
                User.is_active == True
            )
        ).all()

    def transfer_user_to_clinic(self, user_id: int, clinic_id: int) -> bool:
        """Transfer user to a different clinic and add it to their association list"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        user.clinic_id = clinic_id
        
        # Add to associated clinics if not already there
        clinic = self.db.query(Clinic).filter(Clinic.id == clinic_id).first()
        if clinic and clinic not in user.clinics:
            user.clinics.append(clinic)
            
        self.db.commit()
        return True

    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate a user account"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        user.is_active = False
        self.db.commit()
        return True

    def get_user_stats(self, clinic_id: Optional[int] = None) -> Dict[str, Any]:
        """Get user statistics"""
        query = self.db.query(User.role, func.count(User.id))

        if clinic_id:
            query = query.filter(User.clinic_id == clinic_id)

        role_stats = query.group_by(User.role).all()

        return {
            'total_users': sum(count for _, count in role_stats),
            'role_distribution': {role: count for role, count in role_stats}
        }