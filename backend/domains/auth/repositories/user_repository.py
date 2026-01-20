"""
User repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func
from models import User, Clinic
from core.interfaces import UserRepositoryProtocol
from domains.infrastructure.repositories.base_repository import BaseRepository


class UserRepository(BaseRepository[User], UserRepositoryProtocol):
    """User repository with specific user operations"""

    def __init__(self, db: Session):
        super().__init__(db, User)

    def get_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        return self.db.query(User).filter(User.email == email).first()

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

    def authenticate_user(self, email: str, password_hash: str) -> Optional[User]:
        """Authenticate user with email and password hash"""
        return self.db.query(User).filter(
            and_(
                User.email == email,
                User.password_hash == password_hash,
                User.is_active == True
            )
        ).first()

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
        """Transfer user to a different clinic"""
        user = self.get_by_id(user_id)
        if not user:
            return False

        user.clinic_id = clinic_id
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