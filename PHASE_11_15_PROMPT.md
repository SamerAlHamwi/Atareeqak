# Prompt — Phases 11 → 15 (Settings · Shell · Hardening · Tests · Ship)

> Paste everything below the line into a fresh session.

---

Continue with **Phase 11 (Settings)**, **Phase 12 (Shell)**, **Phase 13 (Cross-cutting hardening)**,
**Phase 14 (Tests)** and **Phase 15 (Ship)** from BACKEND_INTEGRATION_PLAN.md. These are the last
five. Do them in order — 13 depends on 11 and 12 being settled, 14 depends on 13, 15 depends on 14.

**Two standing requirements from the project owner. They apply to every phase below and they are the
acceptance criteria, not preferences:**

1. **Every component in the UI must be linked to the backend.** No rendered control may exist without
   a real, verified endpoint behind it. A button that does nothing, a toggle that saves nowhere, an
   input whose value is never read, a badge whose number is a literal — all of these fail.
2. **Make the UI match the backend data.** Where a component cannot be supported by the payload,
   **restructure or remove it**. Do not keep the shape and fill it with invented, hardcoded, derived-
   and-presented-as-server-truth, or permanently-dashed values.

For Phases 1–10 those were constraints on new work. **For Phases 11 and 12 they *are* the work.**
Settings and the app shell are the two surfaces that were never backed by anything, and they are
where every remaining fake control in the project lives. Phase 13 then proves the claim across the
whole app; Phase 14 makes a regression fail loudly; Phase 15 ships it.

---

## §0 — Where you are starting from (verify, don't trust this list)

- Phases 1–10 are implemented and verified against the live backend. Eight acceptance scripts exist:
  `verify-auth.sh`, `verify-dashboard.mjs`, `verify-trips.mjs` (85), `verify-drivers.mjs` (94),
  `verify-users.mjs` (137), `verify-verifications.mjs` (51), `verify-support.mjs` (105),
  `verify-reviews.mjs` (64), plus `verify-reports.mjs` and `verify-staff.mjs` from Phase 9/10.
- **Unit baseline: `npm test` → 19 files, 198 passing, 0 failing.** Confirm this before you change
  anything; if it is not 198, find out why before writing code.
- Next free issue numbers in `docs/api/backend-issues.md`: **BUG-13**, **REQ-7**, **NOTE-4**.
- Phase 9/10's work is **uncommitted and the plan was never updated for it.**
  `BACKEND_INTEGRATION_PLAN.md` still shows Phases 9 and 10 as unchecked `[ ]` boxes, and
  `docs/api/README.md`'s table still stops at `verify-reviews.mjs` — `verify-reports.mjs` and
  `verify-staff.mjs` are not listed. **Fix both before starting Phase 11**, including the assertion
  counts from a real re-run, so the record matches the code.

---

# 🔴 Phase 11 — Settings. Read this before touching `src/features/settings/`.

**The plan says "`GET/POST /admin/settings` does not exist. This whole page is built on it." That is
true and it is the smaller half of the problem.**

The route really is absent — **zero** of the 145 routes in `docs/api/route-list.json` match
`settings`, and `decisions.md` C1/Q1 records it as RESOLVED-absent. But if the endpoint shipped
tomorrow, **most of this page still would not work**, because most of its controls are not wired to
`useSettings` either. There are three independent layers of fake here, and only the first one is the
missing endpoint.

### Layer 1 — the endpoint does not exist

`useSettings.fetchSettings()` calls `GET /admin/settings`, catches the 404, stores it in an
`Error | null`, and `console.error`s it. All five state fields keep their initial values (`''`, `''`,
`0`, `0`, `''`). **The page therefore renders as a perfectly normal settings form with blank fields
and a zeroed commission slider** — it does not read as broken, it reads as "not configured yet". The
Save button posts to the same 404.

### Layer 2 — most controls are not bound to anything, endpoint or not

