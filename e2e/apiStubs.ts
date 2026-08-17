import type { Page } from '@playwright/test';

export type Role = 'system_admin' | 'sycash' | 'admin' | 'support_agent';

export const employeeFixture = (role: Role) => ({
  id: 1,
  username: 'smoke',
  email: 'smoke@atareeqak.com',
  full_name: 'Smoke Tester',
  role,
  role_label: role,
  is_active: true,
  last_login_at: '2026-08-14T09:00:00+03:00',
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

/**
 * Matches the REAL `GET /admin/reports` payload shape, confirmed live 2026-08-14
 * (`curl .../admin/reports`) and by `verify-reports.mjs` (155/155). The previous
 * version of this fixture had `financial_stats.primary_admin.total_collected`
 * and `.total_disbursed` — fields Phase 9 proved the live API does not return
 * (it returns `total_platform_fees` instead) — so the e2e suite was asserting
 * against a shape the backend was already confirmed not to produce.
 */
const reportFixture = {
  status: 'success',
  report_data: {
    ride_stats: { total: 0, active: 0, completed: 0, cancelled: 0, awaiting_confirmation: 0 },
    financial_stats: {
      sycash: {
        current_balance: '0.00 SYP',
        total_escrow_in: '0.00 SYP',
        total_escrow_out: '0.00 SYP',
        total_refunds_paid: '0.00 SYP',
      },
      primary_admin: {
        current_balance: '0.00 SYP',
        total_platform_fees: '0.00 SYP',
      },
      active_rides_locked: '0.00 SYP',
    },
    date_range: { start: null, end: null },
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

/** One real row so the "ban a user" walkthrough step has something to click. */
const WALKTHROUGH_USER_ID = 501;

const usersFixture = {
  status: 'success',
  data: {
    admin_photo: null,
    stats: { total_registered: 1, active_drivers: 0, pending_drivers: 0, passengers: 1, suspended_users: 0 },
    users: [
      {
        id: WALKTHROUGH_USER_ID,
        full_name: 'Walkthrough Passenger',
        email: 'walkthrough@atareeqak.com',
        profile_photo: null,
        type: 'passenger',
        status: 'verified',
        joined_at: '2026-01-01T00:00:00+03:00',
        joined_label: 'Jan 2026',
      },
    ],
    meta: { ...emptyMeta, total: 1 },
  },
};

/** One real row so the "approve a verification" walkthrough step has something to click. */
const WALKTHROUGH_VERIFICATION_USER_ID = 502;

const verificationsFixture = {
  status: 'success',
  total: 1,
  data: [
    {
      user_id: WALKTHROUGH_VERIFICATION_USER_ID,
      name: 'Walkthrough Driver',
      email: 'driver-walkthrough@atareeqak.com',
      gender: 'M',
      address: 'Damascus',
      type: 'driver',
      profile_photo: null,
      documents: [],
      submitted_at: '2026-08-01T00:00:00+03:00',
    },
  ],
};

/** One real row so the "resolve a complaint" walkthrough step has something to click. */
const WALKTHROUGH_COMPLAINT_ID = 503;

const complaintsFixture = {
  status: 'success',
  data: [
    {
      id: WALKTHROUGH_COMPLAINT_ID,
      title: 'Walkthrough complaint',
      description: 'Seeded for the e2e walkthrough.',
      type: 'other',
      type_label: null,
      status: 'in_review',
      status_label: 'In review',
      status_color: 'blue',
      is_escalated: false,
      resolution_notes: null,
      resolved_at: null,
      assigned_to: { id: 1, name: 'Smoke Tester', role: 'system_admin' },
      user: { id: WALKTHROUGH_USER_ID, name: 'Walkthrough Passenger', email: 'walkthrough@atareeqak.com' },
      attachments: [],
      created_at: '2026-08-10T00:00:00+03:00',
    },
  ],
  meta: { ...emptyMeta, total: 1 },
  counts: { all: 1, pending: 0, in_review: 1, resolved: 0, closed: 0 },
};

/** One real row so the "approve a wallet request" walkthrough step has something to click. */
const WALKTHROUGH_WALLET_REQUEST_ID = 504;

const walletRequestsFixture = {
  status: 'success',
  data: [
    {
      id: WALKTHROUGH_WALLET_REQUEST_ID,
      type: 'charge',
      amount: 25000,
      status: 'pending',
      user_notes: null,
      admin_notes: null,
      processed_at: null,
      created_at: '2026-08-13T00:00:00+03:00',
      user: { id: WALKTHROUGH_USER_ID, name: 'Walkthrough Passenger', email: 'walkthrough@atareeqak.com' },
      wallet: {
        id: 9,
        wallet_number: 'WLT-0009',
        phone_number: '+963900000009',
        current_balance: 100000,
        cash_ride_debt: 0,
      },
    },
  ],
  meta: { ...emptyMeta, total: 1 },
  counts: { pending: 1, approved: 0, rejected: 0 },
};

/**
 * Chat. `user: null` is not an oversight in this fixture — it is what the live
 * API returns for every `support` conversation ([BUG-14](../docs/api/backend-issues.md)),
 * so a fixture with a populated `user` block would let a regression that only
 * works against identified customers pass this suite.
 *
 * The list endpoint takes no paging params and answers with `total` + every
 * row, which is why there is no `meta` here.
 */
const chatConversationFixture = {
  id: 9101,
  type: 'support',
  user: null,
  last_message: {
    content: 'Thanks, that answers it.',
    sender_name: 'Passenger1',
    sent_by_agent: false,
    created_at: '2 hours ago',
    created_at_iso: '2026-08-17T09:03:00+03:00',
  },
  updated_at: '2026-08-17T09:40:00+03:00',
};

const chatConversationsFixture = {
  status: 'success',
  total: 2,
  data: [
    chatConversationFixture,
    {
      id: 9104,
      type: 'support',
      user: null,
      // A conversation with no messages at all — the `last_message: null` branch.
      last_message: null,
      updated_at: '2026-08-16T17:30:00+03:00',
    },
  ],
};

const chatMessagesFixture = {
  status: 'success',
  conversation: chatConversationFixture,
  data: [
    {
      id: 9001,
      sender: { id: 11, name: 'Passenger1 Test', profile_photo: null },
      type: 'text',
      content: 'Hello, I was charged twice.',
      metadata: null,
      created_at: '2026-08-17T06:00:00+03:00',
      is_edited: false,
    },
    {
      id: 9002,
      sender: { id: 36, name: 'Smoke Tester', profile_photo: null },
      type: 'text',
      content: 'Looking into it now.',
      metadata: null,
      created_at: '2026-08-17T06:10:00+03:00',
      is_edited: false,
    },
  ],
  // No `last_page`, no `total` — the real endpoint echoes only these two.
  meta: { page: 1, limit: 50 },
};

/**
 * Ordered list of URL-substring → JSON fixture rules; first match wins.
 * Every list endpoint returns an empty collection so pages render their
 * empty states without console errors, except the four rows above that exist
 * specifically so the destructive-action walkthrough in `smoke.spec.ts` has
 * something real to act on.
 */
const rules: [string, unknown, number?][] = [
  // Hit once on every boot by `ApiConfigGuard` (src/app/ApiConfigGuard.tsx) —
  // the unauthenticated health route it uses to detect a totally unconfigured
  // deployment (Phase 15).
  ['/test', { message: 'API is working!' }],
  ['/admin/dashboard/recent', { status: 'success', data: [] }],
  ['/admin/dashboard/stats', { status: 'success', data: dashboardFixture.data.stats }],
  ['/admin/dashboard/growth', { status: 'success', data: { period: 'last_6_months', data: [] } }],
  ['/admin/dashboard/cities', { status: 'success', data: [] }],
  ['/admin/dashboard', dashboardFixture],
  [`/admin/users/${WALKTHROUGH_USER_ID}/ban`, { status: 'success', message: 'User banned.' }],
  [`/admin/users/${WALKTHROUGH_USER_ID}/unban`, { status: 'success', message: 'User unbanned.' }],
  [`/admin/users/${WALKTHROUGH_USER_ID}/status`, {
    status: 'success',
    data: { status_code: -1, ban: { reason: 'Walkthrough ban', type: 'permanent', expires_at: null } },
  }],
  ['/admin/users', usersFixture],
  ['/admin/drivers/dashboard', driversDashboardFixture],
  ['/admin/drivers/top', { status: 'success', data: [] }],
  ['/admin/drivers', { status: 'success', data: [], meta: emptyMeta }],
  ['/admin/trips/live', { status: 'success', data: [] }],
  ['/admin/trips', {
    status: 'success',
    data: [],
    meta: { current_page: 1, last_page: 2, per_page: 10, total: 11, filter: 'all' },
    counts: { all: 11, scheduled: 0, active: 0, completed: 0, cancelled: 0, awaiting: 0 },
  }],
  ['/admin/routes/popular', { status: 'success', data: [] }],
  ['/admin/reports', reportFixture],
  // Order matters: `/admin/wallets` and every `/admin/wallet/...` sub-path
  // must be listed before the bare `/admin/wallet` (the admin's OWN wallet)
  // below, since `path.startsWith('/admin/wallet')` would otherwise also
  // match `/admin/wallets` and swallow it.
  ['/admin/wallets', { status: 'success', all_wallets: [] }],
  ['/admin/wallet/charge', { status: 'success', message: 'Wallet charged.', new_balance: 100000 }],
  [`/admin/wallet/requests/${WALKTHROUGH_WALLET_REQUEST_ID}/approve`, {
    status: 'success',
    message: 'Request approved.',
    new_balance: 125000,
  }],
  [`/admin/wallet/requests/${WALKTHROUGH_WALLET_REQUEST_ID}/reject`, { status: 'success', message: 'Request rejected.' }],
  ['/admin/wallet/requests', walletRequestsFixture],
  // The admin's OWN wallet (AdminWalletCard) — must stay after every other
  // `/admin/wallet*` rule above; see the ordering note there.
  ['/admin/wallet', {
    status: 'success',
    wallet: {
      id: 1,
      wallet_number: 'ADM-0001',
      phone_number: '+963900000001',
      balance: 100000,
      name: 'Primary Escrow',
    },
  }],
  ['/admin/verifications', { status: 'success', data: [] }],
  [`/staff/verifications/${WALKTHROUGH_VERIFICATION_USER_ID}/approve`, {
    status: 'success',
    message: 'Verification approved.',
    data: {
      user_id: WALKTHROUGH_VERIFICATION_USER_ID,
      national_id: 'WT-0001',
      verification_status: 'approved',
      is_verified_driver: true,
      is_verified_passenger: false,
    },
  }],
  [`/staff/verifications/${WALKTHROUGH_VERIFICATION_USER_ID}/reject`, { status: 'success', message: 'Verification rejected.' }],
  ['/staff/verifications/pending', verificationsFixture],
  [`/staff/complaints/${WALKTHROUGH_COMPLAINT_ID}/respond`, {
    status: 'success',
    message: 'Complaint responded.',
    data: { ...complaintsFixture.data[0], status: 'resolved', status_label: 'Resolved', resolution_notes: 'Resolved via e2e walkthrough.' },
  }],
  [`/staff/complaints/${WALKTHROUGH_COMPLAINT_ID}/escalate`, { status: 'success', message: 'Complaint escalated.', data: complaintsFixture.data[0] }],
  [`/staff/complaints/${WALKTHROUGH_COMPLAINT_ID}`, { status: 'success', data: complaintsFixture.data[0] }],
  ['/staff/complaints', complaintsFixture],
  ['/staff/escalated-complaints', {
    status: 'success',
    data: [],
    meta: emptyMeta,
    counts: { escalated: 0, resolved: 0, closed: 0 },
  }],
  // Chat. The messages rule MUST come first — `path.startsWith` would
  // otherwise let the conversations rule swallow `/conversations/{id}/messages`.
  ['/staff/chat/conversations/9101/messages', chatMessagesFixture],
  ['/staff/chat/conversations', chatConversationsFixture],
  ['/staff/reviews', { status: 'success', data: [], meta: emptyMeta }],
  ['/staff/bookings', { status: 'success', data: [], meta: emptyMeta }],
  // `POST /employees` returns a genuine 500 (BUG-1) — confirmed live, not a
  // guess. Stubbing it as a success would let a regression that removes the
  // page's "unavailable" gating pass this suite while lying to a real user.
  ['/employees', {
    status: 'error',
    message: "Call to undefined method App\\Services\\Staff\\EmployeeManagementService::list()",
  }, 500],
];

/** Intercepts every /e2e-api request and answers it from fixtures. */
export const stubApi = async (page: Page, role: Role): Promise<{ unstubbed: string[] }> => {
  const unstubbed: string[] = [];

  await page.route('**/e2e-api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
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
    if (path === '/staff/logout' || path === '/admin/logout') {
      await route.fulfill({ json: { status: 'success' } });
      return;
    }

    const rule = rules.find(([needle]) => path.startsWith(needle));
    if (!rule) {
      // The old catch-all here — `{ status: 'success', data: [] }` for
      // anything unmatched — is exactly how a stub for a route the frontend
      // no longer calls (or never should have) went unnoticed: an unstubbed
      // request quietly looked like a normal empty list instead of failing
      // the test. Every test that calls `stubApi` must assert `unstubbed` is
      // empty once the walkthrough is done.
      unstubbed.push(`${request.method()} ${path}`);
      await route.fulfill({
        status: 599,
        json: {
          status: 'error',
          message: `e2e/apiStubs.ts has no rule for ${request.method()} ${path} — add one, don't rely on the catch-all`,
        },
      });
      return;
    }

    const [, json, status] = rule;
    await route.fulfill({ status: status ?? 200, json });
  });

  return { unstubbed };
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
