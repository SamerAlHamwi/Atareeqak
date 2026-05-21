import { useState, useMemo, useCallback } from 'react';

export interface Transaction {
  id: string;
  user: string;
  userType: 'driver' | 'passenger';
  userInitial: string;
  type: 'commission' | 'credit' | 'refund' | 'withdrawal';
  amount: string;
  date: string;
  status: 'completed' | 'pending';
}

const mockTransactions: Transaction[] = [
  {
    id: '#TXN-89210',
    user: 'أحمد محمد',
    userType: 'driver',
    userInitial: 'أ م',
    type: 'commission',
    amount: '24.50 ر.س',
    date: '14 أكتوبر 2023',
    status: 'completed',
  },
  {
    id: '#TXN-89209',
    user: 'سارة غانم',
    userType: 'passenger',
    userInitial: 'س غ',
    type: 'credit',
    amount: '150.00 ر.س',
    date: '14 أكتوبر 2023',
    status: 'completed',
  },
  {
    id: '#TXN-89208',
    user: 'محمد علي',
    userType: 'driver',
    userInitial: 'م ع',
    type: 'refund',
    amount: '45.00 ر.س',
    date: '13 أكتوبر 2023',
    status: 'pending',
  },
  {
    id: '#TXN-89207',
    user: 'خالد لؤي',
    userType: 'driver',
    userInitial: 'خ ل',
    type: 'withdrawal',
    amount: '1,200.00 ر.س',
    date: '13 أكتوبر 2023',
    status: 'completed',
  },
];

export const useReports = () => {
  const [commissionRate, setCommissionRate] = useState<string>('15');
  const [walletQuery, setWalletQuery] = useState<string>('');
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);

  const filteredTransactions = useMemo(() => {
    return transactions.filter((entry) => {
      if (!walletQuery.trim()) {
        return true;
      }
      const query = walletQuery.toLowerCase();
      return entry.id.toLowerCase().includes(query) || entry.user.toLowerCase().includes(query);
    });
  }, [transactions, walletQuery]);

  const toggleTransactionStatus = useCallback((txnId: string) => {
    setTransactions((prev) =>
      prev.map((entry) => {
        if (entry.id !== txnId) return entry;
        return {
          ...entry,
          status: entry.status === 'pending' ? 'completed' : 'pending',
        };
      })
    );
  }, []);

  return {
    commissionRate,
    setCommissionRate,
    walletQuery,
    setWalletQuery,
    filteredTransactions,
    toggleTransactionStatus,
  };
};
