import { useState, useEffect, useMemo, useCallback } from 'react';
import { driversApi } from '../api/driversApi';
import type {
  DriverRowResponse,
  DriverStatsResponse,
  DriverActivityResponse,
  VerificationEfficiencyResponse,
} from '../api/driversApi';
import { usersApi } from '../../users/api/usersApi';

export interface Driver {
  id: string;
  name: string;
  displayId: string;
  phone: string;
  vehicle: string;
  status: 'verified' | 'pending' | 'suspended';
  rating: number | null;
  avatar: string;
}

export type DriverStatusFilter = 'all' | Driver['status'];

interface UseDriversReturn {
  drivers: Driver[];
  visibleDrivers: Driver[];
  stats: DriverStatsResponse | null;
  activity: DriverActivityResponse[];
  efficiency: VerificationEfficiencyResponse | null;
  statusFilter: DriverStatusFilter;
  setStatusFilter: (filter: DriverStatusFilter) => void;
  page: number;
  setPage: (page: number) => void;
  lastPage: number;
  total: number;
  perPage: number;
  isLoading: boolean;
  error: Error | null;
  banDriver: (driver: Driver, reason: string) => Promise<void>;
  unbanDriver: (driver: Driver) => Promise<void>;
}

const mapDriver = (d: DriverRowResponse): Driver => ({
  id: String(d.id),
  name: d.full_name || 'غير معروف',
  displayId: d.driver_ref,
  phone: d.phone || '',
  vehicle: d.vehicle || 'غير معروف',
  status: d.status,
  rating: d.avg_rating,
  avatar: d.profile_photo || `https://i.pravatar.cc/100?u=${d.id}`,
});

export const useDrivers = (): UseDriversReturn => {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DriverStatsResponse | null>(null);
  const [activity, setActivity] = useState<DriverActivityResponse[]>([]);
  const [efficiency, setEfficiency] = useState<VerificationEfficiencyResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<DriverStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await driversApi.getDriversDashboard();
      setStats(response.data.stats);
      setActivity(response.data.recent_activity || []);
      setEfficiency(response.data.verification_efficiency || null);
    } catch (err) {
      console.error('Failed to load drivers dashboard', err);
    }
  }, []);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await driversApi.getAllDrivers({ filter: statusFilter, page });
      setDrivers((response.data || []).map(mapDriver));
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? 0);
      setPerPage(response.meta?.per_page ?? 10);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load drivers');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    void fetchDrivers();
  }, [fetchDrivers]);

  const handleSetStatusFilter = useCallback((filter: DriverStatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  // The list is already server-filtered; kept for instant client-side response
  const visibleDrivers = useMemo(() => {
    if (statusFilter === 'all') {
      return drivers;
    }
    return drivers.filter((driver) => driver.status === statusFilter);
  }, [drivers, statusFilter]);

  const banDriver = useCallback(async (driver: Driver, reason: string) => {
    await usersApi.banUser(driver.id, { reason, type: 'permanent' });
    setDrivers((prev) =>
      prev.map((entry) => (entry.id === driver.id ? { ...entry, status: 'suspended' } : entry))
    );
  }, []);

  const unbanDriver = useCallback(async (driver: Driver) => {
    await usersApi.unbanUser(driver.id);
    setDrivers((prev) =>
      prev.map((entry) => (entry.id === driver.id ? { ...entry, status: 'verified' } : entry))
    );
  }, []);

  return {
    drivers,
    visibleDrivers,
    stats,
    activity,
    efficiency,
    statusFilter,
    setStatusFilter: handleSetStatusFilter,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    isLoading,
    error,
    banDriver,
    unbanDriver,
  };
};
