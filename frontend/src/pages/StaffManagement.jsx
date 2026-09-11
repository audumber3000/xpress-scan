import React, { useState, useEffect } from "react";
import { notify } from '../utils/notify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import { can, canEditPermissions, permissionsLockReason } from "../constants/permissions";
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
import StaffAddedModal from "../components/settings/StaffAddedModal";
import ConfirmDialog from "../components/common/ConfirmDialog";
import GearLoader from "../components/GearLoader";
import PhoneLoginQR from "../components/phoneLogin/PhoneLoginQR";

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
  
  // Right panel state
  const [selectedUser, setSelectedUser] = useState(null);
  const [showUserPanel, setShowUserPanel] = useState(false);
  const [userPanelTab, setUserPanelTab] = useState("accounts");
  // Working hours has its own drawer — see WorkingHoursDrawer for why it does
  // not go through UserDetailsPanel.
  const [hoursFor, setHoursFor] = useState(null);
  
  const [savingEditUser, setSavingEditUser] = useState(false);
  const [savingPermissions, setSavingPermissions] = useState(false);
  
  // Add User state. The drawer owns its own saving flag — it is the thing with
  // a button to disable — so there is none kept here.
  const [showAddModal, setShowAddModal] = useState(false);
  // Who was just added, and what to hand them. Held here rather than in the
  // drawer so the drawer can close the moment the row exists — see
  // StaffAddedModal for why the old in-drawer version read as a failure.
  const [addedStaff, setAddedStaff] = useState(null);
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

  // What this person may do here, asked the one way the server also asks it.
  //
  // This screen used to check `permissions.users.view` itself. The grid writes
  // `staff.read`, so the check read a key nobody has ever had and the page
  // refused everyone but the owner — however much access the owner had
  // deliberately granted. See `can` in constants/permissions.
  const mayView = can(user, 'staff', 'read');
  const mayManage = can(user, 'staff', 'write');

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
    // Guarded, so somebody without access gets the explanation on its own
    // rather than three failed requests and a toast behind it.
    if (!mayView) return;
    fetchUsers();
    fetchAvailableRoles();
    fetchUserDevices();
  }, [setTitle, navigate, mayView]);

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

  /**
   * `silent` matters more than it looks.
   *
   * `loading` swaps the ENTIRE page for a GearLoader. So every refresh after a
   * save — adding somebody, changing their permissions, deactivating them —
   * unmounted the drawer that was open, and when the fetch came back the page
   * re-rendered with `showAddModal` still true. React mounted a brand new
   * AddStaffDrawer with brand new state: step one, empty fields.
   *
   * From the doctor's side that read as "I pressed Add and it threw me back
   * into a blank form", with nothing on screen saying the person had in fact
   * been created. Same mechanism closed the Permissions tab mid-edit.
   *
   * A refetch after a save is not a page load and must not be dressed as one.
   */
  const fetchUsers = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
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
      if (!silent) setLoading(false);
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

  /**
   * Returns the created staff member so the drawer can show their sign-in
   * details and say what is on its way to them. Errors are left to propagate:
   * the reason belongs on the form that caused it, next to the field to change.
   */
  const handleAddUser = async (payload) => {
    const created = await api.post("/clinic-users", payload);
    await fetchUsers({ silent: true });
    return created;
  };

  /**
   * Open somebody, on the tab the click was asking about.
   *
   * This used to navigate to /admin/permissions, a separate page that rendered
   * the same Team tabs, the same toolbar and the same teal chrome around a
   * second copy of the staff list — no Add button, different columns, search
   * and filters reset. Clicking a row therefore looked like the page had
   * glitched, and the permissions editor already living in this drawer was
   * reachable only by opening Edit and clicking across. One question, one
   * place.
   */
  const handleUserClick = (clickedUser) => {
    // Opening a permissions grid that cannot be saved is a dead end; say why.
    if (!canEditPermissions(user, clickedUser)) {
      notify.done(permissionsLockReason(user, clickedUser));
      return;
    }
    setSelectedUser(clickedUser);
    setUserPanelTab("permissions");
    setShowUserPanel(true);
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
      await fetchUsers({ silent: true });
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
      await fetchUsers({ silent: true });
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
      await fetchUsers({ silent: true });
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

  if (!mayView) {
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
        {/* Only for somebody the server will actually let add a person.
            Otherwise this offered a two-step form that ended in a 403. */}
        {mayManage && (
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-[#29828a] text-white text-sm font-semibold rounded-lg hover:bg-[#216b71] transition-colors whitespace-nowrap"
          >
            <UserPlus size={18} /> Add Staff
          </button>
        )}
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
        totalStaff={users.length}
        isSearching={!!searchQuery.trim()}
        userDevices={userDevices}
        loadingUserDevices={loadingUserDevices}
        onUserClick={handleUserClick}
        onEditUser={handleEditUser}
        onEditHours={handleEditHours}
        onToggleActive={handleToggleActive}
      />

      <>
        {showUserPanel && selectedUser && (
          <UserDetailsPanel
            user={selectedUser}
            onClose={handleClosePanel}
            activeTab={userPanelTab}
            onTabChange={setUserPanelTab}
            canPhoneLogin={
              !!selectedUser.is_active && (
                selectedUser.id === user?.id ||
                availableRoles.some((r) => (r?.value ?? r) === selectedUser.role)
              )
            }
          >
            {userPanelTab === "edit" && (
              <EditUserTab
                user={selectedUser}
                onSave={handleSaveEditUser}
                isSaving={savingEditUser}
                availableRoles={availableRoles}
              />
            )}
            {userPanelTab === "phone" && (
              <div className="bg-white border border-gray-200 rounded-xl p-5">
                <PhoneLoginQR
                  key={selectedUser.id}
                  userId={selectedUser.id === user?.id ? null : selectedUser.id}
                  personName={selectedUser.id === user?.id ? null : (selectedUser.name || selectedUser.email)}
                />
              </div>
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
        onAdded={(details) => {
          setAddedStaff(details);
          // Tier 4. Normally the confirmation would sit on the control that was
          // pressed, but that control is inside a drawer that has just closed,
          // so there is nowhere on the page left to put it.
          notify.done(`${details.name} was added to your staff.`);
        }}
      />

      <StaffAddedModal
        staff={addedStaff}
        onClose={() => setAddedStaff(null)}
        onAddAnother={() => { setAddedStaff(null); setShowAddModal(true); }}
      />
      </>
    </TeamTabs>
  );
};

export default StaffManagement;
