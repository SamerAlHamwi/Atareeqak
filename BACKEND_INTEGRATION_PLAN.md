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
- `GET /admin/passengers/{id}/stats | monthly-trips | recent-trips | complaints | wallet-charges` — only the BFF `full-profile` is used; the per-section refresh endpoints are unused.
- `GET /admin/drivers/stats`, `GET /admin/drivers/activity`, `GET /admin/drivers/verification-efficiency` — covered by the `drivers/dashboard` BFF, so these are only needed if you add per-widget refresh.
- `GET /staff/bookings` and `POST /staff/bookings/{bookingId}/cancel` — **no UI exists**. Bookings are a first-class backend concept with zero dashboard surface.
- `GET /employees/{id}` — no consumer (the list carries everything today).
- `POST /admin/photo` — admin avatar upload; `MainLayout` still renders a hardcoded Unsplash photo.
- `GET /admin/users/{id}/status` — `usersApi.getUserStatus()` exists, never called (useful for the ban-state banner).

### 1.6 Smaller mismatches worth fixing while you are in there

- `useTrips.ts:49` calls `tripsApi.getAllTrips(1, activeFilter)` — **page is hardcoded to 1**. The backend paginates (`meta.last_page`) and the table has no pager.
- Ban is always sent as `type: 'permanent'` from the details pages. The backend supports
  `type: 'temporary'` + `expires_at` (`AdminBanController`) and the list pages already pass a full
  `BanRequest` — the details pages are the inconsistent ones.
- `verificationsApi.rejectVerification(userId)` is called with no `reason`; the backend accepts one
  and forwards it into the user's notification.
- `GET /admin/users` builds `admin_photo` from `$request->user()?->id`, which is **null** under
  `StaffJwtMiddleware` (the employee lives in `$request->attributes`, not `$request->user()`).
  Expect `admin_photo: null` — flag it to the backend dev rather than working around it.
- Avatars fall back to `i.pravatar.cc` in 5 hooks and `MainLayout` uses a hardcoded Unsplash URL.
  These are external network calls in a product surface; replace with a local initials avatar.

---

## 2. Component → endpoint status matrix

Legend: ✅ wired & endpoint exists · ⚠️ wired but mismatched/incomplete · ❌ endpoint missing · 🆕 to build

| Page / component | Endpoint(s) | Status |
|---|---|---|
| `auth/pages/Login` | `POST /staff/login` → fallback `POST /admin/login` | ⚠️ role hardcoded on fallback; `useMockAction` still imported |
| `AuthContext` | `GET /staff/me` | ⚠️ only refreshes role for `kind === 'staff'` |
| `services/api.ts` refresh | `POST /admin/refresh` \| `POST /staff/refresh` | ⚠️ redundant split |
| `dashboard/pages/Dashboard` | `GET /admin/dashboard` (BFF) | ⚠️ growth `1.2%` hardcoded; sub-endpoints unused |
| `trips/pages/Trips` + `TripsTable` | `GET /admin/trips` | ⚠️ page pinned to 1, no pager |
| `trips/LiveTripsMap` | `GET /admin/trips/live` | ✅ |
| `trips/MonitoringSidebar` | `GET /admin/routes/popular`, `GET /admin/drivers/top` | ✅ |
| `trips` cancel | `POST /staff/trips/{rideId}/cancel` | ✅ |
| `trips` "draft trip" / "contact driver" buttons | — | ❌ mock (`useMockAction`) |
| `drivers/pages/Drivers` | `GET /admin/drivers/dashboard`, `GET /admin/drivers` | ✅ |
| `drivers/pages/DriverDetails` | `GET /admin/drivers/{id}/dashboard` | ✅ |
| drivers ban/unban | `POST /admin/users/{id}/ban|unban` | ⚠️ permanent-only |
| `users/pages/Users` | `GET /admin/users` | ✅ |
| `users/pages/UserDetails` | `GET /admin/passengers/{id}/full-profile`, `POST .../charge-wallet` | ✅ |
| `verification/pages/Verifications` | `GET /staff/verifications/pending`, `POST .../approve|reject` | ⚠️ no reject reason |
| `verification/VerificationDocuments` | documents from the pending payload | ✅ |
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
| — | `GET /staff/bookings`, `POST /staff/bookings/{id}/cancel` | 🆕 no UI at all |
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

## Phase 1 — Foundation: transport, auth, roles — ✅ **DONE 2026-08-10**

> Verified with `npx tsc -b` (clean), `npm run lint` (clean), `npm test` — **56 passing, up from 24**.
> Not yet verified against a real backend: no host exists (Phase 0.5 / Q10).

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

### 1.3 Server is the source of truth for role — ✅

- [x] `authApi.login()` no longer hardcodes `role: 'system_admin'` on the `/admin/login` path — it calls `GET /staff/me` with the freshly issued token. `/staff/login` still uses its own response (the employee, role included), so the common path costs no extra request.
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

