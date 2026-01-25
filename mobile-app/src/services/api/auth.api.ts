import AsyncStorage from '@react-native-async-storage/async-storage';
import { BaseApiService } from './base.api';

export interface BackendUser {
  id: string;
  email: string;
  name: string;
  role: 'clinic_owner' | 'receptionist' | 'doctor';
  phone?: string;
  clinic?: {
    id: string;
    name: string;
    address?: string;
  };
}

export class AuthApiService extends BaseApiService {
  async getUserInfo(): Promise<BackendUser | null> {
    try {
      const storedUser = await AsyncStorage.getItem('backend_user');
      if (storedUser) {
        return JSON.parse(storedUser);
      }
      return null;
    } catch (error) {
      console.error('Error fetching stored user:', error);
      return null;
    }
  }

  async getCurrentUser(): Promise<BackendUser | null> {
    try {
      console.log('🔍 [API] Fetching current user from:', `${this.baseURL}/auth/mobile/me`);

      const headers = await this.getAuthHeaders();
      console.log('🔑 [API] Headers:', JSON.stringify(headers, null, 2));

      const response = await fetch(`${this.baseURL}/auth/me`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] User data received:', JSON.stringify(data, null, 2));

      // Transform backend response to match BackendUser interface
      const user: BackendUser = {
        id: data.id.toString(),
        email: data.email,
        name: data.name || `${data.first_name || ''} ${data.last_name || ''}`.trim(),
        role: data.role,
        phone: data.phone,
        clinic: data.clinic ? {
          id: data.clinic.id.toString(),
          name: data.clinic.name,
          address: data.clinic.address,
        } : undefined,
      };

      // Store user info locally
      await AsyncStorage.setItem('backend_user', JSON.stringify(user));
      console.log('💾 [API] User data stored locally');

      return user;
    } catch (error: any) {
      console.error('❌ [API] Error fetching current user:', error);
      console.error('❌ [API] Error message:', error.message);
      console.error('❌ [API] Error stack:', error.stack);
      return null;
    }
  }

  async oauthLogin(idToken: string): Promise<{ user: BackendUser | null; error?: string }> {
    try {
      const response = await fetch(`${this.baseURL}/auth/oauth`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id_token: idToken,
          device: {
            device_name: 'Mobile App',
            device_type: 'mobile',
            device_platform: 'iOS/Android',
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      // Store tokens
      if (data.token) {
        await AsyncStorage.setItem('access_token', data.token);
      }
      if (data.refresh_token) {
        await AsyncStorage.setItem('refresh_token', data.refresh_token);
      }

      // Transform and store user data
      if (data.user) {
        const user: BackendUser = {
          id: data.user.id.toString(),
          email: data.user.email,
          name: data.user.name || `${data.user.first_name || ''} ${data.user.last_name || ''}`.trim(),
          role: data.user.role,
          phone: data.user.phone,
          clinic: data.user.clinic ? {
            id: data.user.clinic.id.toString(),
            name: data.user.clinic.name,
            address: data.user.clinic.address,
          } : undefined,
        };

        await AsyncStorage.setItem('backend_user', JSON.stringify(user));
        return { user };
      }

      return { user: null };
    } catch (error: any) {
      console.error('Error during OAuth login:', error);
      return { user: null, error: error.message };
    }
  }

  async clearTokens(): Promise<void> {
    try {
      await AsyncStorage.multiRemove(['access_token', 'refresh_token', 'backend_user']);
    } catch (error) {
      console.error('Error clearing tokens:', error);
    }
  }

  async getProfileStats(): Promise<{ patients: number; appointments: number; rating: number } | null> {
    try {
      console.log('📊 [API] Fetching profile stats from:', `${this.baseURL}/dashboard/metrics`);

      const headers = await this.getAuthHeaders();
      const response = await fetch(`${this.baseURL}/dashboard/metrics`, {
        method: 'GET',
        headers,
      });

      console.log('📡 [API] Stats response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [API] Stats error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
      }

      const data = await response.json();
      console.log('✅ [API] Stats data received:', JSON.stringify(data, null, 2));

      return {
        patients: data.total_patients?.value || 0,
        appointments: data.appointments_today?.value || 0,
        rating: 4.9, // This would come from a separate rating endpoint if available
      };
    } catch (error: any) {
      console.error('❌ [API] Error fetching profile stats:', error);
      console.error('❌ [API] Error message:', error.message);
      return null;
    }
  }
}

export const authApiService = new AuthApiService();