import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useUsers, isBannedUser } from '../../src/features/users/hooks/useUsers';
import type { UserRowResponse, UserStatusResponse } from '../../src/features/users/api/usersApi';
import { API_BASE, server } from '../testServer';

const userRow = (overrides: Partial<UserRowResponse> = {}): UserRowResponse => ({
  id: 1,
  full_name: 'Ali Hassan',
  email: 'ali@example.com',
  profile_photo: null,
  type: 'passenger',
  status: 'verified',
  joined_at: '2024-01-01T00:00:00Z',
  joined_label: '2024-01-01',
  ...overrides,
});

const usersResponse = (
  users: UserRowResponse[],
  meta: Partial<{ last_page: number; total: number; per_page: number }> = {}
) => ({
  status: 'success',
  data: {
    admin_photo: null,
    stats: {
      total_registered: users.length,
      active_drivers: 0,
      pending_drivers: 0,
      passengers: users.length,
      suspended_users: 0,
    },
    users,
    meta: {
      current_page: 1,
      last_page: 1,
      per_page: 10,
      total: users.length,
      filters: { type: 'all', status: 'all', date: 'all' },
      ...meta,
    },
  },
});

const bannedStatus = (userId: number): UserStatusResponse => ({
  user_id: userId,
  name: 'Ali Hassan',
  email: 'ali@example.com',
  account_status: 'banned',
  status_code: -1,
  ban: {
    reason: 'spamming the platform repeatedly',
    type: 'temporary',
    banned_at: '2026-08-12T10:00:00+03:00',
    expires_at: '2026-08-19T10:00:00+03:00',
    is_expired: false,
    banned_by: null,
  },
});

/** Records every `GET /admin/users` query string the hook produces. */
const recordingList = (users: UserRowResponse[] = [userRow()], meta = {}) => {
  const requests: URL[] = [];
  server.use(
    http.get(`${API_BASE}/admin/users`, ({ request }) => {
      requests.push(new URL(request.url));
      return HttpResponse.json(usersResponse(users, meta));
    })
  );
  return requests;
};

