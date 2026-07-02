import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../api/usersApi';
import type { UserRowResponse, UsersStatsResponse } from '../api/usersApi';

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
  page: number;
  setPage: (page: number) => void;
  lastPage: number;
  total: number;
  perPage: number;
  isLoading: boolean;
  error: Error | null;
  banUser: (user: UserRow, reason: string) => Promise<void>;
  unbanUser: (user: UserRow) => Promise<void>;
}

const mapUser = (u: UserRowResponse): UserRow => ({
  id: String(u.id),
  name: u.full_name || 'غير معروف',
  email: u.email || '',
  type: u.type,
  joinDate: u.joined_label || '',
  status: u.status,
  avatar: u.profile_photo || `https://i.pravatar.cc/100?u=${u.id}`,
});

export const useUsers = (): UseUsersReturn => {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [stats, setStats] = useState<UsersStatsResponse | null>(null);
  const [typeFilter, setTypeFilter] = useState<UserTypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchUsers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await usersApi.getAllUsers({
        type: typeFilter,
        status: statusFilter,
        page,
      });
      setUsers((response.data.users || []).map(mapUser));
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
  }, [typeFilter, statusFilter, page]);

  useEffect(() => {
    void fetchUsers();
  }, [fetchUsers]);

  const handleSetTypeFilter = useCallback((filter: UserTypeFilter) => {
    setTypeFilter(filter);
    setPage(1);
  }, []);

  const handleSetStatusFilter = useCallback((filter: UserStatusFilter) => {
    setStatusFilter(filter);
    setPage(1);
  }, []);

  const banUser = useCallback(async (user: UserRow, reason: string) => {
    await usersApi.banUser(user.id, { reason, type: 'permanent' });
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
    page,
    setPage,
    lastPage,
    total,
    perPage,
    isLoading,
    error,
    banUser,
    unbanUser,
  };
};
