import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useDriverDetails } from '../../src/features/drivers/hooks/useDriverDetails';
import type { DriverDashboardDetailResponse } from '../../src/features/drivers/api/driversApi';
import type { UserStatusResponse } from '../../src/features/users/api/usersApi';
import { API_BASE, server } from '../testServer';

const detail = (
  overrides: Partial<DriverDashboardDetailResponse> = {}
): DriverDashboardDetailResponse => ({
  id: 10,
  driver_ref: '#DR-10',
  full_name: 'Driver10 Test',
  email: 'driver10@test.com',
  phone: '+963983337214',
  gender: 'M',
  address: 'حمص',
  joined_at: '2026-08-11T09:33:36+03:00',
  status: 'verified',
  is_verified: true,
  verification_status: 'approved',
  profile_photo: null,
  rating: { average: 0, total_ratings: 0 },
  stats: {
    total_rides: 5,
    completed_rides: 0,
    cancelled_rides: 0,
    cancel_rate: 0,
    total_earnings: 0,
  },
  vehicle: { type: 'suv', color: 'silver', seats: 4, photo_url: null },
  documents: [{ type: 'face_id', file_url: 'http://localhost/face.jpg' }],
  recent_rides: [],
  favorite_destination: null,
  ...overrides,
});

const activeStatus = (): UserStatusResponse => ({
  user_id: 10,
  name: 'Driver10 Test',
  email: 'driver10@test.com',
  account_status: 'active',
  status_code: 1,
  ban: null,
});

const bannedStatus = (
  type: 'permanent' | 'temporary' = 'temporary',
  expiresAt: string | null = '2026-08-20T00:00:00+03:00'
): UserStatusResponse => ({
  user_id: 10,
  name: 'Driver10 Test',
  email: 'driver10@test.com',
  account_status: 'banned',
  status_code: -1,
  ban: {
    reason: 'repeatedly cancelling confirmed rides',
    type,
    banned_at: '2026-08-11T15:47:52+03:00',
    expires_at: expiresAt,
    is_expired: false,
    banned_by: null,
  },
});

/** Serves the status endpoint from a mutable cell, and records each read. */
const statusEndpoint = (initial: UserStatusResponse) => {
  const state = { current: initial, reads: 0 };
  server.use(
    http.get(`${API_BASE}/admin/users/10/status`, () => {
      state.reads += 1;
      return HttpResponse.json({ status: 'success', data: state.current });
    })
  );
  return state;
};

beforeEach(() => {
  server.use(
    http.get(`${API_BASE}/admin/drivers/10/dashboard`, () =>
      HttpResponse.json({ status: 'success', data: detail() })
    )
  );
});

