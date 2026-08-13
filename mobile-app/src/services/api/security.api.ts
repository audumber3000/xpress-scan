import { BaseApiService } from './base.api';

/**
 * The clinic's security settings: the recovery contact, and the master password
 * that stands in front of the deletes nothing can undo.
 *
 * Same endpoints the web app uses — there is no mobile-specific backend here.
 * The master password is six digits set by the owner in Control Center, asked
 * for every single time a patient, a paid bill or a recorded payment is
 * deleted, and never remembered between prompts.
 *
 * `verifyMasterPassword` hands back a short-lived token rather than letting the
 * delete carry the digits. That split is deliberate: a wrong code is answered
 * before anything is destroyed, so "that password is not right" and "the delete
 * failed" can never be the same red message.
 */

export interface MasterPasswordStatus {
  is_default: boolean;
  updated_at: string | null;
  phone: string | null;
}

export interface SecurityContact {
  security_phone: string | null;
  security_email: string | null;
  security_phone_verified: boolean;
  security_email_verified: boolean;
}

export interface MasterPasswordToken {
  token: string;
  expires_in: number;
}

/** Pull the server's own sentence out of a failed response, or say something sane. */
async function detailOf(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    const d = body?.detail;
    if (typeof d === 'string' && d.trim()) return d;
  } catch {
    /* non-JSON body */
  }
  return fallback;
}

class SecurityApiService extends BaseApiService {
  // ── Master password ───────────────────────────────────────────────────────

  /** Owner only. Whether the clinic is still on the factory default 123456. */
  async getMasterPasswordStatus(): Promise<MasterPasswordStatus> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/master-password`, { headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not read the master password settings'));
    return res.json();
  }

  /** Owner only. Texts a code to the recovery phone before the password can move. */
  async sendMasterPasswordOtp(): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/master-password/otp`, {
      method: 'POST',
      headers,
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not send the code'));
  }

  /** Owner only. Needs the WhatsApp code, not the current master password. */
  async setMasterPassword(code: string, newPassword: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/master-password`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ code, new_password: newPassword }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not update the master password'));
  }

  /**
   * Open to every role, on purpose. That is the whole point of a master
   * password: a receptionist who has been told the code can push through a
   * delete their role alone would never allow, and one who has not been told it
   * cannot. Wrong guesses are counted and lock the code for a while.
   */
  async verifyMasterPassword(password: string): Promise<MasterPasswordToken> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/master-password/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ password }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not confirm the master password'));
    return res.json();
  }

  // ── Recovery contact ──────────────────────────────────────────────────────

  async getSecurity(): Promise<SecurityContact> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security`, { headers });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not load your security settings'));
    return res.json();
  }

  /** Changing a value clears its verified flag, so it must be re-verified. */
  async updateSecurity(patch: Partial<Pick<SecurityContact, 'security_phone' | 'security_email'>>): Promise<SecurityContact> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not save that'));
    return res.json();
  }

  async sendOtp(channel: 'whatsapp' | 'email'): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/otp/send`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not send the code'));
  }

  async verifyOtp(channel: 'whatsapp' | 'email', code: string): Promise<void> {
    const headers = await this.getAuthHeaders();
    const res = await this.fetchWithTimeout(`${this.baseURL}/security/otp/verify`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ channel, code }),
    });
    if (!res.ok) throw new Error(await detailOf(res, 'Could not verify the code'));
  }
}

export const securityApiService = new SecurityApiService();
