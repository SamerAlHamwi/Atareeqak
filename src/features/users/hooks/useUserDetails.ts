import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
import { usersApi } from '../api/usersApi';
import type {
  BanRequest,
  PassengerComplaintFilter,
  PassengerComplaintResponse,
  PassengerFullProfileResponse,
  PassengerMonthlyTripResponse,
  PassengerRecentTripResponse,
  PassengerStatsResponse,
  PassengerWalletChargeResponse,
  UserStatusResponse,
} from '../api/usersApi';

export interface PassengerIdentity {
  id: number;
  name: string;
  email: string;
  phone: string;
  address: string;
  joinedLabel: string;
  /** Server photo URL, or null — the initials <Avatar> covers the gap. */
  photo: string | null;
  isVerified: boolean;
}

export interface PassengerStats {
  totalRides: number;
  totalSpending: number;
  avgRating: number;
  walletBalance: number;
}

export interface PassengerMonthlyTrip {
  monthKey: string;
  month: string;
  trips: number;
  totalCost: number;
}

export interface PassengerTrip {
  id: number;
  date: string;
  from: string;
  to: string;
  driver: string;
  seats: number;
  cost: number;
  status: string;
}

export interface PassengerComplaint {
  id: number;
  ref: string;
  date: string;
  category: string;
  status: string;
  assignedTo: string | null;
}

export interface PassengerWalletCharge {
  id: number;
  date: string;
  transactionId: string;
  amount: number;
  previousBalance: number;
  newBalance: number;
  processedBy: string | null;
  notes: string | null;
  status: string;
}

/**
 * What the confirmation banner reports after a charge.
 *
 * `newBalance` comes straight from the charge response. `previousBalance` and
 * `transactionId` are **not** in that response (REQ-3) — they are read back
 * from `GET /admin/passengers/{id}/wallet-charges`, whose newest row is the
 * transaction just written. Both stay null if that read-back does not line up,
 * rather than being computed client-side and presented as server truth.
 */
export interface WalletChargeResult {
  amount: number;
  newBalance: number;
  previousBalance: number | null;
  transactionId: string | null;
}

/** Sections that can be reloaded on their own, each with its own endpoint. */
export type PassengerSection =
  | 'stats'
  | 'monthly-trips'
  | 'recent-trips'
  | 'complaints'
  | 'wallet-charges';

/** `months` values offered for the chart; the backend clamps to 1–12. */
export const MONTHLY_TRIP_WINDOWS = [3, 6, 12] as const;
/** `limit` values offered for the recent-trips list; the backend clamps to 1–50. */
export const RECENT_TRIP_LIMITS = [5, 10, 25] as const;
export const DEFAULT_MONTHLY_WINDOW = 6;
export const DEFAULT_TRIP_LIMIT = 10;

export const COMPLAINT_FILTERS: readonly PassengerComplaintFilter[] = [
  'all',
  'pending',
  'in_review',
  'resolved',
  'closed',
  'escalated',
] as const;

const mapIdentity = (
  u: PassengerFullProfileResponse['user'],
  t: TFunction,
  locale: string
): PassengerIdentity => ({
  id: u.id,
  name: u.full_name || t('common.unknown'),
  email: u.email || '',
  phone: u.phone || '',
  address: u.address || '',
  // Was pinned to 'ar-SY' regardless of the active language.
  joinedLabel: u.joined_at ? new Date(u.joined_at).toLocaleDateString(locale) : '',
  photo: u.profile_photo,
  isVerified: u.is_verified_passenger,
});

const mapStats = (s: PassengerStatsResponse | undefined): PassengerStats => ({
  totalRides: s?.total_rides ?? 0,
  totalSpending: s?.total_spending ?? 0,
  avgRating: s?.avg_rating ?? 0,
  walletBalance: s?.wallet_balance ?? 0,
});

const mapMonthlyTrips = (rows: PassengerMonthlyTripResponse[] = []): PassengerMonthlyTrip[] =>
  rows.map((m) => ({
    monthKey: m.month_key,
    month: m.month,
    trips: m.trips,
    totalCost: m.total_cost,
  }));

const mapTrips = (rows: PassengerRecentTripResponse[] = [], t: TFunction): PassengerTrip[] =>
  rows.map((tr) => ({
    id: tr.id,
    date: tr.date || '',
    from: tr.route_from || '',
    to: tr.route_to || '',
    driver: tr.driver || t('common.unknown'),
    seats: tr.seats,
    cost: tr.total_cost,
    status: tr.status,
  }));

const mapComplaints = (rows: PassengerComplaintResponse[] = []): PassengerComplaint[] =>
  rows.map((c) => ({
    id: c.id,
    ref: `#CMP-${c.id}`,
    date: c.created_at,
    category: c.type_label || c.type,
    status: c.status,
    assignedTo: c.assigned_to,
  }));

