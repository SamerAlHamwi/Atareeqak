import api from '../../../services/api';

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

export const walletApi = {
  /**
   * Get the authenticated admin's own wallet details
   */
  getMyWallet: async (): Promise<{ status: string; wallet: Wallet }> => {
    const response = await api.get('/admin/wallet');
    return response.data;
  },

  /**
   * Get all admin and user wallets
   */
  getAllWallets: async (): Promise<{
    status: string;
    admin_wallets: Wallet[];
    all_wallets: Wallet[]
  }> => {
    const response = await api.get('/admin/wallets');
    return response.data;
  },

  /**
   * Charge a user wallet (Primary admin only)
   * @param phoneNumber User's wallet phone number
   * @param amount Amount in SYP to add (1-1,000,000)
   */
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
    const response = await api.post('/admin/wallet/charge', {
      phone_number: phoneNumber,
      amount,
    });
    return response.data;
  },

  /**
   * Get wallet transaction history
   * @param walletId The wallet's database ID
   */
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
    const response = await api.get(`/admin/wallet/${walletId}/transactions`);
    return response.data;
  },
};

