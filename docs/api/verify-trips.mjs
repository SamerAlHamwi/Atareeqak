/**
 * Phase 3 acceptance check — drives the real Trips page in Chromium against a
 * running backend and asserts the rendered UI matches the live API payload, in
 * both languages.
 *
 *   node docs/api/verify-trips.mjs
 *
 *   node docs/api/verify-trips.mjs --mutate   # also performs a real cancellation
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`. Writes trips-{en,ar}.png and
 * bookings-{en,ar}.png for eyeballing.
 *
 * Read-only by default: it drives filters, paging and the reason validator but
 * never confirms a cancellation, so it can be re-run against the same seed.
 * `--mutate` additionally cancels one real booking per language and asserts the
 * row and the server both reflect it.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

const HERE = dirname(fileURLToPath(import.meta.url));
const locale = (lang) =>
  JSON.parse(
    readFileSync(resolve(HERE, `../../src/locales/${lang}/translation.json`), 'utf8')
  );

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

/**
 * Labels are read from the locale files rather than hardcoded, so the script
 * asserts the *shipped* translation and cannot drift from it. (Arabic uses two
 * different words for "cancelled" — ملغاة for a رحلة, ملغى for a حجز — which a
 * hardcoded list gets wrong.)
 */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    bookings: l.trips.tab_bookings,
    tripCancelled: l.trips.filter_cancelled,
    bookingAll: l.bookings.filter_all,
    noShow: l.bookings.filter_no_show,
    cancelBooking: l.bookings.cancel_booking,
    confirmCancel: l.bookings.cancel_confirm,
    close: l.common.cancel,
  };
};

/** Escapes a locale string for safe use inside a RegExp. */
const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

