import AsyncStorage from '@react-native-async-storage/async-storage';
import { BaseApiService } from './base.api';

export interface ClinicInfo {
  id: string;
  name: string;
  address?: string;
  imageUrl?: string;
  subscription_plan?: 'free' | 'professional';
}

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: 'clinic_owner' | 'receptionist' | 'doctor';
  phone?: string;
  clinic?: ClinicInfo;
  clinics?: ClinicInfo[];
  permissions?: Record<string, Record<string, boolean>>;
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

  private transformUser(data: any): BackendUser {
    // Backend returns data in different formats depending on endpoint
    // AuthResponseDTO: { user: {...}, clinic: {...}, clinics: [...] }
    // User response: { id: ..., email: ..., clinic: {...}, clinics: [...] }
    const userData = data.user || data;
    
    // Robustly extract clinic and clinics from either location
    const clinicSource = data.clinic || userData.clinic;
    const clinicsSource = data.clinics || userData.clinics;
    
    return {
      id: userData.id.toString(),
      email: userData.email,
      name: userData.name || `${userData.first_name || ''} ${userData.last_name || ''}`.trim(),
      role: userData.role,
      phone: userData.phone,
      clinic: clinicSource ? {
        id: clinicSource.id.toString(),
        name: clinicSource.name,
        address: clinicSource.address,
        imageUrl: clinicSource.logo_url,
        subscription_plan: clinicSource.subscription_plan,
      } : undefined,
      clinics: clinicsSource ? clinicsSource.map((c: any) => ({
        id: c.id.toString(),
        name: c.name,
        address: c.address,
        imageUrl: c.logo_url,
        subscription_plan: c.subscription_plan,
      })) : [],
      permissions: userData.permissions || {},
    };
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

import { Platform } from 'react-native';
export const authApiService = new AuthApiService();