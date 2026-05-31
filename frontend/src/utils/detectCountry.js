/**
 * Best-effort detection of the user's country from device locale.
 * Returns an ISO 3166-1 alpha-2 code (e.g. "IN", "US", "GB").
 * Falls back to "IN" if nothing usable is detected.
 *
 * Used as the default country at signup — the picker still lets the
 * user correct it.
 */
export function detectCountry() {
  try {
    const lang = (typeof navigator !== 'undefined' && navigator.language) || '';
    const m = lang.match(/[-_]([A-Z]{2})$/i);
    if (m) return m[1].toUpperCase();

    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const TZ_TO_COUNTRY = {
      'Asia/Kolkata': 'IN', 'Asia/Calcutta': 'IN',
      'America/New_York': 'US', 'America/Chicago': 'US',
      'America/Denver': 'US', 'America/Los_Angeles': 'US',
      'America/Phoenix': 'US', 'America/Anchorage': 'US',
      'Europe/London': 'GB',
      'Australia/Sydney': 'AU', 'Australia/Melbourne': 'AU',
      'Africa/Lagos': 'NG',
      'Africa/Nairobi': 'KE',
      'Africa/Johannesburg': 'ZA',
      'Africa/Cairo': 'EG',
      'America/Toronto': 'CA', 'America/Vancouver': 'CA',
      'America/Sao_Paulo': 'BR',
      'America/Mexico_City': 'MX',
      'Asia/Dubai': 'AE',
      'Asia/Riyadh': 'SA',
      'Europe/Berlin': 'DE',
      'Europe/Paris': 'FR',
      'Asia/Singapore': 'SG',
      'Asia/Kuala_Lumpur': 'MY',
      'Asia/Manila': 'PH',
      'Asia/Jakarta': 'ID',
      'Asia/Bangkok': 'TH',
      'Asia/Karachi': 'PK',
      'Asia/Dhaka': 'BD',
      'Asia/Colombo': 'LK',
      'Asia/Kathmandu': 'NP',
      'Africa/Accra': 'GH',
      'Pacific/Auckland': 'NZ',
    };
    if (tz && TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz];
  } catch {
    /* ignore */
  }
  return 'IN';
}

/**
 * Most accurate detection: ask an IP-geolocation service for the country, with
 * a short timeout, falling back to the locale/timezone guess above if the
 * lookup is blocked, slow, or fails. Browser-only, no API key.
 */
export async function detectCountryAsync() {
  const fallback = detectCountry();
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch('https://ipwho.is/?fields=country_code', { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.ok) {
      const data = await res.json();
      const code = String(data.country_code || '').toUpperCase();
      if (/^[A-Z]{2}$/.test(code)) return code;
    }
  } catch {
    /* blocked / offline / timeout → use the browser-based fallback */
  }
  return fallback;
}

/**
 * Turn an ISO 3166-1 alpha-2 code ("IN") into its emoji flag ("🇮🇳") by mapping
 * each letter to its Regional Indicator Symbol. Falls back to a neutral flag.
 * Note: native <select> on Windows/Chrome may render these as letters (e.g. "IN")
 * since the OS lacks flag glyphs — they show correctly on macOS, iOS and Android.
 */
export function flagEmoji(code) {
  const cc = String(code || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(...[...cc].map((ch) => 127397 + ch.charCodeAt(0)));
}
