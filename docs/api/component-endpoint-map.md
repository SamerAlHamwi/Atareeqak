# Component → endpoint map

Produced by Phase 13 of [`BACKEND_INTEGRATION_PLAN.md`](../../BACKEND_INTEGRATION_PLAN.md), per its
own requirement: "every component in the UI must be linked to the backend" is checkable here, not
just claimed. One row per interactive component (a control rendered once per table row — e.g. a
"cancel" button — is one row, not one per rendered instance). Swept every `<button>`, `<input>`,
`<select>`, `<textarea>`, `<a>` and toggle under `src/features/` and `src/components/` on
2026-08-14. Three columns: the **endpoint** it drives, or **client-side only** with the reason, or
**REMOVED in Phase N** with the reason.

Legend: ✅ real, wired · 🖥️ client-side only (documented reason, not a gap) · ⛔ removed (kept for
history — do not re-add without a real endpoint) · 🚧 gated (endpoint exists but is withheld pending a
backend fix)

---

## Auth — `src/features/auth/`

| Component | File | Endpoint / status |
|---|---|---|
| Username/email input | `pages/Login.tsx` | ✅ request body for the submit below |
| Password input + show/hide toggle | `pages/Login.tsx` | ✅ / 🖥️ the toggle only flips `type="text"↔"password"` |
| "Forgot password?" button | `pages/Login.tsx` | 🖥️ no reset-request endpoint exists; shows `auth.password_help` explaining a system admin resets passwords from the Staff page |
| Login submit | `pages/Login.tsx` | ✅ `POST /staff/login`, falls back to `POST /admin/login` on 401/422 |
| "Don't have an account?" button | `pages/Login.tsx` | 🖥️ no self-registration endpoint exists; shows `auth.support_help` |
| "Use demo credentials" button | — | ⛔ removed Phase 1.5 — filled in credentials (`primary@admin.com`/`admin_password`) that never matched the real Employee-row login |
| Language/RTL toggle | `components/layout/AuthLayout.tsx` | 🖥️ genuinely client-side, `app/i18n.ts`'s `toggleLanguage()` — no backend concept |
| Help button (unlabelled `?` icon) | `components/layout/AuthLayout.tsx` | ⛔ removed Phase 12 — no `onClick`, nothing to link to |
| Footer: help centre / terms / privacy links | `components/layout/AuthLayout.tsx` | ⛔ removed Phase 12 — all three were `href="#"` |

## Shell — `src/components/layout/`, `src/routes/`