Inventory the page yourself and you will find this. **Verify it, don't take the table on faith:**

| Control | Component | Bound to | Sent by `saveSettings()` |
|---|---|---|---|
| App name (text) | `PlatformConfig` | `useSettings.appName` | ✅ `app_name` |
| Support email (email) | `PlatformConfig` | `supportEmail` | ✅ `support_email` |
| **Working hours from / to** (2 `<select>`) | `PlatformConfig` | `defaultValue`, never read | ❌ |
| Platform commission (range) | `PaymentSettings` | `commission` | ✅ `commission_rate` |
| Min withdrawal (number) | `PaymentSettings` | `minWithdrawal` | ✅ `min_withdrawal` |
| **Accepted payments** (4 checkboxes) | `PaymentSettings` | nothing at all | ❌ |
| **4 notification toggles** | `NotificationRules` | `defaultChecked` on a local literal array | ❌ |
| **Auto-block: complaints/month `3`, cancellations `15%`** | `ModerationRules` | `defaultValue`, never read | ❌ |
| **"Active" badge** on auto-block | `ModerationRules` | literal | ❌ |
| Prohibited words (textarea) | `ModerationRules` | `moderationWords` | ✅ `moderation_words` |
| **`v2.4.0-stable` / last update / "secure environment"** | `Settings.tsx` footer | hardcoded strings | ❌ |
| `alert_message`, `maintenance_mode` | typed in `AppSettingsResponse` | rendered nowhere | typed, never sent |

**Five of roughly fifteen visible controls would be saved even against a working endpoint.** The
other ten are decoration. `NotificationRules` is the extreme case: it takes no props, holds no state,
and its four toggles cannot be read by anything — they are an animation.

### Layer 3 — some of it describes a different product

`PaymentSettings` offers **Mada**, **Apple Pay** and **Visa/MC** as accepted payment methods. This is
a Syrian ride-hailing platform whose only money path is the internal SYP wallet — `wallet_requests`,
`wallet_transactions`, `CashRideFeeService`. There is no card processor, no `payment_methods` table,
and no endpoint anywhere in the route list that could accept or return this. Same for working hours
and the auto-block thresholds: no column, no service, no route. These are not "unimplemented" —
**nothing in the backend has the concept**.

### Also: the route is not role-gated

`src/routes/index.tsx:82` mounts `/settings` **outside any `RoleRoute`**, while
`src/app/roles.ts` declares `settings: ADMIN_AND_UP`. The nav hides it from a `support_agent`, but
typing the URL renders it. Whatever you decide below, that inconsistency must not survive.

## Decide, and say which you chose

The plan offers (a) build-behind-a-flag, (b) delete, (c) read-only "not yet available".

**The recommendation is (b), and the layer-2/layer-3 evidence above is why:** an option-(a) flag
implies the page is finished and waiting for a route, which is false — ten of its controls would
still be dead the day the route lands, and three of them describe payment rails this product does not
have. Option (c) keeps a page whose entire content is a placeholder.

**If you choose (b), delete all of it and leave nothing orphaned:**

- `src/features/settings/` entirely — `settingsApi.ts`, `useSettings.ts`, `Settings.tsx`, and all
  four components.
- `ENDPOINTS.SETTINGS` — and leave a comment in its place explaining why, exactly as Phase 7 did for
  `SUPPORT_METRICS` and Phase 10 did for `BROADCAST_ALERT`. That comment pattern is now the house
  rule for a deleted route.
- The `/settings` route and the `settings` nav entry in `MainLayout.NAV_ITEMS`.
- `'settings'` from `AppSection` and `SECTION_ROLES` in `src/app/roles.ts` — **and the stale comment
  on lines 53–54 that says settings is backed by `/admin/settings`**, which the plan calls out
  explicitly.
- All **44** `settings.*` keys in **both** `src/locales/{ar,en}/translation.json`, plus
  `header.search_settings_placeholder`. Check for collateral: `settings.active` and `settings.cash`
  may be referenced elsewhere — grep before deleting, and keep any key that still has a consumer.
