"""Static parser for Laravel routes/api.php -> artisan-route-list-shaped JSON.

No PHP available on this machine, so we reconstruct method/uri/middleware/action
by walking the file and tracking prefix + middleware group context on a stack.
"""
import json
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SRC = sys.argv[1]
OUT = sys.argv[2]

VERBS = ('get', 'post', 'put', 'patch', 'delete', 'options', 'any')

# Route::get('/x', [Ctrl::class, 'method'])  |  Route::post('/x', Ctrl::class)
RE_ROUTE = re.compile(
    r"Route::(" + "|".join(VERBS) + r")\(\s*'([^']*)'\s*,\s*(.*)$"
)
RE_ACTION_PAIR = re.compile(r"\[\s*([A-Za-z_][\w]*)::class\s*,\s*'([^']+)'\s*\]")
RE_ACTION_SINGLE = re.compile(r"^([A-Za-z_][\w]*)::class")

RE_PREFIX = re.compile(r"Route::prefix\('([^']*)'\)")
RE_MW = re.compile(r"Route::middleware\('([^']*)'\)")
RE_CHAIN_MW = re.compile(r"->middleware\('([^']*)'\)")
RE_GROUP = re.compile(r"->group\(")

# use App\Http\Controllers\...\FooController;  -> short name to FQCN
RE_USE = re.compile(r"^use\s+(App\\[^;]+);")


def join_uri(parts):
    out = []
    for p in parts:
        p = p.strip('/')
        if p:
            out.append(p)
    return 'api/' + '/'.join(out) if out else 'api'


def main():
    with open(SRC, encoding='utf-8') as fh:
        lines = fh.readlines()

    imports = {}
    for ln in lines:
        m = RE_USE.match(ln.strip())
        if m:
            fq = m.group(1)
            imports[fq.split('\\')[-1]] = fq

    routes = []
    # stack entries: {'depth': int, 'prefix': str|None, 'mw': [str]}
    stack = []
    depth = 0
    pending = None  # group context declared on this line, applied at the '{'

    for raw in lines:
        line = raw.rstrip('\n')
        stripped = line.strip()

        if stripped.startswith('//') or stripped.startswith('*') or stripped.startswith('/*'):
            depth += line.count('{') - line.count('}')
            continue

        # --- group declaration -------------------------------------------------
        if RE_GROUP.search(line) and 'Route::' in line:
            prefix = None
            mws = []
            m = RE_PREFIX.search(line)
            if m:
                prefix = m.group(1)
            m = RE_MW.search(line)
            if m:
                mws.append(m.group(1))
            for m in RE_CHAIN_MW.finditer(line):
                if m.group(1) not in mws:
                    mws.append(m.group(1))
            pending = {'prefix': prefix, 'mw': mws}

        # --- route definition --------------------------------------------------
        m = RE_ROUTE.search(line)
        if m:
            verb, uri, rest = m.group(1), m.group(2), m.group(3)
            action = 'Closure'
            pm = RE_ACTION_PAIR.search(rest)
            if pm:
                short, method = pm.group(1), pm.group(2)
                action = f"{imports.get(short, short)}@{method}"
            else:
                sm = RE_ACTION_SINGLE.search(rest.strip())
                if sm:
                    short = sm.group(1)
                    action = f"{imports.get(short, short)}@__invoke"

            prefixes = [e['prefix'] for e in stack if e['prefix']]
            mw = []
            for e in stack:
                for x in e['mw']:
                    if x not in mw:
                        mw.append(x)

            routes.append({
                'method': verb.upper(),
                'uri': join_uri(prefixes + [uri]),
                'middleware': mw,
                'action': action,
            })

        # --- brace bookkeeping --------------------------------------------------
        opens = line.count('{')
        closes = line.count('}')

        if opens:
            for i in range(opens):
                if pending is not None and i == 0:
                    stack.append({'depth': depth, **pending})
                    pending = None
                depth += 1
        if closes:
            for _ in range(closes):
                depth -= 1
                if stack and stack[-1]['depth'] == depth:
                    stack.pop()

    # role reachability for a system_admin staff token
    def reachable(mw):
        for m in mw:
            if m == 'jwt':
                return False  # end-user token, not a staff token
            if m.startswith('staff:'):
                roles = [r.strip() for r in m.split(':', 1)[1].split(',')]
                if 'system_admin' not in roles:
                    return False
        return True

    for r in routes:
        r['auth'] = (
            'public' if not r['middleware']
            else 'end-user jwt' if 'jwt' in r['middleware']
            else ' + '.join(r['middleware'])
        )
        r['system_admin_can_call'] = reachable(r['middleware'])

    payload = {
        'generated_by': 'static parse of routes/api.php (php/artisan unavailable on this machine)',
        'source_repo': '4th_year_projects_refractored',
        'source_commit': '3eb54ad',
        'route_count': len(routes),
        'routes': routes,
    }

    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(payload, fh, indent=2, ensure_ascii=False)
        fh.write('\n')

    print(f'{len(routes)} routes -> {OUT}')
    for r in routes:
        flag = ' ' if r['system_admin_can_call'] else 'x'
        print(f"{flag} {r['method']:<7} {r['uri']:<52} [{r['auth']}]")


main()
