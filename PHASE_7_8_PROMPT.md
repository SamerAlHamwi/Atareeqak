# Prompt — Phases 7 & 8 (Support / Complaints, and Reviews)

> Paste everything below the line into a fresh session.

---

Continue with **Phase 7 (Support / Complaints)** and **Phase 8 (Reviews)** from
BACKEND_INTEGRATION_PLAN.md. Fully implement both — every component on the Support and Reviews
pages must be driven by a real backend endpoint, verified against the live API, not just written.

Do Phase 7 first; Phase 8 is much smaller and shares its verification harness. Both may land in one
pass, but do not start 8 until 7's checks are green.

## Scope — Phase 7 (Support)

- `GET  /staff/complaints?status&type&date&user_id&per_page&page`
      → `{status, data[], meta{current_page,last_page,per_page,total}, counts{all,pending,in_review,resolved,closed}}`
- `GET  /staff/complaints/{id}` — ⚠️ **has a side effect**, see below
- `PATCH /staff/complaints/{id}/respond` `{resolution_notes required|min:10|max:3000, status required|in:in_review,resolved,closed}`
- `PATCH /staff/complaints/{id}/escalate` `{reason required|min:10|max:1000}`
- `GET  /staff/escalated-complaints?status&type&date&per_page&page`
      → same envelope, `counts{escalated,resolved,closed}`, `status` accepts `escalated|resolved|closed`
- `PATCH /staff/escalated-complaints/{id}/resolve` `{resolution_notes, status}`

`index` validators, confirmed live 2026-08-13:

| param | rule |
|---|---|
| `status` | `sometimes\|in:pending,in_review,resolved,closed` — **`escalated` is NOT valid here and 422s** |
| `type` | `sometimes\|in:trip_safety,driver_behavior,passenger_behavior,ride_cancellation,financial_issue,account_issue,technical_issue,other` |
| `date` | `sometimes\|in:last_7_days,last_30_days` |
| `user_id` | `sometimes\|integer\|exists:users,id` |
| `per_page` | `sometimes\|integer\|min:1\|max:50` |
| `page` | `sometimes\|integer\|min:1` |

## Scope — Phase 8 (Reviews)

- `GET    /staff/reviews?user_id&search&date&per_page&page` → `{status, data[], meta{…}}` — **no `counts` block**
- `DELETE /staff/reviews/{commentId}`

Validators: `user_id sometimes|integer|exists:users,id` · `search sometimes|string|max:255` ·
`date sometimes|in:last_7_days,last_30_days` · `per_page 1–50` · `page min:1`.
Backed by the `profile_comments` table (`id, profile_id, user_id, comment, timestamps`) — these are
comments written **on a profile**, not ride ratings. `user_ratings` is a separate, unused table.

## Live seed reality — read this before promising anything

Probed 2026-08-13 against the running backend. **Both features have a completely empty seed:**

```
/staff/complaints            → total: 0,  counts {all:0, pending:0, in_review:0, resolved:0, closed:0}
/staff/escalated-complaints  → total: 0,  counts {escalated:0, resolved:0, closed:0}
/staff/reviews               → total: 0
complaints = 0 rows · complaint_attachments = 0 · profile_comments = 0 · user_ratings = 0
```

This is a bigger gap than Phase 6 faced (which at least had 2 pending rows). **Nothing on either
page renders against this seed** — not a row, not a badge, not a detail panel, not a single action.
Filters and pagination cannot be distinguished from a broken query when every response is empty.

So: **you must seed deliberately, document it, and revert it**, exactly as Phase 6 did for the four
`photos` rows. Both schemas are simple and FK-light:

- `complaints`: `id, user_id→users, assigned_to→employees (nullable), title, description, type,
  status, resolution_notes, resolved_at, timestamps`
- `profile_comments`: `id, profile_id→profiles, user_id→users (the commenter), comment, timestamps`

Seed enough to exercise the real paths — at minimum: complaints across **all four** `index` statuses
plus at least one `escalated`, spanning **more than one `type`**, more than one page at the smallest
`per_page`, and some inside/outside the `last_7_days` window so the date filter changes the row
count instead of being verified only by its echo. Same for reviews: enough rows to page, plus
distinct comment text so `search` is provably server-side.

Record the exact INSERTs and the exact DELETEs in the plan, and prove the revert with a final
read-only run. **Do not claim a code path was verified if the seed could not exercise it — say so.**

## Corrections to the plan's Phase 7 text — verify these yourself, they are load-bearing

1. **`GET /staff/complaints/metrics` does not 404 — it returns `500` with a full stack trace.**
   The plan says 404. Live:
   ```
   500  TypeError: StaffComplaintController::show(): Argument #1 ($complaintId)
        must be of type int, string given
   ```
   `"metrics"` is matched by the `{id}` route and fails the `int` type hint. Combined with
   `APP_DEBUG=true` (NOTE-2 in backend-issues.md) it renders an Ignition HTML page with file paths.
   That is a worse finding than "endpoint missing" and should be filed as such.
