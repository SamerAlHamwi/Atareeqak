import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { driversApi } from '../api/driversApi';
import type { DriverDashboardDetailResponse } from '../api/driversApi';
import { usersApi } from '../../users/api/usersApi';

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
  status: 'verified' | 'pending' | 'suspended';
  isVerified: boolean;
  photo: string;
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
  isLoading: boolean;
  error: Error | null;
  banDriver: (reason: string) => Promise<void>;
  unbanDriver: () => Promise<void>;
}

const mapDriver = (d: DriverDashboardDetailResponse, t: TFunction): DriverDetails => ({
  id: d.id,
  ref: d.driver_ref,
  name: d.full_name || t('common.unknown'),
  email: d.email || '',
  phone: d.phone || '',
  address: d.address || '',
  joinedLabel: d.joined_at ? new Date(d.joined_at).toLocaleDateString('ar-SY') : '',
  status: d.status,
  isVerified: d.is_verified,
  photo: d.profile_photo || `https://i.pravatar.cc/200?u=${d.id}`,
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
    date: ride.date ? new Date(ride.date).toLocaleDateString('ar-SY') : '',
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
  const { t } = useTranslation();
  const [driver, setDriver] = useState<DriverDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDriver = useCallback(async () => {
    if (!driverId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await driversApi.getDriverDashboard(driverId);
      setDriver(mapDriver(response.data, t));
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load driver');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [driverId, t]);

  useFetchEffect(fetchDriver);

  const banDriver = useCallback(
    async (reason: string) => {
      if (!driverId) return;
      await usersApi.banUser(driverId, { reason, type: 'permanent' });
      setDriver((prev) => (prev ? { ...prev, status: 'suspended' } : prev));
    },
    [driverId]
  );

  const unbanDriver = useCallback(async () => {
    if (!driverId) return;
    await usersApi.unbanUser(driverId);
    setDriver((prev) => (prev ? { ...prev, status: 'verified' } : prev));
  }, [driverId]);

  return { driver, isLoading, error, banDriver, unbanDriver };
};
