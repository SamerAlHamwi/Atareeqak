import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useSupport } from '../../src/features/support/hooks/useSupport';
import type { ComplaintResponse } from '../../src/features/support/api/supportApi';
import { API_BASE, server } from '../testServer';

const complaint = (overrides: Partial<ComplaintResponse> = {}): ComplaintResponse => ({
  id: 11,
  title: 'Driver was late',
  description: 'The driver arrived 40 minutes late.',
  type: 'driver_behavior',
  // Arabic-only from the API on purpose — the hook must ignore it and translate
  // `type` itself, otherwise the English UI renders Arabic.
  type_label: 'سلوك السائق',
  status: 'pending',
  status_label: 'Pending',
  status_color: 'gray',
  is_escalated: false,
  resolution_notes: null,
  resolved_at: null,
  assigned_to: null,
  user: { id: 3, name: 'Sara', email: 'sara@example.com' },
  attachments: null,
  created_at: '2024-05-01T10:00:00Z',
  updated_at: '2024-05-01T10:00:00Z',
  ...overrides,
});

const listResponse = (data: ComplaintResponse[], overrides: Record<string, unknown> = {}) => ({
  status: 'success',
  data,
  meta: { current_page: 1, last_page: 2, per_page: 10, total: 10 },
  // `all: 12` vs 10 index-visible rows is the real live shape (BUG-9): `all`
  // also counts the 2 escalated rows that `index` excludes.
  counts: { all: 12, pending: 4, in_review: 2, resolved: 2, closed: 2 },
  ...overrides,
});

/** Records every request URL the hook issues, for param assertions. */
const recordRequests = () => {
  const urls: URL[] = [];
  server.use(
    http.get(`${API_BASE}/staff/complaints`, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json(listResponse([complaint()]));
    }),
    http.get(`${API_BASE}/staff/escalated-complaints`, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json({
        status: 'success',
        data: [complaint({ id: 99, status: 'escalated', is_escalated: true })],
        meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
        counts: { escalated: 2, resolved: 2, closed: 2 },
      });
    })
  );
  return urls;
};

