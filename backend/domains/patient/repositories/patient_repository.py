"""
Patient repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import and_, or_, func, text
from models import Patient, Report, Payment
from core.interfaces import PatientRepositoryProtocol
from domains.infrastructure.repositories.base_repository import BaseRepository


class PatientRepository(BaseRepository[Patient], PatientRepositoryProtocol):
    """Patient repository with specific patient operations"""

    def __init__(self, db: Session):
        super().__init__(db, Patient)

    def get_with_reports(self, patient_id: int) -> Optional[Patient]:
        """Get patient with related reports"""
        return self.db.query(Patient).options(
            joinedload(Patient.reports)
        ).filter(Patient.id == patient_id).first()

    def get_by_phone(self, clinic_id: int, phone: str) -> Optional[Patient]:
        """Get patient by phone number within a clinic"""
        return self.db.query(Patient).filter(
            and_(
                Patient.clinic_id == clinic_id,
                Patient.phone == phone
            )
        ).first()

    def search_by_name(self, clinic_id: int, name: str, skip: int = 0, limit: int = 100) -> List[Patient]:
        """Search patients by name within a clinic"""
        search_term = f"%{name}%"
        return self.db.query(Patient).filter(
            and_(
                Patient.clinic_id == clinic_id,
                or_(
                    Patient.name.ilike(search_term),
                    Patient.phone.ilike(search_term)
                )
            )
        ).offset(skip).limit(limit).all()

    def get_patients_with_payment_summary(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Get patients with their total payment amounts"""
        query = self.db.query(
            Patient,
            func.coalesce(func.sum(Payment.amount), 0).label('total_paid')
        ).outerjoin(Payment, and_(
            Payment.patient_id == Patient.id,
            Payment.status == 'success'
        )).filter(
            Patient.clinic_id == clinic_id
        ).group_by(Patient.id).offset(skip).limit(limit).all()

        result = []
        for patient, total_paid in query:
            patient_dict = {
                'id': patient.id,
                'name': patient.name,
                'phone': patient.phone,
                'age': patient.age,
                'gender': patient.gender,
                'treatment_type': patient.treatment_type,
                'total_paid': float(total_paid),
                'created_at': patient.created_at,
                'updated_at': patient.updated_at
            }
            result.append(patient_dict)

        return result

    def get_recent_patients(self, clinic_id: int, days: int = 30, limit: int = 50) -> List[Patient]:
        """Get patients created within the last N days"""
        from datetime import datetime, timedelta

        cutoff_date = datetime.utcnow() - timedelta(days=days)
        return self.db.query(Patient).filter(
            and_(
                Patient.clinic_id == clinic_id,
                Patient.created_at >= cutoff_date
            )
        ).order_by(Patient.created_at.desc()).limit(limit).all()

    def update_patient_clinic(self, patient_id: int, new_clinic_id: int) -> bool:
        """Update patient's clinic (for data migration)"""
        patient = self.get_by_id(patient_id)
        if not patient:
            return False

        patient.clinic_id = new_clinic_id
        self.db.commit()
        return True

    def get_patient_stats(self, clinic_id: int) -> Dict[str, Any]:
        """Get patient statistics for a clinic"""
        total_patients = self.count_by_clinic_id(clinic_id)

        gender_stats = self.db.query(
            Patient.gender,
            func.count(Patient.id).label('count')
        ).filter(Patient.clinic_id == clinic_id).group_by(Patient.gender).all()

        age_stats = self.db.query(
            func.avg(Patient.age).label('avg_age'),
            func.min(Patient.age).label('min_age'),
            func.max(Patient.age).label('max_age')
        ).filter(Patient.clinic_id == clinic_id).first()

        return {
            'total_patients': total_patients,
            'gender_distribution': {gender: count for gender, count in gender_stats},
            'age_stats': {
                'average': float(age_stats.avg_age) if age_stats.avg_age else 0,
                'min': age_stats.min_age or 0,
                'max': age_stats.max_age or 0
            }
        }