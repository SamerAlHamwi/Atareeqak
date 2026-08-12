import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { useUserDetails } from '../../src/features/users/hooks/useUserDetails';
import type {
  PassengerFullProfileResponse,
  PassengerWalletChargeResponse,
  UserStatusResponse,
} from '../../src/features/users/api/usersApi';
import { API_BASE, server } from '../testServer';

const USER_ID = 15;

const walletCharge = (
  overrides: Partial<PassengerWalletChargeResponse> = {}
): PassengerWalletChargeResponse => ({
  id: 1,
  transaction_id: 'ADM-15-1700000000',
  amount: 100,
  previous_balance: 900,
  new_balance: 1000,
  status: 'completed',
  notes: null,
  date: '2026-08-01',
  processed_by_name: null,
  ...overrides,
});

const fullProfile = (
  overrides: Partial<PassengerFullProfileResponse> = {}
): PassengerFullProfileResponse => ({
  user: {
    id: USER_ID,
    full_name: 'Passenger5 Test',
    email: 'passenger5@test.com',
    phone: null,
    address: 'دمشق',
    gender: 'M',
    joined_at: '2026-08-11T09:33:38+03:00',
    profile_photo: null,
    verification_status: 'approved',
    is_verified_passenger: true,
    account_status: 'active',
    ban: null,
  },
  stats: { total_rides: 2, total_spending: 42000, avg_rating: 0, wallet_balance: 4964000 },
  monthly_trips: [
    { month: 'يوليو', month_key: '2026-07', trips: 1, total_cost: 14000 },
    { month: 'أغسطس', month_key: '2026-08', trips: 1, total_cost: 28000 },
  ],
  recent_trips: [
    {
      id: 21,
      date: '2026-08-11',
      route_from: 'دمشق',
      route_to: 'حلب',
      driver: 'Driver3 Test',
      seats: 1,
      price_per_seat: 28000,
      total_cost: 28000,
      status: 'completed',
      departure_time: '2026-08-13T05:33:53+03:00',
    },
  ],
  complaints: [],
  wallet_charges: [],
  ...overrides,
});

const activeStatus = (): UserStatusResponse => ({
  user_id: USER_ID,
  name: 'Passenger5 Test',
  email: 'passenger5@test.com',
  account_status: 'active',
  status_code: 1,
  ban: null,
});

const bannedStatus = (
  type: 'permanent' | 'temporary' = 'temporary',
  expiresAt: string | null = '2026-08-20T00:00:00+03:00'
): UserStatusResponse => ({
  ...activeStatus(),
  account_status: 'banned',
  status_code: -1,
  ban: {
    reason: 'chargeback fraud on three separate rides',
    type,
    banned_at: '2026-08-12T15:00:00+03:00',
    expires_at: expiresAt,
    is_expired: false,
    banned_by: null,
  },
});

/** Serves the status endpoint from a mutable cell, and records each read. */
const statusEndpoint = (initial: UserStatusResponse) => {
  const state = { current: initial, reads: 0 };
  server.use(
    http.get(`${API_BASE}/admin/users/${USER_ID}/status`, () => {
      state.reads += 1;
      return HttpResponse.json({ status: 'success', data: state.current });
    })
  );
  return state;
};

beforeEach(() => {
  server.use(
    http.get(`${API_BASE}/admin/passengers/${USER_ID}/full-profile`, () =>
      HttpResponse.json({ status: 'success', data: fullProfile() })
    ),
    http.get(`${API_BASE}/admin/users/${USER_ID}/status`, () =>
      HttpResponse.json({ status: 'success', data: activeStatus() })
    )
  );
});

