import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { tripsApi } from '../api/tripsApi';
import type { LiveTripResponse, LatLng } from '../api/tripsApi';

export interface LiveTripPassenger {
  id: number | null;
  name: string;
  seats: number;
}

export interface LiveTrip {
  id: number;
  tripRef: string;
  driverName: string;
  driverPhone: string | null;
  from: string;
  to: string;
  pickupCoords: LatLng | null;
  destinationCoords: LatLng | null;
  /** Route path as [lat, lng] pairs, ready for Leaflet */
  path: [number, number][];
  etaMinutes: number | null;
  minutesElapsed: number;
  passengers: LiveTripPassenger[];
  passengerCount: number;
  distanceKm: number | null;
  vehicleType: string | null;
}

const REFRESH_INTERVAL_MS = 30_000;

const toPath = (geometry: LiveTripResponse['route']['geometry']): [number, number][] => {
  if (!geometry || !Array.isArray(geometry.coordinates)) {
    return [];
  }
  // GeoJSON stores [lng, lat]; Leaflet wants [lat, lng]
  return geometry.coordinates
    .filter((pair) => Array.isArray(pair) && pair.length >= 2)
    .map(([lng, lat]) => [lat, lng] as [number, number]);
};

const mapLiveTrip = (trip: LiveTripResponse, t: TFunction): LiveTrip => ({
  id: trip.id,
  tripRef: trip.trip_ref,
  driverName: trip.driver?.name || t('common.unknown'),
  driverPhone: trip.driver?.communication_number ?? null,
  from: trip.route?.from || '',
  to: trip.route?.to || '',
  pickupCoords: trip.route?.pickup_coords ?? null,
  destinationCoords: trip.route?.destination_coords ?? null,
  path: toPath(trip.route?.geometry ?? null),
  etaMinutes: trip.timing?.eta_minutes ?? null,
  minutesElapsed: trip.timing?.minutes_elapsed ?? 0,
  passengers: trip.passengers || [],
  passengerCount: trip.passenger_count ?? 0,
  distanceKm: trip.distance_km,
  vehicleType: trip.vehicle_type,
});

interface UseLiveTripsReturn {
  liveTrips: LiveTrip[];
  isLoading: boolean;
  error: Error | null;
  /** When the currently-displayed data was fetched; null before the first success. */
  updatedAt: Date | null;
  refreshIntervalMs: number;
  refresh: () => Promise<void>;
}

export const useLiveTrips = (): UseLiveTripsReturn => {
  const { t } = useTranslation();
  const [liveTrips, setLiveTrips] = useState<LiveTrip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const hasLoadedRef = useRef(false);

  const fetchLiveTrips = useCallback(async (isStale: IsStale) => {
    if (!hasLoadedRef.current) {
      setIsLoading(true);
    }
    try {
      const trips = await tripsApi.getLiveTrips();
      if (isStale()) {
        return;
      }
      setLiveTrips((trips || []).map((trip) => mapLiveTrip(trip, t)));
      setError(null);
      setUpdatedAt(new Date());
      hasLoadedRef.current = true;
    } catch (err) {
      if (isStale()) {
        return;
      }
      const fetchError = err instanceof Error ? err : new Error('Failed to load live trips');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [t]);

  // Polls every 30s; useFetchEffect pauses the interval while the tab is hidden.
  useFetchEffect(fetchLiveTrips, REFRESH_INTERVAL_MS);
  // Not part of the effect's sequence — a manual refresh should always commit.
  const refresh = useCallback(() => fetchLiveTrips(() => false), [fetchLiveTrips]);

  return {
    liveTrips,
    isLoading,
    error,
    updatedAt,
    refreshIntervalMs: REFRESH_INTERVAL_MS,
    refresh,
  };
};
