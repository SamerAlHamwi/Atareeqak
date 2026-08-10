import { useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import type { User } from '../../types/index';
import { authApi, mapStaffEmployeeToUser, AUTH_KIND_STORAGE_KEY } from '../../features/auth/api/authApi';
import type { AuthKind } from '../../features/auth/api/authApi';
import { AuthContext } from './useAuth';

interface StoredAuth {
  user: User;
  accessToken: string;
  refreshToken: string | null;
  kind: AuthKind;
}

const readStoredAuth = (): StoredAuth | null => {
  const accessToken = localStorage.getItem('access_token');
  const userJson = localStorage.getItem('user');
  if (!accessToken || !userJson) {
    return null;
  }
  try {
    return {
      user: JSON.parse(userJson) as User,
      accessToken,
      refreshToken: localStorage.getItem('refresh_token'),
      kind: (localStorage.getItem(AUTH_KIND_STORAGE_KEY) as AuthKind | null) ?? 'admin',
    };
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Hydrate synchronously from localStorage so there is no loading flash
  const [stored] = useState(readStoredAuth);
  const [user, setUser] = useState<User | null>(stored?.user ?? null);
  const [authKind, setAuthKind] = useState<AuthKind | null>(stored?.kind ?? null);
  const [accessToken, setAccessToken] = useState<string | null>(stored?.accessToken ?? null);
  const [refreshToken, setRefreshToken] = useState<string | null>(stored?.refreshToken ?? null);

  const login = (userData: User, authAccessToken: string, authRefreshToken: string, kind: AuthKind) => {
    setUser(userData);
    setAccessToken(authAccessToken);
    setRefreshToken(authRefreshToken);
    setAuthKind(kind);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('access_token', authAccessToken);
    localStorage.setItem('refresh_token', authRefreshToken);
    localStorage.setItem(AUTH_KIND_STORAGE_KEY, kind);
  };

  const logout = useCallback(() => {
    setUser(null);
    setAccessToken(null);
    setRefreshToken(null);
    setAuthKind(null);
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem(AUTH_KIND_STORAGE_KEY);
  }, []);

  // Re-fetch the profile on mount so the role is always current (e.g. the
  // system admin changed it since the last login). Runs for BOTH session kinds:
  // /admin/login and /staff/login both issue staff tokens, so /staff/me is
  // valid either way.
  useEffect(() => {
    if (!stored) {
      return;
    }
    authApi
      .me()
      .then((employee) => {
        const freshUser = mapStaffEmployeeToUser(employee);
        setUser(freshUser);
        localStorage.setItem('user', JSON.stringify(freshUser));
      })
      .catch((error) => {
        // A 401 here is already handled by the axios interceptor (refresh, or
        // logout on a terminal code). A 403/404 means this token can no longer
        // identify an employee, so the cached role is untrustworthy — drop the
        // session rather than rendering UI the server will reject.
        const status = axios.isAxiosError(error) ? error.response?.status : undefined;
        if (status === 403 || status === 404) {
          logout();
        }
      });
  }, [stored, logout]);

  return (
    <AuthContext.Provider
      value={{
        user,
        role: user?.role ?? null,
        authKind,
        accessToken,
        refreshToken,
        login,
        logout,
        isAuthenticated: !!accessToken,
        // Hydration is synchronous now, so auth state is never "loading".
        isLoading: false,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
