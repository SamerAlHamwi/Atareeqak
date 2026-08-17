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

### 🔴 Three of the six endpoints WRITE and then report failure (proven Phase 10)

"All six return 500" is true but dangerously incomplete. *Where* in each action the undefined call
sits decides whether the request corrupts data on its way out:

| Endpoint | Undefined call | Writes before dying? |
|---|---|---|
| `GET /employees` | `list()` | no — dies immediately |
| `GET /employees/{id}` | `formatEmployee()` | no (read-only) |
| `POST /employees` | `formatEmployee()`, after `create()` | 🔴 **YES — employee created, then 500** ([BUG-2](#-bug-2--post-employees-writes-the-row-then-500s)) |
| `PUT /employees/{id}` | `formatEmployee()`, after `update()` | 🔴 **YES — row updated, then 500** |
| `PATCH .../toggle-active` | `formatEmployee()`, after `toggleActive()` | 🔴 **YES — row flipped, then 500** |
| `PATCH .../reset-password` | `resetPassword()` | no — dies before the write |

**Why the 500 is Laravel's page and not the controller's own error JSON:** every action wraps its
body in `catch (\Exception $e) { … serverError(); }`, but *"Call to undefined method"* throws
**`\Error`**, which is not an `\Exception`. The catch never fires, the error escapes the controller
entirely, and with `APP_DEBUG=true` ([NOTE-2](#ℹ️-note-2--env-ships-app_envproduction-with-app_debugtrue))
Laravel renders a full stack trace with absolute filesystem paths.

**Verified against the database, not inferred.** `verify-staff.mjs --mutate` reads the row before and
after each call and asserts it moved despite the reported failure:

```
🔴 PATCH /employees/3/toggle-active returned 500 …
🔴 …AND THE ROW REALLY FLIPPED: is_active 1 → 0, with a fresh updated_at.
🔴 PUT /employees/3 returned 500 …
🔴 …AND THE ROW WAS REALLY UPDATED: first_name "Test" → "VerifyProbe"
🔴 POST /employees returned 500 …
🔴 …AND THE EMPLOYEE WAS REALLY CREATED (BUG-2): 3 → 4 rows
   PATCH /employees/3/reset-password returned 500 …
   …and this one is NOT destructive: the password hash is unchanged.
```

All three were rolled back by the script, which then asserts the `employees` table is byte-for-byte
identical to its pre-run snapshot.

### ⚠️ Do not be fooled by the non-500 responses

Against **employee 1** — the seeded, `isRestricted()` `system_admin` — the same calls look healthy:

```
PATCH /employees/1/toggle-active   → 403 "The 'System Administrator' account cannot be deactivated"
PUT   /employees/1                 → 403 "…cannot be modified via the API."
PATCH /employees/1/reset-password  → 422 {"new_password":["The new password field is required."]}
```

All three are the **guard or the validator firing before** the undefined method is reached. Against a
real, non-restricted employee (id 3, `agent01`, `support_agent`) every one of them 500s. **Any
verification that only exercises employee 1 will conclude the backend works.**

### What the dashboard does about it

The Staff page is **kept mounted and shipped with a labelled unavailable state** rather than hidden
behind a build-time flag. `useStaff` derives an `isBackendAvailable` flag from the live
`GET /employees`; while it fails, the page renders `StaffUnavailablePanel` — which names the defect,
shows the server's real error, and states that the write controls are withheld deliberately — and
**every create / edit / deactivate / reset control is unreachable**.

Availability is derived from the live response rather than hardcoded on purpose: `GET /employees`
exercises **both** `list()` and `formatEmployee()`, so its success proves the methods the write paths
depend on are back. The page un-gates itself the moment this bug is fixed, with no frontend change.

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

Retrying then fails as **username already taken** — so from the dashboard the account looks
impossible to create while in fact it exists. Wrapping create + format in a transaction, or simply
fixing BUG-1, resolves it.

### Re-proven against the database in Phase 10, not inferred

`verify-staff.mjs --mutate` now demonstrates this end-to-end rather than describing it: it counts the
`employees` rows, POSTs, asserts the **500**, counts again, and asserts a row appeared anyway — then
retries the "failed" creation to show it is refused as a duplicate, and deletes the probe row.

```
🔴 POST /employees returned 500 …
🔴 …AND THE EMPLOYEE WAS REALLY CREATED (BUG-2): 3 → 4 rows, new id 5.
🔴 …and retrying the "failed" creation is REJECTED as username-already-taken
```

The same script proves the other two write-then-500 endpoints the same way — see BUG-1.

> ⚠️ Note the retry is refused with **403**, not the 409 this document previously claimed. See
> [BUG-11](#-bug-11--every-employee-domain-refusal-is-403-the-controllers-409-branch-is-dead-code-phase-10).

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

### 7b — confirmed for verification documents specifically (Phase 6)

The seed's two pending users (31 and 33) have **`documents: []`**, so this could not be exercised
without seeding rows. Four `photos` rows were inserted for user 31 (`face_id`, `back_id`, `license`,
`mechanic_card`), verified, then deleted again. Result: **all four `/storage/verification-docs/*.jpg`
URLs failed with `net::ERR_BLOCKED_BY_ORB`** — the ORB path, not a clean 404, exactly as above.

Consequence for the reviewer: with the files missing, a verification decision has to be made with
**no visible evidence at all**. The dashboard now says so explicitly (each tile degrades to an
"unavailable" state and the `<img>` is removed, so no broken-image glyph appears), but the underlying
problem is that the review tool cannot show the documents it exists to review. This is the highest-
impact consequence of BUG-7 found so far.

Also worth noting: `photos.type` is an enum of exactly those four values, and the pending payload
derives `type: driver` from the presence of `license` **or** `mechanic_card` — inserting either flips
the request from passenger to driver.

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

---

## 🟢 REQ-4 — Approve requires a `national_id` that appears nowhere in the payload the reviewer is shown

Found in Phase 6. `POST /staff/verifications/{userId}/approve` validates
`national_id => required|string|max:50` and additionally 422s if the value already belongs to another
account. So the reviewer **must** supply the number.

But there is no source for it in the API. `GET /staff/verifications/pending` returns, per row:

```
user_id, name, email, gender, address, type, profile_photo, documents[{type,url}], submitted_at
```

no `national_id` — and correctly so: `User::$fillable` marks the column
`// set by admin/system_admin during verification approval only`, and the migration adds it as
`nullable()->unique()`. The user never submits it; this endpoint is what first writes it.

**Consequence:** the plan's "pre-fill the approve field from the submitted ID document" is not
implementable. The number exists only as pixels inside `face_id` / `back_id` images — which, thanks to
[BUG-7](#-bug-7--seeded-file-urls-point-at-files-that-do-not-exist-and-there-is-no-publicstorage-link),
currently do not load at all. **No pre-fill was faked.** The approve dialog states where the number
must be read from, names the ID documents actually attached, and says explicitly when none were
submitted.

**Requested, in preference order:**

1. Capture `national_id` at submission time (user side) and echo it on the pending row as
   `submitted_national_id`, so approval becomes confirm-or-correct rather than transcribe.
2. Failing that, add it to the pending payload if it is ever populated by any other flow, so a
   re-review of an already-known user does not require re-typing.

Neither is urgent — the current flow is workable — but the endpoint currently requires a field the
API gives the caller no way to know.

---

## 🔴 BUG-8 — `GET /staff/complaints/metrics` returns **500 with a full stack trace**, not 404 (Phase 7)

The integration plan recorded this route as "missing, so it 404s". That is wrong, and the truth is
worse. `"metrics"` is captured by the `{id}` route and fails that action's `int` type hint:

```console
$ curl -H "Authorization: Bearer $T" http://127.0.0.1:8000/api/staff/complaints/metrics
HTTP 500
<!DOCTYPE html> …
TypeError: App\Http\Controllers\API\Staff\StaffComplaintController::show():
  Argument #1 ($complaintId) must be of type int, string given, called in
  C:\…\vendor\laravel\framework\src\Illuminate\Routing\Controller.php on line 54 in file
  C:\…\app\Http\Controllers\API\Staff\StaffComplaintController.php on line 122
```

Combined with [NOTE-2](#ℹ️-note-2--env-ships-app_envproduction-with-app_debugtrue) (`APP_DEBUG=true`)
it renders an **Ignition HTML page carrying absolute filesystem paths and the framework's internals**
to any authenticated staff user. A missing endpoint is a gap; this is information disclosure plus an
unhandled 500 on a route that any typo'd complaint id also reaches — `/staff/complaints/abc` fails the
same way.

### Suggested fix

Two independent problems, both worth fixing:

1. Constrain the parameter so a non-numeric segment 404s instead of exploding:
   `Route::get('/complaints/{complaintId}', …)->whereNumber('complaintId');`
2. Set `APP_DEBUG=false` outside local development so a 500 never renders a stack trace.

If a metrics endpoint is genuinely wanted, register it **before** the `{id}` route.

### What the dashboard does about it

`ENDPOINTS.SUPPORT_METRICS` and `supportApi.getMetrics` were **deleted** in Phase 7, and the
`SupportStats` KPI row was rebuilt from the two `counts` blocks the list endpoints already return.
The avg-response-time card was removed rather than left showing a dash — see [REQ-5](#-req-5).

### 8b — this is a PATTERN, not one route: second site confirmed (Phase 9)

Any `{id}` route whose action type-hints `int` explodes the same way on a non-numeric segment.
Confirmed live 2026-08-13 on the wallet transactions route:

```console
$ curl -H "Authorization: Bearer $T" http://127.0.0.1:8000/api/admin/wallet/abc/transactions
HTTP 500
TypeError: App\Http\Controllers\API\WalletController::showWalletTransactions():
  Argument #1 ($walletId) must be of type int, string given
```

`verify-reports.mjs` asserts this. The fix is the same — `->whereNumber('walletId')` — and it should
be applied as a **sweep over every `{id}` route**, not one at a time.

**What the dashboard does about it:** Phase 9 added the first route-parameter links in this feature
(the admin wallet card and each wallet row open `/admin/wallet/{id}/transactions`). Every one of them
checks `Number.isFinite(wallet.id)` before the id can reach a URL, so the dashboard cannot trigger
this site. That is a guard against a backend defect, not a fix for it.

---

## 🟠 BUG-9 — `counts.all` on `GET /staff/complaints` counts rows the endpoint never returns (Phase 7)

`StaffComplaintService::listAll()` hard-excludes escalated complaints:

```php
$query = Complaint::with(self::WITH)
    ->where('status', '!=', ComplaintStatus::ESCALATED->value);
```

but `StaffComplaintController::statusCounts()` sums a `GROUP BY` over **every** complaint row,
escalated included:

```php
'all' => array_sum($rows),   // $rows = SELECT status, COUNT(*) … GROUP BY status
```

So `counts.all` overstates the list by exactly the number of escalated complaints.

### Verified live (Phase 7 seed: 10 non-escalated + 2 escalated)

```console
GET /staff/complaints
  meta.total = 10
  counts     = {"all":12,"pending":4,"in_review":2,"resolved":2,"closed":2}
```

`all: 12` sits over a list that can only ever return 10 rows. The four buckets sum to 10 — the
correct figure — so the data to fix it is already in the response.

### Suggested fix

`'all' => $rows[PENDING] + $rows[IN_REVIEW] + $rows[RESOLVED] + $rows[CLOSED]`, i.e. sum the buckets
the list can actually serve, or exclude `escalated` from the `GROUP BY`.

### What the dashboard does about it

`useSupport.inboxTotal` derives the "all" tab badge as `pending + in_review + resolved + closed` and
**never renders `counts.all`**. A unit test pins the two apart, and `verify-support.mjs` asserts both
that the bucket sum equals `meta.total` and that the rendered badge shows the sum rather than `all`.

---

## 🟠 BUG-10 — The escalated view's `status` filter silently drops its own escalated constraint (Phase 7)

`StaffComplaintService::listEscalated()` applies the escalated constraint **only in the else branch**:

```php
if ($status) {
    $query->where('status', $status);          // ← no escalated constraint at all
} else {
    $query->where('status', ComplaintStatus::ESCALATED->value);
}
```

So `GET /staff/escalated-complaints?status=resolved` returns **every resolved complaint in the
system**, including ones that were never escalated. `escalatedStatusCounts()` agrees with it — it runs
a bare `where('status', …)->count()` — so the endpoint is self-consistent but does not mean what its
name says.

### Verified live

```console
GET /staff/escalated-complaints?status=resolved
  id=7 status=resolved is_escalated=false  "Ride cancelled after I paid"
  id=8 status=resolved is_escalated=false  "Passenger left rubbish in my car"
```

Neither complaint was ever escalated. `counts` reports `{escalated:2, resolved:2, closed:2}` where the
`2`s for resolved/closed are the platform-wide totals, identical to the inbox's own `counts.resolved`
and `counts.closed`.

### Consequence

An admin reviewing "escalated complaints → resolved" is looking at the whole platform's resolved
queue, not at escalation history. There is currently **no way to ask "which complaints were escalated
and then resolved?"** — the `escalated` status is overwritten by `resolveEscalated()`, and no column
records that a complaint ever passed through it.

### Suggested fix

Scope the filter to rows that were escalated, e.g. keep an `escalated_at` timestamp (or an
`is_escalated` boolean) set by `escalate()` and never cleared, then
`->whereNotNull('escalated_at')->where('status', $status)`. That also makes the counts meaningful.

### What the dashboard does about it

The escalated view's resolved/closed tabs are labelled **"Resolved (all)" / "Closed (all)"**
(`المحلولة (الكل)` / `المغلقة (الكل)`) rather than plain "Resolved"/"Closed", so the UI does not claim
these are escalation history. `verify-support.mjs` asserts both the live `is_escalated: false` rows
and the "(all)" labels, so the workaround stays tied to the defect.

---

## 🟢 REQ-5 — No endpoint exposes complaint response latency, so the "avg response time" KPI has no source (Phase 7)

The Support page shipped a four-card KPI row whose fourth card was **average response time**. Its only
source was `GET /staff/complaints/metrics`, which does not exist and 500s ([BUG-8](#-bug-8)).

Nothing else in the checkout can supply it. `complaints` carries `created_at`, `resolved_at` and
`updated_at`, so a *resolution* time is derivable in principle — but:

- there is no aggregate endpoint that computes it, and
- the list endpoint is paginated, so a client-side average would describe **the current page**, not
  the platform, and would be presented as a server figure while being neither.

Deriving it from one page of rows and labelling it "average response time" is exactly the
invented-value case the phase brief forbids, so **the card was removed**. The KPI row is now three
cards (open / pending / resolved) plus an escalated card for roles that can read the escalated
endpoint — every one of them a direct read of a `counts` field.

### What would fix it

Either a real `GET /staff/complaints/metrics` (registered **before** the `{id}` route — see BUG-8), or
a `counts`-style block on the existing list response, e.g.
`stats: {avg_first_response_minutes, avg_resolution_minutes}`. First-response time additionally needs
a column the schema does not have: nothing records **when** an agent first responded, only the final
`resolved_at`.

---

## 🔴 BUG-11 — Every `/employees` domain refusal is 403; the controller's 409 branch is dead code (Phase 10)

`EmployeeManagementController::store()` and `update()` both carry:

```php
} catch (\DomainException $e) {
    return response()->json([...], 403);
} catch (\RuntimeException $e) {
    return response()->json([...], 409);   // ← unreachable
}
```

But `EmployeeManagementService` **never throws `\RuntimeException`**. All 18 of its throw sites are
`\DomainException`, including both uniqueness checks:

```php
if (Employee::where('username', $data['username'])->exists()) {
    throw new \DomainException("Username '{$data['username']}' is already taken.");
}
if (!empty($data['email']) && Employee::where('email', $data['email'])->exists()) {
    throw new \DomainException("Email '{$data['email']}' is already in use.");
}
```

### Verified live (2026-08-13, `verify-staff.mjs --mutate`)

```
POST /employees {username: "verify_probe_bug2", …}   → 403
  {"status":"error","message":"Username 'verify_probe_bug2' is already taken."}
```

### Consequence

A **duplicate username is reported as "forbidden"**, indistinguishable by status code from "your role
may not create this account" or "this account is restricted". Any client that branches on `409` to
show a "that name is taken, pick another" hint — which is the obvious implementation, and what the
integration plan told Phase 10 to build — will never reach that branch, and will instead tell the
user they lack permission.

### Suggested fix

Throw the exception that matches the meaning, so the existing `catch` is reached:

```php
- throw new \DomainException("Username '{$data['username']}' is already taken.");
+ throw new \RuntimeException("Username '{$data['username']}' is already taken.");
```

…for both uniqueness checks in `create()` and both in `update()` (4 sites). Leave the genuine
authorization failures as `\DomainException`.

### What the dashboard does about it

It does **not** branch on 403-vs-409 at all. `extractApiError` surfaces the server's own message
verbatim, which is unambiguous ("Username 'x' is already taken."), and the source comments at the
call site record why the status code cannot be trusted here. A test would otherwise have been written
against a 409 that never arrives.

---

## 🟢 REQ-6 — Three gaps in the wallet endpoints found while building Phase 9

Grouped because they share one page and one owner. None is a defect in the sense of "returns the
wrong thing" — each is a **missing capability that forces the UI to be less than it should be**.

### 6a — `GET /admin/wallet/requests` has no "all statuses" option

`AdminWalletRequestController::index()`:

```php
$status = $request->get('status', 'pending');
$query->where('status', $status);          // ← unconditional
```

The filter is **always** applied, defaulting to `pending`. Omitting `status` does not mean "all", it
means "pending". Verified live: the response to `GET /admin/wallet/requests` is byte-for-byte
identical to `?status=pending`, and its `meta.total` (7 on the Phase 9 seed) is smaller than the
whole table (12).

Contrast `type`, immediately below it, which is applied only `if ($request->filled('type'))` and
therefore *does* support "both".

**Consequence:** the dashboard previously mapped an "All" tab onto *sending no `status`*, so
selecting **All** silently showed **only pending requests, labelled as all**.

**Suggested fix:** make the filter conditional, matching `type`:

```php
- $status = $request->get('status', 'pending');
- $query->where('status', $status);
+ if ($request->filled('status')) {
+     $query->where('status', $request->input('status'));
+ }
```

**What the dashboard does about it:** the "All" tab was **removed**. Faking it client-side would need
three requests and could not be paginated coherently across three paginators. The three real statuses
are each reachable, and the `counts` badges show the other two totals from whichever tab is active, so
nothing is concealed. One line restores the tab once the fix lands.

### 6b — `per_page` is accepted and silently ignored on wallet transactions

```php
public function getWalletTransactions(int $walletId, int $perPage = 10)
```

The controller never passes the second argument, so the page size is hardcoded to 10. `page` **is**
honoured. Verified live: `?per_page=3` returns **10** rows and echoes `"per_page": 10`.

**Suggested fix:** thread the request value through, and validate it like every other list
(`sometimes|integer|min:1|max:50`).

**What the dashboard does about it:** the transactions drawer ships `TablePagination` **without** a
`PerPageSelect`. A page-size control there would be a widget that does nothing. `walletApi.getWalletTransactions()`
deliberately takes no `perPage` argument so the gap cannot be re-introduced by a caller.

### 6c — `GET /admin/wallet/{id}/transactions` returns a raw paginator, not the house envelope

Every other paginated endpoint in this API returns `{data, meta{current_page, last_page, per_page,
total}}`. This one returns Laravel's paginator verbatim under `transactions`:

```
current_page, data, first_page_url, from, last_page, last_page_url,
links, next_page_url, path, per_page, prev_page_url, to, total
```

— **no `meta` at all**, plus six keys nothing consumes. The nested `wallet` object is inconsistent
too: its `balance` is raw (`"135600.00"`) where `/admin/wallet` and `/admin/wallets` return the
formatted `"135,600.00 SYP"`.

**Suggested fix:** wrap it in the same `{data, meta}` shape as the rest, and format `balance`
consistently.

**What the dashboard does about it:** `WalletTransactionsPage` types the raw shape explicitly and the
hook reads the page numbers off the paginator, with a comment at both sites recording that `meta` is
absent here **by defect, not by design** — so a future refactor does not "fix" it into reading a
`meta` that will never exist.

---

## 🟠 BUG-12 — `POST /admin/photo` is a stub that reports success without doing anything (found Phase 9, extended Phase 12)

`AdminDashboardController::uploadAdminPhoto()` is, in its entirety:

```php
return response()->json(['status' => 'success', 'message' => 'Photo uploaded']);
```

No validation, no file handling, no storage write, no database write.

### Verified live (2026-08-13)

A POST with **no file at all** returns `200 {"status":"success","message":"Photo uploaded"}`.

### Consequence

This is the reason `admin_photo` will never populate, alongside [BUG-5](#-bug-5). Worse than a
missing endpoint: it **actively lies**. Any UI wired to it would show the user a success toast for a
photo that was never stored, and the avatar would silently stay on its initials fallback.

### Suggested fix

Either implement it (validate `image|max:2048`, store, write the path to the employee row) or remove
the route so it 404s honestly.

### 🔴 Two more reasons this can never be completed as currently written (found Phase 12)

Even a correct implementation of the stub above would have nowhere to land:

1. **`employees` has no photo column.** The table (`database/migrations/2026_05_15_230503_create_employees_table.php`)
   is exactly `id, username, email, password, first_name, last_name, role, is_active, created_by,
   token_version, last_login_at, timestamps` — no `photo`/`avatar`/`image` column, and the `Employee`
   model defines no such accessor either. There is nowhere to write the path even if the controller
   stored the file.
2. **`GET /staff/me` cannot return one either.** `EmployeeAuthService::formatEmployee()` is a fixed
   list — `id, username, email, full_name, role, role_label, is_active, last_login_at, created_at` —
   with no photo field, so even a successfully stored path would never reach the client that needs to
   render it.

This is why the missing column, not just the empty controller body, is the real blocker: adding
validation and a `Storage::put()` call to `uploadAdminPhoto()` alone would still 500 or silently drop
the value on the next save.

### What the dashboard does about it

**No upload control is wired to it, in any phase — this is a removal, not a deferral.** The plan's
original Phase 12 item ("wire `POST /admin/photo` (multipart) for upload") was struck for the three
reasons above. The shared `<Avatar>` initials fallback (Phase 4) is the header photo's permanent,
correct final state, not a placeholder waiting on this endpoint.

---

## 🔴 BUG-13 — A staff (employee) JWT authenticates against the `users` table: cross-realm identity confusion (found Phase 12)

The eight `/api/notifications/*` routes are guarded by `jwt` (`JwtAuthMiddleware`), the **end-user**
middleware — not `staff`. `JwtAuthMiddleware::handle()` does `User::find($payload['sub'])` and never
inspects the `sub_type` claim. `StaffJwtService` and `JwtService` both derive their signing key from
`config('jwt.secret')` **raw** — `StaffJwtService::secret()` carries a comment explaining the base64
decode was removed *specifically so the two match*. A staff-issued token therefore has a valid
signature under the end-user middleware too, decodes cleanly, and is resolved against whatever row in
`users` happens to share its numeric `sub`.

### Verified live (2026-08-14)

Employee `system_admin` (employee id **1**) logged in via `POST /staff/login` → JWT payload
`{"sub":1,"sub_type":"employee","role":"system_admin","type":"access","ver":0,...}`.

This local seed also has a **`users` row with id 1** (the admin account `AdminUserSeeder`/config
creates so `UserObserver` has a rater to attribute the base 3.0 rating to). Presenting the staff
token to the end-user route as-is returned:

```
GET /api/notifications/unread-count
401 {"status":"error","code":"TOKEN_INVALIDATED","message":"Your session has been invalidated. Please log in again."}
```

— **not** because of a `sub_type` check (there is none), but because `JwtAuthMiddleware` also
compares the token's `ver` claim (employee `token_version`, `0`) against `users.token_version` for
user 1 (`1` in this seed), and `validateTokenVersion()` rejects the mismatch. That is a coincidence of
this seed's two independent `token_version` counters, not a guard against the identity confusion.
Setting `users.token_version = 0` for user 1 — matching the employee's `ver` — and repeating the exact
same request (immediately reverted after):

```
GET /api/notifications/unread-count
200 {"success":true,"unread_count":0}
GET /api/notifications
200 {"success":true,"data":{"current_page":1,"data":[],...},"unread_count":0}
```

**A `system_admin` employee token was accepted as passenger/driver user 1 and returned that user's
real (empty, in this seed) notification data.** The two `token_version` counters (`employees` vs
`users`) are independent and both commonly start at `0` for a freshly created row, so on a database
where an employee id and a `users` id collide *and neither account has ever had its tokens revoked*,
this is not a coincidence anyone controls — it fires by default.

### Consequence

Any employee (any role, since none of the eight routes carry a `staff:` role gate — they carry `jwt`)
whose numeric id collides with a `users.id` can read, mark read/unread, bulk-act on, and delete that
person's private ride/booking/wallet notifications, and mark their own **employee** session as
"read" against a stranger's inbox. This is an authentication defect, not an authorization one — no
staff role should reach these routes at all.

### Suggested fix

`JwtAuthMiddleware` must reject any token carrying a `sub_type` other than the end-user type it
expects (mirroring the check `StaffJwtMiddleware` already does in the other direction), **not** rely
on the two token-version counters happening to disagree.

### What the dashboard does about it

**No staff-reachable notifications endpoint exists**, so `MainLayout`'s bell — a hardcoded red unread
dot with no handler, no dropdown, no data — is removed rather than wired to a route that authenticates
as the wrong person (Phase 12 Trap 1). Restore it only once the backend gates these routes by role, or
adds a genuinely staff-scoped notifications endpoint.

---

## ✅ BUG-14 — The staff chat inbox never learns who the customer is: `user` is null on every support conversation (found Phase 16, **FIXED 2026-08-17**)

> **Fixed in the backend.** `app/Models/Conversation.php::getOtherParticipant()` now admits `support`
> alongside `private`. Verification is in the "Fixed" section at the end of this entry. The rest of
> the entry is kept as the record of what was wrong and how it was proven.


`StaffChatController::formatConversation()` builds a `user` block whose own docblock says *"the OTHER
participant — the customer, not the agent"*, and the staff chat screen exists to show exactly that.
It calls:

```php
$otherUser = $conversation->getOtherParticipant($agentUser);
```

and `Conversation::getOtherParticipant()` opens with:

```php
if ($this->type !== 'private') {
    return null;
}
```

Every conversation the staff inbox serves is created by `ContactController` with **`type: 'support'`**
(and `ChatRepository::findSupportConversation()` looks it up by that same type, so it is not an
accident). The one type this screen never sees is `private`. So the guard returns `null` for every row
the endpoint returns, on both routes that use the formatter.

### Verified live (2026-08-17)

14 conversations seeded ([`seed-phase-chat.sql`](./seed-phase-chat.sql)) — 13 `support` and one
`private` kept deliberately as a control. `GET /staff/chat/conversations` as `system_admin`:

```
{"id":9101,"type":"support","user":null,"last_message":{…,"sender_name":"Passenger1","sent_by_agent":false},…}
{"id":9113,"type":"support","user":null,…}
{"id":9114,"type":"private","user":{"id":24,"name":"Passenger14 Test","email":"passenger14@test.com",
                                    "profile_photo":"…","account_status":"active"},…}
```

The single `private` row is the **only** one carrying an identity. `GET /staff/chat/conversations/9101/messages`
repeats the same null block in its `conversation` key.

### Consequence

The customer's name, email, profile photo and `account_status` — the four things that make an inbox
row identifiable and the only place `account_status` (banned / inactive / active) surfaces on this
screen at all — are withheld from every conversation an agent will ever open. A support queue where
no row says who it is from is not usable as a queue.

### Suggested fix

One line. The early return is guarding against group conversations, where "the other participant" is
not well defined; `support` is a two-party conversation exactly like `private`:

```php
if (!in_array($this->type, ['private', 'support'], true)) {
    return null;
}
```

Nothing else needs to change — `formatConversation()` already handles a populated `$otherUser`, and
the `participants` rows carry the `customer` / `agent` pivot roles `ContactController` wrote.

### What the dashboard does about it

The chat page does **not** render "Unknown user" fourteen times. `useChat` reconstructs the identity
from data the API does return, in descending order of certainty:

1. `conversation.user`, whenever it is populated — so the day this bug is fixed the reconstruction
   silently stops being load-bearing, with no frontend change.
2. `last_message.sent_by_agent` paired with the newest message on page 1 (they are the same message).
   That pins one of the two ids on every non-empty thread: `true` names the **agent's** shadow user,
   `false` names **this conversation's customer**. The pairing is only trusted when the two payloads
   agree on the newest message's content and timestamp, because they are separate queries ordered by
   `created_at` alone and could break a tie differently.
3. The 201 from `POST …/messages`, whose `data.sender.id` is the agent by definition. The agent's
   shadow user is the same for the whole session, so once known it classifies every message in every
   thread — and any sender that is *not* the agent is the customer, which recovers their full name
   and photo from the `sender` block.

Where nothing is knowable (an empty conversation, never opened), the row is labelled with its
conversation number rather than guessed at, and message alignment falls back to "incoming" — claiming
a user's message was written by support is the worse error in a moderation tool.

**This fallback was kept after the fix.** It costs nothing when `user` arrives populated (it is
checked first), and it is what keeps the page readable against a backend that has not picked up the
fix, or a conversation type the guard does not answer for. Its branches stay covered by
`tests/hooks/useChat.test.ts`.

### ✅ Fixed (2026-08-17)

`app/Models/Conversation.php` — the guard now names the types it excludes rather than the one it
allows, since `support` is a two-party conversation exactly like `private`:

```php
if (!in_array($this->type, ['private', 'support'], true)) {
    return null;
}
```

Verified live against the same 14 seeded conversations, as `system_admin`:

```
GET /staff/chat/conversations
  total: 14 | populated user: 14 | still null: 0
  9101 support {"id":11,"name":"Passenger1 Test","email":"passenger1@test.com","profile_photo":"…","account_status":"active"}
  9104 support {"id":14,"name":"Passenger4 Test", …}          ← the empty conversation, now identified too

GET /staff/chat/conversations/9101/messages
  conversation.user = {"id":11,"name":"Passenger1 Test", …}   ← the second route agrees
```

`account_status` — unreachable before the fix, since it lives on the block that was null — was
exercised in both non-default directions by temporarily setting `users.status` to `-1` and `0` for
users 12 and 13, confirming `banned` and `inactive` respectively, in the payload and as the badge in
the thread header. **Both rows were restored to `status = 1` immediately after**; nothing else in
`users` was touched.

No frontend change was required: `resolveCustomer()` checks `conversation.user` first, so the
dashboard picked the real identities up on the next poll. The browser walkthrough went from 21 to
23 checks (the two new ones assert every row carries a real name, and that the banned badge and the
real email render in the thread header) and passes 23/23.

---

## ℹ️ NOTE-3 — Verified: the rejection reason really does reach the user (Phase 6)

`POST /staff/verifications/{userId}/reject` takes `reason => nullable|string|max:500` (**no minimum
length** — unlike the 10-character ban/cancel/escalate reasons) and appends it to the Arabic
notification body. The `createNotification` call is wrapped in `try { … } catch (\Throwable) {}`, so
it was worth confirming it is not silently swallowed. It is not — a real rejection wrote:

```
type    verification_rejected
title   طلب التوثيق مرفوض
message تم رفض طلب توثيق حسابك. السبب: مكرر
```

Note the row is linked through `user_notifications`, not through `notifications.user_id` (that column
exists but is left null by this path) — worth knowing before concluding "no notification was sent".

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

## ℹ️ NOTE-4 — The staff chat routes page inconsistently. Documenting, not filing.

Two endpoints, two different (and both unusual) paging models. Neither is a defect, but a consumer
that assumes the house `meta {current_page, last_page, per_page, total}` envelope will get it wrong
both times.

**`GET /staff/chat/conversations` is not paginated at all.** It accepts no `page` or `per_page`,
runs `getUserConversations()` (a bare `orderBy('updated_at','desc')->get()`) and returns every row
plus a `total` that counts the whole list rather than a page. Verified live: `total: 14`, 14 rows.
Fine at inbox scale; it is O(all conversations ever) per poll, so it will need real pagination before
a busy queue. The dashboard pages, searches and sizes the list client-side, which is also why its
search box can match on the last message's text.

**`GET …/{id}/messages` pages backwards from the newest end, with no total.** `page=1` is the newest
`limit` messages (ascending *within* the page), `page=2` the `limit` before those; `meta` echoes only
`{page, limit}`. Verified live on a 62-message thread: page 1 → 50 rows ending at the newest, page 2
→ 12 rows starting at the oldest. There is therefore no `last_page` to trust and no total to count
against — "are there older messages?" can only be inferred from whether a page came back full, and
the offset shifts by one for every message that arrives while an agent is reading. The dashboard
merges pages by message id rather than concatenating them; because the shift always moves the window
towards *newer* messages, a re-fetch can only ever re-serve rows already held, never skip one.

Two smaller shape inconsistencies on the same routes, both handled client-side:

- `last_message.created_at` is `diffForHumans()` — **English only**, whatever the UI language. Only
  `created_at_iso` is safe to render. Same trap as `ComplaintType::label()`'s Arabic-only output.
- `metadata` on a message has three runtime shapes: `null` (stored text), `{…}` (image), and `[]` —
  an empty PHP array serialised as a JSON **array** — on the message a `POST` hands straight back.
  That same 201 also returns `is_edited: null` where the read routes return `false`.

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
- Phase 6 mutations (user 33 rejected, user 31 approved, plus four temporary `photos` rows on user 31)
  were **fully rolled back in SQL** — `verification_status` back to `pending`, both `is_verified_*`
  flags back to 0, `national_id` back to `NULL`, the seeded `photos` rows and the
  `verification_rejected` notification deleted — followed by `cache:clear`. Verified afterwards:
  `GET /staff/verifications/pending` again returns `total: 2`, users 31 and 33, both `passenger`,
  both `documents: []`. `verify-drivers.mjs` (94/94) and `verify-users.mjs` (137/137) were re-run and
  still pass.
- Phase 7/8 found **both features completely unseeded** — `complaints`, `complaint_attachments`,
  `profile_comments` and `user_ratings` were all empty, so nothing on either page could render. A
  deliberate temporary seed (12 complaints, 2 attachments, 8 profile comments) was applied from
  [`seed-phase-7-8.sql`](./seed-phase-7-8.sql), the runs recorded, and **all of it removed again** via
  [`revert-phase-7-8.sql`](./revert-phase-7-8.sql) — which also deletes the `complaint_response` /
  `complaint_resolved` notifications a `--mutate` run creates through the `user_notifications` join
  table, and resets the three `AUTO_INCREMENT` counters. Verified afterwards, read-only:
  `/staff/complaints` `total: 0` with all counts `0`, `/staff/escalated-complaints` `total: 0`,
  `/staff/reviews` `total: 0`, and `notifications` carries 0 rows of either complaint type.
  `verify-verifications.mjs` (51/51), `verify-drivers.mjs` (94/94) and `verify-users.mjs` (137/137)
  were re-run afterwards — Phase 7 touched the shared `ConfirmActionModal`, `PerPageSelect` and
  `useApiAction` — and all three still pass.
- Phase 9 found `wallet_requests` **completely empty** (0 rows) while reports, wallets and wallet
  *transactions* all had real data and needed no seeding. A deliberate temporary seed of **12
  `wallet_requests`** (ids 9001–9012: 7 pending / 3 approved / 2 rejected, both `type` values in every
  status) was applied from [`seed-phase-9.sql`](./seed-phase-9.sql), the runs recorded, and **all of
  it removed again** via [`revert-phase-9.sql`](./revert-phase-9.sql).
  A `--mutate` run additionally performed one real approve, one real reject and one real admin wallet
  charge — **none of which is reversible through the API**. Each moved a balance and/or wrote a
  `wallet_transactions` row, so the revert also restored `wallets.balance` for wallets 4 and 32 and
  deleted the two transactions (one `reference='wallet_request:9002'`, one
  `transaction_id='SYSTEM_ADMIN_CHARGE_…'` — the latter has a NULL `reference`, which is why the
  revert matches it by `transaction_id` prefix). Verified afterwards, read-only:
  `wallet_requests` **0 rows**, `wallet_transactions` back to **194**, wallet 4 back to
  `2063600.00` and wallet 32 to `4986000.00`.
- **Phase 16 (chat)** found `conversations` and `messages` **both completely empty** (0 rows), so the
  whole chat feature — inbox, thread, media, paging, empty states — rendered against nothing. A
  deliberate temporary seed of **14 conversations (ids 9101–9114) and 87 messages (ids 9001–9087)**
  was applied from [`seed-phase-chat.sql`](./seed-phase-chat.sql). Unlike the Phase 7/8 and 9 seeds,
  **this one has deliberately been LEFT IN PLACE** so the new page can be opened and read without
  re-seeding first; remove it whenever you like with
  [`revert-phase-chat.sql`](./revert-phase-chat.sql), which deletes by `conversation_id` and so also
  removes any message sent through the dashboard while verifying (a real `POST` gets an ordinary
  auto-increment id, well below the seeded range).
  One thing the revert deliberately does **not** touch: the shadow `users` row for employee
  `system_admin` (user 36, primary@admin.com). That was not created by the seed — the first
  `GET /staff/chat/conversations` created it via `ensureShadowUser()`, it is permanent by design, and
  deleting it would cascade into real user data.
- Phase 10 ran `verify-staff.mjs --mutate`, which deliberately triggers the three write-then-500
  endpoints against **employee 3 (`agent01`, non-restricted)** and asserts the write landed by
  reading the database after each 500. All three were rolled back inside the script
  (`is_active` restored, `first_name` restored, the probe employee deleted), and the run ends by
  asserting the `employees` table is **byte-for-byte identical** to the snapshot taken before it
  started. Confirmed: 3 employees, all `is_active = 1`.
- After Phase 9/10, `verify-drivers.mjs` (94/94), `verify-users.mjs` (137/137),
  `verify-verifications.mjs` (51/51), `verify-support.mjs` (105/105) and `verify-reviews.mjs` (64/64)
  were all re-run — Phase 10 added an optional `hideReason` prop to the shared `ConfirmActionModal` —
  and all five still pass. The Phase 7/8 seed was re-applied for the support/reviews runs and
  reverted again afterwards.
- **Phase 11–15 environment (new machine, 2026-08-14):** macOS, PHP 8.5.0, MySQL 9.5.0 (Homebrew),
  same backend checkout re-cloned (`cae097b`, "v 5.8.0 with seeder" — later than `3eb54ad`, no schema
  changes relevant to the routes above). Fresh `.env` for local dev (`DB_HOST=127.0.0.1`,
  `CACHE_DRIVER=file`, `SESSION_DRIVER=file`, `QUEUE_CONNECTION=sync`); `config/database.php`'s
  `PDO::MYSQL_ATTR_SSL_CA` reference was made conditional on `MYSQL_ATTR_SSL_CA` actually being set —
  PHP 8.5 deprecates unconditional access to that constant and, with `APP_DEBUG=true`, the deprecation
  notice was being prepended as HTML to every JSON response body, breaking the frontend's `axios`
  parsing. Database migrated fresh and reseeded via `AdminUserSeeder` (adapted inline — its
  `config('admin.system_admin.*')` keys no longer exist in `config/admin.php`, which Phase 9 narrowed
  to wallet-routing only) + `SystemWalletSeeder` + `Atarikaktestseeder`: **36 users, 71 rides, 58
  bookings, 32 wallets, 194 wallet transactions, 2 pending verifications, 0 complaints, 0 reviews, 3
  employees** (`system_admin`, `sycash`, and `agent01`/id 3 re-created as the non-restricted employee
  `verify-staff.mjs` expects). `employees.role` ENUM needed the same BUG-3 widening. `verify-dashboard.mjs`,
  `verify-reports.mjs` (155/155, `wallet_requests` re-seeded from a locally id-shifted copy of
  `seed-phase-9.sql` and reverted after) and `verify-staff.mjs` (50/50) all re-run clean.
- **Phase 12 Trap 1 probe (BUG-13, 2026-08-14):** `GET /api/notifications/unread-count` with employee
  1's staff token returned `401 TOKEN_INVALIDATED` as-issued (this seed's `users.token_version` for id
  1 happened to be `1` against the employee's `ver:0`). Setting `users.token_version = 0` for user 1 to
  match and repeating the identical request returned `200` with that user's real notification payload,
  confirming the cross-realm defect is real and merely not triggered by this seed's coincidental
  counters. `users.token_version` was reverted to `1` immediately after.
