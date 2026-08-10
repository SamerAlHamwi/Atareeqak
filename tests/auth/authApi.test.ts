import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { authApi } from '../../src/features/auth/api/authApi';
import { API_BASE, server } from '../testServer';

const TOKENS = {
  access_token: 'access-1',
  refresh_token: 'refresh-1',
  token_type: 'bearer',
  expires_in: 3600,
};

const employee = (role: string, roleLabel: string) => ({
  id: 7,
  username: 'samer',
  email: 'samer@syride.com',
  full_name: 'Samer Admin',
  role,
  role_label: roleLabel,
  is_active: true,
  last_login_at: null,
  created_at: '2026-01-01T00:00:00Z',
});

/** /staff/login rejects non-staff credentials, forcing the /admin/login path. */
const staffLoginRejects = () =>
  http.post(`${API_BASE}/staff/login`, () =>
    HttpResponse.json({ status: 'error', message: 'Invalid credentials' }, { status: 401 })
  );

describe('authApi.login', () => {
  it('uses the role from /staff/login without an extra round-trip', async () => {
    let meCalls = 0;
    server.use(
      http.post(`${API_BASE}/staff/login`, () =>
        HttpResponse.json({ status: 'success', employee: employee('admin', 'Administrator'), tokens: TOKENS })
      ),
      http.get(`${API_BASE}/staff/me`, () => {
        meCalls += 1;
        return HttpResponse.json({ status: 'success', employee: employee('admin', 'Administrator') });
      })
    );

    const result = await authApi.login({ email: 'samer', password: 'secret' });

    expect(result.kind).toBe('staff');
    expect(result.user.role).toBe('admin');
    expect(meCalls).toBe(0);
  });

  it('resolves the role from /staff/me on the /admin/login path', async () => {
    // Regression: the old code hardcoded role: 'system_admin' here, which
    // mislabelled sycash accounts. /admin/login admits system_admin AND sycash,
    // and its `admin` payload carries no role field at all.
    server.use(
      staffLoginRejects(),
      http.post(`${API_BASE}/admin/login`, () =>
        HttpResponse.json({
          status: 'success',
          message: 'Login successful',
          admin: { id: 7, name: 'Samer Admin', email: 'samer@syride.com' },
          tokens: TOKENS,
        })
      ),
      http.get(`${API_BASE}/staff/me`, ({ request }) => {
        // Called with the freshly issued token, before it reaches localStorage
        expect(request.headers.get('Authorization')).toBe(`Bearer ${TOKENS.access_token}`);
        return HttpResponse.json({
          status: 'success',
          employee: employee('sycash', 'Financial Administrator (SyCash)'),
        });
      })
    );

    const result = await authApi.login({ email: 'samer', password: 'secret' });

    expect(result.kind).toBe('admin');
    expect(result.user.role).toBe('sycash');
    expect(result.user.roleLabel).toBe('Financial Administrator (SyCash)');
  });

  it('still logs in when /staff/me is unavailable', async () => {
    // A failed role lookup must not block an otherwise valid login;
    // AuthContext re-resolves the role on next mount.
    server.use(
      staffLoginRejects(),
      http.post(`${API_BASE}/admin/login`, () =>
        HttpResponse.json({
          status: 'success',
          message: 'Login successful',
          admin: { id: 7, name: 'Samer Admin', email: 'samer@syride.com' },
          tokens: TOKENS,
        })
      ),
      http.get(`${API_BASE}/staff/me`, () => HttpResponse.json({}, { status: 500 }))
    );

    const result = await authApi.login({ email: 'samer', password: 'secret' });

    expect(result.kind).toBe('admin');
    expect(result.user.name).toBe('Samer Admin');
  });

  it('does not fall back to /admin/login on a network error', async () => {
    // Only rejected credentials (401/422) should trigger the fallback —
    // otherwise a backend outage silently retries against a second endpoint.
    let adminLoginCalled = false;
    server.use(
      http.post(`${API_BASE}/staff/login`, () => HttpResponse.error()),
      http.post(`${API_BASE}/admin/login`, () => {
        adminLoginCalled = true;
        return HttpResponse.json({});
      })
    );

    await expect(authApi.login({ email: 'samer', password: 'secret' })).rejects.toBeDefined();
    expect(adminLoginCalled).toBe(false);
  });
});
