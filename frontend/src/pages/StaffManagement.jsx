import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api } from "../utils/api";
import { ChevronLeft } from 'lucide-react';
import StaffTable from "../components/settings/StaffTable";
import StaffTableHeader from "../components/settings/StaffTableHeader";
import UserDetailsPanel from "../components/settings/UserDetailsPanel";
import EditUserTab from "../components/settings/EditUserTab";
import PermissionsTab from "../components/settings/PermissionsTab";
import GearLoader from "../components/GearLoader";

const StaffManagement = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [availableRoles, setAvailableRoles] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  
  // Right panel state
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [userPanelTab, setUserPanelTab] = useState("accounts");
  
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Add User state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", role: "receptionist", password: "" });
  
  // Filter state
  const [selectedFilter, setSelectedFilter] = useState('All');
  const filters = ['All', 'Dentists', 'Receptionist', 'Inactive'];

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
  }, [setTitle, navigate]);

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

  const fetchAvailableRoles = async () => {
    try {
      const roles = await api.get("/clinic-users/roles");
      setAvailableRoles(roles);
    } catch (error) {
      console.error("Error fetching roles:", error);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    setAddingUser(true);
    try {
      const userData = {
        name: formData.name,
        email: formData.email,
        role: formData.role
      };
      if (formData.password && formData.password.trim()) {
        userData.password = formData.password;
      }
      await api.post("/clinic-users/", userData);
      toast.success("User added successfully");
      setShowAddModal(false);
      setFormData({ name: "", email: "", role: "receptionist", password: "" });
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Error adding user");
    } finally {
      setAddingUser(false);
    }
  };

  const handleUserClick = (clickedUser) => {
    setSelectedUser(clickedUser);
    setShowUserPanel(true);
    setUserPanelTab("accounts");
  };

  // Filter users based on selected filter
  const filteredUsers = users.filter(user => {
    if (selectedFilter === 'All') return true;
    if (selectedFilter === 'Dentists') return user.role === 'dentist' || user.role === 'doctor';
    if (selectedFilter === 'Receptionist') return user.role === 'receptionist';
    if (selectedFilter === 'Inactive') return !user.is_active;
    return true;
  });

  const handleClosePanel = () => {
    setShowUserPanel(false);
    setSelectedUser(null);
  };

  const handleSaveEditUser = async (userId, updateData) => {
    try {
      setSavingEditUser(true);
      await api.put(`/clinic-users/${userId}`, updateData);
      toast.success("User updated successfully");
      await fetchUsers();
      if (selectedUser && selectedUser.id === userId) {
        const updatedUser = await api.get(`/clinic-users/${userId}`);
        setSelectedUser(updatedUser);
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Failed to update user");
    } finally {
      setSavingEditUser(false);
    }
  };

  const handleSavePermissions = async (userId, permissions) => {
    try {
      setSavingPermissions(true);
      await api.put(`/clinic-users/${userId}`, { permissions });
      toast.success("User permissions updated successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error("Failed to update permissions");
    } finally {
      setSavingPermissions(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <GearLoader />
      </div>
    );
  }

  if (!hasPermission("users:view")) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <p className="text-gray-500 text-lg">You don't have permission to view staff management.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 overflow-y-auto transition-all duration-300 ${showUserPanel ? 'mr-96' : ''}`}>
          <div className="p-6">
            <StaffTableHeader
              userCount={filteredUsers.length}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              onFiltersClick={() => setShowFilters(!showFilters)}
              onAddUser={() => setShowAddModal(true)}
            />
            
            {/* Filter Tabs */}
            <div className="flex gap-3 mb-4">
              {filters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => setSelectedFilter(filter)}
                  className={`px-5 py-2.5 rounded-full font-semibold text-sm transition ${
                    selectedFilter === filter
                      ? 'bg-[#2D9596] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
            
            <StaffTable
              users={filteredUsers}
              onUserClick={handleUserClick}
              searchQuery={searchQuery}
            />
          </div>
        </div>

        {showUserPanel && selectedUser && (
          <UserDetailsPanel
            user={selectedUser}
            onClose={handleClosePanel}
            activeTab={userPanelTab}
            onTabChange={setUserPanelTab}
          >
            {userPanelTab === "edit" && (
              <EditUserTab
                user={selectedUser}
                onSave={handleSaveEditUser}
                isSaving={savingEditUser}
                availableRoles={availableRoles}
              />
            )}
            {userPanelTab === "permissions" && (
              <PermissionsTab
                user={selectedUser}
                onSave={handleSavePermissions}
                isSaving={savingPermissions}
              />
            )}
          </UserDetailsPanel>
        )}
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={() => setShowAddModal(false)}></div>
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Add User</h3>
              <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <form id="add-user-form" onSubmit={handleAddUser}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                  >
                    {availableRoles.map((role) => (
                      <option key={role.value || role} value={role.value || role}>
                        {role.label || role}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password (Optional)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2a276e]"
                    placeholder="Leave empty for auto-generated password"
                  />
                </div>
              </form>
            </div>
            <div className="p-6 border-t border-gray-200">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="add-user-form"
                  disabled={addingUser}
                  className="px-6 py-2 bg-[#2a276e] text-white rounded-lg hover:bg-[#1a1548] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {addingUser ? (
                    <>
                      <GearLoader size="w-4 h-4" className="text-white" />
                      <span>Adding...</span>
                    </>
                  ) : (
                    "Add User"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
