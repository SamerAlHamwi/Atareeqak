import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { usersApi } from '../api/usersApi';

interface FullProfileResponse {
  user: {
    id: number;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gender: string | null;
    joined_at: string;
    profile_photo: string | null;
    verification_status: string | null;
    is_verified_passenger: boolean;
    account_status: string;
    ban: { reason: string; type: string; expires_at: string | null; banned_at: string | null } | null;
  };
  stats: {
    total_rides: number;
    total_spending: number;
    avg_rating: number;
    wallet_balance: number;
  };
  monthly_trips: { month: string; month_key: string; trips: number; total_cost: number }[];
  recent_trips: {
    id: number;
    date: string;
    route_from: string | null;
    route_to: string | null;
    driver: string | null;
    seats: number;
    price_per_seat: number;
    total_cost: number;
    status: string;
    departure_time: string | null;
  }[];
  complaints: {
    id: number;
    type: string;
    type_label: string;
    status: string;
    created_at: string;
    assigned_to: string | null;
  }[];
  wallet_charges: {
    id: number;
    transaction_id: string;
    amount: number;
    previous_balance: number;
    new_balance: number;
    status: string;
    notes: string | null;
    date: string;
    processed_by_name: string | null;
  }[];
}

export interface PassengerProfile {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  joinedLabel: string;
  photo: string;
  isVerified: boolean;
  isBanned: boolean;
  banReason: string | null;
  stats: {
    totalRides: number;
    totalSpending: number;
    avgRating: number;
    walletBalance: number;
  };
  monthlyTrips: { month: string; trips: number }[];
  recentTrips: {
    id: number;
    date: string;
    from: string;
    to: string;
    driver: string;
    cost: number;
    status: string;
  }[];
  complaints: {
    id: string;
    date: string;
    category: string;
    status: string;
  }[];
  walletCharges: {
    id: number;
    date: string;
    transactionId: string;
    amount: number;
    processedBy: string;
    status: string;
  }[];
}

const mapProfile = (data: FullProfileResponse, t: TFunction): PassengerProfile => ({
  id: data.user.id,
  name: data.user.full_name || t('common.unknown'),
  email: data.user.email || '',
  phone: data.user.phone || '',
  address: data.user.address || '',
  joinedLabel: data.user.joined_at ? new Date(data.user.joined_at).toLocaleDateString('ar-SY') : '',
  photo: data.user.profile_photo || `https://i.pravatar.cc/200?u=${data.user.id}`,
  isVerified: data.user.is_verified_passenger,
  isBanned: Boolean(data.user.ban),
  banReason: data.user.ban?.reason ?? null,
  stats: {
    totalRides: data.stats?.total_rides ?? 0,
    totalSpending: data.stats?.total_spending ?? 0,
    avgRating: data.stats?.avg_rating ?? 0,
    walletBalance: data.stats?.wallet_balance ?? 0,
  },
  monthlyTrips: (data.monthly_trips || []).map((m) => ({ month: m.month, trips: m.trips })),
  recentTrips: (data.recent_trips || []).map((tr) => ({
    id: tr.id,
    date: tr.date || '',
    from: tr.route_from || '',
    to: tr.route_to || '',
    driver: tr.driver || t('common.unknown'),
    cost: tr.total_cost,
    status: tr.status,
  })),
  complaints: (data.complaints || []).map((c) => ({
    id: `#CMP-${c.id}`,
    date: c.created_at,
    category: c.type_label || c.type,
    status: c.status,
  })),
  walletCharges: (data.wallet_charges || []).map((w) => ({
    id: w.id,
    date: w.date,
    transactionId: w.transaction_id,
    amount: w.amount,
    processedBy: w.processed_by_name || '--',
    status: w.status,
  })),
});

interface UseUserDetailsReturn {
  profile: PassengerProfile | null;
  isLoading: boolean;
  error: Error | null;
  chargeWallet: (amount: number, notes?: string) => Promise<void>;
  banUser: (reason: string) => Promise<void>;
  unbanUser: () => Promise<void>;
  refresh: () => Promise<void>;
}

export const useUserDetails = (userId: string | undefined): UseUserDetailsReturn => {
  const { t } = useTranslation();
  const [profile, setProfile] = useState<PassengerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await usersApi.getPassengerFullProfile(userId);
      setProfile(mapProfile(response.data, t));
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load profile');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [userId, t]);

  useFetchEffect(fetchProfile);

  const chargeWallet = useCallback(
    async (amount: number, notes?: string) => {
      if (!userId) return;
      await usersApi.chargePassengerWallet(userId, amount, notes);
      await fetchProfile();
    },
    [userId, fetchProfile]
  );

  const banUser = useCallback(
    async (reason: string) => {
      if (!userId) return;
      await usersApi.banUser(userId, { reason, type: 'permanent' });
      setProfile((prev) => (prev ? { ...prev, isBanned: true, banReason: reason } : prev));
    },
    [userId]
  );

  const unbanUser = useCallback(async () => {
    if (!userId) return;
    await usersApi.unbanUser(userId);
    setProfile((prev) => (prev ? { ...prev, isBanned: false, banReason: null } : prev));
  }, [userId]);

  return { profile, isLoading, error, chargeWallet, banUser, unbanUser, refresh: fetchProfile };
};
