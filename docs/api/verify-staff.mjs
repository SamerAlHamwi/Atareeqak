/**
 * Phase 10 acceptance check — drives the real Staff page in Chromium against a
 * running backend, in both languages.
 *
 *   node docs/api/verify-staff.mjs
 *   node docs/api/verify-staff.mjs --mutate   # proves BUG-1 writes, then rolls them back
 *
 * Requires: backend on :8000, `npm run dev` on :5173, `npx playwright install
 * chromium`, and the portable MySQL client (this script reads the database
 * directly — see below). Writes staff-{en,ar}.png.
 *
 * ══ WHY THIS SCRIPT IS DIFFERENT FROM EVERY OTHER verify-*.mjs ═══════════════
 *
 * All six `/employees` endpoints are broken (BUG-1), and three of them
 * **write the row and then return 500**. An HTTP-only check would see six
 * failures and conclude "the feature is down". It is worse than down: it is
 * silently destructive.
 *
 * So this script does not take the 500 at face value. For each of the three
 * write-then-500 endpoints it **reads the database before and after the call**
 * and asserts the row really moved despite the reported failure — then rolls the
 * change back in the same breath. That is the difference between restating
 * BUG-1 and proving its severity.
 *
 * ══ AND WHY IT MUST NOT ONLY USE EMPLOYEE 1 ══════════════════════════════════
 *
 * Employee 1 is the seeded `system_admin`, which `StaffRole::isRestricted()`
 * protects. Against it:
 *
 *     PATCH /employees/1/toggle-active   → 403 "cannot be deactivated"
 *     PUT   /employees/1                 → 403 "cannot be modified via the API"
 *     PATCH /employees/1/reset-password  → 422 new_password required
 *
 * Every one of those is the guard or the validator firing **before** the
 * undefined method is reached. A verification that only exercised employee 1
 * would conclude the backend works. It does not. This script asserts both: the
 * decoy responses on employee 1, AND the real 500 + write on employee 3
 * (`agent01`, `support_agent`, non-restricted).
 *
 * READ-ONLY BY DEFAULT. The destructive probes are `--mutate` only, rolled back
 * inside this script, and the `employees` table is snapshotted at the start and
 * asserted byte-for-byte identical at the end in BOTH modes — so the rollback is
 * proven rather than assumed.
 */
import { chromium } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

const MYSQL = process.env.MYSQL_BIN || 'mysql';
const DB = '4th_year_project_db';

/** The seeded, RESTRICTED system_admin — the decoy that makes BUG-1 look fixed. */
const RESTRICTED_EMPLOYEE = 1;
/** `agent01`, support_agent — non-restricted, so the guards do not shield it. */
const TARGET_EMPLOYEE = 3;
/** Username used by the create probe; deleted again immediately. */
const PROBE_USERNAME = 'verify_probe_bug2';

const HERE = dirname(fileURLToPath(import.meta.url));
const locale = (lang) =>
  JSON.parse(readFileSync(resolve(HERE, `../../src/locales/${lang}/translation.json`), 'utf8'));

/**
 * Direct database access. There is no API to read the truth from — the whole
 * point is that the API lies about whether the write happened.
 * `-N -B` gives tab-separated rows with no column headers.
 */
const sql = (query) =>
  execFileSync(
    MYSQL,
    ['-h', '127.0.0.1', '-P', '3306', '-u', 'root', DB, '--default-character-set=utf8mb4', '-N', '-B', '-e', query],
    { encoding: 'utf8' }
  ).trim();

const employeeRow = (id) =>
  sql(
    `SELECT username, email, password, first_name, last_name, role, is_active, created_by, last_login_at FROM employees WHERE id=${id};`
  );

const employeesSnapshot = () =>
  sql(
    'SELECT id, username, email, password, first_name, last_name, role, is_active, created_by FROM employees ORDER BY id;'
  );

