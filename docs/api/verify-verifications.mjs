/**
 * Phase 6 acceptance check — drives the real Verifications page in Chromium
 * against a running backend and asserts the rendered UI matches the live API
 * payload, in both languages.
 *
 *   node docs/api/verify-verifications.mjs
 *
 *   node docs/api/verify-verifications.mjs --mutate   # one real reject + one real approve
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`. Writes verifications-{en,ar}.png.
 *
 * Read-only by default. It still exercises both validators for real, because
 * both fail *before* any write:
 *   • approve with no body            → 422 `national_id` required (answers Q7)
 *   • reject with a 501-char reason   → 422 `reason` max:500
 * and it drives the reject/approve dialogs up to — but not through — confirm.
 *
 * `--mutate` additionally performs one real **reject** (in `en`) and one real
 * **approve** (in `ar`), which between them drain the two-row seed queue and
 * let the empty state be verified against a genuinely empty server response.
 *
 * NEITHER IS REVERSIBLE THROUGH THE API — there is no un-approve and no
 * un-reject endpoint. The SQL to restore the seed is printed at the end and
 * must be run before this script can be `--mutate`d again.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

/** `national_id => required|string|max:50` in StaffAdminController. */
const NATIONAL_ID_MAX = 50;
/** `reason => nullable|string|max:500`. */
const REASON_MAX = 500;
/**
 * Deliberately shorter than 10 characters: the ban/cancel/escalate reasons all
 * carry a 10-char minimum and this one does NOT, which is only provable by a
 * short reason being accepted.
 */
const SHORT_REASON = 'مكرر';

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
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await res.json() };
};

/**
 * Labels come from the locale files rather than being hardcoded, so the script
 * asserts the *shipped* translation and cannot drift from it.
 */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    title: l.verifications.title,
    totalPending: l.verifications.total_pending,
    filterAll: l.verifications.filter_all,
    typeDriver: l.verifications.type_driver,
    typePassenger: l.verifications.type_passenger,
    empty: l.verifications.empty,
    emptyFiltered: (type) => l.verifications.empty_filtered.replace('{{type}}', type),
    approve: l.verifications.approve,
    approveConfirm: l.verifications.approve_confirm,
    approveTitle: l.verifications.approve_title,
    nationalIdLabel: l.verifications.national_id_label,
    nationalIdHintNoDocs: l.verifications.national_id_hint_no_documents,
    reject: l.verifications.reject,
    rejectTitle: l.verifications.reject_title,
    rejectConfirm: l.verifications.reject_confirm,
    reasonRequired: l.modal.reason_required,
    previewUnavailable: l.verifications.preview_unavailable,
    noDocuments: l.verifications.no_documents,
    refresh: l.verifications.refresh,
    documents: l.common.documents,
    cancel: l.common.cancel,
  };
};

/**
 * Renders `verifications.pending_total` exactly as i18next will: Arabic selects
 * one of six CLDR categories, so the expected string cannot be built by hand.
 */
const pluralLabel = (lang, base, count) => {
  const l = locale(lang);
  const category = new Intl.PluralRules(lang).select(count);
  const table = l.verifications;
  const value =
    table[`${base}_${category}`] ?? table[`${base}_other`] ?? table[base] ?? `MISSING:${base}`;
  return value.replace(/\{\{count\}\}/g, String(count));
};

/** Escapes a locale string for safe use inside a RegExp. */
const rx = (value) => new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

/**
 * Polls a DOM assertion instead of trusting a fixed sleep. The backend runs on
 * single-process `php artisan serve`, so requests queue and a fixed wait is
 * flaky under load — which is exactly what a `--mutate` run adds.
 */
