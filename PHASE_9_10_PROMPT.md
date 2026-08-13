# Prompt — Phases 9 & 10 (Reports / Wallet, and Staff / Employees)

> Paste everything below the line into a fresh session.

---

Continue with **Phase 9 (Reports & Wallet)** and **Phase 10 (Staff / Employees)** from
BACKEND_INTEGRATION_PLAN.md. Fully implement both — every component on the Reports and Staff pages
must be driven by a real backend endpoint, verified against the live API, not just written.

Do Phase 9 first. **Phase 10 is different from every phase so far: its backend is broken, and three
of its six endpoints corrupt data while reporting failure.** Read the Phase 10 section before you
touch anything under `src/features/staff/`.

## Scope — Phase 9 (Reports & Wallet), `staff:system_admin` unless noted

- `GET  /admin/reports?start_date&end_date` → `{status, report_data{ride_stats, financial_stats, date_range}}`
- `GET  /admin/export/pdf?start_date&end_date&sections[]` → `application/pdf` binary
- `GET  /admin/wallet` *(admin,system_admin)* → `{status, wallet{id, wallet_number, phone_number, balance, admin_type}}`
- `GET  /admin/wallets` *(admin,system_admin)* → `{status, admin_wallets[2], all_wallets[32]}`
- `GET  /admin/wallet/{walletId}/transactions` *(admin,system_admin)* → `{status, wallet, transactions{…raw Laravel paginator}}`
- `GET  /admin/wallet/requests?status&type&per_page&page` *(admin,system_admin)* → `{status, data[], meta{…}, counts{pending,approved,rejected}}`
- `POST /admin/wallet/requests/{id}/approve|reject` `{admin_notes nullable|max:500}`
- `POST /admin/wallet/charge` `{phone_number required|min:10|max:15, amount required|numeric|min:1|max:1000000}`

Validators, confirmed live 2026-08-13:

| endpoint | param | rule |
|---|---|---|
| `reports`, `export/pdf` | `start_date` | `nullable\|date_format:Y-m-d` |
| `reports`, `export/pdf` | `end_date` | `nullable\|date_format:Y-m-d\|after_or_equal:start_date` |
| `export/pdf` | `sections[]` | `nullable\|array`, each `in:stats,financial,growth,cities,recent` |
| `wallet/requests` | `status` | `sometimes\|in:pending,approved,rejected` — ⚠️ **see the default trap below** |
| `wallet/requests` | `type` | `sometimes\|in:charge,withdraw` |
| `wallet/requests` | `per_page` | `sometimes\|integer\|min:1\|max:50` · `page` `min:1` |
| `wallet/requests/{id}/approve\|reject` | `admin_notes` | `nullable\|string\|max:500` |
| `wallet/charge` | `phone_number` | `required\|string\|min:10\|max:15` |
| `wallet/charge` | `amount` | `required\|numeric\|min:1\|**max:1000000**` |

## Scope — Phase 10 (Staff / Employees), `staff:system_admin`

- `GET   /employees` · `POST /employees` · `GET /employees/{id}` · `PUT /employees/{id}`
- `PATCH /employees/{id}/toggle-active` · `PATCH /employees/{id}/reset-password`
- There is **no** `DELETE /employees/{id}` — confirmed live, `405 MethodNotAllowed`.

`store` validators: `username required|string|min:3|max:50|alpha_dash` · `email nullable|email|max:255` ·
`password required|string|min:8` · `first_name required|string|max:100` · `last_name required|max:100` ·
`role required|in:<creatableRoles of the caller>` (for `system_admin`: **`admin`, `support_agent`** only).
`update`: `first_name|last_name|email` all `sometimes`. `reset-password`: `new_password required|string|min:8`.

---

# 🔴 Read this before writing any Phase 10 code

**The plan says "All six `/employees` endpoints return 500". That is true but dangerously incomplete.**
Probed live 2026-08-13. `EmployeeManagementController` calls three methods that do not exist on
`EmployeeManagementService` — and *where* in each action it calls them decides whether the request
corrupts data on its way out.

