import { setupServer } from 'msw/node';

/** Matches VITE_API_BASE_URL pinned for tests in vitest.config.ts. */
export const API_BASE = 'http://localhost/test-api';

/**
 * Shared MSW server; individual tests register handlers via `server.use()`.
 *
 * There are deliberately NO baseline handlers. The only one that ever existed
 * stubbed `GET /staff/complaints/metrics` as a success, and Phase 7 removed both
 * it and the code that called it: that route does not exist, and because
 * `"metrics"` is captured by `GET /staff/complaints/{id}` it returns a 500 with a
 * stack trace rather than a 404 (BUG-8). Keeping a success stub for it would let
 * a regression re-introduce the call and still pass the suite — the exact failure
 * mode Phase 14 asks these handlers to make loud.
 */
export const server = setupServer();
