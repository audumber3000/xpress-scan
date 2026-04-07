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
        // Only clear storage on a real 401 — token is genuinely invalid/expired
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');
        const err = new Error(errorData.detail || 'Authentication failed');
        err.status = response.status;
        err.detail = errorData.detail;
        err.isAuthError = true;  // flag so callers can distinguish 401 from network errors
        throw err;
      }
      console.error('API Error Response:', errorData);
      
      // Handle validation errors from FastAPI
      if (errorData.detail && Array.isArray(errorData.detail)) {
        const validationErrors = errorData.detail.map(err => 
          `${err.loc.join('.')}: ${err.msg}`
        ).join(', ');
        const validationError = new Error(`Validation Error: ${validationErrors}`);
        validationError.status = response.status;
        validationError.detail = errorData.detail;
        throw validationError;
      }
      
      const apiError = new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
      apiError.status = response.status;
      apiError.detail = errorData.detail;
      throw apiError;
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

export const getPermissionAwareErrorMessage = (error, fallbackMessage, permissionMessage) => {
  const message = error?.message || '';
  const isPermissionError =
    error?.status === 403 ||
    /insufficient permissions|don't have permission|permission/i.test(message);

  if (isPermissionError) {
    return permissionMessage || "You don't have permission to perform this action.";
  }

  return fallbackMessage;
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
