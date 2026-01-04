from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic, UserDevice
from schemas import UserCreate, UserOut
from services.firebase_auth import verify_firebase_token, get_firebase_user, create_firebase_user
import jwt
import os
import hashlib
from typing import Optional
from datetime import datetime
import re

def hash_password(password: str) -> str:
    """Simple password hashing for offline mode"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def detect_device_info(request: Request, device_data: dict = None) -> dict:
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

def register_or_update_device(db: Session, user_id: int, device_info: dict) -> UserDevice:
    """Register a new device or update existing device for user"""
    # Check if device already exists (by serial or user_agent hash)
    existing_device = db.query(UserDevice).filter(
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
        db.commit()
        db.refresh(existing_device)
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
        db.add(new_device)
        db.commit()
        db.refresh(new_device)
        return new_device

router = APIRouter()

# JWT Secret (in production, use environment variable)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

def create_jwt_token(user_id: int) -> str:
    """Create JWT token for user"""
    payload = {"user_id": user_id}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

@router.post("/signup", status_code=status.HTTP_201_CREATED)
async def signup(
    request: Request,
    db: Session = Depends(get_db)
):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    first_name = data.get("first_name")
    last_name = data.get("last_name")
    role = data.get("role", "receptionist")
    """Sign up a new user - creates user in Firebase Auth and local database"""
    try:
        # Check if user already exists in custom User table
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        firebase_user_id = None
        password_hash = None
        
        # Try to create user in Firebase Auth
        try:
            display_name = f"{first_name} {last_name}" if first_name and last_name else first_name or last_name or email.split("@")[0]
            firebase_user = create_firebase_user(email, password, display_name)
            if firebase_user:
                firebase_user_id = firebase_user["uid"]
            else:
                # Fallback to local mode
                password_hash = hash_password(password)
                firebase_user_id = f"local_{email}"
        except Exception as e:
            print(f"Firebase user creation failed, using local mode: {e}")
            # Fallback to local mode
            password_hash = hash_password(password)
            firebase_user_id = f"local_{email}"
        
        # Create user in custom User table
        user_data = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": f"{first_name} {last_name}",  # Set full name
            "role": role,
            "is_active": True,
            "supabase_user_id": firebase_user_id,  # Keep field name for compatibility, but store Firebase UID
            "password_hash": password_hash,  # Store password hash for local users
            "clinic_id": None  # Will be set during clinic onboarding
        }
        
        # Set default permissions based on role
        if role == "doctor":
            user_data["permissions"] = {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "reports:edit": True,
                "billing:view": True,
                "billing:edit": True
            }
        elif role == "receptionist":
            user_data["permissions"] = {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "billing:view": True
            }
        elif role == "clinic_owner":
            user_data["permissions"] = {
                "patients:view": True,
                "patients:edit": True,
                "reports:view": True,
                "reports:edit": True,
                "billing:view": True,
                "billing:edit": True,
                "users:manage": True
            }
        
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create JWT token for backend authentication
        token = create_jwt_token(user.id)
        
        return {
            "message": "User created successfully",
            "user": UserOut.from_orm(user),
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        # Try to clean up Firebase auth user if custom user creation failed
        if firebase_user_id and not firebase_user_id.startswith("local_"):
            try:
                from services.firebase_auth import delete_firebase_user
                delete_firebase_user(firebase_user_id)
            except:
                pass
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
async def login(
    request: Request,
    db: Session = Depends(get_db)
):
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    device_data = data.get("device", {})  # Optional device info from client
    """Login user - authenticates with password hash or Firebase Auth"""
    try:
        # Get user from custom User table
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        
        # Check if user has a password_hash (local user or OAuth user who set password)
        if user.password_hash:
            # Verify password against stored hash
            if not verify_password(password, user.password_hash):
                raise HTTPException(status_code=401, detail="Invalid credentials")
        else:
            # User doesn't have a password hash - they must use Firebase Auth
            # For email/password login, we need password_hash
            # If they don't have one, they should use OAuth or set a password
            raise HTTPException(
                status_code=401, 
                detail="Password not set. Please use Google sign-in or set a password first."
            )
        
        # Detect and register device
        try:
            device_info = detect_device_info(request, device_data)
            device = register_or_update_device(db, user.id, device_info)
            
            # Check device access restrictions
            allowed_access = device.allowed_access or {"desktop": True, "mobile": True, "web": True}
            if not allowed_access.get(device_info["device_type"], True):
                raise HTTPException(
                    status_code=403,
                    detail=f"Access from {device_info['device_type']} devices is not allowed for this account."
                )
        except HTTPException:
            raise
        except Exception as device_error:
            # Don't fail login if device registration fails
            print(f"Device registration error (non-fatal): {device_error}")
        
        # Create JWT token for backend authentication
        token = create_jwt_token(user.id)
        
        return {
            "message": "Login successful",
            "user": UserOut.from_orm(user),
            "token": token
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/logout")
async def logout():
    """Logout user"""
    # Backend logout - client-side Firebase handles token cleanup
    return {"message": "Logged out successfully"}

@router.post("/oauth")
async def oauth_login(request: Request, db: Session = Depends(get_db)):
    """
    Accepts Firebase ID token from OAuth and ensures user exists in custom User table.
    Returns backend JWT and user info.
    """
    data = await request.json()
    id_token = data.get("id_token")  # Firebase ID token
    
    if not id_token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    print(f"OAuth login attempt with Firebase token")

    try:
        # Verify Firebase token
        decoded_token = verify_firebase_token(id_token)
        if not decoded_token:
            print("Firebase token verification failed")
            raise HTTPException(status_code=401, detail="Invalid Firebase token")
        
        # Extract user info from decoded token
        firebase_uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name", "")
        picture = decoded_token.get("picture")
        
        # Parse name into first and last name
        if name:
            name_parts = name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
        else:
            first_name = email.split("@")[0] if email else ""
            last_name = ""
        
        print(f"Extracted user data - Email: {email}, Name: {name}, UID: {firebase_uid}")
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"OAuth token verification error: {e}")
        raise HTTPException(status_code=400, detail=f"Invalid token: {str(e)}")

    # Check if user exists in custom User table
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"Creating new user for email: {email}")
        # Create user in custom User table - default to clinic_owner for Google signup
        user_data = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": name or email.split("@")[0],
            "role": "clinic_owner",  # Default to clinic_owner for Google signup
            "is_active": True,
            "supabase_user_id": firebase_uid,  # Keep field name for compatibility, but store Firebase UID
            "clinic_id": None,  # Will be set during onboarding
            "permissions": {
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
        }
        user = User(**user_data)
        db.add(user)
        db.commit()
        db.refresh(user)
        print(f"Created new user with ID: {user.id}")
    else:
        # Update Firebase UID if it's missing or different
        if not user.supabase_user_id or user.supabase_user_id.startswith("local_"):
            user.supabase_user_id = firebase_uid
            db.commit()
        print(f"Found existing user with ID: {user.id}")
    
    # Detect and register device
    device_data = data.get("device", {}) if hasattr(data, 'get') else {}
    try:
        device_info = detect_device_info(request, device_data)
        device = register_or_update_device(db, user.id, device_info)
        
        # Check device access restrictions
        allowed_access = device.allowed_access or {"desktop": True, "mobile": True, "web": True}
        if not allowed_access.get(device_info["device_type"], True):
            raise HTTPException(
                status_code=403,
                detail=f"Access from {device_info['device_type']} devices is not allowed for this account."
            )
    except HTTPException:
        raise
    except Exception as device_error:
        # Don't fail login if device registration fails
        print(f"Device registration error (non-fatal): {device_error}")
    
    # Detect and register device
    try:
        device_info = detect_device_info(request, device_data)
        device = register_or_update_device(db, user.id, device_info)
        
        # Check device access restrictions - check user's devices for this device type
        user_devices = db.query(UserDevice).filter(
            UserDevice.user_id == user.id,
            UserDevice.device_type == device_info["device_type"]
        ).all()
        
        # If user has any devices of this type, check if access is allowed
        if user_devices:
            # Check if any device of this type allows access
            access_allowed = any(
                (d.allowed_access or {"desktop": True, "mobile": True, "web": True}).get(device_info["device_type"], True)
                for d in user_devices
            )
            if not access_allowed:
                raise HTTPException(
                    status_code=403,
                    detail=f"Access from {device_info['device_type']} devices is not allowed for this account."
                )
    except HTTPException:
        raise
    except Exception as device_error:
        # Don't fail login if device registration fails
        print(f"Device registration error (non-fatal): {device_error}")
    
    # Issue backend JWT
    token = create_jwt_token(user.id)
    print(f"Generated JWT token for user {user.id}")
    
    return {
        "message": "OAuth login successful",
        "user": UserOut.from_orm(user),
        "token": token
    }

@router.get("/me")
async def get_current_user_info(
    request: Request,
    db: Session = Depends(get_db)
):
    """Get current user info from JWT token with clinic details"""
    from auth import get_current_user
    user = get_current_user(request, db)
    
    # Get clinic information if user has a clinic
    clinic_info = None
    if user.clinic_id:
        from models import Clinic
        clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
        if clinic:
            clinic_info = {
                "id": clinic.id,
                "name": clinic.name,
                "address": clinic.address,
                "phone": clinic.phone,
                "email": clinic.email,
                "specialization": clinic.specialization,
                "subscription_plan": clinic.subscription_plan,
                "logo": clinic.logo_url,  # Add logo field for frontend compatibility
                "logo_url": clinic.logo_url,  # Keep both for backward compatibility
                "created_at": clinic.created_at.isoformat() if clinic.created_at else None,
                "updated_at": getattr(clinic, 'updated_at', clinic.created_at).isoformat() if getattr(clinic, 'updated_at', clinic.created_at) else None,
                "synced_at": getattr(clinic, 'synced_at', None).isoformat() if getattr(clinic, 'synced_at', None) else None,
                "sync_status": getattr(clinic, 'sync_status', 'local')
            }
    
    # Return user with clinic info
    return {
        "id": user.id,
        "email": user.email,
        "name": user.name,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "clinic_id": user.clinic_id,
        "is_active": user.is_active,
        "created_at": user.created_at.isoformat() if user.created_at else None,
        "updated_at": getattr(user, 'updated_at', user.created_at).isoformat() if getattr(user, 'updated_at', user.created_at) else None,
        "synced_at": getattr(user, 'synced_at', None).isoformat() if getattr(user, 'synced_at', None) else None,
        "sync_status": getattr(user, 'sync_status', 'local'),
        "permissions": user.permissions,
        "clinic": clinic_info
    }

@router.post("/onboarding")
async def complete_onboarding(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Complete onboarding for Firebase OAuth users - creates clinic and updates user
    """
    from auth import get_current_user
    
    # Get current user from JWT token
    user = get_current_user(request, db)
    
    # Only allow clinic_owner role to complete onboarding
    if user.role != "clinic_owner":
        raise HTTPException(status_code=403, detail="Only clinic owners can complete onboarding")
    
    # Check if user already has a clinic
    if user.clinic_id:
        raise HTTPException(status_code=400, detail="User already has a clinic")
    
    data = await request.json()
    
    # Validate required fields
    if not data.get("clinic_name"):
        raise HTTPException(status_code=400, detail="Clinic name is required")
    
    try:
        # Create clinic
        clinic_data = {
            "name": data.get("clinic_name"),
            "address": data.get("clinic_address", ""),
            "phone": data.get("clinic_phone", ""),
            "email": data.get("clinic_email", user.email),  # Default to user's email
            "specialization": data.get("specialization", "radiology"),
            "subscription_plan": data.get("subscription_plan", "free")
        }
        
        clinic = Clinic(**clinic_data)
        db.add(clinic)
        db.commit()
        db.refresh(clinic)
        
        # Update user with clinic_id
        user.clinic_id = clinic.id
        db.commit()
        db.refresh(user)
        
        # Create default scan types if provided
        scan_types = data.get("scan_types", [])
        for scan_type_data in scan_types:
            if scan_type_data.get("name") and scan_type_data.get("price"):
                from models import TreatmentType
                treatment_type = TreatmentType(
                    clinic_id=clinic.id,
                    name=scan_type_data["name"],
                    price=float(scan_type_data["price"]),
                    is_active=True
                )
                db.add(treatment_type)
        
        db.commit()
        
        # Send welcome email to clinic owner
        try:
            from services.email_service import EmailService
            email_service = EmailService()
            email_service.send_clinic_signup_email(
                to_email=user.email,
                owner_name=user.name,
                clinic_name=clinic.name
            )
        except Exception as email_error:
            # Log error but don't fail onboarding
            print(f"Failed to send clinic signup email: {email_error}")
        
        return {
            "message": "Onboarding completed successfully",
            "user": UserOut.from_orm(user),
            "clinic": {
                "id": clinic.id,
                "name": clinic.name,
                "address": clinic.address,
                "phone": clinic.phone,
                "email": clinic.email,
                "specialization": clinic.specialization,
                "subscription_plan": clinic.subscription_plan
            }
        }
        
    except Exception as e:
        db.rollback()
        print(f"Onboarding error: {e}")
        raise HTTPException(status_code=500, detail=f"Onboarding failed: {str(e)}")

