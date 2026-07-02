import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface DriverRowResponse {
  id: number;
  driver_ref: string;
  full_name: string;
  profile_photo: string | null;
  phone: string | null;
  vehicle: string | null;
  status: 'verified' | 'pending' | 'suspended';
  avg_rating: number | null;
  is_verified_driver: boolean;
  verification_status: string | null;
  joined_at: string;
}

export interface DriverStatsResponse {
  total_drivers: number;
  active_drivers: number;
  pending_verifications: number;
  suspended_drivers: number;
  average_rating: number;
}

export interface DriverActivityResponse {
  type: string;
  icon: string;
  color: string;
  message: string;
  actor: string;
  user_id: number;
  occurred_at: string;
  human_time: string;
}

export interface VerificationEfficiencyResponse {
  period: string;
  period_label: string;
  current: {
    total_incoming: number;
    processed: number;
    pending: number;
    efficiency_pct: number;
  };
  previous: {
    label: string;
    efficiency_pct: number;
  };
  comparison: {
    delta: number;
    delta_display: string;
    trend: string;
    text: string;
  };
}

export interface DriversDashboardResponse {
  admin_photo: string | null;
  stats: DriverStatsResponse;
  recent_activity: DriverActivityResponse[];
  verification_efficiency: VerificationEfficiencyResponse;
}

export interface DriversListResponse {
  status: string;
  data: DriverRowResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    filter: string;
  };
}

export interface DriverDashboardDetailResponse {
  id: number;
  driver_ref: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  address: string | null;
  joined_at: string;
  status: 'verified' | 'pending' | 'suspended';
  is_verified: boolean;
  verification_status: string | null;
  profile_photo: string | null;
  rating: {
    average: number;
    total_ratings: number;
  };
  stats: {
    total_rides: number;
    completed_rides: number;
    cancelled_rides: number;
    cancel_rate: number;
    total_earnings: number;
  };
  vehicle: {
    type: string | null;
    color: string | null;
    seats: number | null;
    photo_url: string | null;
  };
  documents: { type: string; file_url: string }[];
  recent_rides: {
    id: number;
    status: string;
    source: string;
    destination: string;
    price_per_seat: number;
    date: string;
  }[];
  favorite_destination: { name: string; visit_count: number } | null;
}

export const driversApi = {
  getAllDrivers: async (
    params: { filter?: string; page?: number; per_page?: number; search?: string } = {}
  ): Promise<DriversListResponse> => {
    const response = await api.get(ENDPOINTS.DRIVERS.ALL, { params });
    return response.data;
  },
  getDriversDashboard: async (): Promise<{ status: string; data: DriversDashboardResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.DASHBOARD);
    return response.data;
  },
  getDriverStats: async (): Promise<{ status: string; data: DriverStatsResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.STATS);
    return response.data;
  },
  getDriverActivity: async (limit = 10): Promise<{ status: string; data: DriverActivityResponse[] }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.ACTIVITY, { params: { limit } });
    return response.data;
  },
  getDriverProfile: async (id: string | number) => {
    const response = await api.get(ENDPOINTS.DRIVERS.PROFILE(id));
    return response.data;
  },
  getDriverDashboard: async (
    id: string | number
  ): Promise<{ status: string; data: DriverDashboardDetailResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.DRIVER_DASHBOARD(id));
    return response.data;
  },
  getVerificationEfficiency: async (
    period: 'day' | 'week' | 'month' = 'week'
  ): Promise<{ status: string; data: VerificationEfficiencyResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.VERIFICATION_EFFICIENCY, {
      params: { period },
    });
    return response.data;
  },
};
