import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Crypto from 'expo-crypto';

/**
 * A random id for this install of the app, sent as the device serial on every
 * sign-in.
 *
 * Without it the server named the device after a hash of the user-agent, which
 * is the same string on every phone running the app. So every phone signed in
 * to one account was the same "device": blocking one (the QR panel's "Not
 * them?", or Devices in the Control Center) signed out all of them, and the
 * Devices list could not tell them apart.
 *
 * Kept outside the session keys, so signing out does not change it: the same
 * phone stays the same device.
 */
const KEY = 'device_install_id';
let cached: string | null = null;

export async function getInstallId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
    const fresh = `app_${Crypto.randomUUID()}`;
    await AsyncStorage.setItem(KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    // Storage unavailable: a per-launch id is still better than a shared one.
    cached = cached || `app_${Crypto.randomUUID()}`;
    return cached;
  }
}
