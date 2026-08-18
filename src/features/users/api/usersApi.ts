import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

/**
 * The six values `AdminUserService::resolveUserStatus()` can return.
 *
 * `rejected` and `unverified` are **not** valid `status=` filter values
 * (`in:all,verified,pending,suspended,banned`), so those rows are reachable in
 * the "all" tab but cannot be filtered for — same gap the drivers list has.
 * `banned` and `logged_out` are the two states behind the `suspended` filter;
 * the `banned` filter narrows that to `banned` alone.
 */
export type UserRowStatus =
  | 'verified'
  | 'pending'
  | 'banned'
  | 'logged_out'
  | 'rejected'
  | 'unverified';

export interface UserRowResponse {
  id: number;
  full_name: string;
  email: string | null;
  profile_photo: string | null;
  type: 'driver' | 'passenger';
  status: UserRowStatus;
  is_banned: boolean;
  joined_at: string;
  joined_label: string;
}

export interface UsersStatsResponse {
  total_registered: number;
  active_drivers: number;
  pending_drivers: number;
  passengers: number;
  /** `COUNT(status IN (-1, 0))` — banned or logged-out. */
  suspended_users: number;
}

export type UserTypeFilterValue = 'all' | 'driver' | 'passenger';
/**
 * `banned` is a strict subset of `suspended`: the former is `status = -1`, the
 * latter `status IN (-1, 0)`. The two tabs deliberately overlap — `suspended`
 * still answers "who can't sign in", `banned` "who did we actually ban".
 */
export type UserStatusFilterValue = 'all' | 'verified' | 'pending' | 'suspended' | 'banned';
export type UserDateFilterValue =
  | 'all'
  | 'last_30_days'
  | 'last_3_months'
  | 'last_6_months'
  | 'last_12_months';

/**
 * Note the whole payload is nested under `data` — unlike `/admin/drivers`,
 * where `data` is the row array and `meta` is a sibling.
 */
export interface UsersListResponse {
  status: string;
  data: {
    /** Always null today — see BUG-5. `<Avatar>` renders the initials fallback. */
    admin_photo: string | null;
    stats: UsersStatsResponse;
    users: UserRowResponse[];
    counts: {
      all: number;
      verified: number;
      pending: number;
      suspended: number;
      banned: number;
    };
    meta: {
      current_page: number;
      last_page: number;
      per_page: number;
      total: number;
      /** Echo of the applied filters — note the plural key, unlike trips/drivers. */
      filters: {
        type: UserTypeFilterValue;
        status: UserStatusFilterValue;
        date: UserDateFilterValue;
      };
    };
  };
}

export interface UsersListParams {
  type?: UserTypeFilterValue;
  status?: UserStatusFilterValue;
  date?: UserDateFilterValue;
  /** Backend validates 1–50; its own default is 10. */
  per_page?: number;
  page?: number;
  search?: string;
}

export interface BanRequest {
  reason: string; // min 10 chars
  type: 'permanent' | 'temporary';
  /** Required when type=temporary. "Y-m-d H:i:s", validated `after:now`. */
  expires_at?: string;
}

/**
 * `AdminBanController::formatUserStatus()`.
 *
 * `status_code` is the authoritative tri-state: -1 banned · 0 logged_out ·
 * 1 active. Note an **unban lands on 0, not 1** — the backend forces a fresh
 * login — so "not banned" must be tested as `ban === null`, never as
 * `account_status === 'active'`.
 */
export interface UserStatusResponse {
  user_id: number;
  name: string;
  email: string | null;
  account_status: 'banned' | 'logged_out' | 'active' | 'unknown';
  status_code: -1 | 0 | 1;
  ban: {
    reason: string | null;
    type: 'permanent' | 'temporary' | null;
    banned_at: string | null;
    expires_at: string | null;
    is_expired: boolean;
    /** Null for bans issued before the BUG-5 fix; populated for new ones. */
    banned_by: { id: number; name: string } | null;
  } | null;
}

// ---------------------------------------------------------------------------
// Passenger profile — the BFF and the five per-section endpoints
// ---------------------------------------------------------------------------

export interface PassengerStatsResponse {
  total_rides: number;
  total_spending: number;
  avg_rating: number;
  /** 0 both when the balance is zero and when the user has no wallet row. */
  wallet_balance: number;
}

export interface PassengerMonthlyTripResponse {
  month: string;
  month_key: string;
  trips: number;
  total_cost: number;
}

export interface PassengerRecentTripResponse {
  id: number;
  date: string;
  route_from: string | null;
  route_to: string | null;
  driver: string | null;
  seats: number;
  price_per_seat: number;
  total_cost: number;
  status: string;
  departure_time: string | null;
}

export interface PassengerComplaintResponse {
  id: number;
  type: string;
  type_label: string;
  status: string;
  created_at: string;
  assigned_to: string | null;
}

export interface PassengerWalletChargeResponse {
  id: number;
  transaction_id: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  status: string;
  notes: string | null;
  date: string;
  created_at?: string;
  /** Always null today — same `$request->user()` root cause as BUG-5. */
  processed_by_name: string | null;
}

