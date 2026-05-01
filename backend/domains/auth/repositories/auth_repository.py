"""
Auth repository implementation
"""
from typing import Optional, Dict, Any
from sqlalchemy import or_
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

    def get_user_by_identifier(self, identifier: str) -> Optional[User]:
        """Look up a user by either email or username (login identifier)."""
        return self.db.query(User).filter(
            or_(User.email == identifier, User.username == identifier)
        ).first()

    def authenticate_user(self, email: str, password_hash: str) -> Optional[User]:
        """Authenticate user by login identifier (email OR username) + password hash.

        The first arg is named ``email`` for backward compatibility with the
        ``AuthRepositoryProtocol`` interface, but it now accepts either an
        email address or a username — staff accounts have no email.
        """
        return self.db.query(User).filter(
            or_(User.email == email, User.username == email),
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
            joinedload(User.active_clinic)
        ).filter(User.id == user_id).first()

        if not user:
            return None

        return {
            'user': user,
            'clinic': user.active_clinic
        }