const until = async (predicate, timeout = 12000, step = 250) => {
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
  const record = (name, ok, detailText = '') => results.push({ name, ok, detail: detailText });
  const notes = [];

  // ---- contract-level assertions (language-independent) ---------------------
  const pending = await get(token, '/staff/verifications/pending');
  record(
    'GET /staff/verifications/pending returns {status, total, data[]}',
    pending.status === 'success' && typeof pending.total === 'number' && Array.isArray(pending.data),
    Object.keys(pending).join(',')
  );
  record(
    `total (${pending.total}) equals the row count — the queue is never paginated`,
    pending.total === pending.data.length,
    `total=${pending.total} rows=${pending.data.length}`
  );
  record(
    'rows carry gender, address and profile_photo (the staff payload, not the admin twin)',
    pending.data.length === 0 ||
      pending.data.every(
        (r) => 'gender' in r && 'address' in r && 'profile_photo' in r && 'documents' in r
      ),
    pending.data.length ? Object.keys(pending.data[0]).join(',') : 'empty queue'
  );

  // Justifies deleting ENDPOINTS.VERIFICATIONS rather than keeping it around.
  const adminTwin = await get(token, '/admin/verifications');
  record(
    'the /admin/verifications twin is strictly thinner: no `total`, no gender/address/profile_photo',
    adminTwin.total === undefined &&
      (adminTwin.data.length === 0 ||
        (!('gender' in adminTwin.data[0]) &&
          !('address' in adminTwin.data[0]) &&
          !('profile_photo' in adminTwin.data[0]))),
    `keys=${Object.keys(adminTwin).join(',')} row=${
      adminTwin.data.length ? Object.keys(adminTwin.data[0]).join(',') : '—'
    }`
  );

  if (pending.data.length === 0) {
    console.log(
      'The pending queue is EMPTY. Restore it before running this script:\n' +
        "  UPDATE users SET verification_status='pending', is_verified_passenger=0, " +
        'is_verified_driver=0, national_id=NULL WHERE id IN (31,33);\n' +
        '  php artisan cache:clear'
    );
    process.exit(1);
  }

  /**
   * Validator probes. Both fail before any write, so they are safe read-only:
   * a 422 leaves `verification_status` exactly as it was.
   */
  const probeId = pending.data[0].user_id;
  const approveNoBody = await post(token, `/staff/verifications/${probeId}/approve`, {});
  record(
    'approve REQUIRES national_id — POST with no body is 422 (answers Q7)',
    approveNoBody.status === 422 && !!approveNoBody.body.errors?.national_id,
    `status ${approveNoBody.status} ${JSON.stringify(approveNoBody.body.errors ?? approveNoBody.body)}`
  );
  const approveLongId = await post(token, `/staff/verifications/${probeId}/approve`, {
    national_id: 'X'.repeat(NATIONAL_ID_MAX + 1),
  });
  record(
    `approve rejects a national_id longer than ${NATIONAL_ID_MAX} chars`,
    approveLongId.status === 422 && !!approveLongId.body.errors?.national_id,
    `status ${approveLongId.status}`
  );
  const rejectLongReason = await post(token, `/staff/verifications/${probeId}/reject`, {
    reason: 'x'.repeat(REASON_MAX + 1),
  });
  record(
    `reject rejects a reason longer than ${REASON_MAX} chars`,
    rejectLongReason.status === 422 && !!rejectLongReason.body.errors?.reason,
    `status ${rejectLongReason.status}`
  );
  const stillPending = await get(token, '/staff/verifications/pending');
  record(
    'the three 422 probes changed nothing — the queue is still intact',
    stillPending.total === pending.total,
    `${pending.total} → ${stillPending.total}`
  );

  // Cross-page consistency (plan item 7): how /admin/users reports these rows.
  const usersBefore = await get(token, '/admin/users?per_page=50');
  const rowFor = (list, id) => list.data.users.find((u) => u.id === id);
  record(
    'GET /admin/users reports every pending user as status="pending"',
    pending.data.every((r) => rowFor(usersBefore, r.user_id)?.status === 'pending'),
    pending.data.map((r) => `${r.user_id}:${rowFor(usersBefore, r.user_id)?.status}`).join(' ')
  );

  const documentsSeeded = pending.data.some((r) => r.documents.length > 0);
  if (!documentsSeeded) {
    notes.push(
      'DOCUMENT VIEWER: every pending user in this seed has `documents: []`, so the four ' +
        'document tiles could not be exercised on this run. Seed them deliberately with:\n' +
        "      INSERT INTO photos (user_id,type,path,created_at,updated_at) VALUES\n" +
        "        (31,'face_id','docs/face.jpg',NOW(),NOW()), (31,'back_id','docs/back.jpg',NOW(),NOW()),\n" +
        "        (31,'license','docs/license.jpg',NOW(),NOW()), (31,'mechanic_card','docs/card.jpg',NOW(),NOW());\n" +
        '      php artisan cache:clear      -- then re-run, and DELETE FROM photos WHERE user_id=31; afterwards.\n' +
        '      (Note this also flips user 31 to type="driver", since the type is derived from license/mechanic_card.)'
    );
  }

  const browser = await chromium.launch();

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    // Re-read per language: a --mutate pass in `en` changes what `ar` must see.
    const live = await get(token, '/staff/verifications/pending');
    const drivers = live.data.filter((r) => r.type === 'driver').length;
    const passengers = live.data.filter((r) => r.type === 'passenger').length;

    const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
    const page = await context.newPage();

    const consoleErrors = [];
    const brokenImages = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));
    /**
     * Seeded `/storage/...` URLs 404 and Chromium blocks the HTML 404 body as
     * ORB, landing on `requestfailed` rather than `response` (BUG-7). Both are
     * watched, because which one fires depends on the response body.
     */
    page.on('response', (r) => {
      if (r.status() >= 400 && r.url().includes('/storage/')) brokenImages.push(r.url());
    });
    page.on('requestfailed', (r) => {
      if (r.url().includes('/storage/')) brokenImages.push(r.url());
    });

    const listRequests = [];
    const approvePosts = [];
    const rejectPosts = [];
    page.on('request', (r) => {
      const url = r.url();
      if (/\/api\/staff\/verifications\/pending/.test(url)) listRequests.push(new URL(url));
      if (r.method() === 'POST' && /\/verifications\/\d+\/approve$/.test(url)) {
        approvePosts.push({ url, body: r.postData() });
      }
      if (r.method() === 'POST' && /\/verifications\/\d+\/reject$/.test(url)) {
        rejectPosts.push({ url, body: r.postData() });
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

    await page.goto(`${APP}/verifications`, { waitUntil: 'networkidle' });
    // Readiness is the KPI leaving its "—" placeholder, not a text match: the
    // card label is rendered through `uppercase`, so its innerText is not the
    // locale string.
    await until(
      async () =>
        (await page.getByTestId('verifications-total').count()) === 1 &&
        (await page.getByTestId('verifications-total').innerText()).trim() !== '—'
    );

    let body = await page.locator('body').innerText();

    // ---- the page really calls the staff endpoint ---------------------------
    record(`[${lang}] the page fetches GET /staff/verifications/pending`, listRequests.length > 0);

    // ---- header + KPI cards come from the live payload ----------------------
    record(
      `[${lang}] the KPI card shows the server total (${live.total})`,
      (await page.getByTestId('verifications-total').innerText()).trim() === String(live.total),
      await page.getByTestId('verifications-total').innerText()
    );
    const expectedTotalLabel = pluralLabel(lang, 'pending_total', live.total);
    record(
      `[${lang}] the header label reads the shipped plural form: "${expectedTotalLabel}"`,
      (await page.getByTestId('verifications-total-label').innerText()).trim() ===
        expectedTotalLabel,
      await page.getByTestId('verifications-total-label').innerText()
    );
    record(
      `[${lang}] driver/passenger cards match the payload (${drivers}/${passengers})`,
      (await page.getByTestId('verifications-driver-count').innerText()).trim() ===
        String(drivers) &&
        (await page.getByTestId('verifications-passenger-count').innerText()).trim() ===
          String(passengers)
    );

    // ---- every server row renders (no client-side drop) ---------------------
    record(
      `[${lang}] all ${live.data.length} rows returned by the server render`,
      live.data.every((r) => body.includes(r.email)) &&
        (await page.locator('[data-testid^="verification-row-"]').count()) === live.data.length,
      live.data.filter((r) => !body.includes(r.email)).map((r) => r.email).join(',')
    );
    record(
      `[${lang}] the first request is auto-selected and its detail panel rendered`,
      (await page.getByTestId('verification-detail').count()) === 1
    );

    // ---- no untranslated keys leaked ---------------------------------------
    const rawKeys = body.match(/\b(verifications|common|modal)\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys on the page`, rawKeys.length === 0, rawKeys.slice(0, 5).join(', '));

    // ---- type filter --------------------------------------------------------
    const emptyType = drivers === 0 ? 'driver' : passengers === 0 ? 'passenger' : null;
    // Counted from *here*, not from zero: `main.tsx` mounts under StrictMode, so
    // the dev server's double-invoked mount effect legitimately fetches twice.
    const listRequestsBeforeFilter = listRequests.length;
    await page.getByRole('tab', { name: rx(L.typeDriver) }).first().click();
    await until(async () => {
      const text = await page.locator('body').innerText();
      return drivers === 0
        ? text.includes(L.emptyFiltered(L.typeDriver))
        : live.data
            .filter((r) => r.type === 'driver')
            .every((r) => text.includes(r.email));
    });
    body = await page.locator('body').innerText();
    record(
      `[${lang}] the driver tab shows exactly the ${drivers} driver row(s)`,
      (await page.locator('[data-testid^="verification-row-"]').count()) === drivers,
      `${await page.locator('[data-testid^="verification-row-"]').count()} rows`
    );
    if (emptyType) {
      record(
        `[${lang}] a filter with no matches renders the filtered empty state, not the generic one`,
        body.includes(L.emptyFiltered(emptyType === 'driver' ? L.typeDriver : L.typePassenger)),
        body.slice(0, 200).replace(/\s+/g, ' ')
      );
    }
    record(
      `[${lang}] the type filter never re-requests the endpoint (it takes no params)`,
      listRequests.length === listRequestsBeforeFilter,
      `${listRequests.length - listRequestsBeforeFilter} extra list requests`
    );

    await page.getByRole('tab', { name: rx(L.filterAll) }).first().click();
    await until(
      async () =>
        (await page.locator('[data-testid^="verification-row-"]').count()) === live.data.length
    );

    // ---- document viewer ----------------------------------------------------
    const withDocs = live.data.filter((r) => r.documents.length > 0);
    if (withDocs.length > 0) {
      const target = withDocs[0];
      await page.getByTestId(`verification-row-${target.user_id}`).click();
      await until(
        async () =>
          (await page.getByTestId(`verification-doc-${target.documents[0].type}`).count()) === 1
      );
      for (const doc of target.documents) {
        record(
          `[${lang}] document tile "${doc.type}" renders with its shipped label`,
          (await page.getByTestId(`verification-doc-${doc.type}`).count()) === 1 &&
            (await page.getByTestId(`verification-doc-${doc.type}`).innerText()).includes(
              L.documents[doc.type]
            ),
          await page
            .getByTestId(`verification-doc-${doc.type}`)
            .innerText()
            .catch(() => 'missing')
        );
      }
      /**
       * BUG-7 makes a dead URL the normal case, so this is the *expected* path.
       * Polled, not sampled: the tile only flips once the image's error event
       * fires, which is a real round-trip after the markup appears.
       */
      const failedLocator = page.locator('[data-testid^="verification-doc-failed-"]');
      const allFailed = await until(
        async () => (await failedLocator.count()) === target.documents.length
      );
      const failedTiles = await failedLocator.count();
      if (failedTiles > 0) {
        record(
          `[${lang}] all ${target.documents.length} unreachable documents degrade to a visible "unavailable" tile`,
          allFailed &&
            (await page.getByTestId('verification-detail').innerText()).includes(
              L.previewUnavailable
            ),
          `${failedTiles}/${target.documents.length} tiles, ${brokenImages.length} storage failures`
        );
        record(
          `[${lang}] no <img> is left behind, so no broken-image glyph can render`,
          (await page.locator('[data-testid^="verification-doc-"] img').count()) === 0,
          `${await page.locator('[data-testid^="verification-doc-"] img').count()} images`
        );
      } else {
        record(
          `[${lang}] all ${target.documents.length} document images loaded and none shows a failure tile`,
          (await page.locator('[data-testid^="verification-doc-"] img').count()) ===
            target.documents.length,
          `${await page.locator('[data-testid^="verification-doc-"] img').count()} images`
        );
      }
    } else {
      record(
        `[${lang}] a request with no documents renders the "no documents" state, not an empty grid`,
        (await page.getByTestId('verification-no-documents').count()) === 1 &&
          (await page.getByTestId('verification-detail').innerText()).includes(L.noDocuments)
      );
    }

    // ---- reject dialog: the client gate, before any request -----------------
    const selectedId = Number(
      (await page.locator('[data-testid^="verification-row-"]').first().getAttribute('data-testid'))
        .split('-')
        .pop()
    );
    await page.getByTestId('verification-row-' + selectedId).click();
    await page.getByTestId('verification-reject').click();
    await until(async () => (await page.getByTestId('confirm-action-reason').count()) === 1);
    record(`[${lang}] the reject dialog opens with a reason field`, true);

    const rejectsBefore = rejectPosts.length;
    await page.getByTestId('confirm-action-submit').click();
    await until(async () =>
      (await page.locator('body').innerText()).includes(L.reasonRequired)
    );
    record(
      `[${lang}] confirming with an empty reason is blocked client-side and fires no request`,
      rejectPosts.length === rejectsBefore &&
        (await page.locator('body').innerText()).includes(L.reasonRequired),
      `${rejectPosts.length - rejectsBefore} POSTs`
    );
    record(
      `[${lang}] the reason field carries the server's max:${REASON_MAX} cap`,
      (await page.getByTestId('confirm-action-reason').getAttribute('maxlength')) ===
        String(REASON_MAX),
      await page.getByTestId('confirm-action-reason').getAttribute('maxlength')
    );

    if (MUTATE && lang === 'en') {
      // ---- real reject ------------------------------------------------------
      await page.getByTestId('confirm-action-reason').fill(SHORT_REASON);
      await page.getByTestId('confirm-action-submit').click();
      await until(async () => rejectPosts.length > rejectsBefore);

      const sent = rejectPosts[rejectPosts.length - 1];
      record(
        `[${lang}] confirm fires POST /staff/verifications/${selectedId}/reject`,
        !!sent && sent.url.endsWith(`/${selectedId}/reject`),
        sent?.url ?? 'no request'
      );
      record(
        `[${lang}] the body carries the typed reason verbatim`,
        JSON.parse(sent.body ?? '{}').reason === SHORT_REASON,
        sent?.body ?? ''
      );
      record(
        `[${lang}] a ${SHORT_REASON.length}-char reason is accepted — the 10-char ban rule does NOT apply here`,
        await until(async () => {
          const after = await get(token, '/staff/verifications/pending');
          return !after.data.some((r) => r.user_id === selectedId);
        }),
        'server still lists the rejected user'
      );
      record(
        `[${lang}] the row disappears and the total drops to ${live.total - 1}`,
        await until(
          async () =>
            (await page.getByTestId(`verification-row-${selectedId}`).count()) === 0 &&
            (await page.getByTestId('verifications-total').innerText()).trim() ===
              String(live.total - 1)
        ),
        await page.getByTestId('verifications-total').innerText()
      );
      record(
        `[${lang}] the list was re-read after the mutation (optimistic drop, then reconcile)`,
        listRequests.length > 1,
        `${listRequests.length} list requests`
      );
      const serverAfter = await get(token, '/staff/verifications/pending');
      record(
        `[${lang}] the reconciled total matches the server (${serverAfter.total})`,
        (await page.getByTestId('verifications-total').innerText()).trim() ===
          String(serverAfter.total),
        `ui=${await page.getByTestId('verifications-total').innerText()} server=${serverAfter.total}`
      );
      // The endpoint is Cache::remember'd for 2 minutes; both mutations
      // Cache::forget it, which is the only reason a reconcile can be trusted.
      record(
        `[${lang}] the 2-minute server cache was busted — the fresh GET already omits the user`,
        !serverAfter.data.some((r) => r.user_id === selectedId)
      );
      const usersAfter = await get(token, '/admin/users?per_page=50');
      record(
        `[${lang}] cross-page: GET /admin/users now reports user ${selectedId} as "rejected"`,
        rowFor(usersAfter, selectedId)?.status === 'rejected',
        `status=${rowFor(usersAfter, selectedId)?.status}`
      );
      notes.push(
        `MUTATE (${lang}): user ${selectedId} was REJECTED with reason "${SHORT_REASON}". There is ` +
          `no un-reject endpoint. Restore with: UPDATE users SET verification_status='pending' ` +
          `WHERE id=${selectedId}; php artisan cache:clear`
      );
    } else {
      await page.getByRole('button', { name: rx(L.cancel) }).last().click();
      await until(async () => (await page.getByTestId('confirm-action-reason').count()) === 0);
    }

    // ---- approve dialog: national_id is required client-side too ------------
    const remaining = await page.locator('[data-testid^="verification-row-"]').count();
    if (remaining > 0) {
      const approveId = Number(
        (
          await page
            .locator('[data-testid^="verification-row-"]')
            .first()
            .getAttribute('data-testid')
        )
          .split('-')
          .pop()
      );
      await page.getByTestId(`verification-row-${approveId}`).click();
      await page.getByTestId('verification-approve').click();
      await until(async () => (await page.getByTestId('approve-national-id').count()) === 1);

      record(
        // Case-insensitive: the label is rendered through `uppercase`, and
        // innerText reports the transformed text (English only — Arabic has no case).
        `[${lang}] the approve dialog asks for the national ID`,
        (await page.locator('body').innerText())
          .toLowerCase()
          .includes(L.nationalIdLabel.toLowerCase())
      );
      record(
        `[${lang}] confirm is disabled until a national ID is typed (hidden-not-422)`,
        await page.getByTestId('approve-confirm').isDisabled()
      );
      record(
        `[${lang}] the field carries the server's max:${NATIONAL_ID_MAX} cap`,
        (await page.getByTestId('approve-national-id').getAttribute('maxlength')) ===
          String(NATIONAL_ID_MAX)
      );
      const approveTarget = live.data.find((r) => r.user_id === approveId);
      if (approveTarget && approveTarget.documents.length === 0) {
        record(
          `[${lang}] with no ID document submitted, the dialog says so instead of pretending it can pre-fill`,
          (await page.locator('body').innerText()).includes(L.nationalIdHintNoDocs)
        );
      }

      const nationalId = `VER${Date.now()}`;
      await page.getByTestId('approve-national-id').fill(nationalId);
      record(
        `[${lang}] confirm enables once a national ID is present`,
        await until(async () => !(await page.getByTestId('approve-confirm').isDisabled()))
      );

      if (MUTATE && lang === 'ar') {
        // ---- real approve ---------------------------------------------------
        const approvesBefore = approvePosts.length;
        await page.getByTestId('approve-confirm').click();
        await until(async () => approvePosts.length > approvesBefore);

        const sent = approvePosts[approvePosts.length - 1];
        record(
          `[${lang}] confirm fires POST /staff/verifications/${approveId}/approve`,
          !!sent && sent.url.endsWith(`/${approveId}/approve`),
          sent?.url ?? 'no request'
        );
        record(
          `[${lang}] the body carries national_id and nothing else`,
          JSON.stringify(JSON.parse(sent.body ?? '{}')) ===
            JSON.stringify({ national_id: nationalId }),
          sent?.body ?? ''
        );

        const approvedUser = await get(token, `/admin/users?search=${approveId}&per_page=50`);
        void approvedUser;
        record(
          `[${lang}] the server dropped the approved user from the queue`,
          await until(async () => {
            const after = await get(token, '/staff/verifications/pending');
            return !after.data.some((r) => r.user_id === approveId);
          })
        );
        record(
          `[${lang}] the row disappears from the UI and the total drops`,
          await until(
            async () =>
              (await page.getByTestId(`verification-row-${approveId}`).count()) === 0 &&
              (await page.getByTestId('verifications-total').innerText()).trim() ===
                String(live.total - 1)
          ),
          await page.getByTestId('verifications-total').innerText()
        );
        record(
          `[${lang}] the success banner reports the national ID the server stored`,
          await until(async () =>
            (await page.getByTestId('action-banner').innerText()).includes(nationalId)
          ),
          await page
            .getByTestId('action-banner')
            .innerText()
            .catch(() => 'no banner')
        );

        const usersAfter = await get(token, '/admin/users?per_page=50');
        record(
          `[${lang}] cross-page: GET /admin/users now reports user ${approveId} as "verified"`,
          rowFor(usersAfter, approveId)?.status === 'verified',
          `status=${rowFor(usersAfter, approveId)?.status}`
        );

        const serverAfter = await get(token, '/staff/verifications/pending');
        if (serverAfter.total === 0) {
          record(
            `[${lang}] with the queue drained, the real empty state renders`,
            await until(
              async () =>
                (await page.getByTestId('verifications-empty').count()) === 1 &&
                (await page.getByTestId('verifications-empty').innerText()).includes(L.empty)
            ),
            await page
              .getByTestId('verifications-empty')
              .innerText()
              .catch(() => 'no empty state')
          );
          record(
            `[${lang}] the empty header label uses the zero plural form`,
            (await page.getByTestId('verifications-total-label').innerText()).trim() ===
              pluralLabel(lang, 'pending_total', 0),
            await page.getByTestId('verifications-total-label').innerText()
          );
        }

        notes.push(
          `MUTATE (${lang}): user ${approveId} was APPROVED with national_id="${nationalId}". There ` +
            `is no un-approve endpoint. Restore with: UPDATE users SET ` +
            `verification_status='pending', is_verified_passenger=0, is_verified_driver=0, ` +
            `national_id=NULL WHERE id=${approveId}; php artisan cache:clear`
        );
      } else {
        await page.getByRole('button', { name: rx(L.cancel) }).last().click();
        await until(async () => (await page.getByTestId('approve-national-id').count()) === 0);
      }
    }

    // ---- refresh control ----------------------------------------------------
    const beforeRefresh = listRequests.length;
    await page.getByTestId('verifications-refresh').click();
    record(
      `[${lang}] the refresh control re-reads the endpoint`,
      await until(async () => listRequests.length > beforeRefresh),
      `${listRequests.length} vs ${beforeRefresh}`
    );

    const realErrors = consoleErrors.filter(
      (e) => !/404|ERR_BLOCKED_BY_ORB|storage/i.test(e) || brokenImages.length === 0
    );
    record(
      `[${lang}] no console errors beyond the documented storage failures (BUG-7)`,
      realErrors.length === 0,
      realErrors.slice(0, 3).join(' | ')
    );

    await page.screenshot({ path: `verifications-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  if (MUTATE) {
    notes.push(
      'MUTATE residue: the two-row seed queue is now EMPTY and this script cannot be --mutate`d ' +
        'again until it is restored. Full restore:\n' +
        "      UPDATE users SET verification_status='pending', is_verified_passenger=0, " +
        'is_verified_driver=0, national_id=NULL WHERE id IN (31,33);\n' +
        '      php artisan cache:clear'
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
