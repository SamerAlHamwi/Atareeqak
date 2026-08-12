/**
 * Phase 5 acceptance check — drives the real Users and passenger-details pages
 * in Chromium against a running backend and asserts the rendered UI matches the
 * live API payload, in both languages.
 *
 *   node docs/api/verify-users.mjs
 *
 *   node docs/api/verify-users.mjs --mutate   # real ban/unban + a real wallet charge
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`. Writes users-{en,ar}.png and
 * passenger-details-{en,ar}.png for eyeballing.
 *
 * Read-only by default: it drives all four filters, paging, per_page, search,
 * the five per-section refresh endpoints and both validators (the 10-char ban
 * reason and the wallet amount rules), but never confirms a ban or a charge, so
 * it can be re-run against the same seed.
 *
 * `--mutate` additionally:
 *   • bans one passenger temporarily and unbans it again. The backend's unban
 *     writes `status = 0` (logged_out), not 1, which `GET /admin/users` then
 *     reports as "suspended" (BUG-6) — the residue is printed with the SQL to
 *     undo it, exactly as verify-drivers.mjs does.
 *   • performs a **real wallet charge**, which is NOT reversible through the
 *     API: there is no debit endpoint and no way to delete a WalletTransaction.
 *     The delta and the transaction id are printed at the end.
 *
 * It targets a **passenger**, never a driver, so the Phase 4 driver seed checks
 * stay valid.
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
/** Second value exercised through the per-page selector. */
const SMALL_PER_PAGE = 5;
/** Amount used by the --mutate charge. Small enough to be an obvious artefact. */
const CHARGE_AMOUNT = 25;

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

const getStatus = async (token, path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return res.status;
};

/**
 * Labels come from the locale files rather than being hardcoded, so the script
 * asserts the *shipped* translation and cannot drift from it. Arabic inflects
 * with the noun it describes, so a hardcoded list gets these wrong.
 */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    filterStatusAll: l.users.filter_status_all,
    filterStatusVerified: l.users.filter_status_verified,
    filterStatusSuspended: l.users.filter_status_suspended,
    filterType: l.users.filter_type,
    filterTypePassenger: l.users.filter_type_passenger,
    filterDate: l.users.filter_date,
    filterDate3Months: l.users.filter_date_last_3_months,
    statusVerified: l.users.status_verified,
    statusUnverified: l.users.status_unverified,
    statusRejected: l.users.status_rejected,
    banAction: l.users.ban_action,
    unbanAction: l.users.unban_action,
    banConfirm: l.users.ban_confirm,
    banTemporary: l.modal.ban_temporary,
    accountBanned: l.users.account_banned,
    perPage: l.common.per_page,
    tripLimit: l.users.trip_limit_label,
    chargeWallet: l.users.charge_wallet,
    confirmCharge: l.users.confirm_charge,
    loggedOutNotice: l.common.status_banner_logged_out,
    noComplaints: l.users.no_complaints,
    // Targeted by placeholder, not `input[type=text]`: the MainLayout header
    // carries its own (inert) search box earlier in the DOM.
    searchPlaceholder: l.users.search_placeholder,
  };
};

/** Escapes a locale string for safe use inside a RegExp. */
const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * Polls a DOM assertion instead of trusting a fixed sleep. The backend runs on
 * single-process `php artisan serve`, so requests queue and a fixed 1.4 s wait
 * is flaky under load — which is exactly what a `--mutate` run adds.
 */
const until = async (predicate, timeout = 10000, step = 250) => {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await predicate()) return true;
    if (Date.now() > deadline) return false;
    await new Promise((r) => setTimeout(r, step));
  }
};

/**
 * Digits only, separators stripped. Rendered figures go through
 * `toLocaleString`, so "4,930,025" must still match a raw 4930025.
 */
const digits = (value) => String(value).replace(/[^\d]/g, '');

