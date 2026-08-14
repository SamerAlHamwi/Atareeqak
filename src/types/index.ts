/**
 * Mirrors App\Enums\StaffRole on the backend. Ordered by privilege level.
 * `system_admin` and `sycash` are "restricted": seeded at deployment, and the
 * employee-management API refuses to create or delete them.
 */
export type StaffRole = 'system_admin' | 'sycash' | 'admin' | 'support_agent';

export type User = {
  id?: string | number;
  name: string;
  email: string;
  type?: 'primary' | 'sycash';
  phone?: string;
  username?: string;
  role?: StaffRole;
  roleLabel?: string;
  lastLoginAt?: string | null;
};

export type StaffEmployee = {
  id: number;
  username: string;
  email: string;
  full_name: string;
  role: StaffRole;
  role_label: string;
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
};

export type StaffAuthResponse = {
  status: string;
  message?: string;
  employee: StaffEmployee;
  tokens: TokenPair;
};

export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};

export type AuthResponse = {
  status: string;
  message: string;
  admin?: User;
  tokens: TokenPair;
};

export type DashboardStats = {
  total_users: number;
  active_trips: number;
  completed_trips: number;
  total_revenue: {
    raw: number;
    formatted: string;
  };
  pending_complaints: number;
  verification_requests: number;
};

export type GrowthChartData = {
  month: string;
  label: string;
  completed_trips: number;
  new_users: number;
};

export type CityDistribution = {
  city: string;
  city_en: string;
  count: number;
  percentage: number;
};

export type RecentActivity = {
  booking_id: number;
  user: {
    name: string;
    number: string;
  };
  driver: string;
  route: string;
  date: {
    raw: string;
    human: string;
  };
  status: string;
  value: string;
};

export type DashboardData = {
  status: string;
  data: {
    stats: DashboardStats;
    growth_chart: {
      period: string;
      data: GrowthChartData[];
    };
    city_distribution: CityDistribution[];
    recent_activities: RecentActivity[];
  };
};
