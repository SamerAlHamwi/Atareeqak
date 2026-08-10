# Running the backend locally

There is no deployed SyRide API (see [`probe-results.md`](./probe-results.md)), so every phase is
verified against a backend running on this machine.

> ## ✅ Currently running: `http://127.0.0.1:8000/api`
>
> | Piece | What | How it was started |
> |---|---|---|
> | Database | MySQL **8.0.40** portable, `127.0.0.1:3306`, root with no password | `mysqld --console` from `C:\Users\Tech\mysql-portable\mysql-8.0.40-winx64` |
> | API | Laravel via `php artisan serve` on **:8000** | `APP_ENV=localdev php artisan serve --host=127.0.0.1 --port=8000` |
> | Dashboard | Vite on **:5173**, proxying `/api` → `:8000` | `npm run dev` |
>
> **Port 8000, not 8080** — Apache (XAMPP, PID `httpd`) already owns 8080 on this machine, and
> `artisan serve` cannot bind it. `vite.config.ts` targets 8000 to match; override with
> `VITE_PROXY_TARGET` if you free 8080 or start the Docker stack.
>
> Verified end to end: `curl http://localhost:5173/api/test` → `{"message":"API is working!"}`, and a
> proxied `/api/staff/login` returns `role: system_admin`.

---

## Seeded credentials

`SpecialAccountSeeder` creates the two accounts that can never be made through the API. It reads them
from the backend's `.env` — these are the values currently there:

| Role | Username | Email | Password |
|---|---|---|---|
| `system_admin` | `system_admin` | `primary@admin.com` | `admin` |
| `sycash` | `sycash` | `sycash@admin.com` | `sycash123` |

Both `/staff/login` (field: `identifier`) and `/admin/login` (field: `email` or `username`) accept
either the username or the email.

> ⚠️ The dashboard's old "Use demo credentials" button filled in `primary@admin.com` /
> **`admin_password`** — the wrong password. It was removed in Phase 1.
>
> ⚠️ These are development credentials in a local `.env`. `admin` is a one-word password; rotate both
> before anything is exposed beyond localhost, using `php artisan admin:rotate-password system_admin`.

---

## Option A — full Docker stack (what `docker-compose.yml` defines)

Matches production: nginx load-balancing three Octane/RoadRunner nodes, plus MySQL, Redis, a queue
worker, and phpMyAdmin.

> ⚠️ **Docker Desktop is not installed yet — it needs one elevated command.** The unattended install
> was attempted and stopped at a UAC prompt:
> `[ProcessEnvironmentDetector][I] Not run as admin, relaunching with UAC prompt`
> (`%LOCALAPPDATA%\Docker\install-log.txt`). The 596 MB installer is already downloaded and
> extracted to `C:\Program Files\Docker\Docker.staging`.
>
> **In an Administrator PowerShell:**
> ```powershell
> winget install --id Docker.DockerDesktop --accept-package-agreements --accept-source-agreements
> ```
> It targets the **WSL2 backend**, and WSL currently has **no distro installed**, so you may also need
> `wsl --install` and a reboot. Virtualization is enabled in firmware, so the hardware side is fine.
>
> Until then, use **Option C**, which needs no admin rights.

```console
cd ../4th_year_projects_refractored

docker compose up -d --build          # first run builds the image; expect 5-15 min
docker compose ps                     # all services healthy?

docker compose exec app1 php artisan migrate --force
docker compose exec app1 php artisan db:seed --class=SpecialAccountSeeder --force
```

| Service | URL |
|---|---|
| API | `http://localhost:8080/api` |
| phpMyAdmin | `http://localhost:8081` (root / `secret`) |

The compose file overrides `DB_HOST=mysql`, `REDIS_HOST=redis`, `DB_PASSWORD=secret`, and
`APP_ENV=production` on top of the backend `.env`.

## Option B — containers for data only, PHP on the host

Faster to iterate: no image build, and `artisan serve` restarts instantly. Requires PHP 8.2 on the
host (already installed — see the note at the bottom).

MySQL is **not** published to the host by `docker-compose.yml`, so add an override in the backend
checkout:

```yaml
# 4th_year_projects_refractored/docker-compose.override.yml
services:
  mysql:
    ports: ["3306:3306"]
  redis:
    ports: ["6379:6379"]
```

```console
cd ../4th_year_projects_refractored
docker compose up -d mysql redis

# point the app at the host-published ports for this shell only
DB_HOST=127.0.0.1 DB_PASSWORD=secret CACHE_DRIVER=file \
  php artisan migrate --force
DB_HOST=127.0.0.1 DB_PASSWORD=secret CACHE_DRIVER=file \
  php artisan db:seed --class=SpecialAccountSeeder --force
DB_HOST=127.0.0.1 DB_PASSWORD=secret CACHE_DRIVER=file \
  php artisan serve --port=8080
```

`artisan serve` puts routes under `http://localhost:8080/api/...`, same as nginx does.

