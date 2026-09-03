import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import LoadingButton from '../LoadingButton';
import { MODULES, presetFor, permissionsLockReason } from '../../constants/permissions';
import InlineFeedback from '../common/InlineFeedback';
import { useAuth } from '../../contexts/AuthContext';

/**
 * What one staff member can reach, module by module.
 *
 * Self-contained, like EditUserTab. It used to take `availablePermissions` and
 * `defaultPermissions` from the old Settings screen and call
 * `availablePermissions.reduce(...)` on its first render — Staff passes neither,
 * so opening this tab threw before it drew anything. It now reads the same
 * MODULES catalogue the full Permissions screen uses, which also means the two
 * can no longer drift apart.
 *
 * Role and permissions are saved together: picking "Doctor" and then leaving
 * without touching a checkbox should still change what they can do.
 *
 * Props:
 *   user      the staff member
 *   onSave    (userId, { role, permissions }) => Promise
 *   isSaving  disables the button
 */

const PermissionsTab = ({ user, onSave, isSaving = false, availableRoles = [] }) => {
  // Saving permissions changes nothing on screen — the toggles already show what
  // was just picked — so a silent success is indistinguishable from the click
  // never registering. Tier 2 of the feedback rule: the answer goes on the
  // button that was pressed, not into a toast in the corner.
  const [saved, setSaved] = useState(false);
  const { user: me } = useAuth();
  const [perms, setPerms] = useState({});
  const [role, setRole] = useState('receptionist');
  const [error, setError] = useState('');

  useEffect(() => {
    setPerms(user?.permissions || {});
    setRole(user?.role || 'receptionist');
    setError('');
  }, [user?.id]);

  // The backend refuses these outright; showing an editable grid that cannot be
  // saved would be a worse experience than saying why up front.
  const locked = useMemo(() => permissionsLockReason?.(me, user) || null, [me, user]);

  const toggle = (moduleKey, action) => {
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] },
    }));
    setError('');
  };

  const applyPreset = (nextRole) => {
    setRole(nextRole);
    setPerms(presetFor(nextRole));
    setError('');
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await onSave(user.id, { role, permissions: perms });
      setSaved(true);
    } catch (err) {
      setError(err?.detail || err?.message || 'Could not save those permissions.');
    }
  };

  if (!user) return null;

  if (locked) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center">
        <p className="text-sm text-gray-500">{locked}</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Start from a role</label>
        <select
          value={role}
          onChange={(e) => applyPreset(e.target.value)}
          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a]"
        >
          {/* The real catalogue from /clinic-users/roles — hardcoding three
              options here hid Associate, Consultant and In-house doctor, which
              the backend has supported all along. */}
          {availableRoles.map((r) => (
            <option key={r.value || r} value={r.value || r}>{r.label || r}</option>
          ))}
        </select>
        <p className="text-xs text-gray-400 mt-1">
          Picking a role fills the boxes below with its usual access. Adjust anything from there.
        </p>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f8fafc]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Module
                </th>
                {['read', 'write', 'edit', 'delete'].map((a) => (
                  <th key={a} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    {a}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {MODULES.map((m) => (
                <tr key={m.key} className="hover:bg-gray-50/60">
                  <td className="px-4 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">
                    {m.label}
                  </td>
                  {['read', 'write', 'edit', 'delete'].map((a) => {
                    // A module without an action gets a dash, not a dead
                    // checkbox: "Dashboard → delete" is not a thing that exists.
                    const supported = m.actions.includes(a);
                    const on = !!perms[m.key]?.[a];
                    return (
                      <td key={a} className="px-3 py-2.5 text-center">
                        {supported ? (
                          <button
                            type="button"
                            onClick={() => toggle(m.key, a)}
                            aria-label={`${m.label} ${a}`}
                            aria-pressed={on}
                            className={`w-6 h-6 rounded-md border inline-flex items-center justify-center transition-colors ${
                              on ? 'bg-[#29828a] border-[#29828a] text-white'
                                 : 'bg-white border-gray-300 hover:border-gray-400'
                            }`}
                          >
                            {on && <Check size={14} strokeWidth={3} />}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      <LoadingButton
        type="submit"
        loading={isSaving}
        loadingLabel="Saving…"
        saved={saved}
        onSaved={() => setSaved(false)}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        Save permissions
      </LoadingButton>
    </form>
  );
};

export default PermissionsTab;
