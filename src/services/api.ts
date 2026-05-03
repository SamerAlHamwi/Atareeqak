import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost/4th_year_project/public/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

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

    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = localStorage.getItem('refresh_token');
        if (refreshToken) {
          const response = await api.post('/admin/refresh', {
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
      } catch (refreshError) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    if (error.response && error.response.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
