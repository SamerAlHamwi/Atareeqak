import { describe, it, expect } from 'vitest';
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
  type: 'delay',
  type_label: 'Delay',
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

const listResponse = (data: ComplaintResponse[]) => ({
  status: 'success',
  data,
  meta: { current_page: 1, last_page: 2, per_page: 10, total: 12 },
  counts: { all: 12, pending: 5, in_review: 3, resolved: 2, closed: 2 },
});

describe('useSupport', () => {
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
      category: 'Delay',
      status: 'pending',
      content: 'The driver arrived 40 minutes late.',
    });
    expect(result.current.counts?.pending).toBe(5);
    expect(result.current.lastPage).toBe(2);
    expect(result.current.total).toBe(12);
    // First complaint is auto-selected for the detail pane
    expect(result.current.selectedComplaint?.rawId).toBe(11);
  });

  it('uses translated fallbacks for a missing user and category', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () =>
        HttpResponse.json(
          listResponse([
            complaint({ user: { id: null, name: '', email: null }, type_label: null, title: null }),
          ])
        )
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    expect(result.current.complaints[0].user).toBe(i18n.t('common.unknown_user'));
    expect(result.current.complaints[0].category).toBe(i18n.t('common.general_complaint'));
  });

  it('switches to the escalated endpoint when the view changes', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()]))),
      http.get(`${API_BASE}/staff/escalated-complaints`, () =>
        HttpResponse.json({
          status: 'success',
          data: [complaint({ id: 99, status: 'escalated', is_escalated: true })],
          meta: { current_page: 1, last_page: 1, per_page: 10, total: 1 },
          counts: { escalated: 1, resolved: 0, closed: 0 },
        })
      )
    );

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.complaints).toHaveLength(1));

    act(() => result.current.setView('escalated'));
    await waitFor(() => expect(result.current.complaints[0]?.rawId).toBe(99));

    expect(result.current.escalatedCounts?.escalated).toBe(1);
    expect(result.current.complaints[0].status).toBe('escalated');
  });

  it('applies the updated complaint returned by a respond action', async () => {
    server.use(
      http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.json(listResponse([complaint()]))),
      http.patch(`${API_BASE}/staff/complaints/11/respond`, async ({ request }) => {
        const body = (await request.json()) as { resolution_notes: string; status: string };
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: complaint({ status: 'resolved', resolution_notes: body.resolution_notes }),
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

    expect(result.current.complaints[0].status).toBe('resolved');
    expect(result.current.complaints[0].resolutionNotes).toBe('Refunded the passenger fare');
    expect(result.current.selectedComplaint?.status).toBe('resolved');
  });

  it('exposes an error state when the network fails', async () => {
    server.use(http.get(`${API_BASE}/staff/complaints`, () => HttpResponse.error()));

    const { result } = renderHook(() => useSupport());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.complaints).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });
});
