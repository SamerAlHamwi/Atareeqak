# Atareeqak Dashboard ↔ SyRide Backend — Full Integration Plan — ✅ **ALL 15 PHASES DONE 2026-08-14**

**Goal:** every component of the dashboard is driven by a real backend endpoint, for a
**`system_admin`** session, with no mock data left in the product paths. **Achieved** — see
`docs/api/component-endpoint-map.md` for the checkable, component-by-component proof.

**Repos**

| Piece | Path | Current HEAD |
|---|---|---|
| Backend (Laravel) | `Backend/` (this machine's checkout of `4th_year_projects_refractored`) | `cae097b` (2026-08-14), `main` |
| Dashboard (React 19 + Vite + TS) | `Atareeqak` | working tree |
| API contract | `docs/api/route-list.json` (145 routes, from `php artisan route:list --json`) | authoritative — see `docs/api/decisions.md` |

**Live API (dev/local):** `http://127.0.0.1:8000/api` (proxy in `vite.config.ts`). **Production:** no
known host — `vercel.json`'s rewrite targets `$API_PROXY_TARGET`, an unset Vercel env var, and
`src/app/ApiConfigGuard.tsx` makes that absence loud instead of shipping another guess (Phase 15).

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
| ~~`ENDPOINTS.BROADCAST_ALERT`~~ | `POST /admin/broadcast-alert` | **Staff → Broadcast Alert** modal | ✅ resolved in Phase 10: constant **deleted**. Confirmed **404** live (a clean missing route, unlike SUPPORT_METRICS which 500s) |
| ~~`ENDPOINTS.SUPPORT_METRICS`~~ | `GET /staff/complaints/metrics` | **Support** KPI cards | ✅ resolved in Phase 7: constant **deleted**. It does not 404 as stated here — `"metrics"` matches `GET /staff/complaints/{id}` and fails its `int` type hint, returning **500 with an Ignition stack trace** ([BUG-8](docs/api/backend-issues.md)) |
| ~~`staffApi.deleteEmployee`~~ | `DELETE /employees/{id}` | **Staff** delete button | ✅ resolved in Phase 10: confirmed **405** live, constant and wrapper **deleted**, button replaced by *Deactivate*. Note `EmployeeManagementService::delete()` IS implemented — it just has no route ([BUG-4](docs/api/backend-issues.md)) |

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

- ~~`GET /admin/wallet` — the admin's own wallet (balance card).~~ ✅ wired in Phase 9 as the Reports header card.
- ~~`GET /admin/wallet/{walletId}/transactions`~~ ✅ wired in Phase 9 as the transactions drawer.
- ~~`GET /admin/passengers/{id}/stats | monthly-trips | recent-trips | complaints | wallet-charges`~~ ✅ all five wired in Phase 5 as per-section refresh controls (window/limit/status selectors + a reload button each).
- `GET /admin/drivers/stats`, `GET /admin/drivers/activity` — covered by the `drivers/dashboard` BFF, so these are only needed if you add per-widget refresh. ~~`GET /admin/drivers/verification-efficiency`~~ ✅ wired in Phase 4 (period switch). `GET /admin/drivers/{id}/profile` has **no consumer by design** — Phase 4 deleted the wrapper; `{id}/dashboard` is a superset.
- ~~`GET /staff/bookings` and `POST /staff/bookings/{bookingId}/cancel` — **no UI exists**.~~ ✅ Built in Phase 3 as the Bookings tab on the Trips page.
- `GET /employees/{id}` — still no consumer (the list carries everything), and it 500s anyway (BUG-1). `staffApi.getEmployee` exists for when BUG-1 is fixed.
- `POST /admin/photo` — ❌ **a stub that reports success and does nothing** ([BUG-12](docs/api/backend-issues.md)). Never wire an upload control to it.
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
| `support/pages/Support` (inbox) | `GET /staff/complaints`, `GET /staff/complaints/{id}`, `PATCH .../respond`, `PATCH .../escalate` | ✅ paged, `per_page`, **`counts`-driven badges**, type + date filters, attachments |
| `support` (escalated view) | `GET /staff/escalated-complaints`, `PATCH .../{id}/resolve` | ✅ own `counts` badges; resolved/closed tabs labelled "(all)" ([BUG-10](docs/api/backend-issues.md)) |
| `support/SupportStats` | derived from the two `counts` blocks | ✅ rebuilt in Phase 7; avg-response card removed ([REQ-5](docs/api/backend-issues.md)), its endpoint 500s ([BUG-8](docs/api/backend-issues.md)) |
| `reviews/pages/Reviews` | `GET /staff/reviews`, `DELETE /staff/reviews/{id}` | ✅ paged, `per_page`, server-side search + date, `?user_id=` deep link, confirmed delete |
| `reports/OverviewCards` | `GET /admin/reports` | ✅ rebuilt in Phase 9: two non-existent fields removed, five real ones surfaced, split into range-filtered vs point-in-time groups |
| `reports/TransactionTable` | `GET /admin/wallet/requests`, `POST .../approve|reject` | ✅ paged, `per_page`, **`counts`-driven badges**, type filter, `admin_notes`; "All" tab removed ([REQ-6a](docs/api/backend-issues.md)) |
| `reports/ManagementSidebar` | `GET /admin/wallets`, `POST /admin/wallet/charge` | ✅ full directory on load, all three charge figures, `max:1000000` mirrored |
| reports PDF | `GET /admin/export/pdf` | ✅ date range + `sections[]`; JSON-under-blob errors parsed |
| `staff/pages/Staff` | `GET/POST /employees`, `PUT /employees/{id}`, `PATCH .../toggle-active`, `PATCH .../reset-password` | ⚠️ built, but **all six 500** ([BUG-1](docs/api/backend-issues.md)); ships a live-derived "unavailable" state with every write control gated |
| staff delete | ~~`DELETE /employees/{id}`~~ | ✅ resolved in Phase 10: **405**, so `deleteEmployee` was deleted and replaced by *Deactivate* |
| ~~`staff/BroadcastAlertModal`~~ | `POST /admin/broadcast-alert` | ✅ resolved in Phase 10: **404** confirmed live, so the modal, its api call, its endpoint constant and its locale namespace were all removed |
| ~~`settings/pages/Settings` (4 components)~~ | ~~`GET/POST /admin/settings`~~ | ✅ resolved in Phase 11: **no such route**, and two-thirds of the page's own controls weren't even wired to the one hook that existed — the whole feature deleted, not built behind a flag. See `decisions.md` Q1. |
| ~~`home/pages/Home`~~ | — | ✅ resolved in Phase 12: page deleted, `/` now a role-based `<Navigate>` (`RoleHome` in `routes/index.tsx`) |
| ~~`MainLayout` header search~~ | — | ✅ resolved in Phase 12: removed rather than wired — only 2 of the "3" entities the plan assumed actually share a `search` param |
| `MainLayout` admin avatar | `POST /admin/photo` | ✅ resolved in Phase 12: confirmed **unbuildable** for three independent reasons (stub, no DB column, no field on `/staff/me` — [BUG-12](docs/api/backend-issues.md)), so the shared `<Avatar>` initials fallback is the permanent answer, not wired |
| ~~— | `GET /staff/bookings`, `POST /staff/bookings/{id}/cancel`~~ | ✅ built in Phase 3 (Bookings tab) |
| ~~—~~ | `GET /admin/wallet`, `GET /admin/wallet/{id}/transactions` | ✅ built in Phase 9 (admin wallet card + transactions drawer) |
| ~~— (notification bell)~~ | 8 `/api/notifications/*` routes | ✅ resolved in Phase 12: confirmed **cross-realm auth defect** live (BUG-13) — a staff token authenticates as whatever `users` row shares its numeric id, since `JwtAuthMiddleware` never checks `sub_type`. No staff-reachable notifications endpoint exists; the bell was removed, not wired |
| ~~— (logout)~~ | `POST /staff/logout` \| `/admin/logout` | ✅ resolved in Phase 12: `AuthContext.logout` now calls `authApi.logout(authKind, accessToken)`; proven live by a logout-then-replay assertion (`docs/api/verify-shell.mjs`) |

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
- [x] ~~`tests/testServer.ts` still stubs `/staff/complaints/metrics` as a success.~~ ✅ **Removed in Phase 7**, along with the code that called it. `setupServer()` now has no baseline handlers at all — a success stub for a route that 500s would let a regression re-introduce the call and still pass the suite.

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
  literally equal the filter name. ~~Phase 7's `useSupport.visibleComplaints` has the same latent bug.~~ ✅ deleted in Phase 7.

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

## Phase 7 — Support / Complaints — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-13**

Endpoints: `GET /staff/complaints?status&type&date&user_id&per_page&page` → `{status, data, meta{…}, counts{all,pending,in_review,resolved,closed}}` · `GET /staff/complaints/{id}` (⚠️ **not a read — a `pending`, unassigned complaint auto-transitions to `in_review` and is assigned to the caller**) · `PATCH /staff/complaints/{id}/respond {resolution_notes 10–3000, status in:in_review,resolved,closed}` · `PATCH /staff/complaints/{id}/escalate {reason 10–1000}` · `GET /staff/escalated-complaints?status&type&date&per_page&page` → same envelope, `counts{escalated,resolved,closed}` · `PATCH /staff/escalated-complaints/{id}/resolve {resolution_notes 10–3000, status in:resolved,closed}`.

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **173 passing, up from 156**.
>
> **Verified end-to-end** by [`docs/api/verify-support.mjs`](docs/api/verify-support.mjs) — drives the
> real page in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **105 assertions read-only, 110 with `--mutate`, 0 failures.**

### The seed was empty — what was done about it

Probed before building: `complaints`, `complaint_attachments`, `profile_comments` and `user_ratings`
were **all zero rows**. Nothing on either page could render — not a row, not a badge, not a detail
panel, not one action — and no filter could be told apart from a broken query.

So 12 complaints, 2 attachments and 8 profile comments were seeded deliberately from
[`docs/api/seed-phase-7-8.sql`](docs/api/seed-phase-7-8.sql) (which documents what each row exercises
and why) and removed again by [`docs/api/revert-phase-7-8.sql`](docs/api/revert-phase-7-8.sql). The
seed spans all four `index` statuses plus two `escalated`, all eight `type` values, and a `created_at`
spread that makes the date filter change the **row count** (10 → 8 → 5) rather than only echo itself.

**Revert proven read-only afterwards:** `/staff/complaints` `total: 0` with every count `0`,
`/staff/escalated-complaints` `total: 0`, `/staff/reviews` `total: 0`, and zero leftover
`complaint_response`/`complaint_resolved` notifications. `verify-verifications.mjs` (51/51),
`verify-drivers.mjs` (94/94) and `verify-users.mjs` (137/137) were re-run — this phase touched the
shared `ConfirmActionModal`, `PerPageSelect` and `useApiAction` — and all three still pass.

### All three corrections to this plan's earlier text were confirmed live

1. **`GET /staff/complaints/metrics` returns `500`, not `404`.** `"metrics"` is captured by the `{id}`
   route and fails its `int` type hint, and with `APP_DEBUG=true` it renders an Ignition page carrying
   absolute filesystem paths. Filed as **[BUG-8](docs/api/backend-issues.md)** — information
   disclosure plus an unhandled 500 that any typo'd id (`/staff/complaints/abc`) also reaches.
2. **`GET /staff/complaints` does carry a `counts` block**, unlike the REQ-2 pages. The filter tabs
   ship with **real badges** — the first inbox in the project that can.
3. **`/staff/escalated-complaints` carries its own `counts{escalated,resolved,closed}`**, used for the
   escalated view rather than reusing the inbox's.

### The `show()` side effect — made visible, not hidden

Confirmed live: opening complaint 4 (`pending`, unassigned) returned it as `in_review` assigned to
`System Admin`, and the badges moved `pending 4→3 · in_review 2→3`. Opening an `escalated` complaint
correctly changed nothing.

- `supportApi.getComplaint` is documented at the call site as **a write, not a read**.
- `useSupport.openComplaint` detects the transition, silently refetches so the badges stop describing
  a state that no longer exists, and returns `wasAssignedToMe` so the page can **tell the user** the
  complaint is now theirs (new `useApiAction.notify`, added for exactly this: a banner for something
  that happened with no action of the user's to wrap).
- The `show()` response is re-applied **after** the reconcile — the list is served from a 1-minute
  cache the open only just busted, so the detail response is the fresher authority.

**Decision for the verification script, stated explicitly:** the read-only pass **opens only
non-pending rows**, so it genuinely writes nothing; the side effect itself is exercised for real only
under `--mutate`, on the complaint the seed reserves for it. That claim is *enforced*, not asserted —
the script re-reads the counts at the end and fails if they moved. **That assertion earned its keep
immediately**: the first seed put the attachments on a `pending` complaint, so inspecting them clicked
a pending row and silently mutated the "read-only" run. The badge counts differed between the `en` and
`ar` passes, the seed moved the attachments to an `in_review` complaint, and the script now also
filters its attachment target to non-pending so the guarantee survives a future seed change.

### Done

- [x] **`SupportStats` rebuilt** — path (b). Every figure is derived from the two `counts` blocks;
      the **avg-response-time card was removed**, not left dashed. No endpoint in the checkout exposes
      response latency, and averaging one paginated page client-side would describe the page, not the
      platform. Filed as **[REQ-5](docs/api/backend-issues.md)**. The escalated card is withheld
      entirely for roles that cannot call the escalated endpoint (a 3-card row), rather than showing a
      number they have no source for.
- [x] **`type` (8 values) and `date` (2 values) filters wired** — both accepted by the API since
      Phase 0, neither previously exposed. *Verified: `type=trip_safety` renders exactly its 2 rows and
      `date=last_7_days` renders 5 of 10, so the filters change the result rather than just echoing.*
- [x] **The `escalated` guard is structural.** The inbox has no `escalated` tab, and the request
      builder whitelists `COMPLAINT_INDEX_STATUSES`, so the 422 combination is unrepresentable even if
      the state is forced. *Verified: `status=escalated` really does 422 on `index`, and no index
      request in either language ever carried it.* A unit test forces the value onto the inbox and
      asserts it is dropped.
- [x] **`visibleComplaints` deleted.** The Phase 6 justification (`visibleRequests`) explicitly does
      not apply: that endpoint takes no parameters, while `/staff/complaints` takes `status`, `type`,
      `date`, `user_id`, `per_page` and `page`. Filtering is server-side; a test asserts every
      server-returned row renders even when the client filter would have dropped it.
- [x] **`per_page` + `TablePagination` on both views**, with `page` reset to 1 on every filter and
      per-page change. *Verified: next issues `page=2` carrying `per_page`, and changing a filter while
      on page 2 reissues `page=1`.*
- [x] **Attachments shipped and verified against real data** — `ComplaintResponse.attachments` was
      typed since Phase 0 and had never rendered. Two rows were seeded (`image/jpeg` +
      `application/pdf`) so both branches run: images inline, everything else as a download link with
      its MIME type and original filename. **BUG-7 makes failure the normal case**, so a failed image
      flips to a labelled "unavailable" panel — the raw link is kept, because opening it is how a
      reviewer confirms the file is genuinely missing. *Verified: both URLs failed, the tile flipped,
      and zero `<img>` elements remained.*
- [x] **`respond` and `escalate` through `ConfirmActionModal`**, honouring the real validators
      (`min:10`; `max:3000` and `max:1000` via `maxReasonLength`). `respond` needs a target status, so
      the shared modal gained an **optional `statusOptions`** prop — additive, so the five existing
      call sites are untouched — rather than a fourth bespoke dialog. *Verified: the modal offers
      exactly the three valid statuses, carries the server's `maxlength`, and a 9-character response is
      blocked before any request is sent.*
- [x] **Actions are hidden, not shown-and-422'd**, mirroring `ComplaintStatus::isAgentActionable()`:
      respond/escalate only from `pending|in_review`, escalated-resolve only from `escalated`.
      *Verified: a resolved complaint renders no action control and an explanatory panel instead.*
- [x] **Hook rewritten to the house pattern:** `error` is `string | null` via `extractApiError` (was
      `Error | null` with the message going to `console.error`), `ErrorBanner` carries the real
      message, dates follow the active locale instead of being pinned to `'ar-SY'`, and the KPI row
      has a real skeleton.
- [x] **The Postman-only verbs confirmed absent** against the live API before anything was built on
      them: `PATCH .../open`, `.../resolve` and `.../close` all 404. Nothing depends on them.

### 🔴 Two backend defects found and filed

- [x] **[BUG-9](docs/api/backend-issues.md) — `counts.all` counts rows the endpoint never returns.**
      `listAll()` excludes `escalated`; `statusCounts()` sums a `GROUP BY` over everything. Live:
      `counts.all = 12` over a list whose `meta.total` is `10`. The dashboard therefore derives the
      "all" badge as `pending + in_review + resolved + closed` (exactly `meta.total`) and **never
      renders `counts.all`**; a unit test pins the two apart and the script asserts the rendered badge
      shows the sum, not `all`.
- [x] **[BUG-10](docs/api/backend-issues.md) — the escalated view's `status` filter drops its own
      escalated constraint.** `listEscalated()` applies `where('status', $status)` with no escalated
      clause, so `?status=resolved` returns **every** resolved complaint. Verified live: it returned
      complaints 7 and 8, both `is_escalated: false`, neither ever escalated. Rather than paper over
      it, those tabs are labelled **"Resolved (all)" / "Closed (all)"** so the UI does not claim to be
      showing escalation history. There is currently no way to ask "which complaints were escalated
      *then* resolved" — the status is overwritten and no column records the transition.

### Deliberate UI changes (recorded so they are decisions, not surprises)

| Change | Why |
|---|---|
| **Avg-response-time KPI card removed** | Its only source 500s (BUG-8) and nothing else can supply it — REQ-5. A permanently-dashed card is worse than no card. |
| **KPI row re-laid out to 3 or 4 cards** (open / pending / escalated / resolved) | Every card is now a direct read of a `counts` field; the escalated one is dropped for roles that cannot call that endpoint. |
| **Status filter `<select>` → shared `FilterTabs` with badges** | The payload carries `counts`, so real badges are possible here for the first time; consistent with Trips and Verifications. |
| **Inline reply textarea → `ConfirmActionModal`** | The textarea enforced no `max`, offered no status choice, and sent `status: 'in_review'` for "send reply" and `'resolved'` for "resolve" with no way to reach `closed`. |
| **"Close" button removed from the inbox** | `respond` reaches `closed` through the modal's status selector; a separate button duplicated it. |
| **Escalated tabs labelled "(all)"** | BUG-10 — they are not escalation history and must not read as if they were. |
| **`driver_history_note` hint panel removed** | It was a hardcoded sentence ("first financial complaint in 6 months") backed by no data at all. |
| **Detail panel gained subject, assignee and attachments** | `title`, `assigned_to` and `attachments` were all in the payload and rendered nowhere. |

### i18n

Every new key in `ar` **and** `en`. The count-bearing audit this phase was asked for found **one**
ungrammatical single-form key in `support` — `avg_response_minutes` (`{{count}} دقيقة`) — which was
**deleted** along with the card it fed rather than pluralised, since it has no data source. The one new
count-bearing key, `attachments_title`, ships all six Arabic CLDR forms. **37 dead keys removed** from
`support` (the mock `category_*` vocabulary superseded by the real 8-value `type` enum, the whole
`avg_response_*` group, and the inline-reply strings). The API's `type_label` is **Arabic-only** and
`status_label` **English-only**, so both are ignored and the codes are translated client-side —
*verified in both directions: neither leaks into the other language's UI.*

**DoD:** ✅ the KPI row shows only real numbers; ✅ type and date filters change the row count
server-side; ✅ no request can 422 from a bad filter combination.

---

## Phase 8 — Reviews — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-13**

Endpoints: `GET /staff/reviews?user_id&search&date&per_page&page` → `{status, data, meta{…}}` (**no `counts` block**) · `DELETE /staff/reviews/{commentId}`.

> **Verified end-to-end** by [`docs/api/verify-reviews.mjs`](docs/api/verify-reviews.mjs) — drives the
> real page in Chromium in **both `en` and `ar`**: **64 assertions read-only, 66 with `--mutate`,
> 0 failures.**

Backed by `profile_comments` (`id, profile_id, user_id, comment, timestamps`) — comments written **on
a profile**, not ride ratings. `user_ratings` is a separate, unused table and stayed untouched.

### Done

- [x] **`search` and `date` verified rather than rebuilt** — both were already wired at a 400 ms
      debounce and both are genuinely server-side. Proven rather than assumed: the seed puts the token
      "punctual" in exactly 2 of 8 comments, and `search=punctual` narrows 8 → 2 **on the server**.
      `ReviewModerationService` matches `comment LIKE %…%` and nothing else — *verified by searching a
      recipient's name (`Driver5`) and getting **zero** rows*, which is what proves the filter is the
      comment body rather than a join. `date` changes the count 8 → 6 → 3.
- [x] **`per_page` added** (`PerPageSelect`, 5/10/25/50 inside the backend's 1–50 rule) and the
      hand-rolled pager replaced with the shared `TablePagination` reading `meta.last_page`. The old
      pager was also hidden entirely when `lastPage <= 1`, so the page size control had nowhere to
      live. *Verified: `per_page=5` renders exactly 5 rows and next issues `page=2` carrying it.*
- [x] **`?user_id=` deep link shipped**, so a profile page can jump to "reviews involving this user".
      Note the server matches **commenter OR recipient**, so the chip says "written by or about", which
      is what it actually returns. A **non-numeric** value is never sent at all; a **numeric but
      nonexistent** one 422s (`exists:users,id`) and that message reaches an `ErrorBanner` instead of a
      blank table. *Both paths verified in both languages.* The filter renders as a dismissible chip
      that clears the URL param.
- [x] **Deletion is a real moderation dialog.** It was a two-click inline confirm; it is now
      `ConfirmActionModal` showing the comment being removed, **the commenter and the recipient by
      name**, and an explicit "this cannot be undone — there is no way to restore a deleted comment",
      which is true: `deleteComment()` is a hard delete with no restore route and no soft delete. A
      reason is required so the moderator has to articulate why. *Verified: opening the dialog fires no
      request, cancelling fires no request and leaves the row, and both names match the payload.*
- [x] **Same hook hygiene as Phase 7:** `error` → `string | null` via `extractApiError` (it was
      `Error | null` going to `console.error`), locale-aware dates (was pinned `'ar-SY'`),
      `TableSkeleton`, `ErrorBanner` with retry, and **three distinct empty states** — no comments at
      all, no comments matching a filter, and a search miss naming the query. *Verified: a search miss
      renders the search-specific state and **not** the generic one.*
- [x] New tests: `tests/hooks/useReviews.test.ts` (9 cases) covering the delete payload, the `user_id`
      deep link, `per_page`, page-reset-on-filter-change, the debounced server-side search, the 422
      surfacing as a string, and locale-aware dates.

### `--mutate` and the irreversible delete

A deleted `profile_comment` **cannot be restored through the API**. `--mutate` therefore performs one
real deletion and prints the deleted row's full contents *and* the exact `INSERT` to put it back —
the same treatment `verify-users.mjs` gives the wallet charge — rather than implying it cleaned up
after itself. All of it was reverted in SQL and proven: `/staff/reviews` is back to `total: 0`.

**DoD:** ✅ search, date, `user_id` and paging all round-trip to the server, each changing the row
count rather than only its echo; ✅ deletion requires confirmation naming both parties and says there
is no undo.

---

## Phase 9 — Reports & Wallet — ✅ **DONE & VERIFIED AGAINST THE LIVE BACKEND 2026-08-13**

Endpoints: `GET /admin/reports?start_date&end_date` → `{status, report_data{ride_stats, financial_stats, date_range}}` (**server-cached 5 min, keyed `admin.report.{start}.{end}`**) · `GET /admin/export/pdf?start_date&end_date&sections[]` → `application/pdf` · `GET /admin/wallet` · `GET /admin/wallets` → `{admin_wallets[2], all_wallets[32]}` (**no query params at all**) · `GET /admin/wallet/{walletId}/transactions` → **raw Laravel paginator, no `meta`** · `POST /admin/wallet/charge {phone_number 10–15, amount 1–1 000 000}` · `GET /admin/wallet/requests?status&type&per_page&page` → `{data, meta{…}, counts{pending,approved,rejected}}` · `POST /admin/wallet/requests/{id}/approve|reject {admin_notes? ≤500}`.

> `npx tsc -b` clean · `npm run lint` clean · `npm test` **198 passing, up from 173**.
>
> **Verified end-to-end** by [`docs/api/verify-reports.mjs`](docs/api/verify-reports.mjs) — drives the
> real page in Chromium in **both `en` and `ar`** against MySQL + `artisan serve` on `:8000`:
> **155 assertions read-only, 160 with `--mutate`, 0 failures.**

### 🔴 The KPI row was broken before this phase, and silently

`FinancialStats` had drifted from the payload, and `display()` turned every `undefined` into `—`:

| `OverviewCards` read | The API actually returns |
|---|---|
| `primary_admin.total_collected` → **undefined → "—"** | `primary_admin.total_platform_fees` |
| `primary_admin.total_disbursed` → **undefined → "—"** | — (does not exist) |
| `sycash.total_creation_fees` (typed, never rendered) | `sycash.total_escrow_in / total_escrow_out / total_refunds_paid` |

**Two of the four cards were permanently dashed in the shipping build**, and the four real `sycash`
figures were rendered nowhere. Both non-existent fields are gone; all five real ones are now on
screen. *Verified: each card's text equals the server's own string, asserted field by field.*

There was a **second** currency bug on the same row: money arrives pre-formatted as `"135,600.00 SYP"`
and the cards appended `t('users.currency')`, which is **`SAR`** — so a Syrian-pound figure rendered
as `"135,600.00 SYP SAR"`. The append is gone. *Verified: the string `SYP <currency>` appears nowhere
on the page in either language.*

### ⚠️ Deliberate UI change: the KPI row is now two labelled groups

Confirmed live on a `2020-01-01..2020-01-02` range — **only half the figures respond to the date
picker**:

| Range-filtered (flows) | NOT range-filtered (point-in-time) |
|---|---|
| `sycash.total_escrow_in / out / total_refunds_paid` → `0.00` | `sycash.current_balance` → unchanged |
| `primary_admin.total_platform_fees` → `0.00` | `primary_admin.current_balance` → unchanged |
| `ride_stats.*` → `71 → 0` | `active_rides_locked` → unchanged |

A range picker above a row where half the cards ignore it is a lie by layout. The cards are therefore
split into **"Period figures"** and **"Current balances"**, the latter captioned *"As of now. These
are point-in-time balances and are NOT affected by the date range."* *Verified in both languages:
applying the range drives the flow card to `0.00` while the balance card is unchanged, in the same
screenshot.*

### Done

- [x] **`FinancialStats` fixed against the real payload and the KPI row re-laid-out** (above). Ride
      stats are rendered too — they are range-filtered, so they sit in the period group.
- [x] **Date range picker**, threaded through **both** `GET /admin/reports` and `GET /admin/export/pdf`.
      `after_or_equal:start_date` is mirrored client-side and **disables Apply** rather than
      submitting and 422'ing. *Verified: both endpoints receive the same applied range; an
      end-before-start range disables the button, explains why, and fires no request.*
- [x] **"updated HH:MM · server-cached for up to 5 minutes"** next to a real refresh control —
      `GET /admin/reports` is cached per date range and nothing busts it. Dashboard/Verifications precedent.
- [x] 🆕 **Admin wallet card** — `GET /admin/wallet` had no consumer since Phase 0. It now renders the
      acting admin's balance, wallet number and phone in the Reports header.
- [x] 🆕 **Wallet transactions drawer** — `walletApi.getWalletTransactions()` had never been called
      from anywhere. Opens from the admin wallet card **and** from any row in the wallet directory.
      *Verified: 31 real transactions over 4 pages on wallet 1, paging round-trips.*
- [x] **`sections[]` on the PDF export shipped as a real feature** — the plan never mentioned it. It
      is validated (`in:stats,financial,growth,cities,recent`) and genuinely changes the output.
      *Verified: all five values accepted, and stats+financial produces a different byte length from
      the full report.*
- [x] **Wallet requests rebuilt**: `counts`-driven badges (the second real badge source in the
      project, after Phase 7), the `type` filter, `per_page` + `TablePagination`, and `page` resets to
      1 on **every** filter and per-page change. *All verified against the server.*
- [x] **`admin_notes` on approve/reject**, through `ConfirmActionModal` with `minReasonLength={1}` and
      `maxReasonLength={500}` — the Phase 6 reject precedent, **not** the 10-char ban rule, because
      the validator is `nullable`. The approve dialog also shows the user's own note and warns that
      the money movement cannot be undone. *Verified: the notes reach the API and come back on the row.*
- [x] **Charge wallet shows all three returned figures** (`previous_balance → new_balance` and
      `transaction_id`, all nested under `wallet`) and refetches afterwards. `max:1000000` is mirrored
      and **disables** the confirm. *Verified: the cap disables the button; a real charge returns all
      three.*
- [x] **`filteredWallets` no longer returns `[]` until the user types** — the sidebar rendered "no
      wallets" on load while holding 32. Justified as client-side the way Phase 6 justified
      `visibleRequests`: `GET /admin/wallets` accepts **no query params at all** and returns every
      wallet unpaginated, so a client filter is the only one possible and there is no server filter
      for it to fight with. A plural-correct "showing N of 32" label and a search-miss empty state
      were added. *Verified: all 32 render before anything is typed.*
- [x] **PDF export handles a non-blob error.** Laravel returns JSON on failure even under
      `responseType:'blob'`, so the old code would have written a JSON error page to disk named
      `.pdf`. The rejected Blob is now read back into the parsed body in place, so `extractApiError`
      and `getFieldErrors` work unchanged. *Verified live (`sections[]=bogus` → 422 JSON) and in a
      unit test.*
- [x] **Hook hygiene:** `useReports.error` moved from `Error | null` + `console.error` to
      `extractApiError` + `string | null`; dates follow the active locale instead of a pinned
      `'ar-SY'`; the report, the wallets and the requests each own their fetch, so a request-filter
      change no longer refetches the cached report; skeletons, `ErrorBanner` with retry, and distinct
      empty states throughout.
- [x] New tests: `tests/hooks/useReports.test.ts` (11 cases) and `tests/hooks/useWalletTransactions.test.ts`
      (6), covering the range reaching both endpoints, both filters, the `counts` badges,
      page-resets-on-filter-change, the `admin_notes` payload, the charge response shape and the raw-paginator mapping.
- [x] **Test-infra fix:** jsdom's `Blob` implements neither `stream()` nor `text()`, so any
      `responseType: 'blob'` request made msw's XHR interceptor throw an *unhandled rejection* that
      failed every other test in the same file. Both are polyfilled in `tests/setup.ts`.

### 🔴 The "All" tab was a lie, and was removed

`AdminWalletRequestController::index()` does `$status = $request->get('status', 'pending')` and
**always** filters — there is no way to ask for all statuses. `useReports` mapped its `'all'` filter
to *sending no `status` at all*, so selecting **All** silently showed **only pending requests**.

*Proven live:* the no-status response is byte-for-byte identical to `?status=pending`, and its total
(7) is smaller than the whole table (12).

**The tab is gone.** Faking it would need three requests and could not be paginated coherently across
three paginators; relabelling it would leave a tab that shows pending under another name. The three
real statuses are each reachable and the `counts` badges show the other two totals from whichever tab
is active, so nothing is concealed. Filed as [REQ-6a](docs/api/backend-issues.md) with the one-line
backend fix that restores it. Note `type` **does** legitimately support "all" — it is applied only
`if filled` — and that asymmetry is commented at both sites.

### ⚠️ Two gaps meant a control was deliberately NOT shipped

- [x] ~~A `PerPageSelect` on the transactions drawer~~ — **not possible.** `per_page` is accepted and
      **silently ignored** there: `AdminWalletService::getWalletTransactions(int $walletId, int $perPage = 10)`
      never receives the controller's value. *Verified: `?per_page=3` returns 10 rows.* The drawer
      ships `TablePagination` alone, and `walletApi.getWalletTransactions()` takes no `perPage`
      argument so a caller cannot re-introduce it. Filed as [REQ-6b](docs/api/backend-issues.md).
- [x] **The transactions endpoint returns a raw Laravel paginator, not the house `{data, meta}`
      envelope** — no `meta` anywhere, plus six keys nothing consumes, and a `wallet.balance` that is
      raw (`"135600.00"`) where every other wallet endpoint returns `"135,600.00 SYP"`. Typed
      explicitly and commented so a refactor does not "fix" it into reading a `meta` that will never
      exist. Filed as [REQ-6c](docs/api/backend-issues.md).

### 🔴 BUG-8 is a pattern — second site confirmed

`GET /admin/wallet/abc/transactions` → `TypeError: …showWalletTransactions(): Argument #1 ($walletId)
must be of type int, string given`. This phase added the first route-parameter links in the feature,
so every wallet id is checked `Number.isFinite` before it can reach a URL. Filed by **extending
BUG-8** rather than as a new number.

### Seed state after this phase

`wallet_requests` was **empty** (0 rows), so the table, its badges, both filters, paging and both
actions rendered against nothing. 12 rows were seeded deliberately from
[`seed-phase-9.sql`](docs/api/seed-phase-9.sql) — 7 pending / 3 approved / 2 rejected, both `type`
values in every status, >1 page at the smallest `per_page` — and **all of it reverted** via
[`revert-phase-9.sql`](docs/api/revert-phase-9.sql). Reports, wallets and wallet transactions needed
**no seeding**.

`--mutate` performed one real approve, one real reject and one real charge. **None is reversible
through the API** — an approve moves a balance *and* writes a `wallet_transactions` row; so does a
charge. The script prints the before/after balances, the rows it created and the exact SQL to undo
them, rather than implying it cleaned up. All of it was reverted and proven: `wallet_requests` back to
**0**, `wallet_transactions` back to **194**, wallets 4 and 32 back to their seeded balances.

**DoD:** ✅ a date range changes both the on-screen report and the exported PDF; ✅ wallet transactions
open from the sidebar and from the admin wallet card; ✅ every card on the page reads a field that
exists.

---

## Phase 10 — Staff / Employees — ✅ **DONE 2026-08-13, SHIPPED BEHIND A LIVE-DERIVED UNAVAILABLE STATE**

Endpoints: `GET /employees` · `POST /employees` · `GET /employees/{id}` · `PUT /employees/{id}` · `PATCH /employees/{id}/toggle-active` · `PATCH /employees/{id}/reset-password {new_password ≥8}`. **There is no `DELETE /employees/{id}`** — confirmed live, `405`.

> **Verified end-to-end** by [`docs/api/verify-staff.mjs`](docs/api/verify-staff.mjs) — drives the
> real page in Chromium in **both `en` and `ar`**: **50 assertions read-only, 63 with `--mutate`,
> 0 failures.** It is the first script in this project that **reads the database directly**, because
> the API lies about whether the write happened.

### 🔴 The backend is not merely broken — three of its six endpoints corrupt data

| Endpoint | Undefined call | Writes before dying? |
|---|---|---|
| `GET /employees` | `list()` | no — dies immediately |
| `GET /employees/{id}` | `formatEmployee()` | no (read-only) |
| `POST /employees` | `formatEmployee()` after `create()` | 🔴 **YES — employee created, then 500** |
| `PUT /employees/{id}` | `formatEmployee()` after `update()` | 🔴 **YES — row updated, then 500** |
| `PATCH .../toggle-active` | `formatEmployee()` after `toggleActive()` | 🔴 **YES — row flipped, then 500** |
| `PATCH .../reset-password` | `resetPassword()` | no — dies before the write |

The 500 is an uncaught **`\Error`** ("Call to undefined method"), which is not an `\Exception`, so
each action's own `catch (\Exception)` never fires and Laravel renders a stack trace instead.

**Proven against the database, not restated.** `verify-staff.mjs --mutate` reads the row before and
after each call: `is_active 1 → 0`, `first_name "Test" → "VerifyProbe"`, `3 → 4 employee rows` — every
one alongside a reported 500. All three are rolled back inside the script, which then asserts the
`employees` table is **byte-for-byte identical** to its pre-run snapshot.

**The decoys were asserted too.** Against employee 1 (the restricted `system_admin`) the same calls
return `403 / 403 / 422` — guards and validators firing *before* the undefined method. The script
exercises **employee 3 (`agent01`, non-restricted)** precisely because a check that only used
employee 1 would have concluded the backend works.

### The decision: option (a) — ship it, gated on the live response

**Chosen:** keep the page mounted and ship a clearly-labelled unavailable state driven by the real
500, rather than hiding it behind a build-time feature flag.

- The read path always attempts `GET /employees` and, on failure, renders `StaffUnavailablePanel` —
  which **names the defect, shows the server's own error verbatim, and states that the write actions
  are withheld on purpose** — never an empty table, which would read as "this platform has no staff".
- **Every write control is unreachable while the list request fails**: create, edit, deactivate and
  password reset are all gated, and their modals are not even mounted.

Availability is derived from the live response rather than a hardcoded flag **on purpose**:
`GET /employees` exercises *both* `list()` and `formatEmployee()`, so its success proves the two
missing methods the write paths depend on are back. The page un-gates itself the moment BUG-1 is
fixed, with no frontend change and no stale flag left behind. Password reset is gated by the same
flag — it dies before its write so it cannot corrupt anything, but a button that can only ever fail is
still a lie about what the page can do.

*Verified in both languages: the panel renders, no `staff-row` exists, no create/edit/toggle/reset/delete
control exists, the page issues only `GET`, and never a `DELETE`.*

### Done

- [x] **`deleteEmployee` removed** from `staffApi` **and** `useStaff`. `DELETE /employees/{id}` returns
      **405** — the route was never registered. The delete button is replaced by *Deactivate*
      (`toggle-active`), which is what the backend intends. A test asserts no code path can issue a
      `DELETE`, and `verify-staff.mjs` asserts the page never sends one.
      **Note this is a routing gap, not a design decision:** `EmployeeManagementService::delete()` is
      fully implemented and simply has no route ([BUG-4](docs/api/backend-issues.md)) — so deletion is
      unsupported by *omission*, not by design.
- [x] **The create-role dropdown offers only `admin` and `support_agent`**, reusing the Phase 1
      `CreatableStaffRole` / `CREATABLE_STAFF_ROLES` rather than redefining them. Pinned by a test.
- [x] **Client-side validators mirrored** rather than submitted-and-422'd: `username`
      `alpha_dash|min:3|max:50` (with its own inline message), `password` `min:8`, `first_name` /
      `last_name` `max:100`, `email` `max:255` and nullable.
- [x] **Edit wired to `PUT /employees/{id}`** through a new `EditEmployeeModal`, sending **only the
      changed fields** — which is what the endpoint's `sometimes` rules are for. Username and role are
      immutable there and the dialog says so. 422 field errors are pinned under their own inputs.
- [x] **`BroadcastAlertModal` removed**, along with `staffApi.sendBroadcastAlert`,
      `ENDPOINTS.BROADCAST_ALERT` and the whole `broadcast.*` locale namespace.
      `POST /admin/broadcast-alert` returns a clean **404**, confirmed live. Per the Phase 0 decision a
      control that 404s is not shipped. A comment at the deletion site records how to restore it.
- [x] **Hook hygiene:** `useStaff.error` moved from `Error | null` + `console.error` to
      `extractApiError` + `string | null`; `last_login_at` follows the active locale instead of a
      pinned `'ar-SY'`; `TableSkeleton` replaced the "loading…" text row; real empty state; every
      write re-reads the list rather than trusting an optimistic local update — the server is the only
      trustworthy source when three endpoints write and then report failure.
- [x] ~~Replace the `i.pravatar.cc` avatar~~ — **stale, and struck.** `useStaff` has used the shared
      `<Avatar name photo />` since Phase 4; `photo` is typed `null` with a comment saying there is no
      employee photo endpoint. Confirmed: `grep -r "pravatar" src` → nothing.
- [x] New tests: `tests/hooks/useStaff.test.ts` (9 cases) covering the create payload, the role
      restriction, the `sometimes` update payload, the unavailable flag on a 500, locale-aware dates,
      and that **no code path can issue `DELETE /employees/{id}`**.
- [x] A `hideReason` prop was added to the shared `ConfirmActionModal` for the deactivate dialog:
      `toggle-active` takes **no body at all**, so collecting a reason would imply it gets recorded.
      Optional and defaulted off, so the five earlier verify scripts are unaffected — all re-run and
      still passing (94 / 137 / 51 / 105 / 64).

### ⚠️ One planned item was dropped — the data cannot support it

- [x] ~~Show `created_by`~~ — **not possible.** It is `NULL` for **all three** seeded employees, so the
      column would read "Unknown" on every row. Dropped exactly as Phase 4 dropped `banned_by`
      ([BUG-5](docs/api/backend-issues.md)). `last_login_at` **is** shown — only 1 of 3 rows has a
      value, but "never signed in" is a real fact about an account, not a missing field. Both counts
      are asserted by `verify-staff.mjs` against the database.

### 🔴 New backend defect found and filed

- [x] **[BUG-11](docs/api/backend-issues.md) — every `/employees` domain refusal is 403; the
      controller's 409 branch is dead code.** This plan told Phase 10 to surface "**409**
      `RuntimeException` (username/email already taken)". That status is unreachable:
      `EmployeeManagementService` throws `\DomainException` at all 18 of its throw sites, including
      both uniqueness checks, and **never throws `\RuntimeException`**. Verified live — a duplicate
      username returns **403** `"Username 'x' is already taken."`, indistinguishable by status from a
      permissions failure. The dashboard therefore does not branch on the status code at all; it
      surfaces the server's message, which is unambiguous, and comments why at the call site.

**DoD:** ⚠️ creating, editing, deactivating and password-resetting **cannot** work until BUG-1 is
fixed — that is a backend blocker, not a frontend gap. ✅ No button maps to a missing route, ✅ no
control that would corrupt a row is reachable, and ✅ the read path degrades honestly instead of
rendering an empty table.

---

## Phase 11 — Settings — ✅ **DONE 2026-08-14 — option (b), fully deleted**

`GET/POST /admin/settings` does not exist (zero of 145 routes in `route-list.json` match `settings`;
`decisions.md` C1/Q1 RESOLVED-absent). That was the smaller half of the problem — a full inventory of
the page (see the table this prompt shipped with) found **only 5 of ~15 visible controls** were wired
to `useSettings` even against a working endpoint: working hours (2 selects), accepted payments (4
checkboxes), all 4 notification toggles, the auto-block thresholds + its "Active" badge, and the
footer's `v2.4.0-stable`/last-update/"secure environment" strings were all `defaultValue`/
`defaultChecked`/literal decoration that nothing ever read. Three of the five wired controls
(Mada / Apple Pay / Visa-MC accepted payments) describe card-processor rails this product does not
have at all — the only money path is the internal SYP wallet (`wallet_requests`,
`wallet_transactions`, `CashRideFeeService`).

**Chose (b)** — not (a): a feature flag would have implied the page was finished and waiting for a
route, which was false on both the layer-2 (unbound controls) and layer-3 (wrong product) evidence
above. Not (c): a read-only placeholder would have kept a page whose entire content was invented.

- [x] Deleted `src/features/settings/` entirely (`settingsApi.ts`, `useSettings.ts`, `Settings.tsx`,
      `PlatformConfig`, `PaymentSettings`, `ModerationRules`, `NotificationRules`).
- [x] `ENDPOINTS.SETTINGS` deleted from `src/services/endpoints.ts`, replaced with an explanatory
      comment following the `SUPPORT_METRICS`/`BROADCAST_ALERT` precedent.
- [x] `/settings` route + lazy import removed from `src/routes/index.tsx`; `settings` nav entry
      removed from `MainLayout.NAV_ITEMS`.
- [x] `'settings'` removed from `AppSection` and `SECTION_ROLES` in `src/app/roles.ts`, including the
      stale comment claiming settings was backed by `/admin/settings` "yet" (implying it was coming).
- [x] All 43 `settings.*` keys deleted from **both** `ar` and `en` `translation.json`, plus the now-
      orphaned `nav.settings` and `header.search_settings_placeholder` (44 keys total). Grepped first
      for collateral use of `settings.active`/`settings.cash` outside the deleted feature — none found.
- [x] `/settings` removed from `ROUTES_BY_ROLE` (`system_admin` and `admin`) in `e2e/smoke.spec.ts`,
      and the `/admin/settings` success-fixture stub removed from `e2e/apiStubs.ts` (Phase 14 replaces
      the rest of that file's stub list).
- [x] A bookmarked `/settings` now hits the `*` fallback → `/`, which Phase 12 item 1 turns into a
      role-based redirect rather than a blank shell.
- [x] Preserved: the language/RTL toggle (`AuthLayout.tsx`), still login-screen-only until Phase 12
      item 4 moves it into the header identity dropdown.
- [x] Recorded in `decisions.md` Q1 (RESOLVED — built as (b), deleted) and its 2026-08-14 change-log
      entry.
- [x] `npx tsc -b`, `npm run lint`, `npm test` all clean — **198 passing, unchanged** (pure deletion,
      no orphaned test referenced the feature).

**DoD:** ✅ `grep -r "admin/settings" src/ e2e/ tests/` returns only the deliberate comment in
`endpoints.ts`.

---

## Phase 12 — Shell: Home, layout, notifications — ✅ **DONE 2026-08-14**

### Trap 1 — notification bell — removed, filed as BUG-13 🔴

Probed live per the prompt's instructions before writing anything: `GET /api/notifications/unread-count`
with employee 1's staff token returned `401 TOKEN_INVALIDATED` as issued — but only because this
seed's `users.token_version` for id 1 (`1`) happened not to match the employee's `ver` claim (`0`).
Setting `users.token_version = 0` to match and repeating the identical request returned `200` with
that user's real (empty) notification payload, proving `JwtAuthMiddleware` really does accept a
staff token as whatever `users` row shares its numeric id — there is no `sub_type` check. Reverted
immediately. Filed as [BUG-13](docs/api/backend-issues.md) at 🔴. The bell (`MainLayout.tsx`'s
hardcoded red dot, no handler, no dropdown, no data) is deleted, not built against this route.

### Trap 2 — avatar upload — not built; BUG-12 extended with two new blockers

`Employee` has no `photo`/`avatar` column (`create_employees_table` migration) and
`EmployeeAuthService::formatEmployee()` (`GET /staff/me`) has no photo field either — so even a
correct `POST /admin/photo` implementation would have nowhere to write to and no way to read it back.
Both reasons added to [BUG-12](docs/api/backend-issues.md). The plan's original "wire `POST
/admin/photo` for upload" item is struck; the shared `<Avatar name photo={null} />` initials fallback
(Phase 4) is the permanent answer, not a placeholder.

### Trap 3 — logout — wired, proven end-to-end

`AuthContext.logout` now calls `authApi.logout(authKind, accessToken)` (endpoint picked by
`authKind`, exactly as `authApi.logout` already supported), while still clearing React state and
`localStorage` unconditionally and immediately so the browser session ends even on a dead network.
**Found and fixed a real race in the process:** firing the request and synchronously clearing
`localStorage` in the same tick meant axios's request interceptor — which reads the token from
`localStorage` as a microtask — read `null` and sent the logout call unauthenticated. Fixed by
passing the access token explicitly (mirroring `authApi.me(token?)`'s existing pattern) instead of
relying on `localStorage` timing. **Proven live:** capture the access token, log out, replay it
against `GET /staff/me` → `401` (was `200` before the fix).

### Work items

- [x] **Home** — `home/pages/Home.tsx` deleted along with its route and lazy import. `/` now renders
      `RoleHome`, a `<Navigate>` to `defaultRouteForRole(role)`. The plan's premise (two mock buttons)
      was already stale — Phase 1.5 had removed them, leaving a single real `/dashboard` CTA — but
      that CTA still dead-ended a `support_agent`, who cannot open `/dashboard`, so the redirect is
      still the right fix. `common.welcome`, referenced by the deleted page but never defined in
      either locale (Phase 13's audit had already flagged it as a raw-key leak), is now moot.
- [x] **Header search** — removed rather than built. The plan's justification was wrong: only
      `/admin/users` and `/admin/drivers` accept a `search` param; `AdminTripController` has none
      (grepped, zero matches), so "cross-entity search" would have spanned two entities through two
      separate paginated endpoints with no combined route, not three through one.
- [x] **Admin avatar** — left on the initials fallback (Trap 2). No upload control wired.
- [x] **Header identity dropdown** — the static name/role block is now a real `role="menu"` dropdown
      (click-to-open, click-outside-to-close) showing the employee's name, `role_label`, `email` and
      `last_login_at` (all from `/staff/me` via `AuthContext`, locale-formatted with
      `toLocaleString(i18n.language, …)` — not `'ar-SY'`-pinned), plus the language/RTL toggle rescued
      from Phase 11 and Logout. Nothing else, per the requirement — no "profile", no "preferences", no
      "account settings". `User.lastLoginAt` added to the shared type and `authApi`'s employee mapper
      so this didn't need a new fetch. The login-screen language toggle (`AuthLayout.tsx`) and this
      one now share one `toggleLanguage()` in `app/i18n.ts` instead of two copies.
- [x] **Dead controls removed** — the second handler-less help button (`MainLayout.tsx`, next to the
      bell) and `AuthLayout`'s help button + all three `href="#"` footer links (help centre, terms,
      privacy). Their locale keys (`auth.help_center`, `auth.terms_of_use`, `auth.privacy_policy`)
      deleted from both languages after confirming no other consumer.
- [x] **Nav/route/role consistency, enforced structurally and tested.** `routes/index.tsx` used to
      hand-write one `<Route>` block per section with no link back to `MainLayout.NAV_ITEMS` or
      `roles.SECTION_ROLES`; a drift between them (wrong path, forgotten `RoleRoute`, orphaned nav
      entry) had nothing to catch it. `NAV_ITEMS` moved to `components/layout/navItems.ts` and a new
      `routes/sectionRoutes.ts` exports `SECTION_ROUTES: {section, path, Component, detail?}[]`; the
      route tree is now generated from that array with every section uniformly wrapped in
      `<RoleRoute>` (previously `/reviews` and `/support` were not). New `tests/app/nav.test.ts`
      asserts the three lists (`NAV_ITEMS` sections, `SECTION_ROUTES` sections, `SECTION_ROLES` keys)
      are exactly equal and that every nav `to` matches its section's route path — 4 new cases.

**DoD:** ✅ nothing in the shell is a placeholder (bell, second help button, footer links and the
inert search box are gone rather than dressed up); ✅ a stored token stops working after logout,
proven by replaying it (`401`, previously `200`).

---

## Phase 13 — Cross-cutting hardening — ✅ **DONE 2026-08-14**

Apply uniformly across every page touched above. Audited, not assumed — most of this list turned out
to already be satisfied by Phases 2–10, confirmed by sweeping every page rather than trusting the
plan's own earlier claim:

- [x] ~~**Loading**~~ ✅ already comprehensive. `TableSkeleton` is used by every table page (Trips,
      Bookings, Drivers, Reviews, Staff, Support, Users, UserDetails, Dashboard's recent-activity
      table, Reports' transaction table and wallet-transactions drawer); Verifications has its own
      `RequestListSkeleton`, DriverDetails an early `isLoading` spinner branch. No layout-shift gaps
      found.
- [x] ~~**Errors**~~ ✅ every list page already uses `ErrorBanner` + `extractApiError`, wired since
      Phases 2–9.
- [x] ~~**Empty states**~~ ✅ audited — every table-bearing page/component has an explicit
      `length === 0` branch (20 files checked); none render a bare empty `<tbody>`.
- [x] ~~**Pagination**~~ ✅ `TablePagination` confirmed on every `meta`-backed list, including wallet
      requests (`TransactionTable.tsx`, wired in Phase 9 — the one item this list flagged as
      unaudited; it was already done).
- [x] ~~**Concurrency**~~ ✅ **done this phase** — see the stale-response guard in `useFetchEffect`
      below; applied to all 15 consuming hooks.
- [x] ~~**Single-flight token refresh**~~ ✅ **done this phase** — `src/services/api.ts` now shares
      one in-flight refresh promise (`refreshAccessToken()`) across every queued 401; proven by
      `tests/services/api.test.ts`'s two new cases (exactly one `POST /refresh` under two concurrent
      401s, and a fresh refresh for a later non-concurrent one).
- [x] ~~**403 handling**~~ ✅ **done this phase.** `RoleRoute`'s panel extracted to
      `features/shared/components/NoPermissionPanel.tsx`. Every list hook now tracks an `isForbidden`
      flag separately from `error` (a 403 is a permission fact, not a retryable failure — no Retry
      button, no "request failed" message) and every page renders the same panel instead of
      `ErrorBanner` when it's true: Trips/Bookings, Dashboard, Drivers/DriverDetails, Verifications,
      Support, Users/UserDetails (only the page-gating `fetchProfile`, not the five independent
      per-section refreshes — a 403 on one stat widget is a smaller, already-tolerable failure, not a
      whole-page permission problem), Reports (two independent fetchers, `isReportForbidden` /
      `isRequestsForbidden`, OR'd together), and `WalletTransactionsDrawer` (its own hook, own
      forbidden state, scoped to the drawer's body rather than the whole Reports page — the drawer's
      header/close button stay). `staff/pages/Staff.tsx` is the deliberate exception — BUG-1's
      `isBackendAvailable` gating already covers it, a different concern. 12 new hook-level tests, one
      per touched hook, proving a 403 sets `isForbidden` and leaves `error` null.
- [x] ~~**i18n**~~ ✅ **three real gaps found and fixed, one already moot.** Of the four raw-key leaks
      flagged at the end of Phase 9/10 (`common.welcome`, `trips.view_details`, `trips.cancel_trip`,
      `auth.email`): `common.welcome` is moot — its only call site, `home/pages/Home.tsx`, was deleted
      whole in Phase 12. `trips.view_details`, `trips.cancel_trip` (both `title=` tooltips in
      `TripsTable.tsx`) and `auth.email` (a field label in `UserDetails.tsx`/`Users.tsx`) were
      genuinely undefined in both locales — all three added to `ar`/`en`.
- [x] ~~**Dates**~~ ✅ confirmed no remaining hardcoded `'ar-SY'` — `useDriverDetails.ts`,
      `useUserDetails.ts` and `useReviews.ts` each carry only a comment noting the earlier fix
      (Phases 4/5/8); the header identity dropdown's `last_login` (Phase 12) and `BanStatusBanner`
      already format off `i18n.language`.
- [x] ~~**Avatars**~~ ✅ done in Phase 4.

---

## Phase 14 — Tests — ✅ **DONE 2026-08-14**

Existing: `tests/{auth,hooks,services}` (vitest + msw), `e2e/smoke.spec.ts` + `e2e/apiStubs.ts` (Playwright).

- [x] `tests/testServer.ts` kept exactly as-is (Phase 7's no-baseline-handlers reasoning still holds).
      Instead, a new `tests/services/removedEndpoints.test.ts` asserts the actual invariant: `ENDPOINTS`
      resolves to none of `/admin/settings`, `/admin/broadcast-alert`, `/staff/complaints/metrics`,
      `/admin/verifications`; no module under `src/` references one of those literals outside
      `endpoints.ts`'s own explanatory comment; `staffApi.deleteEmployee` doesn't exist (BUG-4); and
      `roles.ts` carries no leftover `settings` reference. 4 new tests.
- [x] `tests/services/api.test.ts` — single-flight refresh: exactly one `POST /refresh` under two
      concurrent 401s (both original requests still succeed off the one rotated token), and a genuinely
      fresh refresh for a later, non-concurrent 401. 2 new tests. Also fixed a real test-isolation bug
      while writing these: `api.defaults.headers.common['Authorization']`, set by the interceptor on
      every successful refresh, was never reset between tests, so a token committed by one test's
      refresh silently outlived it and won over the next test's `localStorage` setup. `tests/setup.ts`
      now clears it in `afterEach`.
- [x] `tests/auth/AuthContext.test.tsx` — role-from-`/staff/me` and `sycash` were already covered; added
      3 new cases for Phase 12 Trap 3: `logout()` calls `POST /staff/logout` for a staff session with
      the access token attached explicitly (not read from `localStorage`, which the same synchronous
      call already cleared — a real race the test caught and `authApi.logout(kind, token?)` now avoids),
      `POST /admin/logout` for an admin session, and the local session clears immediately even when the
      request has no handler (dead network).
- [x] ~~`useTrips` (paging)~~ ✅ done in Phase 3 (`tests/hooks/useTrips.test.ts`, `useBookings.test.ts`); ✅ `useDrivers` / `useDriverDetails` / `Avatar` in Phase 4; ✅ `useUsers` (date filter) / `useUserDetails` in Phase 5. ✅ `useSupport` (14 cases) and `useReviews` (9) in Phases 7–8, covering the type/date filters, the escalated-tab guard, the `counts`-driven badges, page-reset-on-filter-change and the `show()` side effect. ✅ Phase 13 added a stale-response-guard test to all 15 hooks and a 403/`isForbidden` test to the 12 that render `NoPermissionPanel`.
- [x] **`e2e/apiStubs.ts` rebuilt.** Removed the `/admin/settings` success fixture (Phase 11 deleted the
      route) and the `/staff/complaints/metrics` fixture (Phase 7 deleted the frontend call — BUG-8).
      `reportFixture.financial_stats` corrected to the REAL live shape (confirmed 2026-08-14:
      `sycash.{current_balance,total_escrow_in,total_escrow_out,total_refunds_paid}`,
      `primary_admin.{current_balance,total_platform_fees}` — the old `total_collected`/
      `total_disbursed` fields Phase 9 proved don't exist are gone). The `{status:'success',data:[]}`
      catch-all replaced with a **negative rule**: any unstubbed path now returns a distinctive `599`
      and is recorded in a returned `unstubbed[]` array every test asserts is empty — the exact failure
      mode that let the settings/metrics stubs rot unnoticed.
- [x] **`e2e/smoke.spec.ts`** extended with the full `system_admin` walkthrough: login → dashboard →
      trips page 2 (asserts `page=2` on the wire) → ban a user (`POST /admin/users/501/ban`) → approve a
      verification (`POST /staff/verifications/502/approve`) → resolve a complaint (`PATCH
      /staff/complaints/503/respond`) → approve a wallet request (`POST
      /admin/wallet/requests/504/approve`) → create an employee. The last step is stubbed as its **real
      500** (BUG-1), not a fabricated success, and asserts the `staff-unavailable` panel renders with no
      `create-submit` control reachable — exactly what the live backend does today. Every test also
      asserts zero unstubbed requests and zero requests to a removed route
      (`page.on('request')` against the same removed-route list `verify-shell.mjs` uses).
      **8/8 e2e tests pass.**
- [x] `npx tsc -b`, `npm run lint`, `npm test`, `npm run build` all clean. **227 passing** (baseline
      198 → +29: 4 nav-consistency, 4 `useFetchEffect`, 2 single-flight, 4 removed-endpoints, 3
      AuthContext, 12 `isForbidden`).

---

## Phase 15 — Ship — ✅ **DONE 2026-08-14**

1. [x] **`vercel.json`** — the dead `https://api.onwayride.me` rewrite target is gone (confirmed 404s
       everything, `probe-results.md` §1). Asked the user directly rather than guess at a replacement
       host: the answer was that no production host exists yet. The rewrite now targets
       `$API_PROXY_TARGET`, a Vercel project env var left unset — see `.env.example`'s new deployment
       section for how to set it once a real host exists. **The absence is loud, not silent**: new
       `src/app/ApiConfigGuard.tsx` probes the public `GET /test` health route once on boot and renders
       "No API configured for this deployment" instead of the dashboard when it gets a true
       network-level failure (no HTTP response at all) — as opposed to every page quietly 404ing on its
       own and reading as "the app is broken." `e2e/apiStubs.ts` stubs `/test` so the guard doesn't
       trip the negative-rule check in tests. SPA fallback (`/((?!api/).*)` → `/index.html`) confirmed
       to already cover every surviving route, including deep links (`/passengers/12`, `/drivers/3`) —
       unchanged, was already correct.
2. [x] `VITE_API_BASE_URL=/api` + the rewrite still means no cross-origin call in prod, so
       `config/cors.php` (Q9) stays off the critical path — `.env.example` confirmed accurate and
       extended with the `API_PROXY_TARGET` deployment note above.
3. [x] **Production build smoked** — `npm run build` (clean) → `npm run preview` on :4173, driven by a
       real Chromium session against the local backend as `system_admin`: login succeeds, all 8
       role-visible pages render real content, `/settings` falls through to `/dashboard` rather than a
       blank shell, and the only console entry is the expected BUG-1 500 from `/staff`. A `tsc -b` pass
       is not a smoke test, so this ran the actual built bundle end-to-end.
4. [x] **`docs/api/decisions.md` updated** — Q10's production half answered (no host, see `vercel.json`
       above); section D gets a note recording the Postman file deletion (item 5 below) and why it
       doesn't lose information.
5. [x] **`collection.json` and `SyRide_All_APIs_merged.postman_collection.json` deleted**, confirmed
       with the user first. Their only useful content — the D1–D6 divergences from the real backend —
       was already captured in prose in `decisions.md`; the raw JSON added nothing beyond that and read
       as a second, stale contract someone could mistake for authoritative.

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
3. ~~Can `GET /staff/complaints/metrics` be added, registered **before** the `{id}` route?~~ ✅ **Answered on fact in Phase 7 and no longer blocking:** it does not exist and returns **500 with a stack trace**, not 404 ([BUG-8](docs/api/backend-issues.md)). The KPI row is now derived from `counts` and the unsupportable card removed ([REQ-5](docs/api/backend-issues.md)). What remains is a *request*, not a question — plus a genuine defect: constrain the route (`->whereNumber()`) so `/staff/complaints/abc` 404s instead of exploding.
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
| 6 — Verifications | 1 | ✅ done 2026-08-12 |
| 7 — Support | 0, 1 | ✅ done 2026-08-13 |
| 8 — Reviews | 1 | ✅ done 2026-08-13 |
| 9 — Reports & Wallet | 1 | ✅ done 2026-08-13 |
| 10 — Staff | 0, 1 | ✅ done 2026-08-13 (blocked on BUG-1 server-side) |
| 11 — Settings | 0 | ✅ done 2026-08-14 (option (b): deleted) |
| 12 — Shell | 1 | ✅ done 2026-08-14 |
| 13 — Hardening | 2–12 | ✅ done 2026-08-14 |
| 14 — Tests | 2–13 | ✅ done 2026-08-14 (227 passing, +29 from the 198 baseline) |
| 15 — Ship | 14 | ✅ done 2026-08-14 (still no production API host — by the user's own choice, made loud rather than guessed) |

Phases 2–12 are independent of each other and can be split across people once Phase 1 lands.

All fifteen phases are now done. What's left is not frontend work: **Q6, Q8, Q9, Q11** in
`decisions.md` table A are still open and need the backend developer, and a real production API host
is still unknown (Q10's production half). Everything the dashboard itself controls is verified against
a live backend, including the shell, the hardening pass and a production-build smoke test.