The service defines `getAll · getById · create · update · rotatePassword · toggleActive · delete`.
The controller calls `list()`, `resetPassword()` and `formatEmployee()`. None of those exist.

| Endpoint | Controller calls | Writes before dying? |
|---|---|---|
| `GET /employees` | `list()` ✗ | no — dies immediately |
| `GET /employees/{id}` | `getById()` ✓ → `formatEmployee()` ✗ | no (read-only) |
| `POST /employees` | `create()` ✓ → `formatEmployee()` ✗ | 🔴 **YES — employee created, then 500** (BUG-2) |
| `PUT /employees/{id}` | `update()` ✓ → `formatEmployee()` ✗ | 🔴 **YES — row updated, then 500** |
| `PATCH .../toggle-active` | `toggleActive()` ✓ → `formatEmployee()` ✗ | 🔴 **YES — verified live, see below** |
| `PATCH .../reset-password` | `resetPassword()` ✗ | no — dies before the write |

**Verified live, not inferred.** `PATCH /employees/3/toggle-active` returned `500`, and
`SELECT is_active FROM employees WHERE id=3` had flipped `1 → 0` with a fresh `updated_at`. The
employee was really deactivated while the API reported failure. *(That probe was rolled back:
`UPDATE employees SET is_active=1 WHERE id=3;`.)*

**Why the 500 is an Ignition HTML page and not the controller's own error JSON:** every action wraps
its body in `catch (\Exception $e) { … serverError(); }`, but "Call to undefined method" throws
**`\Error`**, which is not an `\Exception`. The catch never fires, the exception escapes the
controller entirely, and with `APP_DEBUG=true` (NOTE-2) Laravel renders a full stack trace with
absolute filesystem paths.

**Do not be fooled by the non-500 responses.** These look like working endpoints and are not:

```
PATCH /employees/1/toggle-active   → 403 "The 'System Administrator' account cannot be deactivated"
PUT   /employees/1                 → 403 "…cannot be modified via the API."
PATCH /employees/1/reset-password  → 422 {"new_password":["The new password field is required."]}
```

All three are the **guard or the validator firing before** the undefined method is reached. Against a
real, non-restricted employee (id 3, `agent01`, `support_agent`) every one of them 500s. Any
verification that only exercises employee 1 will conclude the backend works. It does not.

**The fix is small and worth offering:** rename `list` → `getAll` and `resetPassword` →
`rotatePassword` at the call sites (or alias them on the service), and add a `formatEmployee()`. Put
that in `backend-issues.md` as a concrete patch, not just a complaint.

**Decide, and say which you chose:** this is the first phase whose backend cannot be verified
end-to-end. Either (a) build the UI against the documented contract and ship it behind a clearly
labelled "unavailable" state driven by the real 500, or (b) build it and gate it behind a flag. What
you must not do is ship destructive buttons that a user will press and be told failed while the write
lands. **At minimum, create/update/toggle must not be reachable while BUG-1 stands.** Whatever you
choose, the read path must degrade honestly, not render an empty table that looks like "no staff".

---

## Live seed reality — read this before promising anything

Probed 2026-08-13 against the running backend:

```
/admin/reports              → ride_stats {total 71, active 48, completed 14, cancelled 5, awaiting 4}
/admin/wallets              → admin_wallets 2 · all_wallets 32
/admin/wallet/1/transactions→ 31 transactions across 4 pages   ← genuinely rich, no seeding needed
/admin/wallet/2/transactions→ …                                 (194 wallet_transactions rows total)
/admin/wallet/requests      → total: 0,  counts {pending:0, approved:0, rejected:0}   ← EMPTY
/employees                  → 500 (BUG-1);  3 rows in the table: system_admin, sycash, agent01
```

**Mixed.** Reports, wallets and wallet *transactions* have real data and need **no seeding** — a
welcome change from Phases 6–8. But `wallet_requests` is **empty**, so `TransactionTable`, its
`counts` badges, the status/type filters, paging, and both approve and reject actions render and
verify against nothing.