- `/settings` from `ROUTES_BY_ROLE` in `e2e/smoke.spec.ts` (both `system_admin` and `admin`), and the
  `/admin/settings` stub in `e2e/apiStubs.ts` — see Phase 14, that stub is actively harmful.
- The `*` fallback route sends unknown paths to `/`; make sure a bookmarked `/settings` lands
  somewhere sensible rather than on a blank shell.

**What you must preserve:** the language/RTL toggle is genuinely client-side and genuinely real —
but note it currently exists **only on the login screen** (`AuthLayout.tsx:8-12`). Once inside the
app there is no way to switch language at all. Moving it into a header profile menu is Phase 12
work item 4; do not drop it on the floor between the two phases.

**Whatever you choose, record it in `decisions.md` Q1 and in the plan's Phase 11 section**, with the
layer-2 finding — the backend developer's answer to "is `/admin/settings` planned?" should be
informed by the fact that two thirds of the page it would serve was never wired.

**DoD:** no user-visible control anywhere in the app produces a request to a non-existent route, and
`grep -r "admin/settings" src/ e2e/ tests/` returns only deliberate comments.

---

# 🔴 Phase 12 — Shell. Three traps, all confirmed in the backend source.

## Trap 1 — the notification bell has a backend, and you must not use it

`MainLayout.tsx:132-135` renders a bell with a **hardcoded red unread dot** and no dropdown, no
handler, no data. It looks like an unread-notifications indicator. It is a `<span>`.

There *are* notification routes — eight of them:

```
GET    api/notifications                 GET  api/notifications/unread-count
GET    api/notifications/categories      POST api/notifications/read-all
POST   api/notifications/{id}/read       POST api/notifications/{id}/unread
POST   api/notifications/bulk-action     DELETE api/notifications/{id}
```

**Every one is `jwt`-guarded, not `staff`.** That is the end-user middleware
(`JwtAuthMiddleware`), and it does `User::find($payload['sub'])` — it looks the subject up in the
**`users`** table. A staff token's `sub` is an **`employees`** id.

Both realms sign with the same key: `StaffJwtService::secret()` and `JwtService` both return
`config('jwt.secret')` raw (there is a comment in `StaffJwtService` explaining that the base64 decode
was removed *specifically* so the two match). `JwtAuthMiddleware` checks `type === 'access'` and
never looks at the `sub_type` claim that `StaffJwtService` sets.

**So a staff token presented to `/api/notifications` decodes successfully and is resolved against
whatever `users` row happens to share that id.** Whether the request then succeeds depends only on
`validateTokenVersion()` — employee `ver` vs that unrelated user's `token_version`.

**Probe this live before writing a word about it.** Log in as `system_admin` (employee id 1) and
`curl` `GET /api/notifications/unread-count` with the staff access token. There are three possible
outcomes and they need different write-ups:

- `401 TOKEN_INVALIDATED` / `USER_INACTIVE` → the realms happen not to collide today. Endpoint is
  unusable by the dashboard; file it as a gap.
- `200` with data → **a staff token is reading a passenger's private notifications.** That is a
  cross-realm authentication defect, file it as **BUG-13 at 🔴**, and say plainly that the fix is a
  `sub_type` check in `JwtAuthMiddleware`, not a frontend workaround.
- `404 USER_NOT_FOUND` → same conclusion as the first, different code.

**In all three cases the outcome for the UI is the same: there is no staff-reachable notifications
endpoint.** Remove the bell and its fake dot. Do not build a notification centre against a route that
authenticates as the wrong person.

## Trap 2 — the avatar upload is unbuildable for three independent reasons

The plan's item says "wire `POST /admin/photo` (multipart) for upload". Do not.

