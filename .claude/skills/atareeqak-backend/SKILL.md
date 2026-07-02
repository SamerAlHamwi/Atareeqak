---
name: atareeqak-backend
description: Architecture guide and conventions for the Atareeqak ride-sharing Laravel 10 API backend (4th_year_projects_refractored/). Use when adding or modifying routes, controllers, services, repositories, models, middleware, jobs, tests, or any PHP code in that directory.
---

# Atareeqak Backend — Laravel API Architecture & Conventions

The backend of the Atareeqak ride-sharing platform lives in `4th_year_projects_refractored/`. It serves three client groups: the mobile/user app (rides, bookings, chat, wallet), the admin dashboard (the React frontend in `src/` — see the `atareeqak-frontend` skill), and staff/support tooling.

## Tech stack

- Laravel 10, PHP 8.2 (strict, readonly properties, native enums)
- Auth: custom JWT (`php-open-source-saver/jwt-auth`) with refresh tokens — NOT Sanctum sessions
- MySQL, Redis (predis), Pusher + laravel-echo (chat/broadcasting), Firebase FCM (push), Stripe, Resend (email), dompdf (PDF export)
- Testing: PHPUnit 10 (`tests/Feature/*` grouped per domain, `tests/Unit/*`); test DB is `4th_year_project_test` (MySQL, see `phpunit.xml`)
- Style: Laravel Pint; SonarQube configured (`sonar-project.properties`)
- Deploy: Docker (`docker-compose.yml` — app on :8080, MySQL) + GitHub Actions (`.github/workflows/deploy-to-vps.yml`); production URL `https://api.onwayride.me`
- Run locally: `php artisan serve` (or docker compose); tests: `php artisan test` or `vendor/bin/phpunit`

## Layered architecture (follow this flow)

```
Route (routes/api.php)
  → Controller (app/Http/Controllers/API/)      — validation + JSON shaping only
    → Service (app/Services/<Domain>/)          — business logic, one domain per folder
      → Repository (app/Repositories/)          — DB access, bound to Interfaces
        → Model (app/Models/)                   — Eloquent
```

- **Controllers** are thin, `final`, use constructor promotion with `private readonly` service injection. Validation via `Validator::make` inline or FormRequests (`app/Http/Requests/`). They return `response()->json(['status' => 'success'|'error', 'data' => ..., 'meta' => ...])` — keep this envelope; paginated lists include `meta` with `current_page`, `last_page`, `total`.
- **Services** hold all business logic. Register every new service as a singleton in `app/Providers/AppServiceProvider.php::register()` (grouped by domain with comment banners).
- **Repositories** implement an interface in `app/Interfaces/` and are bound in `AppServiceProvider` (`$this->app->bind(XRepositoryInterface::class, XRepository::class)`). Services depend on the interface, not the concrete class.
- **Domain layer** (`app/Domain/`) holds pure logic: `ValueObjects/` (`Money`, `PhoneNumber`, `Email`, `Location`), `Payment/Strategies/` (strategy pattern — `CashPaymentStrategy`, `EPayPaymentStrategy`, created via `PaymentStrategyFactory`), `Score/Policies/` (policy-per-action scoring, e.g. `DriverNoShowPolicy`, via `ScorePolicyFactory`).
- **Enums** (`app/Enums/`) are PHP 8.1 backed enums with behavior methods: `RideStatus`, `BookingStatus`, `BookingType`, `ComplaintStatus`, `ComplaintType`, `PaymentMethod`, `ScoreAction`, `StaffRole`. Use these instead of string literals.
- Supporting layers: `app/Events/` + `app/Listeners/` (ride/chat/notification events), `app/Jobs/` (queued push notifications), `app/Observers/` (`UserObserver` registered in `AppServiceProvider::boot()`), `app/DTOs/`, `app/Http/Resources/` (`RideResource`, `BookingResource`).

## Auth & roles (three separate JWT guards)

