import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useVerifications } from '../../src/features/verification/hooks/useVerifications';
import type { PendingVerification } from '../../src/features/verification/api/verificationsApi';
import { API_BASE, server } from '../testServer';

const PENDING = `${API_BASE}/staff/verifications/pending`;

const pendingRow = (overrides: Partial<PendingVerification> = {}): PendingVerification => ({
  user_id: 31,
  name: 'Unverified1 User',
  email: 'unverified1@test.com',
  gender: 'M',
  address: 'اللاذقية',
  type: 'passenger',
  profile_photo: null,
  documents: [],
  submitted_at: '2026-08-11T09:33:44+03:00',
  ...overrides,
});

/**
 * Serves a queue that shrinks the way the backend's does: each mutation pops
 * the head, so the post-mutation reconcile reads a genuinely different list.
 * Records every GET so the reconcile can be asserted.
 */
const recordingQueue = (rows: PendingVerification[], totalOverride?: number) => {
  const queue = [...rows];
  const gets: URL[] = [];
  server.use(
    http.get(PENDING, ({ request }) => {
      gets.push(new URL(request.url));
      return HttpResponse.json({
        status: 'success',
        total: totalOverride ?? queue.length,
        data: queue,
      });
    })
  );
  return {
    gets,
    /** Mimics the server dropping an approved/rejected user from the queue. */
    drop: (userId: number) => {
      const index = queue.findIndex((r) => r.user_id === userId);
      if (index !== -1) queue.splice(index, 1);
    },
  };
};

