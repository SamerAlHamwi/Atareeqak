import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

/** Matches VITE_API_BASE_URL pinned for tests in vitest.config.ts. */
export const API_BASE = 'http://localhost/test-api';

/**
 * Shared MSW server; individual tests register handlers via `server.use()`.
 * Baseline handlers cover secondary fetches (e.g. support metrics) that
 * hooks fire alongside the request under test.
 */
export const server = setupServer(
  http.get(`${API_BASE}/staff/complaints/metrics`, () =>
    HttpResponse.json({
      status: 'success',
      data: {
        avg_response_time_minutes: null,
        tickets_total: 0,
        tickets_resolved: 0,
        tickets_open: 0,
        tickets_escalated: 0,
        resolution_rate_pct: 0,
      },
    })
  )
);
