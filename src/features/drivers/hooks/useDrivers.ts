import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { driversApi } from '../api/driversApi';
import type {
  DriverRowResponse,
  DriverStatsResponse,
  DriverActivityResponse,
  DriverStatus,
  DriverFilterValue,
  DriversListResponse,
  EfficiencyPeriod,
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
  status: DriverStatus;
  isBanned: boolean;
  rating: number | null;
  /** Server photo URL, or null — the initials `<Avatar>` covers the gap. */
  photo: string | null;
}

export type DriverStatusFilter = DriverFilterValue;

/** The four values `GET /admin/drivers?filter=` validates against. */
export const DRIVER_FILTERS: readonly DriverStatusFilter[] = [
  'all',
  'verified',
  'pending',
  'suspended',
] as const;

/**
 * Backend validates `per_page` as 1–50; its own default is 10, which the list
 * used to ride on implicitly by never sending the param at all.
 *
 * 5 is included deliberately: driver counts are far smaller than trip counts
 * (ten in the current seed), so without a sub-10 option the pager is unreachable
 * on a realistic dataset.
 */
export const DRIVERS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;
export const DEFAULT_DRIVERS_PER_PAGE = 10;

export const EFFICIENCY_PERIODS: readonly EfficiencyPeriod[] = ['day', 'week', 'month'] as const;

/**
 * Change in efficiency against the previous window.
 *
 * Derived from `comparison.delta` (percentage points) rather than rendering
 * `comparison.text`, which the backend builds in English only ("Same as last
 * week") and which would appear untranslated in the Arabic UI — Arabic being
 * the default language here.
 */
export interface EfficiencyDelta {
  /** Absolute size of the change, in percentage points. */
  points: number;
  direction: 'up' | 'down' | 'flat';
}

export const efficiencyDeltaOf = (
  efficiency: VerificationEfficiencyResponse | null
): EfficiencyDelta | null => {
  const delta = efficiency?.comparison?.delta;
  if (typeof delta !== 'number') {
    return null;
  }
  return {
    points: Math.abs(delta),
    direction: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat',
  };
};

export const isBannedDriver = (driver: Driver): boolean => driver.isBanned;

interface UseDriversReturn {
  drivers: Driver[];
  stats: DriverStatsResponse | null;
  activity: DriverActivityResponse[];
  efficiency: VerificationEfficiencyResponse | null;
  efficiencyDelta: EfficiencyDelta | null;
  efficiencyPeriod: EfficiencyPeriod;
  setEfficiencyPeriod: (period: EfficiencyPeriod) => Promise<void>;
  isEfficiencyLoading: boolean;
  statusFilter: DriverStatusFilter;
  setStatusFilter: (filter: DriverStatusFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  page: number;
  setPage: (page: number) => void;
  perPage: number;
  setPerPage: (perPage: number) => void;
  lastPage: number;
  total: number;
  isLoading: boolean;
  error: string | null;
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  isForbidden: boolean;
  counts: DriversListResponse['counts'] | null;
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
  isBanned: d.is_banned,
  rating: d.avg_rating,
  photo: d.profile_photo,
});

export const useDrivers = (): UseDriversReturn => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DriverRowResponse[]>([]);
  const [counts, setCounts] = useState<DriversListResponse['counts'] | null>(null);
  const [stats, setStats] = useState<DriverStatsResponse | null>(null);
  const [activity, setActivity] = useState<DriverActivityResponse[]>([]);
  const [efficiency, setEfficiency] = useState<VerificationEfficiencyResponse | null>(null);
  const [efficiencyPeriod, setEfficiencyPeriodState] = useState<EfficiencyPeriod>('week');
  const [isEfficiencyLoading, setIsEfficiencyLoading] = useState(false);
  const [statusFilter, setStatusFilterState] = useState<DriverStatusFilter>('all');
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPageState] = useState<number>(DEFAULT_DRIVERS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  const [isForbidden, setIsForbidden] = useState(false);

  const fetchDashboard = useCallback(async (isStale: IsStale) => {
    try {
      const response = await driversApi.getDriversDashboard();
      if (isStale()) {
        return;
      }
      setStats(response.data.stats);
      setActivity(response.data.recent_activity || []);
      setEfficiency(response.data.verification_efficiency || null);
      // The BFF always reports the week; keep the selector honest about it.
      setEfficiencyPeriodState(response.data.verification_efficiency?.period ?? 'week');
    } catch (err) {
      console.error('Failed to load drivers dashboard', err);
    }
  }, []);

  // Debounce the search input so we don't hit the API on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchDrivers = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await driversApi.getAllDrivers({
        filter: statusFilter,
        page,
        per_page: perPage,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      if (isStale()) {
        return;
      }
      setRows(response.data || []);
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? 0);
      setCounts(response.counts ?? null);
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsForbidden(true);
        return;
      }
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [statusFilter, page, perPage, debouncedSearch, t]);

  const drivers = useMemo(() => rows.map((row) => mapDriver(row, t)), [rows, t]);

  useFetchEffect(fetchDashboard);
  useFetchEffect(fetchDrivers);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchDrivers(() => false), [fetchDrivers]);

  /**
   * Changing the period refetches only this widget. The BFF payload is
   * server-cached and always week-scoped, so a different window needs the
   * dedicated endpoint — same shape as the Dashboard growth selector.
   */
  const setEfficiencyPeriod = useCallback(async (next: EfficiencyPeriod) => {
    setEfficiencyPeriodState(next);
    setIsEfficiencyLoading(true);
    try {
      const response = await driversApi.getVerificationEfficiency(next);
      setEfficiency(response.data);
    } catch (err) {
      console.error('Failed to load verification efficiency', err);
    } finally {
      setIsEfficiencyLoading(false);
    }
  }, []);

  const handleSetStatusFilter = useCallback((filter: DriverStatusFilter) => {
    setStatusFilterState(filter);
    setPage(1);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPage(1);
  }, []);

  const banDriver = useCallback(
    async (driver: Driver, ban: BanRequest) => {
      await usersApi.banUser(driver.id, ban);
      void refetch();
    },
    [refetch]
  );

  const unbanDriver = useCallback(
    async (driver: Driver) => {
      await usersApi.unbanUser(driver.id);
      void refetch();
    },
    [refetch]
  );

  return {
    drivers,
    counts,
    stats,
    activity,
    efficiency,
    efficiencyDelta: efficiencyDeltaOf(efficiency),
    efficiencyPeriod,
    setEfficiencyPeriod,
    isEfficiencyLoading,
    statusFilter,
    setStatusFilter: handleSetStatusFilter,
    search,
    setSearch,
    page,
    setPage,
    perPage,
    setPerPage,
    lastPage,
    total,
    isLoading,
    error,
    isForbidden,
    refetch,
    banDriver,
    unbanDriver,
  };
};
