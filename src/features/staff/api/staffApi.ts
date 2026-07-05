import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export type StaffRole = 'system_admin' | 'admin' | 'support_agent';

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
  role: StaffRole;
  email?: string;
}

export interface BroadcastAlertRequest {
  message: string;
  type: 'alert' | 'warning';
  recipient_type: 'users' | 'drivers' | 'all';
}

export interface BroadcastAlertResponse {
  status: string;
  message: string;
  message_id: number;
  sent_count: number;
}

export const staffApi = {
  // Admin-side broadcast; lives here because it's triggered from the staff page
  sendBroadcastAlert: async (payload: BroadcastAlertRequest): Promise<BroadcastAlertResponse> => {
    const response = await api.post(ENDPOINTS.BROADCAST_ALERT, payload);
    return response.data;
  },
  getAllStaff: async (): Promise<{ status: string; data: EmployeeResponse[] }> => {
    const response = await api.get(ENDPOINTS.EMPLOYEES.ALL);
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
    payload: Partial<Pick<CreateEmployeeRequest, 'first_name' | 'last_name' | 'email'>>
  ) => {
    const response = await api.put(ENDPOINTS.EMPLOYEES.SINGLE(id), payload);
    return response.data;
  },
  deleteEmployee: async (id: string | number): Promise<{ status: string; message: string }> => {
    const response = await api.delete(ENDPOINTS.EMPLOYEES.SINGLE(id));
    return response.data;
  },
  toggleStaffStatus: async (id: string | number) => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.TOGGLE_ACTIVE(id));
    return response.data;
  },
  resetStaffPassword: async (id: string | number, newPassword: string) => {
    const response = await api.patch(ENDPOINTS.EMPLOYEES.RESET_PASSWORD(id), {
      new_password: newPassword,
    });
    return response.data;
  },
};
