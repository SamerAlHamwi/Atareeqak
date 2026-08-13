import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

/**
 * ⚠️ `balance` is **pre-formatted server-side** — "135,600.00 SYP" — on
 * `/admin/wallet` and `/admin/wallets`. Do not re-parse it, and do not append
 * `t('users.currency')` to it: the string already carries its own unit.
 *
 * The one exception is the `wallet` block nested inside
 * `/admin/wallet/{id}/transactions`, which is the **raw model** and returns
 * "135600.00" with no separators and no unit — see `WalletTransactionsWallet`.
 */
export interface Wallet {
  id: number;
  name: string | null;
  wallet_number: string;
  phone_number: string;
  /** Pre-formatted, e.g. "135,600.00 SYP". */
  balance: string;
  /** Present on `admin_wallets` rows only. */
  admin_type?: string;
  /** Present on `all_wallets` rows only. */
  is_system?: boolean;
  owner?: string;
  owner_email?: string;
  created_at?: string;
  updated_at?: string;
}

/** The raw `wallets` row returned alongside a transactions page. */
export interface WalletTransactionsWallet {
  id: number;
  name: string | null;
  user_id: number | null;
  wallet_number: string;
  /** RAW, unformatted, no unit — e.g. "135600.00". Unlike `Wallet.balance`. */
  balance: string;
  cash_ride_debt: string;
  phone_number: string;
  created_at: string;
  updated_at: string;
}

/** Amounts are decimal **strings** here, not numbers. */
export interface WalletTransaction {
  id: number;
  wallet_id: number;
  user_id: number | null;
  type: string;
  amount: string;
  previous_balance: string;
  new_balance: string;
  description: string;
  transaction_id: string;
  status: string;
  reference: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * 🔴 `GET /admin/wallet/{id}/transactions` returns a **raw Laravel paginator**,
 * not the `{data, meta{…}}` envelope every other paginated endpoint in this
 * project uses. There is no `meta` — the page numbers sit at the top level of
 * `transactions`, alongside `links`, `first_page_url`, `path`, `from`, `to`…
 *
 * `per_page` is also **silently ignored**: `AdminWalletService::getWalletTransactions(int
 * $walletId, int $perPage = 10)` never receives the controller's request value,
 * so the page size is hardcoded to 10. Verified live: `?per_page=3` returns 10
 * rows. That is why this function takes no `perPage` argument and the drawer
 * ships `TablePagination` **without** a `PerPageSelect` — a page-size control
 * there would do nothing. Filed as REQ-6 in docs/api/backend-issues.md.
 */
export interface WalletTransactionsPage {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
  data: WalletTransaction[];
}

export type WalletRequestType = 'charge' | 'withdraw';
export type WalletRequestStatus = 'pending' | 'approved' | 'rejected';

export interface WalletRequestResponse {
  id: number;
  type: WalletRequestType;
  amount: number;
  status: WalletRequestStatus;
  user_notes: string | null;
  admin_notes: string | null;
  processed_at: string | null;
  created_at: string;
  user: { id: number; name: string; email: string | null } | null;
  wallet: {
    id: number;
    wallet_number: string;
    phone_number: string;
    current_balance: number;
    cash_ride_debt: number;
  } | null;
}

export interface WalletRequestsListResponse {
  status: string;
  data: WalletRequestResponse[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
  };
  /** Whole-table counts, independent of the active filter. Drives the badges. */
  counts: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

export interface ChargeWalletResponse {
  status: string;
  message: string;
  /** All three figures are nested under `wallet` — confirmed live. */
  wallet: {
    phone_number: string;
    previous_balance: string;
    new_balance: string;
  };
  transaction_id: string;
}

/**
 * `POST /admin/wallet/charge` caps `amount` at **1,000,000**.
 *
 * Do not confuse this with the passenger-side `POST
 * /admin/passengers/{id}/charge-wallet` of Phase 5, whose cap is **10,000,000**
 * and which returns only `{new_balance}` (REQ-3). They are different endpoints
 * with different limits and different response shapes.
 */
export const ADMIN_CHARGE_MIN_AMOUNT = 1;
export const ADMIN_CHARGE_MAX_AMOUNT = 1_000_000;
export const ADMIN_CHARGE_PHONE_MIN = 10;
export const ADMIN_CHARGE_PHONE_MAX = 15;
/** `admin_notes` on approve/reject is `nullable|string|max:500`. */
export const ADMIN_NOTES_MAX_LENGTH = 500;

export const walletApi = {
  /** The acting admin's own wallet. */
  getMyWallet: async (): Promise<{ status: string; wallet: Wallet }> => {
    const response = await api.get(ENDPOINTS.WALLET.ADMIN_WALLET);
    return response.data;
  },

  /** Every wallet on the platform — unpaginated, and with no `search` param. */
  getAllWallets: async (): Promise<{
    status: string;
    admin_wallets: Wallet[];
    all_wallets: Wallet[];
  }> => {
    const response = await api.get(ENDPOINTS.WALLET.WALLETS);
    return response.data;
  },

  chargeUserWallet: async (
    phoneNumber: string,
    amount: number
  ): Promise<ChargeWalletResponse> => {
    const response = await api.post(ENDPOINTS.WALLET.CHARGE, {
      phone_number: phoneNumber,
      amount,
    });
    return response.data;
  },

  /**
   * Takes no `perPage` on purpose — the backend ignores it (see
   * `WalletTransactionsPage`). `page` **is** honoured.
   */
  getWalletTransactions: async (
    walletId: number,
    page = 1
  ): Promise<{
    status: string;
    wallet: WalletTransactionsWallet;
    transactions: WalletTransactionsPage;
  }> => {
    const response = await api.get(ENDPOINTS.WALLET.TRANSACTIONS(walletId), {
      params: { page },
    });
    return response.data;
  },

  /**
   * ⚠️ `status` has no "all" value. `AdminWalletRequestController::index()` does
   * `$status = $request->get('status', 'pending')` and **always** filters, so
   * omitting the param returns pending rows, not every row. The UI must not
   * offer an "All" status tab — see `useReports`. `type`, by contrast, is
   * applied only `if ($request->filled('type'))`, so omitting *it* genuinely
   * means "both types".
   */
  getWalletRequests: async (
    params: {
      status?: WalletRequestStatus;
      type?: WalletRequestType;
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<WalletRequestsListResponse> => {
    const response = await api.get(ENDPOINTS.WALLET.REQUESTS, { params });
    return response.data;
  },

  approveWalletRequest: async (
    id: string | number,
    adminNotes?: string
  ): Promise<{ status: string; message: string; data: WalletRequestResponse }> => {
    const response = await api.post(
      ENDPOINTS.WALLET.APPROVE_REQUEST(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },

  rejectWalletRequest: async (
    id: string | number,
    adminNotes?: string
  ): Promise<{ status: string; message: string; data: WalletRequestResponse }> => {
    const response = await api.post(
      ENDPOINTS.WALLET.REJECT_REQUEST(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },
};
