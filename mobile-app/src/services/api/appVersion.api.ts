import * as Application from 'expo-application';
import { Platform } from 'react-native';
import { BaseApiService } from './base.api';

/**
 * Is this build still allowed to run?
 *
 * The check is unauthenticated on both ends, which matters: a build old enough
 * to be forced off may already be one whose sign-in has stopped working, so a
 * gate that needed a token would miss exactly the users it exists for.
 */

export type UpdateAction = 'force' | 'nudge' | 'none';

export interface VersionCheck {
  action: UpdateAction;
  min_supported: string;
  latest: string;
  message?: string | null;
  store_url?: string | null;
}

/** What the store thinks this build is, not what package.json says. */
export const runningVersion = (): string =>
  Application.nativeApplicationVersion || '0.0.0';

class AppVersionApiService extends BaseApiService {
  /**
   * Never throws. Any failure resolves to "carry on".
   *
   * This is the single most important line in the file. A version check is the
   * one call that can lock a user out of a working app, so every uncertain
   * answer — server down, timeout, bad JSON, aeroplane mode — has to mean
   * "let them in". Failing closed here would turn a five-minute backend blip
   * into every clinic in the country staring at an update wall.
   */
  async check(): Promise<VersionCheck> {
    const open: VersionCheck = { action: 'none', min_supported: '0.0.0', latest: '0.0.0' };
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const version = runningVersion();
      const res = await this.fetchWithTimeout(
        `${this.baseURL}/app/version?platform=${platform}&version=${encodeURIComponent(version)}`,
        { headers: { 'Content-Type': 'application/json' } },
      );
      if (!res.ok) return open;
      const data = await res.json();
      if (data?.action !== 'force' && data?.action !== 'nudge') return open;
      return data as VersionCheck;
    } catch {
      return open;
    }
  }
}

export const appVersionApiService = new AppVersionApiService();
