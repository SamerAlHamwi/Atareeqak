import type { StaffRole } from '../types/index';

/**
 * Frontend mirror of the backend route-group permissions (routes/api.php):
 * - /admin/*      → staff:admin,system_admin (dashboard, trips, drivers, users, wallet requests)
 * - /admin system_admin block → reports, PDF export, wallet charge
 * - /staff/*      → any staff role (reviews, complaints, trip cancellation)
 * - /staff admin+ → pending verifications, escalated complaints
 * - /employees/*  → system_admin only (staff management)
 */
export type AppSection =
  | 'dashboard'
  | 'trips'
  | 'drivers'
  | 'passengers'
  | 'verifications'
  | 'reviews'
  | 'support'
  | 'reports'
  | 'staff'
  | 'settings';

const ADMIN_AND_UP: StaffRole[] = ['admin', 'system_admin'];
const ALL_ROLES: StaffRole[] = ['support_agent', 'admin', 'system_admin'];

export const SECTION_ROLES: Record<AppSection, StaffRole[]> = {
  dashboard: ADMIN_AND_UP,
  trips: ADMIN_AND_UP,
  drivers: ADMIN_AND_UP,
  passengers: ADMIN_AND_UP,
  verifications: ADMIN_AND_UP,
  reviews: ALL_ROLES,
  support: ALL_ROLES,
  reports: ['system_admin'],
  staff: ['system_admin'],
  // Settings are backed by /admin/settings, which requires admin or above
  settings: ADMIN_AND_UP,
};

export const canAccess = (role: StaffRole | null | undefined, section: AppSection): boolean =>
  !!role && SECTION_ROLES[section].includes(role);

/** Landing page after login: admins get the dashboard, support agents their inbox. */
export const defaultRouteForRole = (role: StaffRole | null | undefined): string =>
  canAccess(role, 'dashboard') ? '/dashboard' : '/support';
