from fastapi import APIRouter, HTTPException, Depends, status, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic
from schemas import UserCreate, UserOut
from supabase_client import supabase
import jwt
import os
from typing import Optional

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
    """Sign up a new user - creates Supabase auth user and custom User record"""
    try:
        # Check if user already exists in custom User table
        existing_user = db.query(User).filter(User.email == email).first()
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        # Create user in Supabase auth
        try:
            auth_response = supabase.auth.sign_up({
                "email": email,
                "password": password
            })
            
            if auth_response.user is None:
                raise HTTPException(status_code=400, detail="Failed to create Supabase auth user")
        except Exception as e:
            print(f"Supabase auth error: {e}")
            # For now, skip Supabase auth and just create in custom table
            # TODO: Fix Supabase configuration
            auth_response = type('obj', (object,), {'user': type('obj', (object,), {'id': 'temp_id'})()})()
        
        # Create user in custom User table
        user_data = {
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "name": f"{first_name} {last_name}",  # Set full name
            "role": role,
            "is_active": True,
            "supabase_user_id": auth_response.user.id,  # Link to Supabase user
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
        # Try to clean up Supabase auth user if custom user creation failed
        if 'auth_response' in locals() and auth_response.user:
            try:
                supabase.auth.admin.delete_user(auth_response.user.id)
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
    """Login user - authenticates with Supabase and returns JWT token"""
    try:
        # Authenticate with Supabase
        try:
            auth_response = supabase.auth.sign_in_with_password({
                "email": email,
                "password": password
            })
            
            if auth_response.user is None:
                raise HTTPException(status_code=401, detail="Invalid credentials")
        except Exception as e:
            print(f"Supabase auth error: {e}")
            # For now, skip Supabase auth and just check custom table
            # TODO: Fix Supabase configuration
            auth_response = type('obj', (object,), {'user': type('obj', (object,), {'id': 'temp_id'})()})()
        
        # Get user from custom User table
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
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
    """Logout user from Supabase"""
    try:
        supabase.auth.sign_out()
        return {"message": "Logged out successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/oauth")
async def oauth_login(request: Request, db: Session = Depends(get_db)):
    """
    Accepts user data from Supabase OAuth and ensures user exists in custom User table.
    Returns backend JWT and user info.
    """
    data = await request.json()
    access_token = data.get("access_token")
    user_data = data.get("user_data")
    
    if not access_token or not user_data:
        raise HTTPException(status_code=400, detail="Missing access_token or user_data")

    print(f"OAuth login attempt for email: {user_data.get('email')}")

    try:
        email = user_data.get("email")
        user_id = user_data.get("id")
        user_metadata = user_data.get("user_metadata", {})
        full_name = user_metadata.get("full_name") or user_metadata.get("name") or ""
        first_name = full_name.split(" ")[0] if full_name else ""
        last_name = " ".join(full_name.split(" ")[1:]) if full_name and len(full_name.split(" ")) > 1 else ""
        
        print(f"Extracted user data - Email: {email}, Name: {full_name}")
        
    except Exception as e:
        print(f"OAuth user data processing error: {e}")
        raise HTTPException(status_code=400, detail="Invalid user data")

    # Check if user exists in custom User table
    user = db.query(User).filter(User.email == email).first()
    if not user:
        print(f"Creating new user for email: {email}")
        # Create user in custom User table - default to clinic_owner for Google signup
        user_data = {
            "email": email,
            "first_name": first_name or email.split("@")[0],
            "last_name": last_name,
            "name": full_name or email.split("@")[0],
            "role": "clinic_owner",  # Default to clinic_owner for Google signup
            "is_active": True,
            "supabase_user_id": user_id,
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
        print(f"Found existing user with ID: {user.id}")
    
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
                "subscription_plan": clinic.subscription_plan
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
        "created_at": user.created_at,
        "permissions": user.permissions,
        "clinic": clinic_info
    }

@router.post("/onboarding")
async def complete_onboarding(
    request: Request,
    db: Session = Depends(get_db)
):
    """
    Complete onboarding for Google OAuth users - creates clinic and updates user
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
                from models import ScanType
                scan_type = ScanType(
                    clinic_id=clinic.id,
                    name=scan_type_data["name"],
                    price=float(scan_type_data["price"]),
                    is_active=True
                )
                db.add(scan_type)
        
        db.commit()
        
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