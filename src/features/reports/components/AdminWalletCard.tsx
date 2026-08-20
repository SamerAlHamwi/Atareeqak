import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet as WalletIcon } from 'lucide-react';
import type { Wallet } from '../../wallet/api/walletApi';

interface AdminWalletCardProps {
  wallet: Wallet | null;
  isLoading: boolean;
  onOpenTransactions: (walletId: number) => void;
}

/**
 * `GET /admin/wallet` — the acting admin's own wallet. The endpoint existed
 * since Phase 0 with no consumer at all; this is it.
 *
 * `balance` arrives pre-formatted ("135,600.00 SYP") and is rendered verbatim.
 */
export const AdminWalletCard: React.FC<AdminWalletCardProps> = ({
  wallet,
  isLoading,
  onOpenTransactions,
}) => {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div
        data-testid="admin-wallet-card-skeleton"
        className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-2xl h-40 animate-pulse"
      />
    );
  }

  if (!wallet) {
    return null;
  }

  return (
    <div
      data-testid="admin-wallet-card"
      className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-2xl text-on-primary shadow-lg flex flex-col justify-between min-h-40"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-white/20 p-2 rounded-lg inline-flex">
            <WalletIcon size={20} />
          </span>
          <div>
            <p className="text-sm opacity-80">{t('reports.my_wallet')}</p>
            {wallet.admin_type && (
              <p className="text-[11px] opacity-70">
                {t(`staff.roles.${wallet.admin_type}`, wallet.admin_type)}
              </p>
            )}
          </div>
        </div>
        {/*
          BUG-8: any `{id}` route with an `int` type hint 500s on a non-numeric
          segment — `/admin/wallet/abc/transactions` is a confirmed second site.
          The id is checked numeric before it can ever reach the URL.
        */}
        {Number.isFinite(wallet.id) && (
          <button
            data-testid="admin-wallet-transactions"
            onClick={() => onOpenTransactions(wallet.id)}
            className="text-xs font-bold bg-white/20 hover:bg-white/30 px-3 py-1.5 rounded-full transition-colors"
          >
            {t('reports.view_transactions')}
          </button>
        )}
      </div>

      <div className="mt-6">
        <h2 data-testid="admin-wallet-balance" className="text-3xl font-bold font-headline" dir="ltr">
          {wallet.balance}
        </h2>
        <div className="flex flex-wrap gap-x-6 gap-y-1 mt-2 text-[11px] opacity-80">
          <span dir="ltr">
            {t('reports.wallet_number')}: {wallet.wallet_number}
          </span>
          <span dir="ltr">
            {t('reports.wallet_phone')}: {wallet.phone_number}
          </span>
        </div>
      </div>
    </div>
  );
};
