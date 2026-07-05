import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { AuthProvider } from '../../src/app/context/AuthContext';
import { useAuth } from '../../src/app/context/useAuth';
import type { User } from '../../src/types/index';
import { API_BASE, server } from '../testServer';

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const storedUser: User = {
  id: 1,
  name: 'Samer',
  email: 'admin@atareeqak.com',
  role: 'system_admin',
  roleLabel: 'System Admin',
};

const seedSession = (kind: 'admin' | 'staff' = 'admin') => {
  localStorage.setItem('access_token', 'token-123');
  localStorage.setItem('refresh_token', 'refresh-123');
  localStorage.setItem('user', JSON.stringify(storedUser));
  localStorage.setItem('auth_kind', kind);
};

describe('AuthContext', () => {
  it('is unauthenticated when nothing is stored', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.role).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('hydrates the session synchronously from localStorage', () => {
    seedSession();

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.name).toBe('Samer');
    expect(result.current.role).toBe('system_admin');
    expect(result.current.accessToken).toBe('token-123');
    expect(result.current.authKind).toBe('admin');
  });

  it('treats corrupted stored user JSON as logged out', () => {
    localStorage.setItem('access_token', 'token-123');
    localStorage.setItem('user', '{not-json');

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  it('login() stores the session and updates state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => {
      result.current.login(storedUser, 'new-access', 'new-refresh', 'staff');
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.role).toBe('system_admin');
    expect(result.current.authKind).toBe('staff');
    expect(localStorage.getItem('access_token')).toBe('new-access');
    expect(localStorage.getItem('refresh_token')).toBe('new-refresh');
    expect(localStorage.getItem('auth_kind')).toBe('staff');
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').name).toBe('Samer');
  });

  it('logout() clears state and localStorage', () => {
    seedSession();
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth_kind')).toBeNull();
  });

  it('refreshes the profile for staff sessions so the role stays current', async () => {
    seedSession('staff');
    server.use(
      http.get(`${API_BASE}/staff/me`, () =>
        HttpResponse.json({
          status: 'success',
          employee: {
            id: 1,
            username: 'samer',
            email: 'samer@atareeqak.com',
            full_name: 'Samer',
            role: 'support_agent',
            role_label: 'Support Agent',
            is_active: true,
            last_login_at: null,
          },
        })
      )
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    // Hydrated role first, then updated from /staff/me
    expect(result.current.role).toBe('system_admin');
    await waitFor(() => expect(result.current.role).toBe('support_agent'));

    expect(JSON.parse(localStorage.getItem('user') ?? '{}').role).toBe('support_agent');
  });
});
