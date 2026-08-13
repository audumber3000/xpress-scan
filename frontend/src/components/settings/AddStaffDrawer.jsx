import React, { useMemo, useState } from 'react';
import { X, Check, ArrowLeft, Loader2, UserPlus, ShieldCheck } from 'lucide-react';
import { MODULES, presetFor } from '../../constants/permissions';
import InlineFeedback from '../common/InlineFeedback';

/**
 * Adding a staff member, in two steps.
 *
 * It used to be one long form: name, email, username, role, password, phone,
 * fee basis and fee value in a single column, with permissions applied silently
 * from the role and only editable afterwards from a different screen. The
 * result was that nobody knew what they had just granted until they went
 * looking, and the fee fields — which only apply to a dentist — were shown to
 * everybody.
 *
 * Now: who they are, then what they can reach. Two steps, because they are two
 * decisions and the second depends on the first — the role picked in step one
 * chooses the preset shown in step two, and the preset is worth seeing before
 * it is applied rather than after.
 *
 * Nothing is created until the last button. The whole draft lives here, so
 * closing the drawer halfway leaves nothing behind.
 *
 * Props:
 *   open, onClose
 *   availableRoles  [{ value, label, description }] from /clinic-users/roles
 *   onCreate        (payload) => Promise, throws to show the reason inline
 */

const STEPS = [
  { id: 1, label: 'Who they are', icon: UserPlus },
  { id: 2, label: 'What they can reach', icon: ShieldCheck },
];

const ACTIONS = ['read', 'write', 'edit', 'delete'];

