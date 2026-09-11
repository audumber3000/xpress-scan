/**
 * API utility — authenticated fetch wrapper for Dental Labs.
 *
 * Adapted from MolarPlus api.js — same pattern, pointing to Dental Labs backend.
 */

const API_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8001";
const API_BASE_PATH = "/api/v1";

const getAuthHeaders = (isFormData = false) => {
  const token = localStorage.getItem("auth_token");
  const headers = {
    Authorization: token ? `Bearer ${token}` : "",
  };
  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }
  return headers;
};

export const authenticatedFetch = async (url, options = {}) => {
  const isFormData = options.body instanceof FormData;
  const headers = { ...getAuthHeaders(isFormData), ...options.headers };

  let fullUrl = `${API_URL}${API_BASE_PATH}${url}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    Object.entries(options.params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        searchParams.append(key, value);
      }
    });
    const qs = searchParams.toString();
    if (qs) fullUrl += `?${qs}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(fullUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
      if (typeof errorData.detail === "string") {
        errorMessage = errorData.detail;
      } else if (Array.isArray(errorData.detail)) {
        errorMessage = errorData.detail.map(err => {
          const field = err.loc && err.loc.length > 1 ? err.loc[err.loc.length - 1] : "";
          return field ? `${field}: ${err.msg}` : err.msg;
        }).join(", ");
      } else if (errorData.message) {
        errorMessage = errorData.message;
      }

      if (response.status === 401) {
        localStorage.removeItem("auth_token");
        localStorage.removeItem("user");
        const err = new Error(errorMessage || "Authentication failed");
        err.status = 401;
        err.isAuthError = true;
        throw err;
      }
      
      const apiError = new Error(errorMessage);
      apiError.status = response.status;
      apiError.detail = errorData.detail;
      throw apiError;
    }

    try {
      const data = await response.json();
      return { data, response };
    } catch {
      return { data: response, response };
    }
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === "AbortError") {
      throw new Error("Request timeout — server took too long to respond", { cause: error });
    }
    throw error;
  }
};

/**
 * Fetch a binary resource (e.g. a PDF) as a Blob, with the JWT auth header.
 * Use this instead of opening the URL in a tab — the raw URL is unauthenticated.
 */
export const apiDownload = async (url) => {
  const token = localStorage.getItem("auth_token");
  const response = await fetch(`${API_URL}${API_BASE_PATH}${url}`, {
    headers: { Authorization: token ? `Bearer ${token}` : "" },
  });
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const err = new Error(errorData.detail || `HTTP ${response.status}`);
    err.status = response.status;
    throw err;
  }
  return response.blob();
};

export const api = {
  get: async (url, options = {}) => {
    const result = await authenticatedFetch(url, options);
    return result.data;
  },
  post: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const result = await authenticatedFetch(url, {
      method: "POST",
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    });
    return result.data;
  },
  put: async (url, data, options = {}) => {
    const isFormData = data instanceof FormData;
    const result = await authenticatedFetch(url, {
      method: "PUT",
      body: isFormData ? data : JSON.stringify(data),
      ...options,
    });
    return result.data;
  },
  patch: async (url, data, options = {}) => {
    const result = await authenticatedFetch(url, {
      method: "PATCH",
      body: JSON.stringify(data),
      ...options,
    });
    return result.data;
  },
  delete: async (url) => {
    const result = await authenticatedFetch(url, { method: "DELETE" });
    return result.data;
  },
};
