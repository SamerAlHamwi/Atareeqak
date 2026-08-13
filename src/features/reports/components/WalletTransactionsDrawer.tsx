import React from 'react';
import { useTranslation } from 'react-i18next';
import TablePagination from '../../shared/components/TablePagination';
import TableSkeleton from '../../shared/components/TableSkeleton';
import ErrorBanner from '../../shared/components/ErrorBanner';
import { useWalletTransactions } from '../hooks/useWalletTransactions';

interface WalletTransactionsDrawerProps {
  walletId: number | null;
  onClose: () => void;
}

/**
 * Side drawer over `GET /admin/wallet/{walletId}/transactions`.
 *
 * `walletApi.getWalletTransactions()` had existed since Phase 0 and had never
 * been called from anywhere. Wallet 1 alone carries 31 transactions across 4
 * pages, so this is fully verifiable against the seed.
 *
 * Deliberately **no `PerPageSelect`**: the backend hardcodes the page size to
 * 10 and ignores `per_page` entirely, so a page-size control here would be a
 * widget that does nothing (REQ-6). `TablePagination` alone is honest.
 */
export const WalletTransactionsDrawer: React.FC<WalletTransactionsDrawerProps> = ({
  walletId,
  onClose,
}) => {
  const { t } = useTranslation();
  const { wallet, transactions, page, setPage, lastPage, total, isLoading, error, refetch } =
    useWalletTransactions(walletId);

  if (walletId === null) {
    return null;
  }

  const from = total === 0 ? 0 : (page - 1) * 10 + 1;
  const to = Math.min(page * 10, total);

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]" onClick={onClose} />
      <aside
        data-testid="wallet-transactions-drawer"
        className="fixed inset-y-0 end-0 z-[90] w-full max-w-2xl bg-surface-container-lowest shadow-2xl flex flex-col"
      >
        <header className="p-6 border-b border-outline-variant/20 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-xl font-extrabold font-headline text-primary">
              {t('reports.transactions_title')}
            </h3>
            {wallet && (
              <div className="mt-1 space-y-0.5">
                <p className="text-sm text-on-surface" data-testid="drawer-wallet-name">
                  {wallet.name || wallet.phone_number}
                </p>
                <p className="text-[11px] text-on-surface-variant" dir="ltr">
                  {wallet.wallet_number}
                </p>
              </div>
            )}
          </div>
          <button
            data-testid="wallet-transactions-close"
            onClick={onClose}
            className="p-2 hover:bg-surface-container-high rounded-full transition-colors"
            aria-label={t('common.cancel')}
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </header>

        <div className="flex-1 overflow-y-auto">
          {error && (
            <div className="p-6">
              <ErrorBanner message={error} onRetry={() => void refetch()} />
            </div>
          )}

          <table className="w-full text-start">
            <thead className="bg-surface-container-low text-on-surface-variant text-xs font-bold uppercase tracking-wider sticky top-0">
              <tr>
                <th className="px-4 py-3 text-start">{t('reports.table_type')}</th>
                <th className="px-4 py-3 text-start">{t('reports.table_amount')}</th>
                <th className="px-4 py-3 text-start">{t('reports.table_balance_after')}</th>
                <th className="px-4 py-3 text-start">{t('reports.table_date')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-container">
              {isLoading ? (
                <TableSkeleton rows={5} cols={4} />
              ) : transactions.length === 0 && !error ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-on-surface-variant">
                    {t('reports.transactions_empty')}
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => (
                  <tr key={tx.id} data-testid="wallet-transaction-row">
                    <td className="px-4 py-4 text-start">
                      <p className="text-xs font-bold text-primary">
                        {t(`reports.transaction_types.${tx.type}`, tx.type)}
                      </p>
                      <p className="text-[10px] text-on-surface-variant line-clamp-2">
                        {tx.description}
                      </p>
                    </td>
                    <td
                      className={`px-4 py-4 text-sm font-bold text-start ltr:font-mono ${
                        tx.amount < 0 ? 'text-error' : 'text-secondary'
                      }`}
                      dir="ltr"
                    >
                      {tx.amount.toLocaleString()}
                    </td>
                    <td
                      className="px-4 py-4 text-xs text-on-surface-variant text-start ltr:font-mono"
                      dir="ltr"
                    >
                      {tx.previousBalance.toLocaleString()} → {tx.newBalance.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 text-[11px] text-on-surface-variant text-start">
                      {tx.date}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <TablePagination
          page={page}
          lastPage={lastPage}
          onPageChange={setPage}
          isLoading={isLoading}
          info={t('common.showing_range', { from, to, count: total })}
        />
      </aside>
    </>
  );
};