## Option C — portable MySQL + `artisan serve` (no admin rights needed)

What is running today. MySQL 8 from the ZIP archive needs no installer and no elevation, and
`artisan serve` needs no web server.

> **SQLite is not an option.** `2025_05_19_135630_create_rides_table` declares a **spatial index**,
> and Laravel's SQLite grammar throws `The database driver in use does not support spatial indexes.`
> MySQL (or MariaDB ≥ 10.2.2) is genuinely required.

### 1. MySQL

```console
MYSQL_HOME="/c/Users/Tech/mysql-portable/mysql-8.0.40-winx64"

# one-time
"$MYSQL_HOME/bin/mysqld" --initialize-insecure --basedir="$MYSQL_HOME" --datadir="$MYSQL_HOME/data"

# start (leave running)
"$MYSQL_HOME/bin/mysqld" --console --basedir="$MYSQL_HOME" --datadir="$MYSQL_HOME/data" \
  --port=3306 --bind-address=127.0.0.1

# one-time
"$MYSQL_HOME/bin/mysql" -u root --skip-password -e \
  "CREATE DATABASE IF NOT EXISTS 4th_year_project_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
```

### 2. `.env.localdev` — how local settings actually take effect

**`artisan serve` forwards only a whitelist of environment variables** (`APP_ENV`, `PATH`,
`XDEBUG_*`, …) to the served process — see `ServeCommand::$passthroughVariables`. So
`DB_HOST=127.0.0.1 php artisan serve` silently does nothing: the child still reads `.env`, which
points at the Docker service names (`DB_HOST=mysql`, `CACHE_DRIVER=redis`) and fails.

`APP_ENV` *is* forwarded, and Laravel loads `.env.{APP_ENV}` when it is set. So local config lives in
**`4th_year_projects_refractored/.env.localdev`** (already created; gitignored by the `.env.*` rule):

```ini
APP_ENV=localdev
APP_DEBUG=true
APP_URL=http://localhost:8000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=4th_year_project_db
DB_USERNAME=root
DB_PASSWORD=
CACHE_DRIVER=file        # .env says redis; there is no Redis here
SESSION_DRIVER=file
QUEUE_CONNECTION=sync
BROADCAST_DRIVER=log
```

Note `artisan migrate` / `db:seed` run in-process, so plain env vars *do* work for those — only
`serve` needs the file.

### 3. Migrate, seed, serve

```console
cd ../4th_year_projects_refractored
export APP_ENV=localdev

php artisan migrate --force
php artisan db:seed --class=SpecialAccountSeeder --force
php artisan serve --host=127.0.0.1 --port=8000
```

⚠️ **The seeder fails for `sycash` on a fresh database** — `employees.role` is an ENUM that never
gets widened, because the migration that would do it is skipped
([BUG-3](./backend-issues.md)). Until the backend is fixed, run this once after migrating:

```sql
ALTER TABLE employees
  MODIFY COLUMN role ENUM('system_admin','sycash','admin','support_agent') NOT NULL;
```

then re-run the seeder.

---

## Verifying the backend is really up

```console
curl http://127.0.0.1:8000/api/test
# {"message":"API is working!","timestamp":"..."}

bash docs/api/probe.sh    http://127.0.0.1:8000/api   # which routes exist
bash docs/api/verify-auth.sh http://127.0.0.1:8000/api # Phase 1 acceptance (20/21 pass)
```

The probe's **control block must return `401`** on all four routes. If it returns `404`, you are not
talking to the Laravel app and nothing else in the output means anything.

Then confirm a real login:

```console
curl -s -X POST http://127.0.0.1:8000/api/staff/login \
  -H 'Content-Type: application/json' \
  -d '{"identifier":"system_admin","password":"admin"}'
```

Expect `{"status":"success","employee":{...,"role":"system_admin",...},"tokens":{...}}`.

---

## Point the dashboard at it

Nothing to change — `vite.config.ts` proxies `/api` to `http://127.0.0.1:8000/api`. Override per
machine with `VITE_PROXY_TARGET` in `.env.local` if your backend listens elsewhere (e.g.
`http://localhost:8080/api` for the Docker stack).

```console
cd ../Atareeqak && npm run dev
```

---

## PHP on the host (already set up)

PHP 8.2.33 was installed during Phase 0 to run `artisan route:list`:

- binary: `%LOCALAPPDATA%\Microsoft\WinGet\Packages\PHP.PHP.8.2_Microsoft.Winget.Source_8wekyb3d8bbwe\php.exe`
- a `php.ini` next to it enables `mbstring, openssl, curl, fileinfo, zip, pdo_mysql, pdo_sqlite, gd, intl, sodium, exif`
- `vendor/` is installed in the backend checkout (`composer install --ignore-platform-reqs --no-scripts`)

Restart your terminal to pick up the PATH entry winget added, or call the binary by full path.
