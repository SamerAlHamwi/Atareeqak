# Atareeqak Dashboard ↔ SyRide Backend — Full Integration Plan

**Goal:** every component of the dashboard is driven by a real backend endpoint, for a
**`system_admin`** session, with no mock data left in the product paths.

**Repos**

| Piece | Path | Current HEAD |
|---|---|---|
| Backend (Laravel) | `../4th_year_projects_refractored` | `3eb54ad` (2026‑08‑09), `main` = `origin/main` |
| Dashboard (React 19 + Vite + TS) | `Atareeqak` | working tree |
| API contract | `../SyRide_—_Admin,_Staff_&_System_Admin_APIs_postman_collection.json` | 60 requests |

**Live API:** `https://api.onwayride.me/api` (dev proxy in `vite.config.ts`, prod rewrite in `vercel.json`).

**How to use this file:** phases are ordered by dependency. Do **Phase 0 and Phase 1 first** — every
later phase assumes the contract is confirmed and auth is correct. Inside a phase the steps are
independent and can be parallelised. Each step ends with a **DoD** (definition of done) you can verify
in the browser or with a test.

---

## 1. What actually changed on the backend (findings)

These come from reading `routes/api.php`, the controllers, `StaffJwtMiddleware`, `AdminAuthService`,
`StaffRole`, and diffing against what the dashboard currently calls.

### 1.1 Auth was rebuilt — this is the biggest breaking change

| Before | Now |
|---|---|
| `/admin/login` looked up a **User** by email and matched it against `config/admin.php` | `/admin/login` looks up an **Employee** by `username` **or** `email` (field name is still `email` or `username` in the request body) |
| Any admin-ish user could log in | Only roles where `isAdminRole()` is true → **`system_admin` and `sycash` only** |
| `staff` middleware had a fallback that accepted **user JWTs** and auto-created an Employee row for the system admin | **Removed.** `StaffJwtMiddleware` decodes staff tokens only (`StaffJwtService`), loads the `Employee`, checks `is_active`, checks token version, then the role gate |
| Admin tokens and staff tokens were different formats | **Both are now issued by `StaffJwtService`** — `/admin/login` and `/staff/login` produce interchangeable tokens |

**Consequences for the dashboard:**

1. `src/services/api.ts` keeps two refresh endpoints keyed on `localStorage.auth_kind`. Both now go
   through `StaffJwtService`, so the split is dead weight — but it is *harmless*, so treat it as
   cleanup, not a blocker.
2. `src/features/auth/api/authApi.ts` hardcodes `role: 'system_admin'` on the `/admin/login`
   fallback path. **That is now wrong** — a `sycash` employee logging in that way would be labelled
   `system_admin` and shown UI it cannot use. The role must come from the server.
3. A **new role `sycash`** (Financial Administrator, level 3, between `admin` and `system_admin`)
   exists and is missing everywhere in the frontend (`src/types/index.ts`, `src/app/roles.ts`).

### 1.2 Role model (`app/Enums/StaffRole.php`)

| Role | Level | Restricted (seeded, cannot be created/deleted via API) | Can create |
|---|---|---|---|
| `system_admin` | 4 | ✅ | `admin`, `support_agent` |
| `sycash` | 3 | ✅ | nobody |
| `admin` | 2 | ❌ | `support_agent` |
| `support_agent` | 1 | ❌ | nobody |

As **`system_admin`** you get: every `/admin/*` route, every `/staff/*` route, and all of `/employees/*`.

### 1.3 Endpoints the dashboard calls that **do not exist** in the backend

These will 404/500 today. Every one of them backs a visible component.

| Dashboard constant | URL | Used by | Reality |
|---|---|---|---|
| `ENDPOINTS.SETTINGS` | `GET/POST /admin/settings` | whole **Settings** page | no route, no controller |
| `ENDPOINTS.BROADCAST_ALERT` | `POST /admin/broadcast-alert` | **Staff → Broadcast Alert** modal | no route |
| `ENDPOINTS.SUPPORT_METRICS` | `GET /staff/complaints/metrics` | **Support** KPI cards | no route — and worse, it *matches* `GET /staff/complaints/{id}`, so `"metrics"` is cast to `int 0` → 404 |
| `staffApi.deleteEmployee` | `DELETE /employees/{id}` | **Staff** delete button | `EmployeeManagementController` has no `destroy()`; deactivation is via `PATCH /employees/{id}/toggle-active` |

### 1.4 Endpoints in the Postman collection that **do not exist** in the backend checkout

| Postman request | Backend checkout |
|---|---|
| `PATCH /staff/complaints/{id}/open` | ❌ (opening happens implicitly on `GET /staff/complaints/{id}`) |
| `PATCH /staff/complaints/{id}/resolve` | ❌ (use `PATCH .../respond` with `status: resolved`) |
| `PATCH /staff/complaints/{id}/close` | ❌ (use `PATCH .../respond` with `status: closed`) |
| `POST /staff/complaints/{id}/notes` | ❌ |
| `GET /admin/debug` | ❌ |

Also: the collection has **no `/admin/login` request at all**, though the backend has one.

**Reading:** the collection is either ahead of `origin/main` (the deployed API may already have the
new complaint verbs) or aspirational. This is exactly what Phase 0 resolves — do not build against
either source until you have probed the live host.

### 1.5 Backend endpoints with **no dashboard consumer yet** (needed for "fully functional")

- `GET /admin/wallet` — the admin's own wallet (balance card).
- `GET /admin/wallet/{walletId}/transactions` — `walletApi.getWalletTransactions()` exists but is never called from any component.
- ~~`GET /admin/passengers/{id}/stats | monthly-trips | recent-trips | complaints | wallet-charges`~~ ✅ all five wired in Phase 5 as per-section refresh controls (window/limit/status selectors + a reload button each).
- `GET /admin/drivers/stats`, `GET /admin/drivers/activity` — covered by the `drivers/dashboard` BFF, so these are only needed if you add per-widget refresh. ~~`GET /admin/drivers/verification-efficiency`~~ ✅ wired in Phase 4 (period switch). `GET /admin/drivers/{id}/profile` has **no consumer by design** — Phase 4 deleted the wrapper; `{id}/dashboard` is a superset.
- ~~`GET /staff/bookings` and `POST /staff/bookings/{bookingId}/cancel` — **no UI exists**.~~ ✅ Built in Phase 3 as the Bookings tab on the Trips page.
- `GET /employees/{id}` — no consumer (the list carries everything today).
- `POST /admin/photo` — admin avatar upload; `MainLayout` still renders a hardcoded Unsplash photo.
- ~~`GET /admin/users/{id}/status`~~ ✅ Wired in Phase 4 (driver ban banner) and Phase 5 (passenger ban banner) through the now-shared `BanStatusBanner`.

### 1.6 Smaller mismatches worth fixing while you are in there

- ~~`useTrips.ts:49` calls `tripsApi.getAllTrips(1, activeFilter)` — **page is hardcoded to 1**.~~ ✅ Fixed in Phase 3: `getAllTrips({page, filter, per_page})` with a real pager.
- ~~Ban is always sent as `type: 'permanent'` from the details pages.~~ ✅ Fixed for **drivers** in Phase 4 and for **passengers** in Phase 5; both use `ConfirmActionModal` with `showBanOptions`.
- ~~`verificationsApi.rejectVerification(userId)` is called with no `reason`; the backend accepts one
  and forwards it into the user's notification.~~ ✅ Fixed in Phase 6 through `ConfirmActionModal`
  (`minReasonLength={1}` — the reject validator is `nullable|max:500`, **not** the 10-char ban rule).
  Confirmed live that the reason reaches the notification body ([NOTE-3](docs/api/backend-issues.md)).
- ~~`GET /admin/users` builds `admin_photo` from `$request->user()?->id`, which is **null** under
  `StaffJwtMiddleware`.~~ ✅ Confirmed live in Phase 5 and rendered through the `<Avatar>` fallback;
  filed as [BUG-5](docs/api/backend-issues.md), which Phase 5 extended to a **third** site
  (`chargeWallet` writes `user_id = null`, so no wallet charge records which admin made it).
- ~~Avatars fall back to `i.pravatar.cc` in 5 hooks and `MainLayout` uses a hardcoded Unsplash URL.~~ ✅ Done in Phase 4: shared `<Avatar name photo />` + `initialsOf`; all 7 pravatar sites and the Unsplash URL removed.

---

## 2. Component → endpoint status matrix

Legend: ✅ wired & endpoint exists · ⚠️ wired but mismatched/incomplete · ❌ endpoint missing · 🆕 to build

