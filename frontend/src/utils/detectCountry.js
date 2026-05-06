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
