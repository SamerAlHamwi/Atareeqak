import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTrips, isCancellableTrip } from '../../src/features/trips/hooks/useTrips';
import type { Trip } from '../../src/features/trips/hooks/useTrips';
import type { TripResponse } from '../../src/features/trips/api/tripsApi';
import { API_BASE, server } from '../testServer';

const trip = (overrides: Partial<TripResponse> = {}): TripResponse => ({
  id: 1,
  trip_ref: '#TR-1001',
  driver: { id: 5, name: 'Omar Khaled', profile_photo: null },
  route: { from: 'Damascus', to: 'Homs' },
  timing: { departure_time: '2024-05-01T07:30:00Z', label: 'Today', time_only: '07:30' },
  passengers: { booked: 2, total: 4, label: '2/4' },
  status: 'active',
  payment_method: 'cash',
  vehicle_type: 'sedan',
  price_per_seat: 100,
  ...overrides,
});

const counts = (overrides: Partial<Record<string, number>> = {}) => ({
  all: 71,
  scheduled: 33,
  active: 15,
  completed: 14,
  cancelled: 5,
  awaiting: 4,
  ...overrides,
});

const listResponse = (
  data: TripResponse[],
  meta: Partial<{ current_page: number; last_page: number; per_page: number; total: number; filter: string }> = {}
) => ({
  status: 'success',
  data,
  meta: {
    current_page: 1,
    last_page: 5,
    per_page: 15,
    total: 71,
    filter: 'all',
    ...meta,
  },
  counts: counts(),
});

/** Records every /admin/trips query the hook issues. */
const captureRequests = (responder: () => unknown = () => listResponse([trip()]))  => {
  const requests: URL[] = [];
  server.use(
    http.get(`${API_BASE}/admin/trips`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(responder());
    })
  );
  return requests;
};

describe('useTrips', () => {
  it('maps trips and keeps "awaiting" as its own status', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () =>
        HttpResponse.json(
          listResponse([trip(), trip({ id: 2, trip_ref: '#TR-1002', status: 'awaiting' })])
        )
      )
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.trips).toHaveLength(2));

    expect(result.current.trips[0]).toMatchObject({
      id: '#TR-1001',
      rawId: 1,
      driver: 'Omar Khaled',
      from: 'Damascus',
      to: 'Homs',
      status: 'active',
    });
    // Previously remapped to "scheduled", which hid a real backend filter value.
    expect(result.current.trips[1].status).toBe('awaiting');
    expect(result.current.selectedTrip?.id).toBe('#TR-1001');
  });

  it('exposes meta and server counts rather than page-local lengths', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () => HttpResponse.json(listResponse([trip()])))
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.trips).toHaveLength(1));

    expect(result.current.lastPage).toBe(5);
    expect(result.current.total).toBe(71);
    expect(result.current.counts).toEqual(counts());
    // One row on this page, but the badge must read the real total.
    expect(result.current.counts?.all).not.toBe(result.current.trips.length);
  });

  it('requests page 1 on mount and page=2 after setPage(2)', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].searchParams.get('page')).toBe('1');

    act(() => result.current.setPage(2));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].searchParams.get('page')).toBe('2');
  });

  it('sends the filter to the server and resets the page to 1', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].searchParams.get('page')).toBe('3');

    act(() => result.current.setActiveFilter('cancelled'));

    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].searchParams.get('filter')).toBe('cancelled');
    // Page 3 of "all" is meaningless inside "cancelled".
    expect(requests[2].searchParams.get('page')).toBe('1');
    expect(result.current.page).toBe(1);
  });

  it('sends per_page and resets the page when it changes', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].searchParams.get('per_page')).toBe('15');

    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests).toHaveLength(2));

    act(() => result.current.setPerPage(50));

    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].searchParams.get('per_page')).toBe('50');
    expect(requests[2].searchParams.get('page')).toBe('1');
  });

  it('does not filter client-side — it renders exactly what the server returned', async () => {
    // The server answers a "completed" filter with completed rows only; the hook
    // must not re-filter (that would empty the table on a mixed page).
    server.use(
      http.get(`${API_BASE}/admin/trips`, () =>
        HttpResponse.json(
          listResponse([
            trip({ id: 2, trip_ref: '#TR-1002', status: 'completed' }),
            trip({ id: 3, trip_ref: '#TR-1003', status: 'cancelled' }),
          ])
        )
      )
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.trips).toHaveLength(2));

    act(() => result.current.setActiveFilter('completed'));
    await waitFor(() => expect(result.current.activeFilter).toBe('completed'));
    await waitFor(() => expect(result.current.trips).toHaveLength(2));
  });

  it('refetches after a cancellation so counts and paging stay honest', async () => {
    const requests = captureRequests();
    let cancelBody: unknown = null;
    server.use(
      http.post(`${API_BASE}/staff/trips/:id/cancel`, async ({ request }) => {
        cancelBody = await request.json();
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.trips).toHaveLength(1));
    const before = requests.length;

    await act(async () => {
      await result.current.cancelTrip(result.current.trips[0], 'passenger requested a refund');
    });

    expect(cancelBody).toEqual({ reason: 'passenger requested a refund' });
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
  });

  it('exposes an error state when the API returns 500', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.trips).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session, not a network failure', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    // Not the generic error path — the page renders NoPermissionPanel off
    // `isForbidden`, not ErrorBanner off `error`.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});

describe('isCancellableTrip', () => {
  const withStatus = (status: Trip['status']): Trip => ({
    id: '#TR-1',
    rawId: 1,
    driver: 'D',
    driverInitial: 'D',
    from: 'A',
    to: 'B',
    timing: 'today',
    timeDetail: '07:30',
    passengers: '1/4',
    status,
    color: 'primary',
  });

  // POST /staff/trips/{id}/cancel accepts active | full | awaiting_confirmation.
  it.each(['active', 'scheduled', 'awaiting'] as const)('allows %s', (status) => {
    expect(isCancellableTrip(withStatus(status))).toBe(true);
  });

  it.each(['completed', 'cancelled'] as const)('blocks %s (backend would 422)', (status) => {
    expect(isCancellableTrip(withStatus(status))).toBe(false);
  });
});
