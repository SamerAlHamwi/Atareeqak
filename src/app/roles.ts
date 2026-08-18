import type { StaffRole } from '../types/index';

/**
 * Frontend mirror of the backend route-group permissions (routes/api.php),
 * verified route-by-route against docs/api/route-list.json.
 *
 * - /admin/*                    → staff:admin,system_admin
 *     dashboard, trips, drivers, users/passengers, wallet requests, bans
 * - /admin/* system_admin block → staff:admin,system_admin + staff:system_admin
 *     reports, PDF export, wallet charge, /admin/verifications
 * - /staff/*                    → staff (any active employee)
 *     reviews, complaints, staff user/trip/booking lists, trip cancellation
 * - /staff/* admin+ block       → staff + staff:admin,system_admin
 *     pending verifications, escalated complaints
 * - /employees/*                → staff:system_admin
 *     employee management
 *
 * `sycash` is the wrinkle. StaffRole::isAdminRole() is true for it (so it may
 * log in via /admin/login), but every /admin/* group is gated on
 * `staff:admin,system_admin`, which does NOT include it — so a sycash token is
 * rejected by all of them. Until that inconsistency is resolved (decisions.md
 * Q8) sycash is granted exactly what the middleware actually lets through:
 * the any-role /staff/* sections.
 */
export type AppSection =
  | 'dashboard'
  | 'trips'
  | 'drivers'
  | 'passengers'
  | 'verifications'
  | 'reviews'
  | 'support'
  | 'chat'
  | 'reports'
  | 'staff'
  | 'settings';

/** Matches the `staff:admin,system_admin` middleware argument exactly. */
const ADMIN_AND_UP: StaffRole[] = ['admin', 'system_admin'];

/** Matches the bare `staff` middleware: any active employee, sycash included. */
const ALL_ROLES: StaffRole[] = ['support_agent', 'sycash', 'admin', 'system_admin'];

export const SECTION_ROLES: Record<AppSection, StaffRole[]> = {
  dashboard: ADMIN_AND_UP,
  trips: ADMIN_AND_UP,
  drivers: ADMIN_AND_UP,
  passengers: ADMIN_AND_UP,
  verifications: ADMIN_AND_UP,
  reviews: ALL_ROLES,
  support: ALL_ROLES,
  // `Route::prefix('chat')` sits inside the bare `staff` group in routes/api.php
  // — no `staff:...` argument — so every active employee reaches all three
  // chat routes, sycash included.
  chat: ALL_ROLES,
  reports: ['system_admin'],
  staff: ['system_admin'],
  // `/admin/policies/*` (GET + PUT) is nested under the same
  // `staff:system_admin` block as the other system-admin-only admin routes.
  settings: ['system_admin'],
};

export const canAccess = (role: StaffRole | null | undefined, section: AppSection): boolean =>
  !!role && SECTION_ROLES[section].includes(role);

/** Landing page after login: admins get the dashboard, everyone else their inbox. */
export const defaultRouteForRole = (role: StaffRole | null | undefined): string =>
  canAccess(role, 'dashboard') ? '/dashboard' : '/support';
