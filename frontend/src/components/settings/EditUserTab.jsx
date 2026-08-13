import React, { useEffect, useState } from 'react';
import { Loader2, Camera, Trash2 } from 'lucide-react';
import { resolveUserAvatar } from '../../utils/avatar';
import InlineFeedback from '../common/InlineFeedback';

/**
 * Editing one staff member: who they are, how they sign in, and their role.
 *
 * Self-contained. It holds its own draft and hands the caller only the fields
 * that actually changed, so Staff does not have to keep a parallel copy of this
 * form in its own state.
 *
 * ─── Why this was rewritten ─────────────────────────────────────────────────
 *
 * It used to take `formData`, `setFormData` and `handleInputChange` from the
 * old Settings screen, and read `formData.name` on its first render. Staff
 * passes `user` / `onSave` / `isSaving` instead, so `formData` was undefined and
 * opening the Edit tab threw "Cannot read properties of undefined (reading
 * 'name')". Nobody noticed because the panel around it never rendered its
 * children, so this tab had never once been on screen.
 *
 * ─── Only what changed ──────────────────────────────────────────────────────
 *
 * The PUT sends just the touched fields. Sending the whole form back would make
 * every save a potential overwrite of something another owner changed in the
 * meantime, and would re-submit the email on every role change — tripping the
 * "already taken" check against the user's own address.
 *
 * Props:
 *   user           the staff member being edited
 *   onSave         (userId, patch) => Promise
 *   isSaving       disables the button
 *   availableRoles [{ value, label }] or ['doctor', …]
 */

