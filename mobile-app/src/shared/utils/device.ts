import { Dimensions } from 'react-native';
import * as Device from 'expo-device';

/**
 * Whether this device should be treated as a tablet. On tablets we hand the
 * user off to the responsive web app inside a WebView instead of the phone-only
 * native UI (see TabletWebAppScreen), so this flag decides the whole shell.
 *
 * Detection order:
 *  1. EXPO_PUBLIC_FORCE_TABLET=1 — dev override so the WebView path can be
 *     exercised on a phone emulator/simulator without a real tablet.
 *  2. expo-device deviceType === TABLET — the reliable signal on both platforms.
 *  3. Smallest-dimension >= 600dp fallback — the standard Android sw600dp / iPad
 *     threshold, for the rare case deviceType comes back UNKNOWN.
 *
 * Captured once at module load: the shell (native tabs vs WebView) is chosen at
 * launch and we don't hot-swap it on Split View resize.
 */
function detectTablet(): boolean {
  if (process.env.EXPO_PUBLIC_FORCE_TABLET === '1') return true;

  if (Device.deviceType === Device.DeviceType.TABLET) return true;

  const { width, height } = Dimensions.get('window');
  return Math.min(width, height) >= 600;
}

export const IS_TABLET = detectTablet();