1. **The endpoint is a stub that lies.** `AdminDashboardController::uploadAdminPhoto()` is a one-line
   `return response()->json(['status' => 'success', 'message' => 'Photo uploaded']);` — no validation,
   no file handling, no storage write, no DB write. A POST with **no file at all** returns `200`
   `success`. Already filed as **BUG-12**.
2. **There is nowhere to store it.** The `Employee` model has no `photo`, `avatar` or `image`
   attribute — grep it.
3. **There is nowhere to read it from.** `GET /staff/me` → `EmployeeAuthService::formatEmployee()`
   returns exactly `id, username, email, full_name, role, role_label, is_active, last_login_at,
   created_at`. No photo field.

Phase 4's shared `<Avatar name photo />` with initials is already in the header
(`MainLayout.tsx:152-159`) and is the correct final answer. **Delete the plan's upload item, extend
BUG-12 with reasons 2 and 3** (the missing column is the reason the stub can never be completed as
written), and note in the plan that this is a removal, not a deferral.

## Trap 3 — logout never reaches the server

`useAuth().logout` — the function the sidebar button calls — is `AuthContext.tsx:53-62`. It clears
five `localStorage` keys and nothing else. **`authApi.logout()` exists, is correct, calls
`POST /staff/logout` or `/admin/logout`, and is called from nowhere in `src/`** (grep it: the only
hit for `logout(` outside the context is the context's own 403/404 self-eviction).

So `StaffJwtService::revokeAllTokens()` never runs, the refresh-token family is never revoked, and
`token_version` is never bumped. **A copied access token keeps working after the user logs out, for
up to its full 1 h TTL, and the refresh token keeps working for days.**

Wire it, and mind the details:
- Pick the endpoint from `authKind` (`authApi.logout` already does — pass it through).
  `POST /admin/logout` is `staff:admin,system_admin`, so a `support_agent` on the admin path would
  403; `auth_kind` will be `'staff'` for them, but don't rely on luck — assert it.
- The local session must be cleared **even if the request fails** (`authApi.logout` already uses
  `finally`). A user on a dead network must still be able to log out of the browser.
- **This is the one item in Phase 12 that is provable end-to-end.** Prove it: capture the access
  token, log out, replay the token, assert `401`. That single assertion is the phase's DoD.

## Phase 12 work items

1. **Home** — `src/features/home/pages/Home.tsx` is now a single CTA to `/dashboard` (the two mock
   buttons the plan describes are already gone — confirm and strike that from the plan). It still
   renders a marketing splash to a logged-in admin at `/`, and a `support_agent` who cannot reach
   `/dashboard` gets sent to a dead end by its only button. Make `/` a `<Navigate>` to
   `defaultRouteForRole(role)` and delete the page, its lazy import and its route. That is the
   plan's own "simplest correct answer".
2. **Header search** — inert `<input>` at `MainLayout.tsx:119-123`. ⚠️ **The plan's justification is
   wrong**: it says "users + drivers + trips share a `search` param". They do not.
   `AdminUserController` and `AdminDriverController` both validate `search|sometimes|string|max:100`;
   **`AdminTripController` has no `search` parameter at all** — grep it, there are zero matches.
   `/staff/reviews` has one but it matches the comment body only (proven in Phase 8).
   So a "cross-entity search" spans two entities, not three, and its two backends are separate
   paginated endpoints with no combined route. **Recommendation: remove the box.** If you instead
   build it, it must be a real typeahead over `/admin/users?search=` + `/admin/drivers?search=`
   with a debounce, an empty state, and role-gating (both are `staff:admin,system_admin`, so it must
   not render for `support_agent`/`sycash`) — and it must be verified like any other feature. Do not
   ship a third option.
3. **The help button** — `MainLayout.tsx:129-131`, no `onClick`. Remove it, or point it at something
   real. Same for `AuthLayout.tsx:28-30` (a second handler-less help button) and the three
   `href="#"` footer links (help centre, terms, privacy). These are components not linked to
   anything; requirement 1 covers the login screen too.
4. **Header identity dropdown** — the name and role label already come from `AuthContext` and are
   real (`user.name`, `user.roleLabel`, both from `/staff/me`). Turn the static block into a real
   menu containing **only what exists**: the employee's name, `role_label`, `email`, and
   `last_login_at` from `/staff/me` (locale-formatted, not `'ar-SY'`-pinned); the **language/RTL
   toggle rescued from Phase 11**; and Logout. Nothing else — no "profile", no "preferences", no
   "account settings", because there is no endpoint for any of them.
5. **Sidebar nav** — after Phase 11 and item 1, re-check `NAV_ITEMS` against `SECTION_ROLES` and
   against `routes/index.tsx`. Every nav entry must have a route, every protected route must have a
   `RoleRoute`, and the two role tables must agree. Add a test that asserts it rather than an
   inspection that claims it.

**DoD:** nothing in the shell is a placeholder; a stored token stops working after logout, proven by
replaying it.

---

## Phase 13 — Cross-cutting hardening

The plan's list is mostly already satisfied by Phases 2–10 (skeletons, `ErrorBanner` + retry, empty
states, `TablePagination`, `extractApiError`, locale-aware dates, the shared `<Avatar>`). **Two items
are genuinely unimplemented, and both are real bugs, not polish. Do those first.**

