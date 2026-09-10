import React, { useMemo, useState } from 'react';
import {
  X, Check, ArrowLeft, Loader2, UserPlus, ShieldCheck, Eye, EyeOff,
  Sparkles, SlidersHorizontal,
} from 'lucide-react';
import WhatsAppIcon from '../common/WhatsAppIcon';
import { MODULES, presetFor, describeAccess } from '../../constants/permissions';
import InlineFeedback from '../common/InlineFeedback';

/**
 * Adding a staff member, in two steps and a receipt.
 *
 * It used to be one long form: name, email, username, role, password, phone,
 * fee basis and fee value in a single column, with permissions applied silently
 * from the role and only editable afterwards from a different screen. Nobody
 * knew what they had just granted until they went looking.
 *
 * Now: who they are, then what they can control, then what to hand over. Two
 * decisions, because the second depends on the first — the role picked in step
 * one chooses the preset shown in step two — and one confirmation, because
 * adding somebody is only finished when they can actually sign in.
 *
 * ─── What changed, and why ──────────────────────────────────────────────────
 *
 * **A password is now required.** It was optional, the field said "leave blank
 * and they can be given one later", and owners left it blank — so the welcome
 * went out with no password in it and the clinic found out days later when the
 * new receptionist could not work. An account nobody can sign into is not a
 * staff member.
 *
 * **Step two leads with a sentence.** A thirteen-by-four grid of tickboxes is an
 * accurate answer to a question nobody asked. The grid is still there, one
 * click away, for the times somebody does want to change a row.
 *
 * **There is now a last step.** The drawer used to close on success and say
 * nothing, so whether the invitation went anywhere was a guess. It now shows
 * the sign-in details to copy and says what is on its way where — and because
 * the details are on screen, none of it depends on the email arriving.
 *
 * Nothing is created until the Add button. The whole draft lives here, so
 * closing halfway leaves nothing behind.
 *
 * Props:
 *   open, onClose
 *   availableRoles  [{ value, label, description }] from /clinic-users/roles
 *   onCreate        (payload) => Promise<createdStaffMember>, throws to show
 *                   the reason inline
 *   onAdded         (details) => void, once the row exists — the page shows
 *                   the confirmation and the credentials
 */

const STEPS = [
  { id: 1, label: 'Who they are', icon: UserPlus },
  { id: 2, label: 'What they can control', icon: ShieldCheck },
];

const ACTIONS = ['read', 'write', 'edit', 'delete'];

/**
 * The red asterisk on a required field.
 *
 * Its own component so every required label carries the identical mark, and so
 * the screen-reader text says "required" rather than reading out a punctuation
 * character. Colour alone is never the signal.
 */
const Req = () => (
  <span className="text-red-500" title="Required">
    *<span className="sr-only"> required</span>
  </span>
);

// Readable rather than clever. A password somebody has to read down a phone to
// a receptionist standing at the front desk is a different object from one a
// password manager holds, and three short words beat ten random characters at
// that job while staying long enough to be worth having.
const WORDS = [
  'amber', 'basil', 'cedar', 'delta', 'ember', 'fable', 'grove', 'harbour',
  'indigo', 'jasper', 'kettle', 'lantern', 'meadow', 'nectar', 'opal', 'pebble',
  'quartz', 'ridge', 'saffron', 'timber', 'umber', 'violet', 'willow', 'zephyr',
];

const suggestPassword = () => {
  const pick = () => WORDS[Math.floor(Math.random() * WORDS.length)];
  let a = pick();
  let b = pick();
  while (b === a) b = pick();
  return `${a}-${b}-${Math.floor(10 + Math.random() * 90)}`;
};

