import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { usersApi } from '../api/usersApi';
import type { BanRequest, UserRowResponse, UsersStatsResponse } from '../api/usersApi';

export interface UserRow {
  id: string;
  name: string;
  email: string;
  type: 'driver' | 'passenger';
  joinDate: string;
  status: 'verified' | 'pending' | 'suspended';
  avatar: string;
}

export type UserTypeFilter = 'all' | UserRow['type'];
export type UserStatusFilter = 'all' | UserRow['status'];

interface UseUsersReturn {
  users: UserRow[];
  stats: UsersStatsResponse | null;
  typeFilter: UserTypeFilter;
  setTypeFilter: (filter: UserTypeFilter) => void;
  statusFilter: UserStatusFilter;
  setStatusFilter: (filter: UserStatusFilter) => void;
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
  avatar: u.profile_photo || `https://i.pravatar.cc/100?u=${u.id}`,
});

export const useUsers = (): UseUsersReturn => {
  const { t } = useTranslation();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<UsersStatsResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState<UserTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [search, setSearchState] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

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
        page,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setUsers((response.data.users || []).map((u) => mapUser(u, t)));
      setStats(response.data.stats ?? null);
      setLastPage(response.data.meta?.last_page ?? 1);
      setTotal(response.data.meta?.total ?? 0);
      setPerPage(response.data.meta?.per_page ?? 10);
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load users');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, [typeFilter, statusFilter, page, debouncedSearch, t]);

  useFetchEffect(fetchUsers);

  const handleSetTypeFilter = useCallback((filter: UserTypeFilter) => {
    setTypeFilter(filter);
    setPage(1);
  }, []);

  const handleSetStatusFilter = useCallback((filter: UserStatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const banUser = useCallback(async (user: UserRow, ban: BanRequest) => {
    await usersApi.banUser(user.id, ban);
    setUsers((prev) =>
      prev.map((entry) => (entry.id === user.id ? { ...entry, status: 'suspended' } : entry))
    );
  }, []);

  const unbanUser = useCallback(async (user: UserRow) => {
    await usersApi.unbanUser(user.id);
    setUsers((prev) =>
      prev.map((entry) => (entry.id === user.id ? { ...entry, status: 'verified' } : entry))
    );
  }, []);

  return {
    users,
    stats,
    typeFilter,
    setTypeFilter: handleSetTypeFilter,
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
    refetch: fetchUsers,
    banUser,
    unbanUser,
  };
};
