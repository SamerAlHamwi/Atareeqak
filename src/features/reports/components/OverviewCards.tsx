import React from 'react';
import { useTranslation } from 'react-i18next';

export const OverviewCards: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Platform Commission */}
      <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl text-white shadow-lg flex flex-col justify-between h-40">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined bg-white/20 p-2 rounded-lg text-white">
            account_balance_wallet
          </span>
          <span className="text-xs font-bold bg-secondary px-2 py-1 rounded text-white">+12%</span>
        </div>
        <div>
          <p className="text-white/70 text-sm mb-1">{t('reports.commission')}</p>
          <h2 className="text-2xl font-bold font-headline">
            45,280.50 {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Wallet Balances */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">
            savings
          </span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.wallet_balances')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            128,400.00 {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Total Payouts */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-primary bg-primary-fixed-dim/30 p-2 rounded-lg">
            payments
          </span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.payouts')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            92,150.25 {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Refund Requests */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-error bg-error-container p-2 rounded-lg">
            assignment_return
          </span>
          <span className="text-xs font-bold bg-error text-white px-2 py-1 rounded-full">
            {t('reports.requests_count', { count: 8 })}
          </span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.refund_requests')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            3,420.00 {t('users.currency')}
          </h2>
        </div>
      </div>
    </section>
  );
};
