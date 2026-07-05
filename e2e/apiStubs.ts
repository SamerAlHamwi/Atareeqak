import type { Page } from '@playwright/test';

export type Role = 'system_admin' | 'admin' | 'support_agent';

export const employeeFixture = (role: Role) => ({
  id: 1,
  username: 'smoke',
  email: 'smoke@atareeqak.com',
  full_name: 'Smoke Tester',
  role,
  role_label: role,
  is_active: true,
  last_login_at: null,
});

const emptyMeta = { current_page: 1, last_page: 1, per_page: 10, total: 0 };

const dashboardFixture = {
  status: 'success',
  data: {
    stats: {
      total_users: 120,
      active_trips: 4,
      completed_trips: 300,
      total_revenue: { raw: 1500000, formatted: '1,500,000' },
      pending_complaints: 2,
      verification_requests: 5,
    },
    growth_chart: { period: 'last_6_months', data: [] },
    city_distribution: [],
    recent_activities: [],
  },
};

const reportFixture = {
  status: 'success',
  report_data: {
    ride_stats: { total: 0, active: 0, completed: 0, cancelled: 0, awaiting_confirmation: 0 },
    financial_stats: {
      sycash: { current_balance: '0', total_creation_fees: '0' },
      primary_admin: { current_balance: '0', total_collected: '0', total_disbursed: '0' },
      active_rides_locked: '0',
    },
    date_range: { start: '2024-01-01', end: '2024-12-31' },
  },
};

const driversDashboardFixture = {
  status: 'success',
  data: {
    stats: {
      total_drivers: 10,
      active_drivers: 6,
      pending_verifications: 2,
      suspended_drivers: 2,
      average_rating: 4.2,
    },
    recent_activity: [],
    verification_efficiency: null,
  },
};

const usersFixture = {
  status: 'success',
  data: {
    admin_photo: null,
    stats: { total_registered: 0, active_drivers: 0, pending_drivers: 0, passengers: 0, suspended_users: 0 },
    users: [],
    meta: emptyMeta,
  },
};

/**
 * Ordered list of URL-substring → JSON fixture rules; first match wins.
 * Every list endpoint returns an empty collection so pages render their
 * empty states without console errors.
 */
const rules: [string, unknown][] = [
  ['/admin/settings', {
    status: 'success',
    data: {
      app_name: 'Atareeqak',
      support_email: 'support@atareeqak.com',
      commission_rate: 15,
      min_withdrawal: 100,
      moderation_words: '',
      alert_message: '',
      maintenance_mode: false,
    },
  }],
  ['/staff/complaints/metrics', {
    status: 'success',
    data: {
      avg_response_time_minutes: 42,
      tickets_total: 10,
      tickets_resolved: 6,
      tickets_open: 3,
      tickets_escalated: 1,
      resolution_rate_pct: 60,
    },
  }],
  ['/admin/dashboard/recent', { status: 'success', data: [] }],
  ['/admin/dashboard/stats', { status: 'success', data: dashboardFixture.data.stats }],
  ['/admin/dashboard/growth', { status: 'success', data: { period: 'last_6_months', data: [] } }],
  ['/admin/dashboard/cities', { status: 'success', data: [] }],
  ['/admin/dashboard', dashboardFixture],
  ['/admin/users', usersFixture],
  ['/admin/drivers/dashboard', driversDashboardFixture],
  ['/admin/drivers/top', { status: 'success', data: [] }],
  ['/admin/drivers', { status: 'success', data: [], meta: emptyMeta }],
  ['/admin/trips/live', { status: 'success', data: [] }],
  ['/admin/trips', {
    status: 'success',
    data: [],
    meta: { ...emptyMeta, filter: 'all' },
    counts: { all: 0, scheduled: 0, active: 0, completed: 0, cancelled: 0, awaiting: 0 },
  }],
  ['/admin/routes/popular', { status: 'success', data: [] }],
  ['/admin/reports', reportFixture],
  ['/admin/wallets', { status: 'success', all_wallets: [] }],
  ['/admin/wallet/requests', {
    status: 'success',
    data: [],
    counts: { pending: 0, approved: 0, rejected: 0 },
    meta: emptyMeta,
  }],
  ['/admin/verifications', { status: 'success', data: [] }],
  ['/staff/verifications/pending', { status: 'success', data: [] }],
  ['/staff/complaints', {
    status: 'success',
    data: [],
    meta: emptyMeta,
    counts: { all: 0, pending: 0, in_review: 0, resolved: 0, closed: 0 },
  }],
  ['/staff/escalated-complaints', {
    status: 'success',
    data: [],
    meta: emptyMeta,
    counts: { escalated: 0, resolved: 0, closed: 0 },
  }],
  ['/staff/reviews', { status: 'success', data: [], meta: emptyMeta }],
  ['/employees', { status: 'success', data: [] }],
];

/** Intercepts every /e2e-api request and answers it from fixtures. */
export const stubApi = async (page: Page, role: Role): Promise<void> => {
  await page.route('**/e2e-api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/^.*\/e2e-api/, '');

    if (path === '/staff/me') {
      await route.fulfill({ json: { status: 'success', employee: employeeFixture(role) } });
      return;
    }
    if (path === '/staff/login') {
      await route.fulfill({
        json: {
          status: 'success',
          employee: employeeFixture(role),
          tokens: { access_token: 'e2e-access', refresh_token: 'e2e-refresh' },
        },
      });
      return;
    }

    const rule = rules.find(([needle]) => path.startsWith(needle));
    await route.fulfill({ json: rule ? rule[1] : { status: 'success', data: [] } });
  });
};

/** Seeds a logged-in staff session before the app boots. */
export const seedSession = async (page: Page, role: Role): Promise<void> => {
  await page.addInitScript((user) => {
    localStorage.setItem('access_token', 'e2e-access');
    localStorage.setItem('refresh_token', 'e2e-refresh');
    localStorage.setItem('auth_kind', 'staff');
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('i18nextLng', 'en');
  }, {
    id: 1,
    name: 'Smoke Tester',
    email: 'smoke@atareeqak.com',
    username: 'smoke',
    role,
    roleLabel: role,
  });
};
