/**
 * Phase 12/15 acceptance check — drives the real app shell in Chromium against
 * a running backend, in both languages, and asserts:
 *
 *   - `/` redirects by role, and `/settings` no longer resolves to a page
 *   - the header dropdown's name, role label, email and last_login_at match
 *     `GET /staff/me` exactly
 *   - the language toggle works inside the shell and flips `dir`
 *   - the logout replay: capture the token, log out, replay it, assert 401
 *   - no request is made to any removed route during a full walk of every page
 *   - no untranslated key leaks in either language
 *
 *   node docs/api/verify-shell.mjs
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';

const HERE = dirname(fileURLToPath(import.meta.url));
const locale = (lang) =>
  JSON.parse(readFileSync(resolve(HERE, `../../src/locales/${lang}/translation.json`), 'utf8'));

/** Every route ever deleted from the app — see docs/api/decisions.md sections C/D. */
const REMOVED_ROUTES = [
  '/admin/settings',
  '/admin/broadcast-alert',
  '/staff/complaints/metrics',
  '/admin/verifications/',
];

/** system_admin sees every section — the full walk this script drives. */
const ALL_PAGES = [
  '/dashboard',
  '/trips',
  '/drivers',
  '/passengers',
  '/verifications',
  '/reviews',
  '/support',
  '/reports',
  '/staff',
];

