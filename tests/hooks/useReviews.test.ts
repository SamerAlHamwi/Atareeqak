import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useReviews } from '../../src/features/reviews/hooks/useReviews';
import type { ReviewResponse } from '../../src/features/reviews/api/reviewsApi';
import { API_BASE, server } from '../testServer';

const review = (overrides: Partial<ReviewResponse> = {}): ReviewResponse => ({
  id: 1,
  comment: 'Driver was very punctual and the car was spotless.',
  commenter: { id: 11, name: 'Passenger1 Test' },
  recipient: { id: 5, name: 'Driver5 Test' },
  created_at: '2026-08-11T10:00:00Z',
  ...overrides,
});

const listResponse = (data: ReviewResponse[], meta: Record<string, number> = {}) => ({
  status: 'success',
  data,
  // No `counts` block on this endpoint — unlike /staff/complaints.
  meta: { current_page: 1, last_page: 2, per_page: 10, total: 8, ...meta },
});

const recordRequests = () => {
  const urls: URL[] = [];
  server.use(
    http.get(`${API_BASE}/staff/reviews`, ({ request }) => {
      urls.push(new URL(request.url));
      return HttpResponse.json(listResponse([review()]));
    })
  );
  return urls;
};

describe('useReviews', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('maps comments and exposes meta', async () => {
    server.use(
      http.get(`${API_BASE}/staff/reviews`, () => HttpResponse.json(listResponse([review()])))
    );

    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    expect(result.current.reviews[0]).toMatchObject({
      id: 1,
      commenter: 'Passenger1 Test',
      commenterId: 11,
      recipient: 'Driver5 Test',
      recipientId: 5,
    });
    expect(result.current.meta).toMatchObject({ lastPage: 2, total: 8, perPage: 10 });
  });

  it('sends per_page and resets to page 1 when it changes', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    expect(urls.at(-1)?.searchParams.get('per_page')).toBe('10');

    act(() => result.current.setPage(2));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setPerPage(25));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('per_page')).toBe('25'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(result.current.page).toBe(1);
  });

  it('sends the user_id deep link and omits it when absent', async () => {
    const urls = recordRequests();

    const { rerender } = renderHook(({ userId }) => useReviews({ userId }), {
      initialProps: { userId: null as number | null },
    });
    await waitFor(() => expect(urls).toHaveLength(1));
    expect(urls.at(-1)?.searchParams.has('user_id')).toBe(false);

    rerender({ userId: 11 });
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('user_id')).toBe('11'));
  });

  it('sends search as a server-side query param after the debounce', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    act(() => result.current.setSearch('punctual'));
    await waitFor(
      () => expect(urls.at(-1)?.searchParams.get('search')).toBe('punctual'),
      { timeout: 2000 }
    );
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
    expect(result.current.hasActiveSearch).toBe(true);
  });

  it('sends the date filter and resets the page', async () => {
    const urls = recordRequests();

    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('page')).toBe('2'));

    act(() => result.current.setDateFilter('last_7_days'));
    await waitFor(() => expect(urls.at(-1)?.searchParams.get('date')).toBe('last_7_days'));
    expect(urls.at(-1)?.searchParams.get('page')).toBe('1');
  });

  it('deletes by comment id and decrements the server total', async () => {
    let deletedPath: string | undefined;
    let method: string | undefined;
    server.use(
      http.get(`${API_BASE}/staff/reviews`, () =>
        HttpResponse.json(listResponse([review({ id: 1 }), review({ id: 2 })]))
      ),
      http.delete(`${API_BASE}/staff/reviews/:id`, ({ request, params }) => {
        method = request.method;
        deletedPath = String(params.id);
        return HttpResponse.json({ status: 'success', message: 'Comment deleted successfully.' });
      })
    );

    const { result } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(2));

    await act(async () => {
      await result.current.deleteReview(result.current.reviews[0]);
    });

    expect(method).toBe('DELETE');
    expect(deletedPath).toBe('1');
    // No request body — the route takes the id in the path only.
    expect(result.current.reviews.map((r) => r.id)).toEqual([2]);
    expect(result.current.meta?.total).toBe(7);
  });

  it('surfaces the 422 from an invalid user_id as a string error', async () => {
    server.use(
      http.get(`${API_BASE}/staff/reviews`, () =>
        HttpResponse.json(
          { status: 'error', errors: { user_id: ['The selected user id is invalid.'] } },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useReviews({ userId: 999999 }));
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(typeof result.current.error).toBe('string');
    expect(result.current.error).toContain('The selected user id is invalid.');
    expect(result.current.reviews).toHaveLength(0);
  });

  it('formats dates in the active locale rather than a pinned one', async () => {
    server.use(
      http.get(`${API_BASE}/staff/reviews`, () => HttpResponse.json(listResponse([review()])))
    );

    const { result, rerender } = renderHook(() => useReviews());
    await waitFor(() => expect(result.current.reviews).toHaveLength(1));
    const englishDate = result.current.reviews[0].date;

    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    rerender();
    await waitFor(() => expect(result.current.reviews[0].date).not.toBe(englishDate));

    await i18n.changeLanguage('en');
  });
});
