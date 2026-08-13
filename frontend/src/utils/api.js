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
  const timeout = options.timeout || 30000;
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
        const hadSession = !!localStorage.getItem('auth_token');
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user');

        // Clearing storage is not the same as signing out: React still holds
        // the user, so the app carried on rendering as if nothing had happened
        // until the next full reload. That matters now that a session can be
        // revoked mid-use — an owner blocks a device or deactivates somebody,
        // and that person should land on the login screen, not on a dashboard
        // where every request quietly fails.
        //
        // An event rather than a direct call, because AuthContext imports this
        // module and importing it back would be a cycle. Not fired when there
        // was no session to lose, so a wrong password on the login form does
        // not announce itself as an expiry.
        if (hadSession) {
          window.dispatchEvent(new CustomEvent('auth:expired', {
            detail: { reason: errorData.detail || 'Your session has ended.' },
          }));
        }

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

/**
 * Text that betrays the machinery. A user should never meet any of it.
 *
 * The list is deliberately wide. Half of this app's backend handlers end their
 * except block with `detail=f"Error deleting payment: {str(e)}"`, which staples
 * a raw Python exception onto a sentence — so the give-away words are as much
 * "Error deleting", "Failed to update" and "Traceback" as they are "psycopg".
 * When in doubt this errs towards hiding: a generic sentence a human wrote
 * beats a specific one a database wrote.
 */
const TECHNICAL_ERROR_RE = new RegExp([
  'traceback', 'psycopg', 'sqlalchemy', 'pydantic', 'asyncio', 'fastapi',
  'integrity\\s?error', 'unique constraint', 'foreign key', 'duplicate key',
  'relation .* does not exist', 'column .* does not exist', 'undefinedcolumn',
  'null value in column', 'violates', 'constraint',
  'internal server', 'nonetype', 'keyerror', 'typeerror', 'valueerror',
  'attributeerror', 'indexerror', 'not subscriptable', 'object has no attribute',
  'exception', 'stack', '<[a-z]+ object at 0x',   // repr() of a Python object
  'http \\d{3}', '\\bstatus code\\b', 'econnrefused', 'enotfound',
  // Our own handlers' habit of prefixing a raw exception.
  '(error|failed) (creating|updating|deleting|fetching|loading|saving|processing)',
].join('|'), 'i');

/**
 * When the server breaks in a way nobody designed for. Says three things a
 * person actually wants to know: it is not their fault, their data survived,
 * and what to do next.
 */
const SERVER_FAULT =
  "Something went wrong on our end, not yours. Nothing you entered was lost. " +
  "Please try again in a moment, and tell support if it keeps happening.";

/**
 * Turn anything thrown by the API into a sentence a dentist would say.
 *
 * Status first, text second, and that order matters. A 500 is by definition a
 * case we did not plan for, so whatever string came with it describes our bug
 * rather than the user's situation, and is discarded unread. Only the 4xx
 * range can carry a message worth showing, because those are the refusals we
 * wrote on purpose ("Paid invoices cannot be deleted", "That code expired").
 *
 * `fallback` is what to say when there is nothing safe and specific to say.
 */
export const getFriendlyErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error) return fallback;
  if (typeof error === "string") {
    return TECHNICAL_ERROR_RE.test(error) ? fallback : error;
  }

  const status = error.status;
  const detail = error.detail;
  const rawMessage = error.message || "";

  // No status at all: the request never reached anyone.
  if (!status) {
    if (/timeout|abort/i.test(rawMessage)) {
      return "The server took too long to answer. Check your connection and try again.";
    }
    if (/failed to fetch|network|load failed|offline/i.test(rawMessage)) {
      return "We couldn't reach the server. Check your internet connection and try again.";
    }
    return TECHNICAL_ERROR_RE.test(rawMessage) || !rawMessage ? fallback : rawMessage;
  }

  // Anything 5xx is our fault and our problem to explain. The detail that came
  // with it is a stack trace in a trench coat.
  if (status >= 500) {
    if (status === 502 || status === 503 || status === 504) {
      return "The server is busy or restarting. Please wait a few seconds and try again.";
    }
    return SERVER_FAULT;
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

  // The 4xx family, in the user's terms. Each of these is a situation, not a
  // malfunction, so it gets its own sentence rather than the generic one.
  if (status === 401) return "Your session has ended. Please sign in again.";
  if (status === 403) return "You don't have permission to do that. Ask your clinic owner if you need it.";
  if (status === 404) return "That isn't there any more. It may have been deleted or moved.";
  if (status === 409) return "Somebody else changed this while you had it open. Refresh and try again.";
  if (status === 413) return "That file is too large. Please use a smaller one.";
  if (status === 429) return "That was a lot of requests at once. Please wait a moment and try again.";

  // A deliberate refusal from one of our own handlers, shown as written, unless
  // an exception has been stapled to the end of it.
  if (typeof detail === "string" && detail.trim()) {
    return TECHNICAL_ERROR_RE.test(detail) ? fallback : detail.trim();
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
  patch: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const result = await authenticatedFetch(url, {
      method: 'PATCH',
      body: isFormData ? data : JSON.stringify(data),
      ...options
    });
    return result.data;
  },
  delete: async (url, options = {}) => {
    const result = await authenticatedFetch(url, {
      method: 'DELETE',
      ...options
    });
    return result.data;
  }
};
