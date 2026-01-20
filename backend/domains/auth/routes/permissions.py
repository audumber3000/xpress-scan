"""
Permission Management API Routes
Handles role assignments and permission checks using Casbin
"""
from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Optional
from pydantic import BaseModel
from core.auth_utils import get_current_user
from core.permissions import permission_manager
from models import User
from database import get_db
from sqlalchemy.orm import Session

router = APIRouter()

class RoleAssignment(BaseModel):
    user_id: int
    role: str

class PermissionAssignment(BaseModel):
    user_id: int
    resource: str
    action: str

class UserPermissionsResponse(BaseModel):
    user_id: int
    user_name: str
    user_email: str
    role: str
    permissions: Dict[str, List[str]]

@router.get("/roles", response_model=List[dict])
def get_available_roles():
    """Get list of available roles in the system"""
    return [
        {
            "value": "clinic_owner",
            "label": "Clinic Owner",
            "description": "Full access to all clinic features and settings",
            "color": "#2D9596"
        },
        {
            "value": "doctor",
            "label": "Doctor",
            "description": "Can manage patients, appointments, and view billing",
            "color": "#4F46E5"
        },
        {
            "value": "receptionist",
            "label": "Receptionist",
            "description": "Can manage appointments and patient intake",
            "color": "#10B981"
        }
    ]

@router.get("/resources", response_model=List[dict])
def get_available_resources():
    """Get list of resources that can have permissions"""
    return [
        {"key": "users", "label": "Staff Management", "actions": ["view", "edit", "delete"]},
        {"key": "patients", "label": "Patients", "actions": ["view", "edit", "delete"]},
        {"key": "appointments", "label": "Appointments", "actions": ["view", "edit", "delete"]},
        {"key": "billing", "label": "Billing", "actions": ["view", "edit"]},
        {"key": "treatments", "label": "Treatments", "actions": ["view", "edit", "delete"]},
        {"key": "clinic", "label": "Clinic Settings", "actions": ["view", "edit"]},
        {"key": "templates", "label": "Message Templates", "actions": ["view", "edit"]},
        {"key": "doctors", "label": "Referring Doctors", "actions": ["view", "edit", "delete"]},
        {"key": "attendance", "label": "Attendance", "actions": ["view", "edit"]},
        {"key": "permissions", "label": "Permissions", "actions": ["view", "edit"]}
    ]

@router.get("/users/{user_id}/permissions", response_model=UserPermissionsResponse)
def get_user_permissions(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get all permissions for a specific user"""
    # Clinic owners always have permission (fallback for before Casbin sync)
    if current_user.role != "clinic_owner":
        # Check if current user has permission to view permissions
        if not permission_manager.check_permission(
            str(current_user.id),
            str(current_user.clinic_id),
            "permissions",
            "view"
        ):
            raise HTTPException(status_code=403, detail="You don't have permission to view permissions")
    
    # Get user from database
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get user's permissions from Casbin
    permissions = permission_manager.get_all_permissions_for_user(
        str(user_id),
        str(current_user.clinic_id)
    )
    
    return UserPermissionsResponse(
        user_id=user.id,
        user_name=user.name,
        user_email=user.email,
        role=user.role,
        permissions=permissions
    )

@router.post("/users/{user_id}/role")
def assign_role_to_user(
    user_id: int,
    role_data: RoleAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Assign a role to a user"""
    # Clinic owners always have permission (fallback for before Casbin sync)
    if current_user.role != "clinic_owner":
        # Check if current user has permission to edit permissions
        if not permission_manager.check_permission(
            str(current_user.id),
            str(current_user.clinic_id),
            "permissions",
            "edit"
        ):
            raise HTTPException(status_code=403, detail="You don't have permission to edit permissions")
    
    # Verify user exists and belongs to same clinic
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove existing roles
    existing_roles = permission_manager.get_roles_for_user(str(user_id), str(current_user.clinic_id))
    for existing_role in existing_roles:
        permission_manager.remove_role_for_user(str(user_id), existing_role, str(current_user.clinic_id))
    
    # Add new role
    success = permission_manager.add_role_for_user(
        str(user_id),
        role_data.role,
        str(current_user.clinic_id)
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to assign role")
    
    # Update user's role in database
    user.role = role_data.role
    db.commit()
    
    return {"message": "Role assigned successfully", "user_id": user_id, "role": role_data.role}

@router.post("/users/{user_id}/permission")
def add_custom_permission(
    user_id: int,
    permission_data: PermissionAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Add custom permission for a user (beyond their role)"""
    # Clinic owners always have permission (fallback for before Casbin sync)
    if current_user.role != "clinic_owner":
        # Check if current user has permission to edit permissions
        if not permission_manager.check_permission(
            str(current_user.id),
            str(current_user.clinic_id),
            "permissions",
            "edit"
        ):
            raise HTTPException(status_code=403, detail="You don't have permission to edit permissions")
    
    # Verify user exists and belongs to same clinic
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Add custom permission
    success = permission_manager.add_permission_for_user(
        str(user_id),
        str(current_user.clinic_id),
        permission_data.resource,
        permission_data.action
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to add permission")
    
    return {
        "message": "Permission added successfully",
        "user_id": user_id,
        "resource": permission_data.resource,
        "action": permission_data.action
    }

@router.delete("/users/{user_id}/permission")
def remove_custom_permission(
    user_id: int,
    permission_data: PermissionAssignment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Remove custom permission from a user"""
    # Clinic owners always have permission (fallback for before Casbin sync)
    if current_user.role != "clinic_owner":
        # Check if current user has permission to edit permissions
        if not permission_manager.check_permission(
            str(current_user.id),
            str(current_user.clinic_id),
            "permissions",
            "edit"
        ):
            raise HTTPException(status_code=403, detail="You don't have permission to edit permissions")
    
    # Verify user exists and belongs to same clinic
    user = db.query(User).filter(
        User.id == user_id,
        User.clinic_id == current_user.clinic_id
    ).first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove custom permission
    success = permission_manager.remove_permission_for_user(
        str(user_id),
        str(current_user.clinic_id),
        permission_data.resource,
        permission_data.action
    )
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to remove permission")
    
    return {
        "message": "Permission removed successfully",
        "user_id": user_id,
        "resource": permission_data.resource,
        "action": permission_data.action
    }

@router.post("/sync-user-roles")
def sync_user_roles_to_casbin(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Sync all existing user roles from database to Casbin (one-time migration)"""
    # Only clinic owners can do this
    if current_user.role != "clinic_owner":
        raise HTTPException(status_code=403, detail="Only clinic owners can sync roles")
    
    # Get all users in clinic
    users = db.query(User).filter(User.clinic_id == current_user.clinic_id).all()
    
    synced_count = 0
    for user in users:
        if user.role:
            # Add role to Casbin
            permission_manager.add_role_for_user(
                str(user.id),
                user.role,
                str(user.clinic_id)
            )
            synced_count += 1
    
    return {
        "message": f"Successfully synced {synced_count} user roles to Casbin",
        "synced_count": synced_count
    }
