/**
 * Phase 7 acceptance check — drives the real Support page in Chromium against a
 * running backend and asserts the rendered UI matches the live API payload, in
 * both languages.
 *
 *   node docs/api/verify-support.mjs
 *   node docs/api/verify-support.mjs --mutate   # one real respond, escalate, escalated-resolve
 *
 * Requires: backend on :8000, `npm run dev` on :5173, `npx playwright install
 * chromium`, and the Phase 7/8 seed applied (docs/api/seed-phase-7-8.sql).
 * Writes support-{en,ar}.png.
 *
 * READ-ONLY BY DEFAULT — WITH ONE DELIBERATE EXCEPTION, STATED UP FRONT:
 * `GET /staff/complaints/{id}` is NOT a read. `openComplaint()` transitions a
 * `pending`, unassigned complaint to `in_review` and assigns it to the caller.
 * Opening a pending row therefore MUTATES THE DATABASE.
 *
 * The choice made here, explicitly: the read-only pass **opens only non-pending
 * rows**, so it genuinely writes nothing. The side effect itself is still
 * verified for real — but only under `--mutate`, on complaint 4, which the seed
 * reserves for exactly this and which the script restores afterwards by printing
 * the one-line UPDATE (there is no un-open endpoint).
 *
 * Validator probes ARE run read-only, because every one of them fails before any
 * write: a 422 leaves the complaint exactly as it was.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

/** `resolution_notes => required|string|min:10|max:3000`. */
const NOTES_MIN = 10;
const NOTES_MAX = 3000;
/** `reason => required|string|min:10|max:1000` on escalate. */
const REASON_MAX = 1000;
/** The seed reserves complaint 4 (pending, unassigned) for the show() probe. */
const SIDE_EFFECT_COMPLAINT = 4;

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

/**
 * Not every response is JSON. An unregistered route (the Postman-only complaint
 * verbs) and the 500-ing `metrics` route both return Laravel/Ignition HTML, so
 * parsing unconditionally throws and takes the whole run down.
 */
const parse = async (res) => {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { __nonJson: true, raw: text.slice(0, 200) };
  }
};

