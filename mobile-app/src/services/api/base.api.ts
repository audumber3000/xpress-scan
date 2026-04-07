import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApiBaseUrl } from '../../config/api.config';

const FETCH_TIMEOUT_MS = 8000;

export class BaseApiService {
  protected baseURL = `${getApiBaseUrl()}/api/v1`;

  protected async getAuthHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  protected async fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, { ...options, signal: controller.signal });
      return response;
    } catch (err: any) {
      if (err.name === 'AbortError') {
        throw new Error(`Request timed out after ${FETCH_TIMEOUT_MS / 1000}s: ${url}`);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 [API] Testing connection to:', this.baseURL);
      const response = await this.fetchWithTimeout(`${this.baseURL}/`);
      console.log('✅ [API] Connection test - Status:', response.status);
      return response.status === 200 || response.status === 404;
    } catch (error: any) {
      console.error('❌ [API] Connection test failed:', error.message);
      return false;
    }
  }
}

export const baseApiService = new BaseApiService();