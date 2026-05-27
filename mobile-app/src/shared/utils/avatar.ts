/**
 * Mirror of frontend/src/utils/avatar.js so web and mobile render the same
 * deterministic DiceBear avatar for any given user seed.
 */

export const generateAvatarUrl = (seed?: string | null, size = 80): string => {
  const safeSeed = encodeURIComponent(seed || 'default');
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${safeSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=gradientLinear&radius=50&size=${size}`;
};
