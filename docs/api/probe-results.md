# API probe results

**Run date:** 2026-08-10
**Phase:** 0.2 of `BACKEND_INTEGRATION_PLAN.md`

> ## ✅ Superseded — a backend now runs locally and the probe is conclusive
>
> Sections 1–3 below describe the first run, against the host the dashboard was configured to call.
> That run was **inconclusive** (the host is not the Laravel app). It is kept because it is why
> `vite.config.ts` and `vercel.json` were pointing at the wrong service.
>
> **Definitive run — `bash docs/api/probe.sh http://127.0.0.1:8000/api`, all four controls `401`:**
>
> | Endpoint | Code | Verdict |
> |---|---|---|
> | `GET /test` | 200 | Laravel confirmed |
> | `PATCH /staff/complaints/1/open` | 404 | **missing** |
> | `PATCH /staff/complaints/1/resolve` | 404 | **missing** |
> | `PATCH /staff/complaints/1/close` | 404 | **missing** |
> | `POST /staff/complaints/1/notes` | 404 | **missing** |
> | `GET /admin/debug` | 404 | **missing** |
> | `GET /admin/settings` | 404 | **missing** |
> | `POST /admin/settings` | 404 | **missing** |
> | `POST /admin/broadcast-alert` | 404 | **missing** |
> | `GET /staff/complaints/metrics` | 401 | **missing — false positive.** 401 comes from `GET /staff/complaints/{id}` swallowing `"metrics"`, exactly the collision predicted in B10. `route:list` confirms no `metrics` route exists |
> | `DELETE /employees/999` | 405 | **missing.** 405 = the path exists under other verbs (GET/PUT/PATCH) but DELETE is not registered |
> | controls: `/admin/dashboard`, `/staff/me`, `/employees`, `/staff/complaints/1/respond` | 401 ×4 | exist ✅ |
>
> This agrees with `artisan route:list` on every line. Q1–Q5 are settled twice over, by two
> independent methods.
>
> See [`local-backend.md`](./local-backend.md) for how the backend is run, and
> [`backend-issues.md`](./backend-issues.md) for the five defects this exercise uncovered.

---

## 1. Headline finding: `api.onwayride.me` is not the SyRide backend

The dashboard sends every request to `https://api.onwayride.me/api` — via the dev proxy in
[`vite.config.ts`](../../vite.config.ts) and the production rewrite in [`vercel.json`](../../vercel.json).

That host is up and answering, but **it is not running the Laravel application.** It is a Node/Express
service that 404s every path, including `/`.

```console
$ curl -i https://api.onwayride.me/api/test
HTTP/1.1 404 Not Found
Server: nginx/1.24.0 (Ubuntu)
Content-Type: application/json; charset=utf-8
Content-Security-Policy: default-src 'self';base-uri 'self';font-src 'self' https: data:; ...
Cross-Origin-Opener-Policy: same-origin
X-DNS-Prefetch-Control: off
X-Download-Options: noopen
ETag: W/"4f-I8aE5ybFax9BP9wrqjLGGJqcGQk"

{"success":false,"error":{"code":"NOT_FOUND","message":"Cannot GET /api/test"}}
```

Three independent tells:

1. **The error envelope is not Laravel's.** Laravel returns `{"message": "..."}`; this returns
   `{"success":false,"error":{"code":"NOT_FOUND","message":"Cannot GET /api/test"}}` — the
   `Cannot <VERB> <path>` phrasing is Express's default 404 text.
2. **The security headers are Helmet's** (`X-DNS-Prefetch-Control`, `X-Download-Options`,
   `Origin-Agent-Cluster`, `Cross-Origin-Opener-Policy`) with a weak `W/"4f-…"` ETag — the Express +
   Helmet signature. Laravel/Octane sets none of these by default.
3. **`GET /` also 404s.** A deployed Laravel app serves *something* at the root.

Resolved IP: `37.60.232.67`.

## 2. The control group proves the probe cannot be interpreted against this host

`docs/api/probe.sh` deliberately includes four routes that **certainly exist** in the backend source
(`routes/api.php` at `3eb54ad`). If the host were the Laravel app, they would return `401
TOKEN_MISSING`. All four returned `404`:

```
── CONTROL: known-good routes (these MUST come back 401, never 404) ───────
GET    /admin/dashboard                               404  MISSING
GET    /staff/me                                      404  MISSING
GET    /employees                                     404  MISSING
PATCH  /staff/complaints/1/respond                    404  MISSING
```

Because the controls fail, the disputed-endpoint results below carry **no information** — every path
404s regardless of whether it exists in the real backend. Do not read them as answers.

