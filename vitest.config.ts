import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    // Pin the API base so handlers in tests/testServer.ts match regardless of
    // whatever .env the developer has locally.
    env: {
      VITE_API_BASE_URL: 'http://localhost/test-api',
    },
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // MSW + axios (XHR adapter) need a little headroom on slow CI runners
    testTimeout: 15000,
  },
});
