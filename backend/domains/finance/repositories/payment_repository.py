"""
Payment repository implementation
"""
from typing import List, Optional, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import and_, func, desc
from models import Payment, Patient, TreatmentType
from core.interfaces import PaymentRepositoryProtocol
from domains.infrastructure.repositories.base_repository import BaseRepository


class PaymentRepository(BaseRepository[Payment], PaymentRepositoryProtocol):
    """Payment repository with specific payment operations"""

    def __init__(self, db: Session):
        super().__init__(db, Payment)

    def get_by_patient_id(self, patient_id: int) -> List[Payment]:
        """Get all payments for a specific patient"""
        return self.db.query(Payment).filter(
            Payment.patient_id == patient_id
        ).order_by(desc(Payment.created_at)).all()

    def get_total_by_patient(self, patient_id: int) -> float:
        """Get total payment amount for a patient"""
        result = self.db.query(func.sum(Payment.amount)).filter(
            and_(
                Payment.patient_id == patient_id,
                Payment.status == 'success'
            )
        ).scalar()

        return float(result) if result else 0.0

    def get_payments_by_date_range(self, clinic_id: int, start_date, end_date, skip: int = 0, limit: int = 100) -> List[Payment]:
        """Get payments within a date range for a clinic"""
        return self.db.query(Payment).filter(
            and_(
                Payment.clinic_id == clinic_id,
                Payment.created_at >= start_date,
                Payment.created_at <= end_date
            )
        ).order_by(desc(Payment.created_at)).offset(skip).limit(limit).all()

    def get_payments_by_method(self, clinic_id: int, payment_method: str, skip: int = 0, limit: int = 100) -> List[Payment]:
        """Get payments by payment method for a clinic"""
        return self.db.query(Payment).filter(
            and_(
                Payment.clinic_id == clinic_id,
                Payment.payment_method == payment_method
            )
        ).order_by(desc(Payment.created_at)).offset(skip).limit(limit).all()

    def get_payment_summary(self, clinic_id: int) -> Dict[str, Any]:
        """Get payment summary statistics for a clinic"""
        total_amount = self.db.query(func.sum(Payment.amount)).filter(
            and_(
                Payment.clinic_id == clinic_id,
                Payment.status == 'success'
            )
        ).scalar()

        method_stats = self.db.query(
            Payment.payment_method,
            func.count(Payment.id).label('count'),
            func.sum(Payment.amount).label('total')
        ).filter(
            and_(
                Payment.clinic_id == clinic_id,
                Payment.status == 'success'
            )
        ).group_by(Payment.payment_method).all()

        return {
            'total_amount': float(total_amount) if total_amount else 0.0,
            'method_breakdown': {
                method: {'count': count, 'total': float(total)}
                for method, count, total in method_stats
            }
        }

    def get_pending_payments(self, clinic_id: int) -> List[Payment]:
        """Get pending payments for a clinic"""
        return self.db.query(Payment).filter(
            and_(
                Payment.clinic_id == clinic_id,
                Payment.status == 'pending'
            )
        ).order_by(Payment.created_at).all()

    def update_payment_status(self, payment_id: int, status: str) -> bool:
        """Update payment status"""
        payment = self.get_by_id(payment_id)
        if not payment:
            return False

        payment.status = status
        self.db.commit()
        return True

    def get_payments_with_patient_details(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Get payments with patient details"""
        from sqlalchemy.orm import joinedload

        payments = self.db.query(Payment).options(
            joinedload(Payment.patient),
            joinedload(Payment.received_by_user)
        ).filter(Payment.clinic_id == clinic_id).offset(skip).limit(limit).all()

        result = []
        for payment in payments:
            payment_dict = {
                'id': payment.id,
                'amount': payment.amount,
                'payment_method': payment.payment_method,
                'status': payment.status,
                'transaction_id': payment.transaction_id,
                'notes': payment.notes,
                'created_at': payment.created_at,
                'patient': {
                    'id': payment.patient.id,
                    'name': payment.patient.name,
                    'phone': payment.patient.phone
                } if payment.patient else None,
                'received_by': {
                    'id': payment.received_by_user.id,
                    'name': payment.received_by_user.name
                } if payment.received_by_user else None
            }
            result.append(payment_dict)

        return result