import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { getFixIfAlreadyAllowed } from '../../shared/utils/location';
import { BaseApiService } from './base.api';
import { setCurrencySymbol } from '../../shared/utils/currency';

export interface ClinicInfo {
  id: string;
  name: string;
  address?: string;
  phone?: string | null;
  imageUrl?: string;
  // Deliberately a loose string, not a union. Production has stored 'free',
  // 'professional', 'professional_annual' and 'enterprise', and a phone that
  // has not been opened in a year will still be handed them. Everything that
  // reads this goes through resolvePlan() in shared/constants/plans.
  subscription_plan?: string | null;
  plan_name?: string | null;
  /** What the clinic can use RIGHT NOW, which after an expiry is not plan_name. */
  effective_plan?: string | null;
  is_trial?: boolean;
  plan_ends_at?: string | null;
  trial_days_remaining?: number | null;
  /** Two-letter country, which decides the billing currency. Defaults to IN. */
  country?: string | null;
  // Where the clinic stands with its plan: 'ok' | 'renewal_due' | 'grant_due'
  // | 'trial_ended' | 'lapsed' | 'grant_ended'. Same value the write-lock
  // enforces from, so the app cannot say everything is fine while the server
  // refuses every save.
  plan_state?: string | null;
  plan_state_days?: number | null;
  plan_state_title?: string | null;
  /** True while the clinic still owes us the signup verification step. Server
   *  computed, and false for every clinic that predates the check — so no
   *  existing customer is ever sent to that screen. */
  security_verification_required?: boolean;
  currency_symbol?: string;
  // Clinic sends patient WhatsApp manually from its own number (opt-in). When on,
  // the installed app shares via the OS share sheet instead of the automated send.
  manual_whatsapp?: boolean;
}

export interface BackendUser {
  id: string;
  email?: string | null;       // Optional — staff may have only a username
  username?: string | null;
  name: string;
  first_name?: string;
  last_name?: string;
  role: 'clinic_owner' | 'receptionist' | 'doctor';
  phone?: string;
  clinic?: ClinicInfo;
  clinics?: ClinicInfo[];
  permissions?: Record<string, Record<string, boolean>>;
  /** Profile photo the person uploaded in the app (a data: URI). Takes
   *  precedence over the Google/Apple picture on the Firebase user, which
   *  came along with sign-in rather than being chosen. */
  avatar_url?: string | null;
}

export class AuthApiService extends BaseApiService {
  async getUserInfo(): Promise<BackendUser | null> {
    try {
      const storedUser = await AsyncStorage.getItem('backend_user');
      return storedUser ? JSON.parse(storedUser) : null;
    } catch (error) {
      console.error('Error fetching stored user:', error);
      return null;
    }
  }

