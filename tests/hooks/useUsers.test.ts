import { describe, it, expect } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useUsers } from '../../src/features/users/hooks/useUsers';
import type { UserRowResponse } from '../../src/features/users/api/usersApi';
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

const usersResponse = (users: UserRowResponse[], meta: Partial<{ last_page: number; total: number }> = {}) => ({
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
    meta: { current_page: 1, last_page: 1, per_page: 10, total: users.length, ...meta },
  },
});

describe('useUsers', () => {
  it('maps API rows into UI rows', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users`, () =>
        HttpResponse.json(usersResponse([userRow({ id: 7, status: 'pending', type: 'driver' })]))
      )
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.users[0]).toMatchObject({
      id: '7',
      name: 'Ali Hassan',
      email: 'ali@example.com',
      type: 'driver',
      status: 'pending',
    });
    expect(result.current.stats?.total_registered).toBe(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('falls back to the translated "unknown" label when full_name is missing', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users`, () =>
        HttpResponse.json(usersResponse([userRow({ full_name: '' })]))
      )
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    expect(result.current.users[0].name).toBe(i18n.t('common.unknown'));
  });

  it('exposes an error state when the API returns 500', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users`, () => HttpResponse.json({ message: 'boom' }, { status: 500 }))
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.error).not.toBeNull());

    expect(result.current.users).toHaveLength(0);
    expect(result.current.isLoading).toBe(false);
  });

  it('refetches with the requested page and reads pagination meta', async () => {
    const seenPages: string[] = [];
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        const url = new URL(request.url);
        seenPages.push(url.searchParams.get('page') ?? '');
        return HttpResponse.json(usersResponse([userRow()], { last_page: 3, total: 25 }));
      })
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));
    expect(result.current.lastPage).toBe(3);
    expect(result.current.total).toBe(25);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(seenPages).toContain('2'));
  });

  it('debounces search and resets to page 1', async () => {
    const requests: { page: string | null; search: string | null }[] = [];
    server.use(
      http.get(`${API_BASE}/admin/users`, ({ request }) => {
        const url = new URL(request.url);
        requests.push({ page: url.searchParams.get('page'), search: url.searchParams.get('search') });
        return HttpResponse.json(usersResponse([userRow()], { last_page: 5 }));
      })
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    act(() => result.current.setPage(4));
    await waitFor(() => expect(requests.some((r) => r.page === '4')).toBe(true));

    act(() => result.current.setSearch('ali'));
    // The search request only fires after the 400ms debounce window
    expect(requests.some((r) => r.search === 'ali')).toBe(false);
    await waitFor(() => expect(requests.some((r) => r.search === 'ali')).toBe(true), { timeout: 3000 });

    const searchRequest = requests.find((r) => r.search === 'ali');
    expect(searchRequest?.page).toBe('1');
  });

  it('marks the user suspended after a successful ban', async () => {
    let banBody: unknown = null;
    server.use(
      http.get(`${API_BASE}/admin/users`, () => HttpResponse.json(usersResponse([userRow({ id: 9 })]))),
      http.post(`${API_BASE}/admin/users/9/ban`, async ({ request }) => {
        banBody = await request.json();
        return HttpResponse.json({ status: 'success' });
      })
    );

    const { result } = renderHook(() => useUsers());
    await waitFor(() => expect(result.current.users).toHaveLength(1));

    await act(async () => {
      await result.current.banUser(result.current.users[0], { reason: 'spamming the platform', type: 'permanent' });
    });

    expect(banBody).toMatchObject({ reason: 'spamming the platform', type: 'permanent' });
    expect(result.current.users[0].status).toBe('suspended');
  });
});
