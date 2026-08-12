import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import {
  useDrivers,
  isBannedDriver,
  efficiencyDeltaOf,
  DEFAULT_DRIVERS_PER_PAGE,
} from '../../src/features/drivers/hooks/useDrivers';
import type { Driver } from '../../src/features/drivers/hooks/useDrivers';
import type {
  DriverRowResponse,
  VerificationEfficiencyResponse,
} from '../../src/features/drivers/api/driversApi';
import type { UserStatusResponse } from '../../src/features/users/api/usersApi';
import { API_BASE, server } from '../testServer';

const driverRow = (overrides: Partial<DriverRowResponse> = {}): DriverRowResponse => ({
  id: 10,
  driver_ref: '#DR-10',
  full_name: 'Driver10 Test',
  profile_photo: null,
  phone: '+963983337214',
  vehicle: 'suv | silver',
  status: 'verified',
  avg_rating: null,
  is_verified_driver: true,
  verification_status: 'approved',
  joined_at: '2026-08-11T09:33:36+03:00',
  ...overrides,
});

const efficiency = (
  period: 'day' | 'week' | 'month',
  delta = 0,
  pct = 100
): VerificationEfficiencyResponse => ({
  period,
  period_label: period[0].toUpperCase() + period.slice(1),
  current: {
    start: '2026-08-10 00:00:00',
    end: '2026-08-16 23:59:59',
    total_incoming: 10,
    processed: 10,
    pending: 0,
    efficiency_pct: pct,
  },
  previous: {
    label: `Last ${period}`,
    start: '2026-08-03 00:00:00',
    end: '2026-08-09 23:59:59',
    total_incoming: 0,
    processed: 0,
    efficiency_pct: 100,
  },
  comparison: {
    delta,
    delta_display: `${delta >= 0 ? '+' : ''}${delta}%`,
    trend: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
    text: `Same as last ${period}`,
  },
});

const userStatus = (overrides: Partial<UserStatusResponse> = {}): UserStatusResponse => ({
  user_id: 10,
  name: 'Driver10 Test',
  email: 'driver10@test.com',
  account_status: 'banned',
  status_code: -1,
  ban: {
    reason: 'violating platform policies repeatedly',
    type: 'permanent',
    banned_at: '2026-08-11T15:47:52+03:00',
    expires_at: null,
    is_expired: false,
    banned_by: null,
  },
  ...overrides,
});

const listResponse = (
  data: DriverRowResponse[],
  meta: Partial<{ current_page: number; last_page: number; per_page: number; total: number }> = {}
) => ({
  status: 'success',
  data,
  meta: { current_page: 1, last_page: 4, per_page: 10, total: 10, filter: 'all', ...meta },
});

/** Records every /admin/drivers query the hook issues. */
const captureDriverRequests = (rows: DriverRowResponse[] = [driverRow()]) => {
  const requests: URL[] = [];
  server.use(
    http.get(`${API_BASE}/admin/drivers`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(listResponse(rows));
    })
  );
  return requests;
};

beforeEach(() => {
  // The dashboard BFF fires alongside every list fetch.
  server.use(
    http.get(`${API_BASE}/admin/drivers/dashboard`, () =>
      HttpResponse.json({
        status: 'success',
        data: {
          admin_photo: null,
          stats: {
            total_drivers: 10,
            active_drivers: 10,
            pending_verifications: 0,
            suspended_drivers: 0,
            average_rating: 0,
          },
          recent_activity: [],
          verification_efficiency: efficiency('week'),
        },
      })
    )
  );
});

