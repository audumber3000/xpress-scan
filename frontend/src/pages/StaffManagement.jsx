import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { formatDate, formatRelative } from "../utils/datetime";
import { canEditPermissions, permissionsLockReason } from "../constants/permissions";
import { ChevronLeft, UserPlus } from 'lucide-react';

// Display labels for the role filter, so the dropdown reads the way the table does.
const ROLE_LABEL = {
  clinic_owner: 'Clinic Owner',
  doctor: 'Doctor',
  dentist: 'Doctor',
  receptionist: 'Receptionist',
  assistant: 'Assistant',
};
import StaffTable from "../components/settings/StaffTable";
import TeamTabs from "../components/team/TeamTabs";
import TableToolbar from "../components/common/TableToolbar";
import FilterPanel from "../components/FilterPanel";
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
  // Sign-in devices, grouped by user. "Last active" was rendering "Never" for
  // everyone because this was never fetched — the table defaulted it to {}.
  const [userDevices, setUserDevices] = useState({});
  const [loadingUserDevices, setLoadingUserDevices] = useState(true);
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
  const [formData, setFormData] = useState({ name: "", email: "", username: "", role: "receptionist", password: "", phone: "", fee_basis: "", fee_value: "" });
  
  // Role + status, applied together by the shared FilterPanel. Replaces the row
  // of pill buttons, which could only express one choice at a time.
  const [staffFilters, setStaffFilters] = useState({ role: '', status: '' });

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button
          onClick={() => navigate('/admin')}
          className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition"
        >
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
    fetchUsers();
    fetchAvailableRoles();
    fetchUserDevices();
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

  // One call for the whole clinic, then grouped here — a request per staff row
  // would turn a ten-person list into ten round trips.
  const fetchUserDevices = async () => {
    try {
      setLoadingUserDevices(true);
      const devices = await api.get('/devices');
      const byUser = {};
      (Array.isArray(devices) ? devices : []).forEach((d) => {
        (byUser[d.user_id] = byUser[d.user_id] || []).push(d);
      });
      setUserDevices(byUser);
    } catch (err) {
      // Not fatal: the staff list is still useful without last-seen times.
      console.error('Error fetching devices:', err);
      setUserDevices({});
    } finally {
      setLoadingUserDevices(false);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/clinic-users");
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to load users",
        "You don't have permission to view staff users."
      ));
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
    const email = (formData.email || "").trim();
    const username = (formData.username || "").trim();
    if (!email && !username) {
      toast.error("Please provide either an email or a username");
      return;
    }
    setAddingUser(true);
    try {
      const userData = {
        name: formData.name,
        role: formData.role,
        phone: (formData.phone || "").trim() || null,
        // Blank basis means "not a paid consultant", which is most staff.
        fee_basis: formData.fee_basis || null,
        fee_value: formData.fee_basis ? Number(formData.fee_value) || 0 : null
      };
      if (email) userData.email = email;
      if (username) userData.username = username;
      if (formData.password && formData.password.trim()) {
        userData.password = formData.password;
      }
      await api.post("/clinic-users/", userData);
      toast.success("User added successfully");
      setShowAddModal(false);
      setFormData({ name: "", email: "", username: "", role: "receptionist", password: "", phone: "", fee_basis: "", fee_value: "" });
      fetchUsers();
    } catch (error) {
      console.error("Error adding user:", error);
      toast.error(error.message || "Error adding user");
    } finally {
      setAddingUser(false);
    }
  };

  // Clicking a staff member goes to their permissions rather than squeezing the
  // table into a side panel — permissions is what this list is mostly used for.
  const handleUserClick = (clickedUser) => {
    // Sending someone to a permissions screen they can't act on is a dead end;
    // say why here instead.
    if (!canEditPermissions(user, clickedUser)) {
      toast.info(permissionsLockReason(user, clickedUser));
      return;
    }
    navigate(`/admin/permissions?user=${clickedUser.id}`);
  };

  // Editing name/role still needs a home, so it moved to a per-row icon.
  const handleEditUser = (clickedUser) => {
    setSelectedUser(clickedUser);
    setShowUserPanel(true);
    setUserPanelTab("edit");
  };

  // Filter users based on selected filter
  // Search was previously passed down to StaffTable, which has no such prop, so
  // typing in the box did nothing. It filters here now, alongside the role and
  // status choices from the filter panel.
  const filteredUsers = users.filter((u) => {
    const q = searchQuery.trim().toLowerCase();
    if (q && ![u.name, u.email, u.username, u.role].some(
      (v) => String(v || '').toLowerCase().includes(q)
    )) return false;

    if (staffFilters.role && (ROLE_LABEL[u.role] || u.role) !== staffFilters.role) return false;
    if (staffFilters.status === 'Active' && !u.is_active) return false;
    if (staffFilters.status === 'Inactive' && u.is_active) return false;
    return true;
  });

  const handleClosePanel = () => {
    setShowUserPanel(false);
    setSelectedUser(null);
  };

  const handleToggleActive = async (targetUser) => {
    if (targetUser.role === 'clinic_owner') {
      toast.error('Cannot deactivate the clinic owner');
      return;
    }
    try {
      const newState = !targetUser.is_active;
      await api.put(`/clinic-users/${targetUser.id}`, { is_active: newState });
      toast.success(`${targetUser.name} marked as ${newState ? 'active' : 'inactive'}`);
      fetchUsers();
    } catch (err) {
      toast.error(getPermissionAwareErrorMessage(
        err,
        'Failed to update status',
        "You don't have permission to update user status."
      ));
    }
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
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to update user",
        "You don't have permission to update this user."
      ));
    } finally {
      setSavingEditUser(false);
    }
  };

  const handleSavePermissions = async (userId, permissions) => {
    const target = users.find(u => String(u.id) === String(userId));
    if (!canEditPermissions(user, target)) {
      toast.error(permissionsLockReason(user, target) || 'These permissions cannot be changed.');
      return;
    }
    try {
      setSavingPermissions(true);
      await api.put(`/clinic-users/${userId}`, { permissions });
      toast.success("User permissions updated successfully");
      await fetchUsers();
    } catch (error) {
      console.error("Error updating permissions:", error);
      toast.error(getPermissionAwareErrorMessage(
        error,
        "Failed to update permissions",
        "You don't have permission to update user permissions."
      ));
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
    <TeamTabs active="staff">
      <TableToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search staff by name, email or role..."
      >
        <FilterPanel
          accent="teal"
          dateEnabled={false}
          value={staffFilters}
          onApply={setStaffFilters}
          filters={[
            { key: 'role', label: 'Role', options: [...new Set(users.map((u) => ROLE_LABEL[u.role] || u.role))].filter(Boolean) },
            { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
          ]}
        />
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-[#29828a] text-white text-sm font-semibold rounded-lg hover:bg-[#216b71] transition-colors whitespace-nowrap"
        >
          <UserPlus size={18} /> Add Staff
        </button>
      </TableToolbar>

      <StaffTable
        users={filteredUsers}
        userDevices={userDevices}
        loadingUserDevices={loadingUserDevices}
        onUserClick={handleUserClick}
        onEditUser={handleEditUser}
        onToggleActive={handleToggleActive}
        currentUserId={user?.id}
      />

      <>
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                    required
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email <span className="text-gray-400 font-normal">(required for owners; optional for staff)</span>
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Username <span className="text-gray-400 font-normal">(optional — staff can log in with username instead of email)</span>
                  </label>
                  <input
                    type="text"
                    name="username"
                    value={formData.username}
                    onChange={handleInputChange}
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                    placeholder="e.g. reception1"
                  />
                </div>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Role</label>
                  <select
                    name="role"
                    value={formData.role}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                  >
                    {availableRoles.map((role) => (
                      <option key={role.value || role} value={role.value || role}>
                        {role.label || role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Mobile <span className="text-gray-400 font-normal">(so we can send their login on WhatsApp)</span>
                  </label>
                  <input
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                    placeholder="9876543210"
                  />
                </div>

                {/* Set once here, applied to every case this person treats. The
                    alternative, typing a fee on each case paper, is how the same
                    doctor ends up on three different rates. */}
                <div className="mb-4 rounded-lg border border-gray-200 p-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Consultant fee <span className="text-gray-400 font-normal">(optional)</span>
                  </label>
                  <p className="text-xs text-gray-500 mb-2.5">
                    Leave off unless this person is paid per case. It is then applied
                    automatically to every case they treat.
                  </p>
                  <div className="flex gap-2">
                    <select
                      name="fee_basis"
                      value={formData.fee_basis}
                      onChange={handleInputChange}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                    >
                      <option value="">Not paid per case</option>
                      <option value="fixed">Fixed amount per case</option>
                      <option value="percentage">Share of what is collected</option>
                    </select>
                    {formData.fee_basis && (
                      <div className="relative w-32 flex-shrink-0">
                        <input
                          type="number"
                          name="fee_value"
                          value={formData.fee_value}
                          onChange={handleInputChange}
                          placeholder={formData.fee_basis === 'percentage' ? '40' : '1500'}
                          className="w-full px-3 py-2 pr-7 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#29828a]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                          {formData.fee_basis === 'percentage' ? '%' : '₹'}
                        </span>
                      </div>
                    )}
                  </div>
                  {formData.fee_basis === 'percentage' && (
                    <p className="text-[11px] text-gray-500 mt-2">
                      Worked out on what the patient has actually paid, so you never owe a
                      share of money you have not received.
                    </p>
                  )}
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">Password (Optional)</label>
                  <input
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#29828a]"
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
                  className="px-6 py-2 bg-[#29828a] text-white rounded-lg hover:bg-[#216b71] transition font-medium disabled:opacity-50 flex items-center justify-center gap-2"
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
      </>
    </TeamTabs>
  );
};

export default StaffManagement;
