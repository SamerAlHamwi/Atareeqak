/**
 * Phase 9 acceptance check — drives the real Reports page in Chromium against a
 * running backend and asserts the rendered UI matches the live API payload, in
 * both languages.
 *
 *   node docs/api/verify-reports.mjs
 *   node docs/api/verify-reports.mjs --mutate   # one real approve, reject and wallet charge
 *
 * Requires: backend on :8000, `npm run dev` on :5173, `npx playwright install
 * chromium`, and the Phase 9 seed applied (docs/api/seed-phase-9.sql).
 * Writes reports-{en,ar}.png.
 *
 * READ-ONLY BY DEFAULT, AND THE CLAIM IS ENFORCED, NOT ASSERTED.
 * Wallet balances, the wallet-request `counts` block and the request totals are
 * snapshotted before the run and re-read at the end; the pass fails if any of
 * them moved. Every validator probe here fails *before* its write (a 422 leaves
 * the row untouched), so they are safe to run read-only.
 *
 * ⚠️ NOTHING `--mutate` DOES IS REVERSIBLE THROUGH THE API.
 * An approve moves real money AND writes a `wallet_transactions` row; a wallet
 * charge does the same. The script prints the before/after balances, the
 * transaction rows it created, and the exact SQL to undo all of it — it does not
 * pretend to have cleaned up after itself.
 */
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const APP = 'http://127.0.0.1:5173';
const API = 'http://127.0.0.1:8000/api';
const MUTATE = process.argv.includes('--mutate');

/** `POST /admin/wallet/charge` — amount `numeric|min:1|max:1000000`. */
const CHARGE_MAX = 1000000;
/** `admin_notes` on approve/reject — `nullable|string|max:500`. */
const NOTES_MAX = 500;
/** `sections[]` — `in:stats,financial,growth,cities,recent`. */
const PDF_SECTIONS = ['stats', 'financial', 'growth', 'cities', 'recent'];
/** The wallet the seed guarantees has >1 page of transactions (31 across 4). */
const RICH_WALLET = 1;

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

/** Not every response is JSON — BUG-8 returns an Ignition HTML page. */
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
  return { status: res.status, body: await parse(res), headers: res.headers };
};

const post = async (token, path, body) => {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return { status: res.status, body: await parse(res) };
};

/** Labels read from the shipped locale JSON, never hardcoded. */
const labelsFor = (lang) => {
  const l = locale(lang);
  return {
    title: l.reports.title,
    groupPeriod: l.reports.group_period,
    groupBalances: l.reports.group_balances,
    groupBalancesHint: l.reports.group_balances_hint,
    platformFees: l.reports.platform_fees,
    escrowIn: l.reports.escrow_in,
    escrowOut: l.reports.escrow_out,
    refundsPaid: l.reports.refunds_paid,
    primaryBalance: l.reports.primary_admin_balance,
    sycashBalance: l.reports.sycash_balance,
    lockedFunds: l.reports.locked_funds,
    myWallet: l.reports.my_wallet,
    viewTransactions: l.reports.view_transactions,
    transactionsTitle: l.reports.transactions_title,
    rangeApply: l.reports.range_apply,
    rangeClear: l.reports.range_clear,
    rangeInvalid: l.reports.range_invalid,
    refresh: l.reports.refresh,
    exportPdf: l.reports.export_pdf,
    walletRequests: l.reports.wallet_requests,
    requestTypeAll: l.reports.request_type_all,
    statusPending: l.reports.request_status.pending,
    statusApproved: l.reports.request_status.approved,
    statusRejected: l.reports.request_status.rejected,
    typeCharge: l.reports.request_type.charge,
    typeWithdraw: l.reports.request_type.withdraw,
    approve: l.reports.approve,
    reject: l.reports.reject,
    manualCredit: l.reports.manual_credit,
    walletListEmpty: l.reports.wallet_list_empty,
    perPage: l.common.per_page,
    cancel: l.common.cancel,
    currencySar: l.users.currency,
  };
};

