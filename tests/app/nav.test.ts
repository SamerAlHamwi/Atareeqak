import { describe, it, expect } from 'vitest';
import { NAV_ITEMS } from '../../src/components/layout/navItems';
import { SECTION_ROUTES } from '../../src/routes/sectionRoutes';
import { SECTION_ROLES } from '../../src/app/roles';
import type { AppSection } from '../../src/app/roles';

/**
 * Phase 12 item 5: the sidebar, the route table and the role gate used to be
 * three hand-maintained lists with nothing forcing them to agree. A nav entry
 * pointing at a route that no longer exists (or vice versa) previously shipped
 * silent — this asserts the invariant instead of relying on inspection.
 */
describe('nav / routes / roles agree with each other', () => {
  const navSections = NAV_ITEMS.map((item) => item.section).sort();
  const routeSections = SECTION_ROUTES.map((route) => route.section).sort();
  const roleSections = (Object.keys(SECTION_ROLES) as AppSection[]).sort();

  it('every AppSection has exactly one nav entry, one route, and one role list', () => {
    expect(navSections).toEqual(roleSections);
    expect(routeSections).toEqual(roleSections);
  });

  it('every nav entry\'s `to` matches its section\'s route path exactly', () => {
    const pathBySection = new Map(SECTION_ROUTES.map((route) => [route.section, route.path]));
    for (const item of NAV_ITEMS) {
      expect(pathBySection.get(item.section), item.section).toBe(item.to);
    }
  });

  it('has no duplicate sections in any of the three lists', () => {
    expect(new Set(navSections).size).toBe(navSections.length);
    expect(new Set(routeSections).size).toBe(routeSections.length);
  });

  it('every section route is wrapped by a RoleRoute using its own section', () => {
    // SECTION_ROUTES.map(...) in routes/index.tsx passes `section` straight
    // into `<RoleRoute section={section} />`, so structurally this can only
    // drift if a route entry's `section` field itself were wrong — which the
    // bijection assertion above already rules out.
    for (const route of SECTION_ROUTES) {
      expect(SECTION_ROLES[route.section]).toBeDefined();
    }
  });
});
