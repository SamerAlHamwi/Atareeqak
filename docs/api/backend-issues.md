# Backend issues found while wiring the dashboard

Found by running the backend locally (MySQL 8 + `artisan serve`) at commit `3eb54ad` and exercising
the endpoints the dashboard depends on. Each item has a reproduction and a suggested fix.

**None of these are frontend problems** — they need a change in `4th_year_projects_refractored`.

---

## 🔴 BUG-1 — Every `/employees` endpoint returns 500: the controller calls methods the service does not have

**Severity: blocking.** All six employee-management endpoints are dead, which means the dashboard's
entire **Staff page cannot work at all** — no listing, no creating, no editing, no deactivating, no
password resets.

`EmployeeManagementController` calls three methods that do not exist on `EmployeeManagementService`:

| Controller calls | Service actually defines | Used by |
|---|---|---|
| `list($requester)` | **`getAll($requester)`** | `index` |
| `formatEmployee($e)` | **— does not exist anywhere** | `index`, `store`, `show`, `update`, `toggleActive` |
| `resetPassword($id, $pw, $requester)` | **`rotatePassword($id, $pw, $requester)`** | `resetPassword` |

`formatEmployee()` is the worst of the three: the service class has no parent and no traits, so the
method exists nowhere in the codebase. Because five of the six actions call it to build their
response, they all 500 — including the ones whose business logic succeeded.

### Reproduce

```console
TOKEN=$(curl -s -X POST http://localhost:8000/api/staff/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"system_admin","password":"admin"}' | jq -r .tokens.access_token)

curl -s -H "Authorization: Bearer $TOKEN" http://localhost:8000/api/employees
```

```
Error: Call to undefined method App\Services\Staff\EmployeeManagementService::list()
  in app/Http/Controllers/API/Staff/EmployeeManagementController.php on line 34
```

Measured across all six routes with a valid `system_admin` token:

| Method | Route | Result |
|---|---|---|
| GET | `/employees` | **500** — undefined `list()` |
| POST | `/employees` | **500** — undefined `formatEmployee()` … **but the row is still written** (see BUG-2) |
| GET | `/employees/{id}` | **500** — undefined `formatEmployee()` |
| PUT | `/employees/{id}` | **500** — undefined `formatEmployee()` |
| PATCH | `/employees/{id}/toggle-active` | **500** — undefined `formatEmployee()` |
| PATCH | `/employees/{id}/reset-password` | **500** — undefined `resetPassword()` |

### Suggested fix

Rename the two call sites and add the formatter:

```php
// EmployeeManagementController::index()
$employees = $this->managementService->getAll($requester);

// EmployeeManagementController::resetPassword()
$this->managementService->rotatePassword($id, $request->new_password, $requester);
```

and add to `EmployeeManagementService` (shape taken from what the dashboard already consumes, and
matching `EmployeeAuthService::formatEmployee()`):

```php
public function formatEmployee(Employee $e): array
{
    return [
        'id'         => $e->id,
        'username'   => $e->username,
        'email'      => $e->email,
        'full_name'  => $e->fullName(),
        'first_name' => $e->first_name,
        'last_name'  => $e->last_name,
        'role'       => $e->role->value,
        'role_label' => $e->role->label(),
        'is_active'  => $e->is_active,
        'created_by' => $e->creator
            ? ['id' => $e->creator->id, 'username' => $e->creator->username, 'name' => $e->creator->fullName()]
            : null,
        'last_login_at' => $e->last_login_at,
        'created_at'    => $e->created_at,
    ];
}
```

A single feature test hitting each of the six routes with a `system_admin` token would have caught
all of this.

---

## 🟠 BUG-2 — `POST /employees` writes the row, then 500s

A consequence of BUG-1 worth calling out separately: `create()` succeeds and commits, and only the
response formatting throws. The client sees a failure for an operation that actually happened.

Reproduced exactly: a `POST /employees` that returned 500 still created `agent01` (id 3).

Retrying then fails with **409 username already taken** — so from the dashboard the account looks
impossible to create while in fact it exists. Wrapping create + format in a transaction, or simply
fixing BUG-1, resolves it.

---

## 🔴 BUG-3 — Two migrations never run: their filenames have spaces instead of underscores

