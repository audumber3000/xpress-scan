import { BaseApiService } from './base.api';

/**
 * The signup verification step: one code, sent to WhatsApp and email at once.
 *
 * Talks to `/security/signup-otp/*`, the same two endpoints the web onboarding
 * uses, unchanged. Both require a signed-in clinic owner with a clinic, so this
 * only ever runs AFTER `/auth/onboarding` has created one.
 *
 * ## Why send never throws on a half failure
 *
 * The server reports per-channel delivery rather than failing the request when
 * one provider is unhappy. If Meta rejects the WhatsApp but the email goes out,
 * the person can still finish; refusing the whole thing because one provider
 * had a bad minute would wall a brand-new clinic out of the product on their
 * first day. Only when BOTH channels fail does it 502, and that is the case the
 * screen turns into "message support".
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
  /** Set when neither channel worked, or the request itself failed. */
  error?: string;
}

export interface SecurityContacts {
  security_phone: string | null;
  security_email: string | null;
  security_phone_verified: boolean;
  security_email_verified: boolean;
}

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

  async send(phone: string, email: string): Promise<SignupOtpSendResult> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/security/signup-otp/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ phone, email }),
      });
      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        return {
          ok: false,
          reached: [],
          delivery: {},
          devEcho: false,
          error: body?.detail
            || 'We could not send the code just now. Check the number and the address, then try again.',
        };
      }

      return {
        ok: true,
        reached: body?.reached || [],
        delivery: body?.delivery || {},
        devEcho: !!body?.dev_echo,
      };
    } catch (e: any) {
      return {
        ok: false,
        reached: [],
        delivery: {},
        devEcho: false,
        error: 'We could not reach the server. Check your connection and try again.',
      };
    }
  }

  /** One code, either channel's row, both contacts marked verified. */
  async verify(code: string): Promise<{ ok: boolean; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const res = await this.fetchWithTimeout(`${this.baseURL}/security/signup-otp/verify`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ code }),
      });
      if (res.ok) return { ok: true };
      const body = await res.json().catch(() => ({}));
      return { ok: false, error: body?.detail || 'That code did not work. Try again.' };
    } catch {
      return { ok: false, error: 'We could not reach the server. Check your connection and try again.' };
    }
  }
}

export const signupOtpApiService = new SignupOtpApiService();
