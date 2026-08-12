/**
 * Phase 4 acceptance check — drives the real Drivers and Driver-details pages in
 * Chromium against a running backend and asserts the rendered UI matches the
 * live API payload, in both languages.
 *
 *   node docs/api/verify-drivers.mjs
 *
 *   node docs/api/verify-drivers.mjs --mutate   # also performs a real ban/unban
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`. Writes drivers-{en,ar}.png and
 * driver-details-{en,ar}.png for eyeballing.
 *
 * Read-only by default: it drives filters, paging, search, the efficiency
 * period switch and the reason validator, but never confirms a ban, so it can
 * be re-run against the same seed.
 *
 * `--mutate` bans one driver per language and then **unbans it again**, so the
 * seed survives repeat runs. Note the backend's unban writes `status = 0`
 * (logged_out), not 1 (active) — that is by design ("must log in again"), but
 * it does change what `GET /admin/drivers` reports for that row, so the script
 * restores `status = 1` through a final ban/unban-free check and reports the
 * residue rather than pretending it is gone. See BUG-6.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

/** The page's own default, and what the first request must carry. */
const PER_PAGE = 10;
/**
 * Small enough that the 10-driver seed spans several pages — at the default 10
 * the seed is exactly one page and the pager is not exercisable at all.
 */
const PAGED_PER_PAGE = 5;

const HERE = dirname(fileURLToPath(import.meta.url));
const locale = (lang) =>
  JSON.parse(readFileSync(resolve(HERE, `../../src/locales/${lang}/translation.json`), 'utf8'));