const AddStaffDrawer = ({ open, onClose, availableRoles = [], onCreate, onAdded }) => {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    name: '', email: '', username: '', role: '', password: '', phone: '',
  });
  const [perms, setPerms] = useState({});
  const [touchedPerms, setTouchedPerms] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Memoised so the fallback is not a fresh array on every render, which would
  // make every memo below it recompute for nothing.
  const roles = useMemo(
    () => (availableRoles.length ? availableRoles : [{ value: 'receptionist', label: 'Receptionist' }]),
    [availableRoles],
  );
  const chosen = useMemo(
    () => roles.find((r) => (r.value || r) === form.role),
    [roles, form.role],
  );
  const summary = useMemo(() => describeAccess(perms), [perms]);

  const reset = () => {
    setStep(1);
    setForm({ name: '', email: '', username: '', role: '', password: '', phone: '' });
    setPerms({}); setTouchedPerms(false); setShowGrid(false); setShowPassword(false);
    setError('');
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
    // Both, not either. The form used to accept one and explain the choice in
    // a line under the fields, which made the commonest screen in staff setup
    // a small decision instead of a small form. Asking for both is shorter to
    // read and shorter to answer, and it means every staff member has an
    // address the invitation can reach as well as a name they can type.
    if (!form.email.trim()) {
      setError('Add their email address.');
      return;
    }
    if (!form.username.trim()) {
      setError('Give them a username to sign in with.');
      return;
    }
    // A WhatsApp number is required now. It is the channel the sign-in details
    // actually arrive on — email to a front-desk account is frequently nobody's
    // inbox — so "optional" meant the commonest way in silently did not happen.
    const digits = form.phone.replace(/\D/g, '');
    if (!digits) {
      setError('Add their WhatsApp number. Their sign-in details are sent there.');
      return;
    }
    if (digits.length < 10) {
      setError('That WhatsApp number looks too short. Check it and try again.');
      return;
    }
    if (!form.password.trim()) {
      setError('Set a password for them. Without one they cannot sign in at all.');
      return;
    }
    if (form.password.length < 8) {
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
      const record = await onCreate({
        name: form.name.trim(),
        email: form.email.trim(),
        username: form.username.trim(),
        phone: form.phone.trim() || undefined,
        role: form.role,
        password: form.password,
        permissions: perms,
      });
      // Up to the page, which shows the confirmation and the credentials in a
      // centred modal. The drawer's job is finished the moment the row exists,
      // and a drawer that stays open after a successful create is the thing
      // that made this look like it had failed.
      onAdded?.({
        name: form.name.trim(),
        loginId: form.email.trim(),
        password: form.password,
        email: form.email.trim(),
        phone: form.phone.trim(),
        invitation: record?.invitation || {},
      });
      reset();
      onClose();
    } catch (e) {
      // Back to step one for anything about their identity, since that is where
      // the field they have to fix lives.
      const msg = e?.detail || e?.message || 'Could not add this person.';
      if (/email|username|already|taken/i.test(msg)) setStep(1);
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

  const firstName = form.name.trim().split(' ')[0] || 'them';
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 backdrop-blur-sm bg-black/20" onClick={close} />

      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-4 p-6 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Add a staff member</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {step === 1 ? 'Their details and role' : `What ${firstName} can control`}
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
            /* ── Who they are ───────────────────────────────────────────── */
            /* Order is the order somebody actually has the answers in: who they
               are, how we reach them, how they get in, what they do. Password
               sits directly under the WhatsApp number because those two travel
               together — that number is where the password is about to be
               sent. */
            <div className="space-y-4">
              <div>
                <label className={label}>Full name <Req /></label>
                <input value={form.name} onChange={set('name')} className={field}
                       placeholder="Priya Nair" autoFocus />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={label}>Email <Req /></label>
                  <input type="email" value={form.email} onChange={set('email')} className={field}
                         placeholder="priya@gmail.com" />
                </div>
                <div>
                  <label className={label}>Username <Req /></label>
                  <input value={form.username} onChange={set('username')} className={field}
                         placeholder="reception1" autoCapitalize="none" />
                </div>
              </div>
              <p className="text-xs text-gray-400 -mt-1">
                Any email works, personal is fine. They can sign in with either one.
              </p>

              <div>
                <label className={label}>
                  <span className="inline-flex items-center gap-1.5">
                    <WhatsAppIcon size={14} brand /> WhatsApp number <Req />
                  </span>
                </label>
                <input value={form.phone} onChange={set('phone')} className={field}
                       placeholder="9876543210" inputMode="tel" />
                <p className="text-xs text-gray-400 mt-1">
                  Must be the number they use WhatsApp on — their login and password go there.
                </p>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3 mb-1.5">
                  <label className="block text-sm font-medium text-gray-700">Password <Req /></label>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, password: suggestPassword() }));
                      setShowPassword(true);
                      setError('');
                    }}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-[#29828a] hover:text-[#216b71]"
                  >
                    <Sparkles size={12} /> Suggest one
                  </button>
                </div>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={set('password')}
                    className={`${field} pr-10`}
                    placeholder="At least 8 characters"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  You will see it once more after they are added, to copy and hand over.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100">
                <label className={label}>Role <Req /></label>
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
            </div>
          ) : (
            /* ── What they can control ────────────────────────────────────── */
            <div className="space-y-4">
              <div className="rounded-xl border border-[#29828a]/15 bg-[#29828a]/5 px-4 py-3.5">
                <div className="flex items-start gap-2.5">
                  <ShieldCheck size={16} className="text-[#29828a] shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 leading-relaxed">
                      As {(chosen?.label || 'staff').toLowerCase()}, <span className="font-semibold">{firstName}</span> will be
                      able to {summary.can.length ? summary.can.join(', ') : 'do nothing yet'}.
                    </p>
                    {summary.cannot.length > 0 && (
                      <p className="text-sm text-gray-500 leading-relaxed mt-1.5">
                        {firstName} will not see {summary.cannot.join(', ')}.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGrid((v) => !v)}
                className="w-full inline-flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-lg border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="inline-flex items-center gap-2">
                  <SlidersHorizontal size={14} className="text-gray-400" />
                  {showGrid ? 'Hide the detail' : 'Change what they can control'}
                </span>
                <span className="text-xs font-normal text-gray-400">{granted} selected</span>
              </button>

              {showGrid && (
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
              )}

              <p className="text-xs text-gray-400">
                Any of this can be changed later from their profile.
              </p>
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
            {step === 1 ? 'Next: what they can control' : saving ? 'Adding…' : `Add ${firstName}`}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddStaffDrawer;