const mapWalletCharges = (
  rows: PassengerWalletChargeResponse[] = []
): PassengerWalletCharge[] =>
  rows.map((w) => ({
    id: w.id,
    date: w.date,
    transactionId: w.transaction_id,
    amount: w.amount,
    previousBalance: w.previous_balance,
    newBalance: w.new_balance,
    processedBy: w.processed_by_name,
    notes: w.notes,
    status: w.status,
  }));

interface UseUserDetailsReturn {
  passenger: PassengerIdentity | null;
  stats: PassengerStats | null;
  monthlyTrips: PassengerMonthlyTrip[];
  recentTrips: PassengerTrip[];
  complaints: PassengerComplaint[];
  complaintCounts: Record<string, number> | null;
  walletCharges: PassengerWalletCharge[];
  /** Authoritative ban state from `GET /admin/users/{id}/status`. */
  status: UserStatusResponse | null;
  monthlyWindow: number;
  setMonthlyWindow: (months: number) => Promise<void>;
  tripLimit: number;
  setTripLimit: (limit: number) => Promise<void>;
  complaintFilter: PassengerComplaintFilter;
  setComplaintFilter: (filter: PassengerComplaintFilter) => Promise<void>;
  refreshingSection: PassengerSection | null;
  refreshSection: (section: PassengerSection) => Promise<void>;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  chargeWallet: (amount: number, notes?: string) => Promise<WalletChargeResult>;
  banUser: (ban: BanRequest) => Promise<void>;
  unbanUser: () => Promise<void>;
}

