"""
Auth service with business logic
"""
from typing import Optional, Dict, Any
import hashlib
import jwt
import os
import re
from datetime import datetime, timedelta
from fastapi import Request
from core.interfaces import AuthServiceProtocol, AuthRepositoryProtocol, ClinicRepositoryProtocol, UserRepositoryProtocol
from models import User, UserDevice

# Import Firebase Admin SDK for OAuth verification
try:
    import firebase_admin
    from firebase_admin import auth as firebase_auth
    from firebase_admin import credentials
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    print("Warning: Firebase Admin SDK not available. OAuth login will not work.")


class AuthService(AuthServiceProtocol):
    """Auth service containing all authentication business logic"""

    def __init__(
        self,
        auth_repo: AuthRepositoryProtocol,
        clinic_repo: ClinicRepositoryProtocol,
        user_repo: UserRepositoryProtocol
    ):
        self.auth_repo = auth_repo
        self.clinic_repo = clinic_repo
        self.user_repo = user_repo
        self.jwt_secret = os.getenv("JWT_SECRET", "your-secret-key")
        self.jwt_algorithm = "HS256"

    def authenticate_user(self, email: str, password: str) -> Optional[User]:
        """Authenticate user with email and password"""
        password_hash = self._hash_password(password)
        return self.auth_repo.authenticate_user(email, password_hash)

    def create_user(self, user_data: Dict[str, Any], clinic_id: Optional[int] = None) -> User:
        """Create a new user with business validations"""
        # Validate email uniqueness
        if self.auth_repo.get_user_by_email(user_data['email']):
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

    def get_current_user(self, user_id: int) -> Optional[User]:
        """Get current user by ID"""
        user_data = self.auth_repo.get_user_with_clinic(user_id)
        return user_data['user'] if user_data else None

    def validate_token(self, token: str) -> Optional[User]:
        """Validate JWT token and return user"""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
            user_id = payload.get("user_id")
            if not user_id:
                return None

            return self.auth_repo.validate_session(user_id)
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None

    def register_device(self, user_id: int, device_info: Dict[str, Any]) -> UserDevice:
        """Register or update device for user"""
        # Check if device already exists
        existing_device = self.db.query(UserDevice).filter(
            UserDevice.user_id == user_id,
            UserDevice.device_serial == device_info["device_serial"]
        ).first()

        if existing_device:
            # Update existing device
            existing_device.is_online = True
            existing_device.last_seen = datetime.utcnow()
            existing_device.ip_address = device_info.get("ip_address")
            existing_device.location = device_info.get("location")
            existing_device.user_agent = device_info.get("user_agent")
            existing_device.device_os = device_info.get("device_os")
            existing_device.updated_at = datetime.utcnow()
            self.db.commit()
            self.db.refresh(existing_device)
            return existing_device
        else:
            # Create new device
            new_device = UserDevice(
                user_id=user_id,
                device_name=device_info["device_name"],
                device_type=device_info["device_type"],
                device_platform=device_info["device_platform"],
                device_os=device_info["device_os"],
                device_serial=device_info["device_serial"],
                user_agent=device_info.get("user_agent"),
                ip_address=device_info.get("ip_address"),
                location=device_info.get("location"),
                is_active=True,
                is_online=True,
                last_seen=datetime.utcnow(),
                allowed_access={"desktop": True, "mobile": True, "web": True},
                enrolled_at=datetime.utcnow(),
                assigned_at=datetime.utcnow()
            )
            self.db.add(new_device)
            self.db.commit()
            self.db.refresh(new_device)
            return new_device

    def create_jwt_token(self, user_id: int) -> str:
        """Create JWT token for user"""
        payload = {
            "user_id": user_id,
            "exp": datetime.utcnow() + timedelta(days=7)  # 7 days expiration
        }
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    def update_password(self, user_id: int, current_password: str, new_password: str) -> bool:
        """Update user password with validation"""
        user = self.get_current_user(user_id)
        if not user:
            return False

        # Validate current password
        if user.password_hash:
            if not self._verify_password(current_password, user.password_hash):
                raise ValueError("Current password is incorrect")

        # Update password
        user.password_hash = self._hash_password(new_password)
        user.updated_at = datetime.utcnow()
        self.db.commit()
        return True

    def _hash_password(self, password: str) -> str:
        """Hash password using SHA256"""
        return hashlib.sha256(password.encode()).hexdigest()

    def _verify_password(self, plain: str, hashed: str) -> bool:
        """Verify password against hash"""
        return self._hash_password(plain) == hashed

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

    def detect_device_info(self, request: Request, device_data: dict = None) -> dict:
        """Detect device information from request headers and optional device data"""
        user_agent = request.headers.get("user-agent", "")
        client_ip = request.client.host if request.client else None

        # Get device info from request body if provided
        device_name = device_data.get("device_name", "") if device_data else ""
        device_type = device_data.get("device_type", "") if device_data else ""
        device_platform = device_data.get("device_platform", "") if device_data else ""
        device_os = device_data.get("device_os", "") if device_data else ""
        device_serial = device_data.get("device_serial", "") if device_data else ""
        location = device_data.get("location", "") if device_data else ""

        # Detect device type from user agent if not provided
        if not device_type:
            user_agent_lower = user_agent.lower()
            if "mobile" in user_agent_lower or "android" in user_agent_lower or "iphone" in user_agent_lower:
                device_type = "mobile"
            elif "tauri" in user_agent_lower or "electron" in user_agent_lower:
                device_type = "desktop"
            else:
                device_type = "web"

        # Detect platform from user agent if not provided
        if not device_platform:
            user_agent_lower = user_agent.lower()
            if "windows" in user_agent_lower:
                device_platform = "Windows"
            elif "mac" in user_agent_lower or "darwin" in user_agent_lower:
                device_platform = "macOS"
            elif "linux" in user_agent_lower:
                device_platform = "Linux"
            elif "android" in user_agent_lower:
                device_platform = "Android"
            elif "iphone" in user_agent_lower or "ipad" in user_agent_lower or "ios" in user_agent_lower:
                device_platform = "iOS"
            else:
                device_platform = "Unknown"

        # Extract OS version from user agent if not provided
        if not device_os and user_agent:
            os_match = re.search(r'(Windows NT|Mac OS X|Linux|Android|iPhone OS)\s*([\d._]+)', user_agent)
            if os_match:
                device_os = f"{os_match.group(1)} {os_match.group(2)}"

        # Generate device name if not provided
        if not device_name:
            if device_type == "desktop":
                device_name = f"{device_platform} Device"
            elif device_type == "mobile":
                device_name = f"{device_platform} Device"
            else:
                device_name = "Web Browser"

        return {
            "device_name": device_name,
            "device_type": device_type,
            "device_platform": device_platform,
            "device_os": device_os or device_platform,
            "device_serial": device_serial or f"{device_type}_{hashlib.md5(user_agent.encode()).hexdigest()[:8]}",
            "user_agent": user_agent,
            "ip_address": client_ip,
            "location": location
        }

    def handle_oauth_login(self, id_token: str, device_data: dict = None) -> User:
        """Handle OAuth login with Firebase/Google token"""
        if not FIREBASE_AVAILABLE:
            raise ValueError("Firebase authentication is not configured")

        try:
            # Initialize Firebase app if not already initialized
            if not firebase_admin._apps:
                # Get Firebase credentials from environment
                firebase_creds_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
                if not firebase_creds_json:
                    raise ValueError("Firebase service account credentials not found")

                import json
                creds_dict = json.loads(firebase_creds_json)
                creds = credentials.Certificate(creds_dict)
                firebase_admin.initialize_app(creds)

            # Verify the Firebase ID token
            decoded_token = firebase_auth.verify_id_token(id_token)

            if not decoded_token:
                raise ValueError("Invalid Firebase token")

            # Extract user information from token
            firebase_uid = decoded_token.get("uid")
            email = decoded_token.get("email")
            name = decoded_token.get("name", "")
            picture = decoded_token.get("picture")

            if not email or not firebase_uid:
                raise ValueError("Email and Firebase UID are required")

            # Parse name into first and last name
            if name:
                name_parts = name.split(" ", 1)
                first_name = name_parts[0]
                last_name = name_parts[1] if len(name_parts) > 1 else ""
            else:
                first_name = email.split("@")[0]
                last_name = ""

            # Check if user exists in our database
            user = self.auth_repo.get_user_by_email(email)

            if not user:
                # Create new user from OAuth data
                user_data = {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": "clinic_owner",  # Default role for OAuth users
                    "supabase_user_id": firebase_uid,  # Store Firebase UID
                }

                user = self.create_user(user_data)

            # Update Firebase UID if it's missing or different
            if not user.supabase_user_id or user.supabase_user_id.startswith("local_"):
                user.supabase_user_id = firebase_uid
                # Commit the change
                from sqlalchemy.orm import Session
                db = self.auth_repo.db
                db.commit()

            # Register device if device data provided
            if device_data:
                # We need a request object to get device info, but we can use the device_data directly
                # For now, let's create a mock request or handle device registration differently
                pass

            return user

        except firebase_auth.InvalidIdTokenError:
            raise ValueError("Invalid Firebase ID token")
        except firebase_auth.ExpiredIdTokenError:
            raise ValueError("Firebase ID token has expired")
        except firebase_auth.RevokedIdTokenError:
            raise ValueError("Firebase ID token has been revoked")
        except Exception as e:
            print(f"OAuth verification error: {e}")
            raise ValueError(f"OAuth verification failed: {str(e)}")

    @property
    def db(self):
        """Get database session from repositories"""
        # This assumes all repositories use the same db session
        return self.auth_repo.db