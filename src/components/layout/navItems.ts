import type { AppSection } from '../../app/roles';

export interface NavItem {
  to: string;
  icon: string;
  labelKey: string;
  section: AppSection;
}

/** Cross-checked against `routes/index.tsx`'s `SECTION_ROUTES` by `tests/app/nav.test.ts`. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: 'grid_view', labelKey: 'nav.dashboard', section: 'dashboard' },
  { to: '/trips', icon: 'directions_car', labelKey: 'nav.trips', section: 'trips' },
  { to: '/drivers', icon: 'person', labelKey: 'nav.drivers', section: 'drivers' },
  { to: '/passengers', icon: 'group', labelKey: 'nav.passengers', section: 'passengers' },
  { to: '/verifications', icon: 'verified_user', labelKey: 'nav.verifications', section: 'verifications' },
  { to: '/reviews', icon: 'rate_review', labelKey: 'nav.reviews', section: 'reviews' },
  { to: '/support', icon: 'support_agent', labelKey: 'nav.support', section: 'support' },
  { to: '/reports', icon: 'assessment', labelKey: 'nav.reports', section: 'reports' },
  { to: '/staff', icon: 'badge', labelKey: 'nav.staff', section: 'staff' },
];
