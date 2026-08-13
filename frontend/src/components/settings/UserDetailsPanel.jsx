import React from 'react';
import { X, User, Pencil, ShieldCheck } from 'lucide-react';
import { getInitials } from '../../utils/avatar';
import { resolveUserAvatar } from '../../utils/avatar';

/**
 * The staff detail drawer: who this person is, and the tabs for changing it.
 *
 * A composition shell on purpose. It owns the drawer, the header and the tab
 * strip; the panes themselves arrive as children, so Staff decides what an
 * "Edit" tab means without this file having to know about roles, permissions
 * or which handler saves them.
 *
 * ─── Why this file was rewritten ────────────────────────────────────────────
 *
 * It used to take a dozen individual props — selectedUser, userPanelTab,
 * setUserPanelTab, onSetPassword, onEditUser, onManagePermissions, formData,
 * handleInputChange and the rest — and render every pane itself. Only the
 * orphaned Settings screen at /user-management ever called it that way.
 *
 * The live Staff screen calls it as a composition: `user`, `activeTab`,
 * `onTabChange` and children. With the old contract, `selectedUser` was
 * therefore always undefined, the very first line was `if (!selectedUser)
 * return null`, and **clicking a staff member in Staff opened nothing at all**.
 * Edit, permissions and password were unreachable in the shipping UI.
 *
 * The composition shape is the better of the two and the one already in use, so
 * this now matches it rather than the caller being bent back.
 *
 * Props:
 *   user         the staff member. Nothing renders without one.
 *   activeTab    'accounts' | 'edit' | 'permissions'
 *   onTabChange  (tabId) => void
 *   onClose      backdrop / ✕
 *   children     the active pane, chosen by the caller
 */

const TABS = [
  { id: 'accounts',    label: 'Overview',    icon: User },
  { id: 'edit',        label: 'Edit',        icon: Pencil },
  { id: 'permissions', label: 'Permissions', icon: ShieldCheck },
];

const Row = ({ label, children }) => (
  <div className="flex items-start justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
    <span className="text-sm text-gray-500 shrink-0">{label}</span>
    <span className="text-sm font-medium text-gray-900 text-right min-w-0 break-words">{children}</span>
  </div>
);

const UserDetailsPanel = ({ user, activeTab = 'accounts', onTabChange, onClose, children }) => {
  if (!user) return null;

  const isOwner = user.role === 'clinic_owner';
  // The owner's permissions are fixed and the backend refuses to edit them, so
  // offering the tab would be a promise the server breaks.
  const tabs = TABS.filter((t) => !(t.id === 'permissions' && isOwner));

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={onClose} />

      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl overflow-hidden flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div className="flex items-center gap-4 min-w-0">
            <img
              src={resolveUserAvatar(user, 96)}
              alt=""
              className="h-12 w-12 rounded-full bg-gray-100 object-cover shrink-0"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 truncate">
                {user.name || getInitials(user.name)}
              </h3>
              <p className="text-sm text-gray-500 truncate">
                {user.email || user.username || 'No sign-in details'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition shrink-0">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <div className="px-6 border-b border-gray-200">
          <div className="flex gap-1 -mb-px">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => onTabChange?.(id)}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors rounded-t-lg ${
                  activeTab === id
                    ? 'border-[#29828a] text-[#29828a] bg-white'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                <Icon size={14} />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'accounts' ? (
            <div className="bg-white border border-gray-200 rounded-xl px-5">
              <Row label="Name">{user.name || '—'}</Row>
              <Row label="Email">{user.email || '—'}</Row>
              {user.username && <Row label="Username">{user.username}</Row>}
              <Row label="Role">
                {(user.role || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) || '—'}
              </Row>
              <Row label="Status">
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  user.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-600'
                }`}>
                  {user.is_active ? 'Active' : 'Deactivated'}
                </span>
              </Row>
              {user.phone && <Row label="Phone">{user.phone}</Row>}
              {user.joined_on && <Row label="Joined">{new Date(user.joined_on).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</Row>}
              {user.salary_amount != null && (
                <Row label="Salary">
                  ₹{Number(user.salary_amount).toLocaleString('en-IN')}
                  {user.salary_day ? <span className="text-gray-400 font-normal"> · paid on the {user.salary_day}</span> : null}
                </Row>
              )}
              {user.fee_basis && (
                <Row label="Case fee">
                  {user.fee_basis === 'percentage'
                    ? `${user.fee_value ?? 0}% of what they bill`
                    : `₹${Number(user.fee_value ?? 0).toLocaleString('en-IN')} per case`}
                </Row>
              )}
              <Row label="Can sign in">
                {/* has_password is the honest question. A staff member with no
                    password cannot get in, however active the row says they are. */}
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                  user.has_password ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {user.has_password ? 'Password set' : 'No password yet'}
                </span>
              </Row>
            </div>
          ) : (
            children
          )}
        </div>
      </div>
    </div>
  );
};

export default UserDetailsPanel;
