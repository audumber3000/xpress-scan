"""
Dependency injection container for clean architecture
"""
from fastapi import Depends
from sqlalchemy.orm import Session
from typing import Callable, TypeVar, Generic
from .interfaces import (
    PatientRepositoryProtocol,
    ClinicRepositoryProtocol,
    UserRepositoryProtocol,
    PaymentRepositoryProtocol,
    AuthRepositoryProtocol,
    PatientServiceProtocol,
    ClinicServiceProtocol,
    UserServiceProtocol,
    PaymentServiceProtocol,
    AuthServiceProtocol
)

# Import implementations from domains
from domains.patient.repositories.patient_repository import PatientRepository
from domains.clinic.repositories.clinic_repository import ClinicRepository
from domains.auth.repositories.user_repository import UserRepository
from domains.finance.repositories.payment_repository import PaymentRepository
from domains.auth.repositories.auth_repository import AuthRepository
from domains.patient.services.patient_service import PatientService
from domains.clinic.services.clinic_service import ClinicService
from domains.auth.services.user_service import UserService
from domains.finance.services.payment_service import PaymentService
from domains.auth.services.auth_service import AuthService
from database import get_db


# Repository dependencies
def get_patient_repository(db: Session = Depends(get_db)) -> PatientRepositoryProtocol:
    """Get patient repository instance"""
    return PatientRepository(db)


def get_clinic_repository(db: Session = Depends(get_db)) -> ClinicRepositoryProtocol:
    """Get clinic repository instance"""
    return ClinicRepository(db)


def get_user_repository(db: Session = Depends(get_db)) -> UserRepositoryProtocol:
    """Get user repository instance"""
    return UserRepository(db)


def get_payment_repository(db: Session = Depends(get_db)) -> PaymentRepositoryProtocol:
    """Get payment repository instance"""
    return PaymentRepository(db)


def get_auth_repository(db: Session = Depends(get_db)) -> AuthRepositoryProtocol:
    """Get auth repository instance"""
    return AuthRepository(db)


# Service dependencies
def get_patient_service(
    patient_repo: PatientRepositoryProtocol = Depends(get_patient_repository),
    clinic_repo: ClinicRepositoryProtocol = Depends(get_clinic_repository),
    payment_repo: PaymentRepositoryProtocol = Depends(get_payment_repository)
) -> PatientServiceProtocol:
    """Get patient service instance"""
    return PatientService(patient_repo, clinic_repo, payment_repo)


def get_clinic_service(
    clinic_repo: ClinicRepositoryProtocol = Depends(get_clinic_repository),
    user_repo: UserRepositoryProtocol = Depends(get_user_repository)
) -> ClinicServiceProtocol:
    """Get clinic service instance"""
    return ClinicService(clinic_repo, user_repo)


def get_user_service(
    user_repo: UserRepositoryProtocol = Depends(get_user_repository),
    clinic_repo: ClinicRepositoryProtocol = Depends(get_clinic_repository)
) -> UserServiceProtocol:
    """Get user service instance"""
    return UserService(user_repo, clinic_repo)


def get_payment_service(
    payment_repo: PaymentRepositoryProtocol = Depends(get_payment_repository),
    patient_repo: PatientRepositoryProtocol = Depends(get_patient_repository),
    clinic_repo: ClinicRepositoryProtocol = Depends(get_clinic_repository)
) -> PaymentServiceProtocol:
    """Get payment service instance"""
    return PaymentService(payment_repo, patient_repo, clinic_repo)


def get_auth_service(
    auth_repo: AuthRepositoryProtocol = Depends(get_auth_repository),
    clinic_repo: ClinicRepositoryProtocol = Depends(get_clinic_repository),
    user_repo: UserRepositoryProtocol = Depends(get_user_repository)
) -> AuthServiceProtocol:
    """Get auth service instance"""
    return AuthService(auth_repo, clinic_repo, user_repo)


# Type hints for cleaner usage in routes
T = TypeVar('T')

class ServiceInjector(Generic[T]):
    """Generic service injector for cleaner route definitions"""

    def __init__(self, service_factory: Callable[..., T]):
        self.service_factory = service_factory

    def __call__(self, *args, **kwargs) -> T:
        return self.service_factory(*args, **kwargs)


# Convenience injectors for routes
PatientServiceDep = ServiceInjector(get_patient_service)
ClinicServiceDep = ServiceInjector(get_clinic_service)
UserServiceDep = ServiceInjector(get_user_service)
PaymentServiceDep = ServiceInjector(get_payment_service)
AuthServiceDep = ServiceInjector(get_auth_service)