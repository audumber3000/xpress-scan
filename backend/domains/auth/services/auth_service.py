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
from core.login_identifier import normalize_email
from core.passwords import hash_password as _hash, needs_rehash, verify_password
from core.app_secret import get_jwt_secret

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
        self.jwt_secret = get_jwt_secret()
        self.jwt_algorithm = "HS256"

    def authenticate_user(self, identifier: str, password: str) -> Optional[User]:
        """Sign somebody in by email-or-username and password.

        Upgrades the stored hash on the way through. Signing in is the only
        moment the plain password is in hand, so it is the only moment an old
        unsalted row can be rewritten under the current scheme without asking
        anybody to reset anything. Everyone who logs in migrates themselves; the
        rows left behind belong to accounts nobody is using.
        """
        user = self.auth_repo.authenticate_user(identifier, password)
        if not user:
            return None

        if needs_rehash(user.password_hash):
            user.password_hash = _hash(password)
            try:
                self.auth_repo.db.commit()
            except Exception:
                # The sign-in itself succeeded and that is what matters here.
                # A failed upgrade just means the next login tries again.
                self.auth_repo.db.rollback()

        return user

    def create_user(self, user_data: Dict[str, Any], clinic_id: Optional[int] = None) -> User:
        """Create a new user with business validations"""
        # Stored lower-cased, always. Two rows differing only by case are one
        # person as far as every mail provider is concerned, and letting both
        # exist is how somebody ends up signing in with Google and landing on a
        # brand-new empty account instead of their own clinic. The uniqueness
        # check below is case-insensitive now too (see core.login_identifier),
        # so the pair can no longer be created in the first place.
        user_data = dict(user_data)
        if user_data.get('email'):
            user_data['email'] = normalize_email(user_data['email'])

        # Validate email uniqueness
        if user_data.get('email') and self.auth_repo.get_user_by_email(user_data['email']):
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

    @staticmethod
    def device_block_reason(device: UserDevice, device_type: str) -> Optional[str]:
        """Why this device may not sign in, or None when it may.

        Two independent controls, both managed from Control Center → Security →
        Devices:
          - is_active=False → the device was revoked outright
          - allowed_access  → that platform (desktop/mobile/web) was switched off

        Call this on every login path. Until it existed, `is_active` was enforced
        nowhere and `allowed_access` only on mobile, so revoking a device from the
        API changed nothing for web or desktop sign-ins.

        NOTE: this gates sign-in only. Tokens are not device-bound, so a session
        that is already signed in keeps working until its token expires.
        """
        if device is None:
            return None
        if not device.is_active:
            return "This device has been blocked by your clinic. Contact your clinic owner to restore access."
        allowed = device.allowed_access or {"desktop": True, "mobile": True, "web": True}
        if not allowed.get(device_type, True):
            return f"Access from {device_type} devices is not allowed for this account."
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
            # A precise fix, only when the client actually had one. Guarded with
            # `is not None` rather than a truthiness check: latitude 0.0 is a
            # real place (the Gulf of Guinea), and `if lat:` would silently drop it.
            if device_info.get("latitude") is not None:
                existing_device.latitude = device_info.get("latitude")
                existing_device.longitude = device_info.get("longitude")
                existing_device.location_accuracy = device_info.get("accuracy")
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
                latitude=device_info.get("latitude"),
                longitude=device_info.get("longitude"),
                location_accuracy=device_info.get("accuracy"),
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

            # A sign-in from a machine this account has never used before is the
            # one security event an owner can actually act on, and until now it
            # was only visible to somebody who went looking at the Devices page.
            # Only fires on enrolment, so a familiar laptop stays silent.
            try:
                from domains.notification.services.notification_center_service import (
                    notify, OWNER, SEVERITY_CRITICAL,
                )
                user = self.db.query(User).filter(User.id == user_id).first()
                if user and user.clinic_id:
                    where = device_info.get("location") or device_info.get("ip_address") or "an unrecognised location"
                    notify(
                        self.db,
                        clinic_id=user.clinic_id,
                        event_type="new_device_signin",
                        severity=SEVERITY_CRITICAL,
                        audience=OWNER,
                        title="Sign-in from a new device",
                        body=f"{user.name or user.email} signed in on "
                             f"{device_info.get('device_name') or 'a new device'} from {where}.",
                        link="/admin/security/devices",
                        entity_type="user_device",
                        entity_id=new_device.id,
                        # The owner signing in on their own new phone should not
                        # be told about themselves; anyone else's device should.
                        actor_user_id=user_id if user.role == "clinic_owner" else None,
                    )
                    self.db.commit()
            except Exception:
                # Never let a notification stop somebody signing in.
                self.db.rollback()

            return new_device

    def create_jwt_token(self, user_id: int, device_id: int = None) -> str:
        """Create JWT token for user.

        `device_id` is stamped in so the session can be revoked later. Without
        it, blocking a device only took effect at the next sign-in — and since
        these tokens last thirty days, "blocked" meant somebody who had left
        could keep working from that laptop for a month. The device is now
        re-checked on every request (see core.auth_utils.get_current_user).

        Tokens issued before this change simply carry no `did` and keep working
        as they did; they cannot be device-revoked, but they still die with
        is_active and with their own expiry.
        """
        payload = {
            "user_id": user_id,
            "exp": datetime.utcnow() + timedelta(days=30)  # 30 days — powers one-click "last used" re-login
        }
        if device_id is not None:
            payload["did"] = device_id
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

    def hash_password(self, password: str) -> str:
        """Public wrapper for password hashing (used by the reset flow)."""
        return self._hash_password(password)

    def _password_binding(self, password_hash: Optional[str]) -> str:
        """Short digest of the current password hash. Embedding this in a reset
        token makes the token single-use: once the password changes the digest
        no longer matches, so the same link can't be replayed."""
        return hashlib.sha256((password_hash or "").encode()).hexdigest()[:16]

    def create_password_reset_token(self, user: User) -> str:
        """Mint a short-lived, single-use JWT for resetting a password."""
        payload = {
            "user_id": user.id,
            "purpose": "password_reset",
            "pwb": self._password_binding(user.password_hash),
            "exp": datetime.utcnow() + timedelta(hours=1),
        }
        return jwt.encode(payload, self.jwt_secret, algorithm=self.jwt_algorithm)

    def verify_password_reset_token(self, token: str) -> Optional[int]:
        """Validate a reset token's signature/expiry/purpose and return the
        user_id, re-checking the password binding so the token is single-use.
        Returns None if the token is invalid, expired, or already used."""
        try:
            payload = jwt.decode(token, self.jwt_secret, algorithms=[self.jwt_algorithm])
        except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
            return None
        if payload.get("purpose") != "password_reset":
            return None
        user_id = payload.get("user_id")
        if not user_id:
            return None
        user = self.auth_repo.validate_session(user_id)
        if not user:
            return None
        if payload.get("pwb") != self._password_binding(user.password_hash):
            return None
        return user_id

    def _hash_password(self, password: str) -> str:
        """Hash a password for storage. See core.passwords for the scheme."""
        return _hash(password)

    def _verify_password(self, plain: str, hashed: str) -> bool:
        """Check a password against a stored hash of either scheme."""
        return verify_password(plain, hashed)

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

    def handle_oauth_login(self, id_token: str, device_data: dict = None, role: str = None) -> User:
        """Handle OAuth login with Firebase/Google token"""
        if not FIREBASE_AVAILABLE:
            raise ValueError("Firebase authentication is not configured")

        try:
            # Initialize Firebase app if not already initialized
            if not firebase_admin._apps:
                # Get Firebase credentials from environment (JSON string or file path)
                firebase_creds_json = os.getenv("FIREBASE_SERVICE_ACCOUNT_JSON")
                firebase_creds_path = os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")

                if firebase_creds_json:
                    import json
                    try:
                        creds_dict = json.loads(firebase_creds_json)
                        creds = credentials.Certificate(creds_dict)
                        firebase_admin.initialize_app(creds)
                    except Exception as e:
                        print(f"Firebase init error: {e}")
                        raise ValueError(f"Failed to initialize Firebase: {str(e)}")
                elif firebase_creds_path:
                    # Resolve relative path if necessary
                    if not os.path.isabs(firebase_creds_path):
                        # Get the base directory (where main.py is)
                        from main import BASE_DIR
                        firebase_creds_path = os.path.join(BASE_DIR, firebase_creds_path)

                    if os.path.exists(firebase_creds_path):
                        try:
                            creds = credentials.Certificate(firebase_creds_path)
                            firebase_admin.initialize_app(creds)
                        except Exception as e:
                            print(f"Firebase init error: {e}")
                            raise ValueError(f"Failed to initialize Firebase: {str(e)}")
                    else:
                        raise ValueError(
                            f"Firebase service account file not found at: {firebase_creds_path}. "
                            "Check FIREBASE_SERVICE_ACCOUNT_PATH in .env"
                        )
                else:
                    raise ValueError(
                        "Firebase service account credentials not found. "
                        "Set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH in .env"
                    )

            # Verify the Firebase ID token
            decoded_token = firebase_auth.verify_id_token(id_token)

            if not decoded_token:
                raise ValueError("Invalid Firebase token")

            # Extract user information from token
            firebase_uid = decoded_token.get("uid")
            email = normalize_email(decoded_token.get("email"))
            name = decoded_token.get("name", "")

            # Apple Sign-In quirk: Apple only includes the email claim on the
            # very first authorization. Subsequent identity tokens omit it.
            # Try a few fallback paths before giving up:
            #   1. firebase.identities.email[0] in the decoded token
            #   2. firebase_auth.get_user(uid).email — Firebase stores it
            #   3. firebase_auth.get_user(uid).provider_data[*].email
            if not email and firebase_uid:
                try:
                    identities = decoded_token.get("firebase", {}).get("identities", {})
                    id_emails = identities.get("email") or []
                    if id_emails:
                        email = id_emails[0]
                except Exception as e:
                    print(f"identities.email lookup failed: {e}")

            if not email and firebase_uid:
                try:
                    fb_user = firebase_auth.get_user(firebase_uid)
                    email = fb_user.email
                    if not email and getattr(fb_user, "provider_data", None):
                        for p in fb_user.provider_data:
                            if getattr(p, "email", None):
                                email = p.email
                                break
                    if not name and getattr(fb_user, "display_name", None):
                        name = fb_user.display_name
                    if not email:
                        provider_emails = [
                            getattr(p, "email", None)
                            for p in (fb_user.provider_data or [])
                        ]
                        print(
                            f"Firebase user {firebase_uid} has no email — "
                            f"top: {fb_user.email!r}, providers: {provider_emails!r}, "
                            f"sign_in_provider: {decoded_token.get('firebase', {}).get('sign_in_provider')!r}"
                        )
                except Exception as fb_err:
                    print(f"Firebase user lookup failed for {firebase_uid}: {fb_err}")

            if not firebase_uid:
                raise ValueError("Firebase UID is required")

            sign_in_provider = decoded_token.get("firebase", {}).get("sign_in_provider")

            # If we *still* don't have an email, the user is most likely an
            # Apple Sign-In user who picked "Hide My Email" or who first
            # authorized this app under a previous version that didn't
            # request the email scope. Apple won't re-send the email on
            # subsequent sign-ins, so synthesize a stable internal one
            # tied to the Firebase UID. Real email can be backfilled later
            # if the user ever shares it.
            if not email:
                if sign_in_provider == "apple.com":
                    email = f"{firebase_uid}@apple.molarplus.local"
                    print(f"OAuth: synthesized Apple email for uid={firebase_uid}")
                else:
                    print(
                        f"OAuth missing creds — email={email!r}, uid={firebase_uid!r}, "
                        f"provider={sign_in_provider!r}"
                    )
                    raise ValueError("Email is required for non-Apple sign-in")

            # Parse name into first and last name. UserResponseDTO requires
            # both fields to be at least 1 char, so fill in placeholders for
            # OAuth users (especially Apple Hide-My-Email) that won't share
            # their real name. They can edit it later in profile settings.
            if name:
                name_parts = name.split(" ", 1)
                first_name = name_parts[0] or "User"
                last_name = (name_parts[1] if len(name_parts) > 1 else "") or "Account"
            else:
                first_name = email.split("@")[0] or "User"
                last_name = "Account"

            email = normalize_email(email)

            # Check if user exists — by Firebase UID first (stable across
            # Apple Sign-In email changes / Hide My Email), then by email.
            user = self.auth_repo.get_user_by_supabase_id(firebase_uid) \
                if hasattr(self.auth_repo, "get_user_by_supabase_id") else None
            if not user:
                user = self.auth_repo.get_user_by_email(email)

            if not user:
                # Create new user from OAuth data
                user_data = {
                    "email": email,
                    "first_name": first_name,
                    "last_name": last_name,
                    "role": role if role else "clinic_owner",  # Use passed role or default to clinic_owner
                    "supabase_user_id": firebase_uid,  # Store Firebase UID
                }

                user = self.create_user(user_data)

            # Update Firebase UID if it's missing or different
            db = self.auth_repo.db
            dirty = False
            if not user.supabase_user_id or user.supabase_user_id.startswith("local_"):
                user.supabase_user_id = firebase_uid
                dirty = True
            # Backfill name fields for users created before DTO validation
            # was enforced — UserResponseDTO requires both to be ≥1 char.
            if not (user.first_name or "").strip():
                user.first_name = "User"
                dirty = True
            if not (user.last_name or "").strip():
                user.last_name = "Account"
                dirty = True
            if dirty:
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
            import traceback
            print(f"OAuth verification error: {e!r}", flush=True)
            print(traceback.format_exc(), flush=True)
            raise ValueError(f"OAuth verification failed: {str(e)}")

    @property
    def db(self):
        """Get database session from repositories"""
        # This assumes all repositories use the same db session
        return self.auth_repo.db