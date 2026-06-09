const KEY = 'molarplus.lastLogin';

export const saveLastLogin = ({ provider, email, name, token }) => {
  try {
    if (!email || !provider) return;
    const entry = { provider, email, name };
    // Persisting the session token lets the card do a true one-click sign-in.
    // It outlives logout on purpose; it's validated against /auth/me on use and
    // dropped if the server rejects it (expired/invalidated).
    if (token) entry.token = token;
    localStorage.setItem(KEY, JSON.stringify(entry));
  } catch (err) {
    console.warn('saveLastLogin failed:', err);
  }
};

// Drop just the stored token (e.g. after it expires) while keeping the
// remembered email/provider so the card still offers prefill.
export const clearLastLoginToken = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && parsed.token) {
      delete parsed.token;
      localStorage.setItem(KEY, JSON.stringify(parsed));
    }
  } catch {}
};

export const getLastLogin = () => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.provider || !parsed?.email) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearLastLogin = () => {
  try { localStorage.removeItem(KEY); } catch {}
};

export const maskEmail = (email) => {
  if (!email || !email.includes('@')) return email || '';
  const [local, domain] = email.split('@');
  if (local.length <= 3) return `${local}@${domain}`;
  return `${local.slice(0, 3)}…@${domain}`;
};
