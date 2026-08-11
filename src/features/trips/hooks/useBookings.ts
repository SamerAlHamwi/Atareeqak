import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { tripsApi } from '../api/tripsApi';
import type { BookingResponse, BookingFilterValue, BookingStatusValue } from '../api/tripsApi';

export interface Booking {
  id: string;
  rawId: number;
  status: BookingStatusValue;
  seats: number;
  passenger: string;
  passengerEmail: string;
  communicationNumber: string | null;
  driver: string;
  from: string;
  to: string;
  departureTime: string | null;
  rideStatus: string | null;
  totalPrice: number;
  bookedAt: string | null;
}

export type BookingFilter = BookingFilterValue;

export const BOOKING_FILTERS: readonly BookingFilter[] = [
  'all',
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show',
] as const;

/** Backend caps `per_page` at 50; 15 is its default. */
export const BOOKINGS_PER_PAGE_OPTIONS = [10, 15, 25, 50] as const;
export const DEFAULT_BOOKINGS_PER_PAGE = 15;

/**
 * `POST /staff/bookings/{id}/cancel` rejects anything that is not still
 * `pending` or `confirmed` with a 422, so the action is hidden otherwise.
 */
export const isCancellableBooking = (booking: Booking): boolean =>
  booking.status === 'pending' || booking.status === 'confirmed';

const mapBooking = (b: BookingResponse, t: TFunction): Booking => ({
  id: `#BK-${b.id}`,
  rawId: b.id,
  status: b.status,
  seats: b.seats,
  passenger: b.passenger?.name?.trim() || t('common.unknown'),
  passengerEmail: b.passenger?.email || '',
  communicationNumber: b.communication_number ?? null,
  driver: b.ride?.driver?.name?.trim() || t('common.unknown'),
  from: b.ride?.pickup_address || '',
  to: b.ride?.destination_address || '',
  departureTime: b.ride?.departure_time ?? null,
  rideStatus: b.ride?.ride_status ?? null,
  totalPrice: Number(b.total_price ?? 0),
  bookedAt: b.booked_at ?? null,
});

interface UseBookingsReturn {
  bookings: Booking[];
  statusFilter: BookingFilter;
  setStatusFilter: (filter: BookingFilter) => void;
  page: number;
  setPage: (page: number) => void;
  lastPage: number;
  total: number;
  perPage: number;
  setPerPage: (perPage: number) => void;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  cancelBooking: (booking: Booking, reason: string) => Promise<void>;
}

export const useBookings = (): UseBookingsReturn => {
  const { t } = useTranslation();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [statusFilter, setStatusFilterState] = useState<BookingFilter>('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPageState] = useState<number>(DEFAULT_BOOKINGS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Same rule as trips: filtering is server-side, so the current page is stale.
  const setStatusFilter = useCallback((next: BookingFilter) => {
    setStatusFilterState(next);
    setPage(1);
  }, []);

  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPage(1);
  }, []);

  const fetchBookings = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripsApi.getBookings({
        page,
        status: statusFilter,
        per_page: perPage,
      });
      const mapped = (response.data || []).map((b) => mapBooking(b, t));
      setBookings(mapped);
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? mapped.length);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load bookings');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [page, statusFilter, perPage, t]);

  useFetchEffect(fetchBookings);

  const cancelBooking = useCallback(
    async (booking: Booking, reason: string) => {
      await tripsApi.cancelBooking(booking.rawId, reason);
      setBookings((prev) =>
        prev.map((entry) =>
          entry.rawId === booking.rawId ? { ...entry, status: 'cancelled' as const } : entry
        )
      );
      // Cancelling frees seats on the ride and may drop the row out of the
      // active filter — refetch instead of trusting the local patch.
      void fetchBookings();
    },
    [fetchBookings]
  );

  return {
    bookings,
    statusFilter,
    setStatusFilter,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    setPerPage,
    isLoading,
    error,
    refetch: fetchBookings,
    cancelBooking,
  };
};
