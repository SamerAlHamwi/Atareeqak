import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

export interface Wallet {
  id: number;
  wallet_number: string;
  phone_number: string;
  balance: string;
  admin_type?: string;
  owner?: string;
  owner_email?: string;
  created_at?: string;
}

export interface WalletTransaction {
  id: number;
  wallet_id: number;
  type: string;
  amount: number;
  previous_balance: number;
  new_balance: number;
  description: string;
  transaction_id: string;
  status: string;
  created_at: string;
}

export interface WalletRequestResponse {
  id: number;
  type: 'charge' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected';
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
  counts: {
    pending: number;
    approved: number;
    rejected: number;
  };
}

export const walletApi = {
  getMyWallet: async (): Promise<{ status: string; wallet: Wallet }> => {
    const response = await api.get(ENDPOINTS.WALLET.ADMIN_WALLET);
    return response.data;
  },

  getAllWallets: async (): Promise<{
    status: string;
    admin_wallets: Wallet[];
    all_wallets: Wallet[]
  }> => {
    const response = await api.get(ENDPOINTS.WALLET.WALLETS);
    return response.data;
  },

  chargeUserWallet: async (phoneNumber: string, amount: number): Promise<{
    status: string;
    message: string;
    wallet: {
      phone_number: string;
      previous_balance: string;
      new_balance: string;
    };
    transaction_id: string;
  }> => {
    const response = await api.post(ENDPOINTS.WALLET.CHARGE, {
      phone_number: phoneNumber,
      amount,
    });
    return response.data;
  },

  getWalletTransactions: async (walletId: number): Promise<{
    status: string;
    wallet: Wallet;
    transactions: {
      current_page: number;
      data: WalletTransaction[];
      per_page: number;
      total: number;
    };
  }> => {
    const response = await api.get(ENDPOINTS.WALLET.TRANSACTIONS(walletId));
    return response.data;
  },

  getWalletRequests: async (
    params: {
      status?: 'pending' | 'approved' | 'rejected';
      type?: 'charge' | 'withdraw';
      page?: number;
      per_page?: number;
    } = {}
  ): Promise<WalletRequestsListResponse> => {
    const response = await api.get(ENDPOINTS.WALLET.REQUESTS, { params });
    return response.data;
  },

  approveWalletRequest: async (id: string | number, adminNotes?: string) => {
    const response = await api.post(
      ENDPOINTS.WALLET.APPROVE_REQUEST(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },

  rejectWalletRequest: async (id: string | number, adminNotes?: string) => {
    const response = await api.post(
      ENDPOINTS.WALLET.REJECT_REQUEST(id),
      adminNotes ? { admin_notes: adminNotes } : {}
    );
    return response.data;
  },
};
