import AsyncStorage from '@react-native-async-storage/async-storage';
import { BaseApiService } from './base.api';

/**
 * The signup verification step: one code, sent to WhatsApp and email at once.
 *
 * Talks to `/security/signup-otp/*`, the same two endpoints the web onboarding
 * uses. Both require a signed-in clinic owner with a clinic, so this only ever
 * runs AFTER `/auth/onboarding` has created one.
 *
 * ## Why send never throws on a half failure
 *
 * The server reports per-channel delivery rather than failing the request when
 * one provider is unhappy. If Meta rejects the WhatsApp but the email goes out,
 * the person can still finish; refusing the whole thing because one provider
 * had a bad minute would wall a brand-new clinic out of the product on their
 * first day. Only when BOTH channels fail does it 502, and that is the case the
 * screen turns into "message support".
 *
 * ## Why the send state is persisted
 *
 * The screen used to guard its send-on-open with a `useRef`, which lives and
 * dies with the mount. Anything that rebuilt the navigator — an auth-state
 * re-fire, Android reclaiming memory, a relaunch — produced a fresh mount, a
 * fresh guard, and another code. One clinic collected twenty messages that way.
 *
 * A ref cannot fix that because the problem is the mount itself. The record of
 * "a code is already out there" has to outlive the component, so it is written
 * to AsyncStorage keyed by clinic and read back on open. The server enforces
 * the same limits independently; this is what stops the app asking in the first
 * place, and what lets a remounted screen show the right countdown instead of
 * restarting it at zero.
 */

export interface SignupOtpDelivery {
  sent: boolean;
  error?: string | null;
}

export interface SignupOtpSendResult {
  ok: boolean;
  /** Channels the code actually left on. 'log' on a dev box with OTP_DEV_ECHO. */
  reached: string[];
  delivery: Record<string, SignupOtpDelivery>;
  /** True when the server wrote the code to its log instead of sending it. */
  devEcho: boolean;
  /** Seconds until another send is allowed. */
  resendIn: number;
  /** Seconds the code stays good for. */
  expiresIn: number;
  /** The server refused because a code is already in flight, or the hourly
   *  ceiling is hit. Not a failure: there is a live code to type. */
  rateLimited?: boolean;
  /** Nothing left to do — the clinic is already verified. */
  alreadyVerified?: boolean;
  /** Set when neither channel worked, or the request itself failed. */
  error?: string;
}

export interface SignupOtpVerifyResult {
  ok: boolean;
  error?: string;
  /** Set on a 429: no more tries until a new code is sent. */
  rateLimited?: boolean;
  retryAfter?: number;
}

export interface SecurityContacts {
  security_phone: string | null;
  security_email: string | null;
  security_phone_verified: boolean;
  security_email_verified: boolean;
}

/** What the screen needs to know on open, without asking the server for a code. */
export interface SignupOtpSendState {
  /** Epoch ms of the last successful send. */
  sentAt: number;
  /** Epoch ms the code stops working. */
  expiresAt: number;
  /** Epoch ms another send is allowed. */
  resendAt: number;
  reached: string[];
  failed: string[];
  devEcho: boolean;
  phone: string;
  email: string;
}

const STATE_KEY = (clinicId: string | number) => `signupOtp:v1:${clinicId}`;

const DEFAULT_RESEND_SEC = 45;
const DEFAULT_TTL_SEC = 600;

/** Read the server's Retry-After, falling back to the usual cooldown. */
const retryAfterOf = (res: Response): number => {
  const raw = res.headers.get('X-Retry-After-Seconds') || res.headers.get('Retry-After');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n) : DEFAULT_RESEND_SEC;
};

