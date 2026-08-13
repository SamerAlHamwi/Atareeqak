import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useReports } from '../../src/features/reports/hooks/useReports';
import type { WalletRequestResponse } from '../../src/features/wallet/api/walletApi';
import { API_BASE, server } from '../testServer';

const reportData = (overrides: Record<string, unknown> = {}) => ({
  status: 'success',
  report_data: {
    ride_stats: { total: 71, active: 48, completed: 14, cancelled: 5, awaiting_confirmation: 4 },
    financial_stats: {
      // The real payload — total_collected / total_disbursed do NOT exist.
      sycash: {
        current_balance: '718,000.00 SYP',
        total_escrow_in: '1,499,000.00 SYP',
        total_escrow_out: '231,000.00 SYP',
        total_refunds_paid: '424,000.00 SYP',
      },
      primary_admin: {
        current_balance: '135,600.00 SYP',
        total_platform_fees: '17,850.00 SYP',
      },
      active_rides_locked: '546,000.00 SYP',
    },
    date_range: { start: null, end: null },
    ...overrides,
  },
});

const walletsResponse = {
  status: 'success',
  admin_wallets: [
    {
      id: 1,
      name: 'Primary Escrow',
      wallet_number: '0482535926103152',
      phone_number: '0912345678',
      balance: '135,600.00 SYP',
      admin_type: 'system_admin',
    },
  ],
  all_wallets: [
    {
      id: 32,
      name: null,
      is_system: false,
      wallet_number: '9755496935749560',
      phone_number: '+963900000120',
      balance: '4,986,000.00 SYP',
      owner: 'Passenger20 Test',
      owner_email: 'passenger20@test.com',
    },
    {
      id: 25,
      name: null,
      is_system: false,
      wallet_number: '7165260119239971',
      phone_number: '+963900000113',
      balance: '4,953,000.00 SYP',
      owner: 'Passenger13 Test',
      owner_email: 'passenger13@test.com',
    },
  ],
};

const myWalletResponse = {
  status: 'success',
  wallet: {
    id: 1,
    name: 'Primary Escrow',
    wallet_number: '0482535926103152',
    phone_number: '0912345678',
    balance: '135,600.00 SYP',
    admin_type: 'system_admin',
  },
};

const walletRequest = (overrides: Partial<WalletRequestResponse> = {}): WalletRequestResponse => ({
  id: 9001,
  type: 'charge',
  amount: 50000,
  status: 'pending',
  user_notes: 'Please top up my wallet.',
  admin_notes: null,
  processed_at: null,
  created_at: '2026-08-12T09:15:00+00:00',
  user: { id: 1, name: 'Driver1 Test', email: 'driver1@test.com' },
  wallet: {
    id: 3,
    wallet_number: '1111',
    phone_number: '+963900000001',
    current_balance: 2055350,
    cash_ride_debt: 0,
  },
  ...overrides,
});

const requestsResponse = (
  data: WalletRequestResponse[] = [walletRequest()],
  overrides: Record<string, unknown> = {}
) => ({
  status: 'success',
  data,
  meta: { current_page: 1, last_page: 2, per_page: 10, total: 7 },
  counts: { pending: 7, approved: 3, rejected: 2 },
  ...overrides,
});

/** Registers the three GETs the hook fires on mount, recording their URLs. */
const mountHandlers = () => {
  const reportUrls: URL[] = [];
  const requestUrls: URL[] = [];
  server.use(
    http.get(`${API_BASE}/admin/reports`, ({ request }) => {
      reportUrls.push(new URL(request.url));
      return HttpResponse.json(reportData());
    }),
    http.get(`${API_BASE}/admin/wallets`, () => HttpResponse.json(walletsResponse)),
    http.get(`${API_BASE}/admin/wallet`, () => HttpResponse.json(myWalletResponse)),
    http.get(`${API_BASE}/admin/wallet/requests`, ({ request }) => {
      requestUrls.push(new URL(request.url));
      return HttpResponse.json(requestsResponse());
    })
  );
  return { reportUrls, requestUrls };
};

