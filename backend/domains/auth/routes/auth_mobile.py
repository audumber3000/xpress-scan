from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User, UserDevice
import jwt
import os
from typing import Optional
import hashlib
import re
from datetime import datetime

# Mobile-specific JWT secrets (different from web to avoid conflicts)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")
JWT_REFRESH_SECRET = os.getenv("JWT_REFRESH_SECRET", "your-refresh-secret-key-mobile")

def create_jwt_token(user_id: int, expires_in: int = 3600) -> str:
    """Create JWT access token for mobile user (default 1 hour)"""
    import time
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + expires_in,
        "iat": int(time.time()),
        "type": "access"
    }
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")

def create_refresh_token(user_id: int) -> str:
    """Create JWT refresh token for mobile user (30 days)"""
    import time
    payload = {
        "user_id": user_id,
        "exp": int(time.time()) + (30 * 24 * 60 * 60),  # 30 days
        "iat": int(time.time()),
        "type": "refresh"
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm="HS256")

def verify_refresh_token(token: str) -> dict:
    """Verify refresh token and return payload"""
    try:
        payload = jwt.decode(token, JWT_REFRESH_SECRET, algorithms=["HS256"])
        if payload.get("type") != "refresh":
            raise jwt.InvalidTokenError("Not a refresh token")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh token: {str(e)}")

def hash_password(password: str) -> str:
    """Simple password hashing for offline mode"""
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return hash_password(password) == hashed

def detect_device_info(request: Request, device_data: dict = None) -> dict:
    """Detect device information from request headers and optional device data"""
    user_agent = request.headers.get("user-agent", "")

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
            ip_address=None,  # Mobile doesn't provide IP
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

@router.post("/login")
async def mobile_login(request: Request, db: Session = Depends(get_db)):
    """Mobile login with refresh tokens"""
    data = await request.json()
    email = data.get("email")
    password = data.get("password")
    device_data = data.get("device", {})

    try:
        # Get user from database
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="Invalid credentials")

        # Check if user has a password_hash
        if user.password_hash:
            if not verify_password(password, user.password_hash):
                raise HTTPException(status_code=401, detail="Invalid credentials")
        else:
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
            print(f"Device registration error (non-fatal): {device_error}")

        # Create JWT tokens for mobile
        access_token = create_jwt_token(user.id)
        refresh_token = create_refresh_token(user.id)

        from schemas import UserOut
        return {
            "message": "Login successful",
            "user": UserOut.from_orm(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 3600  # 1 hour
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/oauth")
async def mobile_oauth_login(request: Request, db: Session = Depends(get_db)):
    """Mobile OAuth login with refresh tokens"""
    data = await request.json()
    id_token = data.get("id_token")
    device_data = data.get("device", {})

    if not id_token:
        raise HTTPException(status_code=400, detail="Missing id_token")

    from services.firebase_auth import verify_firebase_token

    try:
        # Verify Firebase token
        decoded_token = verify_firebase_token(id_token)
        if not decoded_token:
            raise HTTPException(status_code=401, detail="Invalid Firebase token")

        # Extract user info
        firebase_uid = decoded_token.get("uid")
        email = decoded_token.get("email")
        name = decoded_token.get("name", "")
        picture = decoded_token.get("picture")

        if name:
            name_parts = name.split(" ", 1)
            first_name = name_parts[0]
            last_name = name_parts[1] if len(name_parts) > 1 else ""
        else:
            first_name = email.split("@")[0] if email else ""
            last_name = ""

        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        if not user:
            # Create user for mobile OAuth
            user_data = {
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "name": name or email.split("@")[0],
                "role": "clinic_owner",
                "is_active": True,
                "supabase_user_id": firebase_uid,
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
        else:
            # Update Firebase UID if needed
            if not user.supabase_user_id or user.supabase_user_id.startswith("local_"):
                user.supabase_user_id = firebase_uid
                db.commit()

        # Register device
        try:
            device_info = detect_device_info(request, device_data)
            device = register_or_update_device(db, user.id, device_info)

            allowed_access = device.allowed_access or {"desktop": True, "mobile": True, "web": True}
            if not allowed_access.get(device_info["device_type"], True):
                raise HTTPException(
                    status_code=403,
                    detail=f"Access from {device_info['device_type']} devices is not allowed."
                )
        except HTTPException:
            raise
        except Exception as device_error:
            print(f"Device registration error (non-fatal): {device_error}")

        # Create JWT tokens for mobile
        access_token = create_jwt_token(user.id)
        refresh_token = create_refresh_token(user.id)

        from schemas import UserOut
        return {
            "message": "OAuth login successful",
            "user": UserOut.from_orm(user),
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "expires_in": 3600  # 1 hour
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OAuth error: {str(e)}")

@router.post("/refresh")
async def refresh_mobile_token(request: Request, db: Session = Depends(get_db)):
    """Refresh access token for mobile using refresh token"""
    data = await request.json()
    refresh_token = data.get("refresh_token")

    if not refresh_token:
        raise HTTPException(status_code=400, detail="Refresh token is required")

    try:
        payload = verify_refresh_token(refresh_token)
        user_id = payload.get("user_id")

        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")

        # Create new access token
        new_access_token = create_jwt_token(user.id)

        return {
            "access_token": new_access_token,
            "token_type": "bearer",
            "expires_in": 3600  # 1 hour
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid refresh token: {str(e)}")

@router.get("/me")
async def get_mobile_user_info(request: Request, db: Session = Depends(get_db)):
    """Get current mobile user info with clinic details"""
    from core.auth_utils import get_current_user

    try:
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
                    "logo": clinic.logo_url,
                    "logo_url": clinic.logo_url,
                    "created_at": clinic.created_at.isoformat() if clinic.created_at else None,
                    "updated_at": getattr(clinic, 'updated_at', clinic.created_at).isoformat() if getattr(clinic, 'updated_at', clinic.created_at) else None,
                    "synced_at": getattr(clinic, 'synced_at', None).isoformat() if getattr(clinic, 'synced_at', None) else None,
                    "sync_status": getattr(clinic, 'sync_status', 'local')
                }

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

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