```
── DISPUTED: in the Postman collection, absent from routes/api.php ────────
PATCH  /staff/complaints/1/open                       404   (uninterpretable)
PATCH  /staff/complaints/1/resolve                    404   (uninterpretable)
PATCH  /staff/complaints/1/close                      404   (uninterpretable)
POST   /staff/complaints/1/notes                      404   (uninterpretable)
GET    /admin/debug                                   404   (uninterpretable)

── DISPUTED: called by the dashboard, absent from routes/api.php ──────────
GET    /admin/settings                                404   (uninterpretable)
POST   /admin/settings                                404   (uninterpretable)
POST   /admin/broadcast-alert                         404   (uninterpretable)
GET    /staff/complaints/metrics                      404   (uninterpretable)
DELETE /employees/999                                 404   (uninterpretable)
```

## 3. Where the real backend is supposed to run

No deployed Laravel host is referenced anywhere in either repo. Every Postman collection points at a
**local** backend, and the newest one matches the Docker stack the backend developer added in the
big update (`df9304c`):

| Source | `base_url` | Matches |
|---|---|---|
| `SyRide_—_Admin,_Staff_&_System_Admin_APIs` (newest, 60 requests) | `http://localhost:8080/api` | ✅ `docker-compose.yml` → `nginx` publishes `8080:80` in front of 3 Octane/RoadRunner app nodes |
| `Atareeqak/SyRide_All_APIs_merged.postman_collection.json` (older) | `http://localhost/4th_year_project/public/api` | old XAMPP-style layout |
| `Atareeqak/collection.json` (older) | `http://localhost/4th_year_project/public/api` | same |
| `Atareeqak/src/services/api.ts` fallback | `http://localhost/4th_year_project/public/api` | same (stale) |
| `Atareeqak/vite.config.ts` + `vercel.json` | `https://api.onwayride.me/api` | ❌ not the Laravel app |

**Conclusion:** the intended target is `docker compose up` in `4th_year_projects_refractored`,
serving on `http://localhost:8080/api`.

## 4. Follow-up: the route table was obtained without a running server ✅

Initially none of `php`, `composer`/`vendor/`, or `docker` was installed here, so the first pass fell
back to statically parsing `routes/api.php`. That was then fixed properly:

1. `winget install PHP.PHP.8.2` (matching the Dockerfile's `php:8.2-cli`)
2. a minimal `php.ini` enabling `mbstring, openssl, curl, fileinfo, zip, pdo_mysql, gd, intl, sodium`
3. `composer install --ignore-platform-reqs --no-scripts` in the backend checkout
4. `php artisan route:list --json`

**`artisan` booted and printed the route table — no database or web server required.** The result is
now [`route-list.json`](./route-list.json), and it settles **Q1–Q5 on fact**:

| Disputed endpoint | Verdict |
|---|---|
| `GET/POST /admin/settings` | **does not exist** — no route matching `settings` at all |
| `POST /admin/broadcast-alert` | **does not exist** |
| `GET /staff/complaints/metrics` | **does not exist**, and `GET api/staff/complaints/{id}` would swallow it |
| `DELETE /employees/{id}` | **does not exist** — `/employees` has exactly 6 routes |
| `PATCH /staff/complaints/{id}/open`, `/resolve`, `/close`, `POST .../notes` | **none exist** — only `/respond` and `/escalate` |
| `GET /admin/debug` | **does not exist** |

The Postman collection is therefore ahead of `origin/main` on complaint handling. `route-list.json`
is the contract; the collection is a request-body reference only.

This also validated the static parse: the two agreed on **all 143 routes declared in
`routes/api.php`**, with zero false positives. The only two the parser missed
(`api/documentation`, `api/oauth2-callback`) come from `l5-swagger` — the documented limitation.

## 5. Next actions to finish Phase 0

Ordered by cost. Any one of them unblocks the rest of the plan.

- [x] ~~Ask the backend developer for `php artisan route:list --json`~~ — **done locally**, see §4.
- [ ] **Install Docker Desktop**, then in `4th_year_projects_refractored`:
      ```console
      docker compose up -d          # nginx :8080 → 3× Octane, mysql, redis, phpmyadmin :8081
      docker compose exec app1 php artisan migrate --seed
      docker compose exec app1 php artisan route:list --json > route-list.json
      ```
      Then run the probe against it:
      ```console
      bash docs/api/probe.sh http://localhost:8080/api
      ```
      Expect the four control routes to return **401**. If they do, every other line in the output is
      a real answer.
- [ ] **Ask where (if anywhere) the API is deployed.** If a staging host exists, point `vite.config.ts`
      and `vercel.json` at it. If none exists, those two files are currently pointing the whole
      dashboard at a dead host and must be fixed before anything can be demoed.

## 6. New question for the backend developer (add to Appendix B)

> **Q10.** `vite.config.ts` and `vercel.json` both proxy to `https://api.onwayride.me/api`. That host
> is live but is running an Express service that 404s everything, including routes we know exist
> (`/admin/dashboard`, `/staff/me`). Was the API moved, retired, or never deployed there? What host
> should the dashboard target for staging and for production?
