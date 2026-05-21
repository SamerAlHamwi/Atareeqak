import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';
import type { AuthResponse } from '../../../types/index';
import type { LoginCredentials } from '../types';

export const authApi = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, {
      email: credentials.email,
      password: credentials.password,
    });
    return response.data;
  },

  refresh: async (refreshToken: string): Promise<AuthResponse> => {
    const response = await api.post<AuthResponse>(ENDPOINTS.AUTH.REFRESH, {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: async (): Promise<void> => {
    try {
      await api.post(ENDPOINTS.AUTH.LOGOUT);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
    }
  },
};
