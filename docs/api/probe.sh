#!/usr/bin/env bash
# Probe a SyRide backend host to find out which routes actually exist.
#
# Usage:
#   ./docs/api/probe.sh                             # defaults to http://localhost:8080/api
#   ./docs/api/probe.sh http://localhost:8080/api
#   BASE=... TOKEN=... ./docs/api/probe.sh
#
# How to read the results — no token needed for existence checks:
#   404  route does NOT exist
#   401  route EXISTS, rejected because no/!valid staff token   <- this is a PASS
#   405  path exists under a different HTTP verb
#   422  route exists and validation rejected the empty body    <- also a PASS
#   200  route exists and answered
#
# Laravel returns 404 for an unregistered URI, and StaffJwtMiddleware returns
# 401 {"code":"TOKEN_MISSING"} for a registered-but-guarded URI. That difference
# is enough to settle every open question without credentials.

set -u

BASE="${1:-${BASE:-http://localhost:8080/api}}"
TOKEN="${TOKEN:-}"

hdr=(-H "Accept: application/json")
[ -n "$TOKEN" ] && hdr+=(-H "Authorization: Bearer $TOKEN")

probe() {
  local method="$1" path="$2" note="${3:-}"
  local code
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 \
         -X "$method" "${hdr[@]}" \
         -H 'Content-Type: application/json' -d '{}' \
         "$BASE$path" 2>/dev/null)
  local verdict
  case "$code" in
    404) verdict="MISSING" ;;
    000) verdict="UNREACHABLE" ;;
    401|422|200|201|403) verdict="EXISTS" ;;
    405) verdict="EXISTS(other verb)" ;;
    *)   verdict="?" ;;
  esac
  printf '%-6s %-46s %-4s %-18s %s\n' "$method" "$path" "$code" "$verdict" "$note"
}

echo "BASE = $BASE"
[ -n "$TOKEN" ] && echo "TOKEN = (set)" || echo "TOKEN = (none — existence checks only)"
echo

echo "── sanity ─────────────────────────────────────────────────────────────────"
probe GET  /test                       "should be 200 — proves this is the Laravel app"

echo
echo "── DISPUTED: in the Postman collection, absent from routes/api.php ────────"
probe PATCH /staff/complaints/1/open    "Q5"
probe PATCH /staff/complaints/1/resolve "Q5"
probe PATCH /staff/complaints/1/close   "Q5"
probe POST  /staff/complaints/1/notes   "Q5"
probe GET   /admin/debug                "Q5 (debug route)"

echo
echo "── DISPUTED: called by the dashboard, absent from routes/api.php ──────────"
probe GET    /admin/settings            "Q1 — backs the whole Settings page"
probe POST   /admin/settings            "Q1"
probe POST   /admin/broadcast-alert     "Q2 — Staff broadcast modal"
probe GET    /staff/complaints/metrics  "Q3 — 401 here is a FALSE POSITIVE: it matches /staff/complaints/{id}"
probe DELETE /employees/999             "Q4 — 405 means the path exists but DELETE is not registered = MISSING"

echo
echo "── CONTROL: known-good routes (these MUST come back 401, never 404) ───────"
probe GET   /admin/dashboard            "control"
probe GET   /staff/me                   "control"
probe GET   /employees                  "control"
probe PATCH /staff/complaints/1/respond "control"

echo
echo "Record the output in docs/api/probe-results.md and update docs/api/decisions.md."
