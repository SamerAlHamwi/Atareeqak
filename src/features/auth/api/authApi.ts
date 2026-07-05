import axios from 'axios';
import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';
import type { AuthResponse, StaffAuthResponse, StaffEmployee, TokenPair, User } from '../../../types/index';
import type { LoginCredentials } from '../types';

/**
 * Which login flow issued the current session's tokens.
 * Drives the refresh endpoint used by the axios interceptor (services/api.ts).
 */
export type AuthKind = 'staff' | 'admin';

export const AUTH_KIND_STORAGE_KEY = 'auth_kind';

export interface UnifiedLoginResult {
  user: User;
  tokens: TokenPair;
  kind: AuthKind;
}

const mapEmployeeToUser = (employee: StaffEmployee): User => ({
  id: employee.id,
  name: employee.full_name || employee.username,
  email: employee.email,
  username: employee.username,
  role: employee.role,
  roleLabel: employee.role_label,
});

export const authApi = {
  /**
   * Unified login: tries /staff/login first (works for every employee role),
   * then falls back to the legacy config-admin /admin/login. The middleware
   * treats legacy admin tokens as system_admin, so that role is assigned here.
   */
  login: async (credentials: LoginCredentials): Promise<UnifiedLoginResult> => {
    try {
      const response = await api.post<StaffAuthResponse>(ENDPOINTS.STAFF.LOGIN, {
        identifier: credentials.email,
        password: credentials.password,
      });
      return {
        user: mapEmployeeToUser(response.data.employee),
        tokens: response.data.tokens,
        kind: 'staff',
      };
    } catch (staffError) {
      // Only fall back on rejected credentials/validation — not on network errors.
      if (
        !axios.isAxiosError(staffError) ||
        !staffError.response ||
        ![401, 422].includes(staffError.response.status)
      ) {
        throw staffError;
      }

      const response = await api.post<AuthResponse>(ENDPOINTS.AUTH.LOGIN, {
        email: credentials.email,
        password: credentials.password,
      });
      if (response.data.status !== 'success' || !response.data.admin || !response.data.tokens) {
        throw staffError;
      }
      return {
        user: { ...response.data.admin, role: 'system_admin' },
        tokens: response.data.tokens,
        kind: 'admin',
      };
    }
  },

  /** Current staff session profile (role included). Staff sessions only. */
  me: async (): Promise<StaffEmployee> => {
    const response = await api.get<{ status: string; employee: StaffEmployee }>(ENDPOINTS.STAFF.ME);
    return response.data.employee;
  },

  refresh: async (refreshToken: string, kind: AuthKind): Promise<AuthResponse> => {
    const endpoint = kind === 'staff' ? ENDPOINTS.STAFF.REFRESH : ENDPOINTS.AUTH.REFRESH;
    const response = await api.post<AuthResponse>(endpoint, {
      refresh_token: refreshToken,
    });
    return response.data;
  },

  logout: async (kind: AuthKind = 'admin'): Promise<void> => {
    try {
      await api.post(kind === 'staff' ? ENDPOINTS.STAFF.LOGOUT : ENDPOINTS.AUTH.LOGOUT);
    } finally {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      localStorage.removeItem(AUTH_KIND_STORAGE_KEY);
    }
  },
};

export const mapStaffEmployeeToUser = mapEmployeeToUser;
