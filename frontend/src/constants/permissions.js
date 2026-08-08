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
