"""
Treatment Plan service with business logic
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session
from models import Patient, Appointment, User


class TreatmentPlanService:
    """Service for managing treatment plans with appointment integration"""

    def __init__(self, db: Session):
        self.db = db

    def get_treatment_plans(self, patient_id: int, clinic_id: int) -> List[Dict[str, Any]]:
        """Get all treatment plans for a patient"""
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id
        ).first()

        if not patient:
            raise ValueError("Patient not found")

        return patient.treatment_plan or []

    def create_treatment_plan(
        self,
        patient_id: int,
        clinic_id: int,
        plan_data: Dict[str, Any],
        create_appointment: bool = True
    ) -> Dict[str, Any]:
        """
        Create a new treatment plan item and optionally create an appointment
        
        Args:
            patient_id: Patient ID
            clinic_id: Clinic ID
            plan_data: Treatment plan data (procedure, tooth, date, cost, notes, etc.)
            create_appointment: Whether to create an appointment for this plan
        """
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id
        ).first()

        if not patient:
            raise ValueError("Patient not found")

        # Get existing treatment plans
        treatment_plans = patient.treatment_plan or []

        # Create new plan item
        new_plan = {
            "id": plan_data.get("id") or datetime.now().timestamp(),
            "procedure": plan_data.get("procedure"),
            "tooth": plan_data.get("tooth"),
            "date": plan_data.get("date"),
            "time": plan_data.get("time", "10:00"),
            "visit_number": plan_data.get("visit_number", len(treatment_plans) + 1),
            "status": plan_data.get("status", "planned"),
            "cost": plan_data.get("cost", 0),
            "notes": plan_data.get("notes", ""),
            "created_at": datetime.utcnow().isoformat(),
            "appointment_id": None  # Will be set if appointment is created
        }

        # Create appointment if requested and date/time are provided
        if create_appointment and plan_data.get("date") and plan_data.get("time"):
            try:
                appointment = self._create_appointment_from_plan(
                    patient=patient,
                    plan_data=plan_data,
                    clinic_id=clinic_id
                )
                new_plan["appointment_id"] = appointment.id
            except Exception as e:
                print(f"Failed to create appointment for treatment plan: {e}")
                # Continue without appointment

        # Add to treatment plans
        treatment_plans.append(new_plan)
        patient.treatment_plan = treatment_plans

        self.db.commit()
        self.db.refresh(patient)

        return new_plan

    def update_treatment_plan(
        self,
        patient_id: int,
        clinic_id: int,
        plan_id: Any,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """Update a treatment plan item"""
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id
        ).first()

        if not patient:
            raise ValueError("Patient not found")

        treatment_plans = patient.treatment_plan or []
        
        # Find and update the plan
        updated = False
        for plan in treatment_plans:
            if str(plan.get("id")) == str(plan_id):
                # Update fields
                for key, value in updates.items():
                    if key != "id":
                        plan[key] = value
                plan["updated_at"] = datetime.utcnow().isoformat()
                updated = True

                # Update associated appointment if date/time changed
                if plan.get("appointment_id") and ("date" in updates or "time" in updates):
                    self._update_appointment_from_plan(plan, updates)

                break

        if not updated:
            return None

        patient.treatment_plan = treatment_plans
        self.db.commit()
        self.db.refresh(patient)

        return next((p for p in treatment_plans if str(p.get("id")) == str(plan_id)), None)

    def delete_treatment_plan(
        self,
        patient_id: int,
        clinic_id: int,
        plan_id: Any,
        delete_appointment: bool = True
    ) -> bool:
        """Delete a treatment plan item and optionally its associated appointment"""
        patient = self.db.query(Patient).filter(
            Patient.id == patient_id,
            Patient.clinic_id == clinic_id
        ).first()

        if not patient:
            raise ValueError("Patient not found")

        treatment_plans = patient.treatment_plan or []
        
        # Find the plan to delete
        plan_to_delete = None
        for plan in treatment_plans:
            if str(plan.get("id")) == str(plan_id):
                plan_to_delete = plan
                break

        if not plan_to_delete:
            return False

        # Delete associated appointment if requested
        if delete_appointment and plan_to_delete.get("appointment_id"):
            try:
                appointment = self.db.query(Appointment).filter(
                    Appointment.id == plan_to_delete["appointment_id"]
                ).first()
                if appointment:
                    self.db.delete(appointment)
            except Exception as e:
                print(f"Failed to delete associated appointment: {e}")

        # Remove from list
        treatment_plans = [p for p in treatment_plans if str(p.get("id")) != str(plan_id)]
        patient.treatment_plan = treatment_plans

        self.db.commit()
        self.db.refresh(patient)

        return True

    def _create_appointment_from_plan(
        self,
        patient: Patient,
        plan_data: Dict[str, Any],
        clinic_id: int
    ) -> Appointment:
        """Create an appointment from treatment plan data"""
        # Parse date and time
        date_str = plan_data.get("date")
        time_str = plan_data.get("time", "09:00")
        
        # Calculate end time (default 60 minutes)
        duration = plan_data.get("duration", 60)
        start_hour, start_min = map(int, time_str.split(":"))
        end_minutes = start_hour * 60 + start_min + duration
        end_hour = end_minutes // 60
        end_min = end_minutes % 60
        end_time = f"{end_hour:02d}:{end_min:02d}"

        appointment_datetime = datetime.strptime(
            f"{date_str} {time_str}",
            "%Y-%m-%d %H:%M"
        )

        appointment = Appointment(
            clinic_id=clinic_id,
            patient_id=patient.id,
            patient_name=patient.name,
            patient_email=None,  # Could be added if needed
            patient_phone=patient.phone,
            doctor_id=plan_data.get("doctor_id"),
            treatment=plan_data.get("procedure", "Treatment"),
            appointment_date=appointment_datetime,
            start_time=time_str,
            end_time=end_time,
            duration=duration,
            status="accepted",  # Auto-accept appointments from treatment plans
            notes=plan_data.get("notes", f"Treatment plan: {plan_data.get('procedure')}"),
            visit_number=plan_data.get("visit_number")  # Pass visit number from treatment plan
        )

        self.db.add(appointment)
        self.db.flush()  # Get the ID without committing

        return appointment

    def _update_appointment_from_plan(
        self,
        plan: Dict[str, Any],
        updates: Dict[str, Any]
    ) -> None:
        """Update appointment when treatment plan changes"""
        appointment_id = plan.get("appointment_id")
        if not appointment_id:
            return

        appointment = self.db.query(Appointment).filter(
            Appointment.id == appointment_id
        ).first()

        if not appointment:
            return

        # Update appointment date/time if changed
        if "date" in updates or "time" in updates:
            date_str = updates.get("date", plan.get("date"))
            time_str = updates.get("time", plan.get("time", "09:00"))
            
            appointment_datetime = datetime.strptime(
                f"{date_str} {time_str}",
                "%Y-%m-%d %H:%M"
            )
            appointment.appointment_date = appointment_datetime
            appointment.start_time = time_str

        # Update treatment if procedure changed
        if "procedure" in updates:
            appointment.treatment = updates["procedure"]

        # Update notes if changed
        if "notes" in updates:
            appointment.notes = updates["notes"]

        self.db.flush()