class SignupOtpApiService extends BaseApiService {
  /** What the clinic currently has on file, to prefill the step. */
  async getContacts(): Promise<SecurityContacts | null> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/security`, { headers });
      return res.ok ? await res.json() : null;
    } catch {
      return null;
    }
  }

  /**
   * The send record for this clinic, or null if there has never been one.
   *
   * Storage failures resolve to null rather than throwing: the worst case is
   * one extra send, which the server's own cooldown then catches.
   */
  async readSendState(clinicId: string | number): Promise<SignupOtpSendState | null> {
    try {
      const raw = await AsyncStorage.getItem(STATE_KEY(clinicId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as SignupOtpSendState;
      return typeof parsed?.sentAt === 'number' ? parsed : null;
    } catch {
      return null;
    }
  }

  private async writeSendState(clinicId: string | number, state: SignupOtpSendState) {
    try {
      await AsyncStorage.setItem(STATE_KEY(clinicId), JSON.stringify(state));
    } catch {
      // Non-fatal, see readSendState.
    }
  }

  /** Called once the step is done, so a later signup on this device starts clean. */
  async clearSendState(clinicId: string | number) {
    try {
      await AsyncStorage.removeItem(STATE_KEY(clinicId));
    } catch {
      // Non-fatal.
    }
  }

  async send(
    clinicId: string | number,
    phone: string,
    email: string,
  ): Promise<SignupOtpSendResult> {
    const base = {
      reached: [] as string[],
      delivery: {} as Record<string, SignupOtpDelivery>,
      devEcho: false,
      resendIn: DEFAULT_RESEND_SEC,
      expiresIn: DEFAULT_TTL_SEC,
    };

    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/security/signup-otp/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, email }),
      });
      const body = await res.json().catch(() => ({} as any));

      // A code is already in flight, or the clinic has asked too often. Either
      // way there is nothing wrong and nothing to retry — the screen counts
      // down and the customer types the code they were already sent.
      if (res.status === 429) {
        const retryAfter = retryAfterOf(res);
        const previous = await this.readSendState(clinicId);
        return {
          ...base,
          ok: true,
          rateLimited: true,
          resendIn: retryAfter,
          reached: previous?.reached || [],
          devEcho: !!previous?.devEcho,
          error: typeof body?.detail === 'string' ? body.detail : undefined,
        };
      }

      if (!res.ok) {
        return {
          ...base,
          ok: false,
          error: body?.detail
            || 'We could not send the code just now. Check the number and the address, then try again.',
        };
      }

      if (body?.already_verified) {
        await this.clearSendState(clinicId);
        return { ...base, ok: true, alreadyVerified: true };
      }

      const now = Date.now();
      const resendIn = Number(body?.resend_in) > 0 ? Number(body.resend_in) : DEFAULT_RESEND_SEC;
      const expiresIn = Number(body?.expires_in) > 0 ? Number(body.expires_in) : DEFAULT_TTL_SEC;
      const reached: string[] = body?.reached || [];
      const delivery: Record<string, SignupOtpDelivery> = body?.delivery || {};
      const failed = Object.entries(delivery).filter(([, r]) => !r.sent).map(([ch]) => ch);

      await this.writeSendState(clinicId, {
        sentAt: now,
        expiresAt: now + expiresIn * 1000,
        resendAt: now + resendIn * 1000,
        reached,
        failed,
        devEcho: !!body?.dev_echo,
        phone,
        email,
      });

      return {
        ok: true,
        reached,
        delivery,
        devEcho: !!body?.dev_echo,
        resendIn,
        expiresIn,
      };
    } catch {
      return {
        ...base,
        ok: false,
        error: 'We could not reach the server. Check your connection and try again.',
      };
    }
  }

  /** One code, any live generation's row, both contacts marked verified. */
  async verify(clinicId: string | number, code: string): Promise<SignupOtpVerifyResult> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/security/signup-otp/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code }),
      });

      if (res.ok) {
        await this.clearSendState(clinicId);
        return { ok: true };
      }

      const body = await res.json().catch(() => ({} as any));
      if (res.status === 429) {
        return {
          ok: false,
          rateLimited: true,
          retryAfter: retryAfterOf(res),
          error: typeof body?.detail === 'string'
            ? body.detail
            : 'Too many incorrect tries. Send a new code.',
        };
      }
      return { ok: false, error: body?.detail || 'That code did not work. Try again.' };
    } catch {
      return { ok: false, error: 'We could not reach the server. Check your connection and try again.' };
    }
  }
}

export const signupOtpApiService = new SignupOtpApiService();
