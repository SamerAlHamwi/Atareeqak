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

/** Every route ever deleted from the app. A request to any of these during a
 * walkthrough means a regression re-introduced a call to a route that does
 * not exist server-side — see docs/api/decisions.md sections C/D. */
const REMOVED_ROUTES = [
  '/admin/settings',
  '/admin/broadcast-alert',
  '/staff/complaints/metrics',
  '/admin/verifications/', // the system_admin-only twin route; the staff/* ones are used instead
];

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

/**
 * Chromium logs a "Failed to load resource … 500" console entry for any
 * failed XHR/fetch, regardless of whether the app handles it gracefully. The
 * `/staff` page's `GET /employees` is *expected* to 500 (BUG-1) — that is the
 * whole point of stubbing it as a real 500 instead of a fake success — so
 * that specific, known noise is filtered out here. Same filter
 * `verify-staff.mjs` uses live against the real backend, for the same reason.
 */
const unexpectedErrors = (errors: string[]): string[] =>
  errors.filter((e) => !/500|Request failed/i.test(e));

/** Fails the moment any request touches a route that was deliberately removed. */
const watchForRemovedRoutes = (page: Page): string[] => {
  const hits: string[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (REMOVED_ROUTES.some((removed) => url.pathname.includes(removed))) {
      hits.push(`${request.method()} ${url.pathname}`);
    }
  });
  return hits;
};

for (const [role, routes] of Object.entries(ROUTES_BY_ROLE) as [Role, string[]][]) {
  test(`${role} can open every page it has access to`, async ({ page }) => {
    const { unstubbed } = await stubApi(page, role);
    await seedSession(page, role);
    const errors = collectErrors(page);
    const removedRouteHits = watchForRemovedRoutes(page);

    for (const route of routes) {
      await page.goto(route);
      // The protected layout (sidebar navigation) proves auth + role routing worked
      await expect(page.locator('nav'), `nav should render on ${route}`).toBeVisible();
      // The page must actually paint content, not a blank shell
      await expect(page.locator('main'), `main content should render on ${route}`).not.toBeEmpty();
    }

    expect(
      unexpectedErrors(errors),
      `no console/page errors while visiting ${routes.join(', ')}`
    ).toEqual([]);
    expect(removedRouteHits, 'no request to a removed route').toEqual([]);
    expect(unstubbed, 'every request must have an explicit apiStubs.ts rule').toEqual([]);
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

/**
 * The full `system_admin` walkthrough the plan asks for:
 * login → dashboard → trips page 2 → ban a user → approve a verification →
 * resolve a complaint → approve a wallet request → create an employee.
 *
 * The last step cannot pass against the real backend — all six `/employees`
 * endpoints 500 (BUG-1) — so it is stubbed as the real 500 and the test
 * asserts the UI's "unavailable" state, never a fabricated success. A green
 * step here for a destructive endpoint that write-then-500s would be the
 * worst artifact in the repo.
 */
test('system_admin walkthrough: login through every destructive action', async ({ page }) => {
  const { unstubbed } = await stubApi(page, 'system_admin');
  await page.addInitScript(() => localStorage.setItem('i18nextLng', 'en'));
  const errors = collectErrors(page);
  const removedRouteHits = watchForRemovedRoutes(page);

  await test.step('login', async () => {
    await page.goto('/login');
    await page.getByPlaceholder('example@atareeqak.com').fill('smoke');
    await page.getByPlaceholder('••••••••').fill('secret');
    await page.getByRole('button', { name: 'Login', exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  await test.step('dashboard', async () => {
    await expect(page.locator('main')).not.toBeEmpty();
  });

  await test.step('trips page 2', async () => {
    await page.goto('/trips');
    const nextButton = page.getByTestId('pagination-next');
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/admin/trips') && req.url().includes('page=2')),
      nextButton.click(),
    ]);
    expect(request.url()).toContain('page=2');
  });

  await test.step('ban a user', async () => {
    await page.goto('/passengers');
    await page.getByTestId('user-ban-toggle-501').click();
    await page.getByTestId('confirm-action-reason').fill('Repeated policy violations reported by riders.');
    const [request] = await Promise.all([
      page.waitForRequest((req) => req.url().includes('/admin/users/501/ban') && req.method() === 'POST'),
      page.getByTestId('confirm-action-submit').click(),
    ]);
    expect(request.method()).toBe('POST');
  });

  await test.step('approve a verification', async () => {
    await page.goto('/verifications');
    await page.getByTestId('verification-row-502').click();
    await page.getByTestId('verification-approve').click();
    await page.getByTestId('approve-national-id').fill('WT-0001');
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/staff/verifications/502/approve') && req.method() === 'POST'
      ),
      page.getByTestId('approve-confirm').click(),
    ]);
    expect(request.method()).toBe('POST');
  });

  await test.step('resolve a complaint', async () => {
    await page.goto('/support');
    await page.getByTestId('complaint-row').click();
    await page.getByTestId('complaint-respond').click();
    await page.getByTestId('confirm-action-reason').fill('Issue investigated and resolved with the passenger.');
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/staff/complaints/503/respond') && req.method() === 'PATCH'
      ),
      page.getByTestId('confirm-action-submit').click(),
    ]);
    expect(request.method()).toBe('PATCH');
  });

  await test.step('approve a wallet request', async () => {
    await page.goto('/reports');
    await page.getByTestId('approve-request-504').click();
    await page.getByTestId('confirm-action-reason').fill('Receipt verified.');
    const [request] = await Promise.all([
      page.waitForRequest(
        (req) => req.url().includes('/admin/wallet/requests/504/approve') && req.method() === 'POST'
      ),
      page.getByTestId('confirm-action-submit').click(),
    ]);
    expect(request.method()).toBe('POST');
  });

  await test.step('create an employee — BUG-1: 500 server-side, asserted as unavailable, never faked as success', async () => {
    await page.goto('/staff');
    // GET /employees 500s (stubbed as the real error, not a fabricated
    // success), so the page must render the labelled unavailable state —
    // not an empty table, and the create form must not be reachable at all.
    await expect(page.getByTestId('staff-unavailable')).toBeVisible();
    await expect(page.getByTestId('create-submit')).toHaveCount(0);
  });

  expect(unexpectedErrors(errors), 'no console/page errors during the walkthrough').toEqual([]);
  expect(removedRouteHits, 'no request to a removed route during the walkthrough').toEqual([]);
  expect(unstubbed, 'every request must have an explicit apiStubs.ts rule').toEqual([]);
});
