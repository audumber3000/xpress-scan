"""
Casbin-based Permission Management System
Supports RBAC with multi-tenancy (clinic isolation)
"""
import os
import casbin
from typing import Optional, List, Dict
from fastapi import HTTPException

class PermissionManager:
    """Centralized permission management using Casbin"""
    
    _instance = None
    _enforcer = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(PermissionManager, cls).__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._enforcer is None:
            self._initialize_enforcer()
    
    def _initialize_enforcer(self):
        """Initialize Casbin enforcer with model and policy files"""
        try:
            config_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config")
            model_path = os.path.join(config_dir, "rbac_model.conf")
            policy_path = os.path.join(config_dir, "rbac_policy.csv")
            
            # Create enforcer
            self._enforcer = casbin.Enforcer(model_path, policy_path)
            print(f"✅ Casbin enforcer initialized successfully")
            print(f"   Model: {model_path}")
            print(f"   Policy: {policy_path}")
            
        except Exception as e:
            print(f"❌ Failed to initialize Casbin enforcer: {e}")
            raise
    
    def check_permission(self, user_id: str, clinic_id: str, resource: str, action: str) -> bool:
        """
        Check if user has permission for resource in clinic
        
        Args:
            user_id: User ID (converted to string)
            clinic_id: Clinic ID (converted to string)
            resource: Resource name (e.g., 'users', 'patients')
            action: Action name (e.g., 'view', 'edit', 'delete')
        
        Returns:
            True if user has permission, False otherwise
        """
        try:
            result = self._enforcer.enforce(str(user_id), str(clinic_id), resource, action)
            return result
        except Exception as e:
            print(f"❌ Permission check failed: {e}")
            return False
    
    def add_role_for_user(self, user_id: str, role: str, clinic_id: str) -> bool:
        """
        Assign role to user in specific clinic
        
        Args:
            user_id: User ID
            role: Role name (clinic_owner, doctor, receptionist)
            clinic_id: Clinic ID
        
        Returns:
            True if successful
        """
        try:
            # Check if role already exists
            existing_roles = self.get_roles_for_user(str(user_id), str(clinic_id))
            if role in existing_roles:
                print(f"✅ Role {role} already assigned to user {user_id} in clinic {clinic_id}")
                return True
            
            # Add new role
            result = self._enforcer.add_grouping_policy(str(user_id), role, str(clinic_id))
            self._enforcer.save_policy()
            print(f"✅ Added role {role} to user {user_id} in clinic {clinic_id}")
            return True  # Return True even if already exists
        except Exception as e:
            print(f"❌ Failed to add role: {e}")
            return False
    
    def remove_role_for_user(self, user_id: str, role: str, clinic_id: str) -> bool:
        """
        Remove role from user in specific clinic
        
        Args:
            user_id: User ID
            role: Role name
            clinic_id: Clinic ID
        
        Returns:
            True if successful
        """
        try:
            result = self._enforcer.remove_grouping_policy(str(user_id), role, str(clinic_id))
            self._enforcer.save_policy()
            if result:
                print(f"✅ Removed role {role} from user {user_id} in clinic {clinic_id}")
            else:
                print(f"⚠️  Role {role} not found for user {user_id} in clinic {clinic_id}")
            return True  # Return True even if role didn't exist
        except Exception as e:
            print(f"❌ Failed to remove role: {e}")
            return False
    
    def get_roles_for_user(self, user_id: str, clinic_id: str) -> List[str]:
        """
        Get all roles for user in specific clinic
        
        Args:
            user_id: User ID
            clinic_id: Clinic ID
        
        Returns:
            List of role names
        """
        try:
            roles = self._enforcer.get_roles_for_user(str(user_id), str(clinic_id))
            return roles
        except Exception as e:
            print(f"❌ Failed to get roles: {e}")
            return []
    
    def get_users_for_role(self, role: str, clinic_id: str) -> List[str]:
        """
        Get all users with specific role in clinic
        
        Args:
            role: Role name
            clinic_id: Clinic ID
        
        Returns:
            List of user IDs
        """
        try:
            users = self._enforcer.get_users_for_role(role, str(clinic_id))
            return users
        except Exception as e:
            print(f"❌ Failed to get users for role: {e}")
            return []
    
    def add_permission_for_user(self, user_id: str, clinic_id: str, resource: str, action: str) -> bool:
        """
        Add custom permission for specific user (beyond their role)
        
        Args:
            user_id: User ID
            clinic_id: Clinic ID
            resource: Resource name
            action: Action name
        
        Returns:
            True if successful
        """
        try:
            result = self._enforcer.add_policy(str(user_id), str(clinic_id), resource, action)
            self._enforcer.save_policy()
            return result
        except Exception as e:
            print(f"❌ Failed to add permission: {e}")
            return False
    
    def remove_permission_for_user(self, user_id: str, clinic_id: str, resource: str, action: str) -> bool:
        """
        Remove custom permission from user
        
        Args:
            user_id: User ID
            clinic_id: Clinic ID
            resource: Resource name
            action: Action name
        
        Returns:
            True if successful
        """
        try:
            result = self._enforcer.remove_policy(str(user_id), str(clinic_id), resource, action)
            self._enforcer.save_policy()
            return result
        except Exception as e:
            print(f"❌ Failed to remove permission: {e}")
            return False
    
    def get_all_permissions_for_user(self, user_id: str, clinic_id: str) -> Dict[str, List[str]]:
        """
        Get all permissions for user (role-based + custom)
        
        Args:
            user_id: User ID
            clinic_id: Clinic ID
        
        Returns:
            Dictionary mapping resources to list of allowed actions
        """
        permissions = {}
        
        # Get all policies (both role-based and custom)
        all_policies = self._enforcer.get_policy()
        all_groupings = self._enforcer.get_grouping_policy()
        
        # Get user's roles
        user_roles = self.get_roles_for_user(user_id, clinic_id)
        
        # Collect permissions from roles
        for policy in all_policies:
            if len(policy) >= 4:
                role_or_user, domain, resource, action = policy[0], policy[1], policy[2], policy[3]
                
                # Check if this policy applies to user's clinic
                if domain == str(clinic_id) or domain == "*":
                    # Check if policy is for user's role or directly for user
                    if role_or_user in user_roles or role_or_user == str(user_id):
                        if resource not in permissions:
                            permissions[resource] = []
                        if action not in permissions[resource]:
                            permissions[resource].append(action)
        
        return permissions
    
    def reload_policy(self):
        """Reload policy from file"""
        try:
            self._enforcer.load_policy()
            print("✅ Policy reloaded successfully")
        except Exception as e:
            print(f"❌ Failed to reload policy: {e}")

# Global instance
permission_manager = PermissionManager()

def require_permission(resource: str, action: str):
    """
    Decorator to check permissions on routes
    
    Usage:
        @router.get("/users")
        @require_permission("users", "view")
        def get_users(current_user = Depends(get_current_user)):
            ...
    """
    def decorator(func):
        async def wrapper(*args, current_user=None, **kwargs):
            if not current_user:
                raise HTTPException(status_code=401, detail="Not authenticated")
            
            # Check permission
            has_permission = permission_manager.check_permission(
                str(current_user.id),
                str(current_user.clinic_id),
                resource,
                action
            )
            
            if not has_permission:
                raise HTTPException(
                    status_code=403,
                    detail=f"You don't have permission to {action} {resource}"
                )
            
            return await func(*args, current_user=current_user, **kwargs)
        
        return wrapper
    return decorator
