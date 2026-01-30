const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API_BASE_PATH = "/api/v1";

// Helper function to get auth headers
const getAuthHeaders = () => {
  const token = localStorage.getItem('auth_token');
  return {
    'Content-Type': 'application/json',
    'Authorization': token ? `Bearer ${token}` : ''
  };
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (url, options = {}) => {
  // Check if body is FormData to skip Content-Type header
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...getAuthHeaders(isFormData),
    ...options.headers
  };

  let fullUrl = `${API_URL}${API_BASE_PATH}${url}`;
  
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
      // Token might be expired, redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      // In Tauri, full page redirect breaks the webview; use event so app can soft-navigate
      if (typeof window !== 'undefined' && window.__TAURI_INTERNALS__) {
        window.dispatchEvent(new CustomEvent('auth:unauthorized'));
      } else {
        window.location.href = '/login';
      }
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
    // If not JSON, return the response as is
    return { data: response, response };
  }
};

// Common API methods
export const api = {
  get: async (url, options = {}) => {
    const result = await authenticatedFetch(url, options);
    return result.data;
  },
  post: async (url, data, options = {}) => {
    // Handle FormData (for file uploads)
    const isFormData = data instanceof FormData;
    const headers = isFormData 
      ? {} // Don't set Content-Type for FormData, browser will set it with boundary
      : { 'Content-Type': 'application/json' };
    
    const result = await authenticatedFetch(url, {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      headers: {
        ...headers,
        ...options.headers
      },
      ...options
    });
    return result.data;
  },
  put: async (url, data) => {
    const result = await authenticatedFetch(url, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return result.data;
  },
  delete: async (url) => {
    const result = await authenticatedFetch(url, {
      method: 'DELETE'
    });
    return result.data;
  }
};
