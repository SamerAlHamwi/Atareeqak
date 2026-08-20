import {
  LayoutGrid,
  Car,
  User,
  Users,
  ShieldCheck,
  MessageSquareText,
  Headset,
  MessageCircle,
  BarChart3,
  IdCard,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import type { AppSection } from '../../app/roles';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  labelKey: string;
  section: AppSection;
}

/** Cross-checked against `routes/index.tsx`'s `SECTION_ROUTES` by `tests/app/nav.test.ts`. */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', icon: LayoutGrid, labelKey: 'nav.dashboard', section: 'dashboard' },
  { to: '/trips', icon: Car, labelKey: 'nav.trips', section: 'trips' },
  { to: '/drivers', icon: User, labelKey: 'nav.drivers', section: 'drivers' },
  { to: '/passengers', icon: Users, labelKey: 'nav.passengers', section: 'passengers' },
  { to: '/verifications', icon: ShieldCheck, labelKey: 'nav.verifications', section: 'verifications' },
  { to: '/reviews', icon: MessageSquareText, labelKey: 'nav.reviews', section: 'reviews' },
  { to: '/support', icon: Headset, labelKey: 'nav.support', section: 'support' },
  { to: '/chat', icon: MessageCircle, labelKey: 'nav.chat', section: 'chat' },
  { to: '/reports', icon: BarChart3, labelKey: 'nav.reports', section: 'reports' },
  { to: '/staff', icon: IdCard, labelKey: 'nav.staff', section: 'staff' },
  { to: '/settings', icon: Settings, labelKey: 'nav.settings', section: 'settings' },
];