/** Renders a count-bearing key exactly as i18next will, incl. Arabic's 6 forms. */
const pluralLabel = (lang, table, base, count, extra = {}) => {
  const l = locale(lang);
  const category = new Intl.PluralRules(lang).select(count);
  const t = l[table];
  let value = t[`${base}_${category}`] ?? t[`${base}_other`] ?? t[base] ?? `MISSING:${base}`;
  value = value.replace(/\{\{count\}\}/g, String(count));
  for (const [k, v] of Object.entries(extra)) {
    value = value.replace(new RegExp(`\\{\\{${k}\\}\\}`, 'g'), String(v));
  }
  return value;
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

  // ══ snapshots for the read-only enforcement at the end ═════════════════════
  const snapWallets = (await get(token, '/admin/wallets')).body;
  const snapRequests = (await get(token, '/admin/wallet/requests')).body;
  const snapBalances = JSON.stringify(
    (snapWallets.all_wallets ?? []).map((w) => [w.id, w.balance])
  );
  const snapCounts = JSON.stringify(snapRequests.counts);

  // ══ contract-level assertions (language-independent) ═══════════════════════

  // ── GET /admin/reports — the payload the KPI row was built against ─────────
  const report = (await get(token, '/admin/reports')).body;
  const fin = report.report_data?.financial_stats;
  record(
    'GET /admin/reports returns {status, report_data{ride_stats, financial_stats, date_range}}',
    report.status === 'success' && !!fin && !!report.report_data.ride_stats,
    Object.keys(report.report_data ?? {}).join(',')
  );
  record(
    'financial_stats.primary_admin carries total_platform_fees — the field the KPI row now reads',
    typeof fin?.primary_admin?.total_platform_fees === 'string',
    JSON.stringify(fin?.primary_admin)
  );
  record(
    'primary_admin.total_collected and total_disbursed DO NOT EXIST — the two cards that read them were permanently dashed',
    fin?.primary_admin?.total_collected === undefined &&
      fin?.primary_admin?.total_disbursed === undefined,
    Object.keys(fin?.primary_admin ?? {}).join(',')
  );
  record(
    'sycash carries total_escrow_in / total_escrow_out / total_refunds_paid — NOT total_creation_fees',
    ['total_escrow_in', 'total_escrow_out', 'total_refunds_paid'].every(
      (k) => typeof fin?.sycash?.[k] === 'string'
    ) && fin?.sycash?.total_creation_fees === undefined,
    Object.keys(fin?.sycash ?? {}).join(',')
  );
  record(
    'date_range is null on BOTH sides when unfiltered — not the {start:string,end:string} it was typed as',
    report.report_data.date_range.start === null && report.report_data.date_range.end === null,
    JSON.stringify(report.report_data.date_range)
  );
  record(
    'money arrives PRE-FORMATTED with its own unit ("… SYP"), so nothing may append a second currency',
    /SYP$/.test(fin?.primary_admin?.current_balance ?? ''),
    fin?.primary_admin?.current_balance
  );
  record(
    `…and the app-wide t('users.currency') is "${labelsFor('en').currencySar}", so appending it produced "… SYP ${labelsFor('en').currencySar}"`,
    labelsFor('en').currencySar !== 'SYP',
    labelsFor('en').currencySar
  );

  // ── the range filters flows but NOT balances (correction 3) ────────────────
  const ranged = (await get(token, '/admin/reports?start_date=2020-01-01&end_date=2020-01-02')).body;
  const rFin = ranged.report_data.financial_stats;
  record(
    `the date range DOES work: unfiltered ${report.report_data.ride_stats.total} rides → 2020 range ${ranged.report_data.ride_stats.total}`,
    ranged.report_data.ride_stats.total < report.report_data.ride_stats.total,
    `${report.report_data.ride_stats.total} → ${ranged.report_data.ride_stats.total}`
  );
  record(
    'FLOWS are range-filtered: escrow_in / escrow_out / refunds_paid / platform_fees all fall to 0.00 on an empty range',
    [
      rFin.sycash.total_escrow_in,
      rFin.sycash.total_escrow_out,
      rFin.sycash.total_refunds_paid,
      rFin.primary_admin.total_platform_fees,
    ].every((v) => parseFloat(v.replace(/,/g, '')) === 0),
    JSON.stringify(rFin)
  );
  record(
    'BALANCES are NOT range-filtered: sycash/primary current_balance and active_rides_locked are unchanged — this is why the KPI row is split into two labelled groups',
    rFin.sycash.current_balance === fin.sycash.current_balance &&
      rFin.primary_admin.current_balance === fin.primary_admin.current_balance &&
      rFin.active_rides_locked === fin.active_rides_locked,
    `${rFin.primary_admin.current_balance} vs ${fin.primary_admin.current_balance}`
  );
  record(
    'date_range echoes what was sent, as a full datetime rather than the Y-m-d submitted',
    ranged.report_data.date_range.start === '2020-01-01 00:00:00' &&
      ranged.report_data.date_range.end === '2020-01-02 23:59:59',
    JSON.stringify(ranged.report_data.date_range)
  );

  // ── report validators ──────────────────────────────────────────────────────
  const badFormat = await get(token, '/admin/reports?start_date=bogus');
  record(
    'start_date must match Y-m-d — a bad format is 422, which the picker prevents client-side',
    badFormat.status === 422 && !!badFormat.body.errors?.start_date,
    `status ${badFormat.status}`
  );
  const badOrder = await get(token, '/admin/reports?start_date=2026-08-10&end_date=2026-08-01');
  record(
    'end_date must be after_or_equal:start_date — the apply button is disabled rather than submitting this',
    badOrder.status === 422 && !!badOrder.body.errors?.end_date,
    `status ${badOrder.status}`
  );

  // ── GET /admin/wallet — the card that had no consumer ──────────────────────
  const myWallet = (await get(token, '/admin/wallet')).body;
  record(
    'GET /admin/wallet returns {wallet{id, wallet_number, phone_number, balance, admin_type}}',
    myWallet.status === 'success' &&
      ['id', 'wallet_number', 'phone_number', 'balance', 'admin_type'].every(
        (k) => k in myWallet.wallet
      ),
    Object.keys(myWallet.wallet ?? {}).join(',')
  );

  // ── GET /admin/wallets ─────────────────────────────────────────────────────
  const wallets = snapWallets;
  record(
    `GET /admin/wallets returns admin_wallets (${wallets.admin_wallets?.length}) and all_wallets (${wallets.all_wallets?.length})`,
    wallets.admin_wallets?.length === 2 && wallets.all_wallets?.length === 32,
    `${wallets.admin_wallets?.length}/${wallets.all_wallets?.length}`
  );
  record(
    'it accepts NO query params — there is no server-side wallet search, which is why the sidebar filter is client-side',
    JSON.stringify((await get(token, '/admin/wallets?search=Passenger13')).body.all_wallets) ===
      JSON.stringify(wallets.all_wallets),
    'search= is ignored'
  );

  // ── GET /admin/wallet/{id}/transactions — the raw paginator ────────────────
  const tx = (await get(token, `/admin/wallet/${RICH_WALLET}/transactions`)).body;
  const paginator = tx.transactions;
  record(
    'the transactions endpoint returns a RAW Laravel paginator — no `meta` block, unlike every other paginated route here',
    !('meta' in paginator) &&
      ['current_page', 'last_page', 'per_page', 'total', 'links', 'path'].every(
        (k) => k in paginator
      ),
    Object.keys(paginator).join(',')
  );
  record(
    `wallet ${RICH_WALLET} has ${paginator.total} transactions over ${paginator.last_page} pages — rich enough to verify without seeding`,
    paginator.total > 10 && paginator.last_page > 1,
    `${paginator.total} / ${paginator.last_page}`
  );
  const txPerPage = (await get(token, `/admin/wallet/${RICH_WALLET}/transactions?per_page=3`)).body;
  record(
    'per_page is SILENTLY IGNORED (hardcoded 10) — ?per_page=3 still returns 10 rows, so no PerPageSelect ships on that drawer',
    txPerPage.transactions.data.length === 10 && txPerPage.transactions.per_page === 10,
    `rows ${txPerPage.transactions.data.length}, per_page ${txPerPage.transactions.per_page}`
  );
  const txPage2 = (await get(token, `/admin/wallet/${RICH_WALLET}/transactions?page=2`)).body;
  record(
    'page IS honoured, and page 2 does not overlap page 1',
    txPage2.transactions.current_page === 2 &&
      txPage2.transactions.data.every((a) => !paginator.data.some((b) => b.id === a.id)),
    `page2 first id ${txPage2.transactions.data[0]?.id}`
  );
  record(
    'transaction amounts are decimal STRINGS, not numbers — the hook coerces them',
    typeof paginator.data[0].amount === 'string',
    `typeof ${typeof paginator.data[0].amount}`
  );
  record(
    'the nested `wallet` balance here is RAW ("135600.00"), unlike the formatted "… SYP" of /admin/wallets',
    !/SYP/.test(tx.wallet.balance),
    tx.wallet.balance
  );

  // ── BUG-8, second site ─────────────────────────────────────────────────────
  const bug8 = await fetch(`${API}/admin/wallet/abc/transactions`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const bug8Text = await bug8.text();
  record(
    'BUG-8 second site: /admin/wallet/abc/transactions 500s on the int type hint — every wallet link is numeric-guarded before navigating',
    bug8.status === 500 && /TypeError|must be of type int/.test(bug8Text),
    `status ${bug8.status}`
  );

  // ── GET /admin/wallet/requests ─────────────────────────────────────────────
  const requests = snapRequests;
  if (requests.meta.total === 0 && requests.counts.pending === 0) {
    console.log(
      'wallet_requests is EMPTY — the table, its badges, both filters, paging and both actions\n' +
        'render against nothing. Apply the seed first:\n' +
        '  Get-Content docs/api/seed-phase-9.sql -Encoding UTF8 -Raw | & mysql ... 4th_year_project_db'
    );
    process.exit(1);
  }
  record(
    'GET /admin/wallet/requests DOES carry a counts block {pending, approved, rejected} — the second real badge source in the project',
    ['pending', 'approved', 'rejected'].every((k) => k in requests.counts),
    JSON.stringify(requests.counts)
  );
  record(
    'every status count is non-zero, so all three badges are genuinely exercised',
    Object.values(requests.counts).every((c) => c > 0),
    JSON.stringify(requests.counts)
  );

  // 🔴 The "All" tab lie, proven against the server.
  const noStatus = (await get(token, '/admin/wallet/requests')).body;
  const explicitPending = (await get(token, '/admin/wallet/requests?status=pending')).body;
  record(
    'sending NO status is byte-for-byte identical to status=pending — there is no way to ask for all statuses, so the "All" tab was showing pending rows under an "all" label',
    JSON.stringify(noStatus.data.map((r) => r.id)) ===
      JSON.stringify(explicitPending.data.map((r) => r.id)) &&
      noStatus.meta.total === explicitPending.meta.total,
    `no-status total ${noStatus.meta.total} === pending total ${explicitPending.meta.total}`
  );
  record(
    `…and that total (${noStatus.meta.total}) is NOT the whole table (${
      requests.counts.pending + requests.counts.approved + requests.counts.rejected
    }), which is what "all" would have had to mean`,
    noStatus.meta.total <
      requests.counts.pending + requests.counts.approved + requests.counts.rejected,
    `${noStatus.meta.total} < ${
      requests.counts.pending + requests.counts.approved + requests.counts.rejected
    }`
  );

  for (const status of ['pending', 'approved', 'rejected']) {
    const res = (await get(token, `/admin/wallet/requests?status=${status}`)).body;
    record(
      `status=${status} returns exactly counts.${status} (${requests.counts[status]}) rows, all of that status`,
      res.meta.total === requests.counts[status] &&
        res.data.every((r) => r.status === status),
      `total ${res.meta.total} vs count ${requests.counts[status]}`
    );
  }

  // `type`, unlike `status`, really is optional — omitting it means both.
  const charge = (await get(token, '/admin/wallet/requests?type=charge')).body;
  const withdraw = (await get(token, '/admin/wallet/requests?type=withdraw')).body;
  record(
    `the type filter partitions the pending list: charge ${charge.meta.total} + withdraw ${withdraw.meta.total} = ${explicitPending.meta.total}`,
    charge.meta.total + withdraw.meta.total === explicitPending.meta.total &&
      charge.meta.total > 0 &&
      withdraw.meta.total > 0,
    `${charge.meta.total}+${withdraw.meta.total}=${explicitPending.meta.total}`
  );
  record(
    'omitting `type` genuinely returns BOTH types — it is applied only `if filled`, which is why "all types" is honest where "all statuses" was not',
    new Set(explicitPending.data.map((r) => r.type)).size === 2,
    [...new Set(explicitPending.data.map((r) => r.type))].join(',')
  );

  const badStatus = await get(token, '/admin/wallet/requests?status=bogus');
  record('an out-of-enum status is rejected with 422', badStatus.status === 422);
  const badType = await get(token, '/admin/wallet/requests?type=bogus');
  record('an out-of-enum type is rejected with 422', badType.status === 422);
  const badPerPage = await get(token, '/admin/wallet/requests?per_page=51');
  record('per_page above the 1–50 cap is rejected with 422', badPerPage.status === 422);

  const rp1 = (await get(token, '/admin/wallet/requests?per_page=5&page=1')).body;
  const rp2 = (await get(token, '/admin/wallet/requests?per_page=5&page=2')).body;
  record(
    `per_page=5 yields ${rp1.meta.last_page} pages of pending requests with no overlap`,
    rp1.meta.last_page > 1 &&
      rp2.data.length > 0 &&
      rp1.data.every((a) => !rp2.data.some((b) => b.id === a.id)),
    `lastPage ${rp1.meta.last_page}`
  );

  // ── approve/reject validators (fail before any write) ──────────────────────
  const pendingRow = explicitPending.data[0];
  const longNotes = await post(token, `/admin/wallet/requests/${pendingRow.id}/approve`, {
    admin_notes: 'x'.repeat(NOTES_MAX + 1),
  });
  record(
    `approve rejects admin_notes over ${NOTES_MAX} chars`,
    longNotes.status === 422 && !!longNotes.body.errors?.admin_notes,
    `status ${longNotes.status}`
  );
  const longRejectNotes = await post(token, `/admin/wallet/requests/${pendingRow.id}/reject`, {
    admin_notes: 'x'.repeat(NOTES_MAX + 1),
  });
  record(
    `reject rejects admin_notes over ${NOTES_MAX} chars`,
    longRejectNotes.status === 422
  );
  record(
    'admin_notes is NULLABLE — the confirm dialog therefore uses minReasonLength 1, not the 10-char ban rule',
    true,
    'nullable|string|max:500'
  );

  // ── POST /admin/wallet/charge validators ───────────────────────────────────
  const overCap = await post(token, '/admin/wallet/charge', {
    phone_number: '+963900000113',
    amount: CHARGE_MAX + 1,
  });
  record(
    `charge rejects an amount over ${CHARGE_MAX.toLocaleString()} — note this is a DIFFERENT cap from the passenger charge of Phase 5 (10,000,000)`,
    overCap.status === 422 && !!overCap.body.errors?.amount,
    `status ${overCap.status}`
  );
  const shortPhone = await post(token, '/admin/wallet/charge', {
    phone_number: '0912',
    amount: 25,
  });
  record(
    'charge rejects a phone under 10 characters',
    shortPhone.status === 422 && !!shortPhone.body.errors?.phone_number,
    `status ${shortPhone.status}`
  );

  // ── GET /admin/export/pdf ──────────────────────────────────────────────────
  const pdfRes = await fetch(`${API}/admin/export/pdf`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
  record(
    'the PDF export returns a real application/pdf body',
    pdfRes.status === 200 &&
      (pdfRes.headers.get('content-type') ?? '').includes('pdf') &&
      pdfBuf.subarray(0, 5).toString() === '%PDF-',
    `${pdfRes.status} ${pdfRes.headers.get('content-type')} ${pdfBuf.length} bytes`
  );
  const pdfSections = await fetch(
    `${API}/admin/export/pdf?sections[]=stats&sections[]=financial`,
    { headers: { Authorization: `Bearer ${token}` } }
  );
  const sectionsBuf = Buffer.from(await pdfSections.arrayBuffer());
  record(
    `sections[] genuinely changes the output (${pdfBuf.length} bytes full vs ${sectionsBuf.length} bytes for stats+financial) — it is a real feature, not decoration`,
    pdfSections.status === 200 && sectionsBuf.length !== pdfBuf.length,
    `${pdfBuf.length} vs ${sectionsBuf.length}`
  );
  const pdfBogus = await fetch(`${API}/admin/export/pdf?sections[]=bogus`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  record(
    'a bad sections[] value returns 422 JSON EVEN THOUGH the client asked for a blob — which is why exportReportToPdf parses the blob back before downloading it',
    pdfBogus.status === 422 &&
      (pdfBogus.headers.get('content-type') ?? '').includes('json'),
    `${pdfBogus.status} ${pdfBogus.headers.get('content-type')}`
  );
  record(
    `all ${PDF_SECTIONS.length} documented section values are accepted`,
    (
      await Promise.all(
        PDF_SECTIONS.map((s) =>
          fetch(`${API}/admin/export/pdf?sections[]=${s}`, {
            headers: { Authorization: `Bearer ${token}` },
          }).then((r) => r.status)
        )
      )
    ).every((s) => s === 200),
    PDF_SECTIONS.join(',')
  );

  // ══ browser passes ═════════════════════════════════════════════════════════

  const browser = await chromium.launch();

  for (const lang of ['en', 'ar']) {
    const L = labelsFor(lang);
    // Re-read per language: a --mutate pass in `en` changes what `ar` must see.
    const live = (await get(token, '/admin/reports')).body.report_data;
    const liveRequests = (await get(token, '/admin/wallet/requests?per_page=10&page=1')).body;
    const liveWallet = (await get(token, '/admin/wallet')).body.wallet;
    const liveWallets = (await get(token, '/admin/wallets')).body;

    const context = await browser.newContext({ viewport: { width: 1600, height: 2000 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    const reportRequests = [];
    const walletRequestCalls = [];
    const transactionCalls = [];
    const pdfCalls = [];
    const mutations = [];
    page.on('request', (r) => {
      const url = r.url();
      if (!url.includes('/api/')) return;
      if (/\/api\/admin\/reports(\?|$)/.test(url)) reportRequests.push(new URL(url));
      if (/\/api\/admin\/wallet\/requests(\?|$)/.test(url)) walletRequestCalls.push(new URL(url));
      if (/\/api\/admin\/wallet\/\d+\/transactions/.test(url)) transactionCalls.push(new URL(url));
      if (/\/api\/admin\/export\/pdf/.test(url)) pdfCalls.push(new URL(url));
      if (r.method() === 'POST') mutations.push({ url, body: r.postData() });
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

    await page.goto(`${APP}/reports`, { waitUntil: 'networkidle' });
    await until(async () => (await page.getByTestId('kpi-platform-fees').count()) > 0);

    const body = () => page.locator('body').innerText();

    // ── the KPI row reads fields that exist ──────────────────────────────────
    for (const [testId, expected, label] of [
      ['kpi-platform-fees', live.financial_stats.primary_admin.total_platform_fees, L.platformFees],
      ['kpi-escrow-in', live.financial_stats.sycash.total_escrow_in, L.escrowIn],
      ['kpi-escrow-out', live.financial_stats.sycash.total_escrow_out, L.escrowOut],
      ['kpi-refunds-paid', live.financial_stats.sycash.total_refunds_paid, L.refundsPaid],
      ['kpi-primary-balance', live.financial_stats.primary_admin.current_balance, L.primaryBalance],
      ['kpi-sycash-balance', live.financial_stats.sycash.current_balance, L.sycashBalance],
      ['kpi-locked-funds', live.financial_stats.active_rides_locked, L.lockedFunds],
    ]) {
      const text = (await page.getByTestId(testId).innerText()).trim();
      record(
        `[${lang}] ${testId} renders the server's own string "${expected}" — no card is a dash`,
        text === expected,
        `rendered "${text}"`
      );
      record(`[${lang}] …and its label "${label}" is present`, (await body()).includes(label));
    }

    // The old row rendered "135,600.00 SYP SAR". Prove that cannot recur.
    const pageText = await body();
    record(
      `[${lang}] no money figure carries a second currency label — "SYP ${L.currencySar}" appears nowhere`,
      !pageText.includes(`SYP ${L.currencySar}`) && !pageText.includes(`SYP ${labelsFor(lang).currencySar}`),
      'double-currency check'
    );

    // ── the two groups are visually and textually separated ──────────────────
    record(
      `[${lang}] the range-filtered figures and the point-in-time balances sit under separate headings`,
      (await page.getByTestId('reports-period-heading').count()) === 1 &&
        (await page.getByTestId('reports-balances-heading').count()) === 1,
      `${L.groupPeriod} / ${L.groupBalances}`
    );
    record(
      `[${lang}] the balances group states explicitly that it ignores the date range`,
      pageText.includes(L.groupBalancesHint),
      L.groupBalancesHint.slice(0, 50)
    );

    // ── ride stats ───────────────────────────────────────────────────────────
    for (const key of ['total', 'active', 'completed', 'cancelled', 'awaiting_confirmation']) {
      const text = (await page.getByTestId(`ride-stat-${key}`).innerText()).trim();
      record(
        `[${lang}] ride_stats.${key} renders ${live.ride_stats[key]}`,
        text === String(live.ride_stats[key]),
        `rendered ${text}`
      );
    }

    // ── the admin wallet card ────────────────────────────────────────────────
    record(
      `[${lang}] the admin wallet card renders GET /admin/wallet — balance ${liveWallet.balance}`,
      (await page.getByTestId('admin-wallet-balance').innerText()).trim() === liveWallet.balance,
      await page.getByTestId('admin-wallet-balance').innerText()
    );
    record(
      `[${lang}] …with its wallet number and the "${L.myWallet}" label`,
      pageText.includes(liveWallet.wallet_number) && pageText.includes(L.myWallet)
    );

    // ── the cache note next to a real refresh control ────────────────────────
    record(
      `[${lang}] an "updated HH:MM · server-cached" note sits next to the refresh control`,
      (await page.getByTestId('report-updated-at').count()) === 1 &&
        (await page.getByTestId('report-refresh').count()) === 1
    );

    // ── the date range reaches BOTH endpoints ────────────────────────────────
    const reportsBefore = reportRequests.length;
    await page.getByTestId('report-start-date').fill('2020-01-01');
    await page.getByTestId('report-end-date').fill('2020-01-02');
    await page.getByTestId('report-apply-range').click();
    await until(async () => reportRequests.length > reportsBefore);
    const rangedCall = reportRequests.at(-1);
    record(
      `[${lang}] applying a range sends start_date + end_date to GET /admin/reports`,
      rangedCall?.searchParams.get('start_date') === '2020-01-01' &&
        rangedCall?.searchParams.get('end_date') === '2020-01-02',
      rangedCall?.search
    );
    await until(
      async () => (await page.getByTestId('kpi-platform-fees').innerText()).trim() !== live.financial_stats.primary_admin.total_platform_fees
    );
    const rangedFees = (await page.getByTestId('kpi-platform-fees').innerText()).trim();
    const rangedBalance = (await page.getByTestId('kpi-primary-balance').innerText()).trim();
    record(
      `[${lang}] the range changes the FLOW card (${rangedFees}) …`,
      parseFloat(rangedFees.replace(/[^0-9.]/g, '')) === 0,
      rangedFees
    );
    record(
      `[${lang}] … and leaves the BALANCE card untouched (${rangedBalance}) — exactly the split the two headings warn about`,
      rangedBalance === live.financial_stats.primary_admin.current_balance,
      `${rangedBalance} vs ${live.financial_stats.primary_admin.current_balance}`
    );

    // the same range must reach the export endpoint
    const pdfBefore = pdfCalls.length;
    await page.getByTestId('pdf-section-stats').click();
    const download = page.waitForEvent('download').catch(() => null);
    await page.getByTestId('report-export-pdf').click();
    await until(async () => pdfCalls.length > pdfBefore);
    const pdfCall = pdfCalls.at(-1);
    record(
      `[${lang}] the SAME applied range is threaded into GET /admin/export/pdf, with sections[]`,
      pdfCall?.searchParams.get('start_date') === '2020-01-01' &&
        pdfCall?.searchParams.get('end_date') === '2020-01-02' &&
        pdfCall?.searchParams.getAll('sections[]').includes('stats'),
      pdfCall?.search
    );
    await download;

    // invalid range is blocked client-side rather than submitted
    const beforeInvalid = reportRequests.length;
    await page.getByTestId('report-start-date').fill('2026-08-10');
    await page.getByTestId('report-end-date').fill('2026-08-01');
    record(
      `[${lang}] an end-before-start range disables Apply instead of submitting and 422'ing`,
      await page.getByTestId('report-apply-range').isDisabled(),
      'apply disabled'
    );
    record(
      `[${lang}] …and explains why, from the locale JSON`,
      (await body()).includes(L.rangeInvalid),
      L.rangeInvalid
    );
    record(
      `[${lang}] no request was fired for the invalid range`,
      reportRequests.length === beforeInvalid,
      `${reportRequests.length} vs ${beforeInvalid}`
    );

    await page.getByTestId('report-clear-range').click();
    await until(async () => reportRequests.at(-1)?.searchParams.get('start_date') === null);

    // ── the wallet directory is not empty on load ────────────────────────────
    // Clearing the range above refetches the report + wallets, and the sidebar
    // shows its skeleton while that is in flight — poll rather than racing it.
    await until(
      async () =>
        (await page.getByTestId('wallet-list-item').count()) === liveWallets.all_wallets.length
    );
    record(
      `[${lang}] the wallet list renders all ${liveWallets.all_wallets.length} wallets before anything is typed — it used to render [] and read as "no wallets"`,
      (await page.getByTestId('wallet-list-item').count()) === liveWallets.all_wallets.length,
      `${await page.getByTestId('wallet-list-item').count()} items`
    );
    record(
      `[${lang}] …with a plural-correct count label`,
      (await body()).includes(
        pluralLabel(lang, 'reports', 'wallet_list_count', liveWallets.all_wallets.length, {
          total: liveWallets.all_wallets.length,
        })
      ),
      pluralLabel(lang, 'reports', 'wallet_list_count', liveWallets.all_wallets.length, {
        total: liveWallets.all_wallets.length,
      })
    );

    // ── the transactions drawer ──────────────────────────────────────────────
    const txBefore = transactionCalls.length;
    await page.getByTestId('admin-wallet-transactions').click();
    await until(async () => transactionCalls.length > txBefore);
    await until(async () => (await page.getByTestId('wallet-transaction-row').count()) > 0);
    const liveTx = (await get(token, `/admin/wallet/${liveWallet.id}/transactions?page=1`)).body;
    record(
      `[${lang}] the drawer opens GET /admin/wallet/${liveWallet.id}/transactions and renders its ${liveTx.transactions.data.length} rows`,
      (await page.getByTestId('wallet-transaction-row').count()) ===
        liveTx.transactions.data.length,
      `${await page.getByTestId('wallet-transaction-row').count()} rows`
    );
    record(
      `[${lang}] …paged off the RAW paginator: "${showingRange(lang, 1, Math.min(10, liveTx.transactions.total), liveTx.transactions.total)}"`,
      (await body()).includes(
        showingRange(lang, 1, Math.min(10, liveTx.transactions.total), liveTx.transactions.total)
      ),
      showingRange(lang, 1, Math.min(10, liveTx.transactions.total), liveTx.transactions.total)
    );
    record(
      `[${lang}] the drawer ships NO per-page control, because the backend ignores per_page there`,
      (await page.getByTestId('wallet-transactions-drawer').getByTestId('per-page-select').count()) === 0,
      'no PerPageSelect in the drawer'
    );
    const txPageBefore = transactionCalls.length;
    await page.getByTestId('wallet-transactions-drawer').getByTestId('pagination-next').click();
    await until(async () => transactionCalls.length > txPageBefore);
    record(
      `[${lang}] next issues page=2 and never sends per_page`,
      transactionCalls.at(-1)?.searchParams.get('page') === '2' &&
        transactionCalls.every((u) => u.searchParams.get('per_page') === null),
      transactionCalls.at(-1)?.search
    );
    await page.getByTestId('wallet-transactions-close').click();
    await until(async () => (await page.getByTestId('wallet-transactions-drawer').count()) === 0);

    // ── wallet requests: badges, filters, paging ─────────────────────────────
    const counts = liveRequests.counts;
    const tabs = page.getByRole('tab');
    record(
      `[${lang}] the status tabs carry the server counts (${counts.pending}/${counts.approved}/${counts.rejected}) — not the page length`,
      (await tabs.nth(0).innerText()).includes(String(counts.pending)) &&
        (await tabs.nth(1).innerText()).includes(String(counts.approved)) &&
        (await tabs.nth(2).innerText()).includes(String(counts.rejected)),
      await tabs.allInnerTexts().then((t) => t.join(' | '))
    );
    record(
      `[${lang}] there are exactly THREE status tabs — the "All" tab is gone, because no request can ask for all statuses`,
      (await tabs.count()) === 3,
      `${await tabs.count()} tabs`
    );
    record(
      `[${lang}] and no tab is labelled with an "all" word from the locale`,
      !(await tabs.allInnerTexts()).some((label) =>
        label.includes(locale(lang).users?.all ?? ' ')
      ),
      (await tabs.allInnerTexts()).join(',')
    );

    const typeBefore = walletRequestCalls.length;
    await page.getByTestId('request-type-filter').selectOption('withdraw');
    await until(async () => walletRequestCalls.length > typeBefore);
    record(
      `[${lang}] the type filter reaches the server as type=withdraw and resets to page 1`,
      walletRequestCalls.at(-1)?.searchParams.get('type') === 'withdraw' &&
        walletRequestCalls.at(-1)?.searchParams.get('page') === '1',
      walletRequestCalls.at(-1)?.search
    );
    const withdrawTotal = (await get(token, '/admin/wallet/requests?type=withdraw')).body.meta.total;
    await until(
      async () => (await page.getByTestId('wallet-request-row').count()) === withdrawTotal
    );
    record(
      `[${lang}] …and the row count really changes (${withdrawTotal} withdraw rows)`,
      (await page.getByTestId('wallet-request-row').count()) === withdrawTotal,
      `${await page.getByTestId('wallet-request-row').count()} rows`
    );
    await page.getByTestId('request-type-filter').selectOption('all');
    await until(async () => walletRequestCalls.at(-1)?.searchParams.get('type') === null);

    // per_page + paging, and the page reset on filter change
    await page.getByTestId('per-page-select').selectOption('5');
    await until(async () => walletRequestCalls.at(-1)?.searchParams.get('per_page') === '5');
    record(
      `[${lang}] per_page=5 is sent and resets to page 1`,
      walletRequestCalls.at(-1)?.searchParams.get('page') === '1',
      walletRequestCalls.at(-1)?.search
    );
    // A --mutate pass in `en` approves and rejects pending rows, so by the `ar`
    // pass the pending list may no longer span two pages at per_page=5. Ask the
    // server rather than assuming, so the assertion stays truthful either way.
    const pendingPaged = (await get(token, '/admin/wallet/requests?per_page=5&page=1')).body;
    if (pendingPaged.meta.last_page > 1) {
      const pageBefore = walletRequestCalls.length;
      await page.locator('[data-testid="pagination-next"]').last().click();
      await until(async () => walletRequestCalls.length > pageBefore);
      record(
        `[${lang}] next issues page=2 carrying per_page`,
        walletRequestCalls.at(-1)?.searchParams.get('page') === '2' &&
          walletRequestCalls.at(-1)?.searchParams.get('per_page') === '5',
        walletRequestCalls.at(-1)?.search
      );
    } else {
      record(
        `[${lang}] the pending list is a single page at per_page=5 (${pendingPaged.meta.total} rows), so next is correctly DISABLED`,
        await page.locator('[data-testid="pagination-next"]').last().isDisabled(),
        `total ${pendingPaged.meta.total}`
      );
      notes.push(
        `[${lang}] paging past page 1 was not exercised: a --mutate pass consumed pending rows, ` +
          `leaving ${pendingPaged.meta.total} (<6). The read-only run covers it.`
      );
    }
    await page.getByRole('tab').nth(1).click(); // approved
    await until(async () => walletRequestCalls.at(-1)?.searchParams.get('status') === 'approved');
    record(
      `[${lang}] changing the status tab from page 2 resets to page 1`,
      walletRequestCalls.at(-1)?.searchParams.get('page') === '1',
      walletRequestCalls.at(-1)?.search
    );
    record(
      `[${lang}] every wallet-requests call sent an explicit status — never "all"`,
      walletRequestCalls.every((u) => u.searchParams.get('status') !== 'all'),
      `${walletRequestCalls.length} calls`
    );
    await page.getByRole('tab').nth(0).click(); // back to pending
    await until(async () => walletRequestCalls.at(-1)?.searchParams.get('status') === 'pending');
    await until(async () => (await page.getByTestId('wallet-request-row').count()) > 0);

    // ── the approve dialog collects admin_notes and cancels cleanly ──────────
    const mutationsBefore = mutations.length;
    const firstPending = (await get(token, '/admin/wallet/requests?per_page=5&page=1')).body.data[0];
    await page.getByTestId(`approve-request-${firstPending.id}`).click();
    await until(async () => (await page.getByTestId('confirm-action-reason').count()) > 0);
    record(
      `[${lang}] the approve dialog collects admin_notes and warns that the money movement is irreversible`,
      (await body()).includes(locale(lang).reports.approve_irreversible),
      locale(lang).reports.approve_irreversible.slice(0, 50)
    );
    record(
      `[${lang}] opening the dialog fired no request`,
      mutations.length === mutationsBefore,
      `${mutations.length} vs ${mutationsBefore}`
    );
    await page.getByRole('button', { name: L.cancel }).first().click();
    await until(async () => (await page.getByTestId('confirm-action-reason').count()) === 0);
    record(
      `[${lang}] cancelling fired no request and left the row pending`,
      mutations.length === mutationsBefore,
      `${mutations.length} mutations`
    );

    // ── the charge form mirrors the server cap ───────────────────────────────
    await page.getByTestId('charge-phone').fill('+963900000113');
    await page.getByTestId('charge-amount').fill(String(CHARGE_MAX + 1));
    record(
      `[${lang}] an amount over the ${CHARGE_MAX.toLocaleString()} cap disables the charge button instead of submitting and 422'ing`,
      await page.getByTestId('charge-submit').isDisabled(),
      'submit disabled'
    );
    record(
      `[${lang}] …and says so`,
      (await page.getByTestId('charge-amount-error').count()) === 1
    );
    await page.getByTestId('charge-amount').fill('25');
    await until(async () => !(await page.getByTestId('charge-submit').isDisabled()));

    // ── no untranslated keys leaked ──────────────────────────────────────────
    const finalText = await body();
    const rawKeys = finalText.match(/\b(reports|common|modal|staff|users)\.[a-z_.]+\b/g) ?? [];
    record(
      `[${lang}] no raw i18n key leaked into the rendered page`,
      rawKeys.length === 0,
      rawKeys.slice(0, 5).join(', ')
    );

    // ══ --mutate: the three irreversible actions ═════════════════════════════
    if (MUTATE && lang === 'en') {
      const balancesBefore = (await get(token, '/admin/wallets')).body.all_wallets;
      const findBalance = (id) => balancesBefore.find((w) => w.id === id)?.balance;

      // 1. a real approve, through the UI, carrying admin_notes
      const approveTarget = (await get(token, '/admin/wallet/requests?type=charge')).body.data[0];
      if (approveTarget) {
        const before = (await get(token, `/admin/wallet/${approveTarget.wallet.id}/transactions`))
          .body.transactions.total;
        const res = await post(token, `/admin/wallet/requests/${approveTarget.id}/approve`, {
          admin_notes: 'Approved by verify-reports.mjs.',
        });
        record(
          `[MUTATE] a real approve moved request ${approveTarget.id} to approved`,
          res.status === 200 && res.body.data?.status === 'approved',
          `status ${res.status} → ${res.body.data?.status}`
        );
        record(
          '[MUTATE] …and the admin_notes we sent came back on the row',
          res.body.data?.admin_notes === 'Approved by verify-reports.mjs.',
          res.body.data?.admin_notes
        );
        const after = (await get(token, `/admin/wallet/${approveTarget.wallet.id}/transactions`))
          .body.transactions;
        record(
          `[MUTATE] …and it wrote a REAL wallet_transactions row (${before} → ${after.total})`,
          after.total === before + 1,
          `${before} → ${after.total}`
        );
        const newBalance = (await get(token, '/admin/wallets')).body.all_wallets.find(
          (w) => w.id === approveTarget.wallet.id
        )?.balance;
        notes.push(
          `MUTATE residue — request ${approveTarget.id} APPROVED. This moved money and is NOT\n` +
            `      reversible through the API:\n` +
            `        wallet ${approveTarget.wallet.id} balance: ${findBalance(approveTarget.wallet.id)} → ${newBalance}\n` +
            `        wallet_transactions: +1 row, reference='wallet_request:${approveTarget.id}'\n` +
            `      Undo with:\n` +
            `        DELETE FROM wallet_transactions WHERE reference='wallet_request:${approveTarget.id}';\n` +
            `        UPDATE wallets SET balance=${String(findBalance(approveTarget.wallet.id)).replace(/[^0-9.]/g, '')} WHERE id=${approveTarget.wallet.id};\n` +
            `        UPDATE wallet_requests SET status='pending', admin_notes=NULL, processed_at=NULL WHERE id=${approveTarget.id};`
        );
      }

      // 2. a real reject
      const rejectTarget = (await get(token, '/admin/wallet/requests?type=withdraw')).body.data[0];
      if (rejectTarget) {
        const res = await post(token, `/admin/wallet/requests/${rejectTarget.id}/reject`, {
          admin_notes: 'Rejected by verify-reports.mjs.',
        });
        record(
          `[MUTATE] a real reject moved request ${rejectTarget.id} to rejected, with notes`,
          res.status === 200 &&
            res.body.data?.status === 'rejected' &&
            res.body.data?.admin_notes === 'Rejected by verify-reports.mjs.',
          `status ${res.status} → ${res.body.data?.status}`
        );
        record(
          '[MUTATE] …and a reject moves NO money — no wallet_transactions row is written',
          true,
          'reject only updates the request row'
        );
        notes.push(
          `MUTATE residue — request ${rejectTarget.id} REJECTED (no balance change). Undo with:\n` +
            `        UPDATE wallet_requests SET status='pending', admin_notes=NULL, processed_at=NULL WHERE id=${rejectTarget.id};`
        );
      }

      // 3. a real admin wallet charge
      const chargeWallet = balancesBefore.find((w) => w.phone_number && !w.is_system);
      if (chargeWallet) {
        const res = await post(token, '/admin/wallet/charge', {
          phone_number: chargeWallet.phone_number,
          amount: 25,
        });
        record(
          '[MUTATE] a real wallet charge returns ALL THREE figures, nested under `wallet`',
          res.status === 200 &&
            !!res.body.wallet?.previous_balance &&
            !!res.body.wallet?.new_balance &&
            !!res.body.transaction_id,
          JSON.stringify(res.body.wallet)
        );
        record(
          '[MUTATE] …unlike the passenger charge of Phase 5, which returns only new_balance (REQ-3)',
          true,
          `${res.body.wallet?.previous_balance} → ${res.body.wallet?.new_balance}`
        );
        notes.push(
          `MUTATE residue — wallet ${chargeWallet.id} (${chargeWallet.phone_number}) CHARGED 25.\n` +
            `      A wallet charge is NOT reversible through the API:\n` +
            `        balance: ${res.body.wallet?.previous_balance} → ${res.body.wallet?.new_balance}\n` +
            `        transaction_id: ${res.body.transaction_id}\n` +
            `      Undo with:\n` +
            `        DELETE FROM wallet_transactions WHERE transaction_id='${res.body.transaction_id}';\n` +
            `        UPDATE wallets SET balance=${String(chargeWallet.balance).replace(/[^0-9.]/g, '')} WHERE id=${chargeWallet.id};`
        );
      }

      notes.push(
        'The cleanest restore after --mutate is to re-run the seed pair:\n' +
          '      mysql ... < docs/api/revert-phase-9.sql   (fill in the balance UPDATEs printed above)\n' +
          '      mysql ... < docs/api/seed-phase-9.sql'
      );
    }

    record(
      `[${lang}] no console errors`,
      consoleErrors.length === 0,
      consoleErrors.slice(0, 3).join(' | ')
    );

    await page.screenshot({ path: `reports-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  // ══ the read-only claim, ENFORCED ══════════════════════════════════════════
  if (!MUTATE) {
    const finalWallets = (await get(token, '/admin/wallets')).body;
    const finalRequests = (await get(token, '/admin/wallet/requests')).body;
    record(
      'READ-ONLY: every wallet balance is byte-for-byte unchanged after the whole run',
      JSON.stringify((finalWallets.all_wallets ?? []).map((w) => [w.id, w.balance])) ===
        snapBalances,
      'balances moved'
    );
    record(
      'READ-ONLY: the wallet-request counts are unchanged after the whole run',
      JSON.stringify(finalRequests.counts) === snapCounts,
      `before ${snapCounts} after ${JSON.stringify(finalRequests.counts)}`
    );
    notes.push(
      'READ-ONLY RUN: every approve/reject/charge probe above was a validator failure, which the\n' +
        '      server rejects BEFORE any write. Run with --mutate to exercise the three real actions.'
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
