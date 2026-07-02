import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ComplaintCounts } from '../api/supportApi';

interface SupportStatsProps {
  counts: ComplaintCounts | null;
  isLoading: boolean;
}

export const SupportStats: React.FC<SupportStatsProps> = ({ counts, isLoading }) => {
  const { t } = useTranslation();

  const display = (value: number | undefined) =>
    isLoading || value === undefined ? '—' : value.toLocaleString();

  const totalOpen = counts ? counts.pending + counts.in_review : undefined;

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-secondary flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.total_open')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-primary">{display(totalOpen)}</h3>
        </div>
        <div className="bg-secondary/10 p-4 rounded-full">
          <span className="material-symbols-outlined text-secondary text-3xl">pending_actions</span>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-tertiary-fixed-variant flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.pending')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-primary">
            {display(counts?.pending)}
          </h3>
        </div>
        <div className="bg-tertiary-fixed/30 p-4 rounded-full">
          <span className="material-symbols-outlined text-on-tertiary-fixed-variant text-3xl">timer</span>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-error flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.resolved')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-error">
            {display(counts?.resolved)}
          </h3>
        </div>
        <div className="bg-error-container p-4 rounded-full">
          <span className="material-symbols-outlined text-error text-3xl">task_alt</span>
        </div>
      </div>
    </section>
  );
};
