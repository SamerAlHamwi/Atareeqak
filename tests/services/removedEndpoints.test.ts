import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENDPOINTS } from '../../src/services/endpoints';
import { staffApi } from '../../src/features/staff/api/staffApi';

/**
 * Every route confirmed absent from the backend and deliberately dropped from
 * the dashboard, per docs/api/decisions.md sections C/D. `tests/testServer.ts`
 * deliberately ships no baseline msw handlers (Phase 7's reasoning, kept) —
 * this is the "so a regression that re-introduces one of these fails loudly"
 * check the plan asks for, done as an explicit assertion instead.
 */
const REMOVED_ROUTE_LITERALS = [
  '/admin/settings',
  '/admin/broadcast-alert',
  '/staff/complaints/metrics',
  '/admin/verifications',
];

const SRC_DIR = join(__dirname, '../../src');

/** `ENDPOINTS` is a nested object of path strings and `(id) => path` builders. */
const flattenEndpointValues = (node: unknown, out: string[] = []): string[] => {
  if (typeof node === 'string') {
    out.push(node);
  } else if (typeof node === 'function') {
    out.push((node as (id: string) => string)('__id__'));
  } else if (node && typeof node === 'object') {
    Object.values(node).forEach((child) => flattenEndpointValues(child, out));
  }
  return out;
};

const listSourceFiles = (dir: string, out: string[] = []): string[] => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
};

describe('removed routes never come back', () => {
  it('ENDPOINTS resolves to no removed route', () => {
    const values = flattenEndpointValues(ENDPOINTS);
    for (const removed of REMOVED_ROUTE_LITERALS) {
      const hit = values.find((v) => v === removed || v.startsWith(`${removed}/`) || v.startsWith(`${removed}?`));
      expect(hit, `ENDPOINTS should not resolve to ${removed}`).toBeUndefined();
    }
  });

  it('no module under src/ references a removed route literal outside its explanatory comment', () => {
    const offenders: string[] = [];
    for (const file of listSourceFiles(SRC_DIR)) {
      // endpoints.ts is the one deliberate exception — it names every removed
      // route inside a comment, by design, explaining why it's gone.
      if (file.endsWith('services/endpoints.ts')) {
        continue;
      }
      const content = readFileSync(file, 'utf8');
      for (const removed of REMOVED_ROUTE_LITERALS) {
        if (
          content.includes(`'${removed}`) ||
          content.includes(`"${removed}`) ||
          content.includes(`\`${removed}`)
        ) {
          offenders.push(`${file.replace(SRC_DIR, 'src')} references ${removed}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('staffApi has no deleteEmployee — DELETE /employees/{id} is a confirmed 405 (BUG-4)', () => {
    expect((staffApi as Record<string, unknown>).deleteEmployee).toBeUndefined();
  });

  it('roles.ts has no settings section left over from the deleted feature', () => {
    const rolesSource = readFileSync(join(SRC_DIR, 'app/roles.ts'), 'utf8');
    expect(rolesSource).not.toMatch(/\bsettings\b/i);
  });
});
