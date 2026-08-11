/**
 * Phase 2 acceptance check — drives the real Dashboard page in Chromium against
 * a running backend and asserts the rendered UI matches the live API payload,
 * in both languages.
 *
 *   node docs/api/verify-dashboard.mjs
 *
 * Requires: backend on :8000, `npm run dev` on :5173, and
 * `npx playwright install chromium`. Writes dashboard-{en,ar}.png for eyeballing.
 */
import { chromium } from '@playwright/test';

const APP = 'http://localhost:5173';
const API = 'http://127.0.0.1:8000/api';

const login = async () => {
  const res = await fetch(`${API}/staff/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'system_admin', password: 'admin' }),
  });
  return res.json();
};

const run = async () => {
  const session = await login();
  const token = session.tokens.access_token;
  const dash = await (await fetch(`${API}/admin/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })).json();
  const api = dash.data;

  const browser = await chromium.launch();
  const results = [];
  const record = (name, ok, detail = '') => results.push({ name, ok, detail });

  for (const lang of ['en', 'ar']) {
    const context = await browser.newContext({ viewport: { width: 1600, height: 1200 } });
    const page = await context.newPage();

    const consoleErrors = [];
    page.on('console', (m) => m.type() === 'error' && consoleErrors.push(m.text()));
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`));

    await page.addInitScript((l) => {
      localStorage.setItem('access_token', l.token);
      localStorage.setItem('refresh_token', l.refresh);
      localStorage.setItem('auth_kind', 'staff');
      localStorage.setItem('user', JSON.stringify(l.user));
      localStorage.setItem('i18nextLng', l.lang);
    }, {
      token,
      refresh: session.tokens.refresh_token,
      lang,
      user: {
        id: session.employee.id,
        name: session.employee.full_name,
        email: session.employee.email,
        username: session.employee.username,
        role: session.employee.role,
        roleLabel: session.employee.role_label,
      },
    });

    await page.goto(`${APP}/dashboard`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(1500);

    const body = await page.locator('body').innerText();

    // ---- stats come from the live payload -----------------------------------
    record(`[${lang}] total_users ${api.stats.total_users} rendered`,
      body.includes(String(api.stats.total_users)));
    record(`[${lang}] active_trips ${api.stats.active_trips} rendered`,
      body.includes(String(api.stats.active_trips)));
    record(`[${lang}] revenue "${api.stats.total_revenue.formatted}" rendered`,
      body.includes(api.stats.total_revenue.formatted));

    // ---- no untranslated keys leaked ---------------------------------------
    const rawKeys = body.match(/dashboard\.[a-z_.]+/g) || [];
    record(`[${lang}] no raw i18n keys`, rawKeys.length === 0, rawKeys.slice(0, 5).join(', '));

    // ---- city names use the right language ---------------------------------
    if (api.city_distribution.length) {
      const city = api.city_distribution[0];
      const expected = lang === 'ar' ? city.city : city.city_en;
      const wrong = lang === 'ar' ? city.city_en : city.city;
      record(`[${lang}] city shows "${expected}"`, body.includes(expected));
      if (expected !== wrong) {
        record(`[${lang}] city does NOT show "${wrong}"`, !body.includes(wrong));
      }
    }

    // ---- month labels are localised ----------------------------------------
    const monthLabels = await page.locator('.h-80 span.text-xs').allInnerTexts();
    const englishMonths = monthLabels.filter((m) => /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)$/.test(m.trim()));
    record(`[${lang}] chart month labels localised`,
      lang === 'en' ? englishMonths.length > 0 : englishMonths.length === 0,
      monthLabels.join(' '));

    // ---- growth chart bars are scaled, not slivers -------------------------
    const bars = await page.locator('[title*="—"]').evaluateAll((els) =>
      els.map((e) => ({ title: e.getAttribute('title'), height: e.style.height }))
    );
    const tallest = bars.filter((b) => b.height && b.height !== '0%');
    record(`[${lang}] chart bars rendered (${bars.length}) with a 100% peak`,
      tallest.some((b) => b.height === '100%'), tallest.map((b) => b.height).join(' '));

    // ---- recent activity table ---------------------------------------------
    if (api.recent_activities.length) {
      const first = api.recent_activities[0];
      record(`[${lang}] activity user "${first.user.name}" rendered`, body.includes(first.user.name));
      record(`[${lang}] activity value "${first.value}" rendered`, body.includes(first.value));
      record(`[${lang}] masked phone rendered`, body.includes(first.user.number));
      // statuses must be translated, never the raw enum
      record(`[${lang}] status "${first.status}" is translated`, !body.includes(`"${first.status}"`));
    }

    // ---- period selector actually refetches --------------------------------
    const growthCalls = [];
    page.on('request', (r) => {
      if (r.url().includes('/dashboard/growth')) growthCalls.push(r.url());
    });
    const monthsLabel = lang === 'ar' ? '12 أشهر' : '12 months';
    await page.getByRole('button', { name: monthsLabel }).click();
    await page.waitForTimeout(1200);
    record(`[${lang}] period selector calls /dashboard/growth?months=12`,
      growthCalls.some((u) => u.includes('months=12')), growthCalls.join(' '));
    // Poll instead of trusting a fixed delay — the skeleton renders no bars,
    // so counting too early reports 0.
    let barsAfter = 0;
    for (let attempt = 0; attempt < 25; attempt++) {
      barsAfter = await page.locator('[title*="—"]').count();
      if (barsAfter > bars.length) break;
      await page.waitForTimeout(200);
    }
    record(`[${lang}] 12-month window renders more bars (${barsAfter})`, barsAfter > bars.length);

    // ---- refresh button re-hits the BFF ------------------------------------
    const dashCalls = [];
    page.on('request', (r) => {
      if (r.url().endsWith('/api/admin/dashboard')) dashCalls.push(r.url());
    });
    const refreshLabel = lang === 'ar' ? 'تحديث' : 'Refresh';
    await page.getByRole('button', { name: refreshLabel }).click();
    await page.waitForTimeout(1200);
    record(`[${lang}] refresh re-calls GET /admin/dashboard`, dashCalls.length >= 1);

    record(`[${lang}] no console errors`, consoleErrors.length === 0, consoleErrors.slice(0, 3).join(' | '));

    await page.screenshot({ path: `dashboard-${lang}.png`, fullPage: true });
    await context.close();
  }

  await browser.close();

  let failed = 0;
  for (const r of results) {
    if (!r.ok) failed++;
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.detail && !r.ok ? `   [${r.detail}]` : ''}`);
  }
  console.log(`\n${results.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
};

run().catch((e) => { console.error(e); process.exit(1); });