Middleware aliases in `app/Http/Kernel.php`:

| Alias | Middleware | Who |
|---|---|---|
| `jwt` | `JwtAuthMiddleware` | Mobile app users (drivers/passengers), `User` model |
| `staff` | `StaffJwtMiddleware` | Employees, `Employee` model; accepts role params: `staff:admin,system_admin` |
| `auth.admin` | `AdminJwtMiddleware` | Legacy admin guard |

`StaffRole` enum defines the hierarchy: `system_admin` (3) > `admin` (2) > `support_agent` (1); `canManage()` allows managing strictly lower roles only. Refresh tokens are persisted (`RefreshToken`, `StaffRefreshToken` models).

## Route groups in routes/api.php (single file, ~390 lines, section banners)

- **Public**: `/otp/*`, `/textme-otp/*`, `/auth/*` (signup, login, refresh, 3-step OTP password reset), `/email-verification/*`
- **`jwt` protected (app users)**: `/user`, `/logout`, `/score/*`, `/profile/*` (incl. verification submit), `/rides/*` (search, create-with-route, book, cancel, finish, no-show reporting), `/bookings/*` (accept/reject/cancel/confirm), `/chat/*`, `/notifications/*`, `/wallet/*` (balance, OTP-gated creation, charge/withdraw requests), `/complaints/*`, `/contact`
- **`/admin/*`** — login/refresh public; everything else behind `staff:admin,system_admin`. Dashboard stats, trips, drivers, users, ban/unban, wallets, passenger full-profile (BFF endpoint returning the whole page in one call). A nested `staff:system_admin` block guards wallet charge, PDF export, reports, verifications.
- **`/staff/*`** — behind `staff` (any role): reviews moderation, users, trips/bookings + cancellation, complaints (respond/escalate). Nested `staff:admin,system_admin`: pending verifications, escalated complaints. Routes here are named (`->name('staff.…')`).
- **`/employees/*`** — CRUD + toggle-active + reset-password, `staff:system_admin` only.

When adding a route: put it in the correct section/group, keep the banner-comment style, and route to a controller in the matching namespace (`API/`, `API/Staff/`, `API/Auth/`).

## Conventions checklist for new backend work

1. Route in the right group in `routes/api.php` with correct middleware.
2. Controller: `final`, thin, constructor-injected service, `JsonResponse` return types, `['status' => …]` envelope, 422 with `errors` on validation failure.
3. Business logic in a Service under `app/Services/<Domain>/`; register the singleton in `AppServiceProvider`.
4. New DB queries via a Repository + Interface pair, bound in `AppServiceProvider`.
5. Statuses/types as Enums, money/phone/location via Domain ValueObjects.
6. Docblocks reference use-cases (`UC-ADM-03` style) and list routes the controller serves — keep doing this.
7. Add a Feature test under the matching `tests/Feature/<Domain>/` folder; run `php artisan test`.
8. Migrations in `database/migrations/`; note `Schema::defaultStringLength(191)`.

## Gotchas

- Notifications ship through three channels: DB (`Notification`/`UserNotification`), FCM push (`app/Services/PushNotification/`, queued via `app/Jobs/`), and Pusher broadcast events — check which a feature needs.
- OTP has three providers: WhatsApp, TextMeBot, and Email (`EmailOtpServiceInterface`); wallet creation and password reset are OTP-gated flows.
- Geocoding services handle Arabic place names (`ArabicPlaceNameService`) — ride search/create depends on them.
- `/test` and `/test-db` are debug endpoints at the top of `api.php`.
- `all_code.txt`, `tests_code.txt`, `old rideservice/`, and `coverage.xml` are generated/legacy artifacts — never edit them; edit the real source under `app/`.
- The React admin frontend consumes this API; keep response shapes compatible with `src/services/endpoints.ts` and the feature `*Api.ts` interfaces (see `atareeqak-frontend` skill).
