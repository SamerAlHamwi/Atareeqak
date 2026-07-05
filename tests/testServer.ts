import { setupServer } from 'msw/node';

/** Matches VITE_API_BASE_URL pinned for tests in vitest.config.ts. */
export const API_BASE = 'http://localhost/test-api';

/** Shared MSW server; individual tests register handlers via `server.use()`. */
export const server = setupServer();
