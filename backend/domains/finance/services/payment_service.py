"""
Payment service with business logic
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from core.interfaces import PaymentServiceProtocol, PaymentRepositoryProtocol, PatientRepositoryProtocol, ClinicRepositoryProtocol
from core.dtos import PaymentCreateDTO, PaymentResponseDTO
from models import Payment, Patient


class PaymentService(PaymentServiceProtocol):
    """Payment service containing all payment-related business logic"""

    def __init__(
        self,
        payment_repo: PaymentRepositoryProtocol,
        patient_repo: PatientRepositoryProtocol,
        clinic_repo: ClinicRepositoryProtocol
    ):
        self.payment_repo = payment_repo
        self.patient_repo = patient_repo
        self.clinic_repo = clinic_repo

    def process_payment(self, payment_data: Dict[str, Any], clinic_id: int) -> Payment:
        """Process a new payment with business validations"""
        # Validate clinic
        clinic = self.clinic_repo.get_by_id(clinic_id)
        if not clinic or clinic.status != 'active':
            raise ValueError("Invalid or inactive clinic")

        # Validate patient exists and belongs to clinic
        patient_id = payment_data['patient_id']
        patient = self.patient_repo.get_by_id(patient_id)
        if not patient or patient.clinic_id != clinic_id:
            raise ValueError("Invalid patient for this clinic")

        # Validate amount
        amount = payment_data['amount']
        if amount <= 0:
            raise ValueError("Payment amount must be greater than 0")

        # Validate payment method
        valid_methods = ['Cash', 'Card', 'PayPal', 'Net Banking', 'UPI']
        if payment_data['payment_method'] not in valid_methods:
            raise ValueError(f"Invalid payment method. Must be one of: {', '.join(valid_methods)}")

        # Check for duplicate transaction ID if provided
        transaction_id = payment_data.get('transaction_id')
        if transaction_id:
            existing_payment = self._get_payment_by_transaction_id(transaction_id, clinic_id)
            if existing_payment:
                raise ValueError(f"Payment with transaction ID '{transaction_id}' already exists")

        # Create payment
        payment_dict = payment_data.copy()
        payment_dict['clinic_id'] = clinic_id
        payment_dict['status'] = 'success'  # Default to success for now

        payment = Payment(**payment_dict)
        created_payment = self.payment_repo.create(payment)

        # Update patient's payment status if needed
        self._update_patient_payment_status(patient_id)

        return created_payment

    def get_patient_payments(self, patient_id: int, clinic_id: int) -> List[Payment]:
        """Get all payments for a patient"""
        # Validate patient belongs to clinic
        patient = self.patient_repo.get_by_id(patient_id)
        if not patient or patient.clinic_id != clinic_id:
            return []

        return self.payment_repo.get_by_patient_id(patient_id)

    def get_payment_summary(self, clinic_id: int) -> Dict[str, Any]:
        """Get payment summary for a clinic"""
        return self.payment_repo.get_payment_summary(clinic_id)

    def get_payments_by_date_range(self, clinic_id: int, start_date: datetime, end_date: datetime) -> List[Payment]:
        """Get payments within date range"""
        return self.payment_repo.get_payments_by_date_range(clinic_id, start_date, end_date)

    def get_payments_by_method(self, clinic_id: int, payment_method: str) -> List[Payment]:
        """Get payments by payment method"""
        return self.payment_repo.get_payments_by_method(clinic_id, payment_method)

    def update_payment_status(self, payment_id: int, status: str, clinic_id: int) -> bool:
        """Update payment status"""
        # Validate payment exists and belongs to clinic
        payment = self.payment_repo.get_by_id(payment_id)
        if not payment or payment.clinic_id != clinic_id:
            return False

        # Validate status
        valid_statuses = ['success', 'pending', 'failed', 'refunded']
        if status not in valid_statuses:
            raise ValueError(f"Invalid payment status. Must be one of: {', '.join(valid_statuses)}")

        success = self.payment_repo.update_payment_status(payment_id, status)

        if success:
            # Update patient's payment status
            self._update_patient_payment_status(payment.patient_id)

        return success

    def get_pending_payments(self, clinic_id: int) -> List[Payment]:
        """Get pending payments for a clinic"""
        return self.payment_repo.get_pending_payments(clinic_id)

    def get_payments_with_details(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Get payments with patient and user details"""
        return self.payment_repo.get_payments_with_patient_details(clinic_id, skip, limit)

    def calculate_outstanding_balance(self, patient_id: int, clinic_id: int) -> float:
        """Calculate outstanding balance for a patient"""
        # Validate patient belongs to clinic
        patient = self.patient_repo.get_by_id(patient_id)
        if not patient or patient.clinic_id != clinic_id:
            raise ValueError("Invalid patient for this clinic")

        # Get total paid
        total_paid = self.payment_repo.get_total_by_patient(patient_id)

        # Calculate treatment cost (simplified)
        treatment_cost = self._get_patient_treatment_cost(patient)

        return max(0, treatment_cost - total_paid)

    def _get_payment_by_transaction_id(self, transaction_id: str, clinic_id: int) -> Optional[Payment]:
        """Get payment by transaction ID within clinic"""
        db = self.payment_repo.db
        return db.query(Payment).filter(
            Payment.transaction_id == transaction_id,
            Payment.clinic_id == clinic_id
        ).first()

    def _update_patient_payment_status(self, patient_id: int) -> None:
        """Update patient's payment status based on payments"""
        try:
            total_paid = self.payment_repo.get_total_by_patient(patient_id)
            patient = self.patient_repo.get_by_id(patient_id)

            if patient:
                treatment_cost = self._get_patient_treatment_cost(patient)
                outstanding = max(0, treatment_cost - total_paid)

                # Update payment_type based on balance
                if outstanding == 0:
                    self.patient_repo.update(patient_id, {'payment_type': 'Paid'})
                elif total_paid > 0:
                    self.patient_repo.update(patient_id, {'payment_type': 'Partial'})
                else:
                    self.patient_repo.update(patient_id, {'payment_type': 'Unpaid'})

        except Exception as e:
            # Log error but don't fail the payment operation
            print(f"Failed to update patient payment status: {e}")

    def _get_patient_treatment_cost(self, patient: Patient) -> float:
        """Get treatment cost for a patient"""
        # This is a simplified calculation
        # In a real system, this would consider all invoices and treatments
        from models import TreatmentType

        db = self.patient_repo.db
        treatment_type = db.query(TreatmentType).filter(
            TreatmentType.clinic_id == patient.clinic_id,
            TreatmentType.name == patient.treatment_type,
            TreatmentType.is_active == True
        ).first()

        return treatment_type.price if treatment_type else 2000.0  # Default amount