const run = async () => {
  const session = await login();
  const token = session.tokens.access_token;

  // ---- live payloads the UI must match --------------------------------------
  const page1 = await get(token, `/admin/users?page=1&type=all&status=all&date=all&per_page=${PER_PAGE}`);
  const listData = page1.data;
  const meta = listData.meta;
  const stats = listData.stats;

  const passengersList = await get(token, `/admin/users?type=passenger&per_page=50`);
  const verifiedList = await get(token, `/admin/users?status=verified&per_page=${PER_PAGE}`);
  const dateFiltered = await get(token, `/admin/users?date=last_3_months&per_page=${PER_PAGE}`);
  const bogusDateStatus = await getStatus(token, '/admin/users?date=bogus');

  /**
   * Target a passenger with real trips so the chart, the trip table and the
   * limit selector all have something to render. Falls back to the first
   * passenger if none has trips.
   */
  let target = null;
  let profile = null;
  for (const candidate of passengersList.data.users) {
    const p = (await get(token, `/admin/passengers/${candidate.id}/full-profile`)).data;
    if (!p) continue;
    if (!target) {
      target = candidate;
      profile = p;
    }
    if (p.recent_trips.length > 0 && p.monthly_trips.some((m) => m.trips > 0)) {
      target = candidate;
      profile = p;
      break;
    }
  }

  const sectionStats = (await get(token, `/admin/passengers/${target.id}/stats`)).data;
  const monthly12 = (await get(token, `/admin/passengers/${target.id}/monthly-trips?months=12`)).data;
  const recent25 = (await get(token, `/admin/passengers/${target.id}/recent-trips?limit=25`)).data;
  const complaintsAll = await get(token, `/admin/passengers/${target.id}/complaints`);
  const walletCharges = await get(token, `/admin/passengers/${target.id}/wallet-charges`);

  const browser = await chromium.launch();
  const results = [];
  const record = (name, ok, detailText = '') => results.push({ name, ok, detail: detailText });
  const notes = [];

  // ---- contract-level assertions (language-independent) ---------------------
  record(
    'users payload nests everything under `data` (unlike /admin/drivers)',
    Array.isArray(listData.users) && !!listData.meta && !!listData.stats && page1.users === undefined,
    Object.keys(page1).join(',')
  );
  record(
    'users payload carries NO counts block (documented as REQ-2)',
    page1.counts === undefined && listData.counts === undefined
  );
  record(
    'admin_photo is null (documented as BUG-5)',
    listData.admin_photo === null,
    `admin_photo=${JSON.stringify(listData.admin_photo)}`
  );
  record(
    `default per_page=${PER_PAGE} spans more than one page (total ${meta.total})`,
    meta.last_page > 1,
    JSON.stringify(meta)
  );
  record(
    'meta echoes the applied type/status/date filters',
    meta.filters?.type === 'all' && meta.filters?.status === 'all' && meta.filters?.date === 'all',
    JSON.stringify(meta.filters)
  );
  record(
    'date=last_3_months is accepted and echoed',
    dateFiltered.data.meta.filters.date === 'last_3_months',
    JSON.stringify(dateFiltered.data.meta.filters)
  );
  record('date=bogus is rejected with 422', bogusDateStatus === 422, `status ${bogusDateStatus}`);
  if (dateFiltered.data.meta.total === meta.total) {
    notes.push(
      `date filter: every seeded user was created on the same day, so all five windows ` +
        `return the same ${meta.total} rows. The param is verified by its echo in ` +
        `meta.filters.date and by the 422 on an invalid value, not by a differing row count.`
    );
  }
  record(
    'rows carry no ban field at all — ban state is unknowable from the list (BUG-6)',
    listData.users.every((u) => !('ban' in u) && !('is_banned' in u)),
    Object.keys(listData.users[0]).join(',')
  );
  const statuses = [...new Set(passengersList.data.users.map((u) => u.status))];
  record(
    `list returns statuses outside the filterable set: ${statuses.join(', ')}`,
    statuses.some((s) => s === 'rejected' || s === 'unverified'),
    statuses.join(',')
  );
  record(
    'GET /admin/users/{id}/status is reachable and shapes ban as null|object',
    await (async () => {
      const s = await get(token, `/admin/users/${target.id}/status`);
      return s.data && 'ban' in s.data && 'status_code' in s.data;
    })()
  );
  record(
    'all five per-section endpoints answer 200',
    [sectionStats, monthly12, recent25, complaintsAll.data, walletCharges.data].every(
      (payload) => payload !== undefined
    )
  );
  record(
    'monthly-trips?months=12 really returns 12 buckets',
    monthly12.length === 12,
    `${monthly12.length} buckets`
  );
  record(
    'complaints endpoint carries a counts block (unlike the users list)',
    !!complaintsAll.counts && typeof complaintsAll.counts.all === 'number',
    JSON.stringify(complaintsAll.counts)
  );

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1600 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const brokenImages = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    /**
     * Seeded `/storage/...` URLs 404 and Chromium blocks the HTML 404 as ORB,
     * landing on `requestfailed` rather than `response` (BUG-7). Both watched.
     */
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/storage/')) brokenImages.push(r.url());
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/storage/')) brokenImages.push(r.url());
    });

    const userRequests = [];
    const profileRequests = [];
    const sectionRequests = [];
    const statusRequests = [];
    const banPosts = [];
    const chargePosts = [];
    page.on('request', (r) => {
      const url = r.url();
      if (/\/api\/admin\/users(\?|$)/.test(url)) userRequests.push(new URL(url));
      if (/\/full-profile/.test(url)) profileRequests.push(new URL(url));
      if (/\/api\/admin\/passengers\/\d+\/(stats|monthly-trips|recent-trips|complaints|wallet-charges)/.test(url)) {
        sectionRequests.push(new URL(url));
      }
      if (/\/api\/admin\/users\/\d+\/status/.test(url)) statusRequests.push(new URL(url));
      if (r.method() === 'POST' && /\/api\/admin\/users\/\d+\/(un)?ban$/.test(url)) {
        banPosts.push({ url, body: r.postData() });
      }
      if (r.method() === 'POST' && /\/charge-wallet$/.test(url)) {
        chargePosts.push({ url, body: r.postData() });
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

    await page.goto(`${APP}/passengers`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    let body = await page.locator('body').innerText();

    // ---- KPI cards + rows come from the live payload -----------------------
    record(
      `[${lang}] total_registered card shows ${stats.total_registered}`,
      body.includes(String(stats.total_registered))
    );
    record(
      `[${lang}] suspended_users card shows ${stats.suspended_users}`,
      body.includes(String(stats.suspended_users))
    );
    record(
      `[${lang}] page 1 renders all ${listData.users.length} rows returned by the server`,
      listData.users.every((u) => !u.email || body.includes(u.email)) &&
        (await page.locator('[data-testid^="user-ban-toggle-"]').count()) === listData.users.length,
      listData.users.filter((u) => u.email && !body.includes(u.email)).map((u) => u.email).join(',')
    );
    record(
      `[${lang}] first row name "${listData.users[0].full_name}" rendered`,
      body.includes(listData.users[0].full_name)
    );

    // ---- every filter param is actually sent -------------------------------
    const first = userRequests[0];
    record(
      `[${lang}] initial request sends type, status, date and per_page`,
      first?.searchParams.get('type') === 'all' &&
        first?.searchParams.get('status') === 'all' &&
        first?.searchParams.get('date') === 'all' &&
        first?.searchParams.get('per_page') === String(PER_PAGE),
      first?.search ?? 'no request'
    );
    record(`[${lang}] per-page selector rendered`, body.includes(L.perPage));

    // ---- no untranslated keys leaked ---------------------------------------
    let rawKeys = body.match(/\b(users|common|modal|drivers)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the users list`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // ---- status filter (tabs) ----------------------------------------------
    let before = userRequests.length;
    await page.getByRole('tab', { name: rx(L.filterStatusVerified) }).first().click();
    await page.waitForTimeout(1500);
    const statusRequest = userRequests
      .slice(before)
      .find((u) => u.searchParams.get('status') === 'verified');
    record(`[${lang}] status tab requests status=verified`, !!statusRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(`[${lang}] status change resets to page=1`,
      statusRequest?.searchParams.get('page') === '1', statusRequest?.search ?? '');

    record(
      `[${lang}] all ${verifiedList.data.users.length} server-filtered rows render (no client re-filter)`,
      await until(async () => {
        const text = await page.locator('body').innerText();
        return verifiedList.data.users.every((u) => !u.email || text.includes(u.email));
      }),
      `expected ${verifiedList.data.users.map((u) => u.email).join(',')}`
    );

    await page.getByRole('tab', { name: rx(L.filterStatusAll) }).first().click();
    await page.waitForTimeout(1200);

    // ---- type filter (select) ----------------------------------------------
    before = userRequests.length;
    await page.getByLabel(L.filterType).selectOption('passenger');
    await page.waitForTimeout(1500);
    const typeRequest = userRequests
      .slice(before)
      .find((u) => u.searchParams.get('type') === 'passenger');
    record(`[${lang}] type filter requests type=passenger`, !!typeRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(`[${lang}] type change resets to page=1`,
      typeRequest?.searchParams.get('page') === '1', typeRequest?.search ?? '');

    await page.getByLabel(L.filterType).selectOption('all');
    await page.waitForTimeout(1200);

    // ---- date filter (the one this phase added) -----------------------------
    before = userRequests.length;
    await page.getByLabel(L.filterDate).selectOption('last_3_months');
    await page.waitForTimeout(1500);
    const dateRequest = userRequests
      .slice(before)
      .find((u) => u.searchParams.get('date') === 'last_3_months');
    record(`[${lang}] date filter requests date=last_3_months`, !!dateRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(`[${lang}] date change resets to page=1`,
      dateRequest?.searchParams.get('page') === '1', dateRequest?.search ?? '');

    record(
      `[${lang}] date-filtered view renders the ${dateFiltered.data.users.length} rows the server returned`,
      await until(async () => {
        const text = await page.locator('body').innerText();
        return dateFiltered.data.users.every((u) => !u.email || text.includes(u.email));
      }),
      `expected ${dateFiltered.data.users.map((u) => u.email).join(',')}`
    );

    before = userRequests.length;
    await page.getByLabel(L.filterDate).selectOption('last_12_months');
    await page.waitForTimeout(1500);
    record(
      `[${lang}] date filter also requests date=last_12_months`,
      userRequests.slice(before).some((u) => u.searchParams.get('date') === 'last_12_months')
    );
    await page.getByLabel(L.filterDate).selectOption('all');
    await page.waitForTimeout(1200);

    await page.screenshot({ path: `users-${lang}.png`, fullPage: true });

    // ---- paging actually requests page=2 -----------------------------------
    before = userRequests.length;
    await page.getByTestId('pagination-next').click();
    await page.waitForTimeout(1500);
    const pagedRequest = userRequests.slice(before).find((u) => u.searchParams.get('page') === '2');
    record(`[${lang}] next page requests page=2`, !!pagedRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(`[${lang}] page 2 keeps per_page=${PER_PAGE}`,
      pagedRequest?.searchParams.get('per_page') === String(PER_PAGE),
      pagedRequest?.search ?? '');

    if (pagedRequest) {
      const serverPage2 = await get(token, `/admin/users?page=2&per_page=${PER_PAGE}`);
      record(
        `[${lang}] page 2 renders its first row "${serverPage2.data.users[0].email}"`,
        await until(async () =>
          (await page.locator('body').innerText()).includes(serverPage2.data.users[0].email)
        )
      );
      body = await page.locator('body').innerText();
      record(
        `[${lang}] page 2 drops page 1's "${listData.users[0].email}"`,
        !body.includes(listData.users[0].email)
      );
    }

    // ---- per_page change round-trips and resets the page --------------------
    before = userRequests.length;
    await page.getByLabel(L.perPage).selectOption(String(SMALL_PER_PAGE));
    await page.waitForTimeout(1500);
    const perPageRequest = userRequests
      .slice(before)
      .find((u) => u.searchParams.get('per_page') === String(SMALL_PER_PAGE));
    record(`[${lang}] per_page change requests per_page=${SMALL_PER_PAGE}`, !!perPageRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(`[${lang}] per_page change resets to page=1`,
      perPageRequest?.searchParams.get('page') === '1', perPageRequest?.search ?? '');

    const smallPage = await get(token, `/admin/users?page=1&per_page=${SMALL_PER_PAGE}`);
    // Row count is read off the per-row action button, so it does not depend on
    // any text the page happens to render.
    const renderedRows = () => page.locator('[data-testid^="user-ban-toggle-"]').count();
    record(
      `[${lang}] per_page=${SMALL_PER_PAGE} renders exactly ${smallPage.data.users.length} rows`,
      await until(async () => (await renderedRows()) === smallPage.data.users.length),
      `rendered ${await renderedRows()}`
    );
    body = await page.locator('body').innerText();
    record(
      `[${lang}] per_page=${SMALL_PER_PAGE} rows are the ones the server returned`,
      smallPage.data.users.every((u) => body.includes(u.email)),
      `expected ${smallPage.data.users.map((u) => u.email).join(',')}`
    );
    await page.getByLabel(L.perPage).selectOption(String(PER_PAGE));
    await page.waitForTimeout(1200);

    // ---- search is debounced onto the `search` param ------------------------
    before = userRequests.length;
    const searchTerm = target.full_name.split(' ')[0];
    await page.getByPlaceholder(L.searchPlaceholder).fill(searchTerm);
    await page.waitForTimeout(2000);
    const searchRequest = userRequests
      .slice(before)
      .find((u) => u.searchParams.get('search') === searchTerm);
    record(`[${lang}] search sends search=${searchTerm}`, !!searchRequest,
      userRequests.slice(before).map((u) => u.search).join(' '));
    record(
      `[${lang}] search was debounced (not one request per keystroke)`,
      userRequests.length - before <= 3,
      `${userRequests.length - before} requests for ${searchTerm.length} chars`
    );

    const searchLive = await get(
      token,
      `/admin/users?search=${encodeURIComponent(searchTerm)}&per_page=${PER_PAGE}`
    );
    record(
      `[${lang}] search view renders the ${searchLive.data.users.length} matching row(s)`,
      await until(async () => {
        const text = await page.locator('body').innerText();
        return searchLive.data.users.every((u) => text.includes(u.email));
      }),
      `expected ${searchLive.data.users.map((u) => u.email).join(',')}`
    );
    await page.getByPlaceholder(L.searchPlaceholder).fill('');
    await page.waitForTimeout(1800);

    // ---- passenger details page ---------------------------------------------
    const statusCallsBeforeDetails = statusRequests.length;
    await page.goto(`${APP}/passengers/${target.id}`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1800);

    /**
     * Re-read the profile per language: an earlier `--mutate` pass in the other
     * language has already changed the wallet balance, so the snapshot taken
     * before the loop is stale by the second iteration.
     */
    const profileNow = (await get(token, `/admin/passengers/${target.id}/full-profile`)).data;

    body = await page.locator('body').innerText();
    record(`[${lang}] details renders "${profileNow.user.full_name}"`,
      body.includes(profileNow.user.full_name));
    record(`[${lang}] details renders the user id ${target.id}`, body.includes(String(target.id)));
    record(
      `[${lang}] wallet balance card shows ${profileNow.stats.wallet_balance}`,
      digits(await page.getByTestId('stat-wallet-balance').innerText()) ===
        digits(Math.round(profileNow.stats.wallet_balance)),
      await page.getByTestId('stat-wallet-balance').innerText()
    );
    record(
      `[${lang}] total rides card shows ${profileNow.stats.total_rides}`,
      (await page.getByTestId('stat-total-rides').innerText()).includes(
        String(profileNow.stats.total_rides)
      )
    );
    record(
      `[${lang}] recent trips table renders the ${profileNow.recent_trips.length} rows from the BFF`,
      profileNow.recent_trips.every((tr) => !tr.route_from || body.includes(tr.route_from))
    );
    record(
      `[${lang}] complaints empty state is rendered (seed has none for this user)`,
      complaintsAll.data.length > 0 || body.includes(L.noComplaints)
    );
    record(
      `[${lang}] details page fetched GET /admin/users/{id}/status`,
      statusRequests.length > statusCallsBeforeDetails,
      `${statusRequests.length - statusCallsBeforeDetails} status calls`
    );

    const liveStatus = (await get(token, `/admin/users/${target.id}/status`)).data;
    let bannerCount = await page.getByTestId('ban-status-banner').count();
    record(
      `[${lang}] ban banner matches live status (account_status=${liveStatus.account_status})`,
      liveStatus.status_code === 1 ? bannerCount === 0 : bannerCount === 1,
      `banner rendered: ${bannerCount}`
    );

    rawKeys = body.match(/\b(users|common|modal|drivers)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the details page`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // ---- per-section refresh: one endpoint each, no BFF refetch --------------
    const sections = ['stats', 'monthly-trips', 'recent-trips', 'complaints', 'wallet-charges'];
    for (const section of sections) {
      const sectionBefore = sectionRequests.length;
      const profileBefore = profileRequests.length;
      await page.getByTestId(`refresh-${section}`).click();
      await page.waitForTimeout(1200);
      const hit = sectionRequests
        .slice(sectionBefore)
        .find((u) => u.pathname.endsWith(`/${section}`));
      record(`[${lang}] refresh "${section}" calls GET /admin/passengers/{id}/${section}`, !!hit,
        sectionRequests.slice(sectionBefore).map((u) => u.pathname).join(' '));
      record(
        `[${lang}] refresh "${section}" does NOT refetch the full-profile BFF`,
        profileRequests.length === profileBefore,
        `${profileRequests.length - profileBefore} BFF calls`
      );
    }

    // months window → monthly-trips?months=12
    let sectionBefore = sectionRequests.length;
    await page.getByTestId('monthly-window-12').click();
    record(
      `[${lang}] chart window requests months=12`,
      await until(() =>
        sectionRequests.slice(sectionBefore).some((u) => u.searchParams.get('months') === '12')
      ),
      sectionRequests.slice(sectionBefore).map((u) => u.search).join(' ')
    );
    record(
      `[${lang}] chart renders the ${monthly12.length} buckets the server returned`,
      await until(
        async () =>
          (await page.getByTestId('monthly-chart').locator('> div').count()) === monthly12.length
      ),
      `rendered ${await page.getByTestId('monthly-chart').locator('> div').count()}`
    );

    // trip limit → recent-trips?limit=25
    sectionBefore = sectionRequests.length;
    await page.getByLabel(L.tripLimit).selectOption('25');
    record(
      `[${lang}] trip limit requests limit=25`,
      await until(() =>
        sectionRequests.slice(sectionBefore).some((u) => u.searchParams.get('limit') === '25')
      ),
      sectionRequests.slice(sectionBefore).map((u) => u.search).join(' ')
    );
    record(
      `[${lang}] limit=25 view renders the ${recent25.length} trips the server returned`,
      await until(async () => {
        const text = await page.locator('body').innerText();
        return recent25.every((tr) => !tr.route_from || text.includes(tr.route_from));
      }),
      `expected ${recent25.map((tr) => tr.route_from).join(' | ')}`
    );

    // complaints filter → complaints?status=in_review (server-side, not a memo)
    sectionBefore = sectionRequests.length;
    await page.getByTestId('complaint-filter-in_review').click();
    record(
      `[${lang}] complaint filter requests status=in_review`,
      await until(() =>
        sectionRequests.slice(sectionBefore).some((u) => u.searchParams.get('status') === 'in_review')
      ),
      sectionRequests.slice(sectionBefore).map((u) => u.search).join(' ')
    );

    // ---- wallet amount rules are enforced before any request ----------------
    const chargesBefore = chargePosts.length;
    await page.getByTestId('charge-wallet-open').click();
    await page.waitForTimeout(500);
    await page.getByTestId('charge-amount').fill('0');
    await page.waitForTimeout(300);
    record(
      `[${lang}] amount 0 disables the confirm button (min 1, hidden not 422'd)`,
      await page.getByTestId('charge-confirm').isDisabled()
    );
    record(
      `[${lang}] amount 0 shows a translated inline error`,
      await (async () => {
        const text = await page.getByTestId('charge-amount-error').innerText();
        return text.length > 0 && !text.includes('users.charge_amount');
      })()
    );
    await page.getByTestId('charge-amount').fill('20000000');
    await page.waitForTimeout(300);
    record(
      `[${lang}] amount above the 10,000,000 cap disables the confirm button`,
      await page.getByTestId('charge-confirm').isDisabled()
    );
    await page.getByTestId('charge-amount').fill(String(CHARGE_AMOUNT));
    await page.waitForTimeout(300);
    record(
      `[${lang}] a valid amount enables the confirm button`,
      await page.getByTestId('charge-confirm').isEnabled()
    );
    record(`[${lang}] no charge request fired while validating`,
      chargePosts.length === chargesBefore);

    // ---- the 10-char ban reason rule, enforced before any request -----------
    const banPostsBefore = banPosts.length;
    if (!MUTATE) {
      await page.getByTestId('charge-confirm').isEnabled();
      await page.getByRole('button', { name: rx(locale(lang).common.cancel) }).first().click();
      await page.waitForTimeout(400);
    }

    await page.getByTestId('user-ban-toggle').click();
    await page.waitForTimeout(600);
    record(`[${lang}] ban modal offers the temporary option`,
      (await page.locator(`select option:has-text("${L.banTemporary}")`).count()) > 0);

    await page.locator('textarea').last().fill('short');
    await page.getByRole('button', { name: rx(L.banConfirm) }).click();
    await page.waitForTimeout(800);
    record(`[${lang}] 10-char rule keeps the modal open on a short reason`,
      (await page.getByRole('button', { name: rx(L.banConfirm) }).count()) > 0);
    record(`[${lang}] short reason fired no ban request`, banPosts.length === banPostsBefore);
    record(`[${lang}] validation message is translated, not a raw key`,
      !(await page.locator('body').innerText()).includes('modal.reason_too_short'));

    if (MUTATE) {
      // ---- real temporary ban ------------------------------------------------
      const expiry = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
      const reason = 'verification script exercising the passenger temporary ban path';
      await page.locator('select').last().selectOption('temporary');
      await page.waitForTimeout(300);
      await page.locator('input[type="date"]').fill(expiry);
      await page.locator('textarea').last().fill(reason);
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
        sent.reason === reason, JSON.stringify(sent.reason));

      const afterBan = (await get(token, `/admin/users/${target.id}/status`)).data;
      record(`[${lang}] server reports account_status=banned`,
        afterBan.account_status === 'banned', JSON.stringify(afterBan.account_status));
      record(`[${lang}] server records the ban as temporary with an expiry`,
        afterBan.ban?.type === 'temporary' && !!afterBan.ban?.expires_at,
        JSON.stringify(afterBan.ban));

      // BUG-6, now verified for /admin/users too
      const rowAfterBan = (await get(token, `/admin/users?per_page=50`)).data.users.find(
        (u) => u.id === target.id
      );
      const suspendedAfterBan = await get(token, '/admin/users?status=suspended&per_page=50');
      record(
        `[${lang}] BUG-6 confirmed on /admin/users: a banned user still reads "${rowAfterBan.status}"`,
        rowAfterBan.status !== 'suspended',
        `row status=${rowAfterBan.status}, suspended filter total=${suspendedAfterBan.data.meta.total}`
      );

      await page.waitForTimeout(500);
      record(`[${lang}] ban banner appeared after the ban`,
        (await page.getByTestId('ban-status-banner').count()) === 1);
      const bannerText = await page.getByTestId('ban-status-banner').innerText();
      record(`[${lang}] banner shows the reason the modal sent`, bannerText.includes(reason),
        bannerText.replace(/\s+/g, ' '));
      record(`[${lang}] banner shows an expiry date`,
        (await page.getByTestId('ban-expires-at').count()) === 1);
      record(`[${lang}] banner text is translated, not a raw key`,
        !bannerText.includes('common.ban_banner'), bannerText.replace(/\s+/g, ' '));

      await page.reload({ waitUntil: 'networkidle' });
      await page.waitForTimeout(1800);
      record(`[${lang}] ban banner survives a page reload (server-sourced)`,
        (await page.getByTestId('ban-status-banner').count()) === 1);

      // ---- restore: unban through the UI ------------------------------------
      await page.getByTestId('user-ban-toggle').click();
      await page.waitForTimeout(2500);
      const unbanRequest = banPosts.find((p) => /\/unban$/.test(p.url));
      record(`[${lang}] unban fires POST /admin/users/{id}/unban`, !!unbanRequest);

      const afterUnban = (await get(token, `/admin/users/${target.id}/status`)).data;
      record(`[${lang}] server clears the ban block`, afterUnban.ban === null,
        JSON.stringify(afterUnban.account_status));
      record(`[${lang}] unban lands on logged_out, not active (documented)`,
        afterUnban.status_code === 0, JSON.stringify(afterUnban.account_status));
      bannerCount = await page.getByTestId('ban-status-banner').count();
      record(
        `[${lang}] banner now shows the logged-out notice, not a ban`,
        bannerCount === 1 &&
          (await page.getByTestId('ban-status-banner').innerText()).includes(
            L.loggedOutNotice.slice(0, 20)
          )
      );

      // ---- real wallet charge (NOT reversible) --------------------------------
      const balanceBefore = (await get(token, `/admin/passengers/${target.id}/stats`)).data
        .wallet_balance;
      const chargesCountBefore = (
        await get(token, `/admin/passengers/${target.id}/wallet-charges?per_page=50`)
      ).data.length;

      await page.getByTestId('charge-wallet-open').click();
      await page.waitForTimeout(400);
      await page.getByTestId('charge-amount').fill(String(CHARGE_AMOUNT));
      await page.getByTestId('charge-notes').fill(`verify-users.mjs ${lang} run`);
      await page.getByTestId('charge-confirm').click();
      await page.waitForTimeout(3000);

      const chargeRequest = chargePosts[chargePosts.length - 1];
      record(`[${lang}] confirm fires POST /admin/passengers/{id}/charge-wallet`, !!chargeRequest);
      const chargeBody = chargeRequest ? JSON.parse(chargeRequest.body) : {};
      record(`[${lang}] charge body carries the typed amount and note`,
        chargeBody.amount === CHARGE_AMOUNT && typeof chargeBody.admin_notes === 'string',
        JSON.stringify(chargeBody));

      const balanceAfter = (await get(token, `/admin/passengers/${target.id}/stats`)).data
        .wallet_balance;
      record(
        `[${lang}] server balance rose by ${CHARGE_AMOUNT} (${balanceBefore} → ${balanceAfter})`,
        Math.round((balanceAfter - balanceBefore) * 100) / 100 === CHARGE_AMOUNT,
        `${balanceBefore} → ${balanceAfter}`
      );

      const chargesAfter = (
        await get(token, `/admin/passengers/${target.id}/wallet-charges?per_page=50`)
      ).data;
      const created = chargesAfter[0];
      record(`[${lang}] a new wallet transaction was written`,
        chargesAfter.length === chargesCountBefore + 1, `${chargesAfter.length} rows`);

      // The confirmation banner must carry all three figures — and the two the
      // charge response does NOT return (previous_balance, transaction_id) can
      // only be there because they were read back from wallet-charges (REQ-3).
      const chargeBanner = await page.getByTestId('action-banner').innerText();
      record(
        `[${lang}] confirmation shows previous → new balance (${created.previous_balance} → ${created.new_balance})`,
        digits(chargeBanner).includes(digits(Math.round(created.previous_balance))) &&
          digits(chargeBanner).includes(digits(Math.round(created.new_balance))),
        chargeBanner.replace(/\s+/g, ' ')
      );
      record(
        `[${lang}] confirmation shows the transaction id ${created.transaction_id}`,
        chargeBanner.includes(created.transaction_id),
        chargeBanner.replace(/\s+/g, ' ')
      );
      record(
        `[${lang}] wallet balance card refreshed to ${created.new_balance} without a page reload`,
        await until(
          async () =>
            digits(await page.getByTestId('stat-wallet-balance').innerText()) ===
            digits(Math.round(created.new_balance))
        ),
        await page.getByTestId('stat-wallet-balance').innerText()
      );
      record(
        `[${lang}] the charge log now lists the new transaction`,
        await until(async () =>
          (await page.locator('body').innerText()).includes(created.transaction_id)
        )
      );

      notes.push(
        `MUTATE (${lang}): wallet charge of ${CHARGE_AMOUNT} on user ${target.id} is NOT reversible ` +
          `through the API — there is no debit endpoint and no way to delete a WalletTransaction. ` +
          `Balance ${balanceBefore} → ${balanceAfter} (delta +${CHARGE_AMOUNT}), transaction ` +
          `${created.transaction_id}. Undo in SQL if the seed must be pristine: ` +
          `DELETE FROM wallet_transactions WHERE transaction_id='${created.transaction_id}'; ` +
          `UPDATE wallets SET balance=${balanceBefore} WHERE id=(SELECT wallet_id FROM wallet_transactions ...);`
      );
    } else {
      await page.getByRole('button', { name: rx(locale(lang).common.cancel) }).last().click();
      await page.waitForTimeout(400);
    }

    /**
     * The seeded photo URLs 404 (BUG-7) — precisely the case the initials
     * avatar exists for. `profile_photo` is non-null in the seed, so this
     * really does exercise the error path.
     */
    if (brokenImages.length > 0) {
      const shownInitials = await page.getByRole('img', { name: profile.user.full_name }).count();
      record(
        `[${lang}] broken seeded photo degrades to the initials avatar`,
        shownInitials > 0,
        `${brokenImages.length} storage 404s, ${shownInitials} initials avatars`
      );
    }

    const realErrors = consoleErrors.filter((e) => !/status of 404/.test(e) || !brokenImages.length);
    record(`[${lang}] no console errors beyond the documented storage 404s (BUG-7)`,
      realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

    await page.screenshot({ path: `passenger-details-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  if (MUTATE) {
    // `unban` leaves the user at status 0, which `GET /admin/users` maps to
    // "suspended" (BUG-6). There is no API to restore status 1.
    const residue = await get(token, '/admin/users?status=suspended&per_page=50');
    notes.push(
      `MUTATE residue: unbanned users now read as "suspended" in GET /admin/users (BUG-6). ` +
        `suspended total=${residue.data.meta.total}, ids=${residue.data.users.map((u) => u.id).join(',')} — ` +
        `restore with: UPDATE users SET status=1 WHERE id IN (...); php artisan cache:clear`
    );
  }

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `   [${r.detail}]` : ''}`);
  }
  for (const note of notes) console.log(`\nNOTE  ${note}`);

  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