2. **`GET /staff/complaints` DOES return a `counts` block** — unlike `/staff/bookings`,
   `/admin/drivers` and `/admin/users` (REQ-2). **The Support filter tabs can and must carry real
   badges.** This is the first inbox in the project where that is possible; do not ship it
   badge-less by analogy with the REQ-2 pages.
3. **`/staff/escalated-complaints` carries its own `counts{escalated,resolved,closed}`** — the
   escalated view gets real badges too, from a different vocabulary. Do not reuse the inbox's.

## The `show()` side effect — make it visible, do not hide it

`GET /staff/complaints/{id}` is **not a read**. `StaffComplaintService::openComplaint()` transitions
a `pending`, unassigned complaint to `in_review` and sets `assigned_to = <you>`, then the controller
`Cache::forget('staff.complaint-counts')`. Escalated complaints are viewable read-only and are not
reassigned.

Consequences you must handle rather than paper over:
- Opening a row **mutates it**. The badge counts change underneath the list; refetch `counts` after
  `show()` and tell the user the complaint was assigned to them.
- This makes the detail panel un-idempotent, which matters for the verification script: a read-only
  run that opens a pending complaint **has mutated the database**. Either treat opening as a
  mutation (and restore it), or open only non-pending rows in the read-only pass. Decide explicitly
  and say which you chose.

## Work items — Phase 7

1. **`SupportStats` is broken** — it calls the 500-ing `metrics` route. Per the Phase 0 decision,
   derive what you can from the two `counts` blocks and **remove the cards that cannot be derived**
   (avg response time has no source). Do not leave a card showing a dash because of a server error.
   Redesigning that row is expected — see the UI note below.
2. **Wire the `type` filter (8 values) and the `date` filter (2 values).** Both are accepted by the
   API today and neither is exposed in the UI.
3. **Guard the `escalated` tab.** `status=escalated` 422s against `index`; escalated complaints live
   behind the separate endpoint. The client must never issue that combination — hide-not-422, per
   the Phase 3 convention.
4. **Audit for the client-side re-filter.** `useSupport.visibleComplaints` is the same bug class
   removed in Phases 3, 4 and 5 (and knowingly left in place there). Delete it — filtering is
   server-side. If you conclude it must stay, justify it the way Phase 6 justified
   `visibleRequests` (that endpoint takes no params); `/staff/complaints` **does** take `status`, so
   that justification is not available here.
5. **`per_page` + `TablePagination`** on both views, and `page` resets to 1 on every filter change.
6. **Attachments**: `ComplaintResponse.attachments` is typed but unverified — check whether it
   renders (images inline, other MIME types as download links). `complaint_attachments` is empty, so
   this needs seeding too, and BUG-7 means any `/storage/` URL will fail — degrade visibly, as the
   verification document viewer now does.
7. **`respond` and `escalate` through `ConfirmActionModal`**, honouring the real validators
   (`min:10`, and the `max` caps via the `maxReasonLength` prop added in Phase 6). `respond` also
   needs a `status` choice from exactly `in_review|resolved|closed`.
8. **Error/loading/empty states**: `useSupport.error` is `Error | null` and the message goes to
   `console.error` — move to `extractApiError` and `string | null`, matching every other hook.
   Dates are pinned to `'ar-SY'`; follow the active locale.
9. The Postman-only verbs (`open`/`resolve`/`close`/`notes`) do not exist in this checkout — confirm
   against the live API before building anything on them.

## Work items — Phase 8

1. **`search` and `date` are already wired** (400 ms debounce) — verify rather than rebuild, and
   confirm both are genuinely server-side.
2. **Add `per_page`** (`PerPageSelect`) and confirm `TablePagination` reads `meta.last_page`.
3. **Deep-link `?user_id=`** so a profile page can jump to "reviews about this user". The param is
   validated `exists:users,id`, so a bad id 422s — handle it.
4. **Deletion is a moderation action** — require confirmation and show the commenter and the
   recipient in the dialog. There is no undo; say so.
5. Same hook hygiene as Phase 7: `error` → `string | null` via `extractApiError`, locale-aware dates,
   skeletons, `ErrorBanner` with retry, distinct empty states (no reviews vs. no search match).

## Already done — reuse, do NOT rebuild

- `ConfirmActionModal` — `minReasonLength` **and** `maxReasonLength` are props (Phase 6 added the
  latter, with a live character counter), plus `data-testid="confirm-action-reason"` and
  `"confirm-action-submit"`. A 10-char reason with a 1000- or 3000-char cap needs no new component.
- `<Avatar name photo />`, `ErrorBanner` (takes `message`), `TableSkeleton` (renders `<tr>` — write a
  list-shaped skeleton yourself for non-table layouts, as Phase 6 did), `FilterTabs` (supports
  optional `count` badges), `TablePagination`, `PerPageSelect`, `ActionBanner`
  (`data-testid="action-banner"`).
- `extractApiError` / `getFieldErrors` in `src/services/apiError.ts`. Hooks type `error` as
  `string | null` — keep both features consistent with that.
