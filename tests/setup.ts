import { beforeAll, afterEach, afterAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import i18n from '../src/app/i18n';
import { server } from './testServer';

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
