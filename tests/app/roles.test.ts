import { describe, it, expect } from 'vitest';
import { canAccess, defaultRouteForRole, SECTION_ROLES } from '../../src/app/roles';
import type { AppSection } from '../../src/app/roles';
import type { StaffRole } from '../../src/types/index';

const ALL_SECTIONS = Object.keys(SECTION_ROLES) as AppSection[];

describe('section access mirrors the backend middleware', () => {
  it('gives system_admin every section', () => {
    // routes/api.php: system_admin passes every staff:* gate, including
    // staff:system_admin (employees, reports, PDF export).
    for (const section of ALL_SECTIONS) {
      expect(canAccess('system_admin', section), section).toBe(true);
    }
  });

  it('limits admin to everything except system_admin-only sections', () => {
    expect(canAccess('admin', 'dashboard')).toBe(true);
    expect(canAccess('admin', 'verifications')).toBe(true);
    // staff:system_admin — /employees/* and the /admin system_admin block
    expect(canAccess('admin', 'staff')).toBe(false);
    expect(canAccess('admin', 'reports')).toBe(false);
  });

  it('limits support_agent to the any-role staff sections', () => {
    expect(canAccess('support_agent', 'reviews')).toBe(true);
    expect(canAccess('support_agent', 'support')).toBe(true);
    expect(canAccess('support_agent', 'dashboard')).toBe(false);
    expect(canAccess('support_agent', 'trips')).toBe(false);
  });

  it('grants sycash only what the staff middleware actually allows', () => {
    // StaffRole::isAdminRole() is true for sycash so it may use /admin/login,
    // but every /admin/* group is gated on `staff:admin,system_admin`, which
    // excludes it. Granting it dashboard access would produce guaranteed 403s.
    // Tracked as decisions.md Q8.
    expect(canAccess('sycash', 'reviews')).toBe(true);
    expect(canAccess('sycash', 'support')).toBe(true);
    expect(canAccess('sycash', 'dashboard')).toBe(false);
    expect(canAccess('sycash', 'reports')).toBe(false);
    expect(canAccess('sycash', 'staff')).toBe(false);
  });

  it('treats a missing role as having no access', () => {
    for (const section of ALL_SECTIONS) {
      expect(canAccess(null, section), section).toBe(false);
      expect(canAccess(undefined, section), section).toBe(false);
    }
  });
});

describe('defaultRouteForRole', () => {
  it.each<[StaffRole, string]>([
    ['system_admin', '/dashboard'],
    ['admin', '/dashboard'],
    ['sycash', '/support'],
    ['support_agent', '/support'],
  ])('sends %s to %s', (role, route) => {
    expect(defaultRouteForRole(role)).toBe(route);
  });
});