- Shared `common.showing_range` (six Arabic CLDR forms) for any "showing x–y of z" label, and
  `common.status.*` for `pending|in_review|resolved|closed|escalated`, which already exist.
- `useFetchEffect` pauses polling while the tab is hidden — inherited, no per-hook work.

## Constraints

- Follow the atareeqak-frontend skill conventions: `endpoints.ts` → feature api → hook → page.
  No direct axios in components. Palette tokens, no raw hex.
- **You may change the UI to match the backend.** The existing layouts were built against mock data
  and some of them assume fields the API does not return. Where the payload cannot support a
  component as designed, **restructure or remove the component** — move a card, drop a column,
  re-lay-out the KPI row, split or merge a panel. What you must not do is keep the shape and fill it
  with invented, derived-and-presented-as-server-truth, or permanently-dashed values. Prefer the
  smallest honest change, keep it consistent with the other pages, and record any visible change in
  the plan so it is a decision and not a surprise.
- i18n keys in BOTH `ar` and `en`; Arabic needs all six CLDR plural forms
  (`_zero/_one/_two/_few/_many/_other`) for any key receiving `count` — every badge label is one.
  Audit the existing `support` and `reviews` keys for count-bearing ones shipping a single
  ungrammatical form: Phase 4 found three in `drivers`, Phase 5 one in `users`, Phase 6 one in
  `verifications`. Delete dead keys you orphan.
- Loading skeletons, `ErrorBanner` with retry, empty states everywhere.
- Hide actions the backend would reject rather than showing-and-422ing.
- If the payload cannot support something the plan assumes, do NOT fake it — file it in
  `docs/api/backend-issues.md` (next free number is **REQ-5**; BUG numbering is at 7) and say so
  explicitly in the plan.

## Verification (required before calling it done)

- `npx tsc -b`, `npm run lint`, `npm test` all clean. Current baseline: **156 passing.** Add hook
  tests for: the `respond` and `escalate` payloads, the `escalated`-tab guard never sending
  `status=escalated` to `index`, `counts`-driven badges, page-resets-on-filter-change, the
  `show()`-refetches-counts behaviour, the review delete payload and the `user_id` deep link.
- Write `docs/api/verify-support.mjs` and `docs/api/verify-reviews.mjs` in the style of
  `verify-verifications.mjs` (the newest and closest model — it handles an endpoint with a server
  cache, a required field, and a payload that cannot fill the UI). Drive the real pages in Chromium
  in **both `en` and `ar`**, assert rendered values match the live payload, that every action hits
  the API, and that no untranslated key leaks. Read expected labels **from the locale JSON**, never
  hardcoded, and use the `until()` polling helper rather than fixed sleeps — the backend is
  single-process `artisan serve` and fixed waits are flaky under load.
- Both scripts read-only by default; `--mutate` performs one real respond, one real escalate, one
  real escalated-resolve, and one real review deletion. **A deleted `profile_comment` cannot be
  restored through the API** — print the row's contents and the INSERT to put it back, as
  `verify-users.mjs` does for the wallet charge.
- Re-run `verify-verifications.mjs` (51 read-only on the untouched seed, 59 with documents seeded),
  `verify-drivers.mjs` (94) and `verify-users.mjs` (137) afterwards if you touch anything shared.
- Update BACKEND_INTEGRATION_PLAN.md with what was done, verified, and dropped — including every
  deliberate UI change and every seeded-then-reverted row.

## Environment

Background services are torn down between sessions and have died mid-run in **every** prior phase,
including twice in Phase 6. Restart and verify all three before starting, and re-check if requests
suddenly hang (a dead MySQL takes the API down with it, which looks like a frontend timeout):

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
  tool mangles UTF-8 output (cp720) and silently returned nothing for Arabic text in Phase 6.
- **Seed:** 35 users / 71 rides / 58 bookings / 10 drivers / 2 pending verifications /
  **0 complaints / 0 reviews**.

## Seed drift from earlier phases

- Phase 3 cancelled bookings `#BK-35/36/56/57/58`.
- Phase 4 left drivers pristine.
- Phase 5's mutations (passengers 18 and 30) were fully rolled back in SQL and verified.
- Phase 6's mutations were fully rolled back and verified: users 31 and 33 are back to
  `verification_status='pending'`, both `is_verified_*` = 0, `national_id` NULL; the four temporary
  `photos` rows on user 31 and the `verification_rejected` notification were deleted;
  `cache:clear` run. `GET /staff/verifications/pending` again returns `total: 2`.
- If you ban/unban anyone, note that unban writes `status = 0` (`logged_out`), **not** 1 — restore
  with `UPDATE users SET status=1 WHERE id=...` + `php artisan cache:clear`.
- **BUG-7:** seeded `/storage/` URLs 404 and Chromium reports it as `ERR_BLOCKED_BY_ORB` on
  `requestfailed`, not a 404 on `response`. Watch both events if you assert on it. This will bite
  complaint attachments exactly as it bit verification documents.
- **Notifications** are linked through `user_notifications`, not `notifications.user_id` (that column
  exists but is left null) — check the join table before concluding no notification was sent.
