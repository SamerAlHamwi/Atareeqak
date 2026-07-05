import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { tripsApi } from '../api/tripsApi';
import type { TripResponse } from '../api/tripsApi';

export interface Trip {
  id: string;
  rawId: number | string;
  driver: string;
  driverInitial: string;
  from: string;
  to: string;
  timing: string;
  timeDetail: string;
  passengers: string;
  status: 'active' | 'scheduled' | 'completed' | 'cancelled';
  color: string;
}

export type TripFilter = Trip['status'] | 'all';

interface UseTripsReturn {
  trips: Trip[];
  visibleTrips: Trip[];
  activeFilter: TripFilter;
  setActiveFilter: (filter: TripFilter) => void;
  selectedTripId: string;
  setSelectedTripId: (id: string) => void;
  selectedTrip: Trip | null;
  isLoading: boolean;
  error: Error | null;
  cancelTrip: (trip: Trip, reason: string) => Promise<void>;
  addDraftTrip: (trip: Trip) => void;
}

export const useTrips = (): UseTripsReturn => {
  const { t } = useTranslation();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [activeFilter, setActiveFilter] = useState<TripFilter>('all');
  const [selectedTripId, setSelectedTripId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchTrips = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await tripsApi.getAllTrips(1, activeFilter);
      const data = response.data || [];
      const formattedTrips: Trip[] = data.map((trip: TripResponse) => ({
        id: trip.trip_ref,
        rawId: trip.id,
        driver: trip.driver?.name || t('common.unknown'),
        driverInitial: trip.driver?.name
          ? trip.driver.name.split(' ').map((n) => n[0]).join('.')
          : '?',
        from: trip.route?.from || '',
        to: trip.route?.to || '',
        timing: trip.timing?.label?.toLowerCase() || 'today',
        timeDetail: trip.timing?.time_only || '',
        passengers: trip.passengers?.label || '0/4',
        status: (trip.status === 'awaiting' ? 'scheduled' : trip.status) as Trip['status'],
        color: trip.status === 'active' ? 'secondary' : 'primary',
      }));

      setTrips(formattedTrips);

      if (formattedTrips.length > 0 && !selectedTripId) {
        setSelectedTripId(formattedTrips[0].id);
      }
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to fetch trips');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilter, selectedTripId, t]);

  useFetchEffect(fetchTrips);

  const visibleTrips = useMemo(() => {
    if (activeFilter === 'all') {
      return trips;
    }
    return trips.filter((trip) => trip.status === activeFilter);
  }, [activeFilter, trips]);

  const selectedTrip = useMemo(
    () => trips.find((trip) => trip.id === selectedTripId) ?? (trips.length > 0 ? trips[0] : null),
    [selectedTripId, trips]
  );

  const cancelTrip = useCallback(async (trip: Trip, reason: string) => {
    await tripsApi.cancelTrip(trip.rawId, reason);
    setTrips((prev) =>
      prev.map((entry) => (entry.id === trip.id ? { ...entry, status: 'cancelled' } : entry))
    );
  }, []);

  const addDraftTrip = useCallback((trip: Trip) => {
    setTrips((prev) => [trip, ...prev]);
  }, []);

  return {
    trips,
    visibleTrips,
    activeFilter,
    setActiveFilter,
    selectedTripId,
    setSelectedTripId,
    selectedTrip,
    isLoading,
    error,
    cancelTrip,
    addDraftTrip,
  };
};
