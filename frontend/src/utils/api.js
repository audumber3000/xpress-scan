const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";
const API_BASE_PATH = "/api/v1";

// Helper function to get auth headers
const getAuthHeaders = (isFormData = false) => {
  const token = localStorage.getItem('auth_token');
  const headers = {
    'Authorization': token ? `Bearer ${token}` : ''
  };

  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  return headers;
};

// Authenticated fetch wrapper
export const authenticatedFetch = async (url, options = {}) => {
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



  // Add timeout to fetch requests (60 seconds for WhatsApp endpoints, 30 for others)
  const isWhatsAppEndpoint = url.includes('/whatsapp/');
  const timeout = isWhatsAppEndpoint ? 60000 : 30000;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 401) {
        // Token might be expired, clear storage but don't redirect here
        // Let React router handle navigation through AuthContext
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        throw new Error(errorData.detail || 'Authentication failed');
      }
      console.error('API Error Response:', errorData);
      
      // Handle validation errors from FastAPI
      if (errorData.detail && Array.isArray(errorData.detail)) {
        const validationErrors = errorData.detail.map(err => 
          `${err.loc.join('.')}: ${err.msg}`
        ).join(', ');
        throw new Error(`Validation Error: ${validationErrors}`);
      }
      
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
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('Request timeout - server took too long to respond');
    }
    throw error;
  }
};

// Common API methods
export const api = {
  get: async (url, options = {}) => {
    const result = await authenticatedFetch(url, options);
    return result.data;
  },
  post: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const result = await authenticatedFetch(url, {
      method: 'POST',
      body: isFormData ? data : JSON.stringify(data),
      ...options
    });
    return result.data;
  },
  put: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const result = await authenticatedFetch(url, {
      method: 'PUT',
      body: isFormData ? data : JSON.stringify(data),
      ...options
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
