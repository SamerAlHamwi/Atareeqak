import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const Home: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="text-center py-24 space-y-10">
      <div className="space-y-4">
        <p className="label-md text-secondary font-bold tracking-[0.2em]">{t('common.welcome')}</p>
        <h2 className="display-lg text-on-surface leading-tight">
          {t('auth.brand_name')} <br />
          <span className="text-primary">{t('auth.login_title')}</span>
        </h2>
      </div>

      <p className="max-w-2xl mx-auto text-xl text-on-surface-variant font-light leading-relaxed">
        {t('auth.login_subtitle')}
      </p>

      <div className="flex items-center justify-center gap-6">
        <Link
          to="/dashboard"
          className="btn-primary h-14 flex items-center px-10 text-lg shadow-ambient gap-3"
        >
          <span>{t('dashboard.view_all')}</span>
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="rotate-180"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
        </Link>
      </div>
    </div>
  );
};

export default Home;