  /**
   * Look up an account by email for the forgot-password confirmation step.
   * Returns the owner's name + clinic so the user can confirm before sending
   * a reset link. Returns { found: false } on any miss/error.
   */
  async accountPreview(email: string): Promise<{
    found: boolean;
    name?: string;
    clinic_name?: string | null;
    has_password?: boolean;
  }> {
    try {
      const res = await this.fetchWithTimeout(`${this.baseURL}/auth/account-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      if (!res.ok) return { found: false };
      return await res.json();
    } catch {
      return { found: false };
    }
  }

  private transformUser(data: any): BackendUser {
    // Backend returns data in different formats depending on endpoint
    // AuthResponseDTO: { user: {...}, clinic: {...}, clinics: [...] }
    // User response: { id: ..., email: ..., clinic: {...}, clinics: [...] }
    const userData = data.user || data;
    
    // Robustly extract clinic and clinics from either location
    const clinicSource = data.clinic || userData.clinic;
    const clinicsSource = data.clinics || userData.clinics;
    
    // Prime currency symbol cache from clinic data
    const symbol = clinicSource?.currency_symbol || clinicsSource?.[0]?.currency_symbol;
    if (symbol) setCurrencySymbol(symbol);

    return {
      id: userData.id.toString(),
      email: userData.email ?? null,
      username: userData.username ?? null,
      name: userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      first_name: userData.first_name ?? undefined,
      last_name: userData.last_name ?? undefined,
      role: userData.role,
      phone: userData.phone,
      clinic: clinicSource ? {
        id: clinicSource.id.toString(),
        name: clinicSource.name,
        address: clinicSource.address,
        phone: clinicSource.phone ?? null,
        imageUrl: clinicSource.logo_url,
        subscription_plan: clinicSource.subscription_plan,
        plan_name: clinicSource.plan_name ?? null,
        effective_plan: clinicSource.effective_plan ?? null,
        country: clinicSource.country ?? null,
        plan_state: clinicSource.plan_state ?? null,
        plan_state_days: clinicSource.plan_state_days ?? null,
        plan_state_title: clinicSource.plan_state_title ?? null,
        security_verification_required: !!clinicSource.security_verification_required,
        is_trial: !!clinicSource.is_trial,
        plan_ends_at: clinicSource.plan_ends_at ?? null,
        trial_days_remaining: clinicSource.trial_days_remaining ?? null,
        currency_symbol: clinicSource.currency_symbol ?? '₹',
        manual_whatsapp: !!clinicSource.manual_whatsapp,
      } : undefined,
      clinics: clinicsSource ? clinicsSource.map((c: any) => ({
        id: c.id.toString(),
        name: c.name,
        address: c.address,
        imageUrl: c.logo_url,
        subscription_plan: c.subscription_plan,
        plan_name: c.plan_name ?? null,
        is_trial: !!c.is_trial,
        plan_ends_at: c.plan_ends_at ?? null,
        trial_days_remaining: c.trial_days_remaining ?? null,
        currency_symbol: c.currency_symbol ?? '₹',
        manual_whatsapp: !!c.manual_whatsapp,
      })) : [],
      permissions: userData.permissions || {},
    };
  }

  /**
   * Self-service edit of the signed-in user's personal profile. Hits
   * PATCH /auth/me (name + phone only — never role, email, clinic or password).
   * Returns the refreshed name parts so callers can update local state.
   */
  async updateProfile(payload: { first_name?: string; last_name?: string; phone?: string }):
    Promise<{ first_name: string; last_name: string; name: string; phone?: string }> {
    const headers = await this.getAuthHeaders();
    const response = await this.fetchWithTimeout(`${this.baseURL}/auth/me`, {
      method: 'PATCH',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      let detail = `HTTP ${response.status}`;
      try { detail = (await response.json())?.detail || detail; } catch {}
      throw new Error(detail);
    }
    return response.json();
  }

  async getCurrentUser(): Promise<BackendUser | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/me`, {
        method: 'GET',
        headers,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const user = this.transformUser(data);

      await AsyncStorage.setItem('backend_user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Error fetching current user:', error);
      return null;
    }
  }

  async switchClinic(clinicId: string): Promise<BackendUser | null> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/switch-clinic/${clinicId}`, {
        method: 'POST',
        headers,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to switch clinic: ${errorText}`);
      }

      const data = await response.json();
      const user = this.transformUser(data);
      
      await AsyncStorage.setItem('backend_user', JSON.stringify(user));
      return user;
    } catch (error) {
      console.error('Error switching clinic:', error);
      throw error;
    }
  }

  async backendLogin(email: string, password: string): Promise<{ user: BackendUser | null; error?: string }> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
          device: {
            device_name: 'Mobile App',
            device_type: 'mobile',
            device_platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
            // Only if the permission is already granted from clocking in. Signing
            // in is the wrong moment to interrupt somebody with a location
            // dialog to fill a column on an admin screen, and an app that
            // prompts at every opportunity teaches people to tap Deny.
            ...(await getFixIfAlreadyAllowed(4000) ?? {}),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.token) {
        await AsyncStorage.setItem('access_token', data.token);
      }

      const user = this.transformUser(data);
      await AsyncStorage.setItem('backend_user', JSON.stringify(user));

      return { user };
    } catch (error: any) {
      console.error('Error during backend login:', error);
      return { user: null, error: error.message };
    }
  }

  async oauthLogin(idToken: string, role?: string): Promise<{ user: BackendUser | null; error?: string }> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: idToken,
          role,
          device: {
            device_name: 'Mobile App',
            device_type: 'mobile',
            device_platform: Platform.OS === 'ios' ? 'iOS' : 'Android',
            // Only if the permission is already granted from clocking in. Signing
            // in is the wrong moment to interrupt somebody with a location
            // dialog to fill a column on an admin screen, and an app that
            // prompts at every opportunity teaches people to tap Deny.
            ...(await getFixIfAlreadyAllowed(4000) ?? {}),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.token) {
        await AsyncStorage.setItem('access_token', data.token);
      }

      const user = this.transformUser(data);
      await AsyncStorage.setItem('backend_user', JSON.stringify(user));
      
      return { user };
    } catch (error: any) {
      console.error('Error during OAuth login:', error);
      return { user: null, error: error.message };
    }
  }

  async completeOnboarding(onboardingData: any): Promise<{ message?: string; error?: string }> {
    try {
      const headers = await this.getAuthHeaders();
      const response = await this.fetchWithTimeout(`${this.baseURL}/auth/onboarding`, {
        method: 'POST',
        headers,
        body: JSON.stringify(onboardingData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error: any) {
      console.error('Error during onboarding:', error);
      return { error: error.message };
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'backend_user', 'selected_clinic_id']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }
}

export const authApiService = new AuthApiService();