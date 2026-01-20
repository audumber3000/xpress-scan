"""
Auth repository implementation
"""
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session
from models import User
from core.interfaces import AuthRepositoryProtocol


class AuthRepository(AuthRepositoryProtocol):
    """Auth repository with authentication-specific operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address"""
        return self.db.query(User).filter(User.email == email).first()

    def authenticate_user(self, email: str, password_hash: str) -> Optional[User]:
        """Authenticate user with email and password hash"""
        return self.db.query(User).filter(
            User.email == email,
            User.password_hash == password_hash,
            User.is_active == True
        ).first()

    def validate_session(self, user_id: int) -> Optional[User]:
        """Validate user session by checking if user exists and is active"""
        return self.db.query(User).filter(
            User.id == user_id,
            User.is_active == True
        ).first()

    def get_user_with_clinic(self, user_id: int) -> Optional[Dict[str, Any]]:
        """Get user with clinic information"""
        from sqlalchemy.orm import joinedload

        user = self.db.query(User).options(
            joinedload(User.clinic)
        ).filter(User.id == user_id).first()

        if not user:
            return None

        return {
            'user': user,
            'clinic': user.clinic
        }