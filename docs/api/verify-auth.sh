#!/usr/bin/env bash
# Phase 1 acceptance check against a REAL backend.
#
#   bash docs/api/verify-auth.sh [base_url]
#
# Verifies the assumptions Phase 1 was built on. Every one of these was derived
# from reading the backend source; this proves them against the running app.
#
#   1. /staff/login returns the employee with its role
#   2. /admin/login works for system_admin and issues a staff-compatible token
#   3. that token is accepted by /staff/me  → the two token kinds are interchangeable
#   4. /staff/me is the authoritative role source
#   5. sycash can log in via /admin/login but is 403'd by /admin/* (decisions.md Q8)
#   6. a bad token yields 401 with a typed `code`
#   7. /admin/refresh and /staff/refresh both accept a token from either login

set -u
BASE="${1:-http://localhost:8080/api}"

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
section() { printf '\n\033[1m%s\033[0m\n' "$1"; }

post() { curl -s -X POST -H 'Content-Type: application/json' -d "$2" "$BASE$1"; }
getc() { curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $2" "$BASE$1"; }
getb() { curl -s -H "Authorization: Bearer $2" "$BASE$1"; }

jget() { # jget <json> <python-expression on `d`>
  python -c "import json,sys
try:
    d=json.loads(sys.stdin.read())
    print($2)
except Exception:
    print('')" <<<"$1" 2>/dev/null
}

section "0. backend reachable at $BASE"
code=$(curl -s -o /dev/null -w '%{http_code}' "$BASE/test")
[ "$code" = "200" ] && ok "GET /test → 200" || { bad "GET /test → $code (is the backend running?)"; exit 1; }

section "1. /staff/login returns the employee with its role"
SL=$(post /staff/login '{"identifier":"system_admin","password":"admin"}')
SROLE=$(jget "$SL" "d['employee']['role']")
STOKEN=$(jget "$SL" "d['tokens']['access_token']")
[ "$SROLE" = "system_admin" ] && ok "role = system_admin" || bad "role = '$SROLE' (expected system_admin)"
[ -n "$STOKEN" ] && ok "access_token issued" || bad "no access_token"

section "2. /admin/login accepts the same account"
AL=$(post /admin/login '{"email":"primary@admin.com","password":"admin"}')
ATOKEN=$(jget "$AL" "d['tokens']['access_token']")
AROLE=$(jget "$AL" "d.get('admin',{}).get('role','<absent>')")
[ -n "$ATOKEN" ] && ok "access_token issued" || bad "no access_token"
# authApi reads this directly; /staff/me is only a fallback. What must never
# happen is the client substituting a constant, as the pre-Phase-1 code did.
[ "$AROLE" = "system_admin" ] \
  && ok "admin payload carries the real role ($AROLE) — authApi uses it, no extra round-trip" \
  || bad "admin payload role = '$AROLE' (expected system_admin)"

section "3. the /admin/login token is accepted by /staff/me (tokens are interchangeable)"
[ "$(getc /staff/me "$ATOKEN")" = "200" ] \
  && ok "/staff/me with an /admin/login token → 200" \
  || bad "/staff/me rejected the /admin/login token"

section "4. /staff/me is the authoritative role source"
ME=$(getb /staff/me "$ATOKEN")
[ "$(jget "$ME" "d['employee']['role']")" = "system_admin" ] && ok "role = system_admin" || bad "unexpected role"
[ -n "$(jget "$ME" "d['employee']['role_label']")" ] && ok "role_label present" || bad "role_label missing"

section "5. system_admin reaches every guarded area"
for path in /admin/dashboard /admin/trips /admin/users /admin/reports /employees /staff/verifications/pending; do
  c=$(getc "$path" "$STOKEN")
  [ "$c" = "200" ] && ok "GET $path → 200" || bad "GET $path → $c"
done

section "6. sycash is admitted by /admin/login but 403'd by /admin/* (Q8)"
CL=$(post /admin/login '{"email":"sycash@admin.com","password":"sycash123"}')
CTOKEN=$(jget "$CL" "d['tokens']['access_token']")
if [ -n "$CTOKEN" ]; then
  ok "sycash can log in via /admin/login"
  c=$(getc /admin/dashboard "$CTOKEN")
  [ "$c" = "403" ] \
    && ok "GET /admin/dashboard → 403 — roles.ts is right to withhold the dashboard" \
    || bad "GET /admin/dashboard → $c (expected 403; if 200, revisit src/app/roles.ts)"
  c=$(getc /staff/reviews "$CTOKEN")
  [ "$c" = "200" ] && ok "GET /staff/reviews → 200 (any-role section)" || bad "GET /staff/reviews → $c"
else
  bad "sycash login failed — check SYCASH_* in the backend .env"
fi

section "7. a rejected token returns 401 with a typed code"
R=$(curl -s -H 'Authorization: Bearer not-a-real-token' "$BASE/admin/dashboard")
CODE=$(jget "$R" "d.get('code','')")
case "$CODE" in
  TOKEN_INVALID|TOKEN_MISSING|TOKEN_TYPE_INVALID)
    ok "code = $CODE — matches AUTH_ERROR_CODES in src/services/apiError.ts" ;;
  *) bad "unexpected code '$CODE'" ;;
esac

section "8. both refresh endpoints accept a token pair from either login"
# Refresh tokens ROTATE — each one is single-use, so every endpoint needs a
# freshly issued token. Reusing one across both endpoints fails the second.
for ep in /staff/refresh /admin/refresh; do
  FRESH=$(jget "$(post /staff/login '{"identifier":"system_admin","password":"admin"}')" \
               "d['tokens']['refresh_token']")
  T=$(post "$ep" "{\"refresh_token\":\"$FRESH\"}")
  [ -n "$(jget "$T" "d['tokens']['access_token']")" ] \
    && ok "$ep issued a new access_token from a /staff/login refresh token" \
    || bad "$ep did not return tokens"
done

section "9. refresh tokens are single-use (rotation)"
FRESH=$(jget "$(post /staff/login '{"identifier":"system_admin","password":"admin"}')" \
             "d['tokens']['refresh_token']")
post /staff/refresh "{\"refresh_token\":\"$FRESH\"}" >/dev/null
REPLAY=$(post /staff/refresh "{\"refresh_token\":\"$FRESH\"}")
[ "$(jget "$REPLAY" "d.get('code','')")" = "REFRESH_TOKEN_INVALID" ] \
  && ok "a consumed refresh token is rejected — the client must store the rotated one" \
  || bad "a consumed refresh token was accepted (expected REFRESH_TOKEN_INVALID)"

printf '\n\033[1m%d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" -eq 0 ]
