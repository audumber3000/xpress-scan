"""
Auth repository — database operations for authentication.
"""
from typing import Optional
from sqlalchemy.orm import Session
from models import LabUser


class AuthRepository:
    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[LabUser]:
        return self.db.query(LabUser).filter(LabUser.email == email).first()

    def get_user_by_id(self, user_id: int) -> Optional[LabUser]:
        return self.db.query(LabUser).filter(LabUser.id == user_id).first()

    def create_user(self, user: LabUser) -> LabUser:
        self.db.add(user)
        self.db.commit()
        self.db.refresh(user)
        return user
