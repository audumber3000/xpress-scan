const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";

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

  const fullUrl = `${API_URL}${url}`;
  console.log("API Debug - Full URL:", fullUrl);
  console.log("API Debug - API_URL:", API_URL);
  console.log("API Debug - url param:", url);

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
  get: async (url) => {
    const result = await authenticatedFetch(url);
    return result.data;
  },
  post: async (url, data) => {
    const result = await authenticatedFetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
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

// WhatsApp Configuration API methods
export const whatsappApi = {
  getMyConfig: async () => {
    return await api.get('/whatsapp-config/my-config');
  },
  
  createConfig: async (configData) => {
    return await api.post('/whatsapp-config/', configData);
  },
  
  updateConfig: async (configId, configData) => {
    return await api.put(`/whatsapp-config/${configId}`, configData);
  },
  
  deleteConfig: async (configId) => {
    return await api.delete(`/whatsapp-config/${configId}`);
  },
  
  testConnection: async () => {
    return await api.post('/whatsapp-config/test-connection');
  },
  
  getCredit: async () => {
    return await api.get('/whatsapp-config/credit');
  }
}; 