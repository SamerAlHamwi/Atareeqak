import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { usersApi } from '../api/usersApi';
import type {
  BanRequest,
  UserDateFilterValue,
  UserRowResponse,
  UserRowStatus,
  UserStatusFilterValue,
  UsersListResponse,
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
  isBanned: boolean;
  /** Server photo URL, or null — the initials <Avatar> covers the gap. */
  photo: string | null;
}

export type UserTypeFilter = UserTypeFilterValue;
export type UserStatusFilter = UserStatusFilterValue;
export type UserDateFilter = UserDateFilterValue;

/** The three values `GET /admin/users?type=` validates against. */
export const USER_TYPE_FILTERS: readonly UserTypeFilter[] = ['all', 'driver', 'passenger'] as const;

/**
 * The five values `?status=` validates against. Rows can additionally come back
 * as `rejected` or `unverified`, which are not filterable — they only appear
 * under "all".
 *
 * `banned` is intentionally last and overlaps `suspended` (which is
 * `status IN (-1, 0)`): it isolates the accounts an admin actually banned from
 * the merely logged-out ones.
 */
export const USER_STATUS_FILTERS: readonly UserStatusFilter[] = [
  'all',
  'verified',
  'pending',
  'suspended',
  'banned',
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

export const isBannedUser = (user: UserRow): boolean => user.isBanned;

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
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  isForbidden: boolean;
  counts: UsersListResponse['data']['counts'] | null;
  refetch: () => Promise<void>;
  banUser: (user: UserRow, ban: BanRequest) => Promise<void>;
  unbanUser: (user: UserRow) => Promise<void>;
}

const mapUser = (u: UserRowResponse, t: TFunction): UserRow => ({
  id: String(u.id),
  name: u.full_name || t('common.unknown'),
  email: u.email || '',
  type: u.type,
  joinDate: u.joined_label || '',
  status: u.status,
  isBanned: u.is_banned,
  photo: u.profile_photo,
});

export const useUsers = (): UseUsersReturn => {
  const { t } = useTranslation();
  const [rows, setRows] = useState<UserRowResponse[]>([]);
  const [counts, setCounts] = useState<UsersListResponse['data']['counts'] | null>(null);
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
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  const [isForbidden, setIsForbidden] = useState(false);

  // Debounce the search input so we don't hit the API on every keystroke
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => clearTimeout(handle);
  }, [search]);

  const fetchUsers = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await usersApi.getAllUsers({
        type: typeFilter,
        status: statusFilter,
        date: dateFilter,
        page,
        per_page: perPage,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      if (isStale()) {
        return;
      }
      setRows(response.data.users || []);
      setStats(response.data.stats ?? null);
      setAdminPhoto(response.data.admin_photo ?? null);
      setCounts(response.data.counts ?? null);
      setLastPage(response.data.meta?.last_page ?? 1);
      setTotal(response.data.meta?.total ?? 0);
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
  }, [typeFilter, statusFilter, dateFilter, page, perPage, debouncedSearch, t]);

  /**
   * The list is **server-filtered**: every row the API returned is rendered.
   * There is deliberately no client-side re-filter here (the `visibleTrips` /
   * `visibleDrivers` bug class removed in Phases 3 and 4) — re-filtering a page
   * on a UI status would blank the table.
   */
  const users = useMemo(() => rows.map((row) => mapUser(row, t)), [rows, t]);

  useFetchEffect(fetchUsers);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchUsers(() => false), [fetchUsers]);

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

  const banUser = useCallback(
    async (user: UserRow, ban: BanRequest) => {
      await usersApi.banUser(user.id, ban);
      void refetch();
    },
    [refetch]
  );

  const unbanUser = useCallback(
    async (user: UserRow) => {
      await usersApi.unbanUser(user.id);
      void refetch();
    },
    [refetch]
  );

  return {
    users,
    counts,
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
    isForbidden,
    refetch,
    banUser,
    unbanUser,
  };
};
