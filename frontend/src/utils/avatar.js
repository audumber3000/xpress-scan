/**
 * Generate a unique, deterministic DiceBear avatar URL for any user.
 * Uses the "avataaars" style which creates friendly cartoon human faces.
 * The seed ensures the same person always gets the same avatar.
 *
 * @param {string} seed - A unique identifier (email, name, or user ID)
 * @param {number} [size=80] - Avatar size in pixels
 * @returns {string} DiceBear SVG avatar URL
 */
export const generateAvatarUrl = (seed, size = 80) => {
  const safeSeed = encodeURIComponent(seed || 'default');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear&radius=50&size=${size}`;
};

/**
 * Generate a simple initials-based avatar URL (fallback when offline).
 * @param {string} name - User's full name
 * @returns {string} UI Avatars URL
 */
export const generateInitialsAvatar = (name) => {
  const initials = (name || '?')
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=2a276e&color=fff&size=80&rounded=true&bold=true`;
};
