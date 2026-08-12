import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

/**
 * `AdminDriverService::resolveDriverStatus()` can return five values, not the
 * three the filter vocabulary offers — `rejected` and `unverified` have no
 * matching filter tab but do reach the table. They were missing from this union,
 * so a row in either state fell through the status-badge map and rendered a raw
 * i18n key.
 */
export type DriverStatus = 'verified' | 'pending' | 'suspended' | 'rejected' | 'unverified';

/** The subset `GET /admin/drivers?filter=` accepts (validated `in:` server-side). */
export type DriverFilterValue = 'all' | 'verified' | 'pending' | 'suspended';

export interface DriverRowResponse {
  id: number;
  driver_ref: string;
  full_name: string;
  profile_photo: string | null;
  phone: string | null;
  vehicle: string | null;
  status: DriverStatus;
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

/** Windows accepted by `GET /admin/drivers/verification-efficiency?period=`. */
export type EfficiencyPeriod = 'day' | 'week' | 'month';

export interface VerificationEfficiencyResponse {
  period: EfficiencyPeriod;
  /** English ("Week"). The UI translates from `period` instead. */
  period_label: string;
  current: {
    start: string;
    end: string;
    total_incoming: number;
    processed: number;
    pending: number;
    efficiency_pct: number;
  };
  previous: {
    /** English ("Last week"). The UI translates from `period` instead. */
    label: string;
    start: string;
    end: string;
    total_incoming: number;
    processed: number;
    efficiency_pct: number;
  };
  comparison: {
    delta: number;
    delta_display: string;
    trend: 'up' | 'down' | 'flat';
    /** English ("Same as last week") — never rendered; see `useDrivers`. */
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
  status: DriverStatus;
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
    params: {
      filter?: DriverFilterValue;
      page?: number;
      per_page?: number;
      search?: string;
    } = {}
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
  // `GET /admin/drivers/{id}/profile` is deliberately absent: it is a strict
  // subset of `{id}/dashboard` for everything the details page renders (it
  // lacks price_per_seat, earnings, cancel_rate and favorite_destination, and
  // adds only bookings_count, which nothing displays). Keeping an unused
  // wrapper implied a second source of truth for the same screen.
  getDriverDashboard: async (
    id: string | number
  ): Promise<{ status: string; data: DriverDashboardDetailResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.DRIVER_DASHBOARD(id));
    return response.data;
  },
  getVerificationEfficiency: async (
    period: EfficiencyPeriod = 'week'
  ): Promise<{ status: string; data: VerificationEfficiencyResponse }> => {
    const response = await api.get(ENDPOINTS.DRIVERS.VERIFICATION_EFFICIENCY, {
      params: { period },
    });
    return response.data;
  },
};
