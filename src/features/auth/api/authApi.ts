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
   * then falls back to /admin/login (system_admin and sycash only).
   *
   * Both endpoints issue StaffJwtService tokens, so the resulting session is
   * identical either way. The role is NOT taken from the login response —
   * /admin/login returns an `admin` object with no role field, and assuming a
   * role there mislabels sycash accounts as system_admin. It comes from
   * /staff/me instead, which is the only authoritative source.
   */
  login: async (credentials: LoginCredentials): Promise<UnifiedLoginResult> => {
    const resolveRole = async (fallbackUser: User, tokens: TokenPair): Promise<User> => {
      try {
        // The token is not in localStorage yet (AuthContext.login stores it
        // after this resolves), so pass it explicitly.
        return mapEmployeeToUser(await authApi.me(tokens.access_token));
      } catch {
        // Never block a valid login on this: fall back to whatever the login
        // response gave us. AuthContext re-resolves the role on next mount.
        return fallbackUser;
      }
    };

    try {
      const response = await api.post<StaffAuthResponse>(ENDPOINTS.STAFF.LOGIN, {
        identifier: credentials.email,
        password: credentials.password,
      });
      return {
        // /staff/login already returns the employee (role included) — no extra call.
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
        user: await resolveRole(response.data.admin, response.data.tokens),
        tokens: response.data.tokens,
        kind: 'admin',
      };
    }
  },

  /**
   * Current session profile — the authoritative source of the employee's role.
   * Works for both login kinds: /admin/login and /staff/login both issue
   * StaffJwtService tokens, which `staff` middleware accepts.
   *
   * @param token Use this bearer token instead of the stored one. Needed during
   *              login, before the new token has been committed to localStorage.
   */
  me: async (token?: string): Promise<StaffEmployee> => {
    const response = await api.get<{ status: string; employee: StaffEmployee }>(
      ENDPOINTS.STAFF.ME,
      token ? { headers: { Authorization: `Bearer ${token}` } } : undefined
    );
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
