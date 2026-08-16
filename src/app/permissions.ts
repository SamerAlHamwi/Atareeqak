import type { StaffRole } from '../types/index';

/**
 * Frontend mirror of `/permissions.json` (repo root) — the product's
 * role → permission spec. Unlike `SECTION_ROLES` in `./roles.ts`, which gates
 * whole screens and is verified route-by-route against the actual backend
 * middleware, this file gates individual buttons/actions *within* a screen a
 * role can already reach. It is a permissions-as-spec layer, not a mirror of
 * `staff:...` middleware — some entries below (documented per-role) currently
 * have no reachable UI, or that UI is intentionally more restrictive than the
 * spec; those cases are called out rather than silently "fixed" into a screen
 * that would just 403 against the real API.
 */
export type Permission =
  // support_agent (16) — complaint handling, moderation, read-only lookups
  | 'View Complaints'
  | 'Respond to Complaint'
  | 'Update Complaint Status'
  | 'Escalate Complaint'
  | 'View Bookings'
  | 'Cancel Booking'
  | 'Cancel Trip'
  | 'View Trips'
  | 'View Users'
  | 'Search User'
  | 'View Reviews'
  | 'Delete Review'
  | 'View Reports'
  | 'View Request Contact With Us'
  | 'Contact With User'
  | 'Open Chat With User'
  // admin (+14) — verification, account actions, wallet/refund
  | 'View Escalate'
  | 'Review Verification Request'
  | 'Approve Verification'
  | 'Reject Verification'
  | 'View User Profile'
  | 'View ID Document'
  | 'Suspend User'
  | 'Ban User'
  | 'Unban User'
  | 'Approve Refund'
  | 'View Wallets'
  | 'View Transactions'
  | 'Charge Wallet'
  | 'Withdraw Wallet Balance'
  // system_admin (+6) — platform/staff administration
  | 'View System Statistics'
  | 'Create Admin Account'
  | 'Assign Roles'
  | 'Deactivate Admin'
  | 'Generate Reports'
  | 'Manage System Settings';

const SUPPORT_AGENT_PERMISSIONS: readonly Permission[] = [
  'View Complaints',
  'Respond to Complaint',
  'Update Complaint Status',
  'Escalate Complaint',
  'View Bookings',
  'Cancel Booking',
  'Cancel Trip',
  'View Trips',
  'View Users',
  'Search User',
  'View Reviews',
  'Delete Review',
  'View Reports',
  'View Request Contact With Us',
  'Contact With User',
  'Open Chat With User',
];

const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...SUPPORT_AGENT_PERMISSIONS,
  'View Escalate',
  'Review Verification Request',
  'Approve Verification',
  'Reject Verification',
  'View User Profile',
  'View ID Document',
  'Suspend User',
  'Ban User',
  'Unban User',
  'Approve Refund',
  'View Wallets',
  'View Transactions',
  'Charge Wallet',
  'Withdraw Wallet Balance',
];

const SYSTEM_ADMIN_PERMISSIONS: readonly Permission[] = [
  ...ADMIN_PERMISSIONS,
  'View System Statistics',
  'Create Admin Account',
  'Assign Roles',
  'Deactivate Admin',
  'Generate Reports',
  'Manage System Settings',
];

/**
 * `permissions.json` defines exactly three roles: support_agent, admin,
 * system_admin. `sycash` (financial administrator) isn't in it. Per the
 * existing `ALL_ROLES` wrinkle documented in `./roles.ts`, sycash only ever
 * reaches the any-staff-role sections (reviews, support) today — the same
 * surface support_agent has — so it gets exactly support_agent's permission
 * set rather than an invented, spec-less one.
 */
export const ROLE_PERMISSIONS: Record<StaffRole, readonly Permission[]> = {
  support_agent: SUPPORT_AGENT_PERMISSIONS,
  sycash: SUPPORT_AGENT_PERMISSIONS,
  admin: ADMIN_PERMISSIONS,
  system_admin: SYSTEM_ADMIN_PERMISSIONS,
};

export const hasPermission = (
  role: StaffRole | null | undefined,
  permission: Permission
): boolean => !!role && ROLE_PERMISSIONS[role].includes(permission);

export const hasAnyPermission = (
  role: StaffRole | null | undefined,
  permissions: readonly Permission[]
): boolean => permissions.some((permission) => hasPermission(role, permission));
