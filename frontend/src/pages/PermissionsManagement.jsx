import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import GearLoader from "../components/GearLoader";
import Pagination from "../components/Pagination";
import { ChevronLeft, X, Shield, ChevronRight, Lock } from 'lucide-react';
import { resolveUserAvatar } from "../utils/avatar";
import TeamTabs from "../components/team/TeamTabs";
import TableToolbar from "../components/common/TableToolbar";
import FilterPanel from "../components/FilterPanel";
import { MODULES, canEditPermissions, permissionsLockReason } from "../constants/permissions";

const USERS_PER_PAGE = 10;


const ALL_ACTIONS = ['read', 'write', 'edit', 'delete'];

const ROLE_PRESETS = {
  clinic_owner: Object.fromEntries(MODULES.map(m => [m.key, Object.fromEntries(m.actions.map(a => [a, true]))]) ),
  doctor: {
    dashboard:    { read: true },
    appointments: { read: true, write: false, edit: true, delete: false },
    patients:     { read: true, write: false, edit: true, delete: false },
    finance:      { read: true, write: false, edit: false, delete: false },
    inbox:        { read: true, write: true },
    reports:      { read: true },
    marketing:    { read: true, write: false, edit: false },
    lab:          { read: true, write: true, edit: true, delete: false },
    staff:        { read: false, write: false, edit: false, delete: false },
    settings:     { read: false, write: false, edit: false },
    consent:      { read: true, write: true, edit: true, delete: false },
  },
  receptionist: {
    dashboard:    { read: true },
    appointments: { read: true, write: true, edit: true, delete: false },
    patients:     { read: true, write: true, edit: true, delete: false },
    finance:      { read: true, write: true, edit: false, delete: false },
    inbox:        { read: true, write: true },
    reports:      { read: false },
    marketing:    { read: false, write: false, edit: false },
    lab:          { read: true, write: false, edit: false, delete: false },
    staff:        { read: false, write: false, edit: false, delete: false },
    settings:     { read: false, write: false, edit: false },
    consent:      { read: true, write: true, edit: false, delete: false },
  },
};

const ROLE_COLORS = {
  clinic_owner: 'bg-[#E0F2F2] text-[#1F6B72]',
  doctor:       'bg-indigo-50 text-indigo-700',
  receptionist: 'bg-emerald-50 text-emerald-700',
};

const ROLE_LABELS = {
  clinic_owner: 'Clinic Owner',
  doctor:       'Doctor',
  receptionist: 'Receptionist',
};

const Toggle = ({ checked, onChange }) => (
  <button
    type="button"
    onClick={onChange}
    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
      checked ? 'bg-[#29828a]' : 'bg-gray-200'
    }`}
  >
    <span
      className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
        checked ? 'translate-x-4' : 'translate-x-0'
      }`}
    />
  </button>
);

