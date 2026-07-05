import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { driversApi } from '../api/driversApi';
import type {
  DriverRowResponse,
  DriverStatsResponse,
  DriverActivityResponse,
  VerificationEfficiencyResponse,
} from '../api/driversApi';
import { usersApi } from '../../users/api/usersApi';
import type { BanRequest } from '../../users/api/usersApi';

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
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  lastPage: number;
  total: number;
  perPage: number;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  banDriver: (driver: Driver, ban: BanRequest) => Promise<void>;
  unbanDriver: (driver: Driver) => Promise<void>;
}

const mapDriver = (d: DriverRowResponse, t: TFunction): Driver => ({
  id: String(d.id),
  name: d.full_name || t('common.unknown'),
  displayId: d.driver_ref,
  phone: d.phone || '',
  vehicle: d.vehicle || t('common.unknown'),
  status: d.status,
  rating: d.avg_rating,
  avatar: d.profile_photo || `https://i.pravatar.cc/100?u=${d.id}`,
});

export const useDrivers = (): UseDriversReturn => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [stats, setStats] = useState<DriverStatsResponse | null>(null);
  const [activity, setActivity] = useState<DriverActivityResponse[]>([]);
  const [efficiency, setEfficiency] = useState<VerificationEfficiencyResponse | null>(null);
  const [statusFilter, setStatusFilter] = useState<DriverStatusFilter>('all');
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
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

  // Debounce the search input so we don't hit the API on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await driversApi.getAllDrivers({
        filter: statusFilter,
        page,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setDrivers((response.data || []).map((d) => mapDriver(d, t)));
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
  }, [statusFilter, page, debouncedSearch, t]);

  useFetchEffect(fetchDashboard);
  useFetchEffect(fetchDrivers);

  const handleSetStatusFilter = useCallback((filter: DriverStatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  // The list is already server-filtered; kept for instant client-side response
  const visibleDrivers = useMemo(() => {
    if (statusFilter === 'all') {
      return drivers;
    }
    return drivers.filter((driver) => driver.status === statusFilter);
  }, [drivers, statusFilter]);

  const banDriver = useCallback(async (driver: Driver, ban: BanRequest) => {
    await usersApi.banUser(driver.id, ban);
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
    search,
    setSearch,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    isLoading,
    error,
    refetch: fetchDrivers,
    banDriver,
    unbanDriver,
  };
};