1. **🔴 Single-flight token refresh.** `src/services/api.ts:76-114` has no shared refresh promise.
   Every 401'd request calls `POST /refresh` independently. Refresh tokens are **single-use and
   rotate** — verified live, filed as NOTE-1 — so the second concurrent refresh replays a consumed
   token, fails, and `endSession()` throws the user to `/login`.
   Dashboard, Reports and Trips each fire several parallel fetches on mount, so this is a one-tab-
   left-open-for-an-hour bug, not a theoretical one. Share one in-flight promise across all queued
   requests; queued requests await it and replay with the new token.
   **Prove it with a test, not an argument:** two simultaneous 401s must produce exactly **one**
   `POST /refresh` and two successful retries. `tests/services/api.test.ts` exists — extend it.
2. **🔴 Stale-response guard.** `useFetchEffect` (`src/features/shared/hooks/useFetchEffect.ts`) has
   no `AbortController` and no sequence guard: it fires `fetch()` and lets whatever resolves last win.
   Change a filter twice quickly and the *first* response can overwrite the second. Every list page
   in the app is built on this hook, so fix it once, here. A monotonic request-sequence guard in the
   hook is simpler than threading `AbortSignal` through eleven feature hooks — but whichever you
   choose, the fix belongs in the shared hook, not copy-pasted per feature.
   **Prove it:** a test where a slow first request resolves after a fast second one, asserting the
   second's data survives.
3. **403 handling** — `RoleRoute` blocks navigation, but a mid-session role change still yields a
   403 from the API. `api.ts:72-74` already passes 403 through to the page deliberately. Make the
   pages render the same "no permission" panel `RoleRoute` uses, instead of a generic `ErrorBanner`.
4. **Audit, don't assume, for the rest of the list.** For each of loading / errors / empty states /
   pagination / i18n / dates, sweep every page and record what you actually found. Anything already
   done gets struck through in the plan with the phase that did it, as the plan already does for
   avatars and `useTrips`.

### 🆕 The Phase 13 deliverable that closes requirement 1

Write **`docs/api/component-endpoint-map.md`**: one row per interactive component in `src/`, listing
the endpoint behind it, or `client-side only` with the reason, or `REMOVED in phase N` with the
reason. Sweep every `<button>`, `<input>`, `<select>`, `<a>` and toggle in `src/features/` and
`src/components/`.

This is the artifact that makes "every component is linked to the backend" checkable instead of
claimed — and the sweep is how you find the ones this prompt missed. **If the sweep finds a fake
control not named anywhere above, fix it under the same rule and say so.** Do not quietly leave it
because it was out of scope.

---

