import type { BackendUser } from '../../services/api/auth.api';

/**
 * What this member of staff is allowed to open.
 *
 * The rule has to match the server's, or the app shows a tile that answers 403.
 * `backendUser.permissions` is the role-preset shape from
 * backend/domains/auth/role_presets.py — `{ patients: { read, write, edit,
 * delete }, ... }` — and the server reads it through core/auth_utils.py, which
 * treats some words as the same thing. Both of those lists are mirrored here:
 *
 *   view  = view, read          edit = edit, write, update
 *   billing = billing, finance  users = users, staff
 *
 * Owners always pass, exactly as `has_permission` short-circuits for them.
 */

type Action = 'view' | 'edit' | 'delete';

const ACTIONS: Record<Action, string[]> = {
  view: ['view', 'read'],
  edit: ['edit', 'write', 'update'],
  delete: ['delete', 'remove'],
};

const ALIASES: Record<string, string[]> = {
  billing: ['billing', 'finance'],
  finance: ['finance', 'billing'],
  users: ['users', 'staff'],
  staff: ['staff', 'users'],
  lab: ['lab', 'lab_orders'],
  lab_orders: ['lab_orders', 'lab'],
};

export const can = (user: any, action: Action, resource: string): boolean => {
  if (!user) return false;
  if (user.role === 'clinic_owner') return true;
  const permissions = user.permissions || {};
  const actions = ACTIONS[action] || [action];
  for (const name of ALIASES[resource] || [resource]) {
    const block = permissions[name];
    if (block && actions.some((a) => block[a] === true)) return true;
  }
  return false;
};

/** How a role reads on screen. Mirrors core/roles.py ROLE_LABELS. */
export const roleLabel = (role?: string | null): string => {
  const labels: Record<string, string> = {
    clinic_owner: 'Owner',
    in_house_doctor: 'In-house doctor',
    associate: 'Associate',
    consultant: 'Consultant',
    doctor: 'Doctor',
    receptionist: 'Receptionist',
    assistant: 'Assistant',
  };
  return labels[String(role || '')] || 'Staff';
};

/** Clinical roles see "seen today"; everybody else sees "registered today". */
export const isClinical = (role?: string | null): boolean =>
  ['clinic_owner', 'in_house_doctor', 'associate', 'consultant', 'doctor'].includes(String(role || ''));

export type { BackendUser };
