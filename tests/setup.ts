import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../src/app/i18n';
import { server } from './testServer';

/**
 * jsdom's `Blob` implements neither `stream()` nor `text()`.
 *
 * Any request made with `responseType: 'blob'` — the PDF export in
 * `reportsApi.exportReportToPdf` is the only one — makes msw's XHR interceptor
 * build a jsdom Blob and hand it to `new Response(blob)`, which calls
 * `blob.stream()` and throws `TypeError: object.stream is not a function`. That
 * surfaces as an *unhandled rejection* rather than a test failure, and it takes
 * down every other test in the same file with it.
 *
 * `text()` is polyfilled for the same reason: `normaliseBlobError` reads a
 * JSON error body back out of the Blob axios hands it on a 422.
 */
if (typeof Blob !== 'undefined') {
  if (typeof Blob.prototype.stream !== 'function') {
    Blob.prototype.stream = function stream(this: Blob): ReadableStream<Uint8Array> {
      return new ReadableStream<Uint8Array>({
        start: async (controller) => {
          controller.enqueue(new Uint8Array(await this.arrayBuffer()));
          controller.close();
        },
      });
    };
  }
  if (typeof Blob.prototype.text !== 'function') {
    Blob.prototype.text = async function text(this: Blob): Promise<string> {
      return new TextDecoder().decode(await this.arrayBuffer());
    };
  }
}

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  // Deterministic language for label assertions regardless of host machine
  await i18n.changeLanguage('en');
});

afterEach(() => {
  // `globals` is off, so RTL's auto-cleanup never registers itself — without
  // this, rendered trees leak between tests and queries hit stale nodes.
  cleanup();
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
