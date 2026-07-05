import { defineConfig, devices } from '@playwright/test';

/**
 * Smoke tests run against the local Vite dev server with all API calls
 * stubbed in the browser (see e2e/apiStubs.ts), so no backend is required.
 * Point PLAYWRIGHT_BASE_URL at a staging deployment to run against real infra.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5183',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5183 --strictPort',
    url: 'http://localhost:5183',
    reuseExistingServer: !process.env.CI,
    env: {
      // Same-origin path so page.route() can intercept every API call
      VITE_API_BASE_URL: '/e2e-api',
    },
  },
});
