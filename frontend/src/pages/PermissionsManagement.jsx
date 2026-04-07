import React, { useState, useEffect } from "react";
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { useHeader } from "../contexts/HeaderContext";
import { useAuth } from "../contexts/AuthContext";
import { api, getPermissionAwareErrorMessage } from "../utils/api";
import GearLoader from "../components/GearLoader";
import FeatureLock from "../components/FeatureLock";
import { ChevronLeft, X, Shield, ChevronRight, Search } from 'lucide-react';

const MODULES = [
  { key: 'dashboard',     label: 'Dashboard',     actions: ['read'] },
  { key: 'appointments',  label: 'Appointments',   actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'patients',      label: 'Patients',       actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'finance',       label: 'Finance',        actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'vendors',       label: 'Vendors',        actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'inventory',     label: 'Inventory',      actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'inbox',         label: 'Inbox',          actions: ['read', 'write'] },
  { key: 'reports',       label: 'Reports',        actions: ['read'] },
  { key: 'marketing',     label: 'Marketing',      actions: ['read', 'write', 'edit'] },
  { key: 'staff',         label: 'Staff / Admin',  actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'lab',           label: 'Lab',            actions: ['read', 'write', 'edit', 'delete'] },
  { key: 'settings',      label: 'Settings',       actions: ['read', 'write', 'edit'] },
  { key: 'consent',       label: 'Consent Forms',  actions: ['read', 'write', 'edit', 'delete'] },
];

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
      checked ? 'bg-[#2D9596]' : 'bg-gray-200'
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
          <span className="text-sm font-medium">Admin Hub</span>
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

  const filteredUsers = users.filter(u =>
    !searchQuery ||
    u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const initials = (name) => name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?';

  return (
    <div className="flex flex-col h-full bg-transparent overflow-y-auto custom-scrollbar p-6 lg:p-8 pb-10">
      {/* Breadcrumb */}
      <div className="mb-6 flex items-center gap-2 text-sm font-medium text-gray-500">
        <span>Admin</span><span>/</span><span className="text-gray-900">Permissions</span>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <div className="flex gap-6 -mb-px">
          <button onClick={() => navigate('/admin/staff')} className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-900 transition-colors">Staff</button>
          <button className="pb-3 text-sm font-medium border-b-2 border-[#29828a] text-[#29828a]">Permissions</button>
          <button onClick={() => navigate('/admin/attendance')} className="pb-3 text-sm font-medium border-b-2 border-transparent text-gray-500 hover:text-gray-900 transition-colors">Attendance</button>
        </div>
      </div>

      <FeatureLock featureName="Advanced Permissions & RBAC">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {/* Table toolbar */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <p className="text-sm font-semibold text-gray-700">{filteredUsers.length} staff members</p>
            <div className="relative w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search staff..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D9596]/20 focus:border-[#2D9596]"
              />
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><GearLoader /></div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Modules Access</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map(u => {
                  const perms = (u.permissions && typeof Object.values(u.permissions)[0] === 'object') ? u.permissions : {};
                  const accessCount = MODULES.filter(m => m.actions.some(a => perms[m.key]?.[a])).length;
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => openDrawer(u)}>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-[#E0F2F2] text-[#1F6B72] font-bold text-xs flex items-center justify-center shrink-0">
                            {initials(u.name)}
                          </div>
                          <span className="text-sm font-semibold text-gray-900">{u.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || 'bg-gray-100 text-gray-600'}`}>
                          {ROLE_LABELS[u.role] || u.role}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-gray-500">{u.email}</td>
                      <td className="px-5 py-3.5">
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
                      <td className="px-5 py-3.5 text-right">
                        <ChevronRight size={16} className="text-gray-400 ml-auto" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Permissions Drawer */}
        {drawerUser && (
          <div className="fixed inset-0 z-50 pointer-events-none">
            <div className="absolute inset-0 bg-black/20 backdrop-blur-sm pointer-events-auto" onClick={() => setDrawerUser(null)} />
            <div className="absolute right-0 top-0 h-full w-full max-w-lg bg-white shadow-2xl flex flex-col pointer-events-auto animate-slide-in-right">
              {/* Drawer header */}
              <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#E0F2F2] text-[#1F6B72] font-bold text-sm flex items-center justify-center">
                    {initials(drawerUser.name)}
                  </div>
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
                  <tbody className="divide-y divide-gray-50">
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
                <button onClick={handleSave} disabled={saving} className="flex-1 py-2.5 text-sm font-bold text-white bg-[#2D9596] hover:bg-[#1F6B72] rounded-xl transition-colors disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Permissions'}
                </button>
              </div>
            </div>
          </div>
        )}
      </FeatureLock>
    </div>
  );
};

export default PermissionsManagement;
