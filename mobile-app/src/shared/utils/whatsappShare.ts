import AsyncStorage from '@react-native-async-storage/async-storage';
import { Linking } from 'react-native';
import { getApiBaseUrl } from '../../config/api.config';
import type { BackendUser } from '../../services/api/auth.api';

/**
 * True when this clinic sends patient WhatsApp from its own number (opt-in
 * clinic.manual_whatsapp). The installed mobile app — like the desktop app — can
 * hand a PDF to the OS share sheet (or at least open WhatsApp) and let the user
 * send from their own account, so manual mode applies here. (Plain web browsers
 * can't, so they stay on the automated MSG91 send; mirrors the web guard.)
 *
 * When this returns false, callers keep using the automated backend send — the
 * manual path is purely additive and never replaces it.
 */
export const isManualWhatsApp = (user?: BackendUser | null): boolean =>
  !!(user && user.clinic && user.clinic.manual_whatsapp);

// Calling codes for the markets we serve; default to India (mirrors the web util).
const CALLING_CODES: Record<string, string> = { IN: '91', US: '1', GB: '44', AE: '971', AU: '61', CA: '1', SG: '65', NZ: '64' };

/** Normalize a phone to international digits (no +/spaces) for WhatsApp deep links. */
export function toWhatsAppNumber(phone?: string, countryCode = 'IN'): string {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  d = d.replace(/^0+/, '');
  const cc = CALLING_CODES[countryCode] || CALLING_CODES.IN;
  if (d.length <= 10) d = cc + d;
  return d;
}

export type ShareResult = 'shared' | 'text-fallback' | 'unavailable';

/**
 * Send an invoice/prescription/receipt to a patient over WhatsApp from the
 * clinic's own number.
 *
 * Preferred path: download the authed PDF and open the OS share sheet so the real
 * PDF is attached. That needs the expo-sharing / expo-file-system native modules,
 * which only exist in a build that bundled them.
 *
 * Fallback (older build without those modules, or sharing unavailable): open
 * WhatsApp directly with a prefilled text message via Linking — always available,
 * but with no attachment. Returns which path ran so callers can word the toast.
 *
 * `path` is relative to /api/v1 (e.g. `/invoices/12/pdf`).
 */
export async function sharePdfViaWhatsApp(
  path: string,
  filename: string,
  fallback?: { phone?: string; message?: string; countryCode?: string },
): Promise<ShareResult> {
  // ── Preferred: native share sheet with the actual PDF ─────────────────────
  // The whole block is guarded: on a build that predates expo-sharing, either the
  // require or the first native call throws "Cannot find native module" — we
  // swallow it and drop to the text fallback instead of surfacing a raw crash.
  try {
    const FileSystem = require('expo-file-system/legacy') as typeof import('expo-file-system/legacy');
    const Sharing = require('expo-sharing') as typeof import('expo-sharing');

    if (await Sharing.isAvailableAsync()) {
      const token = await AsyncStorage.getItem('access_token');
      const dir = FileSystem.cacheDirectory;
      if (dir) {
        const res = await FileSystem.downloadAsync(`${getApiBaseUrl()}/api/v1${path}`, `${dir}${filename}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.status >= 200 && res.status < 300) {
          await Sharing.shareAsync(res.uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'Share via WhatsApp',
            UTI: 'com.adobe.pdf',
          });
          return 'shared';
        }
      }
    }
  } catch {
    // Native sharing unavailable in this build — fall through to the text path.
  }

  // ── Fallback: open WhatsApp with a prefilled message (no attachment) ───────
  const num = toWhatsAppNumber(fallback?.phone, fallback?.countryCode || 'IN');
  if (num) {
    const text = encodeURIComponent(fallback?.message || '');
    const appUrl = `whatsapp://send?phone=${num}&text=${text}`;
    try {
      if (await Linking.canOpenURL(appUrl)) {
        await Linking.openURL(appUrl);
        return 'text-fallback';
      }
    } catch {
      // canOpenURL can reject if the scheme isn't whitelisted — try wa.me below.
    }
    await Linking.openURL(`https://wa.me/${num}?text=${text}`);
    return 'text-fallback';
  }

  return 'unavailable';
}