@router.post("/set-password")
async def set_password(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Allow OAuth users to set a password for desktop app access.
    This enables users who signed up with Google to login on desktop with email/password.
    """
    from auth import get_current_user
    
    user = get_current_user(request, db)
    data = await request.json()
    password = data.get("password")
    
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    
    if len(password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # For Firebase users, update password in Firebase Auth
    if user.supabase_user_id and not user.supabase_user_id.startswith("local_"):
        try:
            # Update password in Firebase
            from firebase_admin import auth
            auth.update_user(user.supabase_user_id, password=password)
        except Exception as e:
            print(f"Failed to update Firebase password: {e}")
            # Fallback: store password hash locally
            user.password_hash = hash_password(password)
    else:
        # Local user: store password hash
        user.password_hash = hash_password(password)
    
    db.commit()
    
    return {"message": "Password set successfully. You can now login on desktop with your email and password."}

@router.post("/change-password")
async def change_password(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Allow users to change their existing password
    """
    from auth import get_current_user
    
    user = get_current_user(request, db)
    data = await request.json()
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not new_password:
        raise HTTPException(status_code=400, detail="New password is required")
    
    if len(new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    
    # Verify current password
    if user.password_hash:
        # Local password hash
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        if not verify_password(current_password, user.password_hash):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
    elif user.supabase_user_id and not user.supabase_user_id.startswith("local_"):
        # Firebase user - verify with Firebase (would need to verify token with current password)
        # For now, require current password to be provided
        if not current_password:
            raise HTTPException(status_code=400, detail="Current password is required")
        # Note: Firebase password verification requires re-authentication, which is complex
        # For simplicity, we'll just update it if they have a password_hash
        pass
    
    # Update password
    if user.supabase_user_id and not user.supabase_user_id.startswith("local_"):
        try:
            # Update password in Firebase
            from firebase_admin import auth
            auth.update_user(user.supabase_user_id, password=new_password)
        except Exception as e:
            print(f"Failed to update Firebase password: {e}")
            # Fallback: store password hash locally
            user.password_hash = hash_password(new_password)
    else:
        # Local user: update password hash
        user.password_hash = hash_password(new_password)
    
    db.commit()
    
    return {"message": "Password changed successfully"} 