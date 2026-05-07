/**
 * ISO 3166-1 alpha-2 → flag emoji.
 * Pure unicode trick: each letter maps to its regional indicator symbol.
 * Falls back to a globe for unknown / null codes.
 */
export function flag(code) {
  if (!code || typeof code !== 'string' || code.length !== 2) return '🌐';
  const cc = code.toUpperCase();
  const A = 0x1f1e6;
  const a = 'A'.charCodeAt(0);
  const c1 = cc.charCodeAt(0) - a + A;
  const c2 = cc.charCodeAt(1) - a + A;
  if (c1 < A || c2 < A || c1 > A + 25 || c2 > A + 25) return '🌐';
  return String.fromCodePoint(c1, c2);
}

/** Compact "🇮🇳 IN" tag — one liner used in tables. */
export function flagTag(code, currencySymbol) {
  const cc = (code || '').toUpperCase() || '—';
  return `${flag(code)} ${cc}${currencySymbol ? ` · ${currencySymbol}` : ''}`;
}
