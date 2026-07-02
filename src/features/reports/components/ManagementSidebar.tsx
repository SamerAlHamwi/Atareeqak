import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Wallet } from '../../wallet/api/walletApi';

interface ManagementSidebarProps {
  walletQuery: string;
  setWalletQuery: (val: string) => void;
  filteredWallets: Wallet[];
  onManualCredit: (phoneNumber: string, amount: number) => void;
  isBusy: (key: string) => boolean;
}

export const ManagementSidebar: React.FC<ManagementSidebarProps> = ({
  walletQuery,
  setWalletQuery,
  filteredWallets,
  onManualCredit,
  isBusy,
}) => {
  const { t } = useTranslation();
  const [creditPhone, setCreditPhone] = useState('');
  const [creditAmount, setCreditAmount] = useState('');

  const creditValid = creditPhone.trim().length >= 10 && Number(creditAmount) > 0;

  return (
    <div className="lg:col-span-1 space-y-8">
      {/* Wallet search */}
      <div className="bg-surface-container-lowest p-8 rounded-xl shadow-sm space-y-6 border border-outline-variant/10">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-primary">account_balance</span>
          <h3 className="text-lg font-bold text-primary">{t('reports.wallet_mgmt')}</h3>
        </div>
        <div className="space-y-4">
          <input
            className="w-full bg-surface-container border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.wallet_search_placeholder')}
            type="text"
            value={walletQuery}
            onChange={(e) => setWalletQuery(e.target.value)}
          />
          {walletQuery.trim() === '' ? (
            <div className="p-4 bg-surface-container-low rounded-lg border-2 border-dashed border-outline-variant/30 flex flex-col items-center justify-center py-8">
              <span className="material-symbols-outlined text-outline-variant text-4xl mb-2">
                person_search
              </span>
              <p className="text-xs text-outline italic text-center">
                {t('reports.wallet_search_empty')}
              </p>
            </div>
          ) : filteredWallets.length === 0 ? (
            <p className="text-xs text-on-surface-variant text-center py-4">{t('common.no_data')}</p>
          ) : (
            <div className="space-y-2">
              {filteredWallets.map((wallet) => (
                <div
                  key={wallet.id}
                  className="p-3 bg-surface-container-low rounded-lg flex items-center justify-between"
                >
                  <div>
                    <p className="text-xs font-bold text-primary" dir="ltr">{wallet.phone_number}</p>
                    <p className="text-[10px] text-on-surface-variant">
                      {wallet.owner || wallet.wallet_number}
                    </p>
                  </div>
                  <span className="text-xs font-bold">{wallet.balance}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manual wallet charge (system admin only endpoint) */}
      <div className="bg-surface-container-low p-8 rounded-xl space-y-6">
        <div className="flex items-center gap-3">
          <span className="material-symbols-outlined text-secondary">add_card</span>
          <h3 className="text-lg font-bold text-primary">{t('reports.manual_credit')}</h3>
        </div>
        <p className="text-sm text-on-surface-variant leading-relaxed">
          {t('reports.manual_credit_desc')}
        </p>
        <div className="space-y-3">
          <input
            className="w-full bg-surface-container-lowest border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.credit_phone_placeholder')}
            type="text"
            dir="ltr"
            value={creditPhone}
            onChange={(e) => setCreditPhone(e.target.value)}
          />
          <input
            className="w-full bg-surface-container-lowest border-none rounded-lg text-sm px-4 py-3 focus:ring-2 focus:ring-secondary/20 text-start"
            placeholder={t('reports.credit_amount_placeholder')}
            type="number"
            min="1"
            value={creditAmount}
            onChange={(e) => setCreditAmount(e.target.value)}
          />
          <button
            onClick={() => {
              onManualCredit(creditPhone.trim(), Number(creditAmount));
              setCreditPhone('');
              setCreditAmount('');
            }}
            disabled={!creditValid || isBusy('manual-credit')}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isBusy('manual-credit') ? t('common.loading') : t('reports.manual_credit')}
          </button>
        </div>
      </div>
    </div>
  );
};
