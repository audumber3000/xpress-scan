const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

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
  const headers = {
    ...getAuthHeaders(),
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
      // Token might be expired, redirect to login
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
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
    const result = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data),
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

// WhatsApp API methods
export const whatsappApi = {
  getMyConfig: async () => {
    const result = await authenticatedFetch('/whatsapp-config/my-config');
    return result.data;
  },
  createConfig: async (data) => {
    const result = await authenticatedFetch('/whatsapp-config', {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return result.data;
  },
  updateConfig: async (id, data) => {
    const result = await authenticatedFetch(`/whatsapp-config/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
    return result.data;
  },
  deleteConfig: async (id) => {
    const result = await authenticatedFetch(`/whatsapp-config/${id}`, {
      method: 'DELETE'
    });
    return result.data;
  },
  testConnection: async () => {
    const result = await authenticatedFetch('/whatsapp-config/test-connection');
    return result.data;
  },
  getCredit: async () => {
    const result = await authenticatedFetch('/whatsapp-config/credit');
    return result.data;
  }
}; 