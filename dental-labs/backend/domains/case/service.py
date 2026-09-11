"""
Case service — business logic for case management.

Handles case number generation, status transitions, and total recalculation.
"""
import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func, extract

from models import Case, CaseItem, CaseStatusHistory, Lab
from schemas.case import VALID_STATUS_TRANSITIONS


# Case status → notification event. Notifications are scheduled by the route
# layer as a background task (see domains/case/routes.py) — the service stays
# pure and fast.
STATUS_EVENT_MAP = {
    "received": "case_received",
    "dispatched": "case_dispatched",
    "delivered": "case_delivered",
}


class CaseService:
    def __init__(self, db: Session):
        self.db = db

    def generate_case_number(self, lab_id: int) -> str:
        """Generate next case number: {prefix}-{year}-{seq:04d}"""
        lab = self.db.query(Lab).filter(Lab.id == lab_id).first()
        prefix = lab.case_number_prefix if lab else "DL"
        year = datetime.date.today().year

        # Count existing cases for this lab in this year
        count = self.db.query(func.count(Case.id)).filter(
            Case.lab_id == lab_id,
            extract("year", Case.created_at) == year,
        ).scalar()

        seq = (count or 0) + 1
        return f"{prefix}-{year}-{seq:04d}"

    def create_case(self, lab_id: int, user_id: int, data: dict) -> Case:
        """Create a new case with line items."""
        case_number = self.generate_case_number(lab_id)

        items_data = data.pop("items", [])

        case = Case(
            lab_id=lab_id,
            case_number=case_number,
            client_id=data["client_id"],
            doctor_name=data.get("doctor_name"),
            patient_name=data.get("patient_name"),
            patient_age=data.get("patient_age"),
            patient_sex=data.get("patient_sex"),
            received_date=data.get("received_date") or datetime.date.today(),
            due_date=data.get("due_date"),
            priority=data.get("priority", "normal"),
            status="received",
            notes=data.get("notes"),
            created_by=user_id,
        )
        self.db.add(case)
        self.db.flush()

        # Add line items
        total = 0.0
        for item_data in items_data:
            line_total = item_data.get("qty", 1) * item_data.get("unit_price", 0)
            item = CaseItem(
                case_id=case.id,
                product_id=item_data.get("product_id"),
                product_name=item_data["product_name"],
                tooth_numbers=item_data.get("tooth_numbers"),
                shade=item_data.get("shade"),
                material=item_data.get("material"),
                qty=item_data.get("qty", 1),
                unit_price=item_data.get("unit_price", 0),
                line_total=line_total,
            )
            self.db.add(item)
            total += line_total

        case.total_amount = round(total, 2)

        # Record initial status
        history = CaseStatusHistory(
            case_id=case.id,
            from_status=None,
            to_status="received",
            changed_by=user_id,
            note="Case created",
        )
        self.db.add(history)

        self.db.commit()
        self.db.refresh(case)
        return case

    def update_status(self, case: Case, new_status: str, user_id: int, note: str = None) -> Case:
        """Validate and perform a status transition."""
        current = case.status
        allowed = VALID_STATUS_TRANSITIONS.get(current, [])

        if new_status not in allowed:
            raise ValueError(
                f"Cannot transition from '{current}' to '{new_status}'. "
                f"Allowed: {allowed}"
            )

        old_status = case.status
        case.status = new_status

        # Stamp delivery time once — billing keys the statement period off this
        if new_status == "delivered" and case.delivered_at is None:
            case.delivered_at = datetime.datetime.utcnow()

        history = CaseStatusHistory(
            case_id=case.id,
            from_status=old_status,
            to_status=new_status,
            changed_by=user_id,
            note=note,
        )
        self.db.add(history)
        self.db.commit()
        self.db.refresh(case)
        return case

    def recalculate_total(self, case: Case):
        """Recalculate case total from line items."""
        total = sum(item.line_total for item in case.items)
        case.total_amount = round(total, 2)
        self.db.commit()
        self.db.refresh(case)