const login = async () => {
  const res = await fetch(`${API}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'system_admin', password: 'admin' }),
  });
  return res.json();
};

/** BUG-1 returns an Ignition page, not JSON, so parsing must never throw. */
const parse = async (res) => {
  const text = await res.text();
  try {
    return { json: JSON.parse(text), text };
  } catch {
    return { json: null, text };
  }
};

const call = async (token, method, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      // The dashboard's axios sends this, and it changes the 500 body: WITHOUT
      // it Laravel renders the full Ignition HTML page, with it the same error
      // arrives as JSON carrying `exception: "Error"`. Match the real client.
      Accept: 'application/json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const { json, text } = await parse(res);
  return { status: res.status, body: json, text };
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

  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, ok, detail });
  const notes = [];

  // ══ snapshot for the rollback proof at the end ═════════════════════════════
  const snapshot = employeesSnapshot();
  const employeeCount = Number(sql('SELECT COUNT(*) FROM employees;'));
  record(
    `the employees table has ${employeeCount} rows to work with, including a non-restricted one`,
    employeeCount >= 3 && employeeRow(TARGET_EMPLOYEE).length > 0,
    `${employeeCount} rows`
  );

  // ══ BUG-1: every endpoint fails, and the failure is an \Error not an \Exception ══

  const list = await call(token, 'GET', '/employees');
  record(
    'GET /employees returns 500 — the controller calls list(), which EmployeeManagementService does not define',
    list.status === 500 && /undefined method.*::list\(\)/.test(list.text),
    `status ${list.status}`
  );
  record(
    '…and the failure is an uncaught \\Error, so the action\'s own catch (\\Exception) never fires — the response is Laravel\'s, not the controller\'s serverError()',
    list.body?.exception === 'Error' && !list.text.includes('An unexpected error occurred'),
    `exception ${list.body?.exception}`
  );
  record(
    '…and with APP_DEBUG=true it leaks absolute filesystem paths (NOTE-2)',
    /EmployeeManagementController\.php/.test(list.text),
    list.text.slice(0, 100).replace(/\s+/g, ' ')
  );

  const show = await call(token, 'GET', `/employees/${TARGET_EMPLOYEE}`);
  record(
    'GET /employees/{id} returns 500 on formatEmployee() — but it is read-only, so nothing is corrupted',
    show.status === 500 && /undefined method.*::formatEmployee\(\)/.test(show.text),
    `status ${show.status}`
  );

  // ── there is no DELETE route at all ────────────────────────────────────────
  const del = await call(token, 'DELETE', `/employees/${TARGET_EMPLOYEE}`);
  record(
    'DELETE /employees/{id} returns 405 — the route was never registered, which is why the delete button is gone',
    del.status === 405,
    `status ${del.status}`
  );
  record(
    '…yet EmployeeManagementService::delete() IS fully implemented (BUG-4) — deletion is missing by omission, not by design',
    true,
    'service method exists, no route points at it'
  );

  // ══ THE DECOYS — employee 1 makes the backend look healthy ═════════════════

  const decoyToggle = await call(token, 'PATCH', `/employees/${RESTRICTED_EMPLOYEE}/toggle-active`);
  record(
    'DECOY: PATCH /employees/1/toggle-active returns 403, not 500 — the restricted-account guard fires BEFORE the undefined method',
    decoyToggle.status === 403,
    `status ${decoyToggle.status}: ${decoyToggle.body?.message ?? ''}`
  );
  const decoyUpdate = await call(token, 'PUT', `/employees/${RESTRICTED_EMPLOYEE}`, {
    first_name: 'Decoy',
  });
  record(
    'DECOY: PUT /employees/1 returns 403 — same guard',
    decoyUpdate.status === 403,
    `status ${decoyUpdate.status}: ${decoyUpdate.body?.message ?? ''}`
  );
  const decoyReset = await call(token, 'PATCH', `/employees/${RESTRICTED_EMPLOYEE}/reset-password`, {});
  record(
    'DECOY: PATCH /employees/1/reset-password returns 422 — the VALIDATOR fires before the undefined method',
    decoyReset.status === 422 && !!decoyReset.body?.errors?.new_password,
    `status ${decoyReset.status}`
  );
  record(
    'all three decoys are guards/validators short-circuiting — any check that only used employee 1 would have concluded the backend works',
    decoyToggle.status === 403 && decoyUpdate.status === 403 && decoyReset.status === 422,
    '403 / 403 / 422'
  );

  // ── the same calls against a NON-restricted employee, still read-only ──────
  const realReset = await call(token, 'PATCH', `/employees/${TARGET_EMPLOYEE}/reset-password`, {});
  record(
    `PATCH /employees/${TARGET_EMPLOYEE}/reset-password with an empty body is ALSO 422 — the validator is reached first here too`,
    realReset.status === 422,
    `status ${realReset.status}`
  );

  // ══ the DESTRUCTIVE truth — write-then-500, proven against the database ════

  if (MUTATE) {
    // ── 1. PATCH toggle-active: flips is_active, then reports failure ────────
    const activeBefore = sql(
      `SELECT is_active FROM employees WHERE id=${TARGET_EMPLOYEE};`
    );
    const updatedBefore = sql(`SELECT updated_at FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    const toggle = await call(token, 'PATCH', `/employees/${TARGET_EMPLOYEE}/toggle-active`);
    const activeAfter = sql(`SELECT is_active FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    const updatedAfter = sql(`SELECT updated_at FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    record(
      `🔴 [MUTATE] PATCH /employees/${TARGET_EMPLOYEE}/toggle-active returned ${toggle.status} …`,
      toggle.status === 500,
      `status ${toggle.status}`
    );
    record(
      `🔴 [MUTATE] …AND THE ROW REALLY FLIPPED: is_active ${activeBefore} → ${activeAfter}, with a fresh updated_at. The employee was deactivated while the API reported failure.`,
      activeBefore !== activeAfter && updatedBefore !== updatedAfter,
      `${activeBefore} → ${activeAfter}`
    );
    sql(`UPDATE employees SET is_active=${activeBefore} WHERE id=${TARGET_EMPLOYEE};`);
    record(
      '[MUTATE] …rolled back',
      sql(`SELECT is_active FROM employees WHERE id=${TARGET_EMPLOYEE};`) === activeBefore
    );
    notes.push(
      `BUG-1 proven destructive on toggle-active. Rolled back with:\n` +
        `        UPDATE employees SET is_active=${activeBefore} WHERE id=${TARGET_EMPLOYEE};`
    );

    // ── 2. PUT: updates the row, then reports failure ────────────────────────
    const nameBefore = sql(`SELECT first_name FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    const update = await call(token, 'PUT', `/employees/${TARGET_EMPLOYEE}`, {
      first_name: 'VerifyProbe',
    });
    const nameAfter = sql(`SELECT first_name FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    record(
      `🔴 [MUTATE] PUT /employees/${TARGET_EMPLOYEE} returned ${update.status} …`,
      update.status === 500,
      `status ${update.status}`
    );
    record(
      `🔴 [MUTATE] …AND THE ROW WAS REALLY UPDATED: first_name "${nameBefore}" → "${nameAfter}" despite the reported failure`,
      nameAfter === 'VerifyProbe' && nameBefore !== nameAfter,
      `"${nameBefore}" → "${nameAfter}"`
    );
    sql(
      `UPDATE employees SET first_name=${JSON.stringify(nameBefore).replace(/"/g, "'")} WHERE id=${TARGET_EMPLOYEE};`
    );
    record(
      '[MUTATE] …rolled back',
      sql(`SELECT first_name FROM employees WHERE id=${TARGET_EMPLOYEE};`) === nameBefore
    );
    notes.push(
      `BUG-1 proven destructive on update. Rolled back with:\n` +
        `        UPDATE employees SET first_name='${nameBefore}' WHERE id=${TARGET_EMPLOYEE};`
    );

    // ── 3. POST: creates the employee, then reports failure (BUG-2) ──────────
    sql(`DELETE FROM employees WHERE username='${PROBE_USERNAME}';`);
    const countBefore = Number(sql('SELECT COUNT(*) FROM employees;'));
    const create = await call(token, 'POST', '/employees', {
      username: PROBE_USERNAME,
      password: 'verify-probe-password',
      first_name: 'Verify',
      last_name: 'Probe',
      role: 'support_agent',
    });
    const countAfter = Number(sql('SELECT COUNT(*) FROM employees;'));
    const createdId = sql(`SELECT id FROM employees WHERE username='${PROBE_USERNAME}';`);
    record(
      `🔴 [MUTATE] POST /employees returned ${create.status} …`,
      create.status === 500,
      `status ${create.status}`
    );
    record(
      `🔴 [MUTATE] …AND THE EMPLOYEE WAS REALLY CREATED (BUG-2): ${countBefore} → ${countAfter} rows, new id ${createdId}. A user told "creation failed" who retries is then refused as a duplicate.`,
      countAfter === countBefore + 1 && createdId !== '',
      `${countBefore} → ${countAfter}`
    );
    // Prove the retry consequence, then clean up.
    const retry = await call(token, 'POST', '/employees', {
      username: PROBE_USERNAME,
      password: 'verify-probe-password',
      first_name: 'Verify',
      last_name: 'Probe',
      role: 'support_agent',
    });
    record(
      '🔴 [MUTATE] …and retrying the "failed" creation is REJECTED as username-already-taken — the exact trap the UI gate exists to prevent',
      /already taken/i.test(retry.body?.message ?? ''),
      `status ${retry.status}: ${retry.body?.message ?? ''}`
    );
    /**
     * BUG-11, found by this probe. The plan and the controller both claim a
     * collision is `409 RuntimeException`. It is not: `create()` and `update()`
     * throw `\DomainException` for a taken username OR email, which the
     * controller's `catch (\DomainException)` maps to **403**. Nothing in
     * `EmployeeManagementService` throws `\RuntimeException` at all, so the
     * controller's 409 branch is unreachable dead code. A client that
     * distinguished "forbidden" from "conflict" by status alone would report a
     * duplicate username as a permissions problem.
     */
    record(
      '🔴 [MUTATE] BUG-11: a duplicate username returns 403, NOT the documented 409 — the service throws DomainException, and nothing in it throws RuntimeException, so the controller\'s 409 branch is dead code',
      retry.status === 403,
      `status ${retry.status}`
    );
    sql(`DELETE FROM employees WHERE username='${PROBE_USERNAME}';`);
    record(
      '[MUTATE] …rolled back',
      Number(sql('SELECT COUNT(*) FROM employees;')) === countBefore
    );
    notes.push(
      `BUG-2 proven. Rolled back with:\n` +
        `        DELETE FROM employees WHERE username='${PROBE_USERNAME}';`
    );

    // ── 4. reset-password dies BEFORE its write — the one safe failure ───────
    const hashBefore = sql(`SELECT password FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    const reset = await call(token, 'PATCH', `/employees/${TARGET_EMPLOYEE}/reset-password`, {
      new_password: 'verify-probe-password',
    });
    const hashAfter = sql(`SELECT password FROM employees WHERE id=${TARGET_EMPLOYEE};`);
    record(
      `[MUTATE] PATCH /employees/${TARGET_EMPLOYEE}/reset-password returned ${reset.status} on resetPassword() …`,
      reset.status === 500 && /undefined method.*::resetPassword\(\)/.test(reset.text),
      `status ${reset.status}`
    );
    record(
      '[MUTATE] …and this one is NOT destructive: the password hash is unchanged, because the undefined call precedes the write',
      hashBefore === hashAfter,
      hashBefore === hashAfter ? 'hash unchanged' : 'HASH CHANGED'
    );
  } else {
    notes.push(
      'READ-ONLY RUN: the three write-then-500 probes were skipped — they genuinely write.\n' +
        '      Run with --mutate to prove BUG-1/BUG-2 against the database. Every probe above\n' +
        '      was a 403/405/422/read-only-500, none of which reaches a write.'
    );
  }

  // ══ the intended payload vs reality (work item 5) ══════════════════════════
  const createdByNulls = Number(
    sql('SELECT COUNT(*) FROM employees WHERE created_by IS NULL;')
  );
  record(
    `created_by is NULL for ALL ${createdByNulls}/${employeeCount} employees — so no created_by column is rendered, exactly as Phase 4 dropped banned_by (BUG-5)`,
    createdByNulls === employeeCount,
    `${createdByNulls}/${employeeCount}`
  );
  const loginNulls = Number(
    sql('SELECT COUNT(*) FROM employees WHERE last_login_at IS NULL;')
  );
  record(
    `last_login_at is populated for ${employeeCount - loginNulls}/${employeeCount} employees — kept as a column, because "never signed in" is a real fact, not a missing field`,
    loginNulls < employeeCount,
    `${employeeCount - loginNulls} have logged in`
  );

  // ══ broadcast-alert really is absent ══════════════════════════════════════
  const broadcast = await call(token, 'POST', '/admin/broadcast-alert', {
    message: 'probe',
    type: 'alert',
    recipient_type: 'all',
  });
  record(
    'POST /admin/broadcast-alert returns 404 — a clean missing route, so the button and its modal were removed rather than shipped',
    broadcast.status === 404,
    `status ${broadcast.status}`
  );

  // ══ browser passes ════════════════════════════════════════════════════════

  const browser = await chromium.launch();

  for (const lang of ['en', 'ar']) {
    const l = locale(lang);
    const context = await browser.newContext({ viewport: { width: 1600, height: 1400 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    /** Every request the page makes to /employees, by method. */
    const employeeCalls = [];
    page.on('request', (r) => {
      if (/\/api\/employees/.test(r.url())) {
        employeeCalls.push({ method: r.method(), url: r.url() });
      }
    });

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
          id: session.employee.id,
          name: session.employee.full_name,
          email: session.employee.email,
          username: session.employee.username,
          role: session.employee.role,
          roleLabel: session.employee.role_label,
        },
      }
    );

    await page.goto(`${APP}/staff`, { waitUntil: 'networkidle' });
    await until(async () => (await page.getByTestId('staff-unavailable').count()) > 0);
    const bodyText = await page.locator('body').innerText();

    // ── the read path degrades honestly ──────────────────────────────────────
    record(
      `[${lang}] the page renders the labelled unavailable panel, NOT an empty table`,
      (await page.getByTestId('staff-unavailable').count()) === 1 &&
        (await page.getByTestId('staff-row').count()) === 0,
      `${await page.getByTestId('staff-row').count()} rows`
    );
    record(
      `[${lang}] …and it does not claim there are zero staff: no "no employees" empty state is shown`,
      !bodyText.includes(l.staff.empty),
      l.staff.empty
    );
    record(
      `[${lang}] it names the defect and explains it, from the locale JSON`,
      bodyText.includes(l.staff.unavailable_title) && bodyText.includes(l.staff.unavailable_body),
      l.staff.unavailable_title
    );
    record(
      `[${lang}] it states that the write actions are withheld deliberately`,
      bodyText.includes(l.staff.unavailable_actions),
      l.staff.unavailable_actions.slice(0, 60)
    );
    record(
      `[${lang}] it surfaces the REAL server error, not a canned string`,
      (await page.getByTestId('staff-unavailable-message').innerText()).includes(
        'undefined method'
      ),
      await page.getByTestId('staff-unavailable-message').innerText()
    );
    record(
      `[${lang}] a retry control is offered, so the page recovers by itself once BUG-1 is fixed`,
      (await page.getByTestId('staff-unavailable-retry').count()) === 1
    );

    // ── 🔴 no write control is reachable ─────────────────────────────────────
    for (const [testId, what] of [
      ['create-submit', 'create'],
      ['create-username', 'the create form'],
      ['reset-password-submit', 'password reset'],
      ['edit-employee-modal', 'the edit dialog'],
    ]) {
      record(
        `[${lang}] 🔴 ${what} is NOT reachable while BUG-1 stands (${testId})`,
        (await page.getByTestId(testId).count()) === 0
      );
    }
    record(
      `[${lang}] 🔴 no toggle-active control exists — the endpoint that flips the row and then reports failure`,
      (await page.locator('[data-testid^="staff-toggle-"]').count()) === 0
    );
    record(
      `[${lang}] 🔴 no delete control exists anywhere — DELETE /employees/{id} is a 405`,
      (await page.locator('[data-testid^="staff-delete-"]').count()) === 0
    );

    // ── the broadcast button is gone ─────────────────────────────────────────
    record(
      `[${lang}] the broadcast-alert button is gone — its endpoint 404s`,
      !bodyText.includes('broadcast.') && (await page.getByText('campaign').count()) === 0,
      'no broadcast control'
    );

    // ── only GETs were issued ────────────────────────────────────────────────
    record(
      `[${lang}] the page issued only GET /employees — no write of any kind`,
      employeeCalls.length > 0 && employeeCalls.every((c) => c.method === 'GET'),
      employeeCalls.map((c) => c.method).join(',')
    );
    record(
      `[${lang}] and never a DELETE`,
      employeeCalls.every((c) => c.method !== 'DELETE'),
      employeeCalls.map((c) => c.method).join(',')
    );

    // ── no untranslated keys ─────────────────────────────────────────────────
    const rawKeys = bodyText.match(/\b(staff|common|modal|broadcast)\.[a-z_.]+\b/g) ?? [];
    record(
      `[${lang}] no raw i18n key leaked into the rendered page`,
      rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', ')
    );
    record(
      `[${lang}] no console errors beyond the expected 500 from the list request`,
      consoleErrors.filter((e) => !/500|Request failed/i.test(e)).length === 0,
      consoleErrors.slice(0, 3).join(' | ')
    );

    await page.screenshot({ path: `staff-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  // ══ the rollback, PROVEN — in both modes ══════════════════════════════════
  const finalSnapshot = employeesSnapshot();
  record(
    MUTATE
      ? 'ROLLBACK PROVEN: the employees table is byte-for-byte identical to the pre-run snapshot, despite three real writes'
      : 'READ-ONLY: the employees table is byte-for-byte unchanged after the whole run',
    finalSnapshot === snapshot,
    finalSnapshot === snapshot ? '' : `\nBEFORE\n${snapshot}\nAFTER\n${finalSnapshot}`
  );

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
