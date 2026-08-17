import React, { lazy } from 'react';
import type { AppSection } from '../app/roles';

// Route-level code splitting: each page becomes its own chunk so the initial
// bundle only carries the shell (layouts, router, auth context).
const Dashboard = lazy(() => import('../features/dashboard/pages/Dashboard'));
const Users = lazy(() => import('../features/users/pages/Users'));
const UserDetails = lazy(() => import('../features/users/pages/UserDetails'));
const Drivers = lazy(() => import('../features/drivers/pages/Drivers'));
const DriverDetails = lazy(() => import('../features/drivers/pages/DriverDetails'));
const Trips = lazy(() => import('../features/trips/pages/Trips'));
const Reports = lazy(() => import('../features/reports/pages/Reports'));
const Support = lazy(() => import('../features/support/pages/Support'));
const Chat = lazy(() => import('../features/chat/pages/Chat'));
const Staff = lazy(() => import('../features/staff/pages/Staff'));
const Verifications = lazy(() => import('../features/verification/pages/Verifications'));
const Reviews = lazy(() => import('../features/reviews/pages/Reviews'));

type LazyPage = React.LazyExoticComponent<React.ComponentType>;

export interface SectionRouteConfig {
  section: AppSection;
  path: string;
  Component: LazyPage;
  /** A detail route nested under the same section/RoleRoute, not itself a nav entry. */
  detail?: { path: string; Component: LazyPage };
}

/**
 * The single source of truth linking a nav section to its route(s). Every
 * entry is wrapped in `RoleRoute` (see `routes/index.tsx`), so "every
 * protected route has a RoleRoute" is structural, not an inspection someone
 * can forget to redo. `MainLayout.NAV_ITEMS` and this array are cross-checked
 * for a perfect section/path match by `tests/app/nav.test.ts` — a route added
 * here without a nav entry (or vice versa) fails that test rather than
 * shipping silently.
 */
export const SECTION_ROUTES: SectionRouteConfig[] = [
  { section: 'dashboard', path: '/dashboard', Component: Dashboard },
  {
    section: 'passengers',
    path: '/passengers',
    Component: Users,
    detail: { path: '/passengers/:userId', Component: UserDetails },
  },
  {
    section: 'drivers',
    path: '/drivers',
    Component: Drivers,
    detail: { path: '/drivers/:driverId', Component: DriverDetails },
  },
  { section: 'trips', path: '/trips', Component: Trips },
  { section: 'verifications', path: '/verifications', Component: Verifications },
  { section: 'reviews', path: '/reviews', Component: Reviews },
  { section: 'support', path: '/support', Component: Support },
  { section: 'chat', path: '/chat', Component: Chat },
  { section: 'reports', path: '/reports', Component: Reports },
  { section: 'staff', path: '/staff', Component: Staff },
];
