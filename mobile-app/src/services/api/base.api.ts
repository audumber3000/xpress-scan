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

  /**
   * Headers for multipart/form-data uploads. Deliberately omits Content-Type:
   * React Native's fetch must set `multipart/form-data; boundary=…` itself when
   * the body is a FormData. Forcing `application/json` (as getAuthHeaders does)
   * sends the wrong/missing boundary, so the server can't parse the file.
   */
  protected async getUploadHeaders(): Promise<HeadersInit> {
    const token = await AsyncStorage.getItem('access_token');
    return {
      'Accept': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }

  /**
   * POST a multipart FormData with real upload-progress reporting. fetch() can't
   * report progress, so we drive an XMLHttpRequest (supported in RN) and surface
   * the byte fraction via onProgress(0..1). Content-Type is left unset so the
   * boundary is generated automatically.
   */
  protected async uploadWithProgress(
    url: string,
    formData: FormData,
    onProgress?: (fraction: number) => void,
  ): Promise<any> {
    const token = await AsyncStorage.getItem('access_token');
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open('POST', url);
      xhr.setRequestHeader('Accept', 'application/json');
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      if (xhr.upload) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
        };
      }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)); } catch { resolve(null); }
        } else {
          let detail: string | undefined;
          try { detail = JSON.parse(xhr.responseText)?.detail; } catch { /* non-JSON */ }
          reject(new Error(detail || `Upload failed (HTTP ${xhr.status})`));
        }
      };
      xhr.onerror = () => reject(new Error('Network error during upload'));
      xhr.send(formData);
    });
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