## Phase 2 — Dashboard page

Endpoint: `GET /admin/dashboard` → `{status, data:{stats, growth_chart:{period,data}, city_distribution, recent_activities}}` (server-cached 5 min).

- [ ] Replace the hardcoded `growth: '1.2%'` in `Dashboard.tsx:57` with a real delta. If the payload has no growth delta, compute it from `growth_chart.data` (last vs previous bucket) and label it accordingly — do not invent a number.
- [ ] Wire the period selector (`periodLabel` state is currently decorative) to `GET /admin/dashboard/growth?months=N`, `N ∈ 1..12` (backend clamps).
- [ ] Add a manual **Refresh** control that re-fetches; note in the UI that figures are cached for up to 5 minutes server-side.
- [ ] Extract the fetch into `src/features/dashboard/hooks/useDashboard.ts` following the `useFetchEffect` pattern used by every other feature — `Dashboard.tsx` is the only page still calling the API inline.
- [ ] Empty/error states: `TableSkeleton` for the activity list, `ErrorBanner` on failure.
- [ ] Make the recent-activity rows link through (`user_id` → `/passengers/:id`).

**DoD:** every card, both charts, and the activity feed change when backend data changes; no literal numbers remain in the file.

---

## Phase 3 — Trips

Endpoints: `GET /admin/trips?filter&per_page&page` → `{data, meta{current_page,last_page,per_page,total,filter}, counts{all,scheduled,active,completed,cancelled,awaiting}}` · `GET /admin/trips/live` · `GET /admin/routes/popular?limit` · `GET /admin/drivers/top?limit` · `POST /staff/trips/{rideId}/cancel {reason ≥10 chars}`.

- [ ] **Fix pagination.** `useTrips.ts:49` hardcodes page 1. Add `page` state, pass it through `tripsApi.getAllTrips(page, filter)`, store `meta.last_page`/`meta.total`, and render the existing `TablePagination` under `TripsTable`.
- [ ] Reset `page` to 1 whenever `filter` changes (same pattern as `useSupport.setStatusFilter`).
- [ ] Drive the filter tab badges from `counts` instead of client-side length.
- [ ] Add `per_page` (backend allows 1–50, default 15).
- [ ] Live map: add a polling interval (30–60 s) with pause-when-tab-hidden, and show "updated HH:MM".
- [ ] Resolve the two mock buttons ("draft trip", "contact driver"): either remove them or, if the driver payload carries `communication_number` (it does, on `LiveTripResponse.driver`), turn "contact driver" into a `tel:` link.
- [ ] 🆕 **Bookings.** `GET /staff/bookings?status&per_page` and `POST /staff/bookings/{id}/cancel {reason}` have no UI. Add a *Bookings* tab on the Trips page: table + cancel action reusing `ConfirmActionModal` with the 10-char reason rule.

**DoD:** paging through >1 page of trips works; tab badges match `counts`; a booking can be cancelled and the row updates.

---

## Phase 4 — Drivers

Endpoints: `GET /admin/drivers/dashboard` (BFF: `admin_photo`, `stats`, `recent_activity`, `verification_efficiency`) · `GET /admin/drivers?filter&per_page&page&search` · `GET /admin/drivers/{id}/dashboard` · `GET /admin/drivers/{id}/profile` · `POST /admin/users/{id}/ban|unban`.

- [ ] Confirm the drivers table paginates against `meta` (`useDrivers.ts:98` already passes params — verify `page` is state-driven, not fixed).
- [ ] Wire the `search` param to the search box (`Drivers.tsx:205`) with a ~300 ms debounce.
- [ ] Wire the `verification_efficiency` widget's period switch to `GET /admin/drivers/verification-efficiency?period=day|week|month`.
- [ ] **Temporary bans.** `useDriverDetails.ts:121` sends `type: 'permanent'` unconditionally. Extend `ConfirmActionModal` (or add a `BanUserModal`) with: reason (≥10 chars), type radio, and `expires_at` datetime required when `type === 'temporary'` — matching `AdminBanController`.
- [ ] After ban/unban, refetch `GET /admin/users/{id}/status` and show the resulting ban state (reason, expiry, who banned) as a banner on the details page. `usersApi.getUserStatus()` already exists and is unused.
- [ ] Replace the `i.pravatar.cc` fallback (`useDrivers.ts:58`, `useDriverDetails.ts:68`) with a local initials avatar component.
- [ ] Document why `GET /admin/drivers/{id}/profile` is unused, or delete `driversApi.getDriverProfile`.

**DoD:** a temporary ban with an expiry round-trips and the status banner reflects it after reload.

---

## Phase 5 — Passengers (Users)

Endpoints: `GET /admin/users?type&status&date&per_page&page&search` → `{data:{admin_photo, stats, users, meta}}` · `GET /admin/passengers/{id}/full-profile` · `POST /admin/passengers/{id}/charge-wallet {amount, admin_notes?}` · ban/unban/status.