So: **seed `wallet_requests` deliberately, document it, and revert it**, exactly as Phase 7/8 did.
`docs/api/seed-phase-7-8.sql` and its revert are the model to copy — including the header explaining
what each row exercises.

`wallet_requests` columns: check the live schema before writing the INSERTs (`DESCRIBE wallet_requests`)
— do **not** copy the shape from `WalletRequestResponse` in `walletApi.ts`, which is a frontend guess.
Seed enough to exercise the real paths: rows in **all three** statuses, **both** `type` values, more
than one page at the smallest `per_page`, and at least one row per status so every badge is non-zero.

Note the FKs: a request points at a `user` **and** a `wallet`, and approve/reject move real money
through `CashRideFeeService` and write `wallet_transactions`. **A `--mutate` approve is not reversible
by deleting the request row** — it also changed a balance and left a transaction. Print the SQL for
all of it, as `verify-users.mjs` does for the wallet charge.

## Corrections to the plan's Phase 9 text — verify these yourself, they are load-bearing

1. **The Reports KPI row is already broken, and silently.** `FinancialStats` in
   `src/features/reports/api/reportsApi.ts` does not match the payload. Live:

   | `OverviewCards` reads | API actually returns |
   |---|---|
   | `primary_admin.total_collected` → **undefined → renders "—"** | `primary_admin.total_platform_fees` |
   | `primary_admin.total_disbursed` → **undefined → renders "—"** | — (does not exist) |
   | `sycash.total_creation_fees` (typed, unused) | `sycash.total_escrow_in / total_escrow_out / total_refunds_paid` |

   **Two of the four cards on that page are permanently dashed right now** because the interface
   drifted from the payload and `display()` turns `undefined` into `—`. This is the exact
   anti-pattern Phase 7 was told to eliminate, shipping in the current build. Also: the whole
   `sycash` block — four real figures — is typed wrong and rendered nowhere, and `date_range` is
   typed `{start: string; end: string}` while the API returns `null` for both when unfiltered.

2. **The date range DOES work — the plan implies it is merely unwired, but it is worth proving.**
   Live: unfiltered `71` rides → `2026-08-01..2026-08-13` gives `64` → `2020-01-01..2020-01-02` gives
   `0`, and `date_range` echoes what you sent.

3. **⚠️ But only *some* fields respond to it, and they sit in the same card row.** Confirmed live on
   a `2020-01-01..2020-01-02` range:

   | Range-filtered (flows) | NOT range-filtered (point-in-time balances) |
   |---|---|
   | `sycash.total_escrow_in` → `0.00` | `sycash.current_balance` → unchanged `718,000.00` |
   | `sycash.total_escrow_out`, `total_refunds_paid` | `primary_admin.current_balance` → unchanged `135,600.00` |
   | `primary_admin.total_platform_fees` → `0.00` | `active_rides_locked` → unchanged `546,000.00` |

   A range picker sitting above a row where half the cards ignore it is a lie by layout. **Separate
   them visually and label the balances as current-as-of-now**, or the user will read a
   point-in-time balance as a period figure. This is a UI decision you must make explicitly and
   record.

4. **`GET /admin/reports` is server-cached for 5 minutes, keyed per date range**
   (`admin.report.{start}.{end}`). Nothing busts it. Follow the Dashboard/Verifications precedent:
   an "updated HH:MM · server-cached for up to 5 minutes" note next to a real refresh control, so an
   unchanged figure does not read as a bug.

5. **`GET /admin/export/pdf` accepts a `sections[]` parameter the plan never mentions** —
   `in:stats,financial,growth,cities,recent`, validated (`sections[]=bogus` → 422). It genuinely
   changes the output. Decide whether to expose it; if you do, it is a real feature, not decoration.

