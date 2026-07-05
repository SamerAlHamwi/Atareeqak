import { useState, useMemo, useCallback } from 'react';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import { staffApi } from '../api/staffApi';
import type { EmployeeResponse, CreateEmployeeRequest, StaffRole } from '../api/staffApi';

export interface Employee {
  id: string;
  name: string;
  username: string;
  email: string;
  role: StaffRole;
  roleLabel: string;
  isActive: boolean;
  lastLogin: string;
  avatar: string;
}

interface UseStaffReturn {
  staff: Employee[];
  totalStaff: number;
  activeStaff: number;
  inactiveStaff: number;
  isLoading: boolean;
  error: Error | null;
  createEmployee: (payload: CreateEmployeeRequest) => Promise<Employee>;
  toggleActive: (employee: Employee) => Promise<void>;
  resetPassword: (employee: Employee, newPassword: string) => Promise<void>;
}

const mapEmployee = (e: EmployeeResponse): Employee => ({
  id: String(e.id),
  name: e.full_name || e.username,
  username: e.username,
  email: e.email || '',
  role: e.role,
  roleLabel: e.role_label,
  isActive: e.is_active,
  lastLogin: e.last_login_at ? new Date(e.last_login_at).toLocaleString('ar-SY') : '—',
  avatar: `https://i.pravatar.cc/100?u=employee-${e.id}`,
});

export const useStaff = (): UseStaffReturn => {
  const [staff, setStaff] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchStaff = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await staffApi.getAllStaff();
      setStaff((response.data || []).map(mapEmployee));
    } catch (err) {
      const fetchError = err instanceof Error ? err : new Error('Failed to load staff');
      setError(fetchError);
      console.error(fetchError.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFetchEffect(fetchStaff);

  const createEmployee = useCallback(async (payload: CreateEmployeeRequest) => {
    const response = await staffApi.createEmployee(payload);
    const employee = mapEmployee(response.employee);
    setStaff((prev) => [employee, ...prev]);
    return employee;
  }, []);

  const toggleActive = useCallback(async (employee: Employee) => {
    await staffApi.toggleStaffStatus(employee.id);
    setStaff((prev) =>
      prev.map((entry) =>
        entry.id === employee.id ? { ...entry, isActive: !entry.isActive } : entry
      )
    );
  }, []);

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
    createEmployee,
    toggleActive,
    resetPassword,
  };
};
