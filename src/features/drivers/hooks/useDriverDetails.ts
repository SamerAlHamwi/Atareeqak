import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { driversApi } from '../api/driversApi';
import type { DriverDashboardDetailResponse, DriverStatus } from '../api/driversApi';
import { usersApi } from '../../users/api/usersApi';
import type { BanRequest, UserStatusResponse } from '../../users/api/usersApi';

export interface DriverRide {
  id: number;
  date: string;
  from: string;
  to: string;
  price: number;
  status: string;
}

export interface DriverDocument {
  type: string;
  url: string;
}

export interface DriverDetails {
  id: number;
  ref: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  joinedLabel: string;
  status: DriverStatus;
  isVerified: boolean;
  /** Server photo URL, or null — the initials `<Avatar>` covers the gap. */
  photo: string | null;
  ratingAverage: number;
  ratingCount: number;
  totalRides: number;
  completedRides: number;
  cancelledRides: number;
  cancelRate: number;
  totalEarnings: number;
  vehicleType: string;
  vehicleColor: string;
  vehicleSeats: number | null;
  vehiclePhoto: string | null;
  documents: DriverDocument[];
  recentRides: DriverRide[];
  favoriteDestination: { name: string; visitCount: number } | null;
}

interface UseDriverDetailsReturn {
  driver: DriverDetails | null;
  /** Authoritative ban state from `GET /admin/users/{id}/status`. */
  status: UserStatusResponse | null;
  isLoading: boolean;
  error: string | null;
  banDriver: (ban: BanRequest) => Promise<void>;
  unbanDriver: () => Promise<void>;
}

const mapDriver = (
  d: DriverDashboardDetailResponse,
  t: TFunction,
  locale: string
): DriverDetails => ({
  id: d.id,
  ref: d.driver_ref,
  name: d.full_name || t('common.unknown'),
  email: d.email || '',
  phone: d.phone || '',
  address: d.address || '',
  // Was pinned to 'ar-SY' regardless of the active language.
  joinedLabel: d.joined_at ? new Date(d.joined_at).toLocaleDateString(locale) : '',
  status: d.status,
  isVerified: d.is_verified,
  photo: d.profile_photo,
  ratingAverage: d.rating?.average ?? 0,
  ratingCount: d.rating?.total_ratings ?? 0,
  totalRides: d.stats?.total_rides ?? 0,
  completedRides: d.stats?.completed_rides ?? 0,
  cancelledRides: d.stats?.cancelled_rides ?? 0,
  cancelRate: d.stats?.cancel_rate ?? 0,
  totalEarnings: d.stats?.total_earnings ?? 0,
  vehicleType: d.vehicle?.type || t('common.unknown'),
  vehicleColor: d.vehicle?.color || '',
  vehicleSeats: d.vehicle?.seats ?? null,
  vehiclePhoto: d.vehicle?.photo_url ?? null,
  documents: (d.documents || []).map((doc) => ({ type: doc.type, url: doc.file_url })),
  recentRides: (d.recent_rides || []).map((ride) => ({
    id: ride.id,
    date: ride.date ? new Date(ride.date).toLocaleDateString(locale) : '',
    from: ride.source || '',
    to: ride.destination || '',
    price: ride.price_per_seat,
    status: ride.status,
  })),
  favoriteDestination: d.favorite_destination
    ? { name: d.favorite_destination.name, visitCount: d.favorite_destination.visit_count }
    : null,
});

export const useDriverDetails = (driverId: string | undefined): UseDriverDetailsReturn => {
  const { t, i18n } = useTranslation();
  const [driver, setDriver] = useState<DriverDetails | null>(null);
  const [status, setStatus] = useState<UserStatusResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ban state is not part of the driver dashboard payload, so it comes from the
   * dedicated status endpoint. Server-cached for 5 minutes, but ban/unban bust
   * that key, so a refetch right after a mutation is always fresh.
   */
  const fetchStatus = useCallback(async () => {
    if (!driverId) return;
    try {
      const response = await usersApi.getUserStatus(driverId);
      setStatus(response.data);
    } catch (err) {
      // A missing status must not blank out a driver page that otherwise loaded.
      console.error('Failed to load user status', err);
    }
  }, [driverId]);

  const fetchDriver = useCallback(async () => {
    if (!driverId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await driversApi.getDriverDashboard(driverId);
      setDriver(mapDriver(response.data, t, i18n.language));
    } catch (err) {
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      setIsLoading(false);
    }
    await fetchStatus();
  }, [driverId, t, i18n.language, fetchStatus]);

  useFetchEffect(fetchDriver);

  /**
   * The mutation already returns the new status, but the banner is re-read from
   * `GET /admin/users/{id}/status` so what is on screen is what a fresh page
   * load would show — the response body and the cached read agreeing is itself
   * worth verifying.
   */
  const banDriver = useCallback(
    async (ban: BanRequest) => {
      if (!driverId) return;
      const response = await usersApi.banUser(driverId, ban);
      setStatus(response.data);
      await fetchStatus();
    },
    [driverId, fetchStatus]
  );

  const unbanDriver = useCallback(async () => {
    if (!driverId) return;
    const response = await usersApi.unbanUser(driverId);
    setStatus(response.data);
    await fetchStatus();
  }, [driverId, fetchStatus]);

  return { driver, status, isLoading, error, banDriver, unbanDriver };
};