| Page / component | Endpoint(s) | Status |
|---|---|---|
| `auth/pages/Login` | `POST /staff/login` → fallback `POST /admin/login` | ⚠️ role hardcoded on fallback; `useMockAction` still imported |
| `AuthContext` | `GET /staff/me` | ⚠️ only refreshes role for `kind === 'staff'` |
| `services/api.ts` refresh | `POST /admin/refresh` \| `POST /staff/refresh` | ⚠️ redundant split |
| `dashboard/pages/Dashboard` | `GET /admin/dashboard` (BFF) | ⚠️ growth `1.2%` hardcoded; sub-endpoints unused |
| `trips/pages/Trips` + `TripsTable` | `GET /admin/trips` | ✅ paged, `counts`-driven badges, `per_page` |
| `trips/LiveTripsMap` | `GET /admin/trips/live` | ✅ 30 s poll, paused when hidden, "updated HH:MM" |
| `trips/MonitoringSidebar` | `GET /admin/routes/popular`, `GET /admin/drivers/top` | ✅ |
| `trips` cancel | `POST /staff/trips/{rideId}/cancel` | ✅ hidden for non-cancellable states |
| `trips/BookingsTable` | `GET /staff/bookings`, `POST /staff/bookings/{id}/cancel` | ✅ (no `counts` — [REQ-2](docs/api/backend-issues.md)) |
| `trips` "draft trip" / "contact driver" buttons | — | ✅ resolved in Phase 1.5 |
| `drivers/pages/Drivers` | `GET /admin/drivers/dashboard`, `GET /admin/drivers`, `GET /admin/drivers/verification-efficiency` | ✅ paged, `per_page`, search, period switch (no `counts` — [REQ-2](docs/api/backend-issues.md)) |
| `drivers/pages/DriverDetails` | `GET /admin/drivers/{id}/dashboard`, `GET /admin/users/{id}/status` | ✅ + ban-state banner |
| drivers ban/unban | `POST /admin/users/{id}/ban|unban` | ✅ permanent + temporary with expiry |
| `users/pages/Users` | `GET /admin/users` | ✅ paged, `per_page`, type + status + **date** + search (no `counts` — [REQ-2](docs/api/backend-issues.md)) |
| `users/pages/UserDetails` | `GET /admin/passengers/{id}/full-profile` + `stats`/`monthly-trips`/`recent-trips`/`complaints`/`wallet-charges`, `POST .../charge-wallet`, `GET /admin/users/{id}/status` | ✅ + per-section refresh, ban banner, temporary bans |
| `verification/pages/Verifications` | `GET /staff/verifications/pending`, `POST .../approve {national_id}`, `POST .../reject {reason}` | ✅ server `total`, real reject reason, required `national_id`, optimistic removal + reconcile |
| `verification/VerificationDocuments` | documents from the pending payload | ✅ all four types; unreachable files degrade visibly (BUG-7) |
| `support/pages/Support` (inbox) | `GET /staff/complaints`, `GET /staff/complaints/{id}`, `PATCH .../respond`, `PATCH .../escalate` | ✅ |
| `support` (escalated view) | `GET /staff/escalated-complaints`, `PATCH .../{id}/resolve` | ✅ |
| `support/SupportStats` | `GET /staff/complaints/metrics` | ❌ endpoint does not exist |
| `reviews/pages/Reviews` | `GET /staff/reviews`, `DELETE /staff/reviews/{id}` | ✅ |
| `reports/OverviewCards` | `GET /admin/reports` | ✅ |
| `reports/TransactionTable` | `GET /admin/wallet/requests`, `POST .../approve|reject` | ✅ |
| `reports/ManagementSidebar` | `GET /admin/wallets`, `POST /admin/wallet/charge` | ✅ |
| reports PDF | `GET /admin/export/pdf` | ✅ |
| `staff/pages/Staff` | `GET/POST /employees`, `PUT /employees/{id}`, `PATCH .../toggle-active`, `PATCH .../reset-password` | ✅ |
| staff delete | `DELETE /employees/{id}` | ❌ no such route |
| `staff/BroadcastAlertModal` | `POST /admin/broadcast-alert` | ❌ no such route |
| `settings/pages/Settings` (4 components) | `GET/POST /admin/settings` | ❌ no such route |
| `home/pages/Home` | — | ❌ two mock buttons |
| `MainLayout` header search | — | 🆕 non-functional input |
| `MainLayout` admin avatar | `POST /admin/photo` | 🆕 hardcoded Unsplash image |
| ~~— | `GET /staff/bookings`, `POST /staff/bookings/{id}/cancel`~~ | ✅ built in Phase 3 (Bookings tab) |
| — | `GET /admin/wallet`, `GET /admin/wallet/{id}/transactions` | 🆕 no UI |

---

## Phase 0 — Reconcile the contract — 🟡 **DONE except for what only the backend dev can answer**

> **Run 2026-08-10.** Deliverables are in [`docs/api/`](docs/api/). Read
> [`docs/api/decisions.md`](docs/api/decisions.md) first — it is the tiebreaker for every later phase.
>
> **It surfaced a blocker bigger than the ones this phase set out to find:**
> `https://api.onwayride.me/api` — the host `vite.config.ts` and `vercel.json` both point at — **is
> not the SyRide backend.** It is up, but it is an Express/Helmet service that 404s every path,
> including `/` and routes that certainly exist (`/admin/dashboard`, `/staff/me`). Evidence in
> [`probe-results.md`](docs/api/probe-results.md) §1–2.
>
> **There is no reachable backend to develop against.** Every Postman collection points at a *local*
> host, and the newest one (`http://localhost:8080/api`) matches the Docker stack added in the same
> update — `docker compose up` → nginx `:8080` → 3× Octane/RoadRunner. That is the intended target.
>
> Phases 1–15 can be *written* against `route-list.json`, but none can be *verified* until a backend
> is running. Standing up that backend is now the critical path — see 0.5.

### 0.1 Route list — ✅ done, **authoritative**

- [x] `docs/api/route-list.json` — **145 `api/*` routes** straight from `php artisan route:list --json`: 19 public, 58 end-user (`jwt`), 66 staff-guarded and `system_admin`-callable, 2 from `l5-swagger`. Each entry carries method, URI, route name, middleware (both kernel alias and FQCN), controller action, and `system_admin_can_call`.
- [x] Obtained by installing PHP 8.2 + Composer locally and booting the app from the `3eb54ad` checkout — **no database or web server needed** for `route:list`.
- [x] Reproducible via `docs/api/build-route-list.py`; `docs/api/parse-routes.py` is kept as a no-PHP backstop.
- [x] The earlier static parse was validated against it: identical on **all 143 routes declared in `routes/api.php`**, zero false positives; it missed only the two `l5-swagger` routes, exactly as documented.

**Result:** as `system_admin` you can call all 66 guarded routes plus the 4 public auth routes. The other 58 are end-user ride/chat/booking APIs behind `jwt` — a staff token will never open them.

### 0.2 Probe the live host — ✅ done, ⚠️ inconclusive by necessity

- [x] `docs/api/probe.sh` — re-runnable, and **needs no credentials**: Laravel answers `404` for an unregistered URI but `401 TOKEN_MISSING` for a registered-but-guarded one, and that difference alone settles Q1–Q5.
- [x] It carries a **control group** of four routes known to exist. If the controls return `404`, you are not talking to the Laravel app and the rest of the output is noise — which is exactly what happened.
- [x] Results and raw evidence in [`docs/api/probe-results.md`](docs/api/probe-results.md).
- [ ] **Re-run against a real backend:** `bash docs/api/probe.sh http://localhost:8080/api`. Expect four `401`s in the control block; then every other line is a real answer.

### 0.3 Questions for the backend dev — ✅ raised; Q1–Q5 answered by `artisan`

Ten questions, tracked as table A in [`decisions.md`](docs/api/decisions.md).

- [x] **Q1–Q5 resolved on fact.** None of the disputed endpoints exist in Laravel's route table: no `/admin/settings`, no `/admin/broadcast-alert`, no `/staff/complaints/metrics`, no `DELETE /employees/{id}`, and none of the Postman-only complaint verbs (`open`/`resolve`/`close`/`notes`) or `/admin/debug`. The fallbacks in Phases 7, 10 and 11 are now the plan of record, not guesses. What is still open is only **intent** — whether the backend dev plans to add any of them.
- [ ] Send table A to the backend developer for the intent calls (Q1–Q4) and Q6–Q9.
- [ ] **Q10 still gates end-to-end verification of every phase.**

### 0.4 Freeze the decision — ✅ done

- [x] [`docs/api/decisions.md`](docs/api/decisions.md): **16 items resolved from source** (table B) — auth/token model, the `sycash` role, creatable roles, filter vocabularies, pagination caps, cache TTLs, the complaint-`show` side effect, the `metrics`/`{id}` route collision. **10 pending** (table A). **9 confirmed-missing endpoints** (tables C and D).
- [x] Every ❌ row in §2 now has a decision or a named owner.

### 0.5 🔴 NEW — stand up a backend to develop against (now the critical path)

Cheapest first; any one of these unblocks the rest of the plan:

- [x] ~~Ask the backend dev for `php artisan route:list --json`~~ — **done locally** (PHP 8.2 + Composer installed; `artisan` boots without a database).
- [x] **Q10 answered by the user:** there is no live server, `api.onwayride.me` belongs to a different backend. `vite.config.ts` now targets `http://localhost:8080/api` (Phase 1.1). `vercel.json` still needs a decision before any production deploy.
- [ ] **Install Docker Desktop** and run the stack locally:
      ```console
      cd ../4th_year_projects_refractored
      docker compose up -d                                    # nginx :8080, mysql, redis, phpmyadmin :8081
      docker compose exec app1 php artisan migrate --seed     # seeds the system_admin employee
      docker compose exec app1 php artisan route:list --json > ../Atareeqak/docs/api/route-list.json
      ```
      Then point the dashboard at it (Phase 1.1) and re-run the probe.
- [ ] Get **`system_admin` credentials** for the seeded employee — nothing past Phase 1 can be verified without a login.

**DoD:** ✅ `docs/api/{README.md,decisions.md,route-list.json,probe-results.md,probe.sh,parse-routes.py}` exist and every ❌ row in §2 has a decision or a named owner. ⏳ Fully closed when Q1–Q5 and Q10 are answered and `probe.sh` returns four `401`s in its control block.

---

## Phase 1 — Foundation: transport, auth, roles — ✅ **DONE & VERIFIED AGAINST A LIVE BACKEND 2026-08-10**

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **57 passing, up from 24**.
>
> **Verified end-to-end against a real backend**: MySQL 8.0.40 + `artisan serve` on `:8000`, seeded
> with `system_admin` and `sycash` ([`docs/api/local-backend.md`](docs/api/local-backend.md)).
> `bash docs/api/verify-auth.sh` → **20 passed, 1 failed**; the single failure is a backend defect
> ([BUG-1](docs/api/backend-issues.md)), not a dashboard one. The dashboard boots on `:5173` and a
> proxied `/api/staff/login` returns `role: system_admin`.
>
> **Live testing corrected one of my own assumptions.** I had built 1.3 on the premise that
> `/admin/login` returns no role. It *does* return `role` and `role_label`, so the extra `/staff/me`
> round-trip was unnecessary — `authApi` now reads the payload directly and falls back to `/staff/me`
> only if the field is absent. The original bug was still real: the old code did
> `{ ...admin, role: 'system_admin' }`, overriding the server's value and mislabelling sycash.

### 1.1 Environment & base URL — ✅

- [x] `.env.example` documents `VITE_API_BASE_URL` and how to run the backend locally.
- [x] `vite.config.ts` proxy target moved off the dead `api.onwayride.me` to **`http://localhost:8080/api`** (the Docker stack), overridable per machine via `VITE_PROXY_TARGET`.
- [x] `src/services/api.ts` fallback baseURL updated from the stale `http://localhost/4th_year_project/public/api` to `http://localhost:8080/api`.
- [ ] ⚠️ **`vercel.json` still rewrites `/api/*` to `https://api.onwayride.me/api/*`** — deliberately left alone. It is a deployment decision, and there is no correct value to put there until Q10 is answered. Production builds will keep sending Bearer tokens to that unrelated service until it is changed.
- [ ] CORS (`localhost:5173`) is not needed while the proxy is used — tracked as Q9.