6. **`/admin/wallet/requests` DOES return a `counts` block** — `{pending, approved, rejected}`. This
   is the second inbox in the project that can carry real badges (after Phase 7's complaints). Do not
   ship it badge-less by analogy with the REQ-2 pages.

7. **🔴 The "All" tab on wallet requests is currently a lie.** The controller does
   `$status = $request->get('status', 'pending');` and **always** filters. There is no way to ask for
   all statuses. `useReports` maps its `'all'` filter to *sending no `status` at all* — so selecting
   "All" silently shows **only pending requests**, labelled as all. Either drop the All tab, or make
   it three requests, or relabel it. Do not leave it as-is. File the missing "no filter" option.

8. **`POST /admin/wallet/charge` really does return all three fields** the plan promises —
   `{wallet:{phone_number, previous_balance, new_balance}, transaction_id}`. Note they are **nested
   under `wallet`**, and that this is a *different* endpoint from the passenger
   `charge-wallet` of Phase 5, which returns only `new_balance` (REQ-3). Their `amount` caps also
   differ: **1,000,000 here vs 10,000,000 there**. Mirror the right one.

## Two more live findings you will hit

- **`GET /admin/wallet/{walletId}/transactions` returns a raw Laravel paginator, not the house
  envelope.** Top-level keys are `current_page, data, last_page, per_page, total` *plus*
  `links, first_page_url, next_page_url, prev_page_url, path, from, to` — there is no `meta`. Every
  other paginated endpoint in this project uses `{data, meta{…}}`. Do not assume `meta`.
- **`per_page` is silently ignored on that endpoint.** `AdminWalletService::getWalletTransactions(int
  $walletId, int $perPage = 10)` — the controller never passes the second argument, so the page size
  is hardcoded to 10. `page` *is* honoured. Verified: `?per_page=3` returns 10 rows.
  **Do not ship a `PerPageSelect` there** — it would be a control that does nothing. Use
  `TablePagination` alone and file the gap.

## Work items — Phase 9

1. **Fix `FinancialStats` against the real payload and re-lay-out the KPI row.** Every card must read
   a field that exists. The four `sycash` figures and `total_platform_fees` are real and currently
   invisible; `total_collected` and `total_disbursed` do not exist and must stop being rendered.
   Per the Phase 7 precedent: **restructure or remove — do not leave a dash.** Record the visible
   change in the plan.
2. **Date range picker**, threaded through **both** `GET /admin/reports` and `GET /admin/export/pdf`,
   honouring `Y-m-d` and `after_or_equal:start_date` — disable/validate client-side rather than
   submitting and 422'ing. Handle the range/balance split from correction 3.
3. **🆕 Admin wallet card** — `GET /admin/wallet` returns the acting admin's own wallet and nothing
   renders it. Add it to the Reports header.
4. **🆕 Wallet transactions drawer** — `walletApi.getWalletTransactions()` exists and has never been
   called. Clicking a wallet in `ManagementSidebar` opens it. 31 real transactions over 4 pages on
   wallet 1, so this is fully verifiable without seeding. Mind the raw-paginator envelope and the
   dead `per_page`.
5. **Wallet requests: expose the `type` filter** (`charge|withdraw`), add **`counts`-driven badges**,
   `per_page` + `TablePagination`, `page` resets to 1 on every filter change, and resolve the "All"
   tab lie from correction 7.
6. **`admin_notes` on approve/reject.** The API accepts up to 500 chars and the UI always sends
   nothing. Route it through `ConfirmActionModal` — note `admin_notes` is `nullable`, so use
   `minReasonLength={1}` at most, following the Phase 6 reject precedent, **not** the 10-char ban rule.
7. **Charge wallet: show all three returned figures** and refetch `getAllWallets()` afterwards. Mirror
   `max:1000000` and **disable** the confirm rather than submitting and 422'ing.
8. **`filteredWallets` returns `[]` until the user types** — so the wallet list renders empty on load,
   which reads as "no wallets" rather than "search to begin". There are 32. Fix the empty state, and
   note this is a *client-side* filter over a payload with no search param — justify keeping it the
   way Phase 6 justified `visibleRequests`, or paginate it properly.
9. **PDF export: handle a non-blob error response.** Laravel returns JSON on failure even with
   `responseType:'blob'` (a `sections[]=bogus` 422 proves it), so the current code will download a
   corrupt file named `.pdf`. Parse and surface it.
10. **Hook hygiene:** `useReports.error` is `Error | null` going to `console.error` — move to
    `extractApiError` and `string | null`. Dates are pinned to `'ar-SY'`; follow the active locale.

## Work items — Phase 10

1. **Resolve BUG-1 first** — decide (a) or (b) from the red section above and implement it. Nothing
   else on this page matters if a working-looking button silently corrupts a row.
2. **Remove `deleteEmployee`.** `staffApi.deleteEmployee` and `useStaff.deleteEmployee` call a route
   that returns `405`. Replace the delete button with *Deactivate* (`toggle-active`), which is what
   the backend intends. Note `EmployeeManagementService::delete()` **is** fully implemented and just
   has no route (BUG-4) — say so rather than implying deletion is unsupported by design.
3. **Restrict the create-role dropdown to `admin` and `support_agent`.** `CreatableStaffRole` and
   `CREATABLE_STAFF_ROLES` already exist from Phase 1 — reuse them, do not redefine.
4. **Surface the real error codes:** `403` DomainException (not permitted to manage this employee, and
   the restricted-account guard), `409` RuntimeException (username/email taken), `422` validation.
   Mirror `alpha_dash|min:3|max:50` on username and `min:8` on password client-side.
5. **Show `created_by` and `last_login_at`** — both are in the intended `EmployeeResponse`. ⚠️ Check
   them against reality first: all three seeded employees have `created_by = NULL`, and only
   `system_admin` has a non-null `last_login_at`. If `created_by` is null for every row, do not render
   an "Unknown" column — drop it and file it, exactly as Phase 4 did for `banned_by` (BUG-5).
6. **`BroadcastAlertModal`** — `POST /admin/broadcast-alert` returns **404**, confirmed live. Per the
   Phase 0 decision: hide the button behind a feature flag or remove it. Do not ship a control that
   404s.
7. **Hook hygiene:** `useStaff.error` is `Error | null` → `extractApiError` and `string | null`; dates
   pinned to `'ar-SY'` → active locale; skeletons, `ErrorBanner` with retry, empty states.
   `useStaff` already uses the shared `<Avatar>` (Phase 4) — the `i.pravatar.cc` item in the plan is
   stale, confirm and strike it.

## Already done — reuse, do NOT rebuild

- `ConfirmActionModal` — `minReasonLength`, `maxReasonLength`, and (added in Phase 7) an optional
  **`statusOptions`** selector, a `confirmTone` (`destructive|primary`) and a **`children`** slot for
  rendering context above the reason field. Testids: `confirm-action-reason`,
  `confirm-action-submit`, `confirm-action-status`.
- `useApiAction` — `runAction`, `isBusy`, `feedback`, `clearFeedback`, and (Phase 7) **`notify(tone,
  message)`** for reporting something that already happened with no call to wrap.
- `<Avatar name photo />`, `ErrorBanner` (takes `message`), `TableSkeleton` (renders `<tr>`),
  `FilterTabs` (optional `count` badges), `TablePagination` (`pagination-prev|next`), `PerPageSelect`
  (`data-testid="per-page-select"`), `ActionBanner` (`action-banner`).
- `extractApiError` / `getFieldErrors` in `src/services/apiError.ts`. Hooks type `error` as
  `string | null` — keep both features consistent with that.
- Shared `common.showing_range` (six Arabic CLDR forms) for any "showing x–y of z" label.
- `useFetchEffect` pauses polling while the tab is hidden — inherited, no per-hook work.
- `tests/testServer.ts` has **no baseline handlers** (Phase 7 removed the last one deliberately);
  register what you need per test.

## Constraints

- Follow the atareeqak-frontend skill conventions: `endpoints.ts` → feature api → hook → page.
  No direct axios in components. Palette tokens, no raw hex.
- **You may change the UI to match the backend.** Where the payload cannot support a component as
  designed, **restructure or remove it** — move a card, drop a column, re-lay-out the KPI row. What
  you must not do is keep the shape and fill it with invented, derived-and-presented-as-server-truth,
  or permanently-dashed values. The Reports KPI row is already failing this test today. Prefer the
  smallest honest change and record every visible change in the plan.
- i18n keys in BOTH `ar` and `en`; Arabic needs all six CLDR plural forms
  (`_zero/_one/_two/_few/_many/_other`) for any key receiving `count` — every badge label is one.
  Audit the existing `reports`, `wallet` and `staff` keys for count-bearing ones shipping a single
  ungrammatical form: Phase 4 found three in `drivers`, Phase 5 one in `users`, Phase 6 one in
  `verifications`, Phase 7 one in `support`. Delete dead keys you orphan.
- **Money is formatted server-side** (`"135,600.00 SYP"`) — it arrives as a pre-formatted string, not
  a number. Do not re-parse and re-format it, and do not append a second currency label: check
  whether `t('users.currency')` is already being appended to a string that ends in `SYP`.
- Loading skeletons, `ErrorBanner` with retry, empty states everywhere.
- Hide actions the backend would reject rather than showing-and-422ing.
- If the payload cannot support something the plan assumes, do NOT fake it — file it in
  `docs/api/backend-issues.md` (next free number is **REQ-6**; BUG numbering is at **10**) and say so
  explicitly in the plan.

## Verification (required before calling it done)

- `npx tsc -b`, `npm run lint`, `npm test` all clean. Current baseline: **173 passing.** Add hook
  tests for: the date range reaching both the report and the PDF request, the `type` + `status`
  filters, `counts`-driven badges, page-resets-on-filter-change, the `admin_notes` payload on
  approve/reject, the charge-wallet response shape, and the wallet-transactions raw-paginator
  mapping. For Phase 10: the create payload, the role restriction, and that no code path can issue
  `DELETE /employees/{id}`.
- Write `docs/api/verify-reports.mjs` and `docs/api/verify-staff.mjs` in the style of
  **`verify-support.mjs`** (the newest and closest model — it handles a server-cached endpoint, a
  `counts` block, an endpoint whose GET mutates, and a payload that cannot fill the UI). Drive the
  real pages in Chromium in **both `en` and `ar`**, assert rendered values match the live payload,
  that every action hits the API, and that no untranslated key leaks. Read expected labels **from the
  locale JSON**, never hardcoded, and use the `until()` polling helper rather than fixed sleeps.
- **Assert the read-only claim, do not just state it.** `verify-support.mjs` re-reads the complaint
  counts at the end of a read-only run and fails if they moved — which is how it caught a "read-only"
  pass that was silently mutating. Do the same here: snapshot the wallet balances, the request counts
  and the `employees` rows at the start and assert they are unchanged at the end. **Phase 10 needs
  this more than any phase so far** — three of its endpoints write and then report failure, so a
  careless probe corrupts the seed while looking like it failed.
- Both scripts read-only by default; `--mutate` performs one real wallet-request approve, one real
  reject, and one real admin wallet charge. **None of the three is reversible through the API** —
  print the balances, the `wallet_transactions` rows created, and the SQL to undo all of it, as
  `verify-users.mjs` does.
- **`verify-staff.mjs` must exercise a non-restricted employee**, not just employee 1 — see the red
  section. Assert the three write-then-500 endpoints *by checking the database after the 500*, so the
  script proves BUG-1's severity rather than restating it. Roll back whatever it proves.
- Re-run `verify-support.mjs` (105 read-only), `verify-reviews.mjs` (64), `verify-verifications.mjs`
  (51), `verify-drivers.mjs` (94) and `verify-users.mjs` (137) afterwards if you touch anything shared.
- Update BACKEND_INTEGRATION_PLAN.md with what was done, verified, and dropped — including every
  deliberate UI change and every seeded-then-reverted row.

## Environment

Background services are torn down between sessions and have died mid-run in **every** prior phase.
Restart and verify all three before starting, and re-check if requests suddenly hang (a dead MySQL
takes the API down with it, which looks like a frontend timeout):

- **MySQL:** `"C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysqld.exe" --basedir=... --datadir=.../data --port=3306 --bind-address=127.0.0.1`
- **API:** `cd ../4th_year_projects_refractored && APP_ENV=localdev php artisan serve --host=127.0.0.1 --port=8000`
- **Frontend:** `npm run dev -- --host 127.0.0.1 --port 5173 --strictPort` (plain `npm run dev` has
  bound IPv6-only `::1` before)
- Check with `Get-Process mysqld,php,node` **and** a real request. A running process is not proof the
  port is listening — **and `Test-NetConnection` gives false negatives on :8000**: in Phase 6 it
  reported the port closed while `curl http://127.0.0.1:8000/api/staff/me` correctly returned
  `401 TOKEN_MISSING`. Trust the curl.
- **Login:** `system_admin` / `admin`. Access tokens expire in 1 h — re-login rather than reusing a
  saved token if you see `TOKEN_INVALID`.
- **MySQL client:** `"C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" -h 127.0.0.1
  -P 3306 -u root 4th_year_project_db`. Run it through the **PowerShell** tool, not Bash — the Bash
  tool mangles UTF-8 output (cp720) and silently returned nothing for Arabic text in Phase 6. Pipe
  `.sql` files in as `Get-Content file.sql -Encoding UTF8 -Raw | & $mysql … --default-character-set=utf8mb4`.
- **Seed:** 35 users / 71 rides / 58 bookings / 10 drivers / 2 pending verifications /
  **3 employees / 32 wallets / 194 wallet transactions / 0 wallet requests / 0 complaints / 0 reviews**.

## Seed drift from earlier phases

- Phase 3 cancelled bookings `#BK-35/36/56/57/58`.
- Phase 4 left drivers pristine. Phase 5's and Phase 6's mutations were fully rolled back in SQL and
  verified.
- Phase 7/8's seed (12 complaints, 2 attachments, 8 profile comments) was **fully reverted** —
  `/staff/complaints`, `/staff/escalated-complaints` and `/staff/reviews` are all back to `total: 0`,
  and the `complaint_response`/`complaint_resolved` notifications were deleted from both
  `notifications` and the `user_notifications` join table. Re-apply
  [`docs/api/seed-phase-7-8.sql`](docs/api/seed-phase-7-8.sql) if you need to re-run those scripts.
- **This session's Phase 10 probe** deactivated employee 3 (`agent01`) via the write-then-500
  `toggle-active`, and it was restored: `UPDATE employees SET is_active=1 WHERE id=3;`. All three
  employees are `is_active = 1`. `agent01` itself is leftover from the BUG-2 repro, not part of the
  original seed.
- If you ban/unban anyone, note that unban writes `status = 0` (`logged_out`), **not** 1 — restore
  with `UPDATE users SET status=1 WHERE id=...` + `php artisan cache:clear`.
- **BUG-7:** seeded `/storage/` URLs 404 and Chromium reports it as `ERR_BLOCKED_BY_ORB` on
  `requestfailed`, not a 404 on `response`. Watch both events if you assert on it.
- **BUG-8 is a pattern, not one route.** Any `{id}` route with an `int` type hint 500s with a stack
  trace on a non-numeric segment. A **second site** was confirmed live this session:
  `GET /admin/wallet/abc/transactions` → `TypeError: …showWalletTransactions(): Argument #1
  ($walletId) must be of type int, string given`. If you add a route-parameter link anywhere in
  Phase 9, make sure the value is numeric before you navigate. Extend BUG-8 rather than filing a new
  number.
- **🆕 Found this session, not yet filed — `POST /admin/photo` is a stub that lies.**
  `AdminDashboardController::uploadAdminPhoto()` is a one-line
  `return response()->json(['status' => 'success', 'message' => 'Photo uploaded']);` — no validation,
  no file handling, no storage write, no DB write. Verified live: a POST with **no file at all**
  returns `200 {"status":"success","message":"Photo uploaded"}`. It belongs to Phase 12, but file it
  now (it is the reason `admin_photo` will never populate, alongside BUG-5) and **do not wire an
  upload control to it in any phase** — it would tell the user their photo was saved when nothing
  happened.