| Component | File | Endpoint / status |
|---|---|---|
| Sidebar nav links | `MainLayout.tsx` (`navItems.ts`) | ✅ each `to` is a real route from `routes/sectionRoutes.ts`, filtered by `canAccess(role, section)`; cross-checked by `tests/app/nav.test.ts` |
| Sidebar Logout button | `MainLayout.tsx` | ✅ `useAuth().logout()` → `authApi.logout(authKind, accessToken)` → `POST /staff/logout` or `/admin/logout` |
| Mobile menu toggle | `MainLayout.tsx` | 🖥️ opens/closes the sidebar overlay, no data |
| Header search box | — | ⛔ removed Phase 12 — only `/admin/users` and `/admin/drivers` accept `search`; `AdminTripController` has none, so "cross-entity search" (the plan's justification) was never buildable as described |
| Header help button | — | ⛔ removed Phase 12 — no `onClick` |
| Header notification bell | — | ⛔ removed Phase 12 — hardcoded unread dot with no handler; the eight `/api/notifications/*` routes authenticate a staff token as whatever `users` row shares its numeric id ([BUG-13](./backend-issues.md)), so there is no staff-reachable notifications endpoint to build against |
| Header identity dropdown trigger | `MainLayout.tsx` | ✅ opens a menu showing `user.name`/`roleLabel`/`email`/`lastLoginAt`, all sourced from `GET /staff/me` via `AuthContext` |
| ↳ Language/RTL toggle (in dropdown) | `MainLayout.tsx` | 🖥️ same `toggleLanguage()` as the login screen, rescued from Phase 11's Settings deletion |
| ↳ Logout (in dropdown) | `MainLayout.tsx` | ✅ same as the sidebar Logout above |
| Admin avatar | `MainLayout.tsx` | 🖥️ `<Avatar name photo={null} />` initials fallback — `POST /admin/photo` is a stub that reports success without doing anything, and even fixed has no column to write to and no field on `GET /staff/me` to read it back ([BUG-12](./backend-issues.md)) |
| `/` (RoleHome) | `routes/index.tsx` | ✅ `<Navigate>` to `defaultRouteForRole(role)` — no page, no request |
| `RoleRoute` "no permission" panel + its "back home" link | `routes/RoleRoute.tsx`, `features/shared/components/NoPermissionPanel.tsx` | 🖥️ client-side role gate mirroring the backend's middleware groups; the link is `defaultRouteForRole(role)` |
| Home page (two mock buttons: "Live data sync", "Notice center") | — | ⛔ removed Phase 1.5 (buttons) then Phase 12 (whole page + route) |
| `/settings` page (all ~15 controls) | — | ⛔ removed Phase 11 in full — see `decisions.md` Q1 and the Phase 11 section of the plan |

## Dashboard — `src/features/dashboard/`

| Component | File | Endpoint / status |
|---|---|---|
| Refresh control | `pages/Dashboard.tsx` | ✅ re-calls `GET /admin/dashboard` (server-cached 5 min) |
| Export PDF button | `pages/Dashboard.tsx` | ✅ `GET /admin/export/pdf` (same endpoint Reports uses) |
| Growth period switch (3/6/12 months) | `components/GrowthChart.tsx` | ✅ `GET /admin/dashboard/growth?months=N` — refetches only the growth series |
| Stat cards, city distribution, recent activity table | `pages/Dashboard.tsx` | ✅ all from the `GET /admin/dashboard` BFF payload |
| "View all" links (Support / Verifications side cards) | `pages/Dashboard.tsx` | ✅ real in-app links to `/support`, `/verifications` |

## Trips — `src/features/trips/`

| Component | File | Endpoint / status |
|---|---|---|
| Trips filter tabs + `counts` badges | `pages/Trips.tsx` | ✅ `GET /admin/trips?filter=` — badges from the response's `counts` block |
| Trips per-page select / pagination | `pages/Trips.tsx` | ✅ `per_page`/`page` on the same endpoint |
| Trip row "view details" | `components/TripsTable.tsx` | 🖥️ opens the detail panel from already-fetched row data — no separate request |
| Trip row "cancel" | `components/TripsTable.tsx` | ✅ `POST /staff/trips/{id}/cancel`, hidden (not shown-then-422'd) for terminal states via `isCancellableTrip` |
| "Contact driver" (`tel:` link) | `components/TripDetailsCard.tsx` | 🖥️ real `driver.communication_number` from the live-trips payload, disabled with a tooltip when absent |
| Live trips map | `components/LiveTripsMap.tsx` | ✅ `GET /admin/trips/live`, 30 s poll, pauses while tab hidden |
| Monitoring sidebar (popular routes, top drivers) | `components/MonitoringSidebar.tsx` | ✅ `GET /admin/routes/popular`, `GET /admin/drivers/top` |
| Bookings status filter + `per_page`/pagination | `pages/Trips.tsx`, `components/BookingsTable.tsx` | ✅ `GET /staff/bookings?status=` — **no `counts` block**, so this tab ships without badges ([REQ-2](./backend-issues.md)) |
| Booking row "cancel" | `components/BookingsTable.tsx` | ✅ `POST /staff/bookings/{id}/cancel`, hidden for non-`pending`/`confirmed` rows via `isCancellableBooking` |
| "New trip" button | — | ⛔ removed Phase 1.5 — fabricated a browser-only row, no create-ride endpoint exists |

## Drivers — `src/features/drivers/`

| Component | File | Endpoint / status |
|---|---|---|
| Filter tabs, search (400 ms debounce), per-page, pagination | `pages/Drivers.tsx` | ✅ `GET /admin/drivers?filter&search&per_page&page` — **no `counts`**, tabs unbadged ([REQ-2](./backend-issues.md)) |
| Driver row → details link | `pages/Drivers.tsx` | ✅ navigates to `/drivers/:id`, backed by `GET /admin/drivers/{id}/dashboard` |
| Driver row ban/unban icon | `pages/Drivers.tsx` | ✅ `POST /admin/users/{id}/ban\|unban`, driven off `isBannedDriver()` (the authoritative status), not the list row's untrustworthy `status` field (BUG-6) |
| Verification-efficiency period tabs (day/week/month) | `pages/Drivers.tsx` | ✅ `GET /admin/drivers/verification-efficiency?period=` |
| Driver details: ban/unban button | `pages/DriverDetails.tsx` | ✅ same ban/unban endpoints, with temporary-ban options via `ConfirmActionModal` |
| Driver details: back links | `pages/DriverDetails.tsx` | 🖥️ in-app navigation to `/drivers` |
| `GET /admin/drivers/{id}/profile` | — | 🖥️ deliberately no consumer — `{id}/dashboard` is a superset; wrapper deleted Phase 4 |

## Passengers (Users) — `src/features/users/`

| Component | File | Endpoint / status |
|---|---|---|
| Type/status/date filters, search, per-page, pagination | `pages/Users.tsx` | ✅ `GET /admin/users?type&status&date&search&per_page&page` — no `counts` ([REQ-2](./backend-issues.md)) |
| User row → open profile | `pages/Users.tsx` | ✅ `GET /admin/passengers/{id}/full-profile` |
| Quick-panel ban/unban | `pages/Users.tsx` | ✅ `POST /admin/users/{id}/ban\|unban` |
| 5 per-section refresh controls (stats / monthly-trips / recent-trips / complaints / wallet-charges) | `pages/UserDetails.tsx` | ✅ each its own endpoint: `GET /admin/passengers/{id}/stats\|monthly-trips\|recent-trips\|complaints\|wallet-charges`, with window/limit/status selectors per section |
| Charge-wallet form + submit | `pages/UserDetails.tsx` | ✅ `POST /admin/passengers/{id}/charge-wallet`, capped and mirrored client-side |
| Ban/unban button | `pages/UserDetails.tsx` | ✅ same ban endpoints as the list |
| Back links | `pages/UserDetails.tsx` | 🖥️ in-app navigation to `/passengers` |

## Verifications — `src/features/verification/`

| Component | File | Endpoint / status |
|---|---|---|
| Refresh control | `pages/Verifications.tsx` | ✅ `GET /staff/verifications/pending` |
| Request row select | `pages/Verifications.tsx` | 🖥️ selects from already-fetched data for the detail panel |
| Document thumbnails + lightbox | `components/VerificationDocuments.tsx` | ✅ URLs from the pending-request payload; degrades to a broken-image state visibly (BUG-7) rather than hiding the failure |
| Approve button + national-ID input | `components/ApproveVerificationModal.tsx`, `VerificationDocuments.tsx` | ✅ `POST /staff/verifications/{userId}/approve {national_id}` — required, never pre-filled (payload doesn't carry it, [REQ-4](./backend-issues.md)) |
| Reject button + reason | `components/VerificationDocuments.tsx` | ✅ `POST /staff/verifications/{userId}/reject {reason}` |
| Optimistic row removal + reconcile | `pages/Verifications.tsx` | ✅ removes locally on approve/reject, then re-fetches to reconcile the server `total` |

## Support — `src/features/support/`

| Component | File | Endpoint / status |
|---|---|---|
| Inbox/escalated view toggle | `pages/Support.tsx` | ✅ swaps between `GET /staff/complaints` and `GET /staff/escalated-complaints` |
| Status tabs + `counts` badges | `pages/Support.tsx` | ✅ badges from each endpoint's own `counts` block |
| Type + date `<select>` filters, per-page, pagination | `pages/Support.tsx` | ✅ query params on the active endpoint |
| Complaint row select (triggers `show()`) | `pages/Support.tsx` | ✅ `GET /staff/complaints/{id}` — a pending row transitions to `in_review` and is assigned to the caller as a side effect (B9), reflected in the UI, not hidden |
| Respond / Escalate / Resolve-escalated buttons | `components/ComplaintDetails.tsx` | ✅ `PATCH .../respond`, `PATCH .../escalate`, `PATCH /staff/escalated-complaints/{id}/resolve` |
| Attachment thumbnails | `components/ComplaintDetails.tsx` | ✅ URLs from the complaint payload |
| SupportStats KPI cards | `pages/Support.tsx` | ✅ derived from the two `counts` blocks — the unsupportable avg-response-time card was removed, not dashed ([REQ-5](./backend-issues.md), [BUG-8](./backend-issues.md)) |
| Broadcast Alert button + modal | — | ⛔ removed Phase 10 — `POST /admin/broadcast-alert` confirmed 404 live |

## Reviews — `src/features/reviews/`

| Component | File | Endpoint / status |
|---|---|---|
| Search input, date filter, per-page, pagination | `pages/Reviews.tsx` | ✅ `GET /staff/reviews?search&date&per_page&page` |
| "Clear user filter" button | `pages/Reviews.tsx` | ✅ clears the `?user_id=` deep-link param that came from a passenger profile |
| Delete (comment) button + confirm | `pages/Reviews.tsx` | ✅ `DELETE /staff/reviews/{commentId}`, confirmed via `ConfirmActionModal` |

## Reports & Wallet — `src/features/reports/`

| Component | File | Endpoint / status |
|---|---|---|
| Date range inputs + Apply/Clear | `components/ReportFilters.tsx` | ✅ `GET /admin/reports?start_date&end_date` — end-before-start disables Apply rather than submitting and 422ing |
| Refresh control | `components/ReportFilters.tsx` | ✅ re-calls `GET /admin/reports` |
| Section checkboxes + Export PDF | `components/ReportFilters.tsx` | ✅ `GET /admin/export/pdf?sections[]=` with the applied date range threaded through |
| 7 KPI cards (fees/escrow-in/escrow-out/refunds/primary-balance/sycash-balance/locked-funds) | `pages/Reports.tsx` | ✅ all real fields from `GET /admin/reports`, split into range-filtered vs point-in-time groups |
| Ride-stats row | `pages/Reports.tsx` | ✅ same payload |
| Admin wallet card → open transactions | `components/AdminWalletCard.tsx` | ✅ `GET /admin/wallet`, drawer opens `GET /admin/wallet/{id}/transactions` |
| Transactions drawer close / pagination | `components/WalletTransactionsDrawer.tsx` | ✅ paged off the endpoint's raw paginator, no `per_page` support server-side so none is offered |
| Wallets directory search | `components/ManagementSidebar.tsx` | ✅ `GET /admin/wallets`, filtered client-side over the full (already-fetched) directory |
| Charge-wallet form + submit | `components/ManagementSidebar.tsx` | ✅ `POST /admin/wallet/charge {phone_number, amount}`, capped at 1,000,000 client-side to match the backend rule |
| Wallet-requests status tabs + `counts`, type filter, per-page, pagination | `pages/Reports.tsx`, `components/TransactionTable.tsx` | ✅ `GET /admin/wallet/requests?status&type&per_page&page` — no "All" tab, since no request can ask for all statuses at once ([REQ-6](./backend-issues.md)) |
| Approve / Reject request buttons | `components/TransactionTable.tsx` | ✅ `POST /admin/wallet/requests/{id}/approve\|reject {admin_notes?}` |

## Staff — `src/features/staff/`

All six `/employees` endpoints 500 server-side ([BUG-1](./backend-issues.md)), so every write control
below is 🚧 **gated**, not wired-and-hoping: the page ships a live-derived "unavailable" state
(`StaffUnavailablePanel`) with the real server error surfaced and a Retry, per `verify-staff.mjs`.

| Component | File | Endpoint / status |
|---|---|---|
| Employee list | `pages/Staff.tsx` | 🚧 `GET /employees` — 500s; the unavailable panel renders instead of an empty table |
| Retry control | `components/StaffUnavailablePanel.tsx` | ✅ real retry — recovers on its own once BUG-1 is fixed |
| Create-employee form + submit | `pages/Staff.tsx` | 🚧 `POST /employees` — not reachable while BUG-1 stands |
| Edit-employee modal + save | `components/EditEmployeeModal.tsx` | 🚧 `PUT /employees/{id}` — not reachable |
| Reset-password form + submit | `pages/Staff.tsx` | 🚧 `PATCH /employees/{id}/reset-password` — not reachable |
| Deactivate/toggle-active control | — | 🚧 `PATCH /employees/{id}/toggle-active` — not reachable; also the replacement for the deleted Delete button |
| Delete button | — | ⛔ removed Phase 10 — `DELETE /employees/{id}` confirmed 405 live; `EmployeeManagementService::delete()` exists server-side but has no route (BUG-4) |

---

## Sweep conclusion

No fake control was found that isn't already named above or in an earlier phase's writeup. Every
literal DOM `<button>`/`<input>`/`<select>`/`<a>`/toggle under `src/features/` and `src/components/`
maps to a row in this table (directly, or as one instance of a per-row table control already listed
once). Generic, prop-driven shared components (`ConfirmActionModal`, `ActionBanner`, `ErrorBanner`,
`NoPermissionPanel`, `TableSkeleton`, `FilterTabs`, `PerPageSelect`, `TablePagination`, `Avatar`) are
not listed as their own rows — they carry no endpoint of their own; the endpoint belongs to whichever
page configures them, and each of those call sites is listed above under its feature.
