import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../../config/api.config';

export class BaseApiService {
  protected baseURL = `${getApiBaseUrl()}/api/v1`;

  protected async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 [API] Testing connection to:', this.baseURL);
      const response = await fetch(`${this.baseURL}/`, {
        method: 'GET',
      });
      console.log('✅ [API] Connection test - Status:', response.status);
      return response.status === 200 || response.status === 404; // 404 is ok, means server is reachable
    } catch (error: any) {
      console.error('❌ [API] Connection test failed:', error.message);
      return false;
    }
  }
}

export const baseApiService = new BaseApiService();