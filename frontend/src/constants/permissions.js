/**
 * The permission model, in one place.
 *
 * Every screen that reads or writes a user's permissions must agree on these
 * keys. The Staff table used to guess at them — it looked for `patients.view`,
 * `reports.view` and `billing.view`, none of which exist (the actions are
 * read/write/edit/delete, and the money module is `finance`, not `billing`), so
 * its Access column silently rendered nothing for every non-owner.
 */

export const MODULES = [
  { key: 'dashboard',     label: 'Dashboard',      actions: ['read'] },
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

/**
 * A user's permissions map, guarded. Older rows stored a flat shape rather than
 * `{ module: { action: bool } }`, so anything that isn't nested is treated as
 * "nothing granted" instead of throwing halfway down a table row.
 */
export const normalizePermissions = (permissions) =>
  permissions && typeof Object.values(permissions)[0] === 'object' ? permissions : {};

/**
 * How much of the app a person can actually open, summarised for a table cell.
 * Owners are unconditionally full-access — that is what being the owner means,
 * and their permissions map is not consulted anywhere else either.
 */
export const accessSummary = (user) => {
  if (user?.role === 'clinic_owner') {
    return { label: 'Full access', level: 'all', readCount: MODULES.length, total: MODULES.length };
  }
  const perms = normalizePermissions(user?.permissions);
  const readCount = MODULES.filter((m) => perms[m.key]?.read === true).length;
  if (readCount === 0) return { label: 'No access', level: 'none', readCount, total: MODULES.length };
  if (readCount === MODULES.length) return { label: 'Full access', level: 'all', readCount, total: MODULES.length };
  return { label: `${readCount} of ${MODULES.length} modules`, level: 'partial', readCount, total: MODULES.length };
};

/**
 * Whether `actor` is allowed to change `target`'s permissions.
 *
 * Nobody edits their own. An owner who removes their own access has locked
 * themselves out of the screen that would let them put it back, and there is no
 * in-app way to recover — it takes a database edit. The owner's row is also
 * closed to everyone else: a staff member with staff:edit could otherwise
 * demote the owner and take the clinic.
 */
export const canEditPermissions = (actor, target) => {
  if (!actor || !target) return false;
  if (String(actor.id) === String(target.id)) return false;
  if (target.role === 'clinic_owner') return false;
  return true;
};

export const permissionsLockReason = (actor, target) => {
  if (!actor || !target) return null;
  if (String(actor.id) === String(target.id)) {
    return "You can't change your own permissions — it would lock you out of this screen.";
  }
  if (target.role === 'clinic_owner') {
    return "The clinic owner always has full access, and it can't be edited.";
  }
  return null;
};


/**
 * What each role can reach out of the box.
 *
 * Lives here beside MODULES rather than inside a screen, because two places now
 * apply presets — the full Permissions screen and the per-staff Permissions tab
 * — and a preset that means one thing in one and something else in the other is
 * worse than having no preset. clinic_owner is derived from MODULES so a new
 * module cannot be accidentally withheld from the owner.
 */
export const ROLE_PRESETS = {
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
  assistant: {
    dashboard:    { read: true },
    appointments: { read: true, write: true, edit: true, delete: false },
    patients:     { read: true, write: true, edit: true, delete: false },
    finance:      { read: false, write: false, edit: false, delete: false },
    inventory:    { read: true, write: true, edit: true, delete: false },
    vendors:      { read: true, write: false, edit: false, delete: false },
    inbox:        { read: true, write: true },
    reports:      { read: false },
    marketing:    { read: false, write: false, edit: false },
    lab:          { read: true, write: true, edit: true, delete: false },
    staff:        { read: false, write: false, edit: false, delete: false },
    settings:     { read: false, write: false, edit: false },
    consent:      { read: true, write: true, edit: false, delete: false },
  },
};

// The other clinical roles work identically day to day — what separates an
// associate from an in-house doctor is how they are paid, not what they may
// click — so they share the dentist preset rather than each carrying a
// near-identical copy that will quietly drift. Mirrors
// backend/domains/auth/role_presets.py, which does the same thing.
['in_house_doctor', 'associate', 'consultant'].forEach((role) => {
  if (!ROLE_PRESETS[role]) ROLE_PRESETS[role] = ROLE_PRESETS.doctor;
});

/** The least access of any preset — the safe direction for an unknown role. */
export const presetFor = (role) => ROLE_PRESETS[role] || ROLE_PRESETS.receptionist;