describe('useDriverDetails', () => {
  it('loads the driver and its account status on mount', async () => {
    statusEndpoint(activeStatus());
    const { result } = renderHook(() => useDriverDetails('10'));

    await waitFor(() => expect(result.current.driver).not.toBeNull());
    expect(result.current.driver?.ref).toBe('#DR-10');
    // no pravatar fallback — a null photo stays null for <Avatar> to handle
    expect(result.current.driver?.photo).toBeNull();
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status?.ban).toBeNull();
  });

  it('sends type and expires_at for a temporary ban', async () => {
    statusEndpoint(activeStatus());
    let banBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/users/10/ban`, async ({ request }) => {
        banBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus() });
      })
    );

    const { result } = renderHook(() => useDriverDetails('10'));
    await waitFor(() => expect(result.current.driver).not.toBeNull());

    await act(async () => {
      await result.current.banDriver({
        reason: 'repeatedly cancelling confirmed rides',
        type: 'temporary',
        expires_at: '2026-08-20 00:00:00',
      });
    });

    // This used to be hardcoded to `{reason, type: 'permanent'}`.
    expect(banBody).toEqual({
      reason: 'repeatedly cancelling confirmed rides',
      type: 'temporary',
      expires_at: '2026-08-20 00:00:00',
    });
  });

  it('sends a permanent ban without an expiry', async () => {
    statusEndpoint(activeStatus());
    let banBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/users/10/ban`, async ({ request }) => {
        banBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: bannedStatus('permanent', null),
        });
      })
    );

    const { result } = renderHook(() => useDriverDetails('10'));
    await waitFor(() => expect(result.current.driver).not.toBeNull());

    await act(async () => {
      await result.current.banDriver({
        reason: 'violating platform policies repeatedly',
        type: 'permanent',
      });
    });

    expect(banBody).toEqual({
      reason: 'violating platform policies repeatedly',
      type: 'permanent',
    });
    expect(Object.keys(banBody ?? {})).not.toContain('expires_at');
  });

  it('refetches GET /admin/users/{id}/status after a ban and exposes the new state', async () => {
    const status = statusEndpoint(activeStatus());
    server.use(
      http.post(`${API_BASE}/admin/users/10/ban`, () => {
        // the server's own cache is busted by the ban, so the next read is fresh
        status.current = bannedStatus();
        return HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus() });
      })
    );

    const { result } = renderHook(() => useDriverDetails('10'));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    const readsAfterMount = status.reads;
    expect(result.current.status?.ban).toBeNull();

    await act(async () => {
      await result.current.banDriver({
        reason: 'repeatedly cancelling confirmed rides',
        type: 'temporary',
        expires_at: '2026-08-20 00:00:00',
      });
    });

    expect(status.reads).toBeGreaterThan(readsAfterMount);
    await waitFor(() => expect(result.current.status?.ban).not.toBeNull());
    expect(result.current.status?.account_status).toBe('banned');
    expect(result.current.status?.ban?.type).toBe('temporary');
    expect(result.current.status?.ban?.expires_at).toBe('2026-08-20T00:00:00+03:00');
  });

  it('refetches the status after an unban and reflects logged_out, not active', async () => {
    const status = statusEndpoint(bannedStatus());
    const unbanned: UserStatusResponse = {
      ...activeStatus(),
      account_status: 'logged_out',
      status_code: 0,
    };
    server.use(
      http.post(`${API_BASE}/admin/users/10/unban`, () => {
        status.current = unbanned;
        return HttpResponse.json({ status: 'success', message: 'ok', data: unbanned });
      })
    );

    const { result } = renderHook(() => useDriverDetails('10'));
    await waitFor(() => expect(result.current.status?.ban).not.toBeNull());
    const readsBefore = status.reads;

    await act(async () => {
      await result.current.unbanDriver();
    });

    expect(status.reads).toBeGreaterThan(readsBefore);
    await waitFor(() => expect(result.current.status?.ban).toBeNull());
    // AdminBanController::unban writes status 0 — "active" would be wrong here.
    expect(result.current.status?.account_status).toBe('logged_out');
    expect(result.current.status?.status_code).toBe(0);
  });

  it('still renders the driver when the status endpoint fails', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users/10/status`, () =>
        HttpResponse.json({ status: 'error', message: 'User not found.' }, { status: 404 })
      )
    );
    const { result } = renderHook(() => useDriverDetails('10'));

    await waitFor(() => expect(result.current.driver).not.toBeNull());
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('surfaces a driver fetch failure through `error`', async () => {
    statusEndpoint(activeStatus());
    server.use(
      http.get(`${API_BASE}/admin/drivers/10/dashboard`, () =>
        HttpResponse.json({ status: 'error', message: 'Driver not found' }, { status: 404 })
      )
    );
    const { result } = renderHook(() => useDriverDetails('10'));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error).toContain('Driver not found');
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session, not a network failure', async () => {
    statusEndpoint(activeStatus());
    server.use(
      http.get(`${API_BASE}/admin/drivers/10/dashboard`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useDriverDetails('10'));
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    // Not the generic error path — the page renders NoPermissionPanel off
    // `isForbidden`, not ErrorBanner off `error`.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