export const useUserDetails = (userId: string | undefined): UseUserDetailsReturn => {
  const { t, i18n } = useTranslation();
  const [passenger, setPassenger] = useState<PassengerIdentity | null>(null);
  const [stats, setStats] = useState<PassengerStats | null>(null);
  const [monthlyTrips, setMonthlyTrips] = useState<PassengerMonthlyTrip[]>([]);
  const [recentTrips, setRecentTrips] = useState<PassengerTrip[]>([]);
  const [complaints, setComplaints] = useState<PassengerComplaint[]>([]);
  const [complaintCounts, setComplaintCounts] = useState<Record<string, number> | null>(null);
  const [walletCharges, setWalletCharges] = useState<PassengerWalletCharge[]>([]);
  const [status, setStatus] = useState<UserStatusResponse | null>(null);
  const [monthlyWindow, setMonthlyWindowState] = useState<number>(DEFAULT_MONTHLY_WINDOW);
  const [tripLimit, setTripLimitState] = useState<number>(DEFAULT_TRIP_LIMIT);
  const [complaintFilter, setComplaintFilterState] = useState<PassengerComplaintFilter>('all');
  const [refreshingSection, setRefreshingSection] = useState<PassengerSection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Ban state is not part of the full-profile payload in a usable form (it
   * carries a `ban` block but no `status_code`, and the list is wrong in both
   * directions — BUG-6), so it comes from the dedicated status endpoint.
   * Server-cached for 5 minutes, but ban/unban bust that key.
   */
  const fetchStatus = useCallback(async (isStale: IsStale) => {
    if (!userId) return;
    try {
      const response = await usersApi.getUserStatus(userId);
      if (isStale()) {
        return;
      }
      setStatus(response.data);
    } catch (err) {
      // A missing status must not blank out a profile that otherwise loaded.
      console.error('Failed to load user status', err);
    }
  }, [userId]);

  /** The BFF: one call that seeds every section. */
  const fetchProfile = useCallback(async (isStale: IsStale) => {
    if (!userId) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await usersApi.getPassengerFullProfile(userId);
      if (isStale()) {
        return;
      }
      const data = response.data;
      setPassenger(mapIdentity(data.user, t, i18n.language));
      setStats(mapStats(data.stats));
      setMonthlyTrips(mapMonthlyTrips(data.monthly_trips));
      setRecentTrips(mapTrips(data.recent_trips, t));
      setComplaints(mapComplaints(data.complaints));
      setWalletCharges(mapWalletCharges(data.wallet_charges));
      // The BFF always answers with its own defaults; keep the selectors honest.
      setMonthlyWindowState(DEFAULT_MONTHLY_WINDOW);
      setTripLimitState(DEFAULT_TRIP_LIMIT);
      setComplaintFilterState('all');
      setComplaintCounts(null);
    } catch (err) {
      if (isStale()) {
        return;
      }
      setError(extractApiError(err, t('common.load_failed')));
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
    await fetchStatus(isStale);
  }, [userId, t, i18n.language, fetchStatus]);

  useFetchEffect(fetchProfile);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchProfile(() => false), [fetchProfile]);

  /**
   * Reloads one section through its own endpoint instead of re-fetching the
   * whole BFF payload — the five `GET /admin/passengers/{id}/…` routes that
   * existed with no consumer until Phase 5. Their cache TTLs differ from the
   * BFF's (stats 5 min, monthly-trips 15 min, recent-trips 3 min, complaints
   * and wallet-charges uncached), so this is also the only way to see fresh
   * financial data without waiting out the profile cache.
   */
  const loadSection = useCallback(
    async (
      section: PassengerSection,
      options: { months?: number; limit?: number; complaintStatus?: PassengerComplaintFilter } = {}
    ) => {
      if (!userId) return;
      setRefreshingSection(section);
      try {
        switch (section) {
          case 'stats': {
            const response = await usersApi.getPassengerStats(userId);
            setStats(mapStats(response.data));
            break;
          }
          case 'monthly-trips': {
            const months = options.months ?? monthlyWindow;
            const response = await usersApi.getPassengerMonthlyTrips(userId, months);
            setMonthlyTrips(mapMonthlyTrips(response.data));
            break;
          }
          case 'recent-trips': {
            const limit = options.limit ?? tripLimit;
            const response = await usersApi.getPassengerRecentTrips(userId, limit);
            setRecentTrips(mapTrips(response.data, t));
            break;
          }
          case 'complaints': {
            const complaintStatus = options.complaintStatus ?? complaintFilter;
            const response = await usersApi.getPassengerComplaints(userId, {
              status: complaintStatus,
            });
            setComplaints(mapComplaints(response.data));
            setComplaintCounts(response.counts ?? null);
            break;
          }
          case 'wallet-charges': {
            const response = await usersApi.getPassengerWalletCharges(userId);
            setWalletCharges(mapWalletCharges(response.data));
            break;
          }
        }
      } finally {
        setRefreshingSection(null);
      }
    },
    [userId, monthlyWindow, tripLimit, complaintFilter, t]
  );

  const refreshSection = useCallback(
    (section: PassengerSection) => loadSection(section),
    [loadSection]
  );

  const setMonthlyWindow = useCallback(
    async (months: number) => {
      setMonthlyWindowState(months);
      await loadSection('monthly-trips', { months });
    },
    [loadSection]
  );

  const setTripLimit = useCallback(
    async (limit: number) => {
      setTripLimitState(limit);
      await loadSection('recent-trips', { limit });
    },
    [loadSection]
  );

  /**
   * Complaints are filtered **server-side** — the endpoint takes `status` and
   * returns `counts`. The page used to filter the BFF's 20-row snapshot in a
   * memo, which silently hid anything past that snapshot.
   */
  const setComplaintFilter = useCallback(
    async (filter: PassengerComplaintFilter) => {
      setComplaintFilterState(filter);
      await loadSection('complaints', { complaintStatus: filter });
    },
    [loadSection]
  );

  const chargeWallet = useCallback(
    async (amount: number, notes?: string): Promise<WalletChargeResult> => {
      if (!userId) {
        throw new Error('No user id');
      }
      const knownTransactionIds = new Set(walletCharges.map((charge) => charge.transactionId));
      const response = await usersApi.chargePassengerWallet(userId, amount, notes);

      // The charge busts the full-profile and stats caches server-side, so this
      // reload shows the new balance rather than a five-minute-old one. Not part
      // of the effect's sequence — always commit.
      await refetch();

      // Then the charge log is re-read from its own (uncached) endpoint: it is
      // the only place the transaction id and previous balance exist, since the
      // charge response carries neither (REQ-3).
      let previousBalance: number | null = null;
      let transactionId: string | null = null;
      try {
        const charges = await usersApi.getPassengerWalletCharges(userId);
        const rows = mapWalletCharges(charges.data);
        setWalletCharges(rows);
        const created = rows.find(
          (row) => !knownTransactionIds.has(row.transactionId) && row.amount === amount
        );
        if (created) {
          previousBalance = created.previousBalance;
          transactionId = created.transactionId;
        }
      } catch (err) {
        // The charge itself succeeded; a failed read-back must not report it as
        // a failure. The confirmation just omits the two fields.
        console.error('Failed to read back the wallet transaction', err);
      }

      return {
        amount,
        newBalance: response.new_balance,
        previousBalance,
        transactionId,
      };
    },
    [userId, walletCharges, refetch]
  );

  /**
   * The mutation already returns the new status, but it is re-read from
   * `GET /admin/users/{id}/status` so what is on screen is what a fresh page
   * load would show.
   */
  const banUser = useCallback(
    async (ban: BanRequest) => {
      if (!userId) return;
      const response = await usersApi.banUser(userId, ban);
      setStatus(response.data);
      // Not part of the effect's sequence — always commit.
      await fetchStatus(() => false);
    },
    [userId, fetchStatus]
  );

  const unbanUser = useCallback(async () => {
    if (!userId) return;
    const response = await usersApi.unbanUser(userId);
    setStatus(response.data);
    // Not part of the effect's sequence — always commit.
    await fetchStatus(() => false);
  }, [userId, fetchStatus]);

  return {
    passenger,
    stats,
    monthlyTrips,
    recentTrips,
    complaints,
    complaintCounts,
    walletCharges,
    status,
    monthlyWindow,
    setMonthlyWindow,
    tripLimit,
    setTripLimit,
    complaintFilter,
    setComplaintFilter,
    refreshingSection,
    refreshSection,
    isLoading,
    error,
    refetch,
    chargeWallet,
    banUser,
    unbanUser,
  };
};