describe('useUsers', () => {
  it('maps API rows into UI rows', async () => {
    recordingList([userRow({ id: 7, status: 'pending', type: 'driver' })]);

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.users[0]).toMatchObject({
      id: '7',
      name: 'Ali Hassan',
      email: 'ali@example.com',
      type: 'driver',
      status: 'pending',
      ban: null,
    });
    expect(result.current.stats?.total_registered).toBe(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('keeps the `rejected` and `unverified` statuses the backend can return', async () => {
    recordingList([userRow({ id: 1, status: 'rejected' }), userRow({ id: 2, status: 'unverified' })]);

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(2));

    expect(result.current.users.map((u) => u.status)).toEqual(['rejected', 'unverified']);
  });

  it('falls back to the translated "unknown" label when full_name is missing', async () => {
    recordingList([userRow({ full_name: '' })]);

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.users[0].name).toBe(i18n.t('common.unknown'));
  });

  it('exposes the API error message as a string', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users`, () =>
        HttpResponse.json({ status: 'error', message: 'Failed to load users' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.error).toBe('Failed to load users');
    expect(result.current.users).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('sends all four filters plus per_page on the first request', async () => {
    const requests = recordingList();

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    const first = requests[0];
    expect(first.searchParams.get('type')).toBe('all');
    expect(first.searchParams.get('status')).toBe('all');
    expect(first.searchParams.get('date')).toBe('all');
    expect(first.searchParams.get('per_page')).toBe('10');
    expect(first.searchParams.get('page')).toBe('1');
  });

  it('requests the selected date window and resets to page 1', async () => {
    const requests = recordingList([userRow()], { last_page: 4, total: 35 });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    act(() => result.current.setPage(3));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '3')).toBe(true));

    act(() => result.current.setDateFilter('last_3_months'));
    await waitFor(() =>
      expect(requests.some((u) => u.searchParams.get('date') === 'last_3_months')).toBe(true)
    );

    const dateRequest = requests.find((u) => u.searchParams.get('date') === 'last_3_months');
    expect(dateRequest?.searchParams.get('page')).toBe('1');
    expect(result.current.dateFilter).toBe('last_3_months');
  });

  it('sends the type filter and resets to page 1', async () => {
    const requests = recordingList([userRow()], { last_page: 3 });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    act(() => result.current.setPage(2));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '2')).toBe(true));

    act(() => result.current.setTypeFilter('passenger'));
    await waitFor(() =>
      expect(requests.some((u) => u.searchParams.get('type') === 'passenger')).toBe(true)
    );

    const typeRequest = requests.find((u) => u.searchParams.get('type') === 'passenger');
    expect(typeRequest?.searchParams.get('page')).toBe('1');
  });

  it('sends per_page and resets to page 1 when it changes', async () => {
    const requests = recordingList([userRow()], { last_page: 7 });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    act(() => result.current.setPage(4));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '4')).toBe(true));

    act(() => result.current.setPerPage(5));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('per_page') === '5')).toBe(true));

    const perPageRequest = requests.find((u) => u.searchParams.get('per_page') === '5');
    expect(perPageRequest?.searchParams.get('page')).toBe('1');
  });

  it('reads pagination meta from the nested data envelope', async () => {
    recordingList([userRow()], { last_page: 4, total: 35, per_page: 10 });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.lastPage).toBe(4);
    expect(result.current.total).toBe(35);
    expect(result.current.perPage).toBe(10);
  });

  it('debounces search and resets to page 1', async () => {
    const requests = recordingList([userRow()], { last_page: 5 });

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    act(() => result.current.setPage(4));
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('page') === '4')).toBe(true));

    act(() => result.current.setSearch('ali'));
    // The search request only fires after the 400ms debounce window
    expect(requests.some((u) => u.searchParams.get('search') === 'ali')).toBe(false);
    await waitFor(() => expect(requests.some((u) => u.searchParams.get('search') === 'ali')).toBe(true), {
      timeout: 3000,
    });

    const searchRequest = requests.find((u) => u.searchParams.get('search') === 'ali');
    expect(searchRequest?.searchParams.get('page')).toBe('1');
  });

  it('renders every server-filtered row — no client-side re-filter', async () => {
    // `status=suspended` is a server-side filter; the rows it returns may carry
    // any UI status (BUG-6), and all of them must still be rendered.
    recordingList([
      userRow({ id: 1, status: 'verified' }),
      userRow({ id: 2, status: 'unverified' }),
      userRow({ id: 3, status: 'suspended' }),
    ]);

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(3));

    act(() => result.current.setStatusFilter('suspended'));
    await waitFor(() => expect(result.current.statusFilter).toBe('suspended'));
    expect(result.current.users).toHaveLength(3);
  });

  it('stores the authoritative ban status and refetches, without faking the row status', async () => {
    const requests = recordingList([userRow({ id: 9 })]);
    let banBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/users/9/ban`, async ({ request }) => {
        banBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus(9) });
      })
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    const requestsBefore = requests.length;

    await act(async () => {
      await result.current.banUser(result.current.users[0], {
        reason: 'spamming the platform repeatedly',
        type: 'temporary',
        expires_at: '2026-08-19 10:00:00',
      });
    });

    expect(banBody).toEqual({
      reason: 'spamming the platform repeatedly',
      type: 'temporary',
      expires_at: '2026-08-19 10:00:00',
    });
    // The list is re-read rather than patched: `status` stays what the server
    // says (BUG-6 makes it untrustworthy either way), and the ban is carried
    // separately.
    await waitFor(() => expect(requests.length).toBeGreaterThan(requestsBefore));
    await waitFor(() => expect(result.current.users[0].ban).not.toBeNull());
    expect(result.current.users[0].status).toBe('verified');
    expect(isBannedUser(result.current.users[0])).toBe(true);
  });

  it('clears the known ban state after an unban', async () => {
    recordingList([userRow({ id: 9 })]);
    server.use(
      http.post(`${API_BASE}/admin/users/9/ban`, () =>
        HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus(9) })
      ),
      http.post(`${API_BASE}/admin/users/9/unban`, () =>
        HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: { ...bannedStatus(9), account_status: 'logged_out', status_code: 0, ban: null },
        })
      )
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    await act(async () => {
      await result.current.banUser(result.current.users[0], {
        reason: 'spamming the platform repeatedly',
        type: 'permanent',
      });
    });
    await waitFor(() => expect(isBannedUser(result.current.users[0])).toBe(true));

    await act(async () => {
      await result.current.unbanUser(result.current.users[0]);
    });

    await waitFor(() => expect(isBannedUser(result.current.users[0])).toBe(false));
    // An unban lands on logged_out (0), never on active (1).
    expect(result.current.users[0].ban?.status_code).toBe(0);
  });

  it('exposes admin_photo as null rather than inventing one (BUG-5)', async () => {
    recordingList();

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.adminPhoto).toBeNull();
  });
});
