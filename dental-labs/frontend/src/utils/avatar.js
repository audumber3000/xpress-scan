/**
 * Client avatars for Dental Labs.
 *
 * Clients are dentists/clinics (business contacts), not patients — so instead of
 * the clinic app's cartoon *faces* (DiceBear "personas"), we use DiceBear
 * "shapes": friendly, colorful, deterministic geometric marks seeded by name.
 * Same cartoon vibe, no faces. Falls back to a CSS initials disc when offline.
 *
 * To try another non-face style, change DICEBEAR_STYLE to one of:
 *   shapes | icons | rings | glass | identicon | thumbs | bottts
 */
const DICEBEAR_STYLE = "shapes";

// Soft brand-ish backgrounds so the marks sit nicely in the table.
const BG_COLORS = "c7d2fe,a5f3fc,bbf7d0,fde68a,fbcfe8,ddd6fe,99f6e4";

export function generateClientAvatar(name, size = 80) {
  const seed = encodeURIComponent(name || "client");
  return `https://api.dicebear.com/9.x/${DICEBEAR_STYLE}/svg?seed=${seed}&radius=50&size=${size}&backgroundColor=${BG_COLORS}`;
}

/** Offline/error fallback — initials on the brand color, as an image URL. */
export function generateInitialsAvatar(name) {
  const initials = (name || "?")
    .split(" ").filter(Boolean).map((n) => n[0]).join("")
    .toUpperCase().slice(0, 2) || "?";
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2a276e&color=fff&size=80&rounded=true&bold=true`;
}