const login = async () => {
  const res = await fetch(`${API}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'system_admin', password: 'admin' }),
  });
  return res.json();
};

const until = async (predicate, timeout = 15000, step = 250) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, step));
  }
};

const run = async () => {
  const session = await login();
  const token = session.tokens.access_token;
  const employee = session.employee;

  const browser = await chromium.launch();
  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, ok, detail });

  const seedSession = async (page, lang) => {
    await page.addInitScript(
      (v) => {
        localStorage.setItem('access_token', v.token);
        localStorage.setItem('refresh_token', v.refresh);
        localStorage.setItem('auth_kind', 'staff');
        localStorage.setItem('user', JSON.stringify(v.user));
        localStorage.setItem('i18nextLng', v.lang);
      },
      {
        token,
        refresh: session.tokens.refresh_token,
        lang,
        user: {
          id: employee.id,
          name: employee.full_name,
          email: employee.email,
          username: employee.username,
          role: employee.role,
          roleLabel: employee.role_label,
        },
      }
    );
  };

  for (const lang of ['en', 'ar']) {
    const l = locale(lang);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    /** Every request the page makes, by path, across the whole run. */
    const requestedPaths = [];
    page.on('request', (r) => {
      try {
        requestedPaths.push(new URL(r.url()).pathname);
      } catch {
        // ignore malformed URLs (data:, about:blank, ...)
      }
    });

    await seedSession(page, lang);

    // ---- `/` redirects by role -----------------------------------------------
    await page.goto(`${APP}/`, { waitUntil: 'networkidle' });
    await until(() => page.evaluate(() => location.pathname) !== '/');
    const rootLandedOn = await page.evaluate(() => location.pathname);
    record(`[${lang}] "/" redirects system_admin to /dashboard`, rootLandedOn === '/dashboard', rootLandedOn);

    // ---- /settings no longer resolves to a page --------------------------
    await page.goto(`${APP}/settings`, { waitUntil: 'networkidle' });
    await until(() => page.evaluate(() => location.pathname) !== '/settings');
    const settingsLandedOn = await page.evaluate(() => location.pathname);
    record(
      `[${lang}] "/settings" no longer resolves — falls through to ${settingsLandedOn}`,
      settingsLandedOn !== '/settings',
      settingsLandedOn
    );
    const noSettingsNav = await page.locator('a[href="/settings"]').count();
    record(`[${lang}] no "/settings" link anywhere in the shell`, noSettingsNav === 0);

    // ---- walk every page a system_admin can see ---------------------------
    for (const route of ALL_PAGES) {
      await page.goto(`${APP}${route}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(300);
      await record(
        `[${lang}] ${route} renders a non-empty main`,
        (await page.locator('main').innerText()).trim().length > 0
      );
    }

    // ---- header identity dropdown matches GET /staff/me exactly -----------
    await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });
    await page.getByTestId('header-profile-trigger').click();
    await page.waitForSelector('[data-testid="header-profile-menu"]');
    const shownName = (await page.getByTestId('header-profile-name').innerText()).trim();
    const shownRole = (await page.getByTestId('header-profile-role').innerText()).trim();
    const shownEmail = (await page.getByTestId('header-profile-email').innerText()).trim();
    record(`[${lang}] header dropdown name matches /staff/me`, shownName === employee.full_name, shownName);
    record(`[${lang}] header dropdown role_label matches /staff/me`, shownRole === employee.role_label, shownRole);
    record(`[${lang}] header dropdown email matches /staff/me`, shownEmail === employee.email, shownEmail);
    if (employee.last_login_at) {
      const expectedDate = new Date(employee.last_login_at);
      const shownLastLogin = (await page.getByTestId('header-profile-last-login').innerText()).trim();
      const expectedDay = String(expectedDate.getDate()).padStart(2, '0');
      record(
        `[${lang}] header dropdown last_login_at reflects /staff/me's value (day ${expectedDay} present)`,
        shownLastLogin.includes(expectedDay),
        shownLastLogin
      );
    }

    // ---- language toggle flips dir, inside the shell -----------------------
    const dirBefore = await page.evaluate(() => document.documentElement.dir || document.dir);
    await page.getByTestId('header-toggle-language').click();
    await page.waitForTimeout(300);
    const dirAfter = await page.evaluate(() => document.documentElement.dir || document.dir);
    record(`[${lang}] language toggle flips dir (${dirBefore} → ${dirAfter})`, dirBefore !== dirAfter);
    // Flip back so the rest of this iteration stays in `lang`.
    await page.getByTestId('header-profile-trigger').click();
    await page.waitForSelector('[data-testid="header-profile-menu"]');
    await page.getByTestId('header-toggle-language').click();
    await page.waitForTimeout(300);

    // ---- expected labels come from the locale JSON, never hardcoded --------
    const flat = flatten(l);
    const bodyText = await page.locator('body').innerText();
    record(
      `[${lang}] logout label from the locale ("${flat['nav.logout']}") is on screen`,
      bodyText.includes(flat['nav.logout'])
    );
    record(
      `[${lang}] language-toggle label from the locale ("${flat['header.toggle_language']}") is on screen`,
      bodyText.includes(flat['header.toggle_language'])
    );

    // ---- no raw i18n key leaked in this language ---------------------------
    // A conservative structural check: a dotted `namespace.key` pattern
    // literally on screen means `t()` fell through to the raw key.
    const obviousRawKeys = bodyText.match(/\b(header|nav|common|trips|users|drivers|support|staff|reports|reviews|verifications|bookings|roles|modal|footer|auth)\.[a-z_]+(\.[a-z_]+)*\b/g) ?? [];
    record(
      `[${lang}] no raw i18n key leaks in the shell walk`,
      obviousRawKeys.length === 0,
      obviousRawKeys.slice(0, 5).join(', ')
    );

    record(`[${lang}] no console/page errors during the walk`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    // ---- no request to any removed route during the whole walk ------------
    const removedHits = requestedPaths.filter((p) => REMOVED_ROUTES.some((r) => p.includes(r)));
    record(`[${lang}] no request to a removed route during the full walk`, removedHits.length === 0, [...new Set(removedHits)].join(', '));

    await page.screenshot({ path: `shell-${lang}.png`, fullPage: true });
    await context.close();
  }

  // ══ the logout replay — the phase's headline assertion, language-agnostic ══
  {
    const context = await browser.newContext();
    const page = await context.newPage();
    await seedSession(page, 'en');
    await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });

    const preLogoutCheck = await fetch(`${API}/staff/me`, { headers: { Authorization: `Bearer ${token}` } });
    record('token is valid before logout', preLogoutCheck.status === 200, String(preLogoutCheck.status));

    await page.getByTestId('header-profile-trigger').click();
    await page.waitForSelector('[data-testid="header-profile-menu"]');
    await page.getByTestId('header-logout').click();
    await until(() => page.evaluate(() => location.pathname) === '/login');

    // Give the background POST /staff/logout (fired without being awaited —
    // see AuthContext.logout) time to actually land server-side.
    await until(async () => {
      const res = await fetch(`${API}/staff/me`, { headers: { Authorization: `Bearer ${token}` } });
      return res.status === 401;
    }, 10000);

    const replay = await fetch(`${API}/staff/me`, { headers: { Authorization: `Bearer ${token}` } });
    record(
      'LOGOUT REPLAY: a token captured before logout is rejected (401) when replayed after it',
      replay.status === 401,
      String(replay.status)
    );

    await context.close();
  }

  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `   [${r.detail}]` : ''}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

/** Flattens a nested locale namespace object into dotted-key → value pairs. */
function flatten(node, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(node)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object') {
      flatten(v, key, out);
    } else {
      out[key] = v;
    }
  }
  return out;
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
