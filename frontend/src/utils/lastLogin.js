const KEY = 'molarplus.lastLogin';

export const saveLastLogin = ({ provider, email, name }) => {
  try {
    if (!email || !provider) return;
    localStorage.setItem(KEY, JSON.stringify({ provider, email, name }));
  } catch (err) {
    console.warn('saveLastLogin failed:', err);
  }
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
