/**
 * Phase 8 acceptance check — drives the real Reviews page in Chromium against a
 * running backend and asserts the rendered UI matches the live API payload, in
 * both languages.
 *
 *   node docs/api/verify-reviews.mjs
 *   node docs/api/verify-reviews.mjs --mutate   # one real comment deletion
 *
 * Requires: backend on :8000, `npm run dev` on :5173, `npx playwright install
 * chromium`, and the Phase 7/8 seed applied (docs/api/seed-phase-7-8.sql).
 * Writes reviews-{en,ar}.png.
 *
 * Fully read-only by default: `GET /staff/reviews` has no side effect (unlike
 * the complaint `show()` route Phase 7 had to work around).
 *
 * ⚠️ A DELETED profile_comment CANNOT BE RESTORED THROUGH THE API — there is no
 * un-delete endpoint and no soft delete (`ProfileComment::findOrFail()->delete()`).
 * `--mutate` therefore prints the deleted row's full contents AND the INSERT that
 * puts it back, exactly as verify-users.mjs does for the wallet charge.
 *
 * NOTE on what `search` matches: `ReviewModerationService::getComments` does
 * `where('comment','like',"%…%")` and NOTHING else — not the commenter name, not
 * the recipient name. The seed exploits this: exactly 2 of 8 comments contain
 * "punctual", so a server-side search is provable by row count.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

/** Present in exactly 2 seeded comments, and in no seeded user's name. */
const SEARCH_TOKEN = 'punctual';
/** `user_id` is `exists:users,id`; nothing near this id exists in the seed. */
const NONEXISTENT_USER_ID = 999999;

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
  return { status: res.status, body: await res.json() };
};

