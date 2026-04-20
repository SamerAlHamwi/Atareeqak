import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

const Home: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();

  return (
    <div className="text-center py-24 space-y-10">
      {feedback && (
        <div className={`mx-auto max-w-2xl rounded-xl px-4 py-3 text-sm font-semibold border text-start ${
          feedback.tone === 'success'
            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
            : feedback.tone === 'error'
            ? 'bg-red-50 text-red-700 border-red-200'
            : 'bg-indigo-50 text-indigo-700 border-indigo-200'
        }`}>
          <div className="flex items-center justify-between">
            <span>{feedback.message}</span>
            <button onClick={clearFeedback} className="text-xs underline underline-offset-2">Dismiss</button>
          </div>
        </div>
      )}

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

      <div className="flex items-center justify-center gap-4 flex-wrap">
        <button
          onClick={async () => {
            await runAction({ key: 'home-sync', successMessage: 'Live data sync triggered.', errorMessage: 'Live sync failed.' });
          }}
          disabled={isBusy('home-sync')}
          className="px-6 py-3 rounded-xl bg-secondary text-white font-bold disabled:opacity-50"
        >
          {isBusy('home-sync') ? 'Syncing...' : 'Sync data'}
        </button>
        <button
          onClick={async () => {
            await runAction({ key: 'home-notice', successMessage: 'Notice center opened.', errorMessage: 'Could not open notice center.' });
          }}
          disabled={isBusy('home-notice')}
          className="px-6 py-3 rounded-xl border border-outline-variant font-bold disabled:opacity-50"
        >
          Open notices
        </button>
      </div>
    </div>
  );
};

export default Home;