## Phase 14 — Tests

**`e2e/apiStubs.ts` currently stubs two routes that do not exist, as successes.** This is the exact
failure mode the plan's first bullet is about, shipping today:

- `['/admin/settings', {...}]` — a full success fixture for the 404 route Phase 11 is deleting. The
  e2e suite renders a *populated* Settings page that can never exist against the real backend.
- `['/staff/complaints/metrics', {...}]` — deleted from the frontend in Phase 7 (BUG-8: it 500s with
  a stack trace, it does not even 404). The stub outlived the code it served.
- **`reportFixture` is stale and wrong.** It still uses `financial_stats.primary_admin.total_collected`
  and `.total_disbursed`, the two fields Phase 9 proved do not exist in the payload. The e2e suite is
  asserting against the shape the live API was confirmed *not* to return.

Work items:

1. **Delete those stubs and correct `reportFixture`** against the payload Phase 9 verified. Then add
   a **negative** rule: any request to a path not in `rules` should fail the test loudly rather than
   fall through to `{ status: 'success', data: [] }` (the current catch-all at the bottom of
   `stubApi`, which is why a stub for a dead route was invisible). That catch-all is what let this
   rot; replace it.
2. **`tests/testServer.ts` — the contract handlers.** It deliberately has no baseline handlers
   (Phase 7's reasoning is in its docblock, and it is sound — keep it). The plan's ask, "so a
   regression that re-introduces `/admin/settings` fails loudly", is better served by an explicit
   test than a baseline handler: assert that `ENDPOINTS` contains no removed route, and that no
   module under `src/` references one. Removed so far: `/admin/settings`, `/admin/broadcast-alert`,
   `/staff/complaints/metrics`, `DELETE /employees/{id}`, `/admin/verifications*`.
3. **`tests/services/api.test.ts`** — the three refresh/403 cases from plan §1.4, plus the
   single-flight case from Phase 13 item 1.
4. **`tests/auth/AuthContext.test.tsx`** — the file exists; extend it for: role comes from
   `/staff/me` and not from the login response, `sycash` renders correctly, and **logout calls the
   API** (Phase 12 trap 3).
5. **`e2e/smoke.spec.ts`** — extend to the full `system_admin` walkthrough the plan asks for:
   login → dashboard → trips page 2 → ban a user → approve a verification → resolve a complaint →
   approve a wallet request → create an employee. ⚠️ **The last step cannot pass against the real
   backend (BUG-1) and must not be stubbed as a success** — stub it as the `500` it really returns
   and assert the UI's unavailable state, or drop the step and say why. A green e2e step for a
   destructive endpoint that writes-then-500s would be the worst artifact in the repo.
6. `npm run lint && npm test && npm run build` clean. **Do not let the count go down**; 198 is the
   floor, and Phases 11–13 should add to it even though Phase 11 deletes a feature.

---

## Phase 15 — Ship

1. **`vercel.json` rewrites `/api/*` → `https://api.onwayride.me/api/*`, and that host is not this
   backend.** It is live, runs an Express service, and 404s everything including `/staff/me` —
   `probe-results.md` §1, and Q10 in `decisions.md` is RESOLVED on exactly this point: *"no live
   server exists and that host serves a different backend"*, with the production answer still open.
   **Shipping this file as-is deploys a dashboard that 404s on every request.** Either get the real
   production host from the user, or replace the rewrite with a build-time-configured target and
   make the absence loud (a startup check that surfaces "no API configured" rather than a wall of
   failed requests). Do not leave a stale host in place because it is what was there.
2. Confirm `VITE_API_BASE_URL=/api` + the rewrite means no cross-origin call in prod, so
   `config/cors.php` (Q9) stays off the critical path. `.env.example` documents this well already —
   check it still matches after any change, and that its "there is no deployed API" note is still
   accurate.
3. Confirm the SPA fallback (`/((?!api/).*)` → `/index.html`) covers every route that survives
   Phases 11–12, including deep links like `/passengers/12` and `/drivers/3`.
4. **Smoke the production build** — `npm run build && npm run preview` against the local backend, as
   a real `system_admin`, top to bottom through §2's matrix. A `tsc -b` pass is not a smoke test.
5. **Record the verified contract in `docs/api/decisions.md`** — every question Phases 1–15 answered
   on fact moves from PENDING to RESOLVED with its evidence. Q1 (settings) and Q2 (broadcast) are now
   answerable as decisions even if the backend developer never replies; say what was built instead.
6. **`collection.json` and `SyRide_All_APIs_merged.postman_collection.json`** — the plan says delete
   them if they are stale duplicates. They are demonstrably ahead of the code (§D of `decisions.md`:
   four complaint verbs in the collection that do not exist in Laravel). **Check before deleting** —
   if they contain any request the route list does not, that divergence is evidence worth keeping in
   `docs/api/`, not deleting. Recommend, then do what the user says.

---

## Already done — reuse, do NOT rebuild

- `ConfirmActionModal` — `minReasonLength`, `maxReasonLength`, `statusOptions`, `confirmTone`
  (`destructive|primary`), and a `children` slot. Testids: `confirm-action-reason`,
  `confirm-action-submit`, `confirm-action-status`.
- `useApiAction` — `runAction`, `isBusy`, `feedback`, `clearFeedback`, `notify(tone, message)`.
- `<Avatar name photo />`, `ErrorBanner` (`message`, `onRetry`), `TableSkeleton` (renders `<tr>`),
  `FilterTabs` (optional `count` badges), `TablePagination` (`pagination-prev|next`), `PerPageSelect`
  (`data-testid="per-page-select"`), `ActionBanner` (`action-banner`).
- `extractApiError` / `getFieldErrors` / `isTerminalAuthError` in `src/services/apiError.ts`.
- Shared `common.showing_range` (six Arabic CLDR forms).
- `useFetchEffect` already pauses polling while the tab is hidden — extend it in Phase 13, don't
  replace it.
- `defaultRouteForRole(role)` in `src/app/roles.ts` — Phase 12 item 1 needs exactly this.

## Constraints

- Follow the `atareeqak-frontend` skill conventions: `endpoints.ts` → feature api → hook → page.
  No direct axios in components. Palette tokens, no raw hex.
- **Deletion is a first-class outcome in these phases** — but a deletion is only done when the
  endpoint constant, the api file, the hook, the component, the route, the nav entry, the role
  entry, the locale keys (both languages), the tests and the e2e stubs are all gone. A half-deleted
  feature is worse than the original. Leave the explanatory comment at the endpoint site, per the
  `SUPPORT_METRICS` / `BROADCAST_ALERT` precedent.
- i18n keys in BOTH `ar` and `en`; Arabic needs all six CLDR plural forms
  (`_zero/_one/_two/_few/_many/_other`) for any key receiving `count`. **Delete every key you
  orphan** — Phase 11 alone orphans ~44, and dead locale keys are how the next person concludes a
  deleted feature still exists.
- Hide actions the backend would reject rather than showing-and-4xx-ing.
- If something the plan assumes cannot be supported, do NOT fake it — file it in
  `docs/api/backend-issues.md` (next: **BUG-13**, **REQ-7**, **NOTE-4**) and say so explicitly in the
  plan.

## Verification (required before calling it done)

- `npx tsc -b`, `npm run lint`, `npm test` all clean. **Baseline 198 passing — do not regress it.**
  New tests required for: the single-flight refresh (exactly one `POST /refresh` under two
  concurrent 401s), the stale-response guard, logout calling the API, and the nav/route/role
  consistency assertion from Phase 12 item 5.
- **Write `docs/api/verify-shell.mjs`** in the style of `verify-support.mjs` / `verify-reports.mjs` —
  drive the real app in Chromium in **both `en` and `ar`**, and assert:
  - `/` redirects by role, and `/settings` no longer resolves to a page;
  - the header dropdown's name, role label, email and `last_login_at` match `GET /staff/me` exactly;
  - the language toggle works inside the shell and flips `dir`;
  - **the logout replay: capture the token, log out, replay it, assert 401** — the phase's headline
    assertion;
  - **no request is made to any removed route during a full walk of every page** (listen on
    `page.on('request')` and fail on a match against the removed list). This is the automated form
    of requirement 1;
  - no untranslated key leaks in either language.
  Read expected labels from the locale JSON, never hardcoded, and use the `until()` polling helper
  rather than fixed sleeps.
- **Re-run every prior script** after Phase 13, since it changes a shared hook and the axios
  interceptor that every page depends on: `verify-reports.mjs`, `verify-staff.mjs`,
  `verify-support.mjs` (105), `verify-reviews.mjs` (64), `verify-verifications.mjs` (51),
  `verify-drivers.mjs` (94), `verify-users.mjs` (137), `verify-trips.mjs` (85),
  `verify-dashboard.mjs`. A stale-response guard that breaks a working filter would show up here and
  nowhere else. Report the counts.
- **`npm run test:e2e`** must pass after the Phase 14 stub changes — including the new negative rule.
- Update `BACKEND_INTEGRATION_PLAN.md` (Phases 9 and 10 first, per §0, then 11–15) and
  `docs/api/README.md`'s script table. Record every deliberate UI change, every deletion and its
  reason, and every seeded-then-reverted row.

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
  saved token if you see `TOKEN_INVALID`. ⚠️ Phase 12 trap 3 changes logout behaviour: once logout
  revokes server-side, **every saved token in your notes dies the moment you log out in the browser.**
  Expect that and re-login rather than debugging a phantom auth failure.
- **MySQL client:** `"C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" -h 127.0.0.1
  -P 3306 -u root 4th_year_project_db`. Run it through the **PowerShell** tool, not Bash — the Bash
  tool mangles UTF-8 output (cp720) and silently returned nothing for Arabic text in Phase 6. Pipe
  `.sql` files in as `Get-Content file.sql -Encoding UTF8 -Raw | & $mysql … --default-character-set=utf8mb4`.
- **Seed:** 35 users / 71 rides / 58 bookings / 10 drivers / 2 pending verifications /
  3 employees / 32 wallets / 194 wallet transactions / 0 complaints / 0 reviews.

## Seed drift from earlier phases

- Phase 3 cancelled bookings `#BK-35/36/56/57/58`.
- Phase 7/8's seed was fully reverted; re-apply `docs/api/seed-phase-7-8.sql` if you re-run those
  scripts. Phase 9's seed has `docs/api/seed-phase-9.sql` / `revert-phase-9.sql` — **check which
  state the database is in before you trust a row count**, because Phase 9/10 is uncommitted and its
  revert may or may not have been applied.
- Phase 10's probe deactivated employee 3 (`agent01`) via the write-then-500 `toggle-active` and
  restored it (`UPDATE employees SET is_active=1 WHERE id=3;`). All three employees should be
  `is_active = 1` — verify.
- If you ban/unban anyone, unban writes `status = 0` (`logged_out`), **not** 1 — restore with
  `UPDATE users SET status=1 WHERE id=...` + `php artisan cache:clear`.
- **BUG-7:** seeded `/storage/` URLs 404 and Chromium reports it as `ERR_BLOCKED_BY_ORB` on
  `requestfailed`, not a 404 on `response`. Watch both events if you assert on it.
- **BUG-8 is a pattern:** any `{id}` route with an `int` type hint 500s with a stack trace on a
  non-numeric segment. Two sites confirmed. Extend BUG-8 rather than filing a new number.
- **BUG-1 stands:** all six `/employees` endpoints 500, and three of them write first. Nothing in
  Phases 11–15 should call them outside `verify-staff.mjs`, which handles them deliberately.