const del = async (token, path) => {
  const res = await fetch(`${API}${path}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
};

const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    title: l.reviews.title,
    totalComments: l.reviews.total_comments,
    searchPlaceholder: l.reviews.search_placeholder,
    allDates: l.reviews.all_dates,
    last7: l.reviews.last_7_days,
    last30: l.reviews.last_30_days,
    tableCommenter: l.reviews.table_commenter,
    tableRecipient: l.reviews.table_recipient,
    empty: l.reviews.empty,
    emptySearch: (q) => l.reviews.empty_search.replace('{{query}}', q),
    emptyFiltered: l.reviews.empty_filtered,
    filteredByUser: (id) => l.reviews.filtered_by_user.replace('{{id}}', String(id)),
    clearUserFilter: l.reviews.clear_user_filter,
    delete: l.reviews.delete,
    confirmDelete: l.reviews.confirm_delete,
    deleteModalTitle: l.reviews.delete_modal_title,
    deleteNoUndo: l.reviews.delete_no_undo,
    cancel: l.common.cancel,
  };
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

  // ══ contract-level assertions ══════════════════════════════════════════════

  const all = (await get(token, '/staff/reviews')).body;
  record(
    'GET /staff/reviews returns {status, data[], meta}',
    all.status === 'success' && Array.isArray(all.data) && !!all.meta,
    Object.keys(all).join(',')
  );
  record(
    '…and carries NO counts block, unlike /staff/complaints',
    !('counts' in all),
    Object.keys(all).join(',')
  );

  if (all.meta.total === 0) {
    console.log(
      'profile_comments is EMPTY — nothing on this page can render. Apply the seed first:\n' +
        '  mysql ... 4th_year_project_db < docs/api/seed-phase-7-8.sql'
    );
    process.exit(1);
  }

  record(
    'each row carries a commenter and a recipient, both with id + name',
    all.data.every(
      (r) => r.commenter && 'id' in r.commenter && 'name' in r.commenter && r.recipient
    ),
    JSON.stringify(all.data[0])
  );

  // ── search is genuinely server-side ────────────────────────────────────────
  const searched = (await get(token, `/staff/reviews?search=${SEARCH_TOKEN}`)).body;
  record(
    `search=${SEARCH_TOKEN} narrows ${all.meta.total} rows to ${searched.meta.total} SERVER-side`,
    searched.meta.total < all.meta.total && searched.meta.total > 0,
    `${all.meta.total} → ${searched.meta.total}`
  );
  record(
    '…and every returned comment really contains the token (it matches the body, not names)',
    searched.data.every((r) => r.comment.toLowerCase().includes(SEARCH_TOKEN)),
    searched.data.map((r) => r.comment.slice(0, 30)).join(' | ')
  );
  const nameSearch = (await get(token, `/staff/reviews?search=${encodeURIComponent('Driver5')}`))
    .body;
  record(
    'searching a RECIPIENT NAME returns nothing — proving the filter is the comment body only',
    nameSearch.meta.total === 0,
    `${nameSearch.meta.total} rows`
  );

  // ── date filter changes the row count ─────────────────────────────────────
  const d7 = (await get(token, '/staff/reviews?date=last_7_days')).body;
  const d30 = (await get(token, '/staff/reviews?date=last_30_days')).body;
  record(
    `the date filter changes the row count: none=${all.meta.total} · 30d=${d30.meta.total} · 7d=${d7.meta.total}`,
    d7.meta.total < d30.meta.total && d30.meta.total < all.meta.total,
    `${all.meta.total}/${d30.meta.total}/${d7.meta.total}`
  );
  const badDate = await get(token, '/staff/reviews?date=last_year');
  record('a date outside the 2-value enum is rejected with 422', badDate.status === 422);

  // ── user_id matches commenter OR recipient ────────────────────────────────
  const probeUser = all.data[0].commenter.id;
  const byUser = (await get(token, `/staff/reviews?user_id=${probeUser}`)).body;
  record(
    `user_id=${probeUser} returns ${byUser.meta.total} row(s), all involving that user as commenter OR recipient`,
    byUser.meta.total > 0 &&
      byUser.data.every((r) => r.commenter.id === probeUser || r.recipient.id === probeUser),
    byUser.data.map((r) => `${r.commenter.id}->${r.recipient.id}`).join(',')
  );
  const badUser = await get(token, `/staff/reviews?user_id=${NONEXISTENT_USER_ID}`);
  record(
    'a user_id that does not exist is rejected with 422 (exists:users,id) — the deep link must handle it',
    badUser.status === 422 && !!badUser.body.errors?.user_id,
    `status ${badUser.status}`
  );

  // ── pagination ────────────────────────────────────────────────────────────
  const p1 = (await get(token, '/staff/reviews?per_page=5&page=1')).body;
  const p2 = (await get(token, '/staff/reviews?per_page=5&page=2')).body;
  const overlap = p1.data.filter((a) => p2.data.some((b) => b.id === a.id));
  record(
    `per_page=5 yields ${p1.meta.last_page} pages with no overlap between page 1 and 2`,
    p1.meta.last_page > 1 && overlap.length === 0 && p2.data.length > 0,
    `overlap=${overlap.length} lastPage=${p1.meta.last_page}`
  );
  record('per_page above the 1–50 cap is rejected with 422',
    (await get(token, '/staff/reviews?per_page=51')).status === 422);

  // ══ browser passes ═════════════════════════════════════════════════════════

  const browser = await chromium.launch();

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    const live = (await get(token, '/staff/reviews?per_page=10&page=1')).body;

    const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    const listRequests = [];
    const deletes = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.includes('/api/')) return;
      if (/\/api\/staff\/reviews(\?|$)/.test(url)) listRequests.push(new URL(url));
      if (r.method() === 'DELETE' && /\/api\/staff\/reviews\/\d+$/.test(url)) {
        deletes.push({ url, body: r.postData() });
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

    await page.goto(`${APP}/reviews`, { waitUntil: 'networkidle' });
    await until(async () => (await page.getByTestId('review-row').count()) > 0);

    let body = await page.locator('body').innerText();

    record(`[${lang}] the page fetches GET /staff/reviews`, listRequests.length > 0);
    record(
      `[${lang}] the list request sends per_page explicitly`,
      listRequests.at(-1)?.searchParams.get('per_page') !== null,
      listRequests.at(-1)?.search ?? '—'
    );
    record(
      `[${lang}] the total card shows the server total (${live.meta.total})`,
      (await page.getByTestId('reviews-total').innerText()).trim() === String(live.meta.total),
      await page.getByTestId('reviews-total').innerText()
    );
    record(
      `[${lang}] all ${live.data.length} server rows render`,
      (await page.getByTestId('review-row').count()) === live.data.length,
      `${await page.getByTestId('review-row').count()} rows`
    );
    record(
      `[${lang}] each row's comment text is on the page`,
      live.data.every((r) => body.includes(r.comment.slice(0, 40))),
      live.data.filter((r) => !body.includes(r.comment.slice(0, 40))).map((r) => r.id).join(',')
    );
    record(
      `[${lang}] each row shows both the commenter and the recipient name`,
      live.data.every((r) => body.includes(r.commenter.name) && body.includes(r.recipient.name))
    );

    const rawKeys = body.match(/\b(reviews|common|modal)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the page`, rawKeys.length === 0, rawKeys.slice(0, 5).join(', '));

    const expectedRange = showingRange(lang, 1, live.data.length, live.meta.total);
    record(
      `[${lang}] the pagination label reads the shipped plural form: "${expectedRange}"`,
      body.includes(expectedRange),
      expectedRange
    );

    // ---- search is debounced and server-side --------------------------------
    const beforeSearch = listRequests.length;
    await page.getByTestId('reviews-search').fill(SEARCH_TOKEN);
    record(
      `[${lang}] typing a search issues ONE request carrying search=${SEARCH_TOKEN} (debounced)`,
      await until(
        async () =>
          listRequests.length > beforeSearch &&
          listRequests.at(-1).searchParams.get('search') === SEARCH_TOKEN
      ),
      listRequests.at(-1)?.search ?? '—'
    );
    record(
      `[${lang}] the search renders exactly the ${searched.meta.total} server-matched rows`,
      await until(async () => (await page.getByTestId('review-row').count()) === searched.meta.total),
      `${await page.getByTestId('review-row').count()} rows vs ${searched.meta.total}`
    );

    // ---- a search miss gets its OWN empty state -----------------------------
    await page.getByTestId('reviews-search').fill('zzzzz-no-such-comment');
    await until(async () => (await page.getByTestId('reviews-empty').count()) === 1);
    body = await page.locator('body').innerText();
    record(
      `[${lang}] a search miss renders the search-specific empty state, not the generic one`,
      body.includes(L.emptySearch('zzzzz-no-such-comment')) && !body.includes(L.empty),
      (await page.getByTestId('reviews-empty').innerText()).slice(0, 120)
    );
    await page.getByTestId('reviews-search').fill('');
    await until(async () => (await page.getByTestId('review-row').count()) === live.data.length);

    // ---- date filter --------------------------------------------------------
    const beforeDate = listRequests.length;
    await page.getByTestId('reviews-date-filter').selectOption('last_7_days');
    record(
      `[${lang}] the date filter issues date=last_7_days and resets page=1`,
      await until(
        async () =>
          listRequests.length > beforeDate &&
          listRequests.at(-1).searchParams.get('date') === 'last_7_days' &&
          listRequests.at(-1).searchParams.get('page') === '1'
      ),
      listRequests.at(-1)?.search ?? '—'
    );
    record(
      `[${lang}] last_7_days renders ${d7.meta.total} rows, fewer than the ${all.meta.total} unfiltered`,
      await until(async () => (await page.getByTestId('review-row').count()) === d7.meta.total),
      `${await page.getByTestId('review-row').count()} vs ${d7.meta.total}`
    );
    await page.getByTestId('reviews-date-filter').selectOption('all');
    await until(async () => (await page.getByTestId('review-row').count()) === live.data.length);

    // ---- per_page + pagination ----------------------------------------------
    await page.getByTestId('per-page-select').selectOption('5');
    await until(async () => listRequests.at(-1)?.searchParams.get('per_page') === '5');
    record(
      `[${lang}] per_page=5 renders exactly 5 rows`,
      await until(async () => (await page.getByTestId('review-row').count()) === 5),
      `${await page.getByTestId('review-row').count()} rows`
    );
    const firstPageIds = (await page.getByTestId('review-row').allInnerTexts()).join('|');
    await page.getByTestId('pagination-next').click();
    record(
      `[${lang}] the next control issues page=2 carrying per_page, and the rows change`,
      await until(
        async () =>
          listRequests.at(-1)?.searchParams.get('page') === '2' &&
          listRequests.at(-1)?.searchParams.get('per_page') === '5' &&
          (await page.getByTestId('review-row').allInnerTexts()).join('|') !== firstPageIds
      ),
      listRequests.at(-1)?.search ?? '—'
    );
    await page.getByTestId('per-page-select').selectOption('10');
    await until(async () => (await page.getByTestId('review-row').count()) === live.data.length);

    // ---- the ?user_id= deep link -------------------------------------------
    const deepLinkUser = live.data[0].commenter.id;
    const deepLinkExpected = (await get(token, `/staff/reviews?user_id=${deepLinkUser}`)).body;
    await page.goto(`${APP}/reviews?user_id=${deepLinkUser}`, { waitUntil: 'networkidle' });
    record(
      `[${lang}] ?user_id=${deepLinkUser} reaches the API as a query param`,
      await until(
        async () => listRequests.at(-1)?.searchParams.get('user_id') === String(deepLinkUser)
      ),
      listRequests.at(-1)?.search ?? '—'
    );
    record(
      `[${lang}] …and renders exactly the ${deepLinkExpected.meta.total} rows the server returns for it`,
      await until(
        async () => (await page.getByTestId('review-row').count()) === deepLinkExpected.meta.total
      ),
      `${await page.getByTestId('review-row').count()} vs ${deepLinkExpected.meta.total}`
    );
    body = await page.locator('body').innerText();
    record(
      `[${lang}] the active deep link is shown as a dismissible chip`,
      (await page.getByTestId('reviews-user-filter').count()) === 1 &&
        body.includes(L.filteredByUser(deepLinkUser))
    );
    await page.getByTestId('reviews-clear-user-filter').click();
    record(
      `[${lang}] clearing the chip drops user_id from both the URL and the request`,
      await until(
        async () =>
          !page.url().includes('user_id') &&
          listRequests.at(-1)?.searchParams.get('user_id') === null
      ),
      `${page.url()} | ${listRequests.at(-1)?.search}`
    );

    // ---- a bad deep-link id is handled, not crashed on ---------------------
    await page.goto(`${APP}/reviews?user_id=${NONEXISTENT_USER_ID}`, { waitUntil: 'networkidle' });
    record(
      `[${lang}] a nonexistent user_id surfaces the server's 422 in an ErrorBanner instead of a blank page`,
      await until(async () => {
        const text = await page.locator('body').innerText();
        return text.includes(L.title) && /invalid|غير صالح|صالح/i.test(text);
      }),
      (await page.locator('body').innerText()).slice(0, 200).replace(/\s+/g, ' ')
    );
    await page.goto(`${APP}/reviews?user_id=not-a-number`, { waitUntil: 'networkidle' });
    record(
      `[${lang}] a non-numeric user_id is never sent to the API at all`,
      await until(async () => (await page.getByTestId('review-row').count()) > 0) &&
        listRequests.at(-1)?.searchParams.get('user_id') === null,
      listRequests.at(-1)?.search ?? '—'
    );

    // ---- the delete confirmation ------------------------------------------
    await page.goto(`${APP}/reviews`, { waitUntil: 'networkidle' });
    await until(async () => (await page.getByTestId('review-row').count()) > 0);
    const victim = live.data[0];
    const deletesBefore = deletes.length;
    await page.getByTestId('review-delete').first().click();
    await until(async () => (await page.getByTestId('review-delete-summary').count()) === 1);
    record(
      `[${lang}] the delete dialog names BOTH the commenter and the recipient`,
      (await page.getByTestId('review-delete-commenter').innerText()).trim() ===
        victim.commenter.name &&
        (await page.getByTestId('review-delete-recipient').innerText()).trim() ===
          victim.recipient.name,
      `${await page.getByTestId('review-delete-commenter').innerText()} / ${await page
        .getByTestId('review-delete-recipient')
        .innerText()}`
    );
    record(
      `[${lang}] …shows the comment being removed, and says there is no undo`,
      (await page.getByTestId('review-delete-summary').innerText()).includes(
        victim.comment.slice(0, 30)
      ) && (await page.locator('body').innerText()).includes(L.deleteNoUndo)
    );
    record(
      `[${lang}] opening the dialog fires NO request — deletion needs explicit confirmation`,
      deletes.length === deletesBefore,
      `${deletes.length - deletesBefore} deletes`
    );
    await page.getByRole('button', { name: rx(L.cancel) }).first().click();
    await until(async () => (await page.getByTestId('review-delete-summary').count()) === 0);
    record(
      `[${lang}] cancelling leaves the row in place and still fires no request`,
      deletes.length === deletesBefore &&
        (await page.getByTestId('review-row').count()) === live.data.length
    );

    // ══ --mutate: one real deletion ═════════════════════════════════════════
    if (MUTATE && lang === 'en') {
      const doomed = (await get(token, '/staff/reviews?per_page=1&page=1')).body.data[0];
      const res = await del(token, `/staff/reviews/${doomed.id}`);
      const after = (await get(token, '/staff/reviews')).body;
      record(
        `[MUTATE] DELETE /staff/reviews/${doomed.id} succeeded`,
        res.status === 200 && res.body.status === 'success',
        `status ${res.status}`
      );
      record(
        `[MUTATE] …and the row is gone server-side (${all.meta.total} → ${after.meta.total})`,
        after.meta.total === all.meta.total - 1 && !after.data.some((r) => r.id === doomed.id),
        `${all.meta.total} → ${after.meta.total}`
      );
      // A deleted profile_comment cannot be restored through the API. Print the
      // full row and the exact INSERT, as verify-users.mjs does for the wallet charge.
      notes.push(
        `MUTATE residue — profile_comment ${doomed.id} was PERMANENTLY DELETED. There is no ` +
          `restore endpoint. Deleted row:\n` +
          `        id         : ${doomed.id}\n` +
          `        comment    : ${JSON.stringify(doomed.comment)}\n` +
          `        commenter  : ${doomed.commenter.name} (user ${doomed.commenter.id})\n` +
          `        recipient  : ${doomed.recipient.name} (user ${doomed.recipient.id})\n` +
          `        created_at : ${doomed.created_at}\n` +
          `      Put it back with:\n` +
          `        INSERT INTO profile_comments (id, profile_id, user_id, comment, created_at, updated_at)\n` +
          `        VALUES (${doomed.id}, ${doomed.recipient.id}, ${doomed.commenter.id}, ` +
          `${JSON.stringify(doomed.comment).replace(/"/g, "'")}, '${doomed.created_at}', '${doomed.created_at}');\n` +
          `      (profile_id = the RECIPIENT's profile; profiles.id == profiles.user_id in this seed.)`
      );
    }

    /**
     * The 422s are this script's own doing: it navigates to
     * `?user_id=${NONEXISTENT_USER_ID}` on purpose to prove the deep link
     * surfaces the server's rejection, and the browser logs every 4xx to the
     * console. Those are expected; anything else is not.
     */
    const realErrors = consoleErrors.filter((e) => !/422|Unprocessable/i.test(e));
    record(
      `[${lang}] no console errors beyond the deliberate invalid-user_id 422 probe`,
      realErrors.length === 0,
      realErrors.slice(0, 3).join(' | ')
    );

    await page.screenshot({ path: `reviews-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

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
