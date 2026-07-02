import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface UserRowResponse {
  id: number;
  full_name: string;
  email: string | null;
  profile_photo: string | null;
  type: 'driver' | 'passenger';
  status: 'verified' | 'pending' | 'suspended';
  joined_at: string;
  joined_label: string;
}

export interface UsersStatsResponse {
  total_registered: number;
  active_drivers: number;
  pending_drivers: number;
  passengers: number;
  suspended_users: number;
}

export interface UsersListResponse {
  status: string;
  data: {
    admin_photo: string | null;
    stats: UsersStatsResponse;
    users: UserRowResponse[];
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
    };
  };
}

export interface UsersListParams {
  type?: 'all' | 'driver' | 'passenger';
  status?: 'all' | 'verified' | 'pending' | 'suspended';
  date?: 'all' | 'last_30_days' | 'last_3_months' | 'last_6_months' | 'last_12_months';
  per_page?: number;
  page?: number;
  search?: string;
}

export interface BanRequest {
  reason: string; // min 10 chars
  type: 'permanent' | 'temporary';
  expires_at?: string; // required when type=temporary
}

export const usersApi = {
  getAllUsers: async (params: UsersListParams = {}): Promise<UsersListResponse> => {
    const response = await api.get(ENDPOINTS.USERS.ALL, { params });
    return response.data;
  },
  banUser: async (id: string | number, ban: BanRequest) => {
    const response = await api.post(ENDPOINTS.USERS.BAN(id), ban);
    return response.data;
  },
  unbanUser: async (id: string | number, adminNotes?: string) => {
    const response = await api.post(
      ENDPOINTS.USERS.UNBAN(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },
  getUserStatus: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.USERS.STATUS(id));
    return response.data;
  },
  // BFF endpoint: whole passenger profile page in one call
  getPassengerFullProfile: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.PASSENGERS.FULL_PROFILE(id));
    return response.data;
  },
  chargePassengerWallet: async (id: string | number, amount: number, adminNotes?: string) => {
    const response = await api.post(ENDPOINTS.PASSENGERS.CHARGE_WALLET(id), {
      amount,
      ...(adminNotes ? { admin_notes: adminNotes } : {}),
    });
    return response.data;
  },
};
