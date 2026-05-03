import api from '../../../services/api';
import type { AuthResponse } from '../../../types/index';
import type { LoginCredentials, RefreshTokenRequest } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/admin/login', {
      email: credentials.email,
      password: credentials.password,
    });
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>('/admin/refresh', {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post('/admin/logout');
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },
};
