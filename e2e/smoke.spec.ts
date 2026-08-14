import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { stubApi, seedSession } from './apiStubs';
import type { Role } from './apiStubs';

/**
 * Role → routes that role can open (mirrors src/app/roles.ts).
 * Each page must render its layout without a blank screen, crash,
 * or console error.
 */
const ROUTES_BY_ROLE: Record<Role, string[]> = {
  system_admin: [
    '/dashboard',
    '/trips',
    '/drivers',
    '/passengers',
    '/verifications',
    '/reviews',
    '/support',
    '/reports',
    '/staff',
  ],
  admin: ['/dashboard', '/trips', '/drivers', '/passengers', '/verifications', '/reviews', '/support'],
  // sycash passes the bare `staff` middleware but not `staff:admin,system_admin`,
  // so it sees the same sections as a support agent (docs/api/decisions.md Q8).
  sycash: ['/reviews', '/support'],
  support_agent: ['/reviews', '/support'],
};

const collectErrors = (page: Page): string[] => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
    }
  });
  return errors;
};

for (const [role, routes] of Object.entries(ROUTES_BY_ROLE) as [Role, string[]][]) {
  test(`${role} can open every page it has access to`, async ({ page }) => {
    await stubApi(page, role);
    await seedSession(page, role);
    const errors = collectErrors(page);

    for (const route of routes) {
      await page.goto(route);
      // The protected layout (sidebar navigation) proves auth + role routing worked
      await expect(page.locator('nav'), `nav should render on ${route}`).toBeVisible();
      // The page must actually paint content, not a blank shell
      await expect(page.locator('main'), `main content should render on ${route}`).not.toBeEmpty();
    }

    expect(errors, `no console/page errors while visiting ${routes.join(', ')}`).toEqual([]);
  });
}

test('support_agent is blocked from admin-only pages', async ({ page }) => {
  await stubApi(page, 'support_agent');
  await seedSession(page, 'support_agent');

  await page.goto('/reports');
  // RoleRoute renders the friendly no-permission screen instead of the page
  await expect(page.getByText("You don't have permission")).toBeVisible();
});

test('unauthenticated visitor is redirected to login', async ({ page }) => {
  await stubApi(page, 'system_admin');

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});

test('login form signs in and lands on the dashboard', async ({ page }) => {
  await stubApi(page, 'system_admin');
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));

  await page.goto('/login');
  await page.getByPlaceholder('example@atareeqak.com').fill('smoke');
  await page.getByPlaceholder('••••••••').fill('secret');
  await page.getByRole('button', { name: 'Login', exact: true }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.locator('nav')).toBeVisible();
});
