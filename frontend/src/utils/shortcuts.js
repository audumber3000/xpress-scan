/**
 * Single source of truth for keyboard shortcuts.
 *
 * The global key handler and the shortcuts panel both read this list, so the
 * panel can never document a key that isn't actually wired up.
 *
 * Scheme:
 *   Alt + key         navigate
 *   Ctrl/⌘ + Alt + key  create
 *   F9                open this panel, Esc closes panels
 *
 * `keys` is display-only. `combo` is what the handler matches on:
 *   alt   - requires Alt and NOT Ctrl/⌘
 *   mod   - requires Ctrl (Windows/Linux) or ⌘ (Mac)
 *   code  - KeyboardEvent.code, so it survives keyboard layouts where Alt
 *           rewrites event.key (Alt+P emits "π" on a Mac, but code stays KeyP).
 */

/** Actions dispatched by id — the Header maps these to real behaviour. */
export const ACTION_SEARCH = 'search';
export const ACTION_HELP = 'help';

export const SHORTCUT_GROUPS = [
  {
    title: 'Global',
    items: [
      { id: ACTION_HELP, label: 'Help / open this panel', keys: ['F9'], combo: { code: 'F9' } },
      { id: 'close', label: 'Close panels', keys: ['Esc'] }, // handled inline by each panel
      { id: ACTION_SEARCH, label: 'Search patients', keys: ['mod', 'K'], combo: { mod: true, code: 'KeyK' } },
    ],
  },
  {
    title: 'Go to',
    items: [
      { id: 'go-dashboard', label: 'Dashboard', keys: ['Alt', 'D'], combo: { alt: true, code: 'KeyD' }, path: '/dashboard', permissionKey: 'dashboard' },
      { id: 'go-appointments', label: 'Appointments', keys: ['Alt', 'A'], combo: { alt: true, code: 'KeyA' }, path: '/calendar', permissionKey: 'appointments' },
      { id: 'go-patients', label: 'Patients', keys: ['Alt', 'P'], combo: { alt: true, code: 'KeyP' }, path: '/patients', permissionKey: 'patients' },
      { id: 'go-payments', label: 'Payments', keys: ['Alt', 'Y'], combo: { alt: true, code: 'KeyY' }, path: '/payments', permissionKey: 'finance' },
      { id: 'go-vendors', label: 'Inventory & vendors', keys: ['Alt', 'I'], combo: { alt: true, code: 'KeyI' }, path: '/vendors', permissionKeys: ['vendors', 'inventory'] },
      { id: 'go-consent', label: 'Consent forms', keys: ['Alt', 'C'], combo: { alt: true, code: 'KeyC' }, path: '/consent-forms', permissionKey: 'consent' },
      { id: 'go-lab', label: 'Laboratory', keys: ['Alt', 'L'], combo: { alt: true, code: 'KeyL' }, path: '/lab', permissionKey: 'lab' },
      { id: 'go-reports', label: 'Reports', keys: ['Alt', 'R'], combo: { alt: true, code: 'KeyR' }, path: '/reports', permissionKey: 'reports' },
      { id: 'go-reviews', label: 'Google reviews', keys: ['Alt', 'G'], combo: { alt: true, code: 'KeyG' }, path: '/marketing/reviews', permissionKey: 'marketing' },
      { id: 'go-admin', label: 'Control Center', keys: ['Alt', 'H'], combo: { alt: true, code: 'KeyH' }, path: '/admin', permissionKey: 'staff' },
    ],
  },
  {
    title: 'Create',
    items: [
      { id: 'new-patient', label: 'Add patient', keys: ['mod', 'Alt', 'P'], combo: { mod: true, alt: true, code: 'KeyP' }, path: '/patients?new=1', permissionKey: 'patients' },
      { id: 'new-appointment', label: 'Add appointment', keys: ['mod', 'Alt', 'A'], combo: { mod: true, alt: true, code: 'KeyA' }, path: '/calendar?new=1', permissionKey: 'appointments' },
    ],
  },
];

/** Every item that has a combo, flattened — what the key handler iterates. */
export const ALL_SHORTCUTS = SHORTCUT_GROUPS.flatMap((g) => g.items).filter((i) => i.combo);

export const isMac = () =>
  typeof navigator !== 'undefined' &&
  /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

/** Render a `keys` entry for display — "mod" becomes ⌘ on Mac, Ctrl elsewhere. */
export const keyLabel = (key) => (key === 'mod' ? (isMac() ? '⌘' : 'Ctrl') : key);

/**
 * Does this keydown match a shortcut's combo?
 * Combos are exact about modifiers: an Alt-only shortcut must not fire when
 * Ctrl is also held, otherwise Alt+D and Ctrl+Alt+D would both trigger it.
 */
export const matchesCombo = (e, combo) => {
  if (!combo || e.code !== combo.code) return false;
  const mod = e.metaKey || e.ctrlKey;
  if (Boolean(combo.mod) !== mod) return false;
  if (Boolean(combo.alt) !== e.altKey) return false;
  return true;
};

/**
 * True when the user is typing — text fields swallow shortcuts so Alt+S in a
 * notes box doesn't navigate away mid-sentence. F9/Esc bypass this check.
 */
export const isTypingTarget = (target) => {
  if (!target) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable === true
  );
};
