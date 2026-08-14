# `docs/api` — the API contract of record

Produced by **Phase 0** of [`BACKEND_INTEGRATION_PLAN.md`](../../BACKEND_INTEGRATION_PLAN.md).
The dashboard, the Postman collections and the backend source disagreed with each other; these files
record what was actually verified, and what is still an open question.

| File | What it is | Trust |
|---|---|---|
| [`decisions.md`](./decisions.md) | **The tiebreaker.** One row per disputed endpoint: the decision, the evidence, the owner | authoritative — read this first |
| [`route-list.json`](./route-list.json) | Every `api/*` route, from **Laravel's own route table**: method, URI, name, middleware, controller action, and whether a `system_admin` can call it | **authoritative** |
| [`probe-results.md`](./probe-results.md) | What happened when the configured API host was probed | authoritative — and the answer is "there is no reachable backend" |
| [`local-backend.md`](./local-backend.md) | **How to run the backend locally** + the seeded `system_admin` / `sycash` credentials | — |
| [`probe.sh`](./probe.sh) | Re-runnable existence probe. Run it the moment a backend host exists | — |
| [`verify-auth.sh`](./verify-auth.sh) | Phase 1 acceptance check against a running backend — proves the auth assumptions the code was built on | — |
| [`verify-dashboard.mjs`](./verify-dashboard.mjs) | Phase 2 acceptance check — drives the real Dashboard in Chromium and asserts the rendered UI matches the live payload, in both languages | — |
| [`verify-trips.mjs`](./verify-trips.mjs) | Phase 3 acceptance check — Trips + Bookings: paging, filters, `counts` badges, live map, cancellation. `--mutate` cancels a real booking | 85 assertions |
| [`verify-drivers.mjs`](./verify-drivers.mjs) | Phase 4 acceptance check — Drivers + details: paging, `per_page`, search, filters, the efficiency period switch, and the ban banner. `--mutate` performs a real temporary ban **and unbans it again** | 94 read-only / 125 with `--mutate` |
| [`verify-users.mjs`](./verify-users.mjs) | Phase 5 acceptance check — Users + passenger details: all four filters (incl. `date`), paging, `per_page`, search, the five per-section refresh endpoints, and the wallet amount rules. `--mutate` performs a real temporary ban + unban **and a real wallet charge, which it reports as irreversible** | 137 read-only / 185 with `--mutate` |
| [`verify-verifications.mjs`](./verify-verifications.mjs) | Phase 6 acceptance check — Verifications: the server `total`, the required `national_id`, the real reject reason, optimistic removal + reconcile, and the document viewer. `--mutate` performs a real reject + approve, **neither of which is reversible through the API** | 51 read-only / 59 with documents seeded |
| [`verify-support.mjs`](./verify-support.mjs) | Phase 7 acceptance check — Support: `counts`-driven badges, the type + date filters, `per_page`, the escalated-tab guard, attachments, and the `show()` side effect. Read-only by default **by opening only non-pending complaints** — a claim it enforces by re-reading the counts at the end. `--mutate` performs a real respond, escalate and escalated-resolve | 105 read-only / 110 with `--mutate` |
| [`verify-reviews.mjs`](./verify-reviews.mjs) | Phase 8 acceptance check — Reviews: server-side search + date, `per_page`, the `?user_id=` deep link (incl. its 422), and the delete confirmation. `--mutate` deletes one real comment, **which cannot be restored through the API** — it prints the row and the `INSERT` to put it back | 64 read-only / 66 with `--mutate` |
| [`verify-reports.mjs`](./verify-reports.mjs) | Phase 9 acceptance check — Reports & Wallet: the seven KPI cards (range-filtered vs point-in-time, split by heading), ride stats, the admin wallet card, the wallets directory, the transactions drawer, `wallet_requests` `counts`-driven tabs, the type filter, `per_page`, the 1,000,000 charge cap, and the PDF export range. `--mutate` performs one real approve, one real reject and one real charge, **none of which is reversible through the API** | 155 read-only, re-run 2026-08-14 against a freshly seeded local backend |
| [`verify-staff.mjs`](./verify-staff.mjs) | Phase 10 acceptance check — Staff: proves all six `/employees` endpoints 500 (BUG-1) against a *non-restricted* employee (id 3) rather than the restricted seeded accounts, whose 403/422 guards would decoy the check; asserts the page ships a labelled unavailable state with every write control withheld, not an empty table. `--mutate` reaches the two write-then-500 probes (BUG-1/BUG-2) for real | 50 read-only, re-run 2026-08-14 against a freshly seeded local backend |
| [`seed-phase-7-8.sql`](./seed-phase-7-8.sql) | The deliberate temporary seed the two scripts above need — complaints, attachments and profile comments, all of which ship empty. Documents what each row exercises | apply before verifying 7/8 |
| [`revert-phase-7-8.sql`](./revert-phase-7-8.sql) | Undoes that seed exactly, including the notifications a `--mutate` run leaves in the `user_notifications` join table | run after |
| [`seed-phase-9.sql`](./seed-phase-9.sql) | The deliberate temporary seed `verify-reports.mjs` needs — `wallet_requests` ships empty otherwise. **Its hardcoded `user_id`/`wallet_id` pairs assume one specific seeding history**; re-verify the FK pairs (`SELECT w.id, w.user_id FROM wallets w JOIN users u ON u.id = w.user_id`) before reusing it on a different database | apply before verifying 9 |
| [`revert-phase-9.sql`](./revert-phase-9.sql) | Undoes that seed exactly | run after |
| [`backend-issues.md`](./backend-issues.md) | Defects and requests found while wiring the dashboard — **hand this to the backend developer** | — |
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
