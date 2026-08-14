import React from 'react';
import { Outlet } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toggleLanguage } from '../../app/i18n';

const AuthLayout: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="min-h-screen bg-surface flex flex-col relative overflow-hidden">
      {/* Decorative background elements matching the image style */}
      <div className="absolute top-0 right-0 w-[50%] h-screen bg-gradient-to-l from-primary-fixed/40 to-transparent pointer-events-none"></div>

      {/* Header */}
      <header className="w-full h-20 flex items-center justify-between px-10 z-20">
        <div className="flex items-center gap-6">
          <button
            onClick={toggleLanguage}
            aria-label={t('header.toggle_language')}
            className="text-on-surface-variant hover:text-primary transition-colors p-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="2" y1="12" x2="22" y2="12"></line><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"></path></svg>
          </button>
        </div>

        <div className="flex items-center gap-2">
           <span className="text-2xl font-bold text-secondary font-display">{t('auth.brand_name')}</span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col items-center justify-center p-6 z-10">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="w-full h-20 bg-surface-container-low/50 flex items-center justify-center px-10 z-20 text-on-surface-variant text-sm">
        <div className="flex items-center gap-2">
          <span>{t('auth.copyright')}</span>
          <span className="font-bold text-primary">{t('auth.brand_name')}</span>
        </div>
      </footer>
    </div>
  );
};

export default AuthLayout;