### 1.2 Role model — `sycash` added — ✅

- [x] `src/types/index.ts`: `StaffRole` now `'system_admin' | 'sycash' | 'admin' | 'support_agent'`.
- [x] `src/app/roles.ts`: rewritten with the middleware mapping spelled out. `sycash` gets the any-role `/staff/*` sections only — granting it `dashboard` would produce guaranteed 403s, since every `/admin/*` group is gated on `staff:admin,system_admin`, which excludes it. Recorded as Q8.
- [x] `src/features/staff/api/staffApi.ts` had a **second, drifted copy** of the `StaffRole` union — it now re-exports the canonical type from `src/types/index.ts`, so this cannot drift again. A `sycash` employee row would previously have rendered with an undefined badge class.
- [x] New `CreatableStaffRole` (`admin | support_agent`) + `CREATABLE_STAFF_ROLES`, mirroring `StaffRole::creatableRoles()`. The create-employee form no longer offers **`system_admin`**, which the API rejects with 422 "You are not permitted to assign this role".
- [x] Locales gained `roles.sycash` and `staff.roles.sycash` (en + ar).
- [x] `tests/app/roles.test.ts` pins the whole access matrix for all four roles.

### 1.3 Server is the source of truth for role — ✅ (verified live)

- [x] `authApi.login()` no longer hardcodes `role: 'system_admin'`. It uses `admin.role` from the `/admin/login` payload (**confirmed present against the running backend**), falling back to `GET /staff/me` only if absent. `/staff/login` uses its own response, so neither path costs an extra request.
- [x] Verified live: `/admin/login` and `/staff/login` tokens are interchangeable — an `/admin/login` token is accepted by `/staff/me` (200), confirming B1.
- [x] Verified live: **`sycash` really is 403'd by `/admin/dashboard`** while reaching `/staff/reviews` (200) — so `roles.ts` is right to withhold the admin sections from it. Q8 answered empirically.
- [x] Verified live: an invalid token returns `401 TOKEN_INVALID`, matching `AUTH_ERROR_CODES`.
- [x] Verified live: **refresh tokens rotate and are single-use.** Both `/staff/refresh` and `/admin/refresh` accept a token from either login, and replaying a consumed one gives `REFRESH_TOKEN_INVALID`. The client already stores the rotated token — but this creates a concurrency hazard, added to Phase 13.
- [x] `authApi.me(token?)` accepts an explicit token, and the axios request interceptor now lets a caller-supplied `Authorization` header win over the stored one — needed because the new token is not in `localStorage` yet at that point.
- [x] `AuthContext` refreshes the profile for **both** session kinds (was `kind === 'staff'` only).
- [x] A 403/404 from `/staff/me` now logs out instead of keeping a stale role.
- [x] Covered by `tests/auth/authApi.test.ts` (4 tests) and two new `AuthContext` tests.

### 1.4 Axios layer hardened — ✅

- [x] New `src/services/apiError.ts`: `extractApiError`, `getFieldErrors`, `getApiErrorCode`, `isTerminalAuthError`, `isForbiddenError`, and the `AUTH_ERROR_CODES` map.
- [x] **401 with a terminal code** (`ACCOUNT_INACTIVE`, `TOKEN_INVALIDATED`, `EMPLOYEE_NOT_FOUND`) skips the refresh attempt and ends the session immediately.
- [x] **403** is passed through untouched — no refresh, no redirect, session intact.
- [x] Logout redirects carry `?reason=<code>`, and Login renders an explanation instead of looking like a random logout.
- [x] `extractApiError` deliberately ignores axios's own `error.message` — a test proved it was surfacing "Request failed with status code 500" over the caller's domain message.
- [x] `getApiErrorMessage` kept as a deprecated alias so existing call sites still compile.
- [x] `tests/services/apiError.test.ts` (14 tests) + 3 new interceptor tests.

### 1.5 Mock action hook removed — ✅

- [x] `src/features/shared/useMockAction.ts` **deleted**; `MockFeedback` → `ActionFeedback`, now exported from `useApiAction`.
- [x] **Login**: removed the fake "reset link sent" and "support request submitted" actions — neither endpoint exists; they now explain the real process (a system admin resets employee passwords). Also removed the **"Use demo credentials"** button, which filled in `primary@admin.com` / `admin_password` — credentials from the old config-based auth that cannot work against the Employee-row login.
- [x] **Home**: removed the fake "Sync data" and "Open notices" buttons.
- [x] **Trips**: removed the "New trip" button, which fabricated a browser-only row via `addDraftTrip` (no admin create-ride endpoint exists); removed `addDraftTrip` from `useTrips`; removed the fake "history opened" and "details refreshed" toasts. The completed-trip row now offers real *view details* instead of the fake history button.
- [x] **Contact driver** turned real: live trips already carry `driver.communication_number`, so it is now a `tel:` link, disabled with a tooltip when no number is known.
- [x] `grep -r "useMockAction" src` → nothing.

### 1.6 Follow-ups created by this phase

- [ ] `e2e/smoke.spec.ts` now types credentials instead of clicking the removed demo button, and covers `sycash`. **The e2e suite has not been run** — it needs `npx playwright install` and a dev server.
- [ ] `tests/testServer.ts` still stubs `/staff/complaints/metrics` as a success. It is a confirmed-missing endpoint (C3); Phase 7 decides whether that handler becomes a 404.

---

## Phase 2 — Dashboard page — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND**

Endpoints: `GET /admin/dashboard` (BFF, server-cached 5 min) · `GET /admin/dashboard/growth?months=N`.

- [x] **Hardcoded `growth: '1.2%'` removed.** Deltas are computed from `growth_chart.data` (last vs previous bucket). A jump from 0 is reported as an absolute count (`+35`), not `+3500%`, and when there is no previous bucket the badge is **omitted** rather than faked.
- [x] **Period selector is real** — 3 / 6 / 12 months, refetching `GET /admin/dashboard/growth?months=N`. It replaces a button that only toggled its own label. Changing it refetches *only* the growth series, not the whole BFF payload.
- [x] **Refresh control** added, with "updated HH:MM · server-cached for up to 5 minutes" so an unchanged figure doesn't read as a bug.
- [x] **Extracted to `hooks/useDashboard.ts`** on the `useFetchEffect` pattern; `Dashboard.tsx` was the last page calling the API inline. Page split into `StatCards`, `GrowthChart`, `CityDistributionCard`, `RecentActivityTable`.
- [x] Loading skeletons (cards, chart, `TableSkeleton`), `ErrorBanner` with retry, and empty states for all three collections.
- [x] **Chart scaling bug fixed.** Bar heights were `value / 250` and `value / 850` — hardcoded divisors. With real data (`new_users: 35`, `completed_trips: 7`) that rendered a 14% bar and a 0.8% sliver. Heights are now a share of the tallest value in either series.
- [x] **City names now respect the locale.** The payload carries `city` (Arabic) and `city_en`; the page always showed English even though Arabic is the default language. Also shows the user count per city.
- [x] **Booking statuses are translated.** `confirmed` and `pending` were rendered raw and fell through the colour map to grey; all six statuses now have labels and colours in both languages.
- [x] **Dates are localised.** The backend builds `date.human` in English (`"Today, 09:33"`); the row now formats `date.raw` for the active locale.
- [x] Side stat cards link to `/support` and `/verifications`; the activity avatar placeholder is now real initials.
- [x] Raw hex values (`#000666`, `#212396`, `#006a6a`) replaced with palette tokens per the frontend conventions.
- [x] 10 new tests in `tests/hooks/useDashboard.test.ts` (**67 total, up from 57**).

### ⚠️ One planned item was dropped — the payload cannot support it

- [x] ~~Make the recent-activity rows link through (`user_id` → `/passengers/:id`)~~ — **not possible.**
      `AdminReportService::getRecentActivities()` returns only `user.name` and a masked
      `user.number` (`XXX-XXX-7214`); there is **no `user_id`** in the payload. Filed as a backend
      request ([REQ-1](docs/api/backend-issues.md)). No fake link was added.

### Verified

Against MySQL seeded with 35 users / 71 rides / 58 bookings: stats `35 / 48 / 14`, growth
`Jul: 7 trips → Aug: 7 trips, 35 new users`, six cities with Arabic + English names, and ten
booking rows across `confirmed` / `pending` / `cancelled`.

---

## Phase 3 — Trips — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-11**

Endpoints: `GET /admin/trips?filter&per_page&page` → `{data, meta{current_page,last_page,per_page,total,filter}, counts{all,scheduled,active,completed,cancelled,awaiting}}` · `GET /admin/trips/live` · `GET /admin/routes/popular?limit` · `GET /admin/drivers/top?limit` · `POST /staff/trips/{rideId}/cancel {reason ≥10 chars}` · `GET /staff/bookings?status&per_page&page` · `POST /staff/bookings/{bookingId}/cancel {reason ≥10 chars}`.

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **92 passing, up from 67**.
>
> **Verified end-to-end** by [`docs/api/verify-trips.mjs`](docs/api/verify-trips.mjs) — drives the real
> page in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **85 assertions, 0 failures** (`node docs/api/verify-trips.mjs --mutate`).

