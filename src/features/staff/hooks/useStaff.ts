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
   * Whether the `/employees` backend is usable at all — see BUG-1 below.
   * `null` while the first request is still in flight.
   */
  isBackendAvailable: boolean | null;
  refetch: () => Promise<void>;
  createEmployee: (payload: CreateEmployeeRequest) => Promise<Employee>;
  updateEmployee: (employee: Employee, payload: UpdateEmployeeRequest) => Promise<void>;
  toggleActive: (employee: Employee) => Promise<void>;
  resetPassword: (employee: Employee, newPassword: string) => Promise<void>;
}

/**
 * 🔴 BUG-1 — why this hook has an `isBackendAvailable` flag.
 *
 * `EmployeeManagementController` calls three methods that do not exist on
 * `EmployeeManagementService`: `list()`, `resetPassword()` and
 * `formatEmployee()`. The service defines `getAll · getById · create · update ·
 * rotatePassword · toggleActive · delete`. Every one of the six `/employees`
 * endpoints therefore fails — and *where* in each action the missing call sits
 * decides whether the request corrupts data on its way out:
 *
 *   GET    /employees              list() ✗              → dies immediately
 *   GET    /employees/{id}         formatEmployee() ✗    → read-only, harmless
 *   POST   /employees              formatEmployee() ✗    → 🔴 ROW CREATED, then 500
 *   PUT    /employees/{id}         formatEmployee() ✗    → 🔴 ROW UPDATED, then 500
 *   PATCH  /employees/{id}/toggle-active                 → 🔴 ROW FLIPPED, then 500
 *   PATCH  /employees/{id}/reset-password  resetPassword() ✗ → dies before the write
 *
 * The 500 is an unhandled `\Error` ("Call to undefined method"), which is not an
 * `\Exception`, so each action's own `catch (\Exception $e)` never fires.
 *
 * Three of those six **write and then report failure**. Shipping create / edit /
 * deactivate against that would tell a user their action failed while the row
 * changed underneath them, and the natural response — retry — creates a second
 * employee or double-toggles.
 *
 * ── The decision (option (a) of the two offered) ────────────────────────────
 * The page is **kept mounted and shipped with a real, labelled unavailable
 * state**, rather than hidden behind a build-time feature flag:
 *
 *   · the read path always attempts `GET /employees` and, on failure, renders an
 *     explicit "staff directory unavailable" panel carrying the real server
 *     error — never an empty table, which would read as "no staff";
 *   · **every write control is unreachable while the list request fails.**
 *
 * Availability is derived from the live response rather than a hardcoded flag on
 * purpose: `GET /employees` calls BOTH `list()` and `formatEmployee()`, so its
 * success proves both of the missing methods that the write paths depend on
 * have been restored. The page therefore un-gates itself the moment BUG-1 is
 * fixed, with no frontend change and no stale flag left behind.
 *
 * The fix is small — rename `list` → `getAll` and `resetPassword` →
 * `rotatePassword` at the call sites and add a `formatEmployee()`. The concrete
 * patch is in docs/api/backend-issues.md.
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
      // The list is the availability probe for the whole feature — see BUG-1.
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
  };
};