**Severity: high.** The `sycash` role cannot be seeded on a fresh install, so the entire SyCash
financial-admin feature is dead on any new deployment.

Laravel's migrator collects files with `glob($path.'/*_*.php')` — **the pattern requires an
underscore**. These two filenames contain none, so they are skipped silently, with no error:

```
database/migrations/2025 01 01 000001 add sycash to employees role enum.php
database/migrations/2026 07 16 100000 widen complaints type and status columns.php
```

On a clean `php artisan migrate`: **55 migration files on disk, 53 rows in the `migrations` table.**

### Consequence

`employees.role` is created as `enum('system_admin','admin','support_agent')` and never widened, so
`SpecialAccountSeeder` fails on its second account:

```
SQLSTATE[01000]: Warning: 1265 Data truncated for column 'role' at row 1
```

The `system_admin` seeds; **`sycash` does not**. Anyone deploying fresh gets a platform with no
financial administrator, and the failure is a warning buried in seeder output.

### Suggested fix

Rename both files to the standard format:

```
2025_01_01_000001_add_sycash_to_employees_role_enum.php
2026_07_16_100000_widen_complaints_type_and_status_columns.php
```

⚠️ **Renaming alone is not enough for the sycash one.** Its timestamp (`2025_01_01`) sorts *before*
`2026_05_15_230503_create_employees_table`, so on a fresh install it would run against a table that
does not exist yet — and its `try/catch` would swallow that too, leaving the same broken state.
It needs a timestamp **after** the employees table is created.

Note the `try { … } catch (\Exception) {}` wrapper is what hides both failure modes. Consider
narrowing it, or asserting the enum afterwards.

**Workaround applied to the local dev database:**

```sql
ALTER TABLE employees
  MODIFY COLUMN role ENUM('system_admin','sycash','admin','support_agent') NOT NULL;
```

---

## 🟡 BUG-4 — `EmployeeManagementService::delete()` exists but has no route

`app/Services/Staff/EmployeeManagementService.php:275` implements `delete(int $id, Employee $requester)`,
with full authorization logic. There is **no `DELETE /employees/{id}` route** in `routes/api.php`.

This changes the answer to an open question. The dashboard has a delete button calling
`DELETE /employees/{id}`, and the working assumption was that deletion is deliberately unsupported and
`toggle-active` is the intended replacement. The presence of a complete `delete()` implementation
suggests **the route was simply forgotten**.

**Please confirm:** should `Route::delete('/{id}', [EmployeeManagementController::class, 'destroy'])`
be added (the controller also needs a `destroy()` method), or is `delete()` dead code to remove?

Until answered, the dashboard replaces Delete with Deactivate (`toggle-active`).

---

## 🟡 BUG-5 — `GET /admin/users` derives `admin_photo` from `$request->user()`, which is always null

`AdminUserController::index()` passes `adminUserId: $request->user()?->id`. Under
`StaffJwtMiddleware` the authenticated employee is placed on `$request->attributes->get('staffEmployee')`,
and `$request->user()` is never populated — so this is always `null` and `admin_photo` never resolves.

```php
// current
adminUserId: $request->user()?->id,

// probably intended
adminUserId: $request->attributes->get('staffEmployee')?->id,
```

Low severity — the dashboard renders an initials-avatar fallback — but the field is dead as written.

**Same root cause, second site (found in Phase 4):** `AdminBanController::ban()` writes
`'banned_by' => $request->user()?->id`, so **every ban records `banned_by = NULL`**, and
`GET /admin/users/{id}/status` always returns `ban.banned_by: null`. Verified live — a real ban issued
by `system_admin` came back with `"banned_by": null`. The audit trail for "who banned this user" is
therefore never captured. Same fix:

```php
'banned_by' => $request->attributes->get('staffEmployee')?->id,
```

⚠️ Note the column is a FK to `users.id` while the actor is an `Employee` — so this needs either a
separate `banned_by_employee_id` column or a nullable, un-constrained integer. The dashboard's ban
banner omits the "banned by" row entirely while the field is null rather than printing "Unknown".

**Same root cause, third site (found in Phase 5):** `PassengerProfileController::chargeWallet()`
writes the transaction with `'user_id' => $request->user()?->id`, so **every admin wallet charge
records `user_id = NULL`** and `GET /admin/passengers/{id}/wallet-charges` returns
`processed_by_id: null`, `processed_by_name: null`, `processed_by_photo: null` for all of them.
Verified live: a charge issued by `system_admin` came back with all three null. There is therefore
no record of *which admin* credited a wallet — a worse gap than the ban one, since this is money.

The dashboard's charge log renders the balance movement (`previous → new`) in that column instead of
printing "Unknown" for every row.

---

## 🟠 BUG-6 — Neither the drivers list nor the users list reflects a ban, and an unban makes a row read as "suspended"

**Severity: high** — the Drivers page and the Users page cannot show a truthful status, and the
`suspended` filter tab is wrong in both directions on both. Found in Phase 4 for `/admin/drivers`,
**confirmed identical for `/admin/users` in Phase 5**; both verified live.

`users.status` is a tri-state: `-1` banned · `0` logged out · `1` active. Two places disagree about it.

**1. `resolveDriverStatus()` ignores `-1`.** `AdminDriverService.php:619`:

```php
private function resolveDriverStatus(User $driver): string
{
    if ($driver->status == 0)                        return 'suspended';   // ← only 0
    if ($driver->is_verified_driver)                 return 'verified';
    ...
}
```

A **banned** driver has `status = -1`, falls past that check, and is reported as **`verified`**.

**2. The `suspended` filter matches `status = 0`,** i.e. logged-out users — not banned ones:

```php
'suspended' => $query->where('status', 0),
```

### Verified live

Banning driver 10 (`POST /admin/users/10/ban`, confirmed `account_status: banned`, `status_code: -1`):

| Check | Result |
|---|---|
| `GET /admin/drivers` row for id 10 | `"status": "verified"` ← **still verified while banned** |
| `GET /admin/drivers?filter=suspended` | `total: 0` ← **the banned driver is not there** |

Then unbanning it (which writes `status = 0`, by design so the user must log in again):

| Check | Result |
|---|---|
| `GET /admin/drivers` row for id 10 | `"status": "suspended"` ← **an unbanned driver reads as suspended** |
| `GET /admin/drivers?filter=suspended` | `total: 1`, `ids: [10]` |

So the two operations produce exactly the **opposite** of the truth in the list.

### Consequence for the dashboard

There is no truthful ban signal in the list payload at all, so the Drivers page:

- does **not** optimistically flip a row's status after a ban (the server would contradict it on the
  next fetch); it re-reads the list and renders a separate "banned" chip sourced from the
  authoritative `POST .../ban` response, only for rows this session actually acted on;
- drives the details-page banner and the ban/unban toggle from `GET /admin/users/{id}/status`
  exclusively.

### Suggested fix

Handle all three states, and add the ban state to the row payload:

```php
private function resolveDriverStatus(User $driver): string
{
    if ($driver->status == -1)                       return 'banned';
    if ($driver->status == 0)                        return 'logged_out';
    if ($driver->is_verified_driver)                 return 'verified';
    if ($driver->verification_status === 'pending')  return 'pending';
    if ($driver->verification_status === 'rejected') return 'rejected';
    return 'unverified';
}
```

and let `filter=suspended` mean `whereIn('status', [-1, 0])` — or, better, split it into `banned` and
`logged_out` filters. Adding `'is_banned' => $driver->status == -1` to `formatDriver()` would let the
list render ban state for **every** row instead of only the ones just acted on.

Related: `getStats()` hardcodes `$suspendedDrivers = 0; // not implemented yet`, so the suspended KPI
would read 0 even once the filter is fixed. The dashboard does not render that card.

Related: `resolveDriverStatus()` can already return `rejected` and `unverified`, neither of which is a
valid `filter=` value (`in:all,verified,pending,suspended`), so those rows are reachable in the `all`
tab but not filterable.

### 6b — `GET /admin/users` has exactly the same defect (Phase 5)

`AdminUserService::resolveUserStatus()` (`AdminUserService.php:229`) is the same code shape:

```php
private function resolveUserStatus(User $user): string
{
    if ($user->status == 0)                        return 'suspended';   // ← only 0
    if ($user->is_verified_driver)                 return 'verified';
    if ($user->is_verified_passenger)              return 'verified';
    ...
}
```

and `'suspended' => $query->where('status', 0)` in `buildQuery()`, plus
`'suspended_users' => User::where('status', 0)->count()` in `getStats()` — so the KPI card counts
**logged-out** users and calls them suspended.

Verified live on **passenger id 30** (a passenger, so this is independent of the driver repro):

| Check | After `POST /admin/users/30/ban` (`status_code: -1`) | After `POST .../unban` (`status = 0`) |
|---|---|---|
| row `status` in `GET /admin/users` | `"verified"` ← **banned user reads verified** | `"suspended"` ← **unbanned user reads suspended** |
| `GET /admin/users?status=suspended` | `total: 0` | `total: 1`, ids `[30]` |
| `stats.suspended_users` | `0` | `1` |

Re-confirmed on passenger id 18 by `verify-users.mjs --mutate` in both languages.

The row payload also carries **no `ban` / `is_banned` field at all**, so there is no truthful ban
signal anywhere in the list. The Users page therefore behaves exactly like the Drivers page: it
renders a "banned" chip only for rows whose authoritative status it holds (from the `ban`/`unban`
response), never optimistically flips a row's status, and drives the details page from
`GET /admin/users/{id}/status`.

Same fix as above, plus `'is_banned' => $user->status == -1` in `AdminUserService::formatUser()`.

Related: `resolveUserStatus()` can return `rejected` and `unverified` too — both observed in the seed
(`GET /admin/users` returns 1 `rejected` and 2 `unverified` rows) and neither is a valid `status=`
filter value. The dashboard now has labels for all five so they no longer render as a raw i18n key,
but they cannot be filtered for.

---

## 🟡 BUG-7 — Seeded file URLs point at files that do not exist, and there is no `public/storage` link

Every seeded profile photo and verification document resolves to a URL that 404s:

```console
$ curl -o /dev/null -w '%{http_code}\n' \
    http://127.0.0.1:8000/storage/profiles/profile_photo/default-profile-photo.jpg
404
$ curl -o /dev/null -w '%{http_code}\n' \
    http://127.0.0.1:8000/storage/verifications/face_id/seeded_10.jpg
404
```

Two causes, both present: `storage/app/public/` is **empty** (the seeder records paths without
writing any file), and **`public/storage` does not exist** (`php artisan storage:link` was never run).

Because Laravel answers with an HTML 404, Chromium blocks the cross-origin image as ORB
(`net::ERR_BLOCKED_BY_ORB`) rather than reporting a clean 404 — worth knowing when debugging.

Impact is cosmetic on the dashboard: `<Avatar>` degrades to initials on error, and this is asserted in
`verify-drivers.mjs`. But the **verification document viewer has nothing to show** — the four document
links on a driver's page all lead to 404s, which will matter for Phase 6.

**Suggested fix:** run `php artisan storage:link`, and have the seeder copy a real placeholder image
into `storage/app/public/...` for each path it records.

---

## 🟢 REQ-1 — `recent_activities` has no `user_id`, so dashboard rows cannot link to a profile

Not a bug — a small enhancement request.

`AdminReportService::getRecentActivities()` returns each row's user as:

```php
'user' => [
    'name'   => trim("{$booking->user?->first_name} {$booking->user?->last_name}"),
    'number' => 'XXX-XXX-' . substr($booking->communication_number ?? '', -4),
],
```

The dashboard's "Recent Activities" table is the natural jumping-off point into a passenger's
profile (`/passengers/{id}`, backed by `GET /admin/passengers/{id}/full-profile`), but with no
identifier in the payload there is nothing to link to. The name is not unique and the phone number
is deliberately masked.

**Requested:** add `'id' => $booking->user?->id` alongside `name` and `number`. The relation is
already eager-loaded (`'user:id,first_name,last_name'`), so this costs nothing.

`booking_id` is present, but there is no booking-detail page to link it to.

Until this lands, the dashboard renders the rows without links rather than guessing.

---

## 🟢 REQ-2 — Endpoints that return no `counts` block, so their filter tabs cannot show badges

Found while building the Bookings UI (Phase 3), **extended in Phase 4 when `GET /admin/drivers`
turned out to have the same gap, and again in Phase 5 for `GET /admin/users`.**

| Endpoint | `counts`? | Filter tabs affected |
|---|---|---|
| `GET /admin/trips` | ✅ yes | 6 tabs, all badged |
| `GET /admin/passengers/{id}/complaints` | ✅ yes | per-user complaint tabs, badged |
| `GET /staff/bookings` | ❌ no | `all·pending·confirmed·cancelled·completed·no_show` |
| `GET /admin/drivers` | ❌ no | `all·verified·pending·suspended` |
| `GET /admin/users` | ❌ no | `all·verified·pending·suspended` |

Both gaps are the same shape and want the same one-line fix on the backend; neither has a frontend
workaround short of one request per badge.

### 2a — `GET /staff/bookings` (Phase 3)

`GET /admin/trips` returns a `counts` block alongside `meta`, which lets the trips filter tabs show a
real per-status total (`all 71 · scheduled 33 · active 15 · completed 14 · cancelled 5 · awaiting 4`)
regardless of which page is on screen:

```json
"meta":   { "current_page": 1, "last_page": 5, "per_page": 15, "total": 71, "filter": "all" },
"counts": { "all": 71, "scheduled": 33, "active": 15, "completed": 14, "cancelled": 5, "awaiting": 4 }
```

`GET /staff/bookings` (`StaffOperationsController::bookings`) returns **only `status`, `data` and
`meta`** — no `counts`. `meta.total` describes just the requested status, so the six booking filter
tabs (`all|pending|confirmed|cancelled|completed|no_show`) have no per-status figure available. The
dashboard would have to fire six requests to populate six badges.

**The bookings tabs therefore ship without badges.** No number was invented, and no N+1 request fan-out
was added.

**Requested:** mirror the trips endpoint and add a `counts` block. The verified live figures are
`pending 3 · confirmed 24 · cancelled 10 · completed 14 · no_show 7` (58 total), so it is a single
grouped query:

```php
'counts' => Booking::selectRaw('status, COUNT(*) as total')
    ->groupBy('status')
    ->pluck('total', 'status')
    ->put('all', Booking::count()),
```

Once it lands, the frontend change is one line — `useBookings` already threads `meta` through, and
`FilterTabs` renders a badge whenever a `count` is supplied.

### 2b — `GET /admin/drivers` (Phase 4)

`AdminDriverController::index()` returns `status`, `data` and `meta` only:

```json
"meta": { "current_page": 1, "last_page": 4, "per_page": 3, "total": 10, "filter": "all" }
```

`meta.total` describes only the requested filter, so the four driver tabs
(`all|verified|pending|suspended`) have no per-status figure. **The drivers tabs therefore ship
without badges**, exactly as the bookings tabs do — no number was invented and no four-request
fan-out was added.

**Requested:** the counts the tabs need are the same three the dashboard's `getStats()` already
computes (`total_drivers`, `active_drivers`, `pending_verifications`), so `index()` can reuse it:

```php
$stats = $this->driverService->getStats();
'counts' => [
    'all'       => $stats['total_drivers'],
    'verified'  => $stats['active_drivers'],
    'pending'   => $stats['pending_verifications'],
    'suspended' => $stats['suspended_drivers'],   // ← needs BUG-6 fixed first; hardcoded 0 today
],
```

Note `suspended` is blocked on **BUG-6**: `getStats()` returns a hardcoded `0` for it, and the
`suspended` filter matches the wrong `status` value, so that badge would be wrong even if the block
were added today.

Frontend cost once it lands: one line in `useDrivers` plus passing `count` into the existing
`filterItems` memo — `FilterTabs` already renders a badge whenever a `count` is supplied.

### 2c — `GET /admin/users` (Phase 5)

`AdminUserService::getPageData()` returns `admin_photo`, `stats`, `users` and `meta` — no `counts`.
Verified live: `page1.counts === undefined`.

This one is the cheapest of the three to fix, because the endpoint **already computes four of the
five numbers** in `getStats()` for its KPI cards:

```php
'counts' => [
    'all'       => $stats['total_registered'],
    'verified'  => …,                      // is_verified_driver OR is_verified_passenger
    'pending'   => …,                      // verification_status = 'pending'
    'suspended' => $stats['suspended_users'],   // ← needs BUG-6 fixed first; counts status = 0 today
],
```

Note the counts must respect the *other* active filters (`type`, `date`, `search`) to be meaningful,
which the KPI stats deliberately do not — so this is a grouped query over the same filtered base, not
a reuse of `getStats()` verbatim.

Until then the four user tabs ship without badges, like the bookings and driver tabs.

---

## 🟢 REQ-3 — `POST /admin/passengers/{id}/charge-wallet` returns only `new_balance`

Found in Phase 5. Not a bug — the endpoint works — but the response is thinner than the data it just
wrote, and than the sibling wallet endpoint.

Verified live, a successful charge returns exactly:

```json
{
  "status": "success",
  "message": "Wallet charged successfully. New balance: 4930025.00 SYP.",
  "new_balance": 4930025
}
```

The `WalletTransaction` it created in the same request carries `transaction_id`, `previous_balance`
and `new_balance`, and `POST /admin/wallet/charge` (the *other* charge endpoint, Phase 9) does return
`{previous_balance, new_balance, transaction_id}`. So the passenger endpoint is the odd one out.

**Consequence:** a client that wants to confirm "4,930,000 → 4,930,025, transaction ADM-18-…" — the
normal thing to show after crediting money — must fire a second request to
`GET /admin/passengers/{id}/wallet-charges` and match the newest row. That is what the dashboard does
(`useUserDetails.chargeWallet`), and it deliberately reports `previousBalance: null` /
`transactionId: null` if the read-back does not line up, rather than computing a "previous balance"
client-side and presenting it as server truth.

**Requested:** return the transaction, matching `POST /admin/wallet/charge`:

```php
return response()->json([
    'status'           => 'success',
    'message'          => "Wallet charged successfully.",
    'previous_balance' => $previousBalance,
    'new_balance'      => (float) $user->wallet->balance,
    'transaction_id'   => $transactionId,
]);
```

(`$previousBalance` and `$transactionId` are already local to the `DB::transaction` closure; they
just need hoisting out of it.)

Also related: there is **no way to reverse an admin charge** through the API — no debit endpoint and
no transaction-delete route. `verify-users.mjs --mutate` therefore reports its charge as
unrecoverable and prints the delta plus the SQL to undo it, rather than claiming the seed is intact.

---

## ℹ️ NOTE-1 — Refresh tokens rotate (single-use). This is correct; documenting it.

Verified live: a refresh token is consumed on use and a new one returned. Replaying a consumed token
gives `401 REFRESH_TOKEN_INVALID`.

The dashboard already stores the rotated token. The hazard is **concurrency**: if two requests 401 at
the same time, both attempt a refresh, the second replays a consumed token, and the user is logged
out. The dashboard needs single-flight refresh (tracked in the integration plan, Phase 13). No
backend change needed.

## ℹ️ NOTE-2 — `.env` ships `APP_ENV=production` with `APP_DEBUG=true`

The committed-style `.env` in the checkout combines `APP_ENV=production` with `APP_DEBUG=true` and
`LOG_LEVEL=debug`. In production that renders full stack traces — including file paths and, in
Ignition's HTML output, environment context — to any client that triggers an error. Every 500 above
returned a complete stack trace over HTTP.

Also present: `APP_URL=https://api.onwayride.me`, which is a different service (see
[`probe-results.md`](./probe-results.md)).

---

## Environment these were found in

- backend `4th_year_projects_refractored` @ `3eb54ad`
- PHP 8.2.33, MySQL 8.0.40, `php artisan serve` on `127.0.0.1:8000`
- `.env.localdev` (`APP_ENV=localdev`): MySQL on 127.0.0.1, `CACHE_DRIVER=file`, no Redis
- 53/55 migrations applied, plus the manual `ALTER TABLE employees` from BUG-3
- accounts seeded: `system_admin` / `sycash`; `agent01` (id 3) is leftover from the BUG-2 repro
- Phase 5 mutations (passengers 18 and 30: four bans/unbans and five 25-unit wallet charges) were
  **fully rolled back in SQL** afterwards — `users.status` back to 1, both wallet balances back to
  their seeded values, and all five `ADM-*` transactions deleted — followed by `cache:clear`.
  `verify-drivers.mjs` was re-run afterwards and still passes 94/94.