const run = async () => {
  const session = await login();
  const token = session.tokens.access_token;

  // ---- live payloads the UI must match ------------------------------------
  const tripsPage1 = await get(token, '/admin/trips?page=1&filter=all&per_page=15');
  const tripsCancelled = await get(token, '/admin/trips?page=1&filter=cancelled&per_page=15');
  const bookingsPage1 = await get(token, '/staff/bookings?page=1&status=all&per_page=15');
  const live = await get(token, '/admin/trips/live');

  const counts = tripsPage1.counts;
  const meta = tripsPage1.meta;

  const browser = await chromium.launch();
  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, ok, detail });

  // ---- contract-level assertions (language-independent) -------------------
  record(
    `counts block present with all six keys`,
    ['all', 'scheduled', 'active', 'completed', 'cancelled', 'awaiting'].every(
      (k) => typeof counts?.[k] === 'number'
    ),
    JSON.stringify(counts)
  );
  record(
    `counts.all (${counts.all}) equals meta.total (${meta.total})`,
    counts.all === meta.total
  );
  record(
    `trips paginate: last_page ${meta.last_page} > 1 so paging is exercisable`,
    meta.last_page > 1,
    JSON.stringify(meta)
  );
  record(
    `bookings expose meta for paging (last_page ${bookingsPage1.meta?.last_page})`,
    typeof bookingsPage1.meta?.last_page === 'number'
  );
  record(
    `bookings payload carries NO counts block (documented as REQ-2)`,
    bookingsPage1.counts === undefined,
    `counts=${JSON.stringify(bookingsPage1.counts)}`
  );

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    const tripRequests = [];
    const bookingRequests = [];
    page.on('request', (r) => {
      const url = r.url();
      if (url.includes('/api/admin/trips?') || /\/api\/admin\/trips$/.test(url)) {
        tripRequests.push(new URL(url));
      }
      if (url.includes('/api/staff/bookings')) bookingRequests.push(new URL(url));
    });

    await page.addInitScript((l) => {
      localStorage.setItem('access_token', l.token);
      localStorage.setItem('refresh_token', l.refresh);
      localStorage.setItem('auth_kind', 'staff');
      localStorage.setItem('user', JSON.stringify(l.user));
      localStorage.setItem('i18nextLng', l.lang);
    }, {
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
    });

    await page.goto(`${APP}/trips`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    let body = await page.locator('body').innerText();

    // ---- rows on screen come from the live payload -------------------------
    const firstTrip = tripsPage1.data[0];
    record(`[${lang}] first trip ref "${firstTrip.trip_ref}" rendered`,
      body.includes(firstTrip.trip_ref));
    record(`[${lang}] first trip driver "${firstTrip.driver.name}" rendered`,
      body.includes(firstTrip.driver.name));
    record(`[${lang}] first trip route "${firstTrip.route.from}" rendered`,
      body.includes(firstTrip.route.from));
    record(`[${lang}] passengers label "${firstTrip.passengers.label}" rendered`,
      body.includes(firstTrip.passengers.label));

    // A page shows per_page rows at most, and the default is 15.
    const renderedRefs = (body.match(/#TR-\d+/g) || []);
    const uniqueRefs = [...new Set(renderedRefs)];
    record(`[${lang}] page 1 renders ${tripsPage1.data.length} trip rows`,
      uniqueRefs.length === tripsPage1.data.length,
      `rendered ${uniqueRefs.length}`);

    // ---- tab badges are driven by `counts`, not array length ---------------
    // counts.all is 71 while only 15 rows are on screen — the badge proves the
    // number came from the server, not from trips.length.
    record(`[${lang}] "all" badge shows counts.all=${counts.all} (not page size)`,
      body.includes(String(counts.all)) && counts.all !== tripsPage1.data.length);
    record(`[${lang}] cancelled badge shows counts.cancelled=${counts.cancelled}`,
      body.includes(String(counts.cancelled)));
    record(`[${lang}] awaiting badge shows counts.awaiting=${counts.awaiting}`,
      body.includes(String(counts.awaiting)));

    // ---- no untranslated keys leaked ---------------------------------------
    let rawKeys = body.match(/\b(trips|bookings|common|modal)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the trips tab`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // ---- live map badge + timestamp ----------------------------------------
    const liveCount = (live.data ?? live ?? []).length;
    const liveBadge = await page.getByTestId('live-trips-badge').innerText();
    record(`[${lang}] live badge reports ${liveCount} trips from /admin/trips/live`,
      liveBadge.includes(String(liveCount)), `badge="${liveBadge}"`);
    const updatedStamp = await page.getByTestId('live-updated-at').innerText();
    record(`[${lang}] live map shows an "updated HH:MM" stamp`,
      /\d{1,2}:\d{2}/.test(updatedStamp), `stamp="${updatedStamp}"`);
    record(`[${lang}] updated stamp is translated, not a raw key`,
      !updatedStamp.includes('trips.updated_at'), `stamp="${updatedStamp}"`);

    // ---- paging actually requests page=2 -----------------------------------
    const beforePaging = tripRequests.length;
    await page.getByTestId('pagination-next').click();
    await page.waitForTimeout(1500);

    const pagedRequest = tripRequests.slice(beforePaging).find((u) => u.searchParams.get('page') === '2');
    record(`[${lang}] next page requests page=2`, !!pagedRequest,
      tripRequests.slice(beforePaging).map((u) => u.search).join(' '));

    if (pagedRequest) {
      const page2 = await get(token, '/admin/trips?page=2&filter=all&per_page=15');
      await page.waitForTimeout(500);
      body = await page.locator('body').innerText();
      record(`[${lang}] page 2 renders its first ref "${page2.data[0].trip_ref}"`,
        body.includes(page2.data[0].trip_ref));
      record(`[${lang}] page 2 no longer shows page 1's first ref "${firstTrip.trip_ref}"`,
        !body.includes(firstTrip.trip_ref));
    }

    // ---- changing the filter hits the API and resets to page 1 -------------
    const beforeFilter = tripRequests.length;
    await page.getByRole('tab', { name: rx(L.tripCancelled) }).first().click();
    await page.waitForTimeout(1500);

    const filterRequest = tripRequests.slice(beforeFilter).find(
      (u) => u.searchParams.get('filter') === 'cancelled'
    );
    record(`[${lang}] filter change requests filter=cancelled`, !!filterRequest,
      tripRequests.slice(beforeFilter).map((u) => u.search).join(' '));
    record(`[${lang}] filter change resets to page=1`,
      filterRequest?.searchParams.get('page') === '1',
      filterRequest?.search ?? 'no request');

    body = await page.locator('body').innerText();
    if (tripsCancelled.data.length) {
      record(`[${lang}] cancelled view renders "${tripsCancelled.data[0].trip_ref}"`,
        body.includes(tripsCancelled.data[0].trip_ref));
    }

    await page.screenshot({ path: `trips-${lang}.png`, fullPage: true });

    // ---- Bookings tab ------------------------------------------------------
    await page.getByRole('tab', { name: rx(L.bookings) }).first().click();
    await page.waitForTimeout(1800);

    body = await page.locator('body').innerText();

    record(`[${lang}] bookings tab issued GET /staff/bookings`, bookingRequests.length > 0);
    record(`[${lang}] bookings request sends status=all & per_page=15`,
      bookingRequests[0]?.searchParams.get('status') === 'all' &&
      bookingRequests[0]?.searchParams.get('per_page') === '15',
      bookingRequests[0]?.search ?? 'none');

    const firstBooking = bookingsPage1.data[0];
    record(`[${lang}] booking id "#BK-${firstBooking.id}" rendered`,
      body.includes(`#BK-${firstBooking.id}`));
    record(`[${lang}] booking passenger "${firstBooking.passenger.name}" rendered`,
      body.includes(firstBooking.passenger.name));
    record(`[${lang}] booking driver "${firstBooking.ride.driver.name}" rendered`,
      body.includes(firstBooking.ride.driver.name));
    record(`[${lang}] booking route "${firstBooking.ride.pickup_address}" rendered`,
      body.includes(firstBooking.ride.pickup_address));

    rawKeys = body.match(/\b(trips|bookings|common|modal)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the bookings tab`, rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', '));

    // bookings paging — done on the unfiltered list, which spans several pages
    const beforeBookingPaging = bookingRequests.length;
    await page.getByTestId('pagination-next').click();
    await page.waitForTimeout(1500);
    const bookingPage2 = bookingRequests
      .slice(beforeBookingPaging)
      .find((u) => u.searchParams.get('page') === '2');
    record(`[${lang}] bookings pager requests page=2`, !!bookingPage2,
      bookingRequests.slice(beforeBookingPaging).map((u) => u.search).join(' '));

    if (bookingPage2) {
      const live2 = await get(token, '/staff/bookings?page=2&status=all&per_page=15');
      body = await page.locator('body').innerText();
      record(`[${lang}] bookings page 2 renders "#BK-${live2.data[0].id}"`,
        body.includes(`#BK-${live2.data[0].id}`));
      record(`[${lang}] bookings page 2 drops page 1's "#BK-${firstBooking.id}"`,
        !body.includes(`#BK-${firstBooking.id}`));
    }

    // booking status filter round-trips (and resets the page we just advanced)
    const beforeBookingFilter = bookingRequests.length;
    await page.getByRole('tab', { name: rx(L.noShow) }).first().click();
    await page.waitForTimeout(1500);
    const noShowRequest = bookingRequests.slice(beforeBookingFilter).find(
      (u) => u.searchParams.get('status') === 'no_show'
    );
    record(`[${lang}] bookings filter requests status=no_show`, !!noShowRequest,
      bookingRequests.slice(beforeBookingFilter).map((u) => u.search).join(' '));
    record(`[${lang}] bookings filter resets to page=1`,
      noShowRequest?.searchParams.get('page') === '1',
      noShowRequest?.search ?? 'no request');

    const noShowLive = await get(token, '/staff/bookings?status=no_show&per_page=15');
    body = await page.locator('body').innerText();
    if (noShowLive.data.length) {
      record(`[${lang}] no_show view renders "#BK-${noShowLive.data[0].id}"`,
        body.includes(`#BK-${noShowLive.data[0].id}`));
    }
    // no_show bookings are terminal — the cancel control must not be offered
    record(`[${lang}] no cancel control on terminal no_show rows`,
      (await page.locator(`button[title="${L.cancelBooking}"]`).count()) === 0);

    // ---- the 10-char reason rule, enforced before any request --------------
    await page.getByRole('tab', { name: rx(L.bookingAll) }).last().click();
    await page.waitForTimeout(1500);
    const cancelButtons = page.locator(`button[title="${L.cancelBooking}"]`);
    if ((await cancelButtons.count()) > 0) {
      const beforeCancel = bookingRequests.length;
      await cancelButtons.first().click();
      await page.waitForTimeout(600);
      await page.locator('textarea').fill('short');
      await page.getByRole('button', { name: rx(L.confirmCancel) }).click();
      await page.waitForTimeout(800);

      record(`[${lang}] 10-char rule keeps the modal open on a short reason`,
        (await page.locator('textarea').count()) > 0);
      record(`[${lang}] short reason fired no cancel request`,
        bookingRequests.length === beforeCancel);
      record(`[${lang}] validation message is translated, not a raw key`,
        !(await page.locator('body').innerText()).includes('modal.reason_too_short'));

      if (MUTATE) {
        // Real cancellation: proves the DoD ("a booking can be cancelled and
        // the row updates") end-to-end. Off by default so repeat runs do not
        // keep eating seeded bookings.
        const targetId = await page
          .locator('tbody tr')
          .filter({ has: page.locator(`button[title="${L.cancelBooking}"]`) })
          .first()
          .locator('td')
          .first()
          .innerText();
        const cancelPosts = [];
        page.on('request', (r) => {
          if (r.method() === 'POST' && r.url().includes('/cancel')) cancelPosts.push(r.url());
        });

        await page.locator('textarea').fill('verification script cancelling a seeded booking');
        await page.getByRole('button', { name: rx(L.confirmCancel) }).click();
        await page.waitForTimeout(2500);

        record(`[${lang}] valid reason fires POST /staff/bookings/{id}/cancel`,
          cancelPosts.some((u) => /\/staff\/bookings\/\d+\/cancel$/.test(u)),
          cancelPosts.join(' '));
        record(`[${lang}] cancel modal closed after success`,
          (await page.locator('textarea').count()) === 0);

        const rowText = await page
          .locator('tbody tr')
          .filter({ hasText: targetId })
          .first()
          .innerText();
        const cancelledLabel = locale(lang).bookings.status_cancelled;
        // The status badge is `uppercase` in CSS and innerText returns the
        // transformed text, so compare case-insensitively.
        record(`[${lang}] row ${targetId} now reads "${cancelledLabel}"`,
          rowText.toLocaleLowerCase(lang).includes(cancelledLabel.toLocaleLowerCase(lang)),
          rowText.replace(/\s+/g, ' '));

        // and the server agrees
        const after = await get(token, `/staff/bookings?status=cancelled&per_page=50`);
        const rawId = Number(targetId.replace(/\D/g, ''));
        record(`[${lang}] server lists ${targetId} as cancelled`,
          after.data.some((b) => b.id === rawId));
      } else {
        // Close without confirming — the default run must not mutate seed data.
        await page.getByRole('button', { name: rx(L.close) }).last().click();
        await page.waitForTimeout(400);
      }
    } else {
      record(`[${lang}] cancel control present for a pending/confirmed booking`, false,
        'no cancel button found');
    }

    record(`[${lang}] no console errors`, consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | '));

    await page.screenshot({ path: `bookings-${lang}.png`, fullPage: true });
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

run().catch((e) => { console.error(e); process.exit(1); });