const EditUserTab = ({ user, onSave, isSaving = false, availableRoles = [] }) => {
  const [form, setForm] = useState({
    name: '', email: '', username: '', role: '', password: '',
    // Optional detail. Deliberately absent from the add-staff flow: somebody
    // hiring a receptionist on a Tuesday morning should not be held up by not
    // knowing her pay day.
    phone: '', salary_amount: '', salary_day: '', joined_on: '',
  });
  const [avatar, setAvatar] = useState(null);      // base64, unsaved
  const [avatarCleared, setAvatarCleared] = useState(false);
  const [error, setError] = useState('');

  // Re-seed when a different person is opened, so the drawer never shows the
  // last person's details for a frame.
  useEffect(() => {
    setForm({
      name: user?.name || '',
      email: user?.email || '',
      username: user?.username || '',
      role: user?.role || '',
      password: '',            // never pre-filled; we cannot read it and would not show it
      phone: user?.phone || '',
      salary_amount: user?.salary_amount != null ? String(user.salary_amount) : '',
      salary_day: user?.salary_day != null ? String(user.salary_day) : '',
      joined_on: user?.joined_on || '',
    });
    setAvatar(null);
    setAvatarCleared(false);
    setError('');
  }, [user?.id]);

  const set = (field) => (e) => { setForm((f) => ({ ...f, [field]: e.target.value })); setError(''); };

  /**
   * The photo is held as base64 and saved with the rest of the form, not
   * uploaded on pick. Choosing a picture and then closing the drawer should
   * change nothing — an image that saves itself while the name beside it does
   * not is a form that lies about what "Save changes" means.
   */
  const pickPhoto = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      setError('Please choose a PNG or JPG.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setError('That image is over 3MB. Please choose a smaller one.');
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => { setAvatar(ev.target.result); setAvatarCleared(false); setError(''); };
    reader.readAsDataURL(file);
  };

  const shownAvatar = avatarCleared ? null : (avatar || user?.avatar_url || null);

  const isOwner = user?.role === 'clinic_owner';

  const submit = async (e) => {
    e.preventDefault();
    setError('');

    if (!form.name.trim()) { setError('A name is required.'); return; }
    if (!form.email.trim() && !form.username.trim()) {
      setError('Give them an email or a username, otherwise they have no way to sign in.');
      return;
    }
    // The backend enforces this too; catching it here saves a round trip and
    // puts the message next to the field that caused it.
    if (form.password && form.password.length < 8) {
      setError('A password needs at least 8 characters.');
      return;
    }
    if (form.salary_day && (Number(form.salary_day) < 1 || Number(form.salary_day) > 31)) {
      setError('Pay day has to be a day of the month, between 1 and 31.');
      return;
    }
    if (form.salary_amount && Number(form.salary_amount) < 0) {
      setError("A salary can't be negative.");
      return;
    }

    // Only what actually moved.
    const patch = {};
    if (form.name.trim() !== (user.name || ''))         patch.name = form.name.trim();
    if (form.email.trim() !== (user.email || ''))       patch.email = form.email.trim();
    if (form.username.trim() !== (user.username || '')) patch.username = form.username.trim();
    if (form.role !== user.role)                        patch.role = form.role;
    if (form.password)                                  patch.password = form.password;

    if (form.phone.trim() !== (user.phone || ''))       patch.phone = form.phone.trim();
    const asNum = (v) => (v === '' ? null : Number(v));
    if (asNum(form.salary_amount) !== (user.salary_amount ?? null)) patch.salary_amount = asNum(form.salary_amount);
    if (asNum(form.salary_day) !== (user.salary_day ?? null))       patch.salary_day = asNum(form.salary_day);
    if (form.joined_on !== (user.joined_on || ''))      patch.joined_on = form.joined_on || null;
    if (avatar)        patch.avatar_url = avatar;
    if (avatarCleared) patch.avatar_url = '';

    if (Object.keys(patch).length === 0) { setError('Nothing has changed yet.'); return; }

    try {
      await onSave(user.id, patch);
      setForm((f) => ({ ...f, password: '' }));   // never leave a password sitting in a field
    } catch (err) {
      setError(err?.detail || err?.message || 'Could not save those changes.');
    }
  };

  if (!user) return null;

  const field = 'w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm outline-none focus:border-[#29828a]';
  const label = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex items-center gap-4 pb-4 border-b border-gray-100">
        <div className="relative shrink-0">
          {shownAvatar ? (
            <img src={shownAvatar} alt="" className="w-16 h-16 rounded-full object-cover bg-gray-100" />
          ) : (
            <img src={resolveUserAvatar(user, 128)} alt="" className="w-16 h-16 rounded-full object-cover bg-gray-100 opacity-60" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-gray-700">Photo</p>
          <div className="flex items-center gap-3 mt-1.5">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer">
              <Camera size={13} className="text-gray-400" />
              {shownAvatar && !avatarCleared ? 'Change' : 'Upload'}
              <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={pickPhoto} />
            </label>
            {(user?.avatar_url || avatar) && !avatarCleared && (
              <button
                type="button"
                onClick={() => { setAvatar(null); setAvatarCleared(true); }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-red-600"
              >
                <Trash2 size={13} /> Remove
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400 mt-1.5">
            {avatar || avatarCleared
              ? 'Saved when you press Save changes.'
              : 'PNG or JPG, under 3MB. Shows on their profile and in the staff list.'}
          </p>
        </div>
      </div>

      <div>
        <label className={label}>Name</label>
        <input value={form.name} onChange={set('name')} className={field} required />
      </div>

      <div>
        <label className={label}>Email</label>
        <input type="email" value={form.email} onChange={set('email')} className={field}
               placeholder="name@clinic.com" />
        <p className="text-xs text-gray-400 mt-1">
          Required for owners. Staff can sign in with a username instead.
        </p>
      </div>

      <div>
        <label className={label}>Username</label>
        <input value={form.username} onChange={set('username')} className={field}
               placeholder="reception1" autoCapitalize="none" />
      </div>

      <div>
        <label className={label}>Role</label>
        <select value={form.role} onChange={set('role')} className={field} disabled={isOwner}>
          {availableRoles.map((r) => (
            <option key={r.value || r} value={r.value || r}>{r.label || r}</option>
          ))}
        </select>
        {isOwner && (
          <p className="text-xs text-gray-400 mt-1">
            The clinic owner's role can't be changed here. Transfer ownership first.
          </p>
        )}
      </div>

      <div className="pt-2 border-t border-gray-100">
        <label className={label}>
          {user.has_password ? 'Set a new password' : 'Set a password'}
        </label>
        <input
          type="password"
          value={form.password}
          onChange={set('password')}
          className={field}
          placeholder={user.has_password ? 'Leave blank to keep the current one' : 'At least 8 characters'}
          autoComplete="new-password"
        />
        <p className="text-xs text-gray-400 mt-1">
          {user.has_password
            ? 'Only fill this in if you want to replace their password.'
            : 'Until this is set, they cannot sign in at all.'}
        </p>
      </div>

      <div className="pt-4 border-t border-gray-100">
        <p className="text-sm font-semibold text-gray-900">Employment</p>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          All optional. Recording a salary makes it appear in Expenses under Payables each month, so
          nobody has to remember who is owed what.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className={label}>Phone</label>
            <input value={form.phone} onChange={set('phone')} className={field}
                   placeholder="9876543210" inputMode="tel" />
          </div>
          <div>
            <label className={label}>Joined on</label>
            <input type="date" value={form.joined_on} onChange={set('joined_on')} className={field} />
          </div>
          <div>
            <label className={label}>Monthly salary</label>
            <input value={form.salary_amount} onChange={set('salary_amount')} className={field}
                   placeholder="25000" inputMode="decimal" />
          </div>
          <div>
            <label className={label}>Paid on day</label>
            <input value={form.salary_day} onChange={set('salary_day')} className={field}
                   placeholder="5" inputMode="numeric" />
            <p className="text-xs text-gray-400 mt-1">Day of the month, 1 to 31.</p>
          </div>
        </div>
      </div>

      {error && <InlineFeedback tone="error">{error}</InlineFeedback>}

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#29828a] hover:bg-[#216b71] disabled:bg-gray-300 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {isSaving && <Loader2 size={15} className="animate-spin" />}
        {isSaving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
};

export default EditUserTab;
