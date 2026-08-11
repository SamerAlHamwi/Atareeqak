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

## 🟢 REQ-2 — `GET /staff/bookings` returns no `counts` block, so the bookings tabs cannot show badges

Found while building the Bookings UI (integration plan, Phase 3).

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
