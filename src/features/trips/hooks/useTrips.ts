import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { isForbiddenError } from '../../../services/apiError';
import { tripsApi } from '../api/tripsApi';
import type { TripResponse, TripsListResponse, TripFilterValue } from '../api/tripsApi';

export interface Trip {
  id: string;
  rawId: number | string;
  driver: string;
  driverId: number | null;
  driverInitial: string;
  from: string;
  to: string;
  timing: string;
  timeDetail: string;
  passengers: string;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled' | 'awaiting';
  color: string;
}

export type TripFilter = TripFilterValue;

export type TripCounts = TripsListResponse['counts'];

/** Backend caps `per_page` at 50; 15 is its default. */
export const TRIPS_PER_PAGE_OPTIONS = [10, 15, 25, 50] as const;
export const DEFAULT_TRIPS_PER_PAGE = 15;

/**
 * `POST /staff/trips/{id}/cancel` only accepts rides whose underlying status is
 * `active`, `full` or `awaiting_confirmation` — anything else 422s. Those map
 * onto exactly these three UI statuses (see AdminTripService::resolveUiStatus).
 */
export const isCancellableTrip = (trip: Trip): boolean =>
  trip.status === 'active' || trip.status === 'scheduled' || trip.status === 'awaiting';

interface UseTripsReturn {
  trips: Trip[];
  counts: TripCounts | null;
  activeFilter: TripFilter;
  setActiveFilter: (filter: TripFilter) => void;
  selectedTripId: string;
  setSelectedTripId: (id: string) => void;
  selectedTrip: Trip | null;
  page: number;
  setPage: (page: number) => void;
  lastPage: number;
  total: number;
  perPage: number;
  setPerPage: (perPage: number) => void;
  isLoading: boolean;
  error: Error | null;
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  isForbidden: boolean;
  refetch: () => Promise<void>;
  cancelTrip: (trip: Trip, reason: string) => Promise<void>;
}

export const useTrips = (): UseTripsReturn => {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [counts, setCounts] = useState<TripCounts | null>(null);
  const [activeFilter, setActiveFilterState] = useState<TripFilter>('all');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPageState] = useState<number>(DEFAULT_TRIPS_PER_PAGE);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);

  // Filtering happens server-side, so a filter change invalidates the current
  // page — page 3 of "all" rarely exists within "cancelled".
  const setActiveFilter = useCallback((next: TripFilter) => {
    setActiveFilterState(next);
    setPage(1);
  }, []);

  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPage(1);
  }, []);

  const fetchTrips = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await tripsApi.getAllTrips({
        page,
        filter: activeFilter,
        per_page: perPage,
      });
      if (isStale()) {
        return;
      }
      const data = response.data || [];
      const formattedTrips: Trip[] = data.map((trip: TripResponse) => ({
        id: trip.trip_ref,
        rawId: trip.id,
        driver: trip.driver?.name || t('common.unknown'),
        driverId: trip.driver?.id ?? null,
        driverInitial: trip.driver?.name
          ? trip.driver.name.split(' ').map((n) => n[0]).join('.')
          : '?',
        from: trip.route?.from || '',
        to: trip.route?.to || '',
        timing: trip.timing?.label?.toLowerCase() || 'today',
        timeDetail: trip.timing?.time_only || '',
        passengers: trip.passengers?.label || '0/4',
        status: trip.status,
        color: trip.status === 'active' ? 'secondary' : 'primary',
      }));

      setTrips(formattedTrips);
      setCounts(response.counts ?? null);
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? formattedTrips.length);

      // Keep the selection pinned to a row that is actually on screen.
      setSelectedTripId((prev) =>
        prev && formattedTrips.some((entry) => entry.id === prev)
          ? prev
          : formattedTrips[0]?.id ?? ''
      );
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsForbidden(true);
        return;
      }
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch trips');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [activeFilter, page, perPage, t]);

  useFetchEffect(fetchTrips);
  // Callers outside the effect (a Retry button, a post-mutation reconcile)
  // are not part of the sequence useFetchEffect tracks — always commit.
  const refetch = useCallback(() => fetchTrips(() => false), [fetchTrips]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? (trips.length > 0 ? trips[0] : null),
    [selectedTripId, trips]
  );

  const cancelTrip = useCallback(async (trip: Trip, reason: string) => {
    await tripsApi.cancelTrip(trip.rawId, reason);
    setTrips((prev) =>
      prev.map((entry) => (entry.id === trip.id ? { ...entry, status: 'cancelled' } : entry))
    );
    // The row may now fall outside the active filter and every badge shifted —
    // reconcile with the server rather than hand-patching `counts`.
    void refetch();
  }, [refetch]);

  return {
    trips,
    counts,
    activeFilter,
    setActiveFilter,
    selectedTripId,
    setSelectedTripId,
    selectedTrip,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    setPerPage,
    isLoading,
    error,
    isForbidden,
    refetch,
    cancelTrip,
  };
};
