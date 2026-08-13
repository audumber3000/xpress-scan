import React, { useState, useEffect } from "react";
import { notify } from '../utils/notify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { formatDate, formatRelative } from "../utils/datetime";
import { canEditPermissions, permissionsLockReason } from "../constants/permissions";
import { ChevronLeft, UserPlus } from 'lucide-react';


import StaffTable from "../components/settings/StaffTable";
import TeamTabs from "../components/team/TeamTabs";
// Shared with the calendar and the staff panel — see constants/roles.js.
// Two copies of the role list is one list that eventually goes stale.
import { ROLE_LABEL } from "../constants/roles";
import TableToolbar from "../components/common/TableToolbar";
import FilterPanel from "../components/FilterPanel";
import UserDetailsPanel from "../components/settings/UserDetailsPanel";
import WorkingHoursDrawer from "../components/settings/WorkingHoursDrawer";
import EditUserTab from "../components/settings/EditUserTab";
import PermissionsTab from "../components/settings/PermissionsTab";
import AddStaffDrawer from "../components/settings/AddStaffDrawer";
import ConfirmDialog from "../components/common/ConfirmDialog";
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
  // Working hours has its own drawer — see WorkingHoursDrawer for why it does
  // not go through UserDetailsPanel.
  const [hoursFor, setHoursFor] = useState(null);
  
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Add User state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addingUser, setAddingUser] = useState(false);
  const [deactivateTarget, setDeactivateTarget] = useState(null);
  
  // Role + status, applied together by the shared FilterPanel. Replaces the row
  // of pill buttons, which could only express one choice at a time.
  // Defaults to Active on purpose. Staff who have left cannot be deleted —
  // their name is attached to appointments, payments and audit rows that have
  // to keep making sense — so if they also stayed in this list forever, the
  // only way to tidy up would be a delete the system has to refuse. Hiding
  // them by default is what makes deactivating feel like an answer instead of
  // a half-measure.
  const [staffFilters, setStaffFilters] = useState({ role: '', status: 'Active' });

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
      notify.problem(getPermissionAwareErrorMessage(
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

  const handleAddUser = async (payload) => {
    setAddingUser(true);
    try {
      await api.post("/clinic-users", payload);
      await fetchUsers();
    } finally {
      setAddingUser(false);
    }
  };

  const handleUserClick = (clickedUser) => {
    // Sending someone to a permissions screen they can't act on is a dead end;
    // say why here instead.
    if (!canEditPermissions(user, clickedUser)) {
      notify.done(permissionsLockReason(user, clickedUser));
      return;
    }
    navigate(`/admin/permissions?user=${clickedUser.id}`);
  };

  // Working hours, straight from the row. Deliberately not behind the
  // permissions gate: an owner setting their own consulting hours is not the
  // same act as an owner editing their own permissions.
  const handleEditHours = (clickedUser) => setHoursFor(clickedUser);

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

  const inactiveCount = users.filter((u) => !u.is_active).length;
  const hidingInactive = staffFilters.status === 'Active' && inactiveCount > 0;

  const handleClosePanel = () => {
    setShowUserPanel(false);
    setSelectedUser(null);
  };

  /**
   * Deactivating takes effect on their very next request, not at their next
   * sign-in: get_current_user re-reads is_active from the database on every
   * call, so somebody with the app open loses it within seconds.
   *
   * That immediacy is why this asks first. Reactivating does not — restoring
   * access is not the direction that needs a second thought.
   */
  const handleToggleActive = (targetUser) => {
    if (targetUser.role === 'clinic_owner') {
      notify.problem('The clinic owner cannot be deactivated.');
      return;
    }
    if (targetUser.is_active) setDeactivateTarget(targetUser);
    else applyActiveState(targetUser, true);
  };

  const applyActiveState = async (targetUser, nextState) => {
    setDeactivateTarget(null);
    try {
      await api.put(`/clinic-users/${targetUser.id}`, { is_active: nextState });
      await fetchUsers();
    } catch (err) {
      notify.problem(getPermissionAwareErrorMessage(
        err,
        'Could not change their status.',
        "You don't have permission to change who can sign in."
      ));
    }
  };

  const handleSaveEditUser = async (userId, updateData) => {
    setSavingEditUser(true);
    try {
      // The PUT already answers with the whole updated staff member, so the
      // panel refreshes from that. It used to re-fetch GET /clinic-users/{id},
      // an endpoint that has never existed — so a save that worked perfectly
      // was followed by a 405 and the words "Failed to update user".
      const updated = await api.put(`/clinic-users/${userId}`, updateData);
      await fetchUsers();
      if (selectedUser?.id === userId && updated) setSelectedUser(updated);
    } catch (error) {
      console.error("Error updating user:", error);
      // Rethrown so the reason lands on the form that caused it, next to the
      // field the user has to change, rather than as a toast over the drawer.
      throw error;
    } finally {
      setSavingEditUser(false);
    }
  };

  /**
   * `payload` is { role, permissions } — the tab saves both together, because
   * picking "Doctor" and then leaving without touching a checkbox should still
   * change what that person can do.
   *
   * It used to take the permissions map as the second argument and wrap it as
   * `{ permissions }`, which with the tab's actual payload sent
   * `{ permissions: { role, permissions } }` — the role buried a level down and
   * the real permissions never applied.
   */
  const handleSavePermissions = async (userId, payload) => {
    const target = users.find(u => String(u.id) === String(userId));
    if (!canEditPermissions(user, target)) {
      throw new Error(permissionsLockReason(user, target) || 'These permissions cannot be changed.');
    }
    setSavingPermissions(true);
    try {
      const updated = await api.put(`/clinic-users/${userId}`, payload);
      await fetchUsers();
      if (selectedUser?.id === userId && updated) setSelectedUser(updated);
    } catch (error) {
      console.error("Error updating permissions:", error);
      throw error;   // shown on the form that caused it
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

      <WorkingHoursDrawer
        open={!!hoursFor}
        staff={hoursFor}
        onClose={() => setHoursFor(null)}
      />

      {/* Where the people who have left went. Without this line, defaulting to
          Active looks like the list silently lost somebody. */}
      {hidingInactive && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-lg bg-gray-50 border border-gray-200">
          <p className="text-sm text-gray-500">
            {inactiveCount} {inactiveCount === 1 ? 'person has' : 'people have'} been deactivated and
            {inactiveCount === 1 ? ' is' : ' are'} hidden. Their records stay in your history.
          </p>
          <button
            onClick={() => setStaffFilters((f) => ({ ...f, status: '' }))}
            className="text-sm font-semibold text-[#29828a] hover:text-[#216b71] whitespace-nowrap"
          >
            Show them
          </button>
        </div>
      )}

      <StaffTable
        users={filteredUsers}
        userDevices={userDevices}
        loadingUserDevices={loadingUserDevices}
        onUserClick={handleUserClick}
        onEditUser={handleEditUser}
        onEditHours={handleEditHours}
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
                availableRoles={availableRoles}
              />
            )}
          </UserDetailsPanel>
        )}

      <ConfirmDialog
        open={!!deactivateTarget}
        onClose={() => setDeactivateTarget(null)}
        tone="danger"
        title={`Deactivate ${deactivateTarget?.name || 'this person'}?`}
        message={
          <>
            They lose access <span className="font-semibold text-gray-700">straight away</span>, even
            if they have the app open right now. Everything they have already done stays in your
            records, and you can switch them back on at any time.
          </>
        }
        actions={[{
          label: 'Deactivate',
          variant: 'danger',
          onClick: () => applyActiveState(deactivateTarget, false),
        }]}
      />

      <AddStaffDrawer
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        availableRoles={availableRoles}
        onCreate={handleAddUser}
      />
      </>
    </TeamTabs>
  );
};

export default StaffManagement;