describe('useVerifications', () => {
  it('maps the pending payload and exposes the server total', async () => {
    recordingQueue([pendingRow(), pendingRow({ user_id: 33, type: 'driver' })]);

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(2));

    expect(result.current.requests[0]).toMatchObject({
      userId: 31,
      name: 'Unverified1 User',
      email: 'unverified1@test.com',
      gender: 'M',
      address: 'اللاذقية',
      type: 'passenger',
      photo: null,
      documents: [],
    });
    expect(result.current.total).toBe(2);
    expect(result.current.driverCount).toBe(1);
    expect(result.current.passengerCount).toBe(1);
    expect(result.current.error).toBeNull();
    // The first row is auto-selected so the review panel is never empty.
    expect(result.current.selectedRequest?.userId).toBe(31);
  });

  it('reads `total` from the server rather than counting the rows', async () => {
    // The two disagree only if the backend changes; the hook must report the
    // server's number, which is what the header renders.
    recordingQueue([pendingRow()], 7);

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    expect(result.current.total).toBe(7);
  });

  it('falls back to the translated "unknown" label when the name is blank', async () => {
    recordingQueue([pendingRow({ name: '   ' })]);

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    expect(result.current.requests[0].name).toBe(i18n.t('common.unknown'));
  });

  it('exposes the API error message as a string', async () => {
    server.use(
      http.get(PENDING, () =>
        HttpResponse.json({ status: 'error', message: 'Server error occurred' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe('Server error occurred');
    expect(result.current.requests).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('sends the reject reason in the request body', async () => {
    const queue = recordingQueue([pendingRow(), pendingRow({ user_id: 33 })]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/staff/verifications/31/reject`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        queue.drop(31);
        return HttpResponse.json({
          status: 'success',
          message: 'Verification rejected. User has been notified.',
          data: { user_id: 31, verification_status: 'rejected' },
        });
      })
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(2));

    await act(async () => {
      await result.current.rejectRequest(result.current.requests[0], 'Documents are illegible');
    });

    expect(body).toEqual({ reason: 'Documents are illegible' });
  });

  it('omits the reason entirely when none is given (it is nullable server-side)', async () => {
    const queue = recordingQueue([pendingRow()]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/staff/verifications/31/reject`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        queue.drop(31);
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: { user_id: 31, verification_status: 'rejected' },
        });
      })
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    await act(async () => {
      await result.current.rejectRequest(result.current.requests[0]);
    });

    expect(body).toEqual({});
  });

  it('sends national_id on approve and returns the server payload', async () => {
    const queue = recordingQueue([pendingRow()]);
    let body: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/staff/verifications/31/approve`, async ({ request }) => {
        body = (await request.json()) as Record<string, unknown>;
        queue.drop(31);
        return HttpResponse.json({
          status: 'success',
          message: 'Passenger verification approved.',
          data: {
            user_id: 31,
            national_id: '0100000031',
            verification_status: 'verified',
            is_verified_driver: false,
            is_verified_passenger: true,
          },
        });
      })
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));

    let response;
    await act(async () => {
      response = await result.current.approveRequest(result.current.requests[0], '0100000031');
    });

    expect(body).toEqual({ national_id: '0100000031' });
    expect(response).toMatchObject({
      data: { national_id: '0100000031', verification_status: 'verified' },
    });
  });

  it('removes the row optimistically, decrements total, then reconciles with a refetch', async () => {
    const queue = recordingQueue([pendingRow(), pendingRow({ user_id: 33 })]);
    server.use(
      http.post(`${API_BASE}/staff/verifications/31/approve`, () => {
        queue.drop(31);
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: {
            user_id: 31,
            national_id: '0100000031',
            verification_status: 'verified',
            is_verified_driver: false,
            is_verified_passenger: true,
          },
        });
      })
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(2));
    const getsBefore = queue.gets.length;

    await act(async () => {
      await result.current.approveRequest(result.current.requests[0], '0100000031');
    });

    // The row is gone and total dropped 2 → 1 …
    expect(result.current.requests.map((r) => r.userId)).toEqual([33]);
    expect(result.current.total).toBe(1);
    // … and the list was re-read, so the number now standing is the server's.
    expect(queue.gets.length).toBe(getsBefore + 1);
    // Selection moves to the next request instead of emptying the panel.
    expect(result.current.selectedRequest?.userId).toBe(33);
  });

  it('keeps the row when the mutation fails (e.g. a duplicate national ID)', async () => {
    const queue = recordingQueue([pendingRow()]);
    server.use(
      http.post(`${API_BASE}/staff/verifications/31/approve`, () =>
        HttpResponse.json(
          {
            status: 'error',
            message: 'This national ID is already linked to another verified account.',
            data: { conflicting_user_id: 12 },
          },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    const getsBefore = queue.gets.length;

    await expect(
      act(async () => {
        await result.current.approveRequest(result.current.requests[0], '0100000031');
      })
    ).rejects.toThrow();

    expect(result.current.requests).toHaveLength(1);
    expect(result.current.total).toBe(1);
    // No reconcile fires for a request the server refused.
    expect(queue.gets.length).toBe(getsBefore);
  });

  it('filters by type over the complete queue without dropping server rows', async () => {
    // The endpoint takes no query params and returns everything unpaginated, so
    // this filter is client-side by necessity — but it must never hide a row
    // whose type the server actually reported.
    recordingQueue([
      pendingRow({ user_id: 31, type: 'passenger' }),
      pendingRow({ user_id: 33, type: 'driver' }),
      pendingRow({ user_id: 35, type: 'driver' }),
    ]);

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(3));

    expect(result.current.visibleRequests).toHaveLength(3);

    act(() => result.current.setTypeFilter('driver'));
    await waitFor(() => expect(result.current.typeFilter).toBe('driver'));

    expect(result.current.visibleRequests.map((r) => r.userId)).toEqual([33, 35]);
    // The underlying set is untouched — the counts and total still describe it.
    expect(result.current.requests).toHaveLength(3);
    expect(result.current.total).toBe(3);
  });

  it('re-reads the list on refresh and records when it was read', async () => {
    const queue = recordingQueue([pendingRow()]);

    const { result } = renderHook(() => useVerifications());
    await waitFor(() => expect(result.current.requests).toHaveLength(1));
    expect(result.current.updatedAt).toBeInstanceOf(Date);
    const getsBefore = queue.gets.length;

    await act(async () => {
      await result.current.refresh();
    });

    expect(queue.gets.length).toBe(getsBefore + 1);
  });
});
