import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useTrips } from '../../src/features/trips/hooks/useTrips';
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

const listResponse = (data: TripResponse[]) => ({
  status: 'success',
  data,
  meta: { current_page: 1, last_page: 1, per_page: 10, total: data.length, filter: 'all' },
  counts: { all: data.length, scheduled: 0, active: 0, completed: 0, cancelled: 0, awaiting: 0 },
});

describe('useTrips', () => {
  it('maps trips and normalizes "awaiting" to "scheduled"', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () =>
        HttpResponse.json(listResponse([trip(), trip({ id: 2, trip_ref: '#TR-1002', status: 'awaiting' })]))
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
    expect(result.current.trips[1].status).toBe('scheduled');
    // First trip is auto-selected
    expect(result.current.selectedTrip?.id).toBe('#TR-1001');
  });

  it('filters visible trips client-side by the active filter', async () => {
    server.use(
      http.get(`${API_BASE}/admin/trips`, () =>
        HttpResponse.json(
          listResponse([
            trip(),
            trip({ id: 2, trip_ref: '#TR-1002', status: 'completed' }),
            trip({ id: 3, trip_ref: '#TR-1003', status: 'completed' }),
          ])
        )
      )
    );

    const { result } = renderHook(() => useTrips());
    await waitFor(() => expect(result.current.trips).toHaveLength(3));

    act(() => result.current.setActiveFilter('completed'));
    await waitFor(() => expect(result.current.visibleTrips).toHaveLength(2));
    expect(result.current.visibleTrips.every((entry) => entry.status === 'completed')).toBe(true);
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
});
