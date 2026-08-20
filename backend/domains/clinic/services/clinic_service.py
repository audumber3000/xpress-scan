"""
Clinic service with business logic
"""
from typing import List, Optional, Dict, Any
from core.interfaces import ClinicServiceProtocol, ClinicRepositoryProtocol, UserRepositoryProtocol
from core.dtos import ClinicCreateDTO, ClinicUpdateDTO, ClinicResponseDTO
from models import Clinic, User


# The parts that make up the single-line address, in the order they read.
_ADDRESS_PARTS = ('address_line1', 'address_line2', 'city', 'state', 'postal_code')


def _sync_composed_address(clinic: Clinic, updates: Dict[str, Any]) -> None:
    """Rebuild `clinic.address` whenever any structured part changes.

    `address` is the single line that invoices, receipts, prescriptions, the
    public website and both mobile apps render, and there are far too many
    readers to convert them all. So the structured fields are the editing
    surface and `address` is the derived value kept in step with them.

    Two deliberate restraints:

    * Nothing happens unless a part is actually in the update, so saving the
      phone number on another tab leaves the address alone.
    * An all-empty set of parts does NOT blank the composed line. A clinic that
      has only ever had free text keeps exactly what it typed, and no invoice
      loses its letterhead because somebody opened the Location tab.
    """
    if not any(part in updates for part in _ADDRESS_PARTS):
        return

    merged = [
        updates[part] if part in updates else getattr(clinic, part, None)
        for part in _ADDRESS_PARTS
    ]
    composed = ', '.join(str(v).strip() for v in merged if v and str(v).strip())
    if composed:
        updates['address'] = composed


class ClinicService(ClinicServiceProtocol):
    """Clinic service containing all clinic-related business logic"""

    def __init__(self, clinic_repo: ClinicRepositoryProtocol, user_repo: UserRepositoryProtocol):
        self.clinic_repo = clinic_repo
        self.user_repo = user_repo

    def create_clinic(self, clinic_data: Dict[str, Any]) -> Clinic:
        """Create a new clinic with business validations"""
        # Validate clinic name uniqueness
        existing_clinic = self._get_clinic_by_name(clinic_data['name'])
        if existing_clinic:
            raise ValueError(f"Clinic with name '{clinic_data['name']}' already exists")

        # Validate GST number uniqueness if provided
        if 'gst_number' in clinic_data and clinic_data['gst_number']:
            existing_gst = self._get_clinic_by_gst(clinic_data['gst_number'])
            if existing_gst:
                raise ValueError(f"Clinic with GST number '{clinic_data['gst_number']}' already exists")

        clinic = Clinic(**clinic_data)
        return self.clinic_repo.create(clinic)

    def get_clinic(self, clinic_id: int) -> Optional[Clinic]:
        """Get clinic by ID"""
        return self.clinic_repo.get_by_id(clinic_id)

    def update_clinic(self, clinic_id: int, updates: Dict[str, Any]) -> Optional[Clinic]:
        """Update clinic with business validations"""
        clinic = self.get_clinic(clinic_id)
        if not clinic:
            return None

        # Validate name uniqueness if being updated
        if 'name' in updates and updates['name'] != clinic.name:
            existing_clinic = self._get_clinic_by_name(updates['name'])
            if existing_clinic and existing_clinic.id != clinic_id:
                raise ValueError(f"Clinic with name '{updates['name']}' already exists")

        # Validate GST uniqueness if being updated
        if 'gst_number' in updates and updates['gst_number'] and updates['gst_number'] != clinic.gst_number:
            existing_gst = self._get_clinic_by_gst(updates['gst_number'])
            if existing_gst and existing_gst.id != clinic_id:
                raise ValueError(f"Clinic with GST number '{updates['gst_number']}' already exists")

        _sync_composed_address(clinic, updates)

        return self.clinic_repo.update(clinic_id, updates)

    def get_clinic_with_users(self, clinic_id: int) -> Optional[Clinic]:
        """Get clinic with associated users"""
        return self.clinic_repo.get_with_users(clinic_id)

    def get_active_clinics(self, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Get all active clinics"""
        return self.clinic_repo.get_active_clinics(skip, limit)

    def get_clinics_by_plan(self, plan: str, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Get clinics by subscription plan"""
        return self.clinic_repo.get_by_subscription_plan(plan, skip, limit)

    def update_subscription(self, clinic_id: int, new_plan: str, razorpay_subscription_id: Optional[str] = None) -> bool:
        """Update clinic subscription plan"""
        return self.clinic_repo.update_clinic_subscription(clinic_id, new_plan, razorpay_subscription_id)

    def search_clinics(self, query: str, skip: int = 0, limit: int = 100) -> List[Clinic]:
        """Search clinics by name or email"""
        return self.clinic_repo.search_clinics(query, skip, limit)

    def get_clinic_stats(self, clinic_id: int) -> Dict[str, Any]:
        """Get comprehensive clinic statistics"""
        return self.clinic_repo.get_clinic_stats(clinic_id)

    def deactivate_clinic(self, clinic_id: int) -> bool:
        """Deactivate a clinic"""
        clinic = self.get_clinic(clinic_id)
        if not clinic:
            return False

        if clinic.status != 'active':
            raise ValueError("Clinic is not active")

        # Check if clinic has active users
        active_users = self.user_repo.get_by_clinic_id_and_role(clinic_id, 'clinic_owner')
        if active_users:
            raise ValueError("Cannot deactivate clinic with active clinic owners")

        return self.clinic_repo.update(clinic_id, {'status': 'suspended'})

    def _get_clinic_by_name(self, name: str) -> Optional[Clinic]:
        """Get clinic by name"""
        # This would be better with a repository method
        db = self.clinic_repo.db
        return db.query(Clinic).filter(Clinic.name == name).first()

    def _get_clinic_by_gst(self, gst_number: str) -> Optional[Clinic]:
        """Get clinic by GST number"""
        db = self.clinic_repo.db
        return db.query(Clinic).filter(Clinic.gst_number == gst_number).first()