export const ENDPOINTS = {
  AUTH: {
    LOGIN: '/admin/login',
    REFRESH: '/admin/refresh',
    LOGOUT: '/admin/logout',
    FORGOT_PASSWORD: '/auth/password/forgot',
  },
  DASHBOARD: {
    BASE: '/admin/dashboard',
    STATS: '/admin/dashboard/stats',
    GROWTH: '/admin/dashboard/growth',
    CITIES: '/admin/dashboard/cities',
    RECENT: '/admin/dashboard/recent',
  },
  TRIPS: {
    LIVE: '/admin/trips/live',
    ALL: '/admin/trips',
    POPULAR_ROUTES: '/admin/routes/popular',
  },
  DRIVERS: {
    ALL: '/admin/drivers',
    STATS: '/admin/drivers/stats',
    ACTIVITY: '/admin/drivers/activity',
    TOP: '/admin/drivers/top',
    DASHBOARD: '/admin/drivers/dashboard',
    VERIFICATION_EFFICIENCY: '/admin/drivers/verification-efficiency',
    // `/admin/drivers/{id}/profile` exists server-side but has no consumer: the
    // details page is driven by `{id}/dashboard`, which is a superset of it.
    DRIVER_DASHBOARD: (id: string | number) => `/admin/drivers/${id}/dashboard`,
  },
  USERS: {
    ALL: '/admin/users',
    STATUS: (id: string | number) => `/admin/users/${id}/status`,
    BAN: (id: string | number) => `/admin/users/${id}/ban`,
    UNBAN: (id: string | number) => `/admin/users/${id}/unban`,
  },
  PASSENGERS: {
    FULL_PROFILE: (id: string | number) => `/admin/passengers/${id}/full-profile`,
    STATS: (id: string | number) => `/admin/passengers/${id}/stats`,
    MONTHLY_TRIPS: (id: string | number) => `/admin/passengers/${id}/monthly-trips`,
    RECENT_TRIPS: (id: string | number) => `/admin/passengers/${id}/recent-trips`,
    COMPLAINTS: (id: string | number) => `/admin/passengers/${id}/complaints`,
    WALLET_CHARGES: (id: string | number) => `/admin/passengers/${id}/wallet-charges`,
    CHARGE_WALLET: (id: string | number) => `/admin/passengers/${id}/charge-wallet`,
  },
  WALLET: {
    ADMIN_WALLET: '/admin/wallet',
    WALLETS: '/admin/wallets',
    TRANSACTIONS: (id: string | number) => `/admin/wallet/${id}/transactions`,
    REQUESTS: '/admin/wallet/requests',
    APPROVE_REQUEST: (id: string | number) => `/admin/wallet/requests/${id}/approve`,
    REJECT_REQUEST: (id: string | number) => `/admin/wallet/requests/${id}/reject`,
    CHARGE: '/admin/wallet/charge',
  },
  // `/admin/verifications` + `{userId}/approve|reject` (AdminDashboardController)
  // are deliberately NOT listed here. They are system_admin-only twins of the
  // STAFF.* routes below and return a strictly thinner payload: no `total`, and
  // no `gender`/`address`/`profile_photo` on each row. The staff routes are
  // callable by admin **and** system_admin, so they are the correct target for
  // every role that can reach this page. Same reasoning as DRIVERS.PROFILE in
  // Phase 4 — a constant with no consumer is deleted, not kept "just in case".
  STAFF: {
    LOGIN: '/staff/login',
    REFRESH: '/staff/refresh',
    LOGOUT: '/staff/logout',
    ME: '/staff/me',
    REVIEWS: '/staff/reviews',
    DELETE_REVIEW: (id: string | number) => `/staff/reviews/${id}`,
    USERS: '/staff/users',
    USER_PROFILE: (id: string | number) => `/staff/users/${id}`,
    TRIPS: '/staff/trips',
    CANCEL_TRIP: (id: string | number) => `/staff/trips/${id}/cancel`,
    BOOKINGS: '/staff/bookings',
    CANCEL_BOOKING: (id: string | number) => `/staff/bookings/${id}/cancel`,
    COMPLAINTS: '/staff/complaints',
    COMPLAINT: (id: string | number) => `/staff/complaints/${id}`,
    RESPOND_COMPLAINT: (id: string | number) => `/staff/complaints/${id}/respond`,
    ESCALATE_COMPLAINT: (id: string | number) => `/staff/complaints/${id}/escalate`,
    PENDING_VERIFICATIONS: '/staff/verifications/pending',
    APPROVE_VERIFICATION: (id: string | number) => `/staff/verifications/${id}/approve`,
    REJECT_VERIFICATION: (id: string | number) => `/staff/verifications/${id}/reject`,
    ESCALATED_COMPLAINTS: '/staff/escalated-complaints',
    RESOLVE_ESCALATED: (id: string | number) => `/staff/escalated-complaints/${id}/resolve`,
  },
  EMPLOYEES: {
    ALL: '/employees',
    SINGLE: (id: string | number) => `/employees/${id}`,
    TOGGLE_ACTIVE: (id: string | number) => `/employees/${id}/toggle-active`,
    RESET_PASSWORD: (id: string | number) => `/employees/${id}/reset-password`,
  },
  // `SETTINGS: '/admin/settings'` was deleted in Phase 11. There is no such
  // route — zero of the 145 routes in docs/api/route-list.json match
  // `settings` (decisions.md C1/Q1, RESOLVED-absent). Worse than a missing
  // endpoint: only 5 of the ~15 controls on the old Settings page were even
  // wired to `useSettings`, and 3 of those (Mada/Apple Pay/Visa/MC accepted
  // payments) described payment rails this product does not have — the only
  // money path is the internal SYP wallet. The whole feature (`settingsApi`,
  // `useSettings`, `Settings.tsx`, its 4 components, the `/settings` route
  // and nav entry) was removed rather than built behind a flag, because a
  // flag would have implied the page was finished and waiting for a route,
  // which was false. The client-side language/RTL toggle was preserved and
  // moved into the header identity dropdown (Phase 12). Do not re-add this
  // constant without a real route AND a rebuilt page wired control-by-control.
  // `BROADCAST_ALERT: '/admin/broadcast-alert'` was deleted in Phase 10.
  // There is no such route — `POST /admin/broadcast-alert` returns a clean
  // **404** (confirmed live 2026-08-13), unlike the SUPPORT_METRICS case above
  // which 500s. Per the Phase 0 decision a control that 404s is not shipped, so
  // `staffApi.sendBroadcastAlert` and `BroadcastAlertModal` went with it. The
  // `broadcast.*` locale keys were removed from both `ar` and `en`. Restore the
  // modal from git history if the route is ever added; do not re-add this
  // constant without one.
  // `SUPPORT_METRICS: '/staff/complaints/metrics'` was deleted in Phase 7.
  // There is no such route. Worse than missing: `"metrics"` is matched by
  // `GET /staff/complaints/{id}` and fails that action's `int` type hint, so the
  // request returns **500** with a full Ignition stack trace (APP_DEBUG=true),
  // not a 404. Filed as BUG-8 in docs/api/backend-issues.md. The Support KPI row
  // is now derived from the two `counts` blocks the list endpoints already
  // return; see SupportStats. Do not re-add this constant without a real route.
  REPORTS: '/admin/reports',
  EXPORT_PDF: '/admin/export/pdf',
};
