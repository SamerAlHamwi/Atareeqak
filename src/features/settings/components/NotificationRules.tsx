import React from 'react';
import { useTranslation } from 'react-i18next';

export const NotificationRules: React.FC = () => {
  const { t } = useTranslation();

  const rules = [
    { label: t('settings.trip_alerts'), desc: t('settings.trip_alerts_desc'), checked: true },
    { label: t('settings.email_notifs'), desc: t('settings.email_notifs_desc'), checked: true },
    { label: t('settings.sms_verification'), desc: t('settings.sms_verification_desc'), checked: true },
    { label: t('settings.admin_alerts'), desc: t('settings.admin_alerts_desc'), checked: false },
  ];

  return (
    <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-lg bg-on-tertiary-container/10 text-on-tertiary-container flex items-center justify-center">
          <span className="material-symbols-outlined">notifications_active</span>
        </div>
        <h3 className="text-xl font-bold font-headline">{t('settings.notification_rules')}</h3>
      </div>
      <div className="space-y-4">
        {rules.map((rule, idx) => (
          <div
            key={idx}
            className={`flex items-center justify-between p-4 ${
              idx !== rules.length - 1 ? 'border-b border-outline-variant/20' : ''
            }`}
          >
            <div className="text-start">
              <p className="font-bold text-on-surface text-sm">{rule.label}</p>
              <p className="text-xs text-on-surface-variant">{rule.desc}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input defaultChecked={rule.checked} className="sr-only peer" type="checkbox" />
              <div className="w-11 h-6 bg-surface-container-high peer-focus:outline-none rounded-full peer peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:right-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-secondary"></div>
            </label>
          </div>
        ))}
      </div>
    </section>
  );
};