describe('useReports', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('maps the real financial_stats payload, including the four sycash figures', async () => {
    mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.report).not.toBeNull());

    const financial = result.current.report!.financial_stats;
    // These five were previously either mistyped or rendered nowhere.
    expect(financial.primary_admin.total_platform_fees).toBe('17,850.00 SYP');
    expect(financial.sycash.total_escrow_in).toBe('1,499,000.00 SYP');
    expect(financial.sycash.total_escrow_out).toBe('231,000.00 SYP');
    expect(financial.sycash.total_refunds_paid).toBe('424,000.00 SYP');
    expect(financial.sycash.current_balance).toBe('718,000.00 SYP');
    // date_range is null on both sides when unfiltered — not a string.
    expect(result.current.report!.date_range).toEqual({ start: null, end: null });
  });

  it('threads the date range into BOTH the report and the PDF export requests', async () => {
    const { reportUrls } = mountHandlers();
    const pdfUrls: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/export/pdf`, ({ request }) => {
        pdfUrls.push(new URL(request.url));
        // An ArrayBuffer, not a Blob: msw's XHR interceptor cannot stream a
        // jsdom Blob and throws an unhandled rejection that fails the whole file.
        return HttpResponse.arrayBuffer(new TextEncoder().encode('%PDF-1.7').buffer, {
          headers: { 'Content-Type': 'application/pdf' },
        });
      })
    );

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.report).not.toBeNull());
    // Unfiltered first: neither param is sent at all.
    expect(reportUrls[0].searchParams.get('start_date')).toBeNull();

    act(() => result.current.setRange({ start_date: '2026-08-01', end_date: '2026-08-13' }));
    await waitFor(() => expect(reportUrls.length).toBeGreaterThan(1));
    expect(reportUrls.at(-1)?.searchParams.get('start_date')).toBe('2026-08-01');
    expect(reportUrls.at(-1)?.searchParams.get('end_date')).toBe('2026-08-13');

    // The same applied range must reach the export endpoint.
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:stub');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    await act(async () => {
      await result.current.exportPdf(['stats', 'financial']);
    });
    expect(pdfUrls.at(-1)?.searchParams.get('start_date')).toBe('2026-08-01');
    expect(pdfUrls.at(-1)?.searchParams.get('end_date')).toBe('2026-08-13');
    expect(pdfUrls.at(-1)?.searchParams.getAll('sections[]')).toEqual(['stats', 'financial']);
  });

  it('always sends an explicit status and never an "all" value', async () => {
    const { requestUrls } = mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    // The controller defaults to `pending` and always filters, so the hook must
    // send a real status rather than relying on omission to mean "all".
    expect(requestUrls[0].searchParams.get('status')).toBe('pending');
    expect(result.current.statusFilter).toBe('pending');

    act(() => result.current.setStatusFilter('approved'));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('status')).toBe('approved'));

    for (const url of requestUrls) {
      expect(url.searchParams.get('status')).not.toBe('all');
    }
  });

  it('omits `type` for "all" and sends it otherwise', async () => {
    const { requestUrls } = mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    // `type` is applied only `if filled`, so omitting it genuinely means both.
    expect(requestUrls[0].searchParams.get('type')).toBeNull();

    act(() => result.current.setTypeFilter('withdraw'));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('type')).toBe('withdraw'));

    act(() => result.current.setTypeFilter('all'));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('type')).toBeNull());
  });

  it('exposes the server counts block for the tab badges', async () => {
    mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requestCounts).not.toBeNull());

    // Whole-table counts, not the length of the current page (which is 1).
    expect(result.current.requestCounts).toEqual({ pending: 7, approved: 3, rejected: 2 });
    expect(result.current.requests).toHaveLength(1);
  });

  it('resets to page 1 on every filter and per_page change', async () => {
    const { requestUrls } = mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    act(() => result.current.setRequestsPage(2));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setStatusFilter('rejected'));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('status')).toBe('rejected'));
    expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(result.current.requestsPage).toBe(1);

    act(() => result.current.setRequestsPage(2));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setTypeFilter('charge'));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('type')).toBe('charge'));
    expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('1');

    act(() => result.current.setRequestsPage(2));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setRequestsPerPage(25));
    await waitFor(() => expect(requestUrls.at(-1)?.searchParams.get('per_page')).toBe('25'));
    expect(requestUrls.at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('sends admin_notes on approve and reject, and omits it when blank', async () => {
    mountHandlers();
    const bodies: Array<Record<string, unknown>> = [];
    server.use(
      http.post(`${API_BASE}/admin/wallet/requests/:id/approve`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 'success', message: 'ok', data: walletRequest() });
      }),
      http.post(`${API_BASE}/admin/wallet/requests/:id/reject`, async ({ request }) => {
        bodies.push((await request.json()) as Record<string, unknown>);
        return HttpResponse.json({ status: 'success', message: 'ok', data: walletRequest() });
      })
    );

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    const row = result.current.requests[0];

    await act(async () => {
      await result.current.approveRequest(row, 'Receipt verified.');
    });
    expect(bodies[0]).toEqual({ admin_notes: 'Receipt verified.' });

    await act(async () => {
      await result.current.rejectRequest(row, 'Amount does not match.');
    });
    expect(bodies[1]).toEqual({ admin_notes: 'Amount does not match.' });

    // `admin_notes` is nullable — an omitted note must not send an empty string.
    await act(async () => {
      await result.current.approveRequest(row, undefined);
    });
    expect(bodies[2]).toEqual({});
  });

  it('returns all three charge-wallet figures from under `wallet`', async () => {
    mountHandlers();
    server.use(
      http.post(`${API_BASE}/admin/wallet/charge`, () =>
        HttpResponse.json({
          status: 'success',
          message: 'Wallet charged',
          wallet: {
            phone_number: '+963900000113',
            previous_balance: '4,953,000.00 SYP',
            new_balance: '4,953,025.00 SYP',
          },
          transaction_id: 'ADM-123',
        })
      )
    );

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.report).not.toBeNull());

    let response!: Awaited<ReturnType<typeof result.current.chargeWalletByPhone>>;
    await act(async () => {
      response = await result.current.chargeWalletByPhone('+963900000113', 25);
    });

    expect(response.wallet.previous_balance).toBe('4,953,000.00 SYP');
    expect(response.wallet.new_balance).toBe('4,953,025.00 SYP');
    expect(response.transaction_id).toBe('ADM-123');
  });

  it('shows every wallet before the user types, and filters on query', async () => {
    mountHandlers();
    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.wallets).toHaveLength(2));

    // Previously this returned [] until a query was typed, so the sidebar read
    // as "no wallets" while holding all of them.
    expect(result.current.filteredWallets).toHaveLength(2);

    act(() => result.current.setWalletQuery('Passenger13'));
    await waitFor(() => expect(result.current.filteredWallets).toHaveLength(1));
    expect(result.current.filteredWallets[0].owner).toBe('Passenger13 Test');
  });

  it('surfaces a failure as a string message, not an Error object', async () => {
    server.use(
      http.get(`${API_BASE}/admin/reports`, () =>
        HttpResponse.json({ status: 'error', message: 'Forbidden' }, { status: 403 })
      ),
      http.get(`${API_BASE}/admin/wallets`, () => HttpResponse.json(walletsResponse)),
      http.get(`${API_BASE}/admin/wallet`, () => HttpResponse.json(myWalletResponse)),
      http.get(`${API_BASE}/admin/wallet/requests`, () => HttpResponse.json(requestsResponse()))
    );

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toBe('Forbidden');
    expect(typeof result.current.error).toBe('string');
  });

  it('parses a JSON error body returned under responseType blob', async () => {
    mountHandlers();
    server.use(
      http.get(`${API_BASE}/admin/export/pdf`, () =>
        HttpResponse.json(
          { status: 'error', errors: { 'sections.0': ['The selected sections.0 is invalid.'] } },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useReports());
    await waitFor(() => expect(result.current.report).not.toBeNull());

    // Without the blob→JSON normalisation this would download a corrupt .pdf.
    await expect(
      act(async () => {
        await result.current.exportPdf(['stats']);
      })
    ).rejects.toBeTruthy();
  });
});
