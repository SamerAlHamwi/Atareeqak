import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ReportData } from '../api/reportsApi';

interface OverviewCardsProps {
  report: ReportData | null;
  isLoading: boolean;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({ report, isLoading }) => {
  const { t } = useTranslation();

  const financial = report?.financial_stats;
  const display = (value: string | undefined) => (isLoading || value === undefined ? '—' : value);

  return (
    <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {/* Total collected (platform commission) */}
      <div className="bg-gradient-to-br from-primary to-primary-container p-6 rounded-xl text-white shadow-lg flex flex-col justify-between h-40">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined bg-white/20 p-2 rounded-lg text-white">
            account_balance_wallet
          </span>
        </div>
        <div>
          <p className="text-white/70 text-sm mb-1">{t('reports.commission')}</p>
          <h2 className="text-2xl font-bold font-headline">
            {display(financial?.primary_admin.total_collected)} {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Primary admin balance */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-secondary bg-secondary-container/30 p-2 rounded-lg">
            savings
          </span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.wallet_balances')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            {display(financial?.primary_admin.current_balance)} {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Total disbursed (payouts) */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-primary bg-primary-fixed-dim/30 p-2 rounded-lg">
            payments
          </span>
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.payouts')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            {display(financial?.primary_admin.total_disbursed)} {t('users.currency')}
          </h2>
        </div>
      </div>

      {/* Locked funds in active rides */}
      <div className="bg-surface-container-lowest p-6 rounded-xl border-b-2 border-outline-variant/15 flex flex-col justify-between h-40 shadow-sm">
        <div className="flex justify-between items-start">
          <span className="material-symbols-outlined text-error bg-error-container p-2 rounded-lg">
            lock_clock
          </span>
          {report && (
            <span className="text-xs font-bold bg-error text-white px-2 py-1 rounded-full">
              {t('reports.active_rides_count', { count: report.ride_stats.active })}
            </span>
          )}
        </div>
        <div>
          <p className="text-on-surface-variant text-sm mb-1">{t('reports.locked_funds')}</p>
          <h2 className="text-2xl font-bold text-primary font-headline">
            {display(financial?.active_rides_locked)} {t('users.currency')}
          </h2>
        </div>
      </div>
    </section>
  );
};
