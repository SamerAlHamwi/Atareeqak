"""Convert `php artisan route:list --json` output into docs/api/route-list.json."""
import json
import io
import sys

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

SRC, OUT = sys.argv[1], sys.argv[2]

STAFF = 'App\\Http\\Middleware\\StaffJwtMiddleware'
JWT = 'App\\Http\\Middleware\\JwtAuthMiddleware'

raw = open(SRC, encoding='utf-8').read()
official = json.loads(raw[raw.index('['):])


def short(m):
    """Map the FQCN artisan prints back to the kernel alias used in routes/api.php."""
    if m.startswith(JWT):
        return 'jwt'
    if m.startswith(STAFF):
        args = m[len(STAFF):].lstrip(':')
        return 'staff:' + args if args else 'staff'
    if m.startswith('L5Swagger'):
        return 'l5-swagger'
    return m


def reachable(aliases):
    """Can a system_admin staff token call this route?"""
    for a in aliases:
        if a == 'jwt':
            return False  # end-user token, never a staff token
        if a.startswith('staff:'):
            roles = [r.strip() for r in a.split(':', 1)[1].split(',')]
            if 'system_admin' not in roles:
                return False
    return True


api = []
for r in official:
    if not r['uri'].startswith('api/'):
        continue
    aliases = [short(m) for m in r['middleware'] if m != 'api']
    api.append({
        'method': r['method'],
        'uri': r['uri'],
        'name': r.get('name'),
        'middleware': aliases,
        'middleware_raw': [m for m in r['middleware'] if m != 'api'],
        'action': r['action'],
        'auth': 'public' if not aliases else ' + '.join(aliases),
        'system_admin_can_call': reachable(aliases),
    })

api.sort(key=lambda r: (r['uri'], r['method']))

payload = {
    'generated_by': 'php artisan route:list --json  (AUTHORITATIVE - Laravel itself)',
    'source_repo': '4th_year_projects_refractored',
    'source_commit': '3eb54ad',
    'generated_at': '2026-08-10',
    'notes': [
        'Only api/* routes are kept; the "api" middleware alias is stripped from every entry.',
        'artisan prints middleware as fully-qualified class names. The "middleware" field holds '
        'the kernel aliases used in routes/api.php; "middleware_raw" keeps what artisan printed.',
        'GET rows are reported as GET|HEAD because Laravel registers HEAD implicitly.',
        'api/documentation and api/oauth2-callback come from the l5-swagger package, not routes/api.php.',
    ],
    'route_count': len(api),
    'routes': api,
}

with open(OUT, 'w', encoding='utf-8') as fh:
    json.dump(payload, fh, indent=2, ensure_ascii=False)
    fh.write('\n')

staff_guarded = [r for r in api if r['system_admin_can_call'] and r['middleware'] and 'l5-swagger' not in r['middleware']]
print('api routes:', len(api))
print('  public:', len([r for r in api if not r['middleware']]))
print('  end-user jwt:', len([r for r in api if 'jwt' in r['middleware']]))
print('  l5-swagger:', len([r for r in api if 'l5-swagger' in r['middleware']]))
print('  staff-guarded & system_admin-callable:', len(staff_guarded))