describe('useUserDetails', () => {
  it('seeds every section from the BFF payload and loads the account status', async () => {
    statusEndpoint(activeStatus());
    const { result } = renderHook(() => useUserDetails(String(USER_ID)));

    await waitFor(() => expect(result.current.passenger).not.toBeNull());
    expect(result.current.passenger?.name).toBe('Passenger5 Test');
    // no pravatar fallback — a null photo stays null for <Avatar> to handle
    expect(result.current.passenger?.photo).toBeNull();
    expect(result.current.stats?.walletBalance).toBe(4964000);
    expect(result.current.monthlyTrips).toHaveLength(2);
    expect(result.current.recentTrips).toHaveLength(1);
    expect(result.current.walletCharges).toHaveLength(0);
    await waitFor(() => expect(result.current.status).not.toBeNull());
    expect(result.current.status?.ban).toBeNull();
  });

  it('surfaces a profile fetch failure as a string through `error`', async () => {
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/full-profile`, () =>
        HttpResponse.json({ status: 'error', message: 'User not found.' }, { status: 404 })
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));

    await waitFor(() => expect(result.current.error).toBeTruthy());
    expect(result.current.error).toBe('User not found.');
  });

  it('still renders the passenger when the status endpoint fails', async () => {
    server.use(
      http.get(`${API_BASE}/admin/users/${USER_ID}/status`, () =>
        HttpResponse.json({ status: 'error', message: 'User not found.' }, { status: 404 })
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));

    await waitFor(() => expect(result.current.passenger).not.toBeNull());
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  // ---- temporary bans -------------------------------------------------------

  it('sends type and expires_at for a temporary ban', async () => {
    statusEndpoint(activeStatus());
    let banBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/users/${USER_ID}/ban`, async ({ request }) => {
        banBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus() });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    await act(async () => {
      await result.current.banUser({
        reason: 'chargeback fraud on three separate rides',
        type: 'temporary',
        expires_at: '2026-08-20 00:00:00',
      });
    });

    // This used to be hardcoded to `{reason, type: 'permanent'}`.
    expect(banBody).toEqual({
      reason: 'chargeback fraud on three separate rides',
      type: 'temporary',
      expires_at: '2026-08-20 00:00:00',
    });
  });

  it('sends a permanent ban without an expiry', async () => {
    statusEndpoint(activeStatus());
    let banBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/users/${USER_ID}/ban`, async ({ request }) => {
        banBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({
          status: 'success',
          message: 'ok',
          data: bannedStatus('permanent', null),
        });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    await act(async () => {
      await result.current.banUser({
        reason: 'chargeback fraud on three separate rides',
        type: 'permanent',
      });
    });

    expect(Object.keys(banBody ?? {})).not.toContain('expires_at');
  });

  it('refetches the status after a ban and exposes the temporary expiry', async () => {
    const status = statusEndpoint(activeStatus());
    server.use(
      http.post(`${API_BASE}/admin/users/${USER_ID}/ban`, () => {
        status.current = bannedStatus();
        return HttpResponse.json({ status: 'success', message: 'ok', data: bannedStatus() });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.status).not.toBeNull());
    const readsAfterMount = status.reads;

    await act(async () => {
      await result.current.banUser({
        reason: 'chargeback fraud on three separate rides',
        type: 'temporary',
        expires_at: '2026-08-20 00:00:00',
      });
    });

    expect(status.reads).toBeGreaterThan(readsAfterMount);
    await waitFor(() => expect(result.current.status?.ban).not.toBeNull());
    expect(result.current.status?.ban?.type).toBe('temporary');
    expect(result.current.status?.ban?.expires_at).toBe('2026-08-20T00:00:00+03:00');
  });

  it('reflects logged_out, not active, after an unban', async () => {
    const status = statusEndpoint(bannedStatus());
    const unbanned: UserStatusResponse = {
      ...activeStatus(),
      account_status: 'logged_out',
      status_code: 0,
    };
    server.use(
      http.post(`${API_BASE}/admin/users/${USER_ID}/unban`, () => {
        status.current = unbanned;
        return HttpResponse.json({ status: 'success', message: 'ok', data: unbanned });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.status?.ban).not.toBeNull());

    await act(async () => {
      await result.current.unbanUser();
    });

    await waitFor(() => expect(result.current.status?.ban).toBeNull());
    // AdminBanController::unban writes status 0 — "active" would be wrong here.
    expect(result.current.status?.account_status).toBe('logged_out');
    expect(result.current.status?.status_code).toBe(0);
  });

  // ---- charge wallet --------------------------------------------------------

  it('returns the new balance from the charge response and reads the rest back', async () => {
    statusEndpoint(activeStatus());
    let chargeBody: Record<string, unknown> | null = null;
    const created = walletCharge({
      id: 2,
      transaction_id: 'ADM-15-1786535415',
      amount: 250,
      previous_balance: 4964000,
      new_balance: 4964250,
      notes: 'goodwill credit',
    });
    server.use(
      http.post(`${API_BASE}/admin/passengers/${USER_ID}/charge-wallet`, async ({ request }) => {
        chargeBody = (await request.json()) as Record<string, unknown>;
        // The real endpoint returns ONLY these three fields (REQ-3).
        return HttpResponse.json({
          status: 'success',
          message: 'Wallet charged successfully. New balance: 4964250 SYP.',
          new_balance: 4964250,
        });
      }),
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/wallet-charges`, () =>
        HttpResponse.json({
          status: 'success',
          data: [created],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        })
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    let charged: Awaited<ReturnType<typeof result.current.chargeWallet>> | null = null;
    await act(async () => {
      charged = await result.current.chargeWallet(250, 'goodwill credit');
    });

    expect(chargeBody).toEqual({ amount: 250, admin_notes: 'goodwill credit' });
    expect(charged).toEqual({
      amount: 250,
      newBalance: 4964250,
      previousBalance: 4964000,
      transactionId: 'ADM-15-1786535415',
    });
    // the charge log picked up the new transaction
    expect(result.current.walletCharges.some((c) => c.transactionId === 'ADM-15-1786535415')).toBe(
      true
    );
  });

  it('reports the charge as successful even when the read-back fails', async () => {
    statusEndpoint(activeStatus());
    server.use(
      http.post(`${API_BASE}/admin/passengers/${USER_ID}/charge-wallet`, () =>
        HttpResponse.json({ status: 'success', message: 'ok', new_balance: 4964100 })
      ),
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/wallet-charges`, () =>
        HttpResponse.json({ status: 'error', message: 'boom' }, { status: 500 })
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    let charged: Awaited<ReturnType<typeof result.current.chargeWallet>> | null = null;
    await act(async () => {
      charged = await result.current.chargeWallet(100);
    });

    // Never invented: the two fields the charge response does not carry stay null.
    expect(charged).toEqual({
      amount: 100,
      newBalance: 4964100,
      previousBalance: null,
      transactionId: null,
    });
  });

  it('propagates a 422 from the charge so the page can show field errors', async () => {
    statusEndpoint(activeStatus());
    server.use(
      http.post(`${API_BASE}/admin/passengers/${USER_ID}/charge-wallet`, () =>
        HttpResponse.json(
          { status: 'error', errors: { amount: ['The amount field must be at least 1.'] } },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    await expect(result.current.chargeWallet(0)).rejects.toBeTruthy();
  });

  it('omits admin_notes entirely when none was typed', async () => {
    statusEndpoint(activeStatus());
    let chargeBody: Record<string, unknown> | null = null;
    server.use(
      http.post(`${API_BASE}/admin/passengers/${USER_ID}/charge-wallet`, async ({ request }) => {
        chargeBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: 'success', message: 'ok', new_balance: 10 });
      }),
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/wallet-charges`, () =>
        HttpResponse.json({ status: 'success', data: [], meta: {} })
      )
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    await act(async () => {
      await result.current.chargeWallet(10);
    });

    expect(Object.keys(chargeBody ?? {})).not.toContain('admin_notes');
  });

  // ---- per-section refresh --------------------------------------------------

  it('reloads stats from its own endpoint without re-fetching the BFF', async () => {
    statusEndpoint(activeStatus());
    let profileReads = 0;
    let statsReads = 0;
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/full-profile`, () => {
        profileReads += 1;
        return HttpResponse.json({ status: 'success', data: fullProfile() });
      }),
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/stats`, () => {
        statsReads += 1;
        return HttpResponse.json({
          status: 'success',
          data: { total_rides: 3, total_spending: 70000, avg_rating: 4.5, wallet_balance: 4964250 },
        });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.stats?.totalRides).toBe(2));
    const profileReadsBefore = profileReads;

    await act(async () => {
      await result.current.refreshSection('stats');
    });

    expect(statsReads).toBe(1);
    expect(profileReads).toBe(profileReadsBefore);
    expect(result.current.stats).toEqual({
      totalRides: 3,
      totalSpending: 70000,
      avgRating: 4.5,
      walletBalance: 4964250,
    });
  });

  it('requests the selected months window for the monthly chart', async () => {
    statusEndpoint(activeStatus());
    const requests: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/monthly-trips`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({
          status: 'success',
          data: [{ month: 'أغسطس', month_key: '2026-08', trips: 4, total_cost: 1000 }],
        });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.monthlyTrips).toHaveLength(2));
    expect(result.current.monthlyWindow).toBe(6);

    await act(async () => {
      await result.current.setMonthlyWindow(12);
    });

    expect(requests[0]?.searchParams.get('months')).toBe('12');
    expect(result.current.monthlyWindow).toBe(12);
    expect(result.current.monthlyTrips).toHaveLength(1);
  });

  it('requests the selected limit for recent trips', async () => {
    statusEndpoint(activeStatus());
    const requests: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/recent-trips`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({ status: 'success', data: [] });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.recentTrips).toHaveLength(1));

    await act(async () => {
      await result.current.setTripLimit(25);
    });

    expect(requests[0]?.searchParams.get('limit')).toBe('25');
    expect(result.current.tripLimit).toBe(25);
    expect(result.current.recentTrips).toHaveLength(0);
  });

  it('filters complaints server-side and keeps the returned counts', async () => {
    statusEndpoint(activeStatus());
    const requests: URL[] = [];
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/complaints`, ({ request }) => {
        requests.push(new URL(request.url));
        return HttpResponse.json({
          status: 'success',
          data: [
            {
              id: 4,
              type: 'financial_issue',
              type_label: 'مشكلة مالية',
              status: 'in_review',
              created_at: '2026-08-10',
              assigned_to: null,
            },
          ],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
          counts: { all: 3, pending: 1, in_review: 1, escalated: 0, resolved: 1, closed: 0 },
        });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());

    await act(async () => {
      await result.current.setComplaintFilter('in_review');
    });

    expect(requests[0]?.searchParams.get('status')).toBe('in_review');
    expect(result.current.complaints).toHaveLength(1);
    expect(result.current.complaints[0].ref).toBe('#CMP-4');
    expect(result.current.complaintCounts?.all).toBe(3);
  });

  it('reloads the wallet charge log on demand', async () => {
    statusEndpoint(activeStatus());
    let reads = 0;
    server.use(
      http.get(`${API_BASE}/admin/passengers/${USER_ID}/wallet-charges`, () => {
        reads += 1;
        return HttpResponse.json({
          status: 'success',
          data: [walletCharge()],
          meta: { current_page: 1, last_page: 1, per_page: 15, total: 1 },
        });
      })
    );

    const { result } = renderHook(() => useUserDetails(String(USER_ID)));
    await waitFor(() => expect(result.current.passenger).not.toBeNull());
    expect(result.current.walletCharges).toHaveLength(0);

    await act(async () => {
      await result.current.refreshSection('wallet-charges');
    });

    expect(reads).toBe(1);
    expect(result.current.walletCharges[0]).toMatchObject({
      transactionId: 'ADM-15-1700000000',
      previousBalance: 900,
      newBalance: 1000,
    });
  });
});