const AddStaffDrawer = ({ open, onClose, availableRoles = [], onCreate }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ name: '', email: '', username: '', role: '', password: '' });
  const [perms, setPerms] = useState({});
  const [touchedPerms, setTouchedPerms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const roles = availableRoles.length ? availableRoles : [{ value: 'receptionist', label: 'Receptionist' }];
  const chosen = useMemo(
    () => roles.find((r) => (r.value || r) === form.role),
    [roles, form.role],
  );

  const reset = () => {
    setStep(1);
    setForm({ name: '', email: '', username: '', role: '', password: '' });
    setPerms({}); setTouchedPerms(false); setError('');
  };

  const close = () => { if (!saving) { reset(); onClose(); } };

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(''); };

  const pickRole = (value) => {
    setForm((f) => ({ ...f, role: value }));
    // Changing role re-seeds the grid, unless the user has already hand-edited
    // it — silently discarding their tickboxes because they revisited step one
    // would be the rudest possible behaviour.
    if (!touchedPerms) setPerms(presetFor(value));
    setError('');
  };

  const goToAccess = () => {
    if (!form.name.trim()) { setError('Give them a name.'); return; }
    if (!form.email.trim() && !form.username.trim()) {
      setError('Add an email or a username, otherwise they have no way to sign in.');
      return;
    }
    if (form.role === 'clinic_owner' && !form.email.trim()) {
      setError('An owner needs an email address to sign in.');
      return;
    }
    if (form.password && form.password.length < 8) {
      setError('A password needs at least 8 characters.');
      return;
    }
    if (!form.role) { setError('Choose a role.'); return; }
    if (!Object.keys(perms).length) setPerms(presetFor(form.role));
    setError('');
    setStep(2);
  };

  const toggle = (moduleKey, action) => {
    setTouchedPerms(true);
    setPerms((prev) => ({
      ...prev,
      [moduleKey]: { ...prev[moduleKey], [action]: !prev[moduleKey]?.[action] },
    }));
  };

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      await onCreate({
        name: form.name.trim(),
        email: form.email.trim() || undefined,
        username: form.username.trim() || undefined,
        role: form.role,
        ...(form.password ? { password: form.password } : {}),
        permissions: perms,
      });
      reset();
      onClose();
    } catch (e) {
      // Back to step one for anything about their identity, since that is where
      // the field they have to fix lives.
      const msg = e?.detail || e?.message || 'Could not add this person.';
      if (/email|username|already/i.test(msg)) setStep(1);
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const field = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a]';
  const label = 'block text-sm font-medium text-gray-700 mb-1.5';
  const granted = Object.values(perms).reduce(
    (n, acts) => n + Object.values(acts || {}).filter(Boolean).length, 0);

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={close} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Add a staff member</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 1 ? 'Their details and role' : `What ${form.name.split(' ')[0] || 'they'} can reach`}
            </p>
          </div>
          <button onClick={close} className="p-2 hover:bg-gray-100 rounded-full transition shrink-0">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        {/* Where they are. Two steps is few enough to show both at once, which
            is what makes it read as short rather than as a process. */}
        <div className="flex items-center gap-2 px-6 py-4 border-b border-gray-100 bg-[#f8fafc]">
          {STEPS.map((s, i) => {
            const done = step > s.id;
            const now = step === s.id;
            return (
              <React.Fragment key={s.id}>
                <div className={`flex items-center gap-2 ${now ? 'text-[#29828a]' : done ? 'text-gray-600' : 'text-gray-400'}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    now ? 'bg-[#29828a] text-white' : done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
                  }`}>
                    {done ? <Check size={13} strokeWidth={3} /> : s.id}
                  </span>
                  <span className="text-sm font-semibold">{s.label}</span>
                </div>
                {i === 0 && <div className="flex-1 h-px bg-gray-200" />}
              </React.Fragment>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className={label}>Full name</label>
                <input value={form.name} onChange={set('name')} className={field} placeholder="Priya Nair" autoFocus />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Email</label>
                  <input type="email" value={form.email} onChange={set('email')} className={field} placeholder="priya@clinic.com" />
                </div>
                <div>
                  <label className={label}>Username</label>
                  <input value={form.username} onChange={set('username')} className={field} placeholder="reception1" autoCapitalize="none" />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-1">
                Either will do. A username suits front-desk staff who share a computer and have no work email.
              </p>

              <div>
                <label className={label}>Role</label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roles.map((r) => {
                    const value = r.value || r;
                    const on = form.role === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickRole(value)}
                        className={`text-left px-3.5 py-2.5 rounded-lg border transition-colors ${
                          on ? 'border-[#29828a] bg-[#29828a]/5' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <span className={`block text-sm font-semibold ${on ? 'text-[#29828a]' : 'text-gray-800'}`}>
                          {r.label || value}
                        </span>
                        {r.description && (
                          <span className="block text-xs text-gray-500 mt-0.5 leading-snug">{r.description}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className={label}>Password <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="password" value={form.password} onChange={set('password')} className={field}
                       placeholder="At least 8 characters" autoComplete="new-password" />
                <p className="text-xs text-gray-400 mt-1">
                  Leave blank and they can be given one later. Until then they cannot sign in.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 rounded-lg bg-[#29828a]/5 border border-[#29828a]/15 px-3.5 py-3">
                <ShieldCheck size={16} className="text-[#29828a] shrink-0 mt-0.5" />
                <p className="text-xs text-gray-600 leading-relaxed">
                  These are the usual permissions for {chosen?.label || 'this role'}.
                  Change anything now, or later from their profile. <span className="font-semibold">{granted}</span> permissions selected.
                </p>
              </div>

              <div className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-[#f8fafc]">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Module</th>
                        {ACTIONS.map((a) => (
                          <th key={a} className="px-3 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">{a}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {MODULES.map((m) => (
                        <tr key={m.key} className="hover:bg-gray-50/60">
                          <td className="px-4 py-2.5 text-sm font-medium text-gray-900 whitespace-nowrap">{m.label}</td>
                          {ACTIONS.map((a) => {
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
                                      on ? 'bg-[#29828a] border-[#29828a] text-white' : 'bg-white border-gray-300 hover:border-gray-400'
                                    }`}
                                  >
                                    {on && <Check size={14} strokeWidth={3} />}
                                  </button>
                                ) : <span className="text-gray-300">—</span>}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {error && <InlineFeedback tone="error" className="mt-4">{error}</InlineFeedback>}
        </div>

        <div className="p-6 border-t border-gray-100 flex items-center gap-3">
          {step === 2 && (
            <button onClick={() => { setStep(1); setError(''); }} disabled={saving}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50">
              <ArrowLeft size={15} /> Back
            </button>
          )}
          <button
            onClick={step === 1 ? goToAccess : create}
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            {saving && <Loader2 size={15} className="animate-spin" />}
            {step === 1 ? 'Next: what they can reach' : saving ? 'Adding…' : `Add ${form.name.split(' ')[0] || 'them'}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStaffDrawer;