describe('useSupport', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('maps complaints and exposes counts and pagination meta', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()])))
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    expect(result.current.complaints[0]).toMatchObject({
      id: '#CMP-11',
      rawId: 11,
      user: 'Sara',
      status: 'pending',
      content: 'The driver arrived 40 minutes late.',
    });
    expect(result.current.counts?.pending).toBe(4);
    expect(result.current.lastPage).toBe(2);
    expect(result.current.total).toBe(10);
  });

  it('translates the complaint type client-side instead of using the API Arabic type_label', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()])))
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    expect(result.current.complaints[0].category).toBe(i18n.t('support.type.driver_behavior'));
    // The API's own label must NOT leak through into the English UI.
    expect(result.current.complaints[0].category).not.toBe('سلوك السائق');
  });

  it('derives the "all" badge from the four buckets, not the inflated counts.all', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()])))
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.counts).not.toBeNull());

    // 4 + 2 + 2 + 2 = 10, matching meta.total — NOT counts.all (12), which also
    // counts escalated rows that this endpoint never returns.
    expect(result.current.inboxTotal).toBe(10);
    expect(result.current.counts?.all).toBe(12);
    expect(result.current.inboxTotal).not.toBe(result.current.counts?.all);
  });

  it('never sends status=escalated to the index endpoint', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    // Force the escalated value onto the inbox view — the guard must drop it.
    act(() => result.current.setStatusFilter('escalated'));
    await waitFor(() => expect(urls.length).toBeGreaterThan(1));

    const indexCalls = urls.filter((u) => u.pathname.endsWith('/staff/complaints'));
    expect(indexCalls.length).toBeGreaterThan(0);
    for (const url of indexCalls) {
      expect(url.searchParams.get('status')).not.toBe('escalated');
    }
  });

  it('switches to the escalated endpoint and sends the escalated status vocabulary', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    act(() => result.current.setView('escalated'));
    await waitFor(() => expect(result.current.complaints[0]?.rawId).toBe(99));

    const escalatedCalls = urls.filter((u) => u.pathname.endsWith('/staff/escalated-complaints'));
    expect(escalatedCalls).not.toHaveLength(0);
    expect(escalatedCalls.at(-1)?.searchParams.get('status')).toBe('escalated');
    expect(result.current.escalatedCounts?.escalated).toBe(2);
  });

  it('sends the type and date filters as query params', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    act(() => result.current.setTypeFilter('trip_safety'));
    await waitFor(() =>
      expect(urls.at(-1)?.searchParams.get('type')).toBe('trip_safety')
    );

    act(() => result.current.setDateFilter('last_7_days'));
    await waitFor(() =>
      expect(urls.at(-1)?.searchParams.get('date')).toBe('last_7_days')
    );
    // The type filter is still applied alongside it.
    expect(urls.at(-1)?.searchParams.get('type')).toBe('trip_safety');
  });

  it('sends per_page and resets to page 1 on every filter change', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));
    expect(urls.at(-1)?.searchParams.get('per_page')).toBe('10');

    act(() => result.current.setPage(2));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setStatusFilter('resolved'));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('status')).toBe('resolved'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(result.current.page).toBe(1);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));
    act(() => result.current.setPerPage(25));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('per_page')).toBe('25'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('treats opening a pending complaint as a mutation and refetches counts', async () => {
    let listCalls = 0;
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => {
        listCalls += 1;
        // After the open, the server reports the shifted badge counts.
        const counts =
          listCalls === 1
            ? { all: 12, pending: 4, in_review: 2, resolved: 2, closed: 2 }
            : { all: 12, pending: 3, in_review: 3, resolved: 2, closed: 2 };
        return HttpResponse.json(listResponse([complaint()], { counts }));
      }),
      http.get(`${API_BASE}/staff/complaints/11`, () =>
        HttpResponse.json({
          status: 'success',
          data: complaint({
            status: 'in_review',
            assigned_to: { id: 1, name: 'System Admin', role: 'system_admin' },
          }),
        })
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));
    expect(result.current.counts?.pending).toBe(4);

    let outcome: { wasAssignedToMe: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.openComplaint(result.current.complaints[0]);
    });

    expect(outcome?.wasAssignedToMe).toBe(true);
    expect(result.current.selectedComplaint?.assignedTo).toBe('System Admin');
    // The list was re-read so the badges describe the state the open created.
    await waitFor(() => expect(result.current.counts?.pending).toBe(3));
    expect(result.current.counts?.in_review).toBe(3);
  });

  it('does not report an assignment when the opened complaint was not pending', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json(listResponse([complaint({ status: 'in_review' })]))
      ),
      http.get(`${API_BASE}/staff/complaints/11`, () =>
        HttpResponse.json({ status: 'success', data: complaint({ status: 'in_review' }) })
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    let outcome: { wasAssignedToMe: boolean } | undefined;
    await act(async () => {
      outcome = await result.current.openComplaint(result.current.complaints[0]);
    });

    expect(outcome?.wasAssignedToMe).toBe(false);
  });

  it('sends the documented respond payload', async () => {
    let body: unknown;
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json(listResponse([complaint({ status: 'in_review' })]))
      ),
      http.patch(`${API_BASE}/staff/complaints/11/respond`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: complaint({ status: 'resolved', resolution_notes: 'Refunded the passenger fare' }),
        });
      })
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    await act(async () => {
      await result.current.respondToComplaint(
        result.current.complaints[0],
        'Refunded the passenger fare',
        'resolved'
      );
    });

    expect(body).toEqual({
      resolution_notes: 'Refunded the passenger fare',
      status: 'resolved',
    });
  });

  it('sends the documented escalate payload', async () => {
    let body: unknown;
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()]))),
      http.patch(`${API_BASE}/staff/complaints/11/escalate`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: complaint({ status: 'escalated', is_escalated: true }),
        });
      })
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    await act(async () => {
      await result.current.escalateComplaint(
        result.current.complaints[0],
        'Safety issue, needs an admin decision'
      );
    });

    // `reason` only — no status field on this endpoint.
    expect(body).toEqual({ reason: 'Safety issue, needs an admin decision' });
  });

  it('sends the documented escalated-resolve payload', async () => {
    let body: unknown;
    server.use(
      http.get(`${API_BASE}/staff/escalated-complaints`, () =>
        HttpResponse.json({
          status: 'success',
          data: [complaint({ id: 99, status: 'escalated', is_escalated: true })],
          meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
          counts: { escalated: 2, resolved: 2, closed: 2 },
        })
      ),
      http.patch(`${API_BASE}/staff/escalated-complaints/99/resolve`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: complaint({ id: 99, status: 'closed' }),
        });
      })
    );

    const { result } = renderHook(() => useSupport());
    act(() => result.current.setView('escalated'));
    await waitFor(() => expect(result.current.complaints[0]?.rawId).toBe(99));

    await act(async () => {
      await result.current.resolveEscalatedComplaint(
        result.current.complaints[0],
        'Driver account suspended after review',
        'closed'
      );
    });

    expect(body).toEqual({
      resolution_notes: 'Driver account suspended after review',
      status: 'closed',
    });
  });

  it('renders every server-returned row — no client-side re-filter', async () => {
    // The server returns rows the old `visibleComplaints` memo would have
    // dropped: it filtered by `status === statusFilter` over an already
    // server-filtered page. Filtering is server-side; this pins that.
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json(
          listResponse([
            complaint({ id: 1, status: 'pending' }),
            complaint({ id: 2, status: 'in_review' }),
            complaint({ id: 3, status: 'resolved' }),
          ])
        )
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(3));

    act(() => result.current.setStatusFilter('pending'));
    await waitFor(() => expect(result.current.complaints).toHaveLength(3));
  });

  it('exposes the API error message as a string', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json({ status: 'error', message: 'Complaint store unavailable' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(typeof result.current.error).toBe('string');
    expect(result.current.error).toBe('Complaint store unavailable');
    expect(result.current.isLoading).toBe(false);
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session, not a network failure', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    // Not the generic error path — the page renders NoPermissionPanel off
    // `isForbidden`, not ErrorBanner off `error`.
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });
});
