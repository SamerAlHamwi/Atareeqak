import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useDashboard } from '../../src/features/dashboard/hooks/useDashboard';
import { API_BASE, server } from '../testServer';

const stats = {
  total_users: 35,
  active_trips: 48,
  completed_trips: 14,
  total_revenue: { raw: 250000, formatted: '250,000.00 SYP' },
  pending_complaints: 2,
  verification_requests: 3,
};

const growthPoint = (month: string, newUsers: number, completed: number) => ({
  month,
  label: `${month} 2026`,
  new_users: newUsers,
  completed_trips: completed,
});

const dashboardResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 'success',
  data: {
    admin_photo: null,
    stats,
    growth_chart: {
      period: 'last_6_months',
      data: [growthPoint('Jul', 10, 8), growthPoint('Aug', 35, 4)],
    },
    city_distribution: [
      { city: 'دمشق', city_en: 'Damascus', count: 3, percentage: 15 },
      { city: 'طرطوس', city_en: 'Tartus', count: 4, percentage: 20 },
    ],
    recent_activities: [
      {
        booking_id: 57,
        user: { name: 'Passenger19 Test', number: 'XXX-XXX-7214' },
        driver: 'Driver9 Test',
        route: 'اللاذقية ← حمص',
        date: { raw: '2026-08-11T09:33:55+03:00', human: 'Today, 09:33' },
        status: 'confirmed',
        value: '18,000.00 SYP',
      },
    ],
    ...overrides,
  },
});

describe('useDashboard', () => {
  it('loads every widget from the single BFF call', async () => {
    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.stats).toMatchObject({ total_users: 35, active_trips: 48 });
    expect(result.current.growth).toHaveLength(2);
    expect(result.current.cityRows).toHaveLength(2);
    expect(result.current.activityRows).toHaveLength(1);
    expect(result.current.lastUpdated).toBeInstanceOf(Date);
  });

  it('computes a percentage delta when the previous month was non-zero', async () => {
    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // new_users 10 → 35 = +250%
    expect(result.current.newUsersDelta).toEqual({ value: 250, unit: 'percent', direction: 'up' });
    // completed_trips 8 → 4 = -50%
    expect(result.current.completedTripsDelta).toEqual({
      value: -50,
      unit: 'percent',
      direction: 'down',
    });
  });

  it('reports an absolute count instead of an infinite percentage from zero', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json(
          dashboardResponse({
            growth_chart: { period: 'last_6_months', data: [growthPoint('Jul', 0, 0), growthPoint('Aug', 35, 7)] },
          })
        )
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // 0 → 35 is not "+3500%"
    expect(result.current.newUsersDelta).toEqual({ value: 35, unit: 'absolute', direction: 'up' });
  });

  it('returns no delta when there is nothing to compare against', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json(
          dashboardResponse({
            growth_chart: { period: 'last_6_months', data: [growthPoint('Aug', 35, 7)] },
          })
        )
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // The UI omits the badge rather than inventing a number
    expect(result.current.newUsersDelta).toBeNull();
  });

  it('scales the chart to the tallest bar across both series', async () => {
    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Regression: heights used to be divided by hardcoded 250 / 850
    expect(result.current.chartMax).toBe(35);
  });

  it('never divides by zero on an empty series', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json(dashboardResponse({ growth_chart: { period: 'last_6_months', data: [] } }))
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.chartMax).toBe(1);
  });

  it('refetches only the growth series when the period changes', async () => {
    let dashboardCalls = 0;
    let growthMonths: string | null = null;
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () => {
        dashboardCalls += 1;
        return HttpResponse.json(dashboardResponse());
      }),
      http.get(`${API_BASE}/admin/dashboard/growth`, ({ request }) => {
        growthMonths = new URL(request.url).searchParams.get('months');
        return HttpResponse.json({
          status: 'success',
          data: { period: 'last_3_months', data: [growthPoint('Aug', 1, 1)] },
        });
      })
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(dashboardCalls).toBe(1);

    await act(() => result.current.setMonths(3));

    expect(growthMonths).toBe('3');
    expect(result.current.months).toBe(3);
    expect(result.current.growth).toHaveLength(1);
    // The heavy BFF call is not repeated
    expect(dashboardCalls).toBe(1);
  });

  it('surfaces the backend message on failure and recovers on retry', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json({ status: 'error', message: 'Failed to load dashboard data' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.error).toBe('Failed to load dashboard data'));

    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));
    await act(() => result.current.refetch());

    expect(result.current.error).toBeNull();
    expect(result.current.stats?.total_users).toBe(35);
  });

  it('builds initials and keeps the masked phone for activity rows', async () => {
    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // recent_activities carries no avatar URL and no user_id
    expect(result.current.activityRows[0]).toMatchObject({
      bookingId: 57,
      userInitials: 'PT',
      userNumber: 'XXX-XXX-7214',
      status: 'confirmed',
    });
    // date.raw is reformatted for the locale rather than using the
    // server's English "Today, 09:33"
    expect(result.current.activityRows[0].dateLabel).not.toBe('Today, 09:33');
  });

  it('localises the English month names the API returns', async () => {
    server.use(http.get(`${API_BASE}/admin/dashboard`, () => HttpResponse.json(dashboardResponse())));

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // API sends month: "Aug", label: "Aug 2026" regardless of UI language
    const august = result.current.chartPoints[1];
    expect(august.newUsers).toBe(35);
    expect(august.completedTrips).toBe(4);
    expect(august.fullLabel).toMatch(/2026/);
    expect(august.monthLabel).toBeTruthy();
  });

  it('falls back to the raw month when the label is not parseable', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json(
          dashboardResponse({
            growth_chart: {
              period: 'last_6_months',
              data: [
                { month: 'Aug', label: '', new_users: 1, completed_trips: 1 },
                { month: 'Sep', label: 'not-a-date', new_users: 2, completed_trips: 2 },
              ],
            },
          })
        )
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.chartPoints[0].monthLabel).toBe('Aug');
    expect(result.current.chartPoints[1].monthLabel).toBe('Sep');
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session, not a network failure', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    // Not the generic error path — the page renders NoPermissionPanel off
    // `isForbidden`, not ErrorBanner off `error`.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('tolerates missing collections in the payload', async () => {
    server.use(
      http.get(`${API_BASE}/admin/dashboard`, () =>
        HttpResponse.json({ status: 'success', data: { stats } })
      )
    );

    const { result } = renderHook(() => useDashboard());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.growth).toEqual([]);
    expect(result.current.cityRows).toEqual([]);
    expect(result.current.activityRows).toEqual([]);
    expect(result.current.error).toBeNull();
  });
});
