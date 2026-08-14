import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError } from '../../../services/apiError';
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

/**
 * Drives the wallet-transactions drawer.
 *
 * Two things about this endpoint are unlike every other list in the project and
 * are handled here rather than at the call site:
 *
 *  1. The payload is a **raw Laravel paginator** under `transactions` — page
 *     numbers at the top level, **no `meta`**. `mapPage` reads them from there.
 *  2. `per_page` is ignored server-side (hardcoded 10), so this hook exposes no
 *     page-size control and the drawer ships `TablePagination` alone.
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const mapTransaction = useCallback(
    (tx: WalletTransaction): WalletTransactionRow => ({
      id: tx.id,
      type: tx.type,
      amount: Number(tx.amount),
      previousBalance: Number(tx.previous_balance),
      newBalance: Number(tx.new_balance),
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
    try {
      const response = await walletApi.getWalletTransactions(walletId, page);
      if (isStale()) {
        return;
      }
      const paginator = response.transactions;
      setWallet(response.wallet ?? null);
      setTransactions((paginator?.data ?? []).map(mapTransaction));
      // Read straight off the paginator — there is no `meta` on this endpoint.
      setLastPage(paginator?.last_page ?? 1);
      setTotal(paginator?.total ?? 0);
    } catch (err) {
      if (isStale()) {
        return;
      }
      setError(extractApiError(err, t('reports.transactions_load_failed')));
      setTransactions([]);
    } finally {
      if (!isStale()) {
        setIsLoading(false);
      }
    }
  }, [walletId, page, mapTransaction, t]);

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
    isLoading,
    error,
    refetch,
  };
};
