/**
 * Clinical free-text fields are stored as "JSON string or plain text".
 *
 * Chief complaint, diagnosis and history have all been written both ways over
 * the life of the app — an array from a picker, an object from an older form, a
 * plain sentence somebody typed. Every reader has to survive all of them, so the
 * parsing lives here rather than being copied into each card that needs it.
 */
export const asText = (value) => {
  if (!value) return '';
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'object') return Object.values(value).filter(Boolean).join(', ');
  const raw = String(value).trim();
  if (raw.startsWith('[') || raw.startsWith('{')) {
    try { return asText(JSON.parse(raw)); } catch { return raw; }
  }
  return raw;
};
