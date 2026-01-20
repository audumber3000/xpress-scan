"""
Core interfaces for clean architecture
"""
from abc import ABC, abstractmethod
from typing import List, Optional, Dict, Any, Protocol
from sqlalchemy.orm import Session


class BaseRepositoryProtocol(Protocol):
    """Base repository interface"""

    def get_by_id(self, model_id: int) -> Optional[Any]:
        ...

    def get_by_clinic_id(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Any]:
        ...

    def create(self, obj: Any) -> Any:
        ...

    def update(self, model_id: int, updates: Dict[str, Any]) -> Optional[Any]:
        ...

    def delete(self, model_id: int) -> bool:
        ...


class PatientRepositoryProtocol(BaseRepositoryProtocol, Protocol):
    """Patient-specific repository interface"""

    def get_with_reports(self, patient_id: int) -> Optional[Any]:
        ...

    def get_by_phone(self, clinic_id: int, phone: str) -> Optional[Any]:
        ...

    def search_by_name(self, clinic_id: int, name: str, skip: int = 0, limit: int = 100) -> List[Any]:
        ...


class ClinicRepositoryProtocol(BaseRepositoryProtocol, Protocol):
    """Clinic-specific repository interface"""

    def get_with_users(self, clinic_id: int) -> Optional[Any]:
        ...

    def get_active_clinics(self, skip: int = 0, limit: int = 100) -> List[Any]:
        ...


class UserRepositoryProtocol(BaseRepositoryProtocol, Protocol):
    """User-specific repository interface"""

    def get_by_email(self, email: str) -> Optional[Any]:
        ...

    def get_by_clinic_id_and_role(self, clinic_id: int, role: str) -> List[Any]:
        ...


class PaymentRepositoryProtocol(BaseRepositoryProtocol, Protocol):
    """Payment-specific repository interface"""

    def get_by_patient_id(self, patient_id: int) -> List[Any]:
        ...

    def get_total_by_patient(self, patient_id: int) -> float:
        ...


class AuthRepositoryProtocol(Protocol):
    """Auth repository interface"""

    def get_user_by_email(self, email: str) -> Optional[Any]:
        ...

    def authenticate_user(self, email: str, password_hash: str) -> Optional[Any]:
        ...

    def validate_session(self, token: str) -> Optional[Any]:
        ...


class BaseServiceProtocol(Protocol):
    """Base service interface"""

    pass


class PatientServiceProtocol(BaseServiceProtocol, Protocol):
    """Patient service interface"""

    def create_patient(self, patient_data: Dict[str, Any], clinic_id: int) -> Any:
        ...

    def get_patient(self, patient_id: int, clinic_id: int) -> Optional[Any]:
        ...

    def get_patients(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Any]:
        ...

    def update_patient(self, patient_id: int, updates: Dict[str, Any], clinic_id: int) -> Optional[Any]:
        ...

    def delete_patient(self, patient_id: int, clinic_id: int) -> bool:
        ...

    def search_patients(self, clinic_id: int, query: str, skip: int = 0, limit: int = 100) -> List[Any]:
        ...


class ClinicServiceProtocol(BaseServiceProtocol, Protocol):
    """Clinic service interface"""

    def create_clinic(self, clinic_data: Dict[str, Any]) -> Any:
        ...

    def get_clinic(self, clinic_id: int) -> Optional[Any]:
        ...

    def update_clinic(self, clinic_id: int, updates: Dict[str, Any]) -> Optional[Any]:
        ...


class UserServiceProtocol(BaseServiceProtocol, Protocol):
    """User service interface"""

    def create_user(self, user_data: Dict[str, Any], clinic_id: Optional[int] = None) -> Any:
        ...

    def get_user(self, user_id: int) -> Optional[Any]:
        ...

    def authenticate_user(self, email: str, password: str) -> Optional[Any]:
        ...


class PaymentServiceProtocol(BaseServiceProtocol, Protocol):
    """Payment service interface"""

    def process_payment(self, payment_data: Dict[str, Any], clinic_id: int) -> Any:
        ...

    def get_patient_payments(self, patient_id: int, clinic_id: int) -> List[Any]:
        ...


class AuthServiceProtocol(BaseServiceProtocol, Protocol):
    """Auth service interface"""

    def authenticate_user(self, email: str, password: str) -> Optional[Any]:
        ...

    def create_user(self, user_data: Dict[str, Any], clinic_id: Optional[int] = None) -> Any:
        ...

    def get_current_user(self, user_id: int) -> Optional[Any]:
        ...

    def validate_token(self, token: str) -> Optional[Any]:
        ...

    def register_device(self, user_id: int, device_info: Dict[str, Any]) -> Any:
        ...