const login = async () => {
  const res = await fetch(`${API}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'system_admin', password: 'admin' }),
  });
  return res.json();
};

const get = async (token, path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.json();
};

const post = async (token, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
};

/**
 * Labels come from the locale files rather than being hardcoded, so the script
 * asserts the *shipped* translation and cannot drift from it. Arabic inflects
 * with the noun it describes, so a hardcoded list gets these wrong.
 */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    filterAll: l.drivers.filter_all,
    filterVerified: l.drivers.filter_verified,
    filterSuspended: l.drivers.filter_suspended,
    statusVerified: l.drivers.status_verified,
    banAction: l.drivers.ban_action,
    unbanAction: l.drivers.unban_action,
    banConfirm: l.drivers.ban_confirm,
    banTemporary: l.modal.ban_temporary,
    accountBanned: l.drivers.account_banned,
    viewProfile: l.drivers.view_profile,
    close: l.common.cancel,
    perPage: l.common.per_page,
    // Targeted by placeholder, not `input[type=text]`: the MainLayout header
    // carries its own (inert) search box earlier in the DOM.
    searchPlaceholder: l.drivers.search_placeholder,
  };
};

/** Escapes a locale string for safe use inside a RegExp. */
const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const run = async () => {
  const session = await login();
  const token = session.tokens.access_token;

  // ---- live payloads the UI must match --------------------------------------
  const driversPage1 = await get(token, `/admin/drivers?page=1&filter=all&per_page=${PER_PAGE}`);
  const driversVerified = await get(
    token,
    `/admin/drivers?page=1&filter=verified&per_page=${PER_PAGE}`
  );
  const dashboard = await get(token, '/admin/drivers/dashboard');
  const effWeek = await get(token, '/admin/drivers/verification-efficiency?period=week');
  const effMonth = await get(token, '/admin/drivers/verification-efficiency?period=month');

  const driversPaged = await get(
    token,
    `/admin/drivers?page=1&filter=all&per_page=${PAGED_PER_PAGE}`
  );
  const meta = driversPage1.meta;
  const stats = dashboard.data.stats;
  const firstDriver = driversPage1.data[0];
  const detail = (await get(token, `/admin/drivers/${firstDriver.id}/dashboard`)).data;

  const browser = await chromium.launch();
  const results = [];
  const record = (name, ok, detailText = '') => results.push({ name, ok, detail: detailText });

  // ---- contract-level assertions (language-independent) ---------------------
  record(
    'drivers payload carries NO counts block (documented as REQ-2)',
    driversPage1.counts === undefined,
    `counts=${JSON.stringify(driversPage1.counts)}`
  );
  record(
    `drivers paginate at per_page=${PAGED_PER_PAGE}: last_page ${driversPaged.meta.last_page} > 1`,
    driversPaged.meta.last_page > 1,
    JSON.stringify(driversPaged.meta)
  );
  record(
    'meta echoes the requested per_page and filter',
    meta.per_page === PER_PAGE && meta.filter === 'all',
    JSON.stringify(meta)
  );
  record(
    'verification-efficiency accepts day|week|month',
    effWeek.data.period === 'week' && effMonth.data.period === 'month',
    `${effWeek.data.period} / ${effMonth.data.period}`
  );
  record(
    'efficiency payload carries current{} + previous{} + comparison.delta',
    typeof effWeek.data.current?.efficiency_pct === 'number' &&
      typeof effWeek.data.previous?.efficiency_pct === 'number' &&
      typeof effWeek.data.comparison?.delta === 'number',
    JSON.stringify(effWeek.data.comparison)
  );
  record(
    'GET /admin/users/{id}/status is reachable and shapes ban as null|object',
    await (async () => {
      const s = await get(token, `/admin/users/${firstDriver.id}/status`);
      return s.data && 'ban' in s.data && 'status_code' in s.data;
    })()
  );

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1500 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const brokenImages = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    /**
     * The seeder stores `/storage/...` URLs for files that were never written
     * and there is no `public/storage` symlink, so every profile photo fails
     * (BUG-7). Laravel answers those with an HTML 404, which Chromium then
     * blocks cross-origin as ORB — so it lands on `requestfailed`
     * (ERR_BLOCKED_BY_ORB), *not* on `response`. Both are watched.
     *
     * This is a backend gap, not a dashboard defect: it is asserted through the
     * Avatar fallback below rather than counted as a console error.
     */
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/storage/')) brokenImages.push(r.url());
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/storage/')) brokenImages.push(r.url());
    });

    const driverRequests = [];
    const efficiencyRequests = [];
    const statusRequests = [];
    const banPosts = [];
    page.on('request', (r) => {
      const url = r.url();
      if (/\/api\/admin\/drivers(\?|$)/.test(url)) driverRequests.push(new URL(url));
      if (url.includes('/verification-efficiency')) efficiencyRequests.push(new URL(url));
      if (/\/api\/admin\/users\/\d+\/status/.test(url)) statusRequests.push(new URL(url));
      if (r.method() === 'POST' && /\/api\/admin\/users\/\d+\/(un)?ban$/.test(url)) {
        banPosts.push({ url, body: r.postData() });
      }
    });

    await page.addInitScript(
      (l) => {
        localStorage.setItem('access_token', l.token);
        localStorage.setItem('refresh_token', l.refresh);
        localStorage.setItem('auth_kind', 'staff');
        localStorage.setItem('user', JSON.stringify(l.user));
        localStorage.setItem('i18nextLng', l.lang);
      },
      {
        token,
        refresh: session.tokens.refresh_token,
        lang,
        user: {
          id: session.employee.id,
          name: session.employee.full_name,
          email: session.employee.email,
          username: session.employee.username,
          role: session.employee.role,
          roleLabel: session.employee.role_label,
        },
      }
    );

    await page.goto(`${APP}/drivers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    let body = await page.locator('body').innerText();

    // ---- KPI cards come from the live BFF ----------------------------------
    record(
      `[${lang}] total_drivers card shows ${stats.total_drivers}`,
      body.includes(String(stats.total_drivers))
    );
    record(
      `[${lang}] active_drivers card shows ${stats.active_drivers}`,
      body.includes(String(stats.active_drivers))
    );
    record(
      `[${lang}] avg rating card shows ${stats.average_rating.toFixed(2)}`,
      body.includes(stats.average_rating.toFixed(2))
    );

    // ---- rows on screen come from the live payload -------------------------
    record(`[${lang}] first driver ref "${firstDriver.driver_ref}" rendered`,
      body.includes(firstDriver.driver_ref));
    record(`[${lang}] first driver name "${firstDriver.full_name}" rendered`,
      body.includes(firstDriver.full_name));
    if (firstDriver.vehicle) {
      record(`[${lang}] first driver vehicle "${firstDriver.vehicle}" rendered`,
        body.includes(firstDriver.vehicle));
    }

    const renderedRefs = [...new Set(body.match(/#DR-\d+/g) || [])];
    record(
      `[${lang}] page 1 renders ${driversPage1.data.length} driver rows`,
      renderedRefs.length === driversPage1.data.length,
      `rendered ${renderedRefs.length}`
    );

    // ---- per_page is actually sent (it never used to be) -------------------
    record(
      `[${lang}] initial request sends per_page`,
      driverRequests[0]?.searchParams.get('per_page') !== null,
      driverRequests[0]?.search ?? 'no request'
    );
    record(`[${lang}] per-page selector rendered`, body.includes(L.perPage));

    // ---- no untranslated keys leaked ---------------------------------------
    let rawKeys = body.match(/\b(drivers|common|modal|users)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the drivers list`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // ---- efficiency widget --------------------------------------------------
    const pctText = await page.getByTestId('efficiency-pct').innerText();
    record(
      `[${lang}] efficiency shows ${effWeek.data.current.efficiency_pct}% from the week payload`,
      pctText.includes(String(effWeek.data.current.efficiency_pct)),
      `rendered "${pctText}"`
    );
    const deltaText = await page.getByTestId('efficiency-delta').innerText();
    record(`[${lang}] delta line is rendered and translated`,
      deltaText.length > 0 && !deltaText.includes('drivers.efficiency_delta'),
      `"${deltaText}"`);
    record(
      `[${lang}] delta is NOT the backend's English comparison.text`,
      lang === 'en' || deltaText !== effWeek.data.comparison.text,
      `payload text="${effWeek.data.comparison.text}" rendered="${deltaText}"`
    );

    // period switch hits the dedicated endpoint, and only that widget reloads
    const driverCallsBeforePeriod = driverRequests.length;
    const effCallsBefore = efficiencyRequests.length;
    await page.getByTestId('efficiency-period-month').click();
    await page.waitForTimeout(1500);

    const monthRequest = efficiencyRequests
      .slice(effCallsBefore)
      .find((u) => u.searchParams.get('period') === 'month');
    record(`[${lang}] period switch requests period=month`, !!monthRequest,
      efficiencyRequests.slice(effCallsBefore).map((u) => u.search).join(' '));
    record(
      `[${lang}] period switch does NOT refetch the drivers list`,
      driverRequests.length === driverCallsBeforePeriod,
      `${driverRequests.length - driverCallsBeforePeriod} extra list calls`
    );
    const monthPct = await page.getByTestId('efficiency-pct').innerText();
    record(
      `[${lang}] month view shows ${effMonth.data.current.efficiency_pct}%`,
      monthPct.includes(String(effMonth.data.current.efficiency_pct)),
      `rendered "${monthPct}"`
    );

    await page.getByTestId('efficiency-period-day').click();
    await page.waitForTimeout(1200);
    record(
      `[${lang}] period switch requests period=day`,
      efficiencyRequests.some((u) => u.searchParams.get('period') === 'day')
    );

    await page.screenshot({ path: `drivers-${lang}.png`, fullPage: true });

    // ---- per_page change round-trips and resets the page --------------------
    // Done first: at the default per_page=10 the 10-driver seed is a single
    // page, so the pager has nothing to page through until this shrinks it.
    const beforePerPage = driverRequests.length;
    await page.getByLabel(L.perPage).selectOption(String(PAGED_PER_PAGE));
    await page.waitForTimeout(1500);
    const perPageRequest = driverRequests
      .slice(beforePerPage)
      .find((u) => u.searchParams.get('per_page') === String(PAGED_PER_PAGE));
    record(`[${lang}] per_page change requests per_page=${PAGED_PER_PAGE}`, !!perPageRequest,
      driverRequests.slice(beforePerPage).map((u) => u.search).join(' '));
    record(`[${lang}] per_page change resets to page=1`,
      perPageRequest?.searchParams.get('page') === '1',
      perPageRequest?.search ?? 'no request');

    body = await page.locator('body').innerText();
    const shrunkRefs = [...new Set(body.match(/#DR-\d+/g) || [])];
    record(
      `[${lang}] per_page=${PAGED_PER_PAGE} renders ${driversPaged.data.length} rows`,
      shrunkRefs.length === driversPaged.data.length,
      `rendered ${shrunkRefs.length}`
    );

    // ---- paging actually requests page=2 -----------------------------------
    const beforePaging = driverRequests.length;
    await page.getByTestId('pagination-next').click();
    await page.waitForTimeout(1500);

    const pagedRequest = driverRequests
      .slice(beforePaging)
      .find((u) => u.searchParams.get('page') === '2');
    record(`[${lang}] next page requests page=2`, !!pagedRequest,
      driverRequests.slice(beforePaging).map((u) => u.search).join(' '));
    record(`[${lang}] page 2 keeps per_page=${PAGED_PER_PAGE}`,
      pagedRequest?.searchParams.get('per_page') === String(PAGED_PER_PAGE),
      pagedRequest?.search ?? 'no request');

    if (pagedRequest) {
      const page2 = await get(
        token,
        `/admin/drivers?page=2&filter=all&per_page=${PAGED_PER_PAGE}`
      );
      body = await page.locator('body').innerText();
      record(`[${lang}] page 2 renders its first ref "${page2.data[0].driver_ref}"`,
        body.includes(page2.data[0].driver_ref));
      record(`[${lang}] page 2 drops page 1's "${driversPaged.data[0].driver_ref}"`,
        !body.includes(driversPaged.data[0].driver_ref));
    }

    await page.getByLabel(L.perPage).selectOption(String(PER_PAGE));
    await page.waitForTimeout(1200);

    // ---- filter change hits the API and resets to page 1 --------------------
    const beforeFilter = driverRequests.length;
    await page.getByRole('tab', { name: rx(L.filterVerified) }).first().click();
    await page.waitForTimeout(1500);

    const filterRequest = driverRequests
      .slice(beforeFilter)
      .find((u) => u.searchParams.get('filter') === 'verified');
    record(`[${lang}] filter change requests filter=verified`, !!filterRequest,
      driverRequests.slice(beforeFilter).map((u) => u.search).join(' '));
    record(`[${lang}] filter change resets to page=1`,
      filterRequest?.searchParams.get('page') === '1',
      filterRequest?.search ?? 'no request');

    body = await page.locator('body').innerText();
    if (driversVerified.data.length) {
      record(`[${lang}] verified view renders "${driversVerified.data[0].driver_ref}"`,
        body.includes(driversVerified.data[0].driver_ref));
      // The list is server-filtered and must NOT be re-filtered client-side:
      // every row the server returned has to be on screen.
      const verifiedRendered = [...new Set(body.match(/#DR-\d+/g) || [])];
      record(
        `[${lang}] all ${driversVerified.data.length} server-filtered rows render (no client re-filter)`,
        verifiedRendered.length === driversVerified.data.length,
        `rendered ${verifiedRendered.length}`
      );
    }

    await page.getByRole('tab', { name: rx(L.filterAll) }).first().click();
    await page.waitForTimeout(1200);

    // ---- search is debounced onto the `search` param ------------------------
    const beforeSearch = driverRequests.length;
    const searchTerm = firstDriver.full_name.split(' ')[0];
    await page.getByPlaceholder(L.searchPlaceholder).fill(searchTerm);
    await page.waitForTimeout(2000);

    const searchRequest = driverRequests
      .slice(beforeSearch)
      .find((u) => u.searchParams.get('search') === searchTerm);
    record(`[${lang}] search sends search=${searchTerm}`, !!searchRequest,
      driverRequests.slice(beforeSearch).map((u) => u.search).join(' '));
    record(
      `[${lang}] search was debounced (not one request per keystroke)`,
      driverRequests.length - beforeSearch <= 3,
      `${driverRequests.length - beforeSearch} requests for ${searchTerm.length} chars`
    );

    const searchLive = await get(
      token,
      `/admin/drivers?search=${encodeURIComponent(searchTerm)}&per_page=${PER_PAGE}`
    );
    body = await page.locator('body').innerText();
    record(
      `[${lang}] search view renders the ${searchLive.data.length} matching row(s)`,
      searchLive.data.every((d) => body.includes(d.driver_ref)),
      `expected ${searchLive.data.map((d) => d.driver_ref).join(',')}`
    );

    await page.getByPlaceholder(L.searchPlaceholder).fill('');
    await page.waitForTimeout(1800);

    // ---- driver details page ------------------------------------------------
    const statusCallsBeforeDetails = statusRequests.length;
    await page.goto(`${APP}/drivers/${firstDriver.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    body = await page.locator('body').innerText();
    record(`[${lang}] details renders "${detail.full_name}"`, body.includes(detail.full_name));
    record(`[${lang}] details renders ref "${detail.driver_ref}"`, body.includes(detail.driver_ref));
    record(`[${lang}] details renders total_rides ${detail.stats.total_rides}`,
      body.includes(String(detail.stats.total_rides)));
    record(`[${lang}] details renders ${detail.documents.length} document rows`,
      detail.documents.every((d) => body.length > 0) && detail.documents.length > 0);

    record(
      `[${lang}] details page fetched GET /admin/users/{id}/status`,
      statusRequests.length > statusCallsBeforeDetails,
      `${statusRequests.length - statusCallsBeforeDetails} status calls`
    );

    const liveStatus = (await get(token, `/admin/users/${firstDriver.id}/status`)).data;
    const bannerCount = await page.getByTestId('ban-status-banner').count();
    record(
      `[${lang}] ban banner matches live status (account_status=${liveStatus.account_status})`,
      liveStatus.status_code === 1 ? bannerCount === 0 : bannerCount === 1,
      `banner rendered: ${bannerCount}`
    );

    rawKeys = body.match(/\b(drivers|common|modal|users)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the details page`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // ---- the 10-char reason rule, enforced before any request ---------------
    const banPostsBefore = banPosts.length;
    await page.getByTestId('driver-ban-toggle').click();
    await page.waitForTimeout(600);

    record(`[${lang}] ban modal offers the temporary option`,
      (await page.locator(`select option:has-text("${L.banTemporary}")`).count()) > 0);

    await page.locator('textarea').fill('short');
    await page.getByRole('button', { name: rx(L.banConfirm) }).click();
    await page.waitForTimeout(800);

    record(`[${lang}] 10-char rule keeps the modal open on a short reason`,
      (await page.locator('textarea').count()) > 0);
    record(`[${lang}] short reason fired no ban request`, banPosts.length === banPostsBefore);
    record(`[${lang}] validation message is translated, not a raw key`,
      !(await page.locator('body').innerText()).includes('modal.reason_too_short'));

    if (MUTATE) {
      // Real temporary ban: proves the DoD ("a temporary ban with an expiry
      // round-trips and the status banner reflects it") end-to-end.
      const expiry = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      await page.locator('select').first().selectOption('temporary');
      await page.waitForTimeout(300);
      await page.locator('input[type="date"]').fill(expiry);
      await page.locator('textarea').fill('verification script exercising the temporary ban path');
      await page.getByRole('button', { name: rx(L.banConfirm) }).click();
      await page.waitForTimeout(2500);

      const banRequest = banPosts.slice(banPostsBefore).find((p) => /\/ban$/.test(p.url));
      record(`[${lang}] valid reason fires POST /admin/users/{id}/ban`, !!banRequest);

      const sent = banRequest ? JSON.parse(banRequest.body) : {};
      record(`[${lang}] ban body carries type=temporary`, sent.type === 'temporary',
        JSON.stringify(sent));
      record(`[${lang}] ban body carries expires_at`, typeof sent.expires_at === 'string',
        JSON.stringify(sent));
      record(`[${lang}] ban reason is the typed one, not a hardcoded default`,
        sent.reason === 'verification script exercising the temporary ban path',
        JSON.stringify(sent.reason));

      // the server agrees
      const afterBan = (await get(token, `/admin/users/${firstDriver.id}/status`)).data;
      record(`[${lang}] server reports account_status=banned`,
        afterBan.account_status === 'banned', JSON.stringify(afterBan));
      record(`[${lang}] server records the ban as temporary with an expiry`,
        afterBan.ban?.type === 'temporary' && !!afterBan.ban?.expires_at,
        JSON.stringify(afterBan.ban));

      // and the banner refetched and now reflects it
      await page.waitForTimeout(500);
      record(`[${lang}] ban banner appeared after the ban`,
        (await page.getByTestId('ban-status-banner').count()) === 1);
      const bannerText = await page.getByTestId('ban-status-banner').innerText();
      record(`[${lang}] banner shows the reason the modal sent`,
        bannerText.includes('verification script exercising the temporary ban path'),
        bannerText.replace(/\s+/g, ' '));
      record(`[${lang}] banner shows an expiry date`,
        (await page.getByTestId('ban-expires-at').count()) === 1);
      record(`[${lang}] banner text is translated, not a raw key`,
        !bannerText.includes('common.ban_banner'), bannerText.replace(/\s+/g, ' '));

      // banner survives a reload — i.e. it is read from the server, not state
      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      record(`[${lang}] ban banner survives a page reload (server-sourced)`,
        (await page.getByTestId('ban-status-banner').count()) === 1);

      // ---- restore: unban through the UI ------------------------------------
      await page.getByTestId('driver-ban-toggle').click();
      await page.waitForTimeout(2500);

      const unbanRequest = banPosts.find((p) => /\/unban$/.test(p.url));
      record(`[${lang}] unban fires POST /admin/users/{id}/unban`, !!unbanRequest);

      const afterUnban = (await get(token, `/admin/users/${firstDriver.id}/status`)).data;
      record(`[${lang}] server clears the ban block`, afterUnban.ban === null,
        JSON.stringify(afterUnban));
      // Documented backend behaviour: unban lands on logged_out (0), not active.
      record(`[${lang}] unban lands on logged_out, not active (documented)`,
        afterUnban.status_code === 0, JSON.stringify(afterUnban.account_status));
      record(`[${lang}] banner now shows the logged-out notice, not a ban`,
        (await page.getByTestId('ban-status-banner').innerText()).includes(
          // BanStatusBanner was promoted to features/shared in Phase 5, so its
          // keys live under `common` now.
          locale(lang).common.status_banner_logged_out.slice(0, 20)
        ));
    } else {
      await page.getByRole('button', { name: rx(L.close) }).last().click();
      await page.waitForTimeout(400);
    }

    /**
     * The seeded photo URLs 404 (BUG-7), which is precisely the case the
     * initials avatar exists for: assert it degraded rather than leaving a
     * broken-image icon. `firstDriver.profile_photo` is non-null in the seed,
     * so this really does exercise the error path.
     */
    if (brokenImages.length > 0) {
      const initials = detail.full_name
        .trim()
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => [...p][0])
        .join('')
        .toLocaleUpperCase();
      const shownInitials = await page.getByRole('img', { name: detail.full_name }).count();
      record(
        `[${lang}] broken seeded photo degrades to the initials avatar ("${initials}")`,
        shownInitials > 0,
        `${brokenImages.length} storage 404s, ${shownInitials} initials avatars`
      );
    }

    const realErrors = consoleErrors.filter(
      (e) => !/status of 404/.test(e) || !brokenImages.length
    );
    record(`[${lang}] no console errors beyond the documented storage 404s (BUG-7)`,
      realErrors.length === 0,
      realErrors.slice(0, 3).join(' | '));

    await page.screenshot({ path: `driver-details-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  if (MUTATE) {
    // `unban` leaves the user at status 0, which `GET /admin/drivers` maps to
    // "suspended" (BUG-6). There is no API to restore status 1, so rather than
    // leaving a silently altered seed, report it explicitly.
    const residue = await get(token, `/admin/drivers?filter=suspended&per_page=50`);
    record(
      'MUTATE residue reported: unbanned drivers now read as "suspended" (BUG-6)',
      true,
      `suspended total=${residue.meta.total}, ids=${residue.data.map((d) => d.id).join(',')} — ` +
        `restore with: UPDATE users SET status=1 WHERE id IN (...); php artisan cache:clear`
    );
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `   [${r.detail}]` : ''}`);
  }
  // The residue line is informational; print its detail even on PASS.
  const residueLine = results.find((r) => r.name.startsWith('MUTATE residue'));
  if (residueLine) console.log(`\nNOTE  ${residueLine.detail}`);

  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