describe('useDrivers', () => {
  it('sends per_page — the backend default of 10 is no longer relied on implicitly', async () => {
    const requests = captureDriverRequests();
    renderHook(() => useDrivers());

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    expect(requests[0].searchParams.get('per_page')).toBe(String(DEFAULT_DRIVERS_PER_PAGE));
    expect(requests[0].searchParams.get('page')).toBe('1');
    expect(requests[0].searchParams.get('filter')).toBe('all');
  });

  it('threads meta.last_page and meta.total from the payload', async () => {
    server.use(
      http.get(`${API_BASE}/admin/drivers`, () =>
        HttpResponse.json(listResponse([driverRow()], { last_page: 5, total: 10, per_page: 2 }))
      )
    );
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(result.current.drivers).toHaveLength(1));
    expect(result.current.lastPage).toBe(5);
    expect(result.current.total).toBe(10);
  });

  it('requests the next page when setPage is called', async () => {
    const requests = captureDriverRequests();
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    act(() => result.current.setPage(2));

    await waitFor(() =>
      expect(requests.some((u) => u.searchParams.get('page') === '2')).toBe(true)
    );
  });

  it('resets to page 1 when the filter or per_page changes', async () => {
    const requests = captureDriverRequests();
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    act(() => result.current.setPage(3));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '3')).toBe(true));

    act(() => result.current.setStatusFilter('suspended'));
    await waitFor(() => {
      const hit = requests.find((u) => u.searchParams.get('filter') === 'suspended');
      expect(hit?.searchParams.get('page')).toBe('1');
    });

    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '2')).toBe(true));
    act(() => result.current.setPerPage(50));
    await waitFor(() => {
      const hit = requests.find((u) => u.searchParams.get('per_page') === '50');
      expect(hit?.searchParams.get('page')).toBe('1');
    });
  });

  it('does not re-filter the server-filtered page client-side', async () => {
    // A banned driver still reports status "verified" from the list endpoint
    // (BUG-6). The old `visibleDrivers` memo dropped exactly this row when the
    // suspended tab was active, blanking a table the server had filled.
    const requests = captureDriverRequests([driverRow({ id: 10, status: 'verified' })]);
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(result.current.drivers).toHaveLength(1));
    act(() => result.current.setStatusFilter('suspended'));

    await waitFor(() =>
      expect(requests.some((u) => u.searchParams.get('filter') === 'suspended')).toBe(true)
    );
    await waitFor(() => expect(result.current.drivers).toHaveLength(1));
    expect(result.current.drivers[0].status).toBe('verified');
  });

  it('debounces search into the `search` param', async () => {
    const requests = captureDriverRequests();
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(requests.length).toBeGreaterThan(0));
    act(() => result.current.setSearch('Driver10'));

    await waitFor(
      () => expect(requests.some((u) => u.searchParams.get('search') === 'Driver10')).toBe(true),
      { timeout: 3000 }
    );
  });

  describe('verification-efficiency period switch', () => {
    it('refetches only that widget from its own endpoint', async () => {
      const driverRequests = captureDriverRequests();
      const efficiencyRequests: URL[] = [];
      server.use(
        http.get(`${API_BASE}/admin/drivers/verification-efficiency`, ({ request }) => {
          const url = new URL(request.url);
          efficiencyRequests.push(url);
          const period = url.searchParams.get('period') as 'day' | 'week' | 'month';
          return HttpResponse.json({ status: 'success', data: efficiency(period, 12, 84) });
        })
      );

      const { result } = renderHook(() => useDrivers());
      await waitFor(() => expect(result.current.efficiency).not.toBeNull());

      // seeded from the BFF
      expect(result.current.efficiencyPeriod).toBe('week');
      expect(result.current.efficiency?.current.efficiency_pct).toBe(100);
      const driverCallsBefore = driverRequests.length;

      await act(async () => {
        await result.current.setEfficiencyPeriod('month');
      });

      expect(efficiencyRequests).toHaveLength(1);
      expect(efficiencyRequests[0].searchParams.get('period')).toBe('month');
      expect(result.current.efficiencyPeriod).toBe('month');
      expect(result.current.efficiency?.current.efficiency_pct).toBe(84);
      // the widget alone reloaded — the list was left untouched
      expect(driverRequests).toHaveLength(driverCallsBefore);
    });

    it('accepts all three periods the backend validates', async () => {
      captureDriverRequests();
      const periods: string[] = [];
      server.use(
        http.get(`${API_BASE}/admin/drivers/verification-efficiency`, ({ request }) => {
          const period = new URL(request.url).searchParams.get('period') as
            | 'day'
            | 'week'
            | 'month';
          periods.push(period);
          return HttpResponse.json({ status: 'success', data: efficiency(period) });
        })
      );

      const { result } = renderHook(() => useDrivers());
      await waitFor(() => expect(result.current.efficiency).not.toBeNull());

      for (const period of ['day', 'week', 'month'] as const) {
        await act(async () => {
          await result.current.setEfficiencyPeriod(period);
        });
      }
      expect(periods).toEqual(['day', 'week', 'month']);
    });

    it('derives the delta from comparison.delta rather than the English text', async () => {
      expect(efficiencyDeltaOf(efficiency('week', 12))).toEqual({ points: 12, direction: 'up' });
      expect(efficiencyDeltaOf(efficiency('week', -7))).toEqual({ points: 7, direction: 'down' });
      expect(efficiencyDeltaOf(efficiency('week', 0))).toEqual({ points: 0, direction: 'flat' });
      expect(efficiencyDeltaOf(null)).toBeNull();
    });
  });

  describe('ban / unban', () => {
    it('sends a temporary ban with its expiry and stores the returned status', async () => {
      const driverRequests = captureDriverRequests();
      let banBody: Record<string, unknown> | null = null;
      server.use(
        http.post(`${API_BASE}/admin/users/10/ban`, async ({ request }) => {
          banBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json({
            status: 'success',
            message: 'User has been banned successfully.',
            data: userStatus({
              ban: {
                reason: 'repeatedly cancelling confirmed rides',
                type: 'temporary',
                banned_at: '2026-08-11T15:47:52+03:00',
                expires_at: '2026-08-20T00:00:00+03:00',
                is_expired: false,
                banned_by: null,
              },
            }),
          });
        })
      );

      const { result } = renderHook(() => useDrivers());
      await waitFor(() => expect(result.current.drivers).toHaveLength(1));
      const callsBefore = driverRequests.length;

      await act(async () => {
        await result.current.banDriver(result.current.drivers[0], {
          reason: 'repeatedly cancelling confirmed rides',
          type: 'temporary',
          expires_at: '2026-08-20 00:00:00',
        });
      });

      expect(banBody).toEqual({
        reason: 'repeatedly cancelling confirmed rides',
        type: 'temporary',
        expires_at: '2026-08-20 00:00:00',
      });
      // the list is reconciled with the server rather than hand-patched
      await waitFor(() => expect(driverRequests.length).toBeGreaterThan(callsBefore));
      await waitFor(() => expect(isBannedDriver(result.current.drivers[0])).toBe(true));
      expect(result.current.drivers[0].ban?.ban?.type).toBe('temporary');
      expect(result.current.drivers[0].ban?.ban?.expires_at).toBe('2026-08-20T00:00:00+03:00');
    });

    it('keeps the ban chip after the post-ban refetch returns the unchanged row', async () => {
      // Regression guard: the list payload does not reflect bans, so a refetch
      // returns `status: verified`. Merging ban state at render (not inside the
      // fetch) is what stops that refetch from erasing the chip.
      captureDriverRequests([driverRow({ status: 'verified' })]);
      server.use(
        http.post(`${API_BASE}/admin/users/10/ban`, () =>
          HttpResponse.json({ status: 'success', message: 'ok', data: userStatus() })
        )
      );

      const { result } = renderHook(() => useDrivers());
      await waitFor(() => expect(result.current.drivers).toHaveLength(1));

      await act(async () => {
        await result.current.banDriver(result.current.drivers[0], {
          reason: 'violating platform policies repeatedly',
          type: 'permanent',
        });
      });

      await waitFor(() => expect(isBannedDriver(result.current.drivers[0])).toBe(true));
      // still "verified" per the server — the chip is the only ban signal
      expect(result.current.drivers[0].status).toBe('verified');
    });

    it('clears the ban state on unban', async () => {
      captureDriverRequests();
      server.use(
        http.post(`${API_BASE}/admin/users/10/ban`, () =>
          HttpResponse.json({ status: 'success', message: 'ok', data: userStatus() })
        ),
        http.post(`${API_BASE}/admin/users/10/unban`, () =>
          HttpResponse.json({
            status: 'success',
            message: 'ok',
            // an unban lands on logged_out (0), not active (1)
            data: userStatus({ account_status: 'logged_out', status_code: 0, ban: null }),
          })
        )
      );

      const { result } = renderHook(() => useDrivers());
      await waitFor(() => expect(result.current.drivers).toHaveLength(1));

      await act(async () => {
        await result.current.banDriver(result.current.drivers[0], {
          reason: 'violating platform policies repeatedly',
          type: 'permanent',
        });
      });
      await waitFor(() => expect(isBannedDriver(result.current.drivers[0])).toBe(true));

      await act(async () => {
        await result.current.unbanDriver(result.current.drivers[0]);
      });
      await waitFor(() => expect(isBannedDriver(result.current.drivers[0])).toBe(false));
      expect(result.current.drivers[0].ban?.status_code).toBe(0);
    });
  });

  it('surfaces a fetch failure through `error`', async () => {
    server.use(
      http.get(`${API_BASE}/admin/drivers`, () =>
        HttpResponse.json({ status: 'error', message: 'Failed to load drivers' }, { status: 500 })
      )
    );
    const { result } = renderHook(() => useDrivers());

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error).toContain('Failed to load drivers');
  });
});

describe('isBannedDriver', () => {
  const base: Driver = {
    id: '10',
    name: 'Driver10 Test',
    displayId: '#DR-10',
    phone: '',
    vehicle: '',
    status: 'verified',
    rating: null,
    photo: null,
    ban: null,
  };

  it('treats unknown ban state as not-banned so the ban action stays available', () => {
    expect(isBannedDriver(base)).toBe(false);
  });

  it('is true only when the status payload carries a ban block', () => {
    expect(isBannedDriver({ ...base, ban: userStatus() })).toBe(true);
    expect(
      isBannedDriver({
        ...base,
        ban: userStatus({ account_status: 'logged_out', status_code: 0, ban: null }),
      })
    ).toBe(false);
  });
});
