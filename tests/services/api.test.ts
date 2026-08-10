import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import api from '../../src/services/api';
import { API_BASE, server } from '../testServer';

describe('api service (axios interceptors)', () => {
  it('attaches the stored access token as a Bearer header', async () => {
    localStorage.setItem('access_token', 'stored-token');
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('Authorization') })
      )
    );

    const response = await api.get('/admin/dashboard');

    expect(response.data.auth).toBe('Bearer stored-token');
  });

  it('refreshes the token on 401 and retries the original request', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('auth_kind', 'admin');

    let refreshCalls = 0;
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, ({ request }) => {
        if (request.headers.get('Authorization') === 'Bearer expired-token') {
          return HttpResponse.json({ message: 'Unauthenticated' }, { status: 401 });
        }
        return HttpResponse.json({ ok: true, auth: request.headers.get('Authorization') });
      }),
      http.post(`${API_BASE}/admin/refresh`, async ({ request }) => {
        refreshCalls += 1;
        const body = (await request.json()) as { refresh_token: string };
        expect(body.refresh_token).toBe('refresh-token');
        return HttpResponse.json({
          tokens: { access_token: 'fresh-token', refresh_token: 'fresh-refresh' },
        });
      })
    );

    const response = await api.get('/admin/dashboard');

    expect(refreshCalls).toBe(1);
    expect(response.data.ok).toBe(true);
    expect(response.data.auth).toBe('Bearer fresh-token');
    expect(localStorage.getItem('access_token')).toBe('fresh-token');
    expect(localStorage.getItem('refresh_token')).toBe('fresh-refresh');
  });

  it('clears the session when the refresh call fails', async () => {
    localStorage.setItem('access_token', 'expired-token');
    localStorage.setItem('refresh_token', 'bad-refresh');
    localStorage.setItem('user', '{"name":"Samer"}');
    localStorage.setItem('auth_kind', 'admin');

    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json({ message: 'Unauthenticated' }, { status: 401 })
      ),
      http.post(`${API_BASE}/admin/refresh`, () =>
        HttpResponse.json({ message: 'Invalid refresh token' }, { status: 401 })
      )
    );

    await expect(api.get('/admin/dashboard')).rejects.toBeDefined();

    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('refresh_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
    expect(localStorage.getItem('auth_kind')).toBeNull();
  });

  it('does not refresh a 401 whose code a refresh cannot fix', async () => {
    // StaffJwtMiddleware returns ACCOUNT_INACTIVE / TOKEN_INVALIDATED /
    // EMPLOYEE_NOT_FOUND for sessions that are dead server-side. Retrying just
    // burns a round-trip before the same 401 comes back.
    localStorage.setItem('access_token', 'valid-but-deactivated');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('user', '{"name":"Samer"}');
    localStorage.setItem('auth_kind', 'staff');

    let refreshCalled = false;
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json(
          { status: 'error', code: 'ACCOUNT_INACTIVE', message: 'This employee account has been deactivated.' },
          { status: 401 }
        )
      ),
      http.post(`${API_BASE}/staff/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(api.get('/admin/dashboard')).rejects.toBeDefined();

    expect(refreshCalled).toBe(false);
    expect(localStorage.getItem('access_token')).toBeNull();
    expect(localStorage.getItem('user')).toBeNull();
  });

  it('propagates a 403 without refreshing or clearing the session', async () => {
    // 403 is a role-gate rejection (e.g. a support agent opening /admin/reports),
    // not a session problem — the page shows it inline instead of logging out.
    localStorage.setItem('access_token', 'valid-token');
    localStorage.setItem('refresh_token', 'refresh-token');
    localStorage.setItem('user', '{"name":"Samer"}');
    localStorage.setItem('auth_kind', 'staff');

    let refreshCalled = false;
    server.use(
      http.get(`${API_BASE}/admin/reports`, () =>
        HttpResponse.json(
          { status: 'error', code: 'FORBIDDEN', message: 'This action requires one of: system_admin' },
          { status: 403 }
        )
      ),
      http.post(`${API_BASE}/staff/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(api.get('/admin/reports')).rejects.toMatchObject({
      response: { status: 403 },
    });

    expect(refreshCalled).toBe(false);
    expect(localStorage.getItem('access_token')).toBe('valid-token');
    expect(localStorage.getItem('user')).toBe('{"name":"Samer"}');
  });

  it('lets an explicit Authorization header win over the stored token', async () => {
    // Needed during login: /staff/me is called with the freshly issued token
    // before AuthContext has committed it to localStorage.
    localStorage.setItem('access_token', 'stale-token');
    server.use(
      http.get(`${API_BASE}/staff/me`, ({ request }) =>
        HttpResponse.json({ auth: request.headers.get('Authorization') })
      )
    );

    const response = await api.get('/staff/me', {
      headers: { Authorization: 'Bearer brand-new-token' },
    });

    expect(response.data.auth).toBe('Bearer brand-new-token');
  });

  it('does not attempt a refresh for failed login requests', async () => {
    let refreshCalled = false;
    server.use(
      http.post(`${API_BASE}/admin/login`, () =>
        HttpResponse.json({ message: 'Invalid credentials' }, { status: 401 })
      ),
      http.post(`${API_BASE}/admin/refresh`, () => {
        refreshCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(api.post('/admin/login', { email: 'x', password: 'y' })).rejects.toBeDefined();

    expect(refreshCalled).toBe(false);
  });
});
