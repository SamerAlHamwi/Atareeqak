import React from 'react';
import { useTranslation } from 'react-i18next';

interface PlatformConfigProps {
  appName: string;
  setAppName: (val: string) => void;
  supportEmail: string;
  setSupportEmail: (val: string) => void;
}

export const PlatformConfig: React.FC<PlatformConfigProps> = ({
  appName,
  setAppName,
  supportEmail,
  setSupportEmail,
}) => {
  const { t } = useTranslation();

  return (
    <section className="col-span-12 lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
          <span className="material-symbols-outlined">app_settings_alt</span>
        </div>
        <h3 className="text-xl font-bold font-headline">{t('settings.platform_config')}</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.app_name')}
          </label>
          <input
            className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary transition-all p-3 rounded-lg text-on-surface font-medium text-start outline-none"
            type="text"
            value={appName}
            onChange={(e) => setAppName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.support_email')}
          </label>
          <input
            className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary transition-all p-3 rounded-lg text-on-surface font-medium text-start ltr:font-mono outline-none"
            dir="ltr"
            type="email"
            value={supportEmail}
            onChange={(e) => setSupportEmail(e.target.value)}
          />
        </div>
        <div className="col-span-1 md:col-span-2 space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.working_hours')}
          </label>
          <div className="flex flex-col sm:flex-row gap-4">
            <select
              className="flex-1 bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface cursor-pointer outline-none"
              defaultValue={`06:00 ${t('settings.am')}`}
            >
              <option>08:00 {t('settings.am')}</option>
              <option>06:00 {t('settings.am')}</option>
            </select>
            <span className="flex items-center justify-center text-on-surface-variant font-bold">
              {t('settings.to')}
            </span>
            <select
              className="flex-1 bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface cursor-pointer outline-none"
              defaultValue={`12:00 ${t('settings.midnight')}`}
            >
              <option>10:00 {t('settings.pm')}</option>
              <option>12:00 {t('settings.midnight')}</option>
            </select>
          </div>
        </div>
        <div className="col-span-1 md:col-span-2 pt-4 text-start">
          <div className="flex items-center justify-between p-4 bg-secondary-container/10 rounded-xl border border-secondary-container/30">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-secondary">info</span>
              <p className="text-sm font-medium text-on-secondary-container">
                {t('settings.config_info')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
