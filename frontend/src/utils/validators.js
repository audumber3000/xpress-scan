// Shared field validators for auth & onboarding forms.
// Each returns a boolean; keep them tiny and pure so they can drive both
// the live green-tick UI and submit-time gating.

export const isValidEmail = (v) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim());

export const isValidPassword = (v) => String(v || '').length >= 8;

export const isNonEmpty = (v) => String(v || '').trim().length > 0;

// Phone considered valid once it has enough digits to be a real number.
export const isValidPhone = (v) => String(v || '').replace(/\D/g, '').length >= 7;