- [ ] Wire all four filters the backend accepts — `type`, `status`, **`date`** (`all|last_30_days|last_3_months|last_6_months|last_12_months`), and `search`. `UsersListParams` already types them; confirm the UI exposes `date`.
- [ ] Same temporary-ban modal as Phase 4.
- [ ] Charge wallet: show the returned new balance in the success banner and refetch the profile; surface 422 field errors (amount rules live in `PassengerProfileController`).
- [ ] 🆕 Add per-section refresh buttons using the endpoints that exist but are unused:
      `stats`, `monthly-trips?months=6`, `recent-trips?limit=10`, `complaints`, `wallet-charges` —
      so a section can reload without re-fetching the whole BFF payload.
- [ ] `admin_photo` will be `null` (see §1.6). Render the fallback avatar and report the bug upstream rather than patching around it.

**DoD:** every filter changes the result set; a wallet charge updates the balance without a full page reload.

---

## Phase 6 — Verifications

Endpoints: `GET /staff/verifications/pending` → `{status, total, data[]}` · `POST /staff/verifications/{userId}/approve {national_id?}` · `POST /staff/verifications/{userId}/reject {reason?}`.

- [ ] **Add the reject reason.** `useVerifications.ts:114` calls `rejectVerification(userId)` with no reason; the backend forwards it into the user's notification. Use `ConfirmActionModal` with a required reason.
- [ ] Check whether approve needs `national_id` — the Postman body sends `{"national_id":"1234567890"}` and the latest backend release added a `national_id` column to `users`. If required, add the field to the approve modal, pre-filled from the submitted ID document when available.
- [ ] Show `total` in the page header and an explicit empty state ("no pending verifications").
- [ ] Document viewer: verify all four types render (`face_id`, `back_id`, `license`, `mechanic_card`) and handle a broken/expired URL.
- [ ] Optimistically remove the row on approve/reject, then refetch to reconcile.

**DoD:** rejecting requires a reason, the row disappears, and `total` decrements.

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

## Phase 10 — Staff / Employees (system_admin only)

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
- [ ] **Pagination** — `TablePagination` on every list backed by `meta` (trips is the known gap; audit drivers, users, reviews, complaints, wallet requests).
- [ ] **Concurrency** — an in-flight request must be cancelled/ignored when filters change (a stale response currently overwrites fresh state in the `useFetchEffect` hooks). Use an `AbortController` or a request-sequence guard.
- [ ] **403 handling** — `RoleRoute` blocks navigation, but a role change mid-session can still produce a 403. Show the "no permission" panel instead of an error banner.
- [ ] **i18n** — every new string goes in both `src/locales/en/translation.json` and `src/locales/ar/translation.json`. Check RTL for new tables/modals.
- [ ] **Dates** — several hooks call `toLocaleDateString('ar-SY')` unconditionally. Format by active locale.
- [ ] **Avatars** — one shared `<Avatar name photo />` with initials fallback; remove all `i.pravatar.cc` and Unsplash URLs.

---

## Phase 14 — Tests

Existing: `tests/{auth,hooks,services}` (vitest + msw), `e2e/smoke.spec.ts` + `e2e/apiStubs.ts` (Playwright).

- [ ] Update `tests/testServer.ts` msw handlers to the confirmed contract — including the removed endpoints, so a regression that re-introduces `/admin/settings` fails loudly.
- [ ] `tests/services/api.test.ts` — the three refresh/403 cases from 1.4.
- [ ] `tests/auth/AuthContext.test.tsx` — role comes from `/staff/me`, not from the login response; `sycash` renders correctly.
- [ ] Hook tests for the newly-wired params: `useTrips` (paging), `useUsers` (date filter), `useSupport` (type filter + escalated view never sending `status=escalated` to `index`).
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
7. Does `POST /admin/verifications/{userId}/approve` (and the `/staff/` equivalent) require `national_id` now that the column exists? The Postman body sends it.
8. Should `sycash` reach the dashboard/trips/drivers pages? Those route groups are `staff:admin,system_admin`, which excludes `sycash` even though `isAdminRole()` is true for it — that looks like an inconsistency.
9. Is `http://localhost:5173` (Vite) going to be added to `config/cors.php`, or should everyone keep using the dev proxy?

---

## Suggested order & rough sizing

| Phase | Depends on | Size |
|---|---|---|
| 0 — Contract reconciliation | — | 🟡 done 2026-08-10; awaiting Q1–Q5 + **Q10** |
| 1 — Foundation (auth, roles, axios) | 0 | ✅ done 2026-08-10 |
| 2 — Dashboard | 1 | 0.5 d |
| 3 — Trips (+ bookings) | 1 | 1.5 d |
| 4 — Drivers | 1 | 1 d |
| 5 — Passengers | 1 | 1 d |
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