export interface PassengerFullProfileResponse {
  user: {
    id: number;
    full_name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    gender: string | null;
    joined_at: string;
    profile_photo: string | null;
    verification_status: string | null;
    is_verified_passenger: boolean;
    account_status: string;
    ban: {
      reason: string;
      type: string;
      expires_at: string | null;
      banned_at: string | null;
    } | null;
  };
  stats: PassengerStatsResponse;
  monthly_trips: PassengerMonthlyTripResponse[];
  recent_trips: PassengerRecentTripResponse[];
  complaints: PassengerComplaintResponse[];
  wallet_charges: PassengerWalletChargeResponse[];
}

export interface PaginationMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface PassengerComplaintsResponse {
  status: string;
  data: PassengerComplaintResponse[];
  meta: PaginationMeta;
  /** Per-status totals for this user — this endpoint *does* carry counts. */
  counts: {
    all: number;
    pending: number;
    in_review: number;
    escalated: number;
    resolved: number;
    closed: number;
  };
}

export interface PassengerWalletChargesResponse {
  status: string;
  data: PassengerWalletChargeResponse[];
  meta: PaginationMeta | Record<string, never>;
}

/** `status` accepted by `GET /admin/passengers/{id}/complaints`. */
export type PassengerComplaintFilter =
  | 'all'
  | 'pending'
  | 'in_review'
  | 'resolved'
  | 'closed'
  | 'escalated';

/**
 * `PassengerProfileController::chargeWallet()` validation:
 * `amount` → `required|numeric|min:1|max:10000000`,
 * `admin_notes` → `nullable|string|max:500`.
 *
 * Mirrored client-side so an out-of-range amount is disabled rather than
 * submitted and 422'd.
 */
export const CHARGE_AMOUNT_MIN = 1;
export const CHARGE_AMOUNT_MAX = 10_000_000;
export const CHARGE_NOTES_MAX = 500;

/**
 * Matches `POST /admin/wallet/charge` (Phase 9) now — REQ-3 fixed.
 */
export interface ChargeWalletResponse {
  status: string;
  message: string;
  previous_balance: number;
  new_balance: number;
  transaction_id: string;
}

export const usersApi = {
  getAllUsers: async (params: UsersListParams = {}): Promise<UsersListResponse> => {
    const response = await api.get(ENDPOINTS.USERS.ALL, { params });
    return response.data;
  },
  // ban/unban both return the freshly-formatted status, so callers get the new
  // ban state without a follow-up request.
  banUser: async (
    id: string | number,
    ban: BanRequest
  ): Promise<{ status: string; message: string; data: UserStatusResponse }> => {
    const response = await api.post(ENDPOINTS.USERS.BAN(id), ban);
    return response.data;
  },
  unbanUser: async (
    id: string | number,
    adminNotes?: string
  ): Promise<{ status: string; message: string; data: UserStatusResponse }> => {
    const response = await api.post(
      ENDPOINTS.USERS.UNBAN(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },
  /** Server-cached 5 min, but busted immediately by ban/unban. */
  getUserStatus: async (
    id: string | number
  ): Promise<{ status: string; data: UserStatusResponse }> => {
    const response = await api.get(ENDPOINTS.USERS.STATUS(id));
    return response.data;
  },
  // BFF endpoint: whole passenger profile page in one call (server-cached 5 min)
  getPassengerFullProfile: async (
    id: string | number
  ): Promise<{ status: string; data: PassengerFullProfileResponse }> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.FULL_PROFILE(id));
    return response.data;
  },
  // ---- per-section refresh: reloads one card without re-fetching the BFF ----
  /** Cached 5 min server-side; busted by a wallet charge. */
  getPassengerStats: async (
    id: string | number
  ): Promise<{ status: string; data: PassengerStatsResponse }> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.STATS(id));
    return response.data;
  },
  /** `months` is clamped server-side to 1–12 (default 6); cached 15 min. */
  getPassengerMonthlyTrips: async (
    id: string | number,
    months = 6
  ): Promise<{ status: string; data: PassengerMonthlyTripResponse[] }> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.MONTHLY_TRIPS(id), { params: { months } });
    return response.data;
  },
  /** `limit` is clamped server-side to 1–50 (default 10); cached 3 min. */
  getPassengerRecentTrips: async (
    id: string | number,
    limit = 10
  ): Promise<{ status: string; data: PassengerRecentTripResponse[] }> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.RECENT_TRIPS(id), { params: { limit } });
    return response.data;
  },
  /** Not cached — filtered and paginated server-side, and carries `counts`. */
  getPassengerComplaints: async (
    id: string | number,
    params: { status?: PassengerComplaintFilter; per_page?: number; page?: number } = {}
  ): Promise<PassengerComplaintsResponse> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.COMPLAINTS(id), { params });
    return response.data;
  },
  /** Not cached — financial data, mutated by charge-wallet. */
  getPassengerWalletCharges: async (
    id: string | number,
    params: { per_page?: number; page?: number } = {}
  ): Promise<PassengerWalletChargesResponse> => {
    const response = await api.get(ENDPOINTS.PASSENGERS.WALLET_CHARGES(id), { params });
    return response.data;
  },
  chargePassengerWallet: async (
    id: string | number,
    amount: number,
    adminNotes?: string
  ): Promise<ChargeWalletResponse> => {
    const response = await api.post(ENDPOINTS.PASSENGERS.CHARGE_WALLET(id), {
      amount,
      ...(adminNotes ? { admin_notes: adminNotes } : {}),
    });
    return response.data;
  },
};