- [x] **Pagination fixed.** `useTrips` now owns `page` state and threads `meta.last_page`/`meta.total` through; `TablePagination` renders in the `TripsTable` footer with a "showing x–y of z" label. *Verified: the next-page control issues `page=2` and the rendered rows swap from `#TR-16` to `#TR-45`.*
- [x] **`page` resets to 1 on every filter change** (and on `per_page` change), mirroring `useSupport.setStatusFilter`. *Verified: after paging to 3, selecting `cancelled` requests `filter=cancelled&page=1`.*
- [x] **Tab badges come from `counts`.** *Verified: with 15 rows on screen the "all" badge reads **71**, cancelled **5**, awaiting **4** — matching the live payload, which client-side length could not produce.*
- [x] **`per_page` exposed** via a `PerPageSelect` (10/15/25/50, inside the backend's 1–50 rule; default 15).
- [x] **Live map polling confirmed and improved.** The 30 s poll was already wired through `useFetchEffect`; it now **pauses while the tab is hidden** and refetches immediately on re-show (implemented once in `useFetchEffect`, so every poller benefits). `useLiveTrips` exposes `updatedAt`, rendered as an "updated HH:MM" badge on the map.
- [x] **`awaiting` is now a first-class status.** `useTrips` used to remap `awaiting` → `scheduled`, which hid a real backend filter value and made the `counts.awaiting` badge unreachable. It is now its own tab, status badge and filter.
- [x] **Cancel actions match the backend's state rules.** `POST /staff/trips/{id}/cancel` only accepts `active|full|awaiting_confirmation` rides and `POST /staff/bookings/{id}/cancel` only `pending|confirmed` bookings — both 422 otherwise. The buttons are hidden for terminal rows instead of being shown and rejected (`isCancellableTrip` / `isCancellableBooking`, both unit-tested). *Verified: no cancel control renders on `no_show` rows.*
- [x] The two mock buttons were already resolved in Phase 1.5 — "new trip" removed, "contact driver" is a real `tel:` link off `driver.communication_number`.
- [x] 🆕 **Bookings tab shipped.** New `useBookings` hook + `BookingsTable`, with the six-value status filter, paging, `per_page`, a `tel:` link per passenger, and cancellation through `ConfirmActionModal` enforcing the 10-char reason. *Verified: a real booking was cancelled in each language — the row flipped to "Cancelled"/"ملغى" and `GET /staff/bookings?status=cancelled` confirmed it server-side.*
- [x] Loading skeletons (`TableSkeleton`), `ErrorBanner` with retry, and empty states on **both** tables.
- [x] i18n: every new key in `ar` **and** `en`. Arabic count-bearing keys carry all six CLDR forms (`_zero/_one/_two/_few/_many/_other`) — including the pre-existing `trips.live_now`, `current_trips`, `current_passengers`, `eta_value`, `distance_value` and `modal.reason_*`, which previously shipped a single ungrammatical form. *Verified: no raw key leaks in either language.*
- [x] New tests: `tests/hooks/useTrips.test.ts` rewritten (8 cases: paging, filter reset, `per_page`, no client-side filtering, refetch-after-cancel) and `tests/hooks/useBookings.test.ts` added (9 cases).

### ⚠️ One planned item was dropped — the payload cannot support it

- [x] ~~Badges on the Bookings filter tabs~~ — **not possible.** Unlike `/admin/trips`, `GET /staff/bookings`
      returns **no `counts` block**; `meta.total` only describes the requested status. Six badges would
      mean six requests. The tabs ship without badges and the gap is filed as
      [REQ-2](docs/api/backend-issues.md) with the one-line frontend change ready for when it lands.

### Notes for later phases

- `useFetchEffect` now pauses polling on `visibilitychange`. Any hook that passes a poll interval
  inherits this — no per-hook change needed.
- `TablePagination` gained `data-testid="pagination-prev|next"`, and the live map badge/timestamp
  carry testids, so verification scripts do not depend on CSS classes.
- Client-side re-filtering was **removed** from `useTrips` (`visibleTrips` is gone). Filtering is
  server-side; re-filtering a page would have blanked the table whenever a row's UI status did not
  literally equal the filter name. Phase 7's `useSupport.visibleComplaints` has the same latent bug.

**DoD:** ✅ paging through >1 page of trips works; ✅ tab badges match `counts`; ✅ a booking can be cancelled and the row updates.

---

## Phase 4 — Drivers — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-12**

Endpoints: `GET /admin/drivers/dashboard` (BFF: `admin_photo`, `stats`, `recent_activity`, `verification_efficiency`) · `GET /admin/drivers?filter&per_page&page&search` → `{data, meta{current_page,last_page,per_page,total,filter}}` (**no `counts`**) · `GET /admin/drivers/verification-efficiency?period=day|week|month` · `GET /admin/drivers/{id}/dashboard` · `POST /admin/users/{id}/ban {reason ≥10, type, expires_at?}` · `POST /admin/users/{id}/unban {admin_notes?}` · `GET /admin/users/{id}/status`.

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **121 passing, up from 92**.
>
> **Verified end-to-end** by [`docs/api/verify-drivers.mjs`](docs/api/verify-drivers.mjs) — drives the
> real pages in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **94 assertions read-only, 125 with `--mutate`, 0 failures.**

### Corrections to this plan's earlier Phase 4 text

Three items were listed as to-do but had already landed in Phase 3; two others were wrong:

- ~~"verify `page` is state-driven"~~ — it already was, and `meta.last_page`/`total` were already threaded.
- ~~"wire `search` with a ~300 ms debounce"~~ — already wired, at 400 ms.
- ~~"`driversApi.getVerificationEfficiency` needs adding"~~ — it already existed and accepted day|week|month.
- The endpoint list omitted that **`GET /admin/drivers` returns no `counts` block** — see the dropped item below.
- "show … who banned" is **not possible**: `ban.banned_by` is always `null` ([BUG-5](docs/api/backend-issues.md)).

### Done

- [x] **Hand-rolled pager replaced** with the shared `TablePagination` + a `PerPageSelect`. The list never sent `per_page` at all and rode on the backend's default of 10; it now sends it explicitly. *Verified: the next control issues `page=2` carrying `per_page`, and the rows swap from `#DR-10` to `#DR-3`.*
- [x] **`per_page` options are `5 / 10 / 25 / 50`** (default 10, inside the backend's 1–50 rule). 5 is deliberate: with ten seeded drivers, every option ≥10 collapses the list to a single page and makes the pager unreachable.
- [x] **Client-side re-filter removed** (`visibleDrivers` is gone) — same bug class as `useTrips` in Phase 3, and *not* hypothetical here: a banned driver still reports `status: "verified"` (BUG-6), so the old memo blanked the table on the `suspended` tab. *Verified: all 10 server-filtered rows render.*
- [x] **Filter tabs moved to the shared `FilterTabs`** — consistent `role="tab"` semantics, disabled during load, and badge-ready for when REQ-2 lands.
- [x] **Verification-efficiency period switch is real** — day/week/month refetching `GET /admin/drivers/verification-efficiency?period=N`, replacing a widget that could only ever show the week. *Verified: switching requests `period=month` and **does not** refetch the drivers list.*
- [x] **The efficiency delta is rendered from the payload**, not hardcoded — derived from `comparison.delta` + `current.processed/total_incoming/pending`. The backend's `comparison.text` and `previous.label` are **English-only** ("Same as last week"), so rendering them directly leaked English into the Arabic UI; they are now translated client-side from `comparison.delta`. *Verified in both languages.*
- [x] **Temporary bans work.** `useDriverDetails` sent `type: 'permanent'` unconditionally; the details page now opens `ConfirmActionModal` with `showBanOptions` and sends the real `type` + `expires_at`. *Verified with `--mutate`: a real temporary ban round-tripped in each language and the server confirmed `type: temporary` with an expiry.*
- [x] **Ban-state banner** on the details page, from `GET /admin/users/{id}/status` — previously defined in `usersApi` and never called. Fetched on load and refetched after every ban/unban. *Verified: the banner appears with the typed reason and expiry, and **survives a page reload**, proving it is server-sourced.*
- [x] The banner handles all three `status_code` values. **An unban lands on `0` (`logged_out`), not `1` (`active`)** — the backend forces a fresh login — so "not banned" is tested as `ban === null`, never as `account_status === 'active'`.
- [x] **Ban/unban actions are hidden-not-422'd**, per the Phase 3 pattern: `isBannedDriver()` drives ban-vs-unban off the authoritative status rather than the untrustworthy row status.
- [x] **Shared `<Avatar name photo />`** in `src/features/shared/components/`, with an `initialsOf` helper in `src/features/shared/initials.ts`. **All seven `i.pravatar.cc` fallbacks and the hardcoded Unsplash portrait in `MainLayout` are gone** (`useDrivers`, `useDriverDetails`, `useUsers`, `useUserDetails`, `useStaff`, `useSupport`, `MainLayout`). `grep -r "pravatar\|unsplash" src` → nothing. It also degrades to initials when a photo URL fails, which the seed makes routine ([BUG-7](docs/api/backend-issues.md)). *Verified: the broken seeded photo renders as "DT".*
- [x] **`driversApi.getDriverProfile` deleted**, along with `ENDPOINTS.DRIVERS.PROFILE`. `GET /admin/drivers/{id}/profile` is a strict subset of `{id}/dashboard` for everything the page renders — it lacks `price_per_seat`, earnings, `cancel_rate` and `favorite_destination`, and adds only `bookings_count`, which nothing displays. A comment records why at both sites.
- [x] **`DriverStatus` widened to the five values the backend actually returns.** `resolveDriverStatus()` can return `rejected` and `unverified`; the union claimed three, so such a row fell through the badge map and rendered a **raw i18n key**. Both now have labels in `ar` and `en`.
- [x] Loading skeletons, `ErrorBanner` with retry, and empty states (including a distinct "no drivers match X" for a search miss). Both hooks moved to `extractApiError` so a 422/500 reads as its real message.
- [x] Dates on the details page were pinned to `'ar-SY'` regardless of language; they now follow the active locale.
- [x] i18n: every new key in `ar` **and** `en`. Arabic count-bearing keys carry all six CLDR forms — including the pre-existing `drivers.completed_rides`, `cancelled_rides` and `visit_count`, which shipped a single ungrammatical form. 11 dead keys removed. *Verified: no raw key leaks in either language, on either page.*
- [x] New tests: `tests/hooks/useDrivers.test.ts` (14 cases), `tests/hooks/useDriverDetails.test.ts` (7), `tests/components/Avatar.test.tsx` (8).
- [x] **Fixed a latent test-infra bug:** `globals` is off in `vitest.config.ts`, so RTL's auto-cleanup never registered and rendered trees leaked between tests. `cleanup()` now runs in `tests/setup.ts`.

### ⚠️ Two planned items were dropped — the payload cannot support them

- [x] ~~Badges on the driver filter tabs~~ — **not possible.** `GET /admin/drivers` returns **no `counts` block**; `meta.total` describes only the requested filter, so four badges would mean four requests. Filed by **extending [REQ-2](docs/api/backend-issues.md)** (now covering both `/staff/bookings` and `/admin/drivers`) rather than inventing per-status requests. The `suspended` badge is additionally blocked on BUG-6.
- [x] ~~Show **who** banned a user in the banner~~ — **not possible.** `AdminBanController` writes `banned_by` from `$request->user()?->id`, which is always `null` under `StaffJwtMiddleware` — the same root cause as the `admin_photo` bug. Verified live: a real ban returned `"banned_by": null`. The banner omits the row rather than printing "Unknown". Filed as an extension of [BUG-5](docs/api/backend-issues.md).

### 🔴 New backend defect found and filed

- [x] **[BUG-6](docs/api/backend-issues.md) — the drivers list reports ban state backwards.** `resolveDriverStatus()` only tests `status == 0`, so a **banned** driver (`-1`) is reported as `verified` and is absent from `filter=suspended`; after an **unban** (`status = 0`) the same driver reads as `suspended`. Verified live in both directions. Consequence: no truthful ban signal exists in the list payload, so the page does not fake one — it renders a "banned" chip only for rows whose authoritative status it actually holds (from the ban/unban response), and drives the details page from `/admin/users/{id}/status`.
- [x] **[BUG-7](docs/api/backend-issues.md)** — seeded `/storage/...` URLs 404 (no files written, no `storage:link`). Cosmetic here thanks to the Avatar fallback, but it means **the verification document viewer has nothing to show** — relevant to Phase 6.

**DoD:** ✅ a temporary ban with an expiry round-trips and the status banner reflects it after reload; ✅ paging through >1 page of drivers works; ✅ the period switch refetches only its own widget.

---

## Phase 5 — Passengers (Users) — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-12**

Endpoints: `GET /admin/users?type&status&date&per_page&page&search` → `{data:{admin_photo, stats, users, meta{…,filters{type,status,date}}}}` (**no `counts`**, everything nested under `data`) · `GET /admin/passengers/{id}/full-profile` · `/stats` · `/monthly-trips?months` · `/recent-trips?limit` · `/complaints?status&per_page&page` (**does** carry `counts`) · `/wallet-charges?per_page&page` · `POST /admin/passengers/{id}/charge-wallet {amount 1–10 000 000, admin_notes? ≤500}` → `{status, message, new_balance}` · `POST /admin/users/{id}/ban|unban` · `GET /admin/users/{id}/status`.

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **145 passing, up from 121**.
>
> **Verified end-to-end** by [`docs/api/verify-users.mjs`](docs/api/verify-users.mjs) — drives the real
> pages in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **137 assertions read-only, 185 with `--mutate`, 0 failures.** `verify-drivers.mjs` was re-run
> afterwards (**94/94**) to prove the shared-component move did not regress Phase 4.

### Done

- [x] **All four filters are wired.** `type` (select), `status` (shared `FilterTabs`), **`date`** (select: `all|last_30_days|last_3_months|last_6_months|last_12_months`) and debounced `search`. `date` was typed in `UsersListParams` since Phase 0 but had **no UI at all**. *Verified: each change issues the matching query param and resets `page=1`.*
- [x] **`per_page` is sent explicitly** (options 5/10/25/50, default 10 — the backend's own default, which the list used to ride on implicitly) with the shared `PerPageSelect`, and the hand-rolled pager was replaced by `TablePagination`. With 35 seeded users the default already spans 4 pages. *Verified: next requests `page=2` carrying `per_page`, the rows swap, and `per_page=5` renders exactly 5 rows.*
- [x] **`useUsers` had no client-side re-filter** — audited, confirmed absent, and a comment now records why one must not be added (the `visibleTrips`/`visibleDrivers` bug class). A test asserts every server-returned row renders. **The passenger *details* page did have one**: complaints were filtered in a `useMemo` over the BFF's 20-row snapshot. That memo is gone; the complaints tabs now drive `GET /admin/passengers/{id}/complaints?status=` and render its `counts`.
- [x] **Temporary bans + the status banner.** The details page previously sent `type: 'permanent'` unconditionally and had no banner; it now opens `ConfirmActionModal` with `showBanOptions` and renders the promoted `BanStatusBanner`. *Verified with `--mutate`: a real temporary ban round-tripped in each language, the server confirmed `type: temporary` with an expiry, and the banner **survived a page reload**.*
- [x] **`BanStatusBanner` promoted** from `features/drivers/components/` to `features/shared/components/`, with its i18n keys moved `drivers.*` → `common.*` in both locales. Both details pages use the one component; `verify-drivers.mjs` was updated to read the new key path and still passes.
- [x] **Ban/unban actions are hidden-not-422'd**, driven by the authoritative `GET /admin/users/{id}/status`, never by the row status.
- [x] **Charge wallet rebuilt.** Amount rules are mirrored from `PassengerProfileController` (`numeric|min:1|max:10000000`) and **disable** the confirm button instead of submitting and 422'ing; an optional `admin_notes` field enforces the 500-char cap; a real 422 is surfaced per field via `getFieldErrors`. The confirmation shows **previous → new balance and the transaction id**, and the profile is refetched so the balance card updates without a reload. *Verified with `--mutate`: two real charges, one per language, each confirmed against the server's own figures.*
- [x] 🆕 **Per-section refresh shipped** for all five previously-unused endpoints (`stats`, `monthly-trips`, `recent-trips`, `complaints`, `wallet-charges`), plus a months window (3/6/12), a trip-limit selector (5/10/25) and the server-side complaint filter. *Verified: each control calls its own endpoint and **none of them refetches the `full-profile` BFF**.*
- [x] **Five row statuses, not three.** `resolveUserStatus()` also returns `rejected` and `unverified` — both present in the seed — which fell through the badge map and rendered a **raw i18n key**. `UserRowStatus` was widened and all five have labels in `ar` and `en`.
- [x] **`admin_photo` is null (BUG-5)** — rendered through the shared `<Avatar>` fallback in the page header rather than patched around, so it lights up on its own once the backend is fixed. *Verified: `admin_photo === null` on every response.*
- [x] Loading skeletons (list + a details-page skeleton replacing the "جاري التحميل..." text), `ErrorBanner` with retry carrying the **real** message via `extractApiError` (both hooks moved to `error: string | null`, matching `useDashboard` and the drivers hooks), and distinct empty states for trips, complaints, wallet charges and a search miss.
- [x] Dates on the details page were pinned to `'ar-SY'`; they now follow the active locale.
- [x] i18n: every new key in `ar` **and** `en`, with all six CLDR forms for the four count-bearing ones (`months_window`, `charge_amount_min`, `charge_amount_max`, `charge_notes_max`). **16 dead keys removed** — including `users.pagination_info`, which took `{{total}}` with a single ungrammatical Arabic form and is replaced by the plural-correct shared `common.showing_range`. *Verified: no raw key leaks in either language, on either page.*
- [x] New tests: `tests/hooks/useUsers.test.ts` rewritten (13 cases) and `tests/hooks/useUserDetails.test.ts` added (16 cases), covering the date filter, the temporary-ban payload, the charge-wallet response shape and all five section refreshes.

### ⚠️ Three planned items could not be done as written — the payload cannot support them

- [x] ~~Badges on the user filter tabs~~ — **not possible.** `GET /admin/users` returns **no `counts` block** (verified live) and `meta.total` describes only the requested filter. Filed by **extending [REQ-2](docs/api/backend-issues.md) a second time** (now `/staff/bookings`, `/admin/drivers` and `/admin/users`). The `suspended` badge is additionally blocked on BUG-6.
- [x] ~~Show `previous_balance` and `transaction_id` **from the charge response**~~ — **not possible.** `POST /admin/passengers/{id}/charge-wallet` returns **only** `{status, message, new_balance}`; the richer shape the plan assumed belongs to the unrelated `POST /admin/wallet/charge` (Phase 9). Rather than computing a "previous balance" client-side and presenting it as server truth, the hook reads the transaction back from `GET /admin/passengers/{id}/wallet-charges` and reports `null` for both fields if the read-back does not line up. Filed as **[REQ-3](docs/api/backend-issues.md)**.
- [x] ~~Show **who** processed each wallet charge~~ — **not possible.** `chargeWallet()` writes `'user_id' => $request->user()?->id`, always null under `StaffJwtMiddleware`, so `processed_by_name` is null for every row — the same root cause as `admin_photo` and `banned_by`. The column now renders the balance movement (`previous → new`) instead of "Unknown" on every row. Filed as a third site under [BUG-5](docs/api/backend-issues.md).

### 🔴 Backend defect confirmed on a second endpoint

- [x] **[BUG-6](docs/api/backend-issues.md) also affects `GET /admin/users`** — same code shape, verified live on **passenger id 30** and again on id 18 by `verify-users.mjs --mutate`: a **banned** user (`status = -1`) still reports `"verified"` and is absent from `status=suspended`; after an **unban** (`status = 0`) the same user reports `"suspended"` and `stats.suspended_users` counts it. The row payload carries no `ban`/`is_banned` field at all. The page therefore never optimistically flips a row status, renders a "banned" chip only for rows it holds authoritative status for, and drives the details page from `/admin/users/{id}/status`. The KPI card is labelled "signed-out accounts", which is what that number actually counts.

### Note on the `date` filter and this seed

Every seeded user was created on the same day, so **all five date windows return the same 35 rows**.
The filter is verified by the param reaching the API, by `meta.filters.date` echoing it, and by
`date=bogus` returning 422 — not by a differing row count. `verify-users.mjs` prints this as a NOTE
so a future reader does not mistake it for an untested path.

### Seed state after this phase

`--mutate` was run in both languages (4 bans/unbans on passengers 18 and 30, 5 wallet charges of 25).
**All of it was rolled back in SQL** — `users.status` restored to 1, both wallet balances restored,
all five `ADM-*` transactions deleted, `cache:clear` run — and `verify-drivers.mjs` re-run at 94/94 to
confirm the driver seed is still pristine. A wallet charge is **not** reversible through the API; the
script says so and prints the delta rather than implying it cleaned up after itself.

**DoD:** ✅ every filter reaches the server and changes the request (row count where the seed permits); ✅ a wallet charge updates the balance without a full page reload; ✅ a temporary ban round-trips and the banner survives a reload.

---

## Phase 6 — Verifications — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-12**

Endpoints: `GET /staff/verifications/pending` → `{status, total, data[{user_id,name,email,gender,address,type,profile_photo,documents[],submitted_at}]}` (**no query params, never paginated, server-cached 2 min**) · `POST /staff/verifications/{userId}/approve {national_id}` (**required**, `max:50`, unique) · `POST /staff/verifications/{userId}/reject {reason?}` (`nullable|string|max:500`, **no minimum**).

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **156 passing, up from 145**.
>
> **Verified end-to-end** by [`docs/api/verify-verifications.mjs`](docs/api/verify-verifications.mjs) —
> drives the real page in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **59 assertions read-only, 67 with `--mutate`, 0 failures.** `verify-drivers.mjs` (94/94) and
> `verify-users.mjs` (137/137) were re-run afterwards, since this phase touched the shared
> `ConfirmActionModal`.

### Two open questions answered by reading the controller, then confirmed live

- **Q7 — does approve require `national_id`? YES.** `national_id => required|string|max:50`, plus a
  uniqueness pre-check that 422s with `conflicting_user_id` if the number belongs to another account.
  Verified live: an empty body returns `422 errors.national_id`. Recorded in
  [`decisions.md`](docs/api/decisions.md).
- **Reject's `reason` has NO minimum length.** It is `nullable|string|max:500` — the 10-char rule that
  ban, trip-cancel, booking-cancel and escalate share **does not apply here**. Proven, not assumed:
  `--mutate` rejects with a 4-character reason and the server accepts it.

### Done

- [x] **Reject reason is real.** `useVerifications.ts:114` used to call `rejectVerification(userId)`
      with no reason at all. It now goes through `ConfirmActionModal` with `minReasonLength={1}` and a
      new `maxReasonLength={500}` mirroring the server's cap (with a live character counter). Required
      client-side as a product decision — the text is forwarded verbatim into the user's notification,
      and an empty one tells them nothing. *Verified: confirming with an empty reason is blocked
      **before** any request is sent, and a real rejection wrote
      `تم رفض طلب توثيق حسابك. السبب: مكرر` into the user's notification.*
- [x] **Approve collects the required `national_id`** through a new `ApproveVerificationModal`
      (deliberately not `ConfirmActionModal`, which collects a min-length free-text *reason* — the
      wrong control for a unique, stored, collidable identifier). Confirm is **disabled** until the
      field is non-empty rather than submitting and 422'ing, and the field carries the server's
      `maxlength=50`. *Verified: the body is exactly `{"national_id":"…"}` and the success banner
      reports the value the **server** echoed back, not the value typed.*
- [x] **`total` comes from the server**, not `requests.length`, and is rendered twice: as the KPI
      figure and as a plural-correct header label. A unit test pins the two apart so a future refactor
      cannot quietly substitute the row count. *Verified: the header reads "2 requests awaiting review"
      / "طلبان بانتظار المراجعة", both read out of the locale JSON by the script.*
- [x] **Real empty states, three of them:** the generic "no pending verifications", a distinct
      "no pending requests of type X" for a filter miss, and "no documents attached" on a request that
      submitted none. *Verified against a genuinely empty server response — `--mutate` drains the
      two-row queue, and the empty state plus the Arabic `_zero` plural form render.*
- [x] **Optimistic removal, then reconcile.** Both mutations await the API (so a 422 leaves the row
      exactly where it is), drop the row and decrement `total` locally, then re-read the list without
      flipping the loading flag. **Checked the cache first, as instructed:** unlike `/admin/dashboard`,
      this endpoint *is* cached — `Cache::remember('staff.pending-verifications', 2 min)` — but approve
      and reject both `Cache::forget` it, so the reconcile is guaranteed fresh. That is the only reason
      the pattern is safe here, and it is commented at the call site. The 2-minute TTL still applies to
      *new* submissions, so the header carries an "updated HH:MM · server-cached for up to 2 minutes"
      note next to a real refresh button. *Verified: the reconciled total matches the server's, and the
      post-mutation GET already omits the mutated user.*
- [x] **Document viewer: all four types verified against real data.** The seed made this impossible as
      shipped (see below), so four `photos` rows were seeded deliberately for user 31 — `face_id`,
      `back_id`, `license`, `mechanic_card` — the run recorded, and the rows deleted again. All four
      tiles render with the shared `common.documents.*` labels and their own icons, sorted into the
      enum's canonical order.
- [x] **A broken document degrades visibly, which BUG-7 makes the normal case.** Each tile that fails
      to load replaces its `<img>` with an "unavailable" panel — so no browser broken-image glyph can
      appear inside a review tool — while still offering the raw link, because opening it directly is
      how a reviewer confirms the file is genuinely missing. The fullscreen preview degrades the same
      way. *Verified: with the four seeded documents, all four URLs failed
      (`net::ERR_BLOCKED_BY_ORB`), all four tiles flipped, and **zero `<img>` elements remained**.*
- [x] **Client-side re-filter audited — kept, with the reason recorded.** `visibleRequests` is *not*
      the `visibleTrips`/`visibleDrivers`/`visibleComplaints` bug class removed in Phases 3–5. Those
      re-filtered an already server-filtered page on a *derived UI status*, blanking rows the server had
      deliberately returned. `GET /staff/verifications/pending` accepts **no query parameters** and
      returns the entire queue unpaginated, so a client filter is the only one possible, and it compares
      against `type` exactly as the server emitted it. Both the hook comment and a unit test record
      this. For the same reason the driver/passenger **counts are exact rather than estimates**, so the
      filter tabs (now the shared `FilterTabs`) carry real badges — the first list in the project that
      can. *Verified: switching tabs issues **no** new request, and the driver tab shows exactly the
      rows the payload types as drivers.*
- [x] **`ENDPOINTS.VERIFICATIONS` deleted**, following the Phase 4 precedent for `DRIVERS.PROFILE`. Its
      three `/admin/verifications*` routes are `system_admin`-only twins of the `/staff/*` routes with a
      strictly thinner payload — no `total`, no `gender`/`address`/`profile_photo` — while the staff
      routes serve `admin` **and** `system_admin`. A comment at the deletion site records why, and the
      script asserts the thinness so the justification stays true. *Verified live: the twin returns
      `{status,data}` with rows of `user_id,name,email,type,documents,submitted_at` only.*
- [x] **Hook rewritten to the house pattern:** `error` is now `string | null` via `extractApiError`
      (it was `Error | null`, and the message was going to `console.error` instead of the user),
      `ErrorBanner` with retry replaced a bare `common.load_failed` div, and a list-shaped loading
      skeleton replaced the "Loading..." text. Dates were pinned to `'ar-SY'` regardless of language and
      now follow the active locale. The `.charAt(0)` initials circles are now the shared `<Avatar>`, so
      the (broken) seeded profile photo degrades the same way it does everywhere else.
- [x] **The richer staff payload is now actually used:** `gender` and `address` were typed since Phase 0
      and rendered nowhere; the detail header shows both.
- [x] i18n: every new key in `ar` **and** `en`, with all six CLDR forms for the three count-bearing ones
      (`pending_total`, `national_id_max`, and the pre-existing **`documents_title`**, which shipped a
      single ungrammatical Arabic form — the count-key audit this phase was asked for; Phase 4 found
      three in `drivers`, Phase 5 one in `users`). The duplicate `verifications.doc.*` block was deleted
      in favour of the shared `common.documents.*` already used by `DriverDetails`, so the four document
      types have one vocabulary. *Verified: no raw i18n key leaks in either language.*
- [x] New tests: `tests/hooks/useVerifications.test.ts` (11 cases) covering the reject payload with and
      without a reason, the approve payload, optimistic removal + reconcile, the row surviving a failed
      mutation, server `total` vs row count, and the type filter not dropping server rows.

### ⚠️ One planned item was dropped — the payload cannot support it

- [x] ~~Pre-fill the approve `national_id` from the submitted ID document~~ — **not possible.** The
      pending payload has no `national_id` field, and correctly so: `User::$fillable` marks the column
      *"set by admin/system_admin during verification approval only"*, and this endpoint is what first
      writes it. The number exists only as pixels inside the `face_id`/`back_id` images — which, thanks
      to BUG-7, do not load at all. **No pre-fill was faked.** The dialog instead names the ID documents
      actually attached and says explicitly when none were. Filed as
      **[REQ-4](docs/api/backend-issues.md)**, requesting the number be captured at submission time.

### Cross-page consistency (asked for, and verified)

An approval writes `verification_status = 'approved'` (**not** `'verified'`) and
`is_verified_passenger = true`. `AdminUserService::resolveUserStatus()` checks the `is_verified_*`
flags **before** `verification_status`, so **the Users page does reflect it**: the row flips
`pending → verified`. A rejection sets `verification_status = 'rejected'` with both flags false, and the
row reads `rejected` — a status Phase 5 had already widened `UserRowStatus` to carry. Both directions
are asserted by `verify-verifications.mjs --mutate` against `GET /admin/users`. No dashboard change was
needed; the KPI `verification_requests` count on the dashboard is `verification_status = 'pending'`, so
it follows automatically.

### Seed reality, and what was done about it

Probed before building: `total: 2`, users **31** and **33**, both `type: passenger`, both with
`documents: []`. The document viewer therefore had **nothing to render** even before BUG-7 — so it was
not verifiable as shipped, and this is stated rather than glossed. Four `photos` rows were inserted for
user 31, the read-only run recorded at **59/59** with all four tiles asserted, and the rows deleted
again. Filed as [BUG-7b](docs/api/backend-issues.md): with the files missing, a verification decision
has to be made with no visible evidence at all — the highest-impact consequence of BUG-7 so far.

**The driver branch of `approveVerification` was not exercised**, deliberately: the seed has no pending
driver, and `VerificationRepository::verifyDriver()` additionally writes a 3-star `UserRating` row,
which is residue in a table Phase 8 (Reviews) will read. Only `verifyPassenger` was run for real.

### Seed state after this phase

`--mutate` rejected user **33** (in `en`) and approved user **31** (in `ar`) — with only two pending
rows, exercising both actions consumes the whole queue, which is what made the real empty state
verifiable. **Neither is reversible through the API**: there is no un-approve and no un-reject endpoint,
and the script says so and prints the SQL rather than implying it cleaned up after itself. All of it was
rolled back in SQL — `verification_status` back to `pending`, both `is_verified_*` back to 0,
`national_id` back to `NULL`, the four seeded `photos` rows and the `verification_rejected` notification
deleted — followed by `cache:clear`. Confirmed afterwards: the queue is again `total: 2`, users 31 and
33, both `passenger`, both `documents: []`.

**DoD:** ✅ rejecting requires a reason and the reason reaches the user's notification; ✅ the row
disappears and `total` decrements, then reconciles to the server's figure; ✅ approve sends the required
`national_id` and the Users page reflects the result.

---

## Phase 7 — Support / Complaints

Endpoints: `GET /staff/complaints?status&type&date&user_id&per_page&page` → `{data, meta, counts}` · `GET /staff/complaints/{id}` (⚠️ **side effect: a `pending` complaint auto-transitions to `in_review` and is assigned to you**) · `PATCH /staff/complaints/{id}/respond {resolution_notes ≥10, status}` · `PATCH /staff/complaints/{id}/escalate {reason ≥10}` · `GET /staff/escalated-complaints?status&per_page` · `PATCH /staff/escalated-complaints/{id}/resolve {resolution_notes, status}`.

- [ ] **`SupportStats` is broken** — it calls `GET /staff/complaints/metrics`, which does not exist and collides with the `{id}` route. Per the Phase 0 decision, either:
      - **(a)** backend adds the endpoint (registered *before* the `{id}` route) → keep the component as-is; or
      - **(b)** derive what you can client-side from `counts` (`all/pending/in_review/resolved/closed`) and the escalated `counts`, and **remove** the cards that cannot be derived (avg response time). Do not leave a card silently showing a dash because of a 404.
- [ ] Make the auto-transition side effect visible: opening a pending complaint changes its status and assignment. Refetch `counts` after `show()` (the backend already busts its `staff.complaint-counts` cache) and tell the user "assigned to you".
- [ ] Wire the `type` filter (8 enum values in `StaffComplaintController::index`) and the `date` filter (`last_7_days|last_30_days`) — both accepted, neither exposed.
- [ ] Note in code that `status` accepts only `pending|in_review|resolved|closed` in `index` — **`escalated` is not a valid filter value** there; escalated complaints live behind the separate view. Guard the client so the `escalated` tab never hits `index` with that value (it would 422).
- [ ] If Phase 0 confirms `open`/`resolve`/`close`/`notes` exist on the deployed API, add them: explicit open, direct resolve/close, and an internal notes thread on `ComplaintDetails`.
- [ ] Attachments: `ComplaintResponse.attachments` is typed but check it renders (images inline, other mime types as download links).

**DoD:** the KPI row shows only real numbers; type and date filters work; no request ever 422s from a bad filter combination.

---

## Phase 8 — Reviews

Endpoints: `GET /staff/reviews?user_id&search&date&per_page&page` · `DELETE /staff/reviews/{commentId}`.

- [ ] Wire `search` (debounced) and the `date` filter (`last_7_days|last_30_days` — those two values only; anything else 422s).
- [ ] Confirm `TablePagination` is wired to `meta.last_page`.
- [ ] Deletion is a moderation action — require confirmation and show the commenter/recipient in the dialog.
- [ ] Support deep-linking `?user_id=` so a profile page can jump to "reviews about this user".

**DoD:** search + date + paging all round-trip to the server (not client-side filtering).

---

## Phase 9 — Reports & Wallet (system_admin only)

Endpoints: `GET /admin/reports?start_date&end_date` · `GET /admin/export/pdf` · `GET /admin/wallets` · `GET /admin/wallet` · `GET /admin/wallet/{walletId}/transactions` · `POST /admin/wallet/charge {phone_number, amount}` · `GET /admin/wallet/requests?status&type&page&per_page` · `POST /admin/wallet/requests/{id}/approve|reject {admin_notes?}`.

- [ ] **Date range.** `reportsApi` accepts `start_date`/`end_date` but `useReports.fetchAll()` calls `generateFinancialReport()` with no arguments. Add a range picker and thread it through both the report and the PDF export.
- [ ] 🆕 **Admin wallet card** — `GET /admin/wallet` returns the current admin's wallet (`wallet_number`, `phone_number`, formatted `balance`, `admin_type`). Nothing renders it. Add it to the Reports header.
- [ ] 🆕 **Wallet transactions drawer** — `walletApi.getWalletTransactions()` exists and is never called. Clicking a wallet in `ManagementSidebar` should open `GET /admin/wallet/{id}/transactions` (paginated: `{current_page, data, per_page, total}`).
- [ ] Wallet requests: expose the `type` filter (`charge|withdraw`) alongside the existing status filter, and let the admin type `admin_notes` when approving/rejecting — the API accepts it, the UI always sends nothing.
- [ ] `chargeUserWallet` returns `{previous_balance, new_balance, transaction_id}` — show all three in the confirmation, and refetch `getAllWallets()` afterwards.
- [ ] PDF export: handle a non-blob error response (Laravel returns JSON on failure even with `responseType:'blob'` — parse and surface it instead of downloading a corrupt file).
- [ ] Reports is `staff:system_admin`-gated; a `sycash` or `admin` user hitting it gets 403 `FORBIDDEN`. Make sure `RoleRoute` blocks before the request fires (it does today — keep it in sync if `sycash` gains access).

**DoD:** a date range changes both the on-screen report and the exported PDF; wallet transactions open from the sidebar.

---

## Phase 10 — Staff / Employees (system_admin only) — 🔴 **BLOCKED ON THE BACKEND**

> **All six `/employees` endpoints return 500.** `EmployeeManagementController` calls
> `list()`, `formatEmployee()` and `resetPassword()`, none of which exist on
> `EmployeeManagementService` (which defines `getAll()`, `rotatePassword()`, and no formatter at
> all). The Staff page cannot work at any level until this is fixed —
> [BUG-1](docs/api/backend-issues.md).
>
> Also: `POST /employees` **writes the row and then 500s**, so a "failed" creation actually
> succeeded and the retry hits 409 (BUG-2). And `EmployeeManagementService::delete()` is fully
> implemented but has **no route**, which suggests Q4's answer is "forgotten", not "deliberate"
> (BUG-4).
>
> The frontend work below can still be written; it just cannot be verified yet.

Endpoints: `GET /employees` · `POST /employees` · `GET /employees/{id}` · `PUT /employees/{id}` · `PATCH /employees/{id}/toggle-active` · `PATCH /employees/{id}/reset-password {new_password ≥8}`.

- [ ] **Remove `deleteEmployee`.** There is no `DELETE /employees/{id}`. Replace the delete button with *Deactivate* (`toggle-active`) — which is what the backend intends — and drop `staffApi.deleteEmployee` + `useStaff.deleteEmployee`.
- [ ] Restrict the create-role dropdown to `admin` and `support_agent`. The backend derives allowed roles from `creatableRoles()` and 422s on anything else; `system_admin` and `sycash` are `isRestricted()` and can never be created.
- [ ] Surface the real error codes: **403** `DomainException` (not permitted to manage this employee), **409** `RuntimeException` (username/email already taken), **422** validation. `username` is `alpha_dash|min:3|max:50`; `password` is `min:8`; `email` is nullable.
- [ ] Wire edit → `PUT /employees/{id}` (`first_name`, `last_name`, `email`) if the UI doesn't already.
- [ ] Show `created_by` and `last_login_at` — both are in `EmployeeResponse` and useful for an admin audit view.
- [ ] Replace the `i.pravatar.cc` avatar (`useStaff.ts:40`) with initials.
- [ ] **Broadcast alert modal** — per the Phase 0 decision: build against the real endpoint if it exists, otherwise hide the button behind a feature flag rather than shipping a control that 404s.

**DoD:** creating, editing, deactivating, and password-resetting an employee all work; no button maps to a missing route.

---

## Phase 11 — Settings

`GET/POST /admin/settings` does not exist. This whole page (`PlatformConfig`, `PaymentSettings`, `ModerationRules`, `NotificationRules`) is built on it.

Pick one based on Phase 0 §0.3(1):

- **(a) Backend will build it** — keep `settingsApi` as-is, add optimistic save + dirty-state guard + per-field 422 handling, and gate the page behind a feature flag until the endpoint ships.
- **(b) Backend will not build it** — remove the page, its route, and its nav entry. Preserve only what is genuinely client-side (language/RTL toggle, which `i18n.ts` already owns) and move it into a small profile menu.
- **(c) Interim** — keep the page mounted but replace the failing fetch with a clearly-labelled read-only "not yet available" state. **Never** leave a Save button that silently 404s.

- [ ] Whichever path: `src/app/roles.ts` currently comments that settings is backed by `/admin/settings`. Fix or delete that comment.

**DoD:** no user-visible control on this page produces a request to a non-existent route.

---

## Phase 12 — Shell: Home, layout, notifications

- [ ] **Home** (`home/pages/Home.tsx`) — the two buttons ("Live data sync", "Notice center") are pure mocks. Either delete them or redirect `/` to `defaultRouteForRole(role)`, which for `system_admin` is `/dashboard`. Simplest correct answer: make `/` a redirect and delete the page.
- [ ] **Header search** (`MainLayout.tsx:119`) — currently inert. Either wire it to a cross-entity search (users + drivers + trips share a `search` param) or remove it. An inert search box reads as broken.
- [ ] **Admin avatar** (`MainLayout.tsx:150`) — hardcoded Unsplash URL. Use the logged-in employee, and wire `POST /admin/photo` (multipart) for upload.
- [ ] Show the real name + role label from `AuthContext` in the header dropdown.
- [ ] Logout must call `POST /staff/logout` (or `/admin/logout`) so `StaffJwtService::revokeAllTokens` runs server-side — `authApi.logout` does this; confirm the UI calls it rather than only clearing localStorage.

**DoD:** nothing in the shell is a placeholder; logout invalidates the token server-side (a stored token stops working after logout).

---

## Phase 13 — Cross-cutting hardening

Apply uniformly across every page touched above:

- [ ] **Loading** — `TableSkeleton` for tables, spinners for cards. No layout shift on load.
- [ ] **Errors** — `ErrorBanner` with a Retry that calls the hook's `refetch`. Use the shared `extractApiError` from 1.4 so 422 field errors read as field errors, not "Request failed with status code 422".
- [ ] **Empty states** — every table needs one; several currently render an empty `<tbody>`.
- [ ] **Pagination** — `TablePagination` on every list backed by `meta` (✅ trips + bookings in Phase 3, ✅ drivers in Phase 4, ✅ users in Phase 5; audit reviews, complaints, wallet requests).
- [ ] **Concurrency** — an in-flight request must be cancelled/ignored when filters change (a stale response currently overwrites fresh state in the `useFetchEffect` hooks). Use an `AbortController` or a request-sequence guard.
- [ ] **Single-flight token refresh** — refresh tokens are single-use and rotate (verified live). If two requests 401 at the same time, both call `/refresh`; the second replays a consumed token and the user is logged out. The interceptor needs to share one in-flight refresh promise across all queued requests. Pages that fire several parallel fetches on mount (Dashboard, Reports, Trips) make this easy to hit.
- [ ] **403 handling** — `RoleRoute` blocks navigation, but a role change mid-session can still produce a 403. Show the "no permission" panel instead of an error banner.
- [ ] **i18n** — every new string goes in both `src/locales/en/translation.json` and `src/locales/ar/translation.json`. Check RTL for new tables/modals.
- [ ] **Dates** — several hooks call `toLocaleDateString('ar-SY')` unconditionally. Format by active locale.
- [x] ~~**Avatars** — one shared `<Avatar name photo />` with initials fallback; remove all `i.pravatar.cc` and Unsplash URLs.~~ ✅ done in Phase 4.

---

## Phase 14 — Tests

Existing: `tests/{auth,hooks,services}` (vitest + msw), `e2e/smoke.spec.ts` + `e2e/apiStubs.ts` (Playwright).

- [ ] Update `tests/testServer.ts` msw handlers to the confirmed contract — including the removed endpoints, so a regression that re-introduces `/admin/settings` fails loudly.
- [ ] `tests/services/api.test.ts` — the three refresh/403 cases from 1.4.
- [ ] `tests/auth/AuthContext.test.tsx` — role comes from `/staff/me`, not from the login response; `sycash` renders correctly.
- [x] ~~`useTrips` (paging)~~ ✅ done in Phase 3 (`tests/hooks/useTrips.test.ts`, `useBookings.test.ts`); ✅ `useDrivers` / `useDriverDetails` / `Avatar` in Phase 4; ✅ `useUsers` (date filter) / `useUserDetails` in Phase 5. Still to do: `useSupport` (type filter + escalated view never sending `status=escalated` to `index`).
- [ ] Extend `e2e/apiStubs.ts` for a full `system_admin` walkthrough: login → dashboard → trips (page 2) → ban a user → approve a verification → resolve a complaint → approve a wallet request → create an employee.
- [ ] `npm run lint && npm run test && npm run build` clean before each phase is called done.

---

## Phase 15 — Ship

- [ ] Verify `vercel.json` rewrite still points at the right API host, and that the SPA fallback covers all routes.
- [ ] Confirm production `VITE_API_BASE_URL` (`/api` + the rewrite) — no direct cross-origin call, so backend CORS is not on the critical path in prod.
- [ ] Smoke the deployed build with a real `system_admin` account against §2's matrix, top to bottom.
- [ ] Record the verified contract in `docs/api/decisions.md` and delete `collection.json` / `SyRide_All_APIs_merged.postman_collection.json` from the dashboard repo if they are now stale duplicates.

---

## Appendix A — Full endpoint reference for a `system_admin` session

All paths are relative to `VITE_API_BASE_URL`. Auth header: `Authorization: Bearer <access_token>`.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/staff/login` | `{identifier, password}` | any active employee |
| POST | `/admin/login` | `{email\|username, password}` | `system_admin` / `sycash` only |
| POST | `/staff/refresh` \| `/admin/refresh` | `{refresh_token}` | same JWT service |
| POST | `/staff/logout` \| `/admin/logout` | — | revokes all tokens |
| GET | `/staff/me` | — | **authoritative role** |

### Admin (`staff:admin,system_admin`)
`GET /admin/dashboard` · `/dashboard/stats` · `/dashboard/growth?months=1..12` · `/dashboard/cities` · `/dashboard/recent?limit=1..50`
`GET /admin/trips?filter&per_page&page` · `/admin/trips/live` · `/admin/routes/popular?limit` · `/admin/drivers/top?limit`
`GET /admin/users?type&status&date&per_page&page&search` · `/admin/users/{id}/status` · `POST /admin/users/{id}/ban` `{reason≥10, type, expires_at?}` · `POST /admin/users/{id}/unban` `{admin_notes?}`
`GET /admin/drivers?filter&per_page&page&search` · `/admin/drivers/dashboard` · `/admin/drivers/stats` · `/admin/drivers/activity` · `/admin/drivers/verification-efficiency?period` · `/admin/drivers/{id}/profile` · `/admin/drivers/{id}/dashboard`
`GET /admin/passengers/{id}/full-profile` · `/stats` · `/monthly-trips?months` · `/recent-trips?limit` · `/complaints` · `/wallet-charges` · `POST /admin/passengers/{id}/charge-wallet` `{amount, admin_notes?}`
`GET /admin/wallet` · `/admin/wallets` · `/admin/wallet/{walletId}/transactions` · `/admin/wallet/requests?status&per_page` · `POST /admin/wallet/requests/{id}/approve|reject` `{admin_notes?}`
`POST /admin/photo` (multipart)

### Admin — `system_admin` only
`POST /admin/wallet/charge` `{phone_number, amount}` · `GET /admin/export/pdf` · `GET /admin/reports?start_date&end_date` · `GET /admin/verifications` · `POST /admin/verifications/{userId}/approve|reject`

> ⚠️ The three `/admin/verifications*` routes are **deliberately unused** — they are `system_admin`-only
> twins of the `/staff/verifications*` routes with a thinner payload (no `total`, no
> `gender`/`address`/`profile_photo`). Phase 6 deleted `ENDPOINTS.VERIFICATIONS`; do not re-add it.

### Staff (any role)
`GET /staff/reviews?user_id&search&date&per_page&page` · `DELETE /staff/reviews/{commentId}`
`GET /staff/users?type&status&search&per_page` · `/staff/users/{id}`
`GET /staff/trips?filter&per_page` · `/staff/bookings?status&per_page`
`GET /staff/complaints?status&type&date&user_id&per_page&page` · `/staff/complaints/{id}` (auto pending→in_review) · `PATCH /staff/complaints/{id}/respond` `{resolution_notes≥10, status}` · `PATCH /staff/complaints/{id}/escalate` `{reason≥10}`
`POST /staff/trips/{rideId}/cancel` `{reason}` · `POST /staff/bookings/{bookingId}/cancel` `{reason}`

### Staff — `admin,system_admin`
`GET /staff/verifications/pending` · `POST /staff/verifications/{userId}/approve|reject`
`GET /staff/escalated-complaints?status&per_page` · `PATCH /staff/escalated-complaints/{id}/resolve` `{resolution_notes, status}`

### Employees — `system_admin` only
`GET /employees` · `POST /employees` `{username, email?, password≥8, first_name, last_name, role}` · `GET /employees/{id}` · `PUT /employees/{id}` · `PATCH /employees/{id}/toggle-active` · `PATCH /employees/{id}/reset-password` `{new_password≥8}`

### Response envelope conventions
- Success: `{status:'success', data|wallet|employee|report_data: ..., meta?, counts?}`
- Paginated: `meta:{current_page, last_page, per_page, total}`
- Validation error: `422 {status:'error', errors:{field:[msg]}}`
- Auth error: `401 {status:'error', code, message}` · `403 {status:'error', code:'FORBIDDEN', message}`
- Server error: `500 {status:'error', message}`

---

## Appendix B — Open questions for the backend developer

> Tracked with owner/ETA/fallback columns in [`docs/api/decisions.md`](docs/api/decisions.md) table A.
> **Q10 is the blocker** — until it is answered there is no backend to develop against.

0. **Q10 — where is the API?** `vite.config.ts` and `vercel.json` both proxy to
   `https://api.onwayride.me/api`. That host is live but runs an **Express** service that 404s
   everything, including `/admin/dashboard` and `/staff/me`. Was the API moved, retired, or never
   deployed there? What host should the dashboard target for staging and for production — and is
   `docker compose up` on `:8080` the intended local setup? Also: **`system_admin` credentials** for
   the seeded employee.
1. Is `GET/POST /admin/settings` planned? (Blocks the whole Settings page — Phase 11.)
2. Is `POST /admin/broadcast-alert` planned? (Blocks the Staff broadcast modal — Phase 10.)
3. Can `GET /staff/complaints/metrics` be added, registered **before** the `{id}` route? (Blocks the Support KPI row — Phase 7.)
4. Is employee deletion intentionally absent, i.e. is `toggle-active` the final answer? (Phase 10.)
5. Do the deployed complaint verbs `open` / `resolve` / `close` / `notes` exist? They are in the Postman collection but not in `origin/main`. (Phase 7.)
6. `GET /admin/users` derives `admin_photo` from `$request->user()?->id`, which is `null` under `StaffJwtMiddleware` (the employee is on `$request->attributes`). Intentional?
7. ~~Does `POST /admin/verifications/{userId}/approve` (and the `/staff/` equivalent) require `national_id` now that the column exists? The Postman body sends it.~~ ✅ **Answered by the code and confirmed live in Phase 6: yes, `required|string|max:50` plus a uniqueness check.** What remains is a *request*, not a question — the value appears nowhere in the payload the reviewer is shown, so it must be transcribed by hand ([REQ-4](docs/api/backend-issues.md)).
8. Should `sycash` reach the dashboard/trips/drivers pages? Those route groups are `staff:admin,system_admin`, which excludes `sycash` even though `isAdminRole()` is true for it — that looks like an inconsistency.
9. Is `http://localhost:5173` (Vite) going to be added to `config/cors.php`, or should everyone keep using the dev proxy?

---

## Suggested order & rough sizing

| Phase | Depends on | Size |
|---|---|---|
| 0 — Contract reconciliation | — | 🟡 done 2026-08-10; awaiting Q1–Q5 + **Q10** |
| 1 — Foundation (auth, roles, axios) | 0 | ✅ done 2026-08-10 |
| 2 — Dashboard | 1 | ✅ done 2026-08-10 |
| 3 — Trips (+ bookings) | 1 | ✅ done 2026-08-11 |
| 4 — Drivers | 1 | ✅ done 2026-08-12 |
| 5 — Passengers | 1 | ✅ done 2026-08-12 |
| 6 — Verifications | 1 | 0.5 d |
| 7 — Support | 0, 1 | 1 d |
| 8 — Reviews | 1 | 0.5 d |
| 9 — Reports & Wallet | 1 | 1.5 d |
| 10 — Staff | 0, 1 | 1 d |
| 11 — Settings | 0 | 0.25–1 d (depends on the answer) |
| 12 — Shell | 1 | 0.5 d |
| 13 — Hardening | 2–12 | 1 d |
| 14 — Tests | 2–13 | 1 d |
| 15 — Ship | 14 | 0.5 d |

Phases 2–12 are independent of each other and can be split across people once Phase 1 lands.
