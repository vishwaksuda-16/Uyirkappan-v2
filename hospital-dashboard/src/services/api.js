import axios from 'axios';

/**
 * Centralized Axios API Client
 * Primary Source: Section 17 & Section 24
 */

const API_BASE_URL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL) ||
  'http://localhost:4000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// Attach JWT token automatically to authenticated requests
apiClient.interceptors.request.use(
  (config) => {
    try {
      const token = localStorage.getItem('uyirkappan_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch {
      // Storage access blocked or unavailable
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor with structured error formatting
apiClient.interceptors.response.use(
  (response) => {
    return response.data;
  },
  (error) => {
    let message = 'An unexpected emergency system error occurred.';
    let isOffline = false;

    if (!error.response) {
      isOffline = true;
      message = 'Backend API server unreachable. Operating in local continuity mode.';
    } else {
      const status = error.response.status;
      const data = error.response.data;

      if (status === 400) {
        message = data?.message || 'Invalid input: The request parameters or data provided are invalid.';
      } else if (status === 401) {
        message = data?.message || 'Session expired or invalid credentials. Please log in.';
        try {
          localStorage.removeItem('uyirkappan_token');
          localStorage.removeItem('uyirkappan_user');
        } catch {
          // ignore
        }
      } else if (status === 403) {
        message = data?.message || 'Access Forbidden: Insufficient role permissions or unauthorized hospital access.';
      } else if (status === 404) {
        message = data?.message || 'The requested emergency or hospital resource was not found.';
      } else if (status >= 500) {
        message = 'Emergency backend service error. The operations team has been alerted.';
      } else if (data?.message) {
        message = data.message;
      }
    }

    return Promise.reject({
      status: error.response?.status,
      message,
      isOffline,
      originalError: error,
    });
  }
);

export default apiClient;
