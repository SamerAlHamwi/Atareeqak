import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { driversApi } from '../api/driversApi';
import type {
  DriverRowResponse,
  DriverStatsResponse,
  DriverActivityResponse,
  DriverStatus,
  DriverFilterValue,
  EfficiencyPeriod,
  VerificationEfficiencyResponse,
} from '../api/driversApi';
import { usersApi } from '../../users/api/usersApi';
import type { BanRequest, UserStatusResponse } from '../../users/api/usersApi';

export interface Driver {
  id: string;
  name: string;
  displayId: string;
  phone: string;
  vehicle: string;
  status: DriverStatus;
  rating: number | null;
  /** Server photo URL, or null — the initials `<Avatar>` covers the gap. */
  photo: string | null;
  /**
   * Ban state, present only for rows this session has acted on. `GET
   * /admin/drivers` carries no ban field at all (BUG-6), so for every other row
   * this is null — meaning "unknown", not "not banned".
   */
  ban: UserStatusResponse | null;
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

/**
 * `POST /admin/users/{id}/ban` 422s with "This user is already banned" when the
 * account is already at status -1, and `unban` 422s when it is not. Only rows
 * whose real status we know can be resolved; for the rest the list offers ban,
 * which is correct for the overwhelming majority and surfaces the backend's own
 * message otherwise.
 */
export const isBannedDriver = (driver: Driver): boolean => driver.ban?.ban != null;

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
  refetch: () => Promise<void>;
  banDriver: (driver: Driver, ban: BanRequest) => Promise<void>;
  unbanDriver: (driver: Driver) => Promise<void>;
}

const mapDriver = (
  d: DriverRowResponse,
  t: TFunction,
  ban: UserStatusResponse | null
): Driver => ({
  id: String(d.id),
  name: d.full_name || t('common.unknown'),
  displayId: d.driver_ref,
  phone: d.phone || '',
  vehicle: d.vehicle || t('common.unknown'),
  status: d.status,
  rating: d.avg_rating,
  photo: d.profile_photo,
  ban,
});

export const useDrivers = (): UseDriversReturn => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<DriverRowResponse[]>([]);
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
  /** id → authoritative status, from whatever ban/unban calls this session made. */
  const [banStatuses, setBanStatuses] = useState<Record<string, UserStatusResponse>>({});

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await driversApi.getDriversDashboard();
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

  const fetchDrivers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await driversApi.getAllDrivers({
        filter: statusFilter,
        page,
        per_page: perPage,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setRows(response.data || []);
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, page, perPage, debouncedSearch, t]);

  /**
   * Known ban state is merged at render rather than inside the fetch, so a
   * refetch triggered right after a ban cannot race a stale closure and drop
   * the status the mutation just returned.
   */
  const drivers = useMemo(
    () => rows.map((row) => mapDriver(row, t, banStatuses[String(row.id)] ?? null)),
    [rows, t, banStatuses]
  );

  useFetchEffect(fetchDashboard);
  useFetchEffect(fetchDrivers);

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

  /**
   * The row status returned by `GET /admin/drivers` does not reflect bans
   * (BUG-6), so nothing is optimistically patched onto it — that would be a
   * figure the server disagrees with on the very next fetch. Instead the
   * authoritative status the mutation itself returns is stored, and the list is
   * refetched so every other column stays server-truthful.
   */
  const applyStatus = useCallback((id: string, status: UserStatusResponse) => {
    setBanStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const banDriver = useCallback(
    async (driver: Driver, ban: BanRequest) => {
      const response = await usersApi.banUser(driver.id, ban);
      applyStatus(driver.id, response.data);
      void fetchDrivers();
    },
    [applyStatus, fetchDrivers]
  );

  const unbanDriver = useCallback(
    async (driver: Driver) => {
      const response = await usersApi.unbanUser(driver.id);
      applyStatus(driver.id, response.data);
      void fetchDrivers();
    },
    [applyStatus, fetchDrivers]
  );

  return {
    drivers,
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
    refetch: fetchDrivers,
    banDriver,
    unbanDriver,
  };
};
