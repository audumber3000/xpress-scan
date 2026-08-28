"""
Auth repository implementation
"""
from typing import Optional, Dict, Any
from sqlalchemy import or_
from sqlalchemy.orm import Session
from models import User
from core.interfaces import AuthRepositoryProtocol
from core.login_identifier import (
    find_active_user_by_identifier,
    find_user_by_email,
    find_user_by_identifier,
)
from core.passwords import verify_password


class AuthRepository(AuthRepositoryProtocol):
    """Auth repository with authentication-specific operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email address, ignoring case and stray whitespace."""
        return find_user_by_email(self.db, email)

    def get_user_by_supabase_id(self, supabase_user_id: str) -> Optional[User]:
        """Get user by stored Firebase UID (also used for Apple Sign-In where
        the email may be hidden or absent)."""
        return self.db.query(User).filter(
            User.supabase_user_id == supabase_user_id
        ).first()

    def get_user_by_identifier(self, identifier: str) -> Optional[User]:
        """Look up a user by either email or username (login identifier)."""
        return find_user_by_identifier(self.db, identifier)

    def authenticate_user(self, identifier: str, password: str) -> Optional[User]:
        """Find the account, then check the password against its stored hash.

        This used to put the hash in the WHERE clause and let the database do
        the comparison. That only works while hashing is deterministic, which
        is precisely the property that made the old scheme unsafe: a salted
        hash is different every time it is computed, so there is nothing to
        match on. The password is verified in Python now, against the one hash
        belonging to the one account being signed in to.

        Rehashing a legacy row is the service's job, not this one's, because it
        is a write and this is a lookup.
        """
        user = find_active_user_by_identifier(self.db, identifier)
        if not user or not user.password_hash:
            return None
        return user if verify_password(password, user.password_hash) else None

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