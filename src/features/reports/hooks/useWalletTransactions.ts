import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { walletApi } from '../../wallet/api/walletApi';
import type {
  WalletTransaction,
  WalletTransactionsWallet,
} from '../../wallet/api/walletApi';

export interface WalletTransactionRow {
  id: number;
  type: string;
  /** Signed; withdrawals/outflows arrive negative. */
  amount: number;
  previousBalance: number;
  newBalance: number;
  description: string;
  transactionId: string;
  status: string;
  reference: string | null;
  date: string;
}

/** Backend validates `per_page` as 1–50; its own default is 10. */
export const WALLET_TRANSACTIONS_PER_PAGE_OPTIONS = [10, 25, 50] as const;
export const DEFAULT_WALLET_TRANSACTIONS_PER_PAGE = 10;

/**
 * Drives the wallet-transactions drawer.
 *
 * Passing `walletId: null` keeps the hook idle, which is how the closed drawer
 * avoids firing a request.
 */
export const useWalletTransactions = (walletId: number | null) => {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;

  const [wallet, setWallet] = useState<WalletTransactionsWallet | null>(null);
  const [transactions, setTransactions] = useState<WalletTransactionRow[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPageState] = useState<number>(DEFAULT_WALLET_TRANSACTIONS_PER_PAGE);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  /** A role change mid-session can 403 a page `RoleRoute` already let through. */
  const [isForbidden, setIsForbidden] = useState(false);

  // Opening a different wallet restarts at page 1 rather than inheriting page 4
  // from the previous one. The owning wallet is stored *alongside* the page so
  // the reset is derived during render — an effect that called setPage(1) would
  // render page 4 against the new wallet for one frame first.
  const [pageState, setPageState] = useState({ walletId, page: 1 });
  const page = pageState.walletId === walletId ? pageState.page : 1;
  const setPage = useCallback(
    (next: number) => setPageState({ walletId, page: next }),
    [walletId]
  );

  const setPerPage = useCallback(
    (next: number) => {
      setPerPageState(next);
      setPageState({ walletId, page: 1 });
    },
    [walletId]
  );

  const mapTransaction = useCallback(
    (tx: WalletTransaction): WalletTransactionRow => ({
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      previousBalance: tx.previous_balance,
      newBalance: tx.new_balance,
      description: tx.description,
      transactionId: tx.transaction_id,
      status: tx.status,
      reference: tx.reference,
      date: tx.created_at ? new Date(tx.created_at).toLocaleString(locale) : '',
    }),
    [locale]
  );

  const fetchTransactions = useCallback(async (isStale: IsStale) => {
    if (walletId === null) {
      return;
    }
    setIsLoading(true);
    setError(null);
    setIsForbidden(false);
    try {
      const response = await walletApi.getWalletTransactions(walletId, page, perPage);
      if (isStale()) {
        return;
      }
      setWallet(response.wallet ?? null);
      setTransactions((response.data ?? []).map(mapTransaction));
      setLastPage(response.meta?.last_page ?? 1);
      setTotal(response.meta?.total ?? 0);
    } catch (err) {
      if (isStale()) {
        return;
      }
      if (isForbiddenError(err)) {
        setIsForbidden(true);
        setTransactions([]);
        return;
      }
      setError(extractApiError(err, t('reports.transactions_load_failed')));
      setTransactions([]);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [walletId, page, perPage, mapTransaction, t]);

  useFetchEffect(fetchTransactions);
  // Not part of the effect's sequence — a Retry button's click should always commit.
  const refetch = useCallback(() => fetchTransactions(() => false), [fetchTransactions]);

  return {
    wallet,
    transactions,
    page,
    setPage,
    lastPage,
    total,
    perPage,
    setPerPage,
    isLoading,
    error,
    isForbidden,
    refetch,
  };
};
