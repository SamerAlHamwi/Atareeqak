# `docs/api` — the API contract of record

Produced by **Phase 0** of [`BACKEND_INTEGRATION_PLAN.md`](../../BACKEND_INTEGRATION_PLAN.md).
The dashboard, the Postman collections and the backend source disagreed with each other; these files
record what was actually verified, and what is still an open question.

| File | What it is | Trust |
|---|---|---|
| [`decisions.md`](./decisions.md) | **The tiebreaker.** One row per disputed endpoint: the decision, the evidence, the owner | authoritative — read this first |
| [`route-list.json`](./route-list.json) | Every `api/*` route, from **Laravel's own route table**: method, URI, name, middleware, controller action, and whether a `system_admin` can call it | **authoritative** |
| [`probe-results.md`](./probe-results.md) | What happened when the configured API host was probed | authoritative — and the answer is "there is no reachable backend" |
| [`probe.sh`](./probe.sh) | Re-runnable existence probe. Run it the moment a backend host exists | — |
| [`build-route-list.py`](./build-route-list.py) | Turns raw `artisan route:list --json` into the shape above | — |
| [`parse-routes.py`](./parse-routes.py) | Fallback generator that parses `routes/api.php` directly, for when PHP is unavailable | superseded, kept as a backstop |

## Provenance of `route-list.json`

It is real `php artisan route:list --json` output, produced by installing PHP 8.2 + Composer locally
and booting the app from the `3eb54ad` checkout — so it reflects what the framework actually
registers, including package-published routes.

**145 `api/*` routes:** 19 public · 58 end-user (`jwt`) · 66 staff-guarded and callable by a
`system_admin` · 2 from `l5-swagger`.

`artisan` prints middleware as fully-qualified class names. The `middleware` field maps them back to
the kernel aliases used in `routes/api.php` (`staff`, `staff:admin,system_admin`, `jwt`);
`middleware_raw` keeps what artisan printed.

### On the earlier static parse

Phase 0 first produced this file by parsing `routes/api.php` (PHP was not installed yet). Diffing the
two afterwards validated that approach: the static parse matched the authoritative list on **all 143
routes declared in `routes/api.php`**, with zero false positives. It missed exactly two —
`api/documentation` and `api/oauth2-callback` — which come from the `l5-swagger` package, precisely
the limitation the parser was documented as having. `parse-routes.py` is kept as a backstop for
machines without PHP.

## Refreshing these files

```console
# preferred: from the backend checkout (needs PHP + vendor/, or Docker)
php artisan route:list --json > /tmp/routes-raw.json
python docs/api/build-route-list.py /tmp/routes-raw.json docs/api/route-list.json

# with Docker instead
docker compose exec app1 php artisan route:list --json > /tmp/routes-raw.json

# fallback when no PHP is available — parses routes/api.php directly
python docs/api/parse-routes.py ../4th_year_projects_refractored/routes/api.php docs/api/route-list.json

# existence probe against a running backend
bash docs/api/probe.sh http://localhost:8080/api
```

The probe is only meaningful when its four **control** routes come back `401`. If they come back
`404`, you are not talking to the Laravel app and every other line is noise.
