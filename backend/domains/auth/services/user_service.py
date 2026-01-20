"""
User service with business logic
"""
from typing import List, Optional, Dict, Any
import hashlib
from core.interfaces import UserServiceProtocol, UserRepositoryProtocol, ClinicRepositoryProtocol
from core.dtos import UserCreateDTO, UserUpdateDTO, UserResponseDTO
from models import User, Clinic


class UserService(UserServiceProtocol):
    """User service containing all user-related business logic"""

    def __init__(self, user_repo: UserRepositoryProtocol, clinic_repo: ClinicRepositoryProtocol):
        self.user_repo = user_repo
        self.clinic_repo = clinic_repo

    def create_user(self, user_data: Dict[str, Any], clinic_id: Optional[int] = None) -> User:
        """Create a new user with business validations"""
        # Validate email uniqueness
        existing_user = self.user_repo.get_by_email(user_data['email'])
        if existing_user:
            raise ValueError(f"User with email '{user_data['email']}' already exists")

        # Validate clinic if provided
        if clinic_id:
            clinic = self.clinic_repo.get_by_id(clinic_id)
            if not clinic or clinic.status != 'active':
                raise ValueError("Invalid or inactive clinic")

        # Hash password if provided
        user_dict = user_data.copy()
        if 'password' in user_dict:
            user_dict['password_hash'] = self._hash_password(user_dict.pop('password'))

        # Set full name
        first_name = user_dict.get('first_name', '')
        last_name = user_dict.get('last_name', '')
        user_dict['name'] = f"{first_name} {last_name}".strip()

        # Set clinic_id
        user_dict['clinic_id'] = clinic_id

        # Set default permissions based on role
        if 'role' in user_dict:
            user_dict['permissions'] = self._get_default_permissions(user_dict['role'])

        user = User(**user_dict)
        return self.user_repo.create(user)

    def get_user(self, user_id: int) -> Optional[User]:
        """Get user by ID"""
        return self.user_repo.get_by_id(user_id)

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        password_hash = self._hash_password(password)
        return self.user_repo.authenticate_user(email, password_hash)

    def update_user(self, user_id: int, updates: Dict[str, Any]) -> Optional[User]:
        """Update user with business validations"""
        user = self.get_user(user_id)
        if not user:
            return None

        # Validate email uniqueness if being updated
        if 'email' in updates and updates['email'] != user.email:
            existing_user = self.user_repo.get_by_email(updates['email'])
            if existing_user and existing_user.id != user_id:
                raise ValueError(f"User with email '{updates['email']}' already exists")

        # Update name if first/last name changed
        if 'first_name' in updates or 'last_name' in updates:
            first_name = updates.get('first_name', user.first_name)
            last_name = updates.get('last_name', user.last_name)
            updates['name'] = f"{first_name} {last_name}".strip()

        # Hash password if being updated
        if 'password' in updates:
            updates['password_hash'] = self._hash_password(updates.pop('password'))

        return self.user_repo.update(user_id, updates)

    def get_users_by_clinic_and_role(self, clinic_id: int, role: str) -> List[User]:
        """Get users by clinic and role"""
        return self.user_repo.get_by_clinic_id_and_role(clinic_id, role)

    def update_user_permissions(self, user_id: int, permissions: Dict[str, Any]) -> bool:
        """Update user permissions"""
        return self.user_repo.update_user_permissions(user_id, permissions)

    def transfer_user_to_clinic(self, user_id: int, clinic_id: int) -> bool:
        """Transfer user to a different clinic"""
        # Validate clinic exists and is active
        clinic = self.clinic_repo.get_by_id(clinic_id)
        if not clinic or clinic.status != 'active':
            raise ValueError("Invalid or inactive clinic")

        return self.user_repo.transfer_user_to_clinic(user_id, clinic_id)

    def deactivate_user(self, user_id: int) -> bool:
        """Deactivate user account"""
        user = self.get_user(user_id)
        if not user:
            return False

        # Prevent deactivating the last clinic owner
        if user.role == 'clinic_owner' and user.clinic_id:
            clinic_owners = self.user_repo.get_clinic_owners(user.clinic_id)
            active_owners = [owner for owner in clinic_owners if owner.id != user_id and owner.is_active]
            if not active_owners:
                raise ValueError("Cannot deactivate the last clinic owner")

        return self.user_repo.deactivate_user(user_id)

    def get_users_without_clinic(self) -> List[User]:
        """Get users who haven't completed clinic onboarding"""
        return self.user_repo.get_users_without_clinic()

    def complete_onboarding(self, user_id: int, clinic_data: Dict[str, Any]) -> Dict[str, Any]:
        """Complete user onboarding by creating clinic and linking user"""
        user = self.get_user(user_id)
        if not user:
            raise ValueError("User not found")

        if user.role != 'clinic_owner':
            raise ValueError("Only clinic owners can complete onboarding")

        if user.clinic_id:
            raise ValueError("User has already completed onboarding")

        # Create clinic
        from domains.clinic.services.clinic_service import ClinicService
        clinic_service = ClinicService(self.clinic_repo, self.user_repo)
        clinic = clinic_service.create_clinic(clinic_data)

        # Link user to clinic
        self.user_repo.transfer_user_to_clinic(user_id, clinic.id)

        return {
            'user': user,
            'clinic': clinic
        }

    def get_user_stats(self, clinic_id: Optional[int] = None) -> Dict[str, Any]:
        """Get user statistics"""
        return self.user_repo.get_user_stats(clinic_id)

    def _hash_password(self, password: str) -> str:
        """Hash password using SHA256 (should be upgraded to bcrypt)"""
        return hashlib.sha256(password.encode()).hexdigest()

    def _get_default_permissions(self, role: str) -> Dict[str, Any]:
        """Get default permissions for a role"""
        if role == "doctor":
            return {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "reports:edit": True,
                "billing:view": True,
                "billing:edit": True
            }
        elif role == "receptionist":
            return {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "billing:view": True
            }
        elif role == "clinic_owner":
            return {
                "patients:view": True,
                "patients:edit": True,
                "patients:delete": True,
                "reports:view": True,
                "reports:edit": True,
                "reports:delete": True,
                "billing:view": True,
                "billing:edit": True,
                "users:view": True,
                "users:edit": True,
                "users:delete": True,
                "users:manage": True
            }
        else:
            return {}