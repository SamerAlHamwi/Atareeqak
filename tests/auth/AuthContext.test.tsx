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

  it('logout() calls POST /staff/logout for a staff session, with the access token explicit', async () => {
    // Phase 12 Trap 3: the sidebar button used to only clear localStorage —
    // StaffJwtService::revokeAllTokens() never ran, so a copied token kept
    // working after "logout" for up to its full 1h TTL. This asserts the
    // fix actually reaches the server, on the endpoint `authKind` picks.
    seedSession('staff');
    let loggedOutCalls = 0;
    let authHeader: string | null = null;
    server.use(
      http.post(`${API_BASE}/staff/logout`, ({ request }) => {
        loggedOutCalls += 1;
        authHeader = request.headers.get('Authorization');
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logout());

    await waitFor(() => expect(loggedOutCalls).toBe(1));
    // Not localStorage (already cleared by the same synchronous call) — the
    // token has to be captured explicitly, or the request interceptor's
    // microtask reads it after logout() has already removed it and the
    // logout call itself goes out unauthenticated.
    expect(authHeader).toBe('Bearer token-123');
  });

  it('logout() calls POST /admin/logout for an admin session', async () => {
    seedSession('admin');
    let loggedOutCalls = 0;
    server.use(
      http.post(`${API_BASE}/admin/logout`, () => {
        loggedOutCalls += 1;
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    act(() => result.current.logout());

    await waitFor(() => expect(loggedOutCalls).toBe(1));
  });

  it('logout() clears the local session immediately even though the API call is not awaited', () => {
    // A user on a dead network must still be able to log out of the browser.
    // No handler is registered for /staff/logout here — testServer.ts has no
    // baseline handlers (Phase 7) — so the request fails; local state must
    // already be gone by the time `logout()` returns, not after that promise settles.
    seedSession('staff');
    const { result } = renderHook(() => useAuth(), { wrapper });

    act(() => result.current.logout());

    expect(result.current.isAuthenticated).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
  });

  it('refreshes the profile for admin sessions too', async () => {
    // Regression: this used to be skipped unless auth_kind === 'staff'. Both
    // login flows issue StaffJwtService tokens, so /staff/me is valid for both
    // and an admin session would otherwise keep a stale role forever.
    seedSession('admin');
    server.use(
      http.get(`${API_BASE}/staff/me`, () =>
        HttpResponse.json({
          status: 'success',
          employee: {
            id: 1,
            username: 'samer',
            email: 'samer@atareeqak.com',
            full_name: 'Samer',
            role: 'sycash',
            role_label: 'Financial Administrator (SyCash)',
            is_active: true,
            last_login_at: null,
          },
        })
      )
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.role).toBe('sycash'));
    expect(JSON.parse(localStorage.getItem('user') ?? '{}').role).toBe('sycash');
  });

  it('drops the session when /staff/me rejects the token', async () => {
    // A 403/404 means this token can no longer identify an employee, so the
    // cached role is untrustworthy — better to log out than render UI the
    // server will reject on every request.
    seedSession('staff');
    server.use(
      http.get(`${API_BASE}/staff/me`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.isAuthenticated).toBe(false));
    expect(localStorage.getItem('access_token')).toBeNull();
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
