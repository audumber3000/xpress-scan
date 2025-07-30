from fastapi import HTTPException, Depends, Request
from sqlalchemy.orm import Session
from database import get_db
from models import User, Clinic
from typing import Optional
import jwt
import os

# JWT Secret (in production, use environment variable)
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key")

def get_current_user(request: Request, db: Session = Depends(get_db)) -> Optional[User]:
    """Get current user from JWT token"""
    try:
        # Get token from Authorization header
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Invalid authorization header")
        
        token = auth_header.split(" ")[1]
        
        # Decode JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
        user_id = payload.get("user_id")
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        user = db.query(User).filter(User.id == user_id).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=401, detail="User not found or inactive")
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))

def check_permission(required_permission: str, resource: str = None):
    """Decorator to check user permissions"""
    def permission_checker(current_user: User = Depends(get_current_user)):
        if not current_user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Clinic owners have all permissions
        if current_user.role == "clinic_owner":
            return current_user
        
        # Check if user has the required permission
        permissions = current_user.permissions or {}
        resource_permissions = permissions.get(resource, {})
        
        if not resource_permissions.get(required_permission, False):
            raise HTTPException(
                status_code=403, 
                detail=f"Insufficient permissions. Required: {resource}.{required_permission}"
            )
        
        return current_user
    
    return permission_checker

def require_permission(permission: str, resource: str):
    """Helper function to create permission requirements"""
    return check_permission(permission, resource)

# Common permission requirements
require_patients_view = require_permission("view", "patients")
require_patients_edit = require_permission("edit", "patients")
require_patients_delete = require_permission("delete", "patients")

require_reports_view = require_permission("view", "reports")
require_reports_edit = require_permission("edit", "reports")
require_reports_delete = require_permission("delete", "reports")

require_billing_view = require_permission("view", "billing")
require_billing_edit = require_permission("edit", "billing")

require_users_view = require_permission("view", "users")
require_users_edit = require_permission("edit", "users")
require_users_delete = require_permission("delete", "users")

def get_current_clinic(request: Request, db: Session = Depends(get_db)) -> Optional[Clinic]:
    """Get current clinic from user's clinic_id"""
    user = get_current_user(request, db)
    if not user:
        raise HTTPException(status_code=401, detail="User not authenticated")
    
    clinic = db.query(Clinic).filter(Clinic.id == user.clinic_id).first()
    if not clinic or clinic.status != "active":
        raise HTTPException(status_code=404, detail="Clinic not found or inactive")
    
    return clinic

def require_role(required_role: str):
    """Decorator to require specific user role"""
    def role_checker(user: User = Depends(get_current_user)):
        if user.role != required_role:
            raise HTTPException(status_code=403, detail=f"Requires {required_role} role")
        return user
    return role_checker

# Common role requirements
require_clinic_owner = require_role("clinic_owner")
require_doctor = require_role("doctor")
require_receptionist = require_role("receptionist")

# Role-based access (clinic owners and doctors can access most features)
def require_doctor_or_owner():
    """Allow clinic owners and doctors"""
    def role_checker(user: User = Depends(get_current_user)):
        if user.role not in ["clinic_owner", "doctor"]:
            raise HTTPException(status_code=403, detail="Requires doctor or clinic owner role")
        return user
    return role_checker 