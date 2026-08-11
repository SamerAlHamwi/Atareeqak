import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useBookings, isCancellableBooking } from '../../src/features/trips/hooks/useBookings';
import type { Booking } from '../../src/features/trips/hooks/useBookings';
import type { BookingResponse } from '../../src/features/trips/api/tripsApi';
import { API_BASE, server } from '../testServer';

const booking = (overrides: Partial<BookingResponse> = {}): BookingResponse => ({
  id: 58,
  status: 'confirmed',
  seats: 2,
  communication_number: '+963983337214',
  passenger: { id: 30, name: 'Passenger20 Test', email: 'passenger20@test.com' },
  ride: {
    id: 71,
    pickup_address: 'Latakia',
    destination_address: 'Aleppo',
    departure_time: '2026-08-13T03:33:55+03:00',
    price_per_seat: '7000.00',
    ride_status: 'active',
    driver: { id: 10, name: 'Driver10 Test' },
  },
  total_price: 14000,
  booked_at: '2026-08-11T09:33:55+03:00',
  completed_at: null,
  ...overrides,
});

const listResponse = (
  data: BookingResponse[],
  meta: Partial<{ current_page: number; last_page: number; per_page: number; total: number; filter: string }> = {}
) => ({
  status: 'success',
  data,
  meta: {
    current_page: 1,
    last_page: 4,
    per_page: 15,
    total: 58,
    filter: 'all',
    ...meta,
  },
});

const captureRequests = (responder: () => unknown = () => listResponse([booking()])) => {
  const requests: URL[] = [];
  server.use(
    http.get(`${API_BASE}/staff/bookings`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(responder());
    })
  );
  return requests;
};

describe('useBookings', () => {
  it('maps the booking payload into UI rows', async () => {
    server.use(
      http.get(`${API_BASE}/staff/bookings`, () => HttpResponse.json(listResponse([booking()])))
    );

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));

    expect(result.current.bookings[0]).toMatchObject({
      id: '#BK-58',
      rawId: 58,
      status: 'confirmed',
      seats: 2,
      passenger: 'Passenger20 Test',
      passengerEmail: 'passenger20@test.com',
      driver: 'Driver10 Test',
      from: 'Latakia',
      to: 'Aleppo',
      totalPrice: 14000,
      communicationNumber: '+963983337214',
    });
  });

  it('threads meta into paging state', async () => {
    server.use(
      http.get(`${API_BASE}/staff/bookings`, () => HttpResponse.json(listResponse([booking()])))
    );

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));

    expect(result.current.lastPage).toBe(4);
    expect(result.current.total).toBe(58);
  });

  it('requests page=2 after setPage(2)', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].searchParams.get('page')).toBe('1');
    expect(requests[0].searchParams.get('status')).toBe('all');

    act(() => result.current.setPage(2));

    await waitFor(() => expect(requests).toHaveLength(2));
    expect(requests[1].searchParams.get('page')).toBe('2');
  });

  it('sends the status filter and resets the page to 1', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(requests).toHaveLength(1));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(requests).toHaveLength(2));

    act(() => result.current.setStatusFilter('no_show'));

    await waitFor(() => expect(requests).toHaveLength(3));
    expect(requests[2].searchParams.get('status')).toBe('no_show');
    expect(requests[2].searchParams.get('page')).toBe('1');
    expect(result.current.page).toBe(1);
  });

  it('sends per_page within the backend 1–50 range and resets the page', async () => {
    const requests = captureRequests();

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(requests).toHaveLength(1));
    expect(requests[0].searchParams.get('per_page')).toBe('15');

    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests).toHaveLength(2));

    act(() => result.current.setPerPage(50));
    await waitFor(() => expect(requests).toHaveLength(3));

    expect(requests[2].searchParams.get('per_page')).toBe('50');
    expect(requests[2].searchParams.get('page')).toBe('1');
  });

  it('cancels a booking with the reason and refetches the list', async () => {
    const requests = captureRequests();
    let cancelBody: unknown = null;
    let cancelledId: string | undefined;
    server.use(
      http.post(`${API_BASE}/staff/bookings/:id/cancel`, async ({ request, params }) => {
        cancelledId = params.id as string;
        cancelBody = await request.json();
        return HttpResponse.json({
          status: 'success',
          data: { booking_id: 58, new_status: 'cancelled', seats_restored_to_ride: 2 },
        });
      })
    );

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));
    const before = requests.length;

    await act(async () => {
      await result.current.cancelBooking(
        result.current.bookings[0],
        'passenger asked support to cancel'
      );
    });

    expect(cancelledId).toBe('58');
    expect(cancelBody).toEqual({ reason: 'passenger asked support to cancel' });
    // Cancelling restores seats on the ride, so the list is refetched.
    await waitFor(() => expect(requests.length).toBeGreaterThan(before));
  });

  it('surfaces a cancellation failure to the caller', async () => {
    server.use(
      http.get(`${API_BASE}/staff/bookings`, () => HttpResponse.json(listResponse([booking()]))),
      http.post(`${API_BASE}/staff/bookings/:id/cancel`, () =>
        HttpResponse.json(
          { status: 'error', message: 'Cannot cancel a booking with status: completed.' },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.bookings).toHaveLength(1));

    await expect(
      result.current.cancelBooking(result.current.bookings[0], 'a valid ten char reason')
    ).rejects.toBeTruthy();
  });

  it('exposes an error state when the API returns 500', async () => {
    server.use(
      http.get(`${API_BASE}/staff/bookings`, () =>
        HttpResponse.json({ message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useBookings());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.bookings).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });
});

describe('isCancellableBooking', () => {
  const withStatus = (status: Booking['status']): Booking => ({
    id: '#BK-1',
    rawId: 1,
    status,
    seats: 1,
    passenger: 'P',
    passengerEmail: '',
    communicationNumber: null,
    driver: 'D',
    from: 'A',
    to: 'B',
    departureTime: null,
    rideStatus: null,
    totalPrice: 0,
    bookedAt: null,
  });

  // POST /staff/bookings/{id}/cancel accepts pending | confirmed only.
  it.each(['pending', 'confirmed'] as const)('allows %s', (status) => {
    expect(isCancellableBooking(withStatus(status))).toBe(true);
  });

  it.each(['cancelled', 'completed', 'no_show'] as const)(
    'blocks %s (backend would 422)',
    (status) => {
      expect(isCancellableBooking(withStatus(status))).toBe(false);
    }
  );
});
