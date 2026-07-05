import { beforeAll, afterEach, afterAll } from 'vitest';
import i18n from '../src/app/i18n';
import { server } from './testServer';

beforeAll(async () => {
  server.listen({ onUnhandledRequest: 'error' });
  // Deterministic language for label assertions regardless of host machine
  await i18n.changeLanguage('en');
});

afterEach(() => {
  server.resetHandlers();
  localStorage.clear();
});

afterAll(() => server.close());
