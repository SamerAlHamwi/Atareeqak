import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { staffApi } from '../api/staffApi';
import type {
  EmployeeResponse,
  CreateEmployeeRequest,
  UpdateEmployeeRequest,
  StaffRole,
} from '../api/staffApi';

export interface Employee {
  id: string;
  name: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  role: StaffRole;
  roleLabel: string;
  isActive: boolean;
  /** Localised, or null when the employee has never logged in. */
  lastLogin: string | null;
  /** No employee photo endpoint exists; the initials <Avatar> renders instead. */
  photo: null;
}

interface UseStaffReturn {
  staff: Employee[];
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  isLoading: boolean;
  error: string | null;
  /**
   * Whether the `/employees` backend is usable at all.
   * `null` while the first request is still in flight.
   */
  isBackendAvailable: boolean | null;
  refetch: () => Promise<void>;
  createEmployee: (payload: CreateEmployeeRequest) => Promise<Employee>;
  updateEmployee: (employee: Employee, payload: UpdateEmployeeRequest) => Promise<void>;
  toggleActive: (employee: Employee) => Promise<void>;
  resetPassword: (employee: Employee, newPassword: string) => Promise<void>;
  deleteEmployee: (employee: Employee) => Promise<void>;
}

/**
 * `isBackendAvailable` gates every write control on whether the last
 * `GET /employees` succeeded, rather than assuming it always will — if the
 * list fails to load, the page shows a labelled unavailable state instead of
 * an empty table (which would read as "no staff") and disables create/edit/
 * deactivate/delete rather than let them fail against data that isn't there.
 */
const mapEmployee = (e: EmployeeResponse, locale: string): Employee => ({
  id: String(e.id),
  name: e.full_name || e.username,
  username: e.username,
  email: e.email || '',
  firstName: e.first_name ?? '',
  lastName: e.last_name ?? '',
  role: e.role,
  roleLabel: e.role_label,
  isActive: e.is_active,
  lastLogin: e.last_login_at ? new Date(e.last_login_at).toLocaleString(locale) : null,
  photo: null,
});

export const useStaff = (): UseStaffReturn => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const [staff, setStaff] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isBackendAvailable, setIsBackendAvailable] = useState<boolean | null>(null);

  const fetchStaff = useCallback(async (isStale: IsStale) => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await staffApi.getAllStaff();
      if (isStale()) {
        return;
      }
      setStaff((response.data || []).map((e) => mapEmployee(e, locale)));
      setIsBackendAvailable(true);
    } catch (err) {
      if (isStale()) {
        return;
      }
      setError(extractApiError(err, t('staff.load_failed')));
      // The list is the availability probe for the whole feature.
      setIsBackendAvailable(false);
      setStaff([]);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [t, locale]);

  useFetchEffect(fetchStaff);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchStaff(() => false), [fetchStaff]);

  const createEmployee = useCallback(
    async (payload: CreateEmployeeRequest) => {
      const response = await staffApi.createEmployee(payload);
      const employee = mapEmployee(response.employee, locale);
      // Re-read rather than trusting the optimistic insert: `create` is one of
      // the write-then-500 paths, so the server is the only trustworthy source
      // of what actually landed.
      await refetch();
      return employee;
    },
    [refetch, locale]
  );

  const updateEmployee = useCallback(
    async (employee: Employee, payload: UpdateEmployeeRequest) => {
      await staffApi.updateEmployee(employee.id, payload);
      await refetch();
    },
    [refetch]
  );

  const toggleActive = useCallback(
    async (employee: Employee) => {
      await staffApi.toggleStaffStatus(employee.id);
      await refetch();
    },
    [refetch]
  );

  const resetPassword = useCallback(async (employee: Employee, newPassword: string) => {
    await staffApi.resetStaffPassword(employee.id, newPassword);
  }, []);

  const deleteEmployee = useCallback(
    async (employee: Employee) => {
      await staffApi.deleteEmployee(employee.id);
      await refetch();
    },
    [refetch]
  );

  const totalStaff = staff.length;
  const activeStaff = useMemo(() => staff.filter((e) => e.isActive).length, [staff]);
  const inactiveStaff = totalStaff - activeStaff;

  return {
    staff,
    totalStaff,
    activeStaff,
    inactiveStaff,
    isLoading,
    error,
    isBackendAvailable,
    refetch,
    createEmployee,
    updateEmployee,
    toggleActive,
    resetPassword,
    deleteEmployee,
  };
};