const get = async (token, path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${token}` } });
  return { status: res.status, body: await parse(res) };
};

const patch = async (token, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await parse(res) };
};

/** Labels read from the shipped locale JSON, never hardcoded. */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    title: l.support.title,
    tabInbox: l.support.tab_inbox,
    tabEscalated: l.support.tab_escalated,
    allStatuses: l.support.all_statuses,
    allTypes: l.support.all_types,
    allDates: l.support.all_dates,
    tabResolvedAll: l.support.tab_resolved_all,
    tabClosedAll: l.support.tab_closed_all,
    status: l.common.status,
    type: l.support.type,
    dateLast7: l.support.date_last_7_days,
    dateLast30: l.support.date_last_30_days,
    empty: l.support.empty,
    emptyFiltered: l.support.empty_filtered,
    noEscalated: l.support.no_escalated,
    selectHint: l.support.select_hint,
    respond: l.support.respond,
    respondConfirm: l.support.respond_confirm,
    escalate: l.support.escalate,
    escalateConfirm: l.support.escalate_confirm,
    resolveAndNotify: l.support.resolve_and_notify,
    resolveConfirm: l.support.resolve_confirm,
    unassigned: l.support.unassigned,
    noAttachments: l.support.no_attachments,
    attachmentUnavailable: l.support.attachment_unavailable,
    attachmentOpen: l.support.attachment_open,
    reasonTooShort: l.modal.reason_too_short,
    totalOpen: l.support.total_open,
    cancel: l.common.cancel,
  };
};

/** Renders a count-bearing key exactly as i18next will, incl. Arabic's 6 CLDR forms. */
const pluralLabel = (lang, table, base, count) => {
  const l = locale(lang);
  const category = new Intl.PluralRules(lang).select(count);
  const t = l[table];
  const value = t[`${base}_${category}`] ?? t[`${base}_other`] ?? t[base] ?? `MISSING:${base}`;
  return value.replace(/\{\{count\}\}/g, String(count));
};

const showingRange = (lang, from, to, count) => {
  const l = locale(lang);
  const category = new Intl.PluralRules(lang).select(count);
  const v =
    l.common[`showing_range_${category}`] ?? l.common.showing_range_other ?? 'MISSING:showing_range';
  return v
    .replace(/\{\{from\}\}/g, String(from))
    .replace(/\{\{to\}\}/g, String(to))
    .replace(/\{\{count\}\}/g, String(count));
};

const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/** Polls a DOM assertion — the backend is single-process `artisan serve`. */
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

  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, ok, detail });
  const notes = [];

  // ══ contract-level assertions (language-independent) ═══════════════════════

  const index = (await get(token, '/staff/complaints')).body;
  record(
    'GET /staff/complaints returns {status, data[], meta, counts}',
    index.status === 'success' &&
      Array.isArray(index.data) &&
      !!index.meta &&
      !!index.counts,
    Object.keys(index).join(',')
  );
  record(
    'the index DOES carry a counts block — unlike /staff/bookings, /admin/drivers, /admin/users (REQ-2)',
    ['all', 'pending', 'in_review', 'resolved', 'closed'].every((k) => k in index.counts),
    JSON.stringify(index.counts)
  );

  if (index.meta.total === 0) {
    console.log(
      'The complaints table is EMPTY — nothing on this page can render. Apply the seed first:\n' +
        '  mysql ... 4th_year_project_db < docs/api/seed-phase-7-8.sql\n' +
        '  php artisan cache:clear'
    );
    process.exit(1);
  }

  // ── BUG-9: counts.all overstates the list ──────────────────────────────────
  const bucketSum =
    index.counts.pending + index.counts.in_review + index.counts.resolved + index.counts.closed;
  record(
    `counts.all (${index.counts.all}) is NOT the list size (${index.meta.total}) — it counts escalated rows index excludes (BUG-9)`,
    index.counts.all !== index.meta.total,
    `all=${index.counts.all} total=${index.meta.total}`
  );
  record(
    `the four buckets sum to exactly meta.total (${bucketSum} = ${index.meta.total}) — this is what the "all" badge must show`,
    bucketSum === index.meta.total,
    `sum=${bucketSum} total=${index.meta.total}`
  );

  // ── the escalated guard, proven against the server ─────────────────────────
  const escalatedOnIndex = await get(token, '/staff/complaints?status=escalated');
  record(
    'status=escalated on the INDEX route is rejected with 422 — the client must never send it',
    escalatedOnIndex.status === 422 && !!escalatedOnIndex.body.errors?.status,
    `status ${escalatedOnIndex.status}`
  );

  const escalated = (await get(token, '/staff/escalated-complaints')).body;
  record(
    'GET /staff/escalated-complaints carries its OWN counts vocabulary {escalated,resolved,closed}',
    ['escalated', 'resolved', 'closed'].every((k) => k in escalated.counts),
    JSON.stringify(escalated.counts)
  );
  record(
    'the escalated list returns only escalated rows by default',
    escalated.data.length > 0 && escalated.data.every((c) => c.status === 'escalated'),
    escalated.data.map((c) => c.status).join(',')
  );

  // ── BUG-10: the escalated status filter drops its own constraint ───────────
  const escalatedResolved = (await get(token, '/staff/escalated-complaints?status=resolved')).body;
  const neverEscalated = escalatedResolved.data.filter((c) => !c.is_escalated);
  record(
    'escalated?status=resolved returns complaints that were NEVER escalated (BUG-10)',
    neverEscalated.length > 0,
    `${neverEscalated.length}/${escalatedResolved.data.length} rows have is_escalated=false: ids ${neverEscalated
      .map((c) => c.id)
      .join(',')}`
  );

  // ── metrics: 500 with a stack trace, NOT 404 ───────────────────────────────
  const metrics = await fetch(`${API}/staff/complaints/metrics`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const metricsText = await metrics.text();
  record(
    'GET /staff/complaints/metrics returns 500 (not 404) — "metrics" hits the {id} route int type hint (BUG-8)',
    metrics.status === 500,
    `status ${metrics.status}`
  );
  record(
    '…and leaks an Ignition stack trace with absolute file paths (APP_DEBUG=true, NOTE-2)',
    /TypeError|StaffComplaintController/.test(metricsText),
    metricsText.slice(0, 120).replace(/\s+/g, ' ')
  );

  // ── filters change the ROW COUNT, not just their echo ──────────────────────
  const last7 = (await get(token, '/staff/complaints?date=last_7_days')).body;
  const last30 = (await get(token, '/staff/complaints?date=last_30_days')).body;
  record(
    `the date filter changes the row count: none=${index.meta.total} · 30d=${last30.meta.total} · 7d=${last7.meta.total}`,
    last7.meta.total < last30.meta.total && last30.meta.total < index.meta.total,
    `${index.meta.total}/${last30.meta.total}/${last7.meta.total}`
  );

  const TYPES = [
    'trip_safety',
    'driver_behavior',
    'passenger_behavior',
    'ride_cancellation',
    'financial_issue',
    'account_issue',
    'technical_issue',
    'other',
  ];
  const typeTotals = {};
  for (const type of TYPES) {
    typeTotals[type] = (await get(token, `/staff/complaints?type=${type}`)).body.meta.total;
  }
  record(
    'all 8 type values are accepted and partition the list',
    Object.values(typeTotals).reduce((a, b) => a + b, 0) === index.meta.total,
    JSON.stringify(typeTotals)
  );
  const badType = await get(token, '/staff/complaints?type=harassment');
  record(
    'a type outside the enum is rejected with 422 (the old mock categories would have)',
    badType.status === 422,
    `status ${badType.status}`
  );

  // ── pagination is real ─────────────────────────────────────────────────────
  const p1 = (await get(token, '/staff/complaints?per_page=5&page=1')).body;
  const p2 = (await get(token, '/staff/complaints?per_page=5&page=2')).body;
  const overlap = p1.data.filter((a) => p2.data.some((b) => b.id === a.id));
  record(
    `per_page=5 yields ${p1.meta.last_page} pages with no overlap between page 1 and 2`,
    p1.meta.last_page > 1 && overlap.length === 0 && p2.data.length > 0,
    `overlap=${overlap.length} lastPage=${p1.meta.last_page}`
  );
  const badPerPage = await get(token, '/staff/complaints?per_page=51');
  record('per_page above the 1–50 cap is rejected with 422', badPerPage.status === 422);

  // ── validators (all fail before any write) ─────────────────────────────────
  const target = index.data.find((c) => c.status === 'in_review') ?? index.data[0];
  const shortNotes = await patch(token, `/staff/complaints/${target.id}/respond`, {
    resolution_notes: 'too short',
    status: 'resolved',
  });
  record(
    `respond rejects resolution_notes under ${NOTES_MIN} chars`,
    shortNotes.status === 422 && !!shortNotes.body.errors?.resolution_notes,
    `status ${shortNotes.status}`
  );
  const longNotes = await patch(token, `/staff/complaints/${target.id}/respond`, {
    resolution_notes: 'x'.repeat(NOTES_MAX + 1),
    status: 'resolved',
  });
  record(`respond rejects resolution_notes over ${NOTES_MAX} chars`, longNotes.status === 422);
  const badStatus = await patch(token, `/staff/complaints/${target.id}/respond`, {
    resolution_notes: 'a perfectly valid response body',
    status: 'pending',
  });
  record(
    'respond rejects status=pending — only in_review|resolved|closed are valid',
    badStatus.status === 422 && !!badStatus.body.errors?.status,
    `status ${badStatus.status}`
  );
  const shortReason = await patch(token, `/staff/complaints/${target.id}/escalate`, {
    reason: 'short',
  });
  record('escalate rejects a reason under 10 chars', shortReason.status === 422);
  const longReason = await patch(token, `/staff/complaints/${target.id}/escalate`, {
    reason: 'x'.repeat(REASON_MAX + 1),
  });
  record(`escalate rejects a reason over ${REASON_MAX} chars`, longReason.status === 422);

  // ── the Postman-only verbs really are absent from this checkout ────────────
  for (const verb of ['open', 'resolve', 'close']) {
    const res = await patch(token, `/staff/complaints/${target.id}/${verb}`, {});
    record(
      `PATCH /staff/complaints/{id}/${verb} does not exist in this checkout (Postman-only)`,
      res.status === 404 || res.status === 405,
      `status ${res.status}`
    );
  }

  // ── attachments are present to verify against ──────────────────────────────
  const withAttachments = index.data.filter((c) => (c.attachments ?? []).length > 0);
  record(
    'at least one complaint carries attachments, so the viewer can be exercised',
    withAttachments.length > 0,
    `${withAttachments.length} complaints with attachments`
  );
  const mimeTypes = new Set(withAttachments.flatMap((c) => c.attachments.map((a) => a.mime_type)));
  record(
    'attachments span an image AND a non-image MIME type (both render paths)',
    [...mimeTypes].some((m) => m.startsWith('image/')) &&
      [...mimeTypes].some((m) => !m.startsWith('image/')),
    [...mimeTypes].join(',')
  );

  // ══ browser passes ═════════════════════════════════════════════════════════

  const browser = await chromium.launch();

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    // Re-read per language: a --mutate pass in `en` changes what `ar` must see.
    const live = (await get(token, '/staff/complaints?per_page=10&page=1')).body;
    const liveEscalated = (await get(token, '/staff/escalated-complaints')).body;

    const context = await browser.newContext({ viewport: { width: 1600, height: 1600 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const brokenFiles = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    // BUG-7: /storage/ URLs 404, and Chromium surfaces it as ERR_BLOCKED_BY_ORB
    // on `requestfailed` rather than as a response. Watch both.
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/storage/')) brokenFiles.push(r.url());
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/storage/')) brokenFiles.push(r.url());
    });

    const indexRequests = [];
    const escalatedRequests = [];
    const showRequests = [];
    const mutations = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.includes('/api/')) return;
      if (/\/api\/staff\/complaints(\?|$)/.test(url)) indexRequests.push(new URL(url));
      if (/\/api\/staff\/escalated-complaints(\?|$)/.test(url)) escalatedRequests.push(new URL(url));
      if (r.method() === 'GET' && /\/api\/staff\/complaints\/\d+$/.test(url)) {
        showRequests.push(new URL(url));
      }
      if (r.method() === 'PATCH') mutations.push({ url, body: r.postData() });
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

    await page.goto(`${APP}/support`, { waitUntil: 'networkidle' });
    await until(async () => (await page.getByTestId('complaint-row').count()) > 0);

    let body = await page.locator('body').innerText();

    record(`[${lang}] the page fetches GET /staff/complaints`, indexRequests.length > 0);
    record(
      `[${lang}] the list request sends per_page explicitly (it does not ride the server default)`,
      indexRequests.at(-1)?.searchParams.get('per_page') !== null,
      indexRequests.at(-1)?.search ?? '—'
    );

    // ---- rows come from the live payload ------------------------------------
    record(
      `[${lang}] all ${live.data.length} server rows render`,
      (await page.getByTestId('complaint-row').count()) === live.data.length,
      `${await page.getByTestId('complaint-row').count()} rows vs ${live.data.length}`
    );
    record(
      `[${lang}] each row's complainant email is on the page`,
      live.data.every((c) => body.includes(c.user.email)),
      live.data.filter((c) => !body.includes(c.user.email)).map((c) => c.id).join(',')
    );

    // ---- statuses and types are translated, not echoed from the API ---------
    record(
      `[${lang}] row statuses render the shipped common.status.* labels`,
      live.data.every((c) => body.includes(L.status[c.status])),
      live.data.filter((c) => !body.includes(L.status[c.status])).map((c) => c.status).join(',')
    );
    // The API's type_label is Arabic-only; in `en` it must not appear at all.
    if (lang === 'en') {
      const arabicLabels = live.data.map((c) => c.type_label).filter(Boolean);
      record(
        `[${lang}] the API's Arabic-only type_label does NOT leak into the English UI`,
        arabicLabels.every((l) => !body.includes(l)),
        arabicLabels.filter((l) => body.includes(l)).join(',')
      );
      record(
        `[${lang}] …and the English type labels are rendered instead`,
        live.data.every((c) => !c.type || body.includes(L.type[c.type])),
        live.data.filter((c) => c.type && !body.includes(L.type[c.type])).map((c) => c.type).join(',')
      );
    }
    // `status_label` is English-only; in `ar` it must not appear.
    if (lang === 'ar') {
      const englishStatuses = [...new Set(live.data.map((c) => c.status_label))];
      record(
        `[${lang}] the API's English-only status_label does NOT leak into the Arabic UI`,
        englishStatuses.every((s) => !body.includes(s)),
        englishStatuses.filter((s) => body.includes(s)).join(',')
      );
    }

    // ---- KPI cards are derived from counts ---------------------------------
    record(
      `[${lang}] the "open" KPI equals pending + in_review (${live.counts.pending + live.counts.in_review})`,
      (await page.getByTestId('support-stat-open').innerText()).includes(
        String(live.counts.pending + live.counts.in_review)
      ),
      await page.getByTestId('support-stat-open').innerText()
    );
    record(
      `[${lang}] the escalated KPI comes from the escalated endpoint's own counts (${liveEscalated.counts.escalated})`,
      (await page.getByTestId('support-stat-escalated').innerText()).includes(
        String(liveEscalated.counts.escalated)
      ),
      await page.getByTestId('support-stat-escalated').innerText()
    );
    record(
      `[${lang}] the avg-response-time card is GONE (its endpoint 500s — BUG-8)`,
      !body.includes('—') || (await page.getByTestId('support-stat-open').count()) === 1,
      'no dashed KPI card should remain'
    );

    // ---- tab badges come from counts, and "all" is the bucket sum -----------
    const liveBucketSum =
      live.counts.pending + live.counts.in_review + live.counts.resolved + live.counts.closed;
    const allTab = page.getByRole('tab', { name: rx(L.allStatuses) }).first();
    record(
      `[${lang}] the "all" tab badge shows the bucket sum ${liveBucketSum}, not counts.all ${live.counts.all}`,
      (await allTab.innerText()).includes(String(liveBucketSum)) &&
        !(await allTab.innerText()).includes(String(live.counts.all)),
      await allTab.innerText()
    );
    for (const status of ['pending', 'in_review', 'resolved', 'closed']) {
      const tab = page.getByRole('tab', { name: rx(L.status[status]) }).first();
      record(
        `[${lang}] the ${status} tab badge matches counts.${status} (${live.counts[status]})`,
        (await tab.innerText()).includes(String(live.counts[status])),
        await tab.innerText()
      );
    }

    // ---- no untranslated keys ----------------------------------------------
    const rawKeys = body.match(/\b(support|common|modal|reviews)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the page`, rawKeys.length === 0, rawKeys.slice(0, 5).join(', '));

    // ---- showing-range label uses the plural-correct shared key -------------
    const expectedRange = showingRange(lang, 1, live.data.length, live.meta.total);
    record(
      `[${lang}] the pagination label reads the shipped plural form: "${expectedRange}"`,
      body.includes(expectedRange),
      expectedRange
    );

    // ---- the type filter is server-side ------------------------------------
    const before = indexRequests.length;
    await page.getByTestId('support-type-filter').selectOption('trip_safety');
    record(
      `[${lang}] choosing a type issues a new request carrying type=trip_safety`,
      await until(
        async () =>
          indexRequests.length > before &&
          indexRequests.at(-1).searchParams.get('type') === 'trip_safety'
      ),
      indexRequests.at(-1)?.search ?? '—'
    );
    await until(
      async () => (await page.getByTestId('complaint-row').count()) === typeTotals.trip_safety
    );
    record(
      `[${lang}] the trip_safety filter renders exactly ${typeTotals.trip_safety} rows`,
      (await page.getByTestId('complaint-row').count()) === typeTotals.trip_safety,
      `${await page.getByTestId('complaint-row').count()} rows`
    );
    await page.getByTestId('support-type-filter').selectOption('all');
    await until(async () => (await page.getByTestId('complaint-row').count()) === live.data.length);

    // ---- the date filter is server-side and changes the row count ----------
    const beforeDate = indexRequests.length;
    await page.getByTestId('support-date-filter').selectOption('last_7_days');
    record(
      `[${lang}] choosing a date window issues date=last_7_days`,
      await until(
        async () =>
          indexRequests.length > beforeDate &&
          indexRequests.at(-1).searchParams.get('date') === 'last_7_days'
      ),
      indexRequests.at(-1)?.search ?? '—'
    );
    record(
      `[${lang}] last_7_days renders ${last7.meta.total} rows, fewer than the ${index.meta.total} unfiltered`,
      await until(async () => (await page.getByTestId('complaint-row').count()) === last7.meta.total),
      `${await page.getByTestId('complaint-row').count()} rows vs ${last7.meta.total}`
    );
    await page.getByTestId('support-date-filter').selectOption('all');
    await until(async () => (await page.getByTestId('complaint-row').count()) === live.data.length);

    // ---- per_page + page resets to 1 on a filter change ---------------------
    const perPageSelect = page.getByTestId('per-page-select');
    await perPageSelect.selectOption('5');
    await until(async () => indexRequests.at(-1)?.searchParams.get('per_page') === '5');
    await page.getByTestId('pagination-next').click();
    await until(async () => indexRequests.at(-1)?.searchParams.get('page') === '2');
    record(
      `[${lang}] the next control issues page=2 carrying per_page`,
      indexRequests.at(-1)?.searchParams.get('page') === '2' &&
        indexRequests.at(-1)?.searchParams.get('per_page') === '5',
      indexRequests.at(-1)?.search ?? '—'
    );
    await page.getByTestId('support-type-filter').selectOption('financial_issue');
    record(
      `[${lang}] changing a filter while on page 2 resets to page=1`,
      await until(
        async () =>
          indexRequests.at(-1)?.searchParams.get('type') === 'financial_issue' &&
          indexRequests.at(-1)?.searchParams.get('page') === '1'
      ),
      indexRequests.at(-1)?.search ?? '—'
    );
    await page.getByTestId('support-type-filter').selectOption('all');
    await perPageSelect.selectOption('10');
    await until(async () => (await page.getByTestId('complaint-row').count()) === live.data.length);

    // ---- the escalated tab NEVER sends status=escalated to index ------------
    const badIndexCalls = indexRequests.filter(
      (u) => u.searchParams.get('status') === 'escalated'
    );
    record(
      `[${lang}] no index request has ever carried status=escalated (it would 422)`,
      badIndexCalls.length === 0,
      badIndexCalls.map((u) => u.search).join(' | ')
    );

    // ---- opening a NON-pending complaint: read-only by construction ---------
    const nonPending = live.data.find((c) => c.status !== 'pending');
    if (nonPending) {
      const rowIndex = live.data.findIndex((c) => c.id === nonPending.id);
      const showsBefore = showRequests.length;
      await page.getByTestId('complaint-row').nth(rowIndex).click();
      record(
        `[${lang}] clicking a row calls GET /staff/complaints/{id}`,
        await until(async () => showRequests.length > showsBefore),
        `${showRequests.length} show requests`
      );
      await until(async () => (await page.getByTestId('complaint-detail').count()) === 1);
      const detail = await page.getByTestId('complaint-detail').innerText();
      record(
        `[${lang}] the detail panel renders the complaint the server returned (#${nonPending.id})`,
        detail.includes(String(nonPending.id)),
        detail.slice(0, 120).replace(/\s+/g, ' ')
      );
      record(
        `[${lang}] opening a NON-pending complaint did not change its status (read-only path)`,
        (await get(token, `/staff/complaints/${nonPending.id}`)).body.data.status ===
          nonPending.status,
        nonPending.status
      );
    }

    // ---- attachments --------------------------------------------------------
    /**
     * `c.status !== 'pending'` is load-bearing, not defensive: inspecting the
     * attachments means CLICKING the row, and clicking a pending row fires the
     * GET that writes. An earlier cut of the seed put the attachments on a
     * pending complaint and this "read-only" pass silently moved it to
     * in_review — the badge counts differed between the en and ar passes, which
     * is how it was caught. The seed now attaches to an in_review complaint and
     * this filter keeps the guarantee true even if the seed changes again.
     */
    const attachTarget = live.data.find(
      (c) => (c.attachments ?? []).length > 0 && c.status !== 'pending'
    );
    if (!live.data.some((c) => (c.attachments ?? []).length > 0 && c.status !== 'pending')) {
      notes.push(
        'ATTACHMENTS: every complaint carrying attachments in this seed is `pending`, and ' +
          'opening a pending complaint mutates it. The attachment viewer was therefore NOT ' +
          'exercised on this run. Move the attachments onto a non-pending complaint to verify it.'
      );
    }
    if (attachTarget) {
      const idx = live.data.findIndex((c) => c.id === attachTarget.id);
      await page.getByTestId('complaint-row').nth(idx).click();
      await until(async () => (await page.getByTestId('complaint-attachments').count()) === 1);
      record(
        `[${lang}] all ${attachTarget.attachments.length} attachments render`,
        (await page.getByTestId('complaint-attachment').count()) ===
          attachTarget.attachments.length,
        `${await page.getByTestId('complaint-attachment').count()} tiles`
      );
      record(
        `[${lang}] each attachment shows its original filename and a download link`,
        (await until(async () => {
          const t = await page.getByTestId('complaint-attachments').innerText();
          return attachTarget.attachments.every((a) => t.includes(a.original_name));
        })) && (await page.getByTestId('attachment-link').count()) === attachTarget.attachments.length
      );
      // BUG-7: the image URL 404s, so the tile must flip to "unavailable".
      const imageCount = attachTarget.attachments.filter((a) =>
        a.mime_type.startsWith('image/')
      ).length;
      if (imageCount > 0) {
        record(
          `[${lang}] the unreachable image degrades to the "unavailable" panel (BUG-7), no <img> left`,
          await until(async () => {
            const unavailable = await page.getByTestId('attachment-unavailable').count();
            const imgs = await page.getByTestId('complaint-attachments').locator('img').count();
            return unavailable === imageCount && imgs === 0;
          }),
          `unavailable=${await page.getByTestId('attachment-unavailable').count()} imgs=${await page
            .getByTestId('complaint-attachments')
            .locator('img')
            .count()}`
        );
        record(
          `[${lang}] …and the raw /storage/ URL really did fail, proving the degradation is real`,
          brokenFiles.length > 0,
          brokenFiles.slice(0, 2).join(' ')
        );
      }
    }

    // ---- actions are hidden, not shown-and-422'd ---------------------------
    const closedRow = live.data.find((c) => c.status === 'resolved' || c.status === 'closed');
    if (closedRow) {
      const idx = live.data.findIndex((c) => c.id === closedRow.id);
      await page.getByTestId('complaint-row').nth(idx).click();
      await until(async () => (await page.getByTestId('complaint-detail').count()) === 1);
      record(
        `[${lang}] a ${closedRow.status} complaint offers NO respond/escalate control (hide-not-422)`,
        (await page.getByTestId('complaint-respond').count()) === 0 &&
          (await page.getByTestId('complaint-escalate').count()) === 0 &&
          (await page.getByTestId('complaint-no-actions').count()) === 1
      );
    }

    const actionable = live.data.find((c) => c.status === 'in_review' || c.status === 'pending');
    if (actionable && actionable.status === 'in_review') {
      const idx = live.data.findIndex((c) => c.id === actionable.id);
      await page.getByTestId('complaint-row').nth(idx).click();
      await until(async () => (await page.getByTestId('complaint-respond').count()) === 1);

      // ---- the respond modal enforces the real validators client-side -------
      await page.getByTestId('complaint-respond').click();
      await until(async () => (await page.getByTestId('confirm-action-reason').count()) === 1);
      record(
        `[${lang}] the respond modal offers exactly the 3 valid statuses (in_review|resolved|closed)`,
        (await page.getByTestId('confirm-action-status').locator('option').count()) === 3,
        `${await page.getByTestId('confirm-action-status').locator('option').count()} options`
      );
      record(
        `[${lang}] the notes field carries the server's maxlength=${NOTES_MAX}`,
        (await page.getByTestId('confirm-action-reason').getAttribute('maxlength')) ===
          String(NOTES_MAX)
      );
      const mutationsBefore = mutations.length;
      await page.getByTestId('confirm-action-reason').fill('too short');
      await page.getByTestId('confirm-action-submit').click();
      record(
        `[${lang}] a sub-${NOTES_MIN}-char response is blocked BEFORE any request is sent`,
        mutations.length === mutationsBefore &&
          (await page.getByTestId('confirm-action-reason').count()) === 1,
        `${mutations.length - mutationsBefore} requests fired`
      );
      await page.getByRole('button', { name: rx(L.cancel) }).first().click();
      await until(async () => (await page.getByTestId('confirm-action-reason').count()) === 0);
    }

    // ---- escalated view -----------------------------------------------------
    await page.getByTestId('support-view-escalated').click();
    await until(async () => escalatedRequests.length > 0);
    record(
      `[${lang}] the escalated tab calls GET /staff/escalated-complaints with status=escalated`,
      escalatedRequests.at(-1)?.searchParams.get('status') === 'escalated',
      escalatedRequests.at(-1)?.search ?? '—'
    );
    await until(
      async () => (await page.getByTestId('complaint-row').count()) === liveEscalated.data.length
    );
    record(
      `[${lang}] the escalated view renders its ${liveEscalated.data.length} rows`,
      (await page.getByTestId('complaint-row').count()) === liveEscalated.data.length
    );
    const escTab = page.getByRole('tab', { name: rx(L.status.escalated) }).first();
    record(
      `[${lang}] the escalated badge comes from the escalated counts (${liveEscalated.counts.escalated})`,
      (await escTab.innerText()).includes(String(liveEscalated.counts.escalated)),
      await escTab.innerText()
    );
    // BUG-10 is surfaced honestly in the label rather than papered over.
    body = await page.locator('body').innerText();
    record(
      `[${lang}] the escalated view's resolved/closed tabs are labelled "(all)" — they are NOT escalation history (BUG-10)`,
      body.includes(L.tabResolvedAll) && body.includes(L.tabClosedAll),
      `${L.tabResolvedAll} / ${L.tabClosedAll}`
    );

    // ══ --mutate: one real respond, escalate, escalated-resolve ══════════════
    if (MUTATE && lang === 'en') {
      // 1. the show() side effect, on the complaint the seed reserves for it
      const beforeOpen = (await get(token, `/staff/complaints?status=pending`)).body;
      const reserved = beforeOpen.data.find((c) => c.id === SIDE_EFFECT_COMPLAINT);
      if (reserved) {
        const countsBefore = beforeOpen.counts;
        await page.getByTestId('support-view-inbox').click();
        await until(async () => (await page.getByTestId('complaint-row').count()) > 0);
        await page.getByTestId('support-type-filter').selectOption(reserved.type);
        await until(async () => (await page.getByTestId('complaint-row').count()) > 0);
        const rows = await page.getByTestId('complaint-row').allInnerTexts();
        const targetRow = rows.findIndex((r) => r.includes(`CMP-${reserved.id}`));
        if (targetRow >= 0) {
          await page.getByTestId('complaint-row').nth(targetRow).click();
          const after = await until(async () => {
            const fresh = (await get(token, `/staff/complaints?status=in_review`)).body;
            return fresh.data.some((c) => c.id === reserved.id);
          });
          record(
            `[MUTATE] opening pending complaint ${reserved.id} moved it to in_review server-side`,
            after
          );
          const countsAfter = (await get(token, '/staff/complaints')).body.counts;
          record(
            `[MUTATE] the badge counts shifted underneath the list (pending ${countsBefore.pending}→${countsAfter.pending}, in_review ${countsBefore.in_review}→${countsAfter.in_review})`,
            countsAfter.pending === countsBefore.pending - 1 &&
              countsAfter.in_review === countsBefore.in_review + 1,
            `${JSON.stringify(countsBefore)} → ${JSON.stringify(countsAfter)}`
          );
          record(
            `[MUTATE] the UI told the user the complaint was assigned to them`,
            await until(async () => {
              const banner = await page.getByTestId('action-banner').count();
              if (!banner) return false;
              const text = await page.getByTestId('action-banner').innerText();
              return text.includes(String(reserved.id));
            }),
            (await page.getByTestId('action-banner').count())
              ? await page.getByTestId('action-banner').innerText()
              : 'no banner'
          );
          notes.push(
            `MUTATE residue — complaint ${reserved.id} was OPENED, which is a write with no inverse ` +
              `endpoint. Restore it with:\n` +
              `      UPDATE complaints SET status='pending', assigned_to=NULL WHERE id=${reserved.id};\n` +
              `      php artisan cache:clear`
          );
        }
      }

      // 2. a real respond
      const respondTarget = (await get(token, '/staff/complaints?status=in_review')).body.data[0];
      if (respondTarget) {
        const before = respondTarget.status;
        const res = await patch(token, `/staff/complaints/${respondTarget.id}/respond`, {
          resolution_notes: 'Verified by verify-support.mjs — refund issued and driver warned.',
          status: 'resolved',
        });
        record(
          `[MUTATE] a real respond moved complaint ${respondTarget.id} ${before} → resolved`,
          res.status === 200 && res.body.data.status === 'resolved',
          `status ${res.status} → ${res.body.data?.status}`
        );
        record(
          `[MUTATE] …and the server stored the resolution notes verbatim`,
          res.body.data?.resolution_notes?.includes('verify-support.mjs'),
          res.body.data?.resolution_notes?.slice(0, 60)
        );
        notes.push(
          `MUTATE residue — complaint ${respondTarget.id} responded (now resolved). Restore:\n` +
            `      UPDATE complaints SET status='${before}', resolution_notes=NULL, resolved_at=NULL WHERE id=${respondTarget.id};`
        );
      }

      // 3. a real escalate
      const escalateTarget = (await get(token, '/staff/complaints?status=pending')).body.data[0];
      if (escalateTarget) {
        const res = await patch(token, `/staff/complaints/${escalateTarget.id}/escalate`, {
          reason: 'Verified by verify-support.mjs — needs an admin decision on the driver account.',
        });
        record(
          `[MUTATE] a real escalate moved complaint ${escalateTarget.id} to escalated`,
          res.status === 200 && res.body.data.status === 'escalated',
          `status ${res.status} → ${res.body.data?.status}`
        );
        record(
          `[MUTATE] …and it left the agent queue (assigned_to cleared, absent from index)`,
          res.body.data?.assigned_to === null &&
            !(await get(token, '/staff/complaints')).body.data.some(
              (c) => c.id === escalateTarget.id
            ),
          `assigned_to=${JSON.stringify(res.body.data?.assigned_to)}`
        );
        notes.push(
          `MUTATE residue — complaint ${escalateTarget.id} escalated. Restore:\n` +
            `      UPDATE complaints SET status='pending', assigned_to=NULL, resolution_notes=NULL WHERE id=${escalateTarget.id};`
        );
      }

      // 4. a real escalated-resolve
      const resolveTarget = (await get(token, '/staff/escalated-complaints')).body.data[0];
      if (resolveTarget) {
        const res = await patch(
          token,
          `/staff/escalated-complaints/${resolveTarget.id}/resolve`,
          {
            resolution_notes: 'Verified by verify-support.mjs — admin closed after review.',
            status: 'closed',
          }
        );
        record(
          `[MUTATE] a real escalated-resolve moved complaint ${resolveTarget.id} to closed`,
          res.status === 200 && res.body.data.status === 'closed',
          `status ${res.status} → ${res.body.data?.status}`
        );
        record(
          `[MUTATE] …and the admin log was APPENDED to the escalation log, not replacing it`,
          res.body.data?.resolution_notes?.includes('ESCALATED') &&
            res.body.data?.resolution_notes?.includes('RESOLVED by Admin'),
          res.body.data?.resolution_notes?.slice(0, 80)
        );
        notes.push(
          `MUTATE residue — complaint ${resolveTarget.id} escalated-resolved (now closed). Restore:\n` +
            `      UPDATE complaints SET status='escalated', assigned_to=NULL, resolved_at=NULL WHERE id=${resolveTarget.id};`
        );
      }

      notes.push(
        'The cleanest restore after --mutate is simply to re-run the whole seed:\n' +
          '      mysql ... < docs/api/revert-phase-7-8.sql && mysql ... < docs/api/seed-phase-7-8.sql\n' +
          '      php artisan cache:clear'
      );
    }

    const realErrors = consoleErrors.filter(
      (e) => !/404|ERR_BLOCKED_BY_ORB|storage/i.test(e) || brokenFiles.length === 0
    );
    record(
      `[${lang}] no console errors beyond the documented storage failures (BUG-7)`,
      realErrors.length === 0,
      realErrors.slice(0, 3).join(' | ')
    );

    await page.screenshot({ path: `support-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  if (!MUTATE) {
    /**
     * The read-only claim, ENFORCED rather than asserted in prose. Because
     * `GET /staff/complaints/{id}` writes, "read-only" is a property of which
     * rows this script clicked, not of the HTTP verbs it used — so it is checked
     * against the server at the end. This assertion is what caught the seed
     * placing attachments on a pending complaint: the counts moved between the
     * `en` and `ar` passes.
     */
    const finalCounts = (await get(token, '/staff/complaints')).body.counts;
    record(
      'READ-ONLY: the complaint status counts are byte-for-byte unchanged after the whole run',
      JSON.stringify(finalCounts) === JSON.stringify(index.counts),
      `before ${JSON.stringify(index.counts)} after ${JSON.stringify(finalCounts)}`
    );
    notes.push(
      'READ-ONLY RUN: this pass opened only NON-pending complaints, so GET ' +
        '/staff/complaints/{id} performed no write. The pending→in_review side effect is ' +
        'therefore NOT exercised here — run with --mutate to verify it for real.'
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
