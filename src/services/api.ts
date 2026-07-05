import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost/4th_year_project/public/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Auth endpoints must not trigger the 401 refresh/redirect logic below —
// a wrong password would otherwise cause a full redirect to /login.
const AUTH_URLS = ['/admin/login', '/staff/login', '/admin/refresh', '/staff/refresh'];

const isAuthUrl = (url?: string): boolean => !!url && AUTH_URLS.some((path) => url.includes(path));

// The refresh endpoint must match the login flow that issued the tokens:
// staff tokens are rejected by /admin/refresh and vice versa.
const refreshEndpoint = (): string =>
  localStorage.getItem('auth_kind') === 'staff' ? '/staff/refresh' : '/admin/refresh';

const clearSession = (): void => {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');
  localStorage.removeItem('auth_kind');
};

// Request interceptor
api.interceptors.request.use(
  (config) => {
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

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthUrl(originalRequest.url)
    ) {
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

        clearSession();
        window.location.href = '/login';
      } catch (refreshError) {
        clearSession();
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
