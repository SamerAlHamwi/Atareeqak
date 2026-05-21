import React from 'react';
import { useTranslation } from 'react-i18next';

interface ManagementSidebarProps {
  commissionRate: string;
  setCommissionRate: (val: string) => void;
  walletQuery: string;
  setWalletQuery: (val: string) => void;
  onUpdateCommission: () => void;
  onSearchWallet: () => void;
  onManualCredit: () => void;
  onWithdrawBalance: () => void;
  isBusy: (key: string) => boolean;
  isRtl: boolean;
}

export const ManagementSidebar: React.FC<ManagementSidebarProps> = ({
  commissionRate,
  setCommissionRate,
  walletQuery,
  setWalletQuery,
  onUpdateCommission,
  onSearchWallet,
  onManualCredit,
  onWithdrawBalance,
  isBusy,
  isRtl,
}) => {
  const { t } = useTranslation();

  return (
    <div className="lg:col-span-1 space-y-8">
      {/* Commission Settings Card */}
      <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">percent</span>
          <h3 className="text-lg font-bold text-primary">{t('reports.commission_settings')}</h3>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('reports.commission_desc')}
        </p>
        <div className="space-y-2">
          <label className="text-xs font-bold text-on-surface-variant uppercase">
            {t('reports.current_rate')}
          </label>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <input
                className="w-full bg-surface-container-lowest border-none border-b-2 border-outline-variant focus:border-secondary focus:ring-0 rounded-t-lg py-3 px-4 font-bold text-lg text-primary text-start"
                type="number"
                value={commissionRate}
                onChange={(e) => setCommissionRate(e.target.value)}
              />
              <span className={`absolute ${isRtl ? 'left-4' : 'right-4'} top-3 text-outline`}>
                %
              </span>
            </div>
            <button
              onClick={onUpdateCommission}
              disabled={isBusy('update-commission')}
              className="bg-primary text-white px-6 py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {isBusy('update-commission') ? 'Saving...' : t('reports.update')}
            </button>
          </div>
        </div>
      </div>

      {/* Wallet Management Search */}
      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-6 border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          <h3 className="text-lg font-bold text-primary">{t('reports.wallet_mgmt')}</h3>
        </div>
        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              className="flex-1 bg-surface-container border-none rounded-lg text-sm px-4 focus:ring-2 focus:ring-secondary/20 text-start"
              placeholder={t('reports.wallet_search_placeholder')}
              type="text"
              value={walletQuery}
              onChange={(e) => setWalletQuery(e.target.value)}
            />
            <button
              onClick={onSearchWallet}
              disabled={isBusy('wallet-search')}
              className="p-3 bg-secondary text-white rounded-lg disabled:opacity-50"
            >
              <span className="material-symbols-outlined">search</span>
            </button>
          </div>
          <div className="p-4 bg-surface-container-low rounded-lg border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center py-8">
            <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">
              person_search
            </span>
            <p className="text-xs text-outline italic text-center">
              {t('reports.wallet_search_empty')}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={onManualCredit}
              disabled={isBusy('manual-credit')}
              className="bg-surface-container-high text-primary-container px-4 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-primary-fixed transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">add_card</span>
              {t('reports.manual_credit')}
            </button>
            <button
              onClick={onWithdrawBalance}
              disabled={isBusy('withdraw-balance')}
              className="bg-surface-container-high text-error px-4 py-3 rounded-lg text-xs font-bold flex items-center justify-center gap-2 hover:bg-error-container transition-colors disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-sm">outbox</span>
              {t('reports.withdraw_balance')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
