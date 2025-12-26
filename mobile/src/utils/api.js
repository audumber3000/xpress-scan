import * as SecureStore from 'expo-secure-store';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL || "http://localhost:8000";

// Helper function to get auth headers
const getAuthHeaders = async () => {
  const token = await SecureStore.getItemAsync('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (url, options = {}) => {
  const headers = {
    ...(await getAuthHeaders()),
    ...options.headers
  };

  let fullUrl = `${API_URL}${url}`;
  
  // Handle query parameters
  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      fullUrl += `?${queryString}`;
    }
  }

  const response = await fetch(fullUrl, {
    ...options,
    headers
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Token might be expired
      await SecureStore.deleteItemAsync('auth_token');
      await SecureStore.deleteItemAsync('user');
      throw new Error('Authentication failed');
    }
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
  }

  // Try to parse JSON response
  try {
    const data = await response.json();
    return { data, response };
  } catch {
    return { data: response, response };
  }
};

// API helper functions
export const api = {
  get: (url, params) => authenticatedFetch(url, { method: 'GET', params }),
  post: (url, body) => authenticatedFetch(url, { method: 'POST', body: JSON.stringify(body) }),
  put: (url, body) => authenticatedFetch(url, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (url) => authenticatedFetch(url, { method: 'DELETE' }),
};

export default api;
