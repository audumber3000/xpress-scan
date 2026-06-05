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
  const timeout = 30000;
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

// Plain-English labels for fields that can fail server-side validation.
const FRIENDLY_FIELD_LABELS = {
  name: "Full name",
  age: "Age",
  gender: "Gender",
  phone: "Phone number",
  village: "Village/City",
  referred_by: "Referring doctor",
  treatment_type: "Treatment type",
  scan_type: "Treatment type",
  payment_type: "Payment type",
};

// Patterns that mean the message is a leaked stack trace / DB / framework string
// and should never be shown to a user.
const TECHNICAL_ERROR_RE =
  /traceback|psycopg|sqlalchemy|integrity\s?error|unique constraint|duplicate key|Internal Server|HTTP \d|Failed to create|NoneType|KeyError/i;

// Turn any thrown API error into a specific, human-friendly sentence.
// `fallback` is used whenever the underlying error is technical or unknown.
export const getFriendlyErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error) return fallback;

  const status = error.status;
  const detail = error.detail;
  const rawMessage = error.message || "";

  // Network / timeout errors have no HTTP status.
  if (!status) {
    if (/timeout/i.test(rawMessage)) {
      return "The server took too long to respond. Please check your connection and try again.";
    }
    if (/failed to fetch|network|load failed/i.test(rawMessage)) {
      return "We couldn't reach the server. Please check your internet connection and try again.";
    }
  }

  // FastAPI validation errors (422): detail is an array of { loc, msg }.
  if (Array.isArray(detail) && detail.length) {
    const first = detail[0] || {};
    const loc = Array.isArray(first.loc) ? first.loc : [];
    const field = loc[loc.length - 1];
    const label =
      FRIENDLY_FIELD_LABELS[field] ||
      (typeof field === "string" ? field.replace(/_/g, " ") : "A required field");
    const msg = (first.msg || "").toLowerCase();
    if (msg.includes("required") || msg.includes("missing") || msg.includes("none is not")) {
      return `${label} is required.`;
    }
    if (msg.includes("valid") || msg.includes("type")) {
      return `Please enter a valid ${label.toLowerCase()}.`;
    }
    return `Please check the "${label}" field and try again.`;
  }

  if (status === 403) return "You don't have permission to perform this action.";

  // A string detail straight from the backend — show it only if it's safe.
  if (typeof detail === "string" && detail.trim()) {
    return TECHNICAL_ERROR_RE.test(detail) ? fallback : detail;
  }

  return fallback;
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
