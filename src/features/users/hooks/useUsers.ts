import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { usersApi } from '../api/usersApi';
import type {
  BanRequest,
  UserDateFilterValue,
  UserRowResponse,
  UserRowStatus,
  UserStatusFilterValue,
  UserStatusResponse,
  UsersStatsResponse,
  UserTypeFilterValue,
} from '../api/usersApi';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  type: 'driver' | 'passenger';
  joinDate: string;
  status: UserRowStatus;
  /** Server photo URL, or null — the initials <Avatar> covers the gap. */
  photo: string | null;
  /**
   * Ban state, present only for rows this session has acted on. `GET
   * /admin/users` carries no ban field, and its `status` is wrong in both
   * directions (BUG-6), so for every other row this is null — meaning
   * "unknown", not "not banned".
   */
  ban: UserStatusResponse | null;
}

export type UserTypeFilter = UserTypeFilterValue;
export type UserStatusFilter = UserStatusFilterValue;
export type UserDateFilter = UserDateFilterValue;

/** The three values `GET /admin/users?type=` validates against. */
export const USER_TYPE_FILTERS: readonly UserTypeFilter[] = ['all', 'driver', 'passenger'] as const;

/**
 * The four values `?status=` validates against. Rows can additionally come back
 * as `rejected` or `unverified`, which are not filterable — they only appear
 * under "all".
 */
export const USER_STATUS_FILTERS: readonly UserStatusFilter[] = [
  'all',
  'verified',
  'pending',
  'suspended',
] as const;

/** The five values `?date=` validates against; anything else 422s. */
export const USER_DATE_FILTERS: readonly UserDateFilter[] = [
  'all',
  'last_30_days',
  'last_3_months',
  'last_6_months',
  'last_12_months',
] as const;

/**
 * Backend validates `per_page` as 1–50; its own default is 10, which the list
 * used to ride on implicitly by never sending the param at all.
 */
export const USERS_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;
export const DEFAULT_USERS_PER_PAGE = 10;

/**
 * `POST /admin/users/{id}/ban` 422s with "This user is already banned" when the
 * account is already at status -1, and `unban` 422s when it is not. Only rows
 * whose real status we know can be resolved; for the rest the list offers ban,
 * which is correct for the overwhelming majority and surfaces the backend's own
 * message otherwise.
 */
export const isBannedUser = (user: UserRow): boolean => user.ban?.ban != null;

interface UseUsersReturn {
  users: UserRow[];
  stats: UsersStatsResponse | null;
  /** Always null today (BUG-5) — rendered through the Avatar fallback. */
  adminPhoto: string | null;
  typeFilter: UserTypeFilter;
  setTypeFilter: (filter: UserTypeFilter) => void;
  statusFilter: UserStatusFilter;
  setStatusFilter: (filter: UserStatusFilter) => void;
  dateFilter: UserDateFilter;
  setDateFilter: (filter: UserDateFilter) => void;
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
  banUser: (user: UserRow, ban: BanRequest) => Promise<void>;
  unbanUser: (user: UserRow) => Promise<void>;
}

const mapUser = (
  u: UserRowResponse,
  t: TFunction,
  ban: UserStatusResponse | null
): UserRow => ({
  id: String(u.id),
  name: u.full_name || t('common.unknown'),
  email: u.email || '',
  type: u.type,
  joinDate: u.joined_label || '',
  status: u.status,
  photo: u.profile_photo,
  ban,
});

export const useUsers = (): UseUsersReturn => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserRowResponse[]>([]);
  const [stats, setStats] = useState<UsersStatsResponse | null>(null);
  const [adminPhoto, setAdminPhoto] = useState<string | null>(null);
  const [typeFilter, setTypeFilterState] = useState<UserTypeFilter>('all');
  const [statusFilter, setStatusFilterState] = useState<UserStatusFilter>('all');
  const [dateFilter, setDateFilterState] = useState<UserDateFilter>('all');
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPageState] = useState<number>(DEFAULT_USERS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** id → authoritative status, from whatever ban/unban calls this session made. */
  const [banStatuses, setBanStatuses] = useState<Record<string, UserStatusResponse>>({});

  // Debounce the search input so we don't hit the API on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await usersApi.getAllUsers({
        type: typeFilter,
        status: statusFilter,
        date: dateFilter,
        page,
        per_page: perPage,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setRows(response.data.users || []);
      setStats(response.data.stats ?? null);
      setAdminPhoto(response.data.admin_photo ?? null);
      setLastPage(response.data.meta?.last_page ?? 1);
      setTotal(response.data.meta?.total ?? 0);
    } catch (err) {
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter, dateFilter, page, perPage, debouncedSearch, t]);

  /**
   * The list is **server-filtered**: every row the API returned is rendered.
   * There is deliberately no client-side re-filter here (the `visibleTrips` /
   * `visibleDrivers` bug class removed in Phases 3 and 4) — re-filtering a page
   * on a UI status would blank the table, and with BUG-6 the row status does
   * not even agree with the filter that produced it.
   *
   * Known ban state is merged at render rather than inside the fetch, so a
   * refetch triggered right after a ban cannot race a stale closure and drop
   * the status the mutation just returned.
   */
  const users = useMemo(
    () => rows.map((row) => mapUser(row, t, banStatuses[String(row.id)] ?? null)),
    [rows, t, banStatuses]
  );

  useFetchEffect(fetchUsers);

  const setTypeFilter = useCallback((filter: UserTypeFilter) => {
    setTypeFilterState(filter);
    setPage(1);
  }, []);

  const setStatusFilter = useCallback((filter: UserStatusFilter) => {
    setStatusFilterState(filter);
    setPage(1);
  }, []);

  const setDateFilter = useCallback((filter: UserDateFilter) => {
    setDateFilterState(filter);
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
   * Nothing is optimistically patched onto the row status: `GET /admin/users`
   * maps `status == 0` to "suspended" and ignores `-1` entirely, so a banned
   * user still reads "verified" and an unbanned one reads "suspended"
   * (BUG-6, verified live). Instead the authoritative status the mutation
   * itself returns is stored, and the list is refetched so every other column
   * stays server-truthful.
   */
  const applyStatus = useCallback((id: string, status: UserStatusResponse) => {
    setBanStatuses((prev) => ({ ...prev, [id]: status }));
  }, []);

  const banUser = useCallback(
    async (user: UserRow, ban: BanRequest) => {
      const response = await usersApi.banUser(user.id, ban);
      applyStatus(user.id, response.data);
      void fetchUsers();
    },
    [applyStatus, fetchUsers]
  );

  const unbanUser = useCallback(
    async (user: UserRow) => {
      const response = await usersApi.unbanUser(user.id);
      applyStatus(user.id, response.data);
      void fetchUsers();
    },
    [applyStatus, fetchUsers]
  );

  return {
    users,
    stats,
    adminPhoto,
    typeFilter,
    setTypeFilter,
    statusFilter,
    setStatusFilter,
    dateFilter,
    setDateFilter,
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
    refetch: fetchUsers,
    banUser,
    unbanUser,
  };
};
