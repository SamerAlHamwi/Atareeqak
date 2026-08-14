import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

import type { StaffRole } from '../../../types/index';

export type { StaffRole };

/**
 * Roles a system_admin may assign via POST /employees.
 *
 * The backend derives its `role|in:` rule from StaffRole::creatableRoles():
 * system_admin can create admin + support_agent, admin can create
 * support_agent, and `system_admin`/`sycash` are `isRestricted()` — seeded at
 * deployment and never creatable through the API.
 */
export type CreatableStaffRole = 'admin' | 'support_agent';

export const CREATABLE_STAFF_ROLES: CreatableStaffRole[] = ['admin', 'support_agent'];

/** `username` is `required|string|min:3|max:50|alpha_dash`. */
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 50;
export const USERNAME_PATTERN = /^[A-Za-z0-9_-]+$/;
/** `password` / `new_password` are `required|string|min:8`. */
export const PASSWORD_MIN_LENGTH = 8;
/** `first_name` / `last_name` are `max:100`; `email` is `nullable|email|max:255`. */
export const NAME_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 255;

/**
 * `created_by` is deliberately **not rendered**: it is NULL for all three seeded
 * employees, so a column for it would read "Unknown" on every row. Same call
 * Phase 4 made for `banned_by` (BUG-5).
 */
export interface EmployeeResponse {
  id: number;
  username: string;
  email: string | null;
  full_name: string;
  first_name: string;
  last_name: string;
  role: StaffRole;
  role_label: string;
  is_active: boolean;
  created_by: { id: number; username: string; name: string } | null;
  last_login_at: string | null;
  created_at: string;
}

export interface CreateEmployeeRequest {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  /** Restricted to creatable roles — the API 422s on system_admin / sycash. */
  role: CreatableStaffRole;
  email?: string;
}

export type UpdateEmployeeRequest = Partial<{
  first_name: string;
  last_name: string;
  email: string | null;
}>;

/**
 * `sendBroadcastAlert` is gone: `POST /admin/broadcast-alert` returns **404**,
 * confirmed live 2026-08-13.
 */
export const staffApi = {
  getAllStaff: async (): Promise<{ status: string; data: EmployeeResponse[] }> => {
    const response = await api.get(ENDPOINTS.EMPLOYEES.ALL);
    return response.data;
  },

  getEmployee: async (
    id: string | number
  ): Promise<{ status: string; data: EmployeeResponse }> => {
    const response = await api.get(ENDPOINTS.EMPLOYEES.SINGLE(id));
    return response.data;
  },

  createEmployee: async (
    payload: CreateEmployeeRequest
  ): Promise<{ status: string; message: string; employee: EmployeeResponse }> => {
    const response = await api.post(ENDPOINTS.EMPLOYEES.ALL, payload);
    return response.data;
  },

  updateEmployee: async (
    id: string | number,
    payload: UpdateEmployeeRequest
  ): Promise<{ status: string; message: string; employee: EmployeeResponse }> => {
    const response = await api.put(ENDPOINTS.EMPLOYEES.SINGLE(id), payload);
    return response.data;
  },

  toggleStaffStatus: async (
    id: string | number
  ): Promise<{ status: string; message: string; employee: EmployeeResponse }> => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.TOGGLE_ACTIVE(id));
    return response.data;
  },

  resetStaffPassword: async (
    id: string | number,
    newPassword: string
  ): Promise<{ status: string; message: string }> => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.RESET_PASSWORD(id), {
      new_password: newPassword,
    });
    return response.data;
  },

  deleteEmployee: async (id: string | number): Promise<{ status: string; message: string }> => {
    const response = await api.delete(ENDPOINTS.EMPLOYEES.SINGLE(id));
    return response.data;
  },
};
