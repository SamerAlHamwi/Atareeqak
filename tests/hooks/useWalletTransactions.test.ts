import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useWalletTransactions } from '../../src/features/reports/hooks/useWalletTransactions';
import { API_BASE, server } from '../testServer';

const transaction = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  wallet_id: 1,
  user_id: null,
  type: 'cash_ride_creation_fee_received',
  // ⚠️ Decimal STRINGS in the real payload, not numbers.
  amount: '9250.00',
  previous_balance: '126350.00',
  new_balance: '135600.00',
  description: 'Cash ride creation fee received from driver #10 — ride #67',
  transaction_id: 'PRIMARY_CASH_FEE_1786430034_klgxcT',
  status: 'completed',
  reference: 'ride:67',
  created_at: '2026-08-11T06:33:54.000000Z',
  updated_at: '2026-08-11T06:33:54.000000Z',
  ...overrides,
});

/**
 * The real envelope: a RAW Laravel paginator under `transactions`, with the
 * page numbers at its top level and **no `meta`** anywhere.
 */
const paginatorResponse = (overrides: Record<string, unknown> = {}) => ({
  status: 'success',
  wallet: {
    id: 1,
    name: 'Primary Escrow',
    user_id: null,
    wallet_number: '0482535926103152',
    // RAW here — no separators, no "SYP" — unlike /admin/wallets.
    balance: '135600.00',
    cash_ride_debt: '0.00',
    phone_number: '0912345678',
    created_at: '2026-08-11T06:33:21.000000Z',
    updated_at: '2026-08-11T06:33:54.000000Z',
  },
  transactions: {
    current_page: 1,
    data: [transaction(178), transaction(176, { amount: '-8700.00' })],
    first_page_url: 'http://localhost/api/admin/wallet/1/transactions?page=1',
    from: 1,
    last_page: 4,
    last_page_url: 'http://localhost/api/admin/wallet/1/transactions?page=4',
    links: [],
    next_page_url: 'http://localhost/api/admin/wallet/1/transactions?page=2',
    path: 'http://localhost/api/admin/wallet/1/transactions',
    per_page: 10,
    prev_page_url: null,
    to: 10,
    total: 31,
    ...overrides,
  },
});

describe('useWalletTransactions', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('reads page numbers off the raw paginator, which has no meta block', async () => {
    server.use(
      http.get(`${API_BASE}/admin/wallet/1/transactions`, () =>
        HttpResponse.json(paginatorResponse())
      )
    );

    const { result } = renderHook(() => useWalletTransactions(1));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    expect(result.current.lastPage).toBe(4);
    expect(result.current.total).toBe(31);
    expect(result.current.wallet?.wallet_number).toBe('0482535926103152');
  });

  it('coerces the decimal-string amounts into numbers, keeping the sign', async () => {
    server.use(
      http.get(`${API_BASE}/admin/wallet/1/transactions`, () =>
        HttpResponse.json(paginatorResponse())
      )
    );

    const { result } = renderHook(() => useWalletTransactions(1));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    expect(result.current.transactions[0].amount).toBe(9250);
    expect(result.current.transactions[0].previousBalance).toBe(126350);
    expect(result.current.transactions[0].newBalance).toBe(135600);
    // Outflows arrive negative and must stay negative for the row styling.
    expect(result.current.transactions[1].amount).toBe(-8700);
  });

  it('sends `page` but never `per_page`, which the backend ignores', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/wallet/1/transactions`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(paginatorResponse());
      })
    );

    const { result } = renderHook(() => useWalletTransactions(1));
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));
    expect(urls[0].searchParams.get('page')).toBe('1');

    act(() => result.current.setPage(2));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));

    // Shipping a per_page control here would be a widget that does nothing.
    for (const url of urls) {
      expect(url.searchParams.get('per_page')).toBeNull();
    }
  });

  it('fires no request while the drawer is closed', async () => {
    let calls = 0;
    server.use(
      http.get(`${API_BASE}/admin/wallet/:id/transactions`, () => {
        calls += 1;
        return HttpResponse.json(paginatorResponse());
      })
    );

    renderHook(() => useWalletTransactions(null));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(calls).toBe(0);
  });

  it('restarts at page 1 when a different wallet is opened', async () => {
    const urls: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/wallet/:id/transactions`, ({ request }) => {
        urls.push(new URL(request.url));
        return HttpResponse.json(paginatorResponse());
      })
    );

    const { result, rerender } = renderHook(({ id }) => useWalletTransactions(id), {
      initialProps: { id: 1 as number | null },
    });
    await waitFor(() => expect(result.current.transactions).toHaveLength(2));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(result.current.page).toBe(3));

    rerender({ id: 2 });
    await waitFor(() => expect(urls.at(-1)?.pathname).toContain('/admin/wallet/2/transactions'));
    expect(result.current.page).toBe(1);
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('surfaces a failure as a string and empties the table', async () => {
    server.use(
      http.get(`${API_BASE}/admin/wallet/1/transactions`, () =>
        HttpResponse.json({ status: 'error', message: 'Wallet not found.' }, { status: 404 })
      )
    );

    const { result } = renderHook(() => useWalletTransactions(1));
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Wallet not found.');
    expect(result.current.transactions).toEqual([]);
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session, not a network failure', async () => {
    server.use(
      http.get(`${API_BASE}/admin/wallet/1/transactions`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useWalletTransactions(1));
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    // Not the generic error path — the drawer renders NoPermissionPanel off
    // `isForbidden`, not ErrorBanner off `error`.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
