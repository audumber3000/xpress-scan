import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import GearLoader from "../components/GearLoader";
import { Shield, Users, UserCheck, Lock, ChevronLeft } from 'lucide-react';

const PermissionsManagement = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userPermissions, setUserPermissions] = useState(null);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [availableResources, setAvailableResources] = useState([]);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pendingRole, setPendingRole] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Admin Hub</span>
        </button>
      </div>
    );
    fetchUsers();
    fetchAvailableRoles();
    fetchAvailableResources();
  }, [setTitle, navigate]);

  const fetchAvailableRoles = async () => {
    try {
      const data = await api.get("/permissions/roles");
      setAvailableRoles(data);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const fetchAvailableResources = async () => {
    try {
      const data = await api.get("/permissions/resources");
      setAvailableResources(data);
    } catch (error) {
      console.error("Error fetching resources:", error);
    }
  };

  const hasPermission = (permission) => {
    if (!user) return false;
    // Clinic owners have all permissions
    if (user.role === "clinic_owner") return true;
    
    // Check specific permission
    if (!user.permissions) return false;
    const [section, action] = permission.split(":");
    return user.permissions[section]?.[action] === true;
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/clinic-users");
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleUserSelect = async (selectedUser) => {
    // Check for unsaved changes
    if (hasUnsavedChanges) {
      const confirm = window.confirm("You have unsaved changes. Do you want to discard them?");
      if (!confirm) return;
    }
    
    setSelectedUser(selectedUser);
    setPendingRole(null);
    setHasUnsavedChanges(false);
    
    try {
      const data = await api.get(`/permissions/users/${selectedUser.id}/permissions`);
      setUserPermissions(data);
      setPendingRole(data.role);
    } catch (error) {
      console.error("Error fetching user permissions:", error);
      toast.error("Failed to load user permissions");
    }
  };

  const handleRoleSelect = (newRole) => {
    if (!selectedUser) return;
    setPendingRole(newRole);
    setHasUnsavedChanges(newRole !== userPermissions.role);
  };

  const handleSaveChanges = async () => {
    if (!selectedUser || !pendingRole) return;
    
    // If no changes, just show message
    if (pendingRole === userPermissions.role) {
      toast.info("No changes to save");
      return;
    }
    
    try {
      setSaving(true);
      await api.post(`/permissions/users/${selectedUser.id}/role`, {
        user_id: selectedUser.id,
        role: pendingRole
      });
      toast.success("Role updated successfully");
      setHasUnsavedChanges(false);
      await fetchUsers();
      
      // Refresh user permissions
      const data = await api.get(`/permissions/users/${selectedUser.id}/permissions`);
      setUserPermissions(data);
      setPendingRole(data.role);
    } catch (error) {
      console.error("Error updating role:", error);
      toast.error("Failed to update role");
    } finally {
      setSaving(false);
    }
  };

  const handleSyncRoles = async () => {
    try {
      setSyncing(true);
      const result = await api.post("/permissions/sync-user-roles");
      toast.success(result.message);
      await fetchUsers();
    } catch (error) {
      console.error("Error syncing roles:", error);
      toast.error("Failed to sync roles");
    } finally {
      setSyncing(false);
    }
  };

  const getRoleColor = (role) => {
    switch (role) {
      case 'clinic_owner': return '#2D9596';
      case 'doctor': return '#4F46E5';
      case 'receptionist': return '#10B981';
      default: return '#6B7280';
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case 'clinic_owner': return Shield;
      case 'doctor': return UserCheck;
      case 'receptionist': return Users;
      default: return Lock;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  if (!hasPermission("permissions:view")) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">You don't have permission to view permissions.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header with teal theme */}
        <div className="bg-gradient-to-r from-[#2D9596] to-[#1F6B72] rounded-lg p-6 mb-6 text-white">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold mb-2">Permissions Management</h2>
              <p className="text-white/90">Manage user roles and permissions using Casbin RBAC</p>
            </div>
            {user.role === 'clinic_owner' && (
              <button
                onClick={handleSyncRoles}
                disabled={syncing}
                className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition disabled:opacity-50"
              >
                {syncing ? 'Syncing...' : 'Sync Roles to Casbin'}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Users List */}
          <div className="bg-white rounded-lg shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900">Staff Members</h3>
              <p className="text-sm text-gray-500 mt-1">{users.length} users</p>
            </div>
            <div className="p-4 space-y-2 max-h-[600px] overflow-y-auto">
              {users.map((u) => {
                const RoleIcon = getRoleIcon(u.role);
                return (
                  <button
                    key={u.id}
                    onClick={() => handleUserSelect(u)}
                    className={`w-full text-left px-4 py-3 rounded-lg transition ${
                      selectedUser?.id === u.id
                        ? 'bg-[#2D9596] text-white shadow-md'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-900'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`p-2 rounded-lg ${
                          selectedUser?.id === u.id ? 'bg-white/20' : 'bg-white'
                        }`}
                        style={{
                          color: selectedUser?.id === u.id ? 'white' : getRoleColor(u.role)
                        }}
                      >
                        <RoleIcon className="w-5 h-5" />
                      </div>
                      <div className="flex-1">
                        <div className="font-medium">{u.name}</div>
                        <div className={`text-sm ${
                          selectedUser?.id === u.id ? 'text-white/80' : 'text-gray-500'
                        }`}>
                          {u.email}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permissions Editor */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow-sm">
            {selectedUser && userPermissions ? (
              <>
                <div className="p-6 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">{userPermissions.user_name}</h3>
                      <p className="text-sm text-gray-500">{userPermissions.user_email}</p>
                    </div>
                    <button
                      onClick={handleSaveChanges}
                      disabled={saving || !hasUnsavedChanges}
                      className={`px-6 py-2 rounded-lg font-medium transition ${
                        hasUnsavedChanges
                          ? 'bg-[#2D9596] text-white hover:bg-[#1F6B72]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      } disabled:opacity-50`}
                    >
                      {saving ? 'Saving...' : hasUnsavedChanges ? 'Save Changes' : 'No Changes'}
                    </button>
                  </div>
                  {hasUnsavedChanges && (
                    <div className="mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-xs text-amber-800 flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
                        You have unsaved changes. Click "Save Changes" to apply them.
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6">
                  {/* Role Selection */}
                  <div className="mb-8">
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">ASSIGN ROLE</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {availableRoles.map((role) => {
                        const RoleIcon = getRoleIcon(role.value);
                        const isSelected = pendingRole === role.value;
                        return (
                          <button
                            key={role.value}
                            onClick={() => handleRoleSelect(role.value)}
                            disabled={saving}
                            className={`p-4 rounded-lg border-2 transition text-left ${
                              isSelected
                                ? 'border-[#2D9596] bg-[#E0F2F2]'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center gap-3 mb-2">
                              <div
                                className="p-2 rounded-lg"
                                style={{
                                  backgroundColor: isSelected ? role.color : `${role.color}20`,
                                  color: isSelected ? 'white' : role.color
                                }}
                              >
                                <RoleIcon className="w-5 h-5" />
                              </div>
                              <div className="font-semibold text-gray-900">{role.label}</div>
                            </div>
                            <p className="text-xs text-gray-600">{role.description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Current Permissions */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-4">CURRENT PERMISSIONS</h4>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {availableResources.map((resource) => {
                          const resourcePermissions = userPermissions.permissions[resource.key] || [];
                          const hasAnyPermission = resourcePermissions.length > 0;
                          
                          return (
                            <div
                              key={resource.key}
                              className={`p-4 rounded-lg border ${
                                hasAnyPermission
                                  ? 'border-[#2D9596] bg-white'
                                  : 'border-gray-200 bg-white opacity-50'
                              }`}
                            >
                              <div className="font-medium text-gray-900 mb-2">{resource.label}</div>
                              <div className="flex flex-wrap gap-2">
                                {resource.actions.map((action) => {
                                  const hasPermission = resourcePermissions.includes(action);
                                  return (
                                    <span
                                      key={action}
                                      className={`px-2 py-1 rounded text-xs font-medium ${
                                        hasPermission
                                          ? 'bg-[#2D9596] text-white'
                                          : 'bg-gray-200 text-gray-500'
                                      }`}
                                    >
                                      {action}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                      <div>
                        <h5 className="font-semibold text-sm text-blue-900 mb-1">Casbin RBAC System</h5>
                        <p className="text-xs text-blue-700">
                          Permissions are managed using Casbin with role-based access control. 
                          Each role has predefined permissions. Changing a user's role will automatically 
                          update their permissions across the entire system.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Lock className="w-16 h-16 mb-4 text-gray-300" />
                <p className="text-lg font-medium">Select a user to manage permissions</p>
                <p className="text-sm">Choose a staff member from the list to view and edit their role</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsManagement;
