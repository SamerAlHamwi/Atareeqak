import React from 'react';
import { useTranslation } from 'react-i18next';

export const SupportStats: React.FC = () => {
  const { t } = useTranslation();

  return (
    <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-secondary flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.total_open')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-primary">124</h3>
        </div>
        <div className="bg-secondary/10 p-4 rounded-full">
          <span className="material-symbols-outlined text-secondary text-3xl">pending_actions</span>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-tertiary-fixed-variant flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.avg_response')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-primary">
            14 <span className="text-sm font-normal text-slate-400">{t('support.minutes')}</span>
          </h3>
        </div>
        <div className="bg-tertiary-fixed/30 p-4 rounded-full">
          <span className="material-symbols-outlined text-on-tertiary-fixed-variant text-3xl">timer</span>
        </div>
      </div>
      <div className="bg-surface-container-lowest p-6 rounded-xl shadow-sm border-b-2 border-error flex items-center justify-between">
        <div>
          <p className="text-on-surface-variant mb-1 uppercase tracking-wider text-xs font-semibold">
            {t('support.critical_issues')}
          </p>
          <h3 className="text-4xl font-headline font-extrabold text-error">08</h3>
        </div>
        <div className="bg-error-container p-4 rounded-full">
          <span className="material-symbols-outlined text-error text-3xl">priority_high</span>
        </div>
      </div>
    </section>
  );
};
