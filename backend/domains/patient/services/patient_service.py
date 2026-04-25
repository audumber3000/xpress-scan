"""
Patient service with business logic
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from core.interfaces import PatientServiceProtocol, PatientRepositoryProtocol, ClinicRepositoryProtocol, PaymentRepositoryProtocol
from core.dtos import PatientCreateDTO, PatientUpdateDTO, PatientResponseDTO, PatientSummaryDTO
from models import Patient, Clinic, TreatmentType, Invoice, InvoiceLineItem, Appointment
from sqlalchemy import func, cast, Integer


class PatientService(PatientServiceProtocol):
    """Patient service containing all patient-related business logic"""

    def __init__(
        self,
        patient_repo: PatientRepositoryProtocol,
        clinic_repo: ClinicRepositoryProtocol,
        payment_repo: PaymentRepositoryProtocol
    ):
        self.patient_repo = patient_repo
        self.clinic_repo = clinic_repo
        self.payment_repo = payment_repo

    def create_patient(self, patient_data: Dict[str, Any], clinic_id: int) -> Patient:
        """Create a new patient with business validations"""
        # Validate clinic exists and is active
        clinic = self.clinic_repo.get_by_id(clinic_id)
        if not clinic or clinic.status != 'active':
            raise ValueError("Invalid or inactive clinic")

        # Note: Phone duplicate check removed to allow multiple patients with same phone
        # This is needed for appointment workflow where duplicates are handled separately

        # Validate treatment type exists in clinic
        if 'treatment_type' in patient_data:
            treatment_type = self._validate_treatment_type(patient_data['treatment_type'], clinic_id)
            if not treatment_type:
                # Auto-create the treatment type with default price instead of failing
                try:
                    from models import TreatmentType
                    db = getattr(self.patient_repo, 'db', None)
                    if db:
                        new_tf = TreatmentType(
                            clinic_id=clinic_id,
                            name=patient_data['treatment_type'],
                            price=2000.0,
                            is_active=True
                        )
                        db.add(new_tf)
                        db.flush()
                except Exception as e:
                    print(f"Warning: Could not auto-create treatment type: {e}")

        # Create patient
        patient_dict = patient_data.copy()
        patient_dict['clinic_id'] = clinic_id

        # Generate a 6-digit display_id per clinic (MAX(numeric display_id) + 1, starting at 100001).
        # Using MAX rather than COUNT defends against collisions when patients are deleted.
        if not patient_dict.get('display_id'):
            db = self.patient_repo.db
            max_id = db.query(func.max(cast(Patient.display_id, Integer))).filter(
                Patient.clinic_id == clinic_id,
                Patient.display_id.isnot(None),
                Patient.display_id.op('~')(r'^[0-9]+$'),
            ).scalar() or 100000
            patient_dict['display_id'] = str(max_id + 1)

        patient = Patient(**patient_dict)
        created_patient = self.patient_repo.create(patient)

        return created_patient

    def get_patient(self, patient_id: int, clinic_id: int) -> Optional[Patient]:
        """Get a patient with clinic validation, enriched with last_visit."""
        patient = self.patient_repo.get_by_id(patient_id)
        if not patient or patient.clinic_id != clinic_id:
            return None
        self._attach_last_visit([patient])
        return patient

    def get_patients(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Patient]:
        """Get patients for a clinic, enriched with `last_visit` (transient attr).

        last_visit prefers the most recent real appointment (checking/completed/accepted),
        falls back to the most recent invoice, finally to the patient's created_at.
        """
        patients = self.patient_repo.get_by_clinic_id(clinic_id, skip, limit)
        self._attach_last_visit(patients)
        return patients

    def _attach_last_visit(self, patients: List[Patient]) -> None:
        """Set the transient `last_visit` attribute on each patient via two bulk queries."""
        if not patients:
            return
        db = self.patient_repo.db
        patient_ids = [p.id for p in patients]

        appt_rows = db.query(
            Appointment.patient_id,
            func.max(Appointment.appointment_date).label('last_date'),
        ).filter(
            Appointment.patient_id.in_(patient_ids),
            Appointment.status.in_(['checking', 'completed', 'accepted']),
        ).group_by(Appointment.patient_id).all()
        appt_map = {row.patient_id: row.last_date for row in appt_rows}

        inv_rows = db.query(
            Invoice.patient_id,
            func.max(Invoice.created_at).label('last_date'),
        ).filter(Invoice.patient_id.in_(patient_ids)).group_by(Invoice.patient_id).all()
        inv_map = {row.patient_id: row.last_date for row in inv_rows}

        for p in patients:
            p.last_visit = appt_map.get(p.id) or inv_map.get(p.id) or p.created_at

    def update_patient(self, patient_id: int, updates: Dict[str, Any], clinic_id: int) -> Optional[Patient]:
        """Update patient with business validations"""
        # Check if patient exists and belongs to clinic
        existing_patient = self.get_patient(patient_id, clinic_id)
        if not existing_patient:
            return None

        # Validate phone number uniqueness if being updated
        if 'phone' in updates and updates['phone'] != existing_patient.phone:
            duplicate_patient = self.patient_repo.get_by_phone(clinic_id, updates['phone'])
            if duplicate_patient and duplicate_patient.id != patient_id:
                raise ValueError(f"Patient with phone number {updates['phone']} already exists in this clinic")

        # Validate treatment type if being updated
        if 'treatment_type' in updates:
            treatment_type = self._validate_treatment_type(updates['treatment_type'], clinic_id)
            if not treatment_type:
                # Auto-create the treatment type with default price instead of failing
                try:
                    from models import TreatmentType
                    db = getattr(self.patient_repo, 'db', None)
                    if db:
                        new_tf = TreatmentType(
                            clinic_id=clinic_id,
                            name=updates['treatment_type'],
                            price=2000.0,
                            is_active=True
                        )
                        db.add(new_tf)
                        db.flush()
                except Exception as e:
                    print(f"Warning: Could not auto-create treatment type during update: {e}")

        return self.patient_repo.update(patient_id, updates)

    def delete_patient(self, patient_id: int, clinic_id: int) -> bool:
        """Delete patient with business validations"""
        # Check if patient exists and belongs to clinic
        patient = self.get_patient(patient_id, clinic_id)
        if not patient:
            return False

        # Check if patient has payments (prevent deletion if they do)
        payments = self.payment_repo.get_by_patient_id(patient_id)
        if payments:
            raise ValueError("Cannot delete patient with existing payments. Consider deactivating instead.")

        # Check if patient has reports (prevent deletion if they do)
        if hasattr(patient, 'reports') and patient.reports:
            raise ValueError("Cannot delete patient with existing reports.")

        return self.patient_repo.delete(patient_id)

    def search_patients(self, clinic_id: int, query: str, skip: int = 0, limit: int = 100) -> List[Patient]:
        """Search patients by name or phone, enriched with last_visit."""
        if not query or len(query.strip()) < 2:
            return []

        results = self.patient_repo.search_by_name(clinic_id, query.strip(), skip, limit)
        self._attach_last_visit(results)
        return results

    def check_duplicates(self, clinic_id: int, name: Optional[str] = None, phone: Optional[str] = None, email: Optional[str] = None) -> List[Patient]:
        """Check for potential duplicate patients"""
        return self.patient_repo.search_duplicates(clinic_id, name, phone, email)

    def get_patient_with_payment_summary(self, patient_id: int, clinic_id: int) -> Optional[Dict[str, Any]]:
        """Get patient with payment summary"""
        patient = self.get_patient(patient_id, clinic_id)
        if not patient:
            return None

        total_paid = self.payment_repo.get_total_by_patient(patient_id)

        return {
            'patient': patient,
            'total_paid': total_paid,
            'outstanding_balance': self._calculate_outstanding_balance(patient, total_paid)
        }

    def get_patients_with_summaries(self, clinic_id: int, skip: int = 0, limit: int = 100) -> List[Dict[str, Any]]:
        """Get patients with payment summaries"""
        return self.patient_repo.get_patients_with_payment_summary(clinic_id, skip, limit)

    def get_recent_patients(self, clinic_id: int, days: int = 30) -> List[Patient]:
        """Get recently added patients"""
        return self.patient_repo.get_recent_patients(clinic_id, days)

    def get_patient_stats(self, clinic_id: int) -> Dict[str, Any]:
        """Get comprehensive patient statistics"""
        return self.patient_repo.get_patient_stats(clinic_id)

    def _validate_treatment_type(self, treatment_name: str, clinic_id: int) -> Optional[TreatmentType]:
        """Validate that treatment type exists in clinic"""
        # This would typically be done through a treatment type repository
        # For now, we'll do a simple query
        from models import TreatmentType
        from sqlalchemy.orm import Session

        # Get the db session from the repository
        db = self.patient_repo.db  # Access db through repository
        return db.query(TreatmentType).filter(
            TreatmentType.clinic_id == clinic_id,
            TreatmentType.name == treatment_name,
            TreatmentType.is_active == True
        ).first()

    def _create_draft_invoice(self, patient: Patient, clinic_id: int) -> None:
        """Create a draft invoice for the patient"""
        try:
            # Get treatment type to determine price
            treatment_type = self._validate_treatment_type(patient.treatment_type, clinic_id)
            amount = treatment_type.price if treatment_type else 2000.0  # Default amount

            # Generate invoice number
            invoice_number = self._generate_invoice_number(clinic_id)

            # Create invoice
            invoice = Invoice(
                clinic_id=clinic_id,
                patient_id=patient.id,
                invoice_number=invoice_number,
                status='draft',
                subtotal=amount,
                tax=0.0,
                total=amount
            )

            # Create invoice line item
            line_item = InvoiceLineItem(
                invoice=invoice,
                description=f"{patient.treatment_type} treatment",
                quantity=1.0,
                unit_price=amount,
                amount=amount
            )

            # Save to database
            db = self.patient_repo.db
            db.add(invoice)
            db.add(line_item)
            db.commit()

        except Exception as e:
            # Log error but don't fail patient creation
            print(f"Failed to create draft invoice for patient {patient.id}: {e}")
            self.patient_repo.db.rollback()

    def _generate_invoice_number(self, clinic_id: int) -> str:
        """Generate unique invoice number"""
        year = datetime.utcnow().year
        db = self.patient_repo.db

        # Get last invoice number for this year
        last_invoice = db.query(Invoice).filter(
            Invoice.clinic_id == clinic_id,
            Invoice.invoice_number.like(f"INV-{year}-%")
        ).order_by(Invoice.invoice_number.desc()).first()

        if last_invoice:
            try:
                last_num = int(last_invoice.invoice_number.split('-')[-1])
                new_num = last_num + 1
            except (ValueError, IndexError):
                new_num = 1
        else:
            new_num = 1

        return f"INV-{year}-{new_num:04d}"

    def _calculate_outstanding_balance(self, patient: Patient, total_paid: float) -> float:
        """Calculate outstanding balance for patient"""
        # This is a simplified calculation
        # In a real system, this would consider all invoices, payments, etc.
        treatment_type = self._validate_treatment_type(patient.treatment_type, patient.clinic_id)
        treatment_cost = treatment_type.price if treatment_type else 2000.0

        return max(0, treatment_cost - total_paid)