const PermissionsManagement = () => {
  const { setTitle } = useHeader();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerUser, setDrawerUser] = useState(null);
  const [permissions, setPermissions] = useState({});
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setTitle(
      <div className="flex items-center gap-2">
        <button onClick={() => navigate('/admin')} className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition">
          <ChevronLeft className="w-5 h-5" />
          <span className="text-sm font-medium">Control Center</span>
        </button>
      </div>
    );
    fetchUsers();
  }, [setTitle, navigate]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const data = await api.get("/clinic-users");
      setUsers(data);
    } catch (err) {
      toast.error(getPermissionAwareErrorMessage(
        err,
        "Failed to load users",
        "You don't have permission to view staff users."
      ));
    } finally {
      setLoading(false);
    }
  };

  const openDrawer = (u) => {
    setDrawerUser(u);
    const saved = u.permissions || {};
    const merged = {};
    MODULES.forEach(m => {
      merged[m.key] = {};
      m.actions.forEach(a => {
        // Only true if admin explicitly saved it as true — deny by default
        merged[m.key][a] = saved[m.key]?.[a] === true;
      });
    });
    setPermissions(merged);
  };

  // Deep link from Staff: /admin/permissions?user=<id> opens that person's
  // permissions drawer straight away. Waits for the user list, since the drawer
  // needs the whole record. The param is stripped once applied so a refresh
  // doesn't force the drawer back open.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const id = params.get('user');
    if (!id) return;
    const target = users.find(u => String(u.id) === id);
    if (!target) return; // still loading — retry when users arrive
    // A hand-typed or stale link must not open an editor a click wouldn't.
    if (!canEditPermissions(user, target)) {
      toast.error(permissionsLockReason(user, target));
      params.delete('user');
      navigate({ search: params.toString() }, { replace: true });
      return;
    }
    openDrawer(target);
    params.delete('user');
    navigate({ search: params.toString() }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.search, users]);

  const applyPreset = (role) => {
    const preset = ROLE_PRESETS[role] || {};
    const merged = {};
    MODULES.forEach(m => {
      merged[m.key] = {};
      m.actions.forEach(a => {
        merged[m.key][a] = preset[m.key]?.[a] ?? false;
      });
    });
    setPermissions(merged);
  };

  const togglePerm = (moduleKey, action) => {
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] }
    }));
  };

  const toggleAllForModule = (moduleKey, actions) => {
    const allOn = actions.every(a => permissions[moduleKey]?.[a]);
    setPermissions(prev => ({
      ...prev,
      [moduleKey]: Object.fromEntries(actions.map(a => [a, !allOn]))
    }));
  };

  const handleSave = async () => {
    if (!canEditPermissions(user, drawerUser)) {
      toast.error(permissionsLockReason(user, drawerUser));
      return;
    }
    if (!drawerUser) return;
    try {
      setSaving(true);
      await api.put(`/clinic-users/${drawerUser.id}`, { permissions });
      toast.success("Permissions updated");
      setDrawerUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(getPermissionAwareErrorMessage(
        err,
        "Failed to save permissions",
        "You don't have permission to update user permissions."
      ));
    } finally {
      setSaving(false);
    }
  };

  const [permFilters, setPermFilters] = useState({ role: '' });
  const filteredUsers = users.filter(u => {
    const q = searchQuery.trim().toLowerCase();
    if (q && ![u.name, u.email].some(v => String(v || '').toLowerCase().includes(q))) return false;
    if (permFilters.role && (ROLE_LABELS[u.role] || u.role) !== permFilters.role) return false;
    return true;
  });
  const [usersPage, setUsersPage] = useState(1);
  const paginatedUsers = filteredUsers.slice((usersPage - 1) * USERS_PER_PAGE, usersPage * USERS_PER_PAGE);

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <TeamTabs active="permissions">
      <TableToolbar
        search={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder="Search staff by name or email..."
      >
        <FilterPanel
          accent="teal"
          dateEnabled={false}
          value={permFilters}
          onApply={setPermFilters}
          filters={[
            { key: 'role', label: 'Role', options: [...new Set(users.map(u => ROLE_LABELS[u.role] || u.role))].filter(Boolean) },
          ]}
        />
      </TableToolbar>

      <>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20"><GearLoader /></div>
          ) : (
            <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-[#f8fafc]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Modules Access</th>
                  <th className="px-6 py-4" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {paginatedUsers.map(u => {
                  const perms = (u.permissions && typeof Object.values(u.permissions)[0] === 'object') ? u.permissions : {};
                  const accessCount = MODULES.filter(m => m.actions.some(a => perms[m.key]?.[a])).length;
                  return (
                    <tr
                      key={u.id}
                      onClick={() => canEditPermissions(user, u) && openDrawer(u)}
                      title={permissionsLockReason(user, u) || undefined}
                      className={`transition-colors duration-150 ${
                        canEditPermissions(user, u)
                          ? 'hover:bg-indigo-50/30 cursor-pointer'
                          : 'cursor-not-allowed'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <img 
                            src={resolveUserAvatar(u)} 
                            alt={u.name}
                            className="w-9 h-9 rounded-full object-cover shrink-0 bg-gray-100"
                          />
                          <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500">{u.email}</td>
                      <td className="px-6 py-4">
                        {(() => {
                          const readCount = MODULES.filter(m => perms[m.key]?.read === true).length;
                          let label, cls;
                          if (readCount === 0)              { label = 'None';    cls = 'bg-gray-100 text-gray-500'; }
                          else if (readCount === MODULES.length) { label = 'All'; cls = 'bg-[#E0F2F2] text-[#1F6B72]'; }
                          else                              { label = 'Partial'; cls = 'bg-amber-50 text-amber-600'; }
                          return (
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cls}`}>{label}</span>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {canEditPermissions(user, u)
                          ? <ChevronRight size={16} className="text-gray-400 ml-auto" />
                          : <Lock size={14} className="text-gray-300 ml-auto" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          )}
          <Pagination
            page={usersPage}
            pageSize={USERS_PER_PAGE}
            totalItems={filteredUsers.length}
            onPageChange={setUsersPage}
          />
        </div>

        {/* Permissions Drawer */}
        {drawerUser && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={() => setDrawerUser(null)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <img 
                    src={resolveUserAvatar(drawerUser)} 
                    alt={drawerUser.name}
                    className="w-10 h-10 rounded-full object-cover shrink-0 bg-gray-100"
                  />
                  <div>
                    <p className="font-bold text-gray-900 text-sm leading-tight">{drawerUser.name}</p>
                    <p className="text-xs text-gray-500">{drawerUser.email}</p>
                  </div>
                </div>
                <button onClick={() => setDrawerUser(null)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <X size={18} className="text-gray-500" />
                </button>
              </div>

              {/* Presets */}
              <div className="px-6 py-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Quick Presets</p>
                <div className="flex gap-2">
                  {Object.entries(ROLE_LABELS).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => applyPreset(key)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                        ROLE_COLORS[key]
                      } border-transparent hover:border-current`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Permission matrix */}
              <div className="flex-1 overflow-y-auto">
                <table className="w-full">
                  <thead className="sticky top-0 bg-gray-50 border-b border-gray-100 z-10">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                      {ALL_ACTIONS.map(a => (
                        <th key={a} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{a}</th>
                      ))}
                      <th className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">All</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {MODULES.map(m => (
                      <tr key={m.key} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-3.5 text-sm font-medium text-gray-800">{m.label}</td>
                        {ALL_ACTIONS.map(a => (
                          <td key={a} className="px-3 py-3.5 text-center">
                            {m.actions.includes(a) ? (
                              <Toggle
                                checked={!!permissions[m.key]?.[a]}
                                onChange={() => togglePerm(m.key, a)}
                              />
                            ) : (
                              <span className="text-gray-200">—</span>
                            )}
                          </td>
                        ))}
                        <td className="px-3 py-3.5 text-center">
                          {(() => {
                            const onCount = m.actions.filter(a => permissions[m.key]?.[a]).length;
                            const total = m.actions.length;
                            let label, cls;
                            if (onCount === 0)  { label = 'None';    cls = 'bg-gray-100 text-gray-400'; }
                            else if (onCount === total) { label = 'All'; cls = 'bg-[#E0F2F2] text-[#1F6B72]'; }
                            else               { label = 'Partial'; cls = 'bg-amber-50 text-amber-600'; }
                            return (
                              <button
                                onClick={() => toggleAllForModule(m.key, m.actions)}
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${cls} hover:opacity-80 transition-opacity`}
                              >
                                {label}
                              </button>
                            );
                          })()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
                <button onClick={() => setDrawerUser(null)} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#29828a] hover:bg-[#216b71] rounded-xl transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    </TeamTabs>
  );
};

export default PermissionsManagement;
