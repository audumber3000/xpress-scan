"""
Base repository implementation with common CRUD operations
"""
from typing import List, Optional, Dict, Any, Type, TypeVar, Generic
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, text
from core.interfaces import BaseRepositoryProtocol

T = TypeVar('T')


class BaseRepository(BaseRepositoryProtocol, Generic[T]):
    """Base repository with common CRUD operations"""

    def __init__(self, db: Session, model_class: Type[T]):
        self.db = db
        self.model_class = model_class

    def get_by_id(self, model_id: int) -> Optional[T]:
        """Get a record by its ID"""
        return self.db.query(self.model_class).filter(
            self.model_class.id == model_id
        ).first()

    def get_by_clinic_id(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[T]:
        """Get records by clinic_id with pagination"""
        return self.db.query(self.model_class).filter(
            self.model_class.clinic_id == clinic_id
        ).offset(skip).limit(limit).all()

    def create(self, obj: T) -> T:
        """Create a new record"""
        self.db.add(obj)
        self.db.commit()
        self.db.refresh(obj)
        return obj

    def update(self, model_id: int, updates: Dict[str, Any]) -> Optional[T]:
        """Update a record by ID"""
        obj = self.get_by_id(model_id)
        if not obj:
            return None

        for key, value in updates.items():
            if hasattr(obj, key):
                setattr(obj, key, value)

        self.db.commit()
        self.db.refresh(obj)
        return obj

    def delete(self, model_id: int) -> bool:
        """Delete a record by ID"""
        obj = self.get_by_id(model_id)
        if not obj:
            return False

        self.db.delete(obj)
        self.db.commit()
        return True

    def get_all(self, skip: int = 0, limit: int = 100) -> List[T]:
        """Get all records with pagination"""
        return self.db.query(self.model_class).offset(skip).limit(limit).all()

    def count_by_clinic_id(self, clinic_id: int) -> int:
        """Count records by clinic_id"""
        return self.db.query(self.model_class).filter(
            self.model_class.clinic_id == clinic_id
        ).count()

    def exists_by_id_and_clinic(self, model_id: int, clinic_id: int) -> bool:
        """Check if record exists by ID and clinic_id"""
        return self.db.query(self.model_class).filter(
            and_(
                self.model_class.id == model_id,
                self.model_class.clinic_id == clinic_id
            )
        ).first() is not None