import axios from 'axios';
import { isTerminalAuthError } from './apiError';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth endpoints must not trigger the 401 refresh/redirect logic below —
// a wrong password would otherwise cause a full redirect to /login.
const AUTH_URLS = ['/admin/login', '/staff/login', '/admin/refresh', '/staff/refresh'];

const isAuthUrl = (url?: string): boolean => !!url && AUTH_URLS.some((path) => url.includes(path));

/**
 * Both login flows issue tokens from the backend's StaffJwtService, so the two
 * refresh endpoints are interchangeable today. The split is kept because the
 * routes remain distinct (`AdminDashboardController::refresh` vs
 * `StaffAuthController::refresh`) and could diverge again.
 */
const refreshEndpoint = (): string =>
  localStorage.getItem('auth_kind') === 'staff' ? '/staff/refresh' : '/admin/refresh';

const clearSession = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('auth_kind');
};

/**
 * Ends the session and sends the user back to the login screen.
 * `reason` surfaces as `?reason=` so Login can explain why (e.g. a deactivated
 * account) instead of looking like a random logout.
 */
const endSession = (reason?: string): void => {
  clearSession();
  const query = reason ? `?reason=${encodeURIComponent(reason)}` : '';
  window.location.href = `/login${query}`;
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // An Authorization header set by the caller wins — that is how a freshly
    // issued token can be used before it has been committed to localStorage.
    if (config.headers?.Authorization) {
      return config;
    }
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 403 is a role-gate rejection, not a session problem. Let the page render
    // it inline — redirecting would throw the user out for visiting one page
    // their role cannot see.
    if (error.response?.status === 403) {
      return Promise.reject(error);
    }

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthUrl(originalRequest.url)
    ) {
      // A refresh cannot fix a deleted/deactivated employee or a revoked token
      // family — go straight to logout instead of spending a round-trip.
      if (isTerminalAuthError(error)) {
        endSession(error.response.data?.code);
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await api.post(refreshEndpoint(), {
            refresh_token: refreshToken,
          });

          if (response.data.tokens) {
            localStorage.setItem('access_token', response.data.tokens.access_token);
            if (response.data.tokens.refresh_token) {
              localStorage.setItem('refresh_token', response.data.tokens.refresh_token);
            }
            api.defaults.headers.common['Authorization'] = `Bearer ${response.data.tokens.access_token}`;
            originalRequest.headers['Authorization'] = `Bearer ${response.data.tokens.access_token}`;
            return api(originalRequest);
          }
        }

        endSession();
      } catch (refreshError) {
        endSession();
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
