import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMockAction } from '../../shared/useMockAction';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useMockAction();
  const [appName, setAppName] = useState(t('auth.brand_name'));
  const [supportEmail, setSupportEmail] = useState('support@atareeqak.com');
  const [commission, setCommission] = useState(15);
  const [minWithdrawal, setMinWithdrawal] = useState(100);
  const [moderationWords, setModerationWords] = useState('كلمة1، كلمة2، رابط، احتيال، كود خصم غير رسمي');

  const saveChanges = async () => {
    await runAction({
      key: 'save-settings',
      successMessage: 'Settings saved locally and ready for API sync.',
      errorMessage: 'Could not save settings.',
    });
  };

  return (
    <div className="space-y-10">
      {feedback && (
        <div className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
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

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">{t('settings.title')}</h2>
          <p className="text-on-surface-variant mt-1">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={saveChanges}
          disabled={isBusy('save-settings')}
          className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 self-start md:self-auto disabled:opacity-50"
        >
          <span className="material-symbols-outlined">save</span>
          {isBusy('save-settings') ? 'Saving...' : t('settings.save_changes')}
        </button>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        {/* Section 1: Platform Configuration */}
        <section className="col-span-12 lg:col-span-7 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined">app_settings_alt</span>
            </div>
            <h3 className="text-xl font-bold font-headline">{t('settings.platform_config')}</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.app_name')}</label>
              <input
                className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary transition-all p-3 rounded-lg text-on-surface font-medium text-start outline-none"
                type="text"
                  value={appName}
                  onChange={(event) => setAppName(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.support_email')}</label>
              <input
                className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary transition-all p-3 rounded-lg text-on-surface font-medium text-start ltr:font-mono outline-none"
                dir="ltr"
                type="email"
                  value={supportEmail}
                  onChange={(event) => setSupportEmail(event.target.value)}
              />
            </div>
            <div className="col-span-1 md:col-span-2 space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.working_hours')}</label>
              <div className="flex flex-col sm:flex-row gap-4">
                <select className="flex-1 bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface cursor-pointer outline-none">
                  <option>08:00 {t('settings.am')}</option>
                  <option selected>06:00 {t('settings.am')}</option>
                </select>
                <span className="flex items-center justify-center text-on-surface-variant font-bold">{t('settings.to')}</span>
                <select className="flex-1 bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface cursor-pointer outline-none">
                  <option>10:00 {t('settings.pm')}</option>
                  <option selected>12:00 {t('settings.midnight')}</option>
                </select>
              </div>
            </div>
            <div className="col-span-1 md:col-span-2 pt-4 text-start">
              <div className="flex items-center justify-between p-4 bg-secondary-container/10 rounded-xl border border-secondary-container/30">
                <div className="flex items-center gap-3">
                  <span className="material-symbols-outlined text-secondary">info</span>
                  <p className="text-sm font-medium text-on-secondary-container">{t('settings.config_info')}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section 2: Payment Settings */}
        <section className="col-span-12 lg:col-span-5 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 text-secondary flex items-center justify-center">
              <span className="material-symbols-outlined">account_balance_wallet</span>
            </div>
            <h3 className="text-xl font-bold font-headline">{t('settings.payment_settings')}</h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant flex justify-between">
                {t('settings.platform_commission')}
                <span className="text-secondary font-bold">{commission}%</span>
              </label>
              <input
                className="w-full h-2 bg-surface-container-high rounded-full appearance-none cursor-pointer accent-secondary"
                max="50"
                min="0"
                type="range"
                value={commission}
                onChange={(event) => setCommission(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.min_withdrawal')}</label>
              <div className="relative">
                <input
                  className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-on-surface font-bold text-start outline-none"
                  type="number"
                  value={minWithdrawal}
                  onChange={(event) => setMinWithdrawal(Number(event.target.value))}
                />
                <span className={`absolute ${isRtl ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-on-surface-variant text-xs font-bold uppercase`}>{t('users.currency')}</span>
              </div>
            </div>
            <div className="space-y-3">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.accepted_payments')}</label>
              <div className="grid grid-cols-2 gap-2">
                {['Mada', 'Apple Pay', t('settings.cash'), 'Visa/MC'].map((method, idx) => (
                  <label key={idx} className="flex items-center gap-3 p-3 bg-surface-container rounded-lg cursor-pointer hover:bg-surface-container-high transition-colors">
                    <input defaultChecked={idx < 3} className="rounded text-secondary focus:ring-secondary w-5 h-5 cursor-pointer" type="checkbox" />
                    <span className="text-sm font-medium">{method}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Notification Rules */}
        <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-on-tertiary-container/10 text-on-tertiary-container flex items-center justify-center">
              <span className="material-symbols-outlined">notifications_active</span>
            </div>
            <h3 className="text-xl font-bold font-headline">{t('settings.notification_rules')}</h3>
          </div>
          <div className="space-y-4">
            {[
              { label: t('settings.trip_alerts'), desc: t('settings.trip_alerts_desc'), checked: true },
              { label: t('settings.email_notifs'), desc: t('settings.email_notifs_desc'), checked: true },
              { label: t('settings.sms_verification'), desc: t('settings.sms_verification_desc'), checked: true },
              { label: t('settings.admin_alerts'), desc: t('settings.admin_alerts_desc'), checked: false }
            ].map((rule, idx) => (
              <div key={idx} className={`flex items-center justify-between p-4 ${idx !== 3 ? 'border-b border-outline-variant/20' : ''}`}>
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

        {/* Section 4: Moderation Rules */}
        <section className="col-span-12 lg:col-span-6 bg-surface-container-lowest p-8 rounded-xl shadow-sm border border-outline-variant/10">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-lg bg-error/10 text-error flex items-center justify-center">
              <span className="material-symbols-outlined">policy</span>
            </div>
            <h3 className="text-xl font-bold font-headline">{t('settings.moderation_rules')}</h3>
          </div>
          <div className="space-y-6">
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-sm font-semibold text-on-surface-variant">{t('settings.auto_block_threshold')}</label>
                <span className="text-error font-bold text-xs bg-error-container px-2 py-1 rounded">{t('settings.active')}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-surface-container-low p-4 rounded-xl border-r-4 border-error text-start">
                  <p className="text-xs text-on-surface-variant mb-1">{t('settings.passenger_complaints')}</p>
                  <div className="flex items-center gap-2">
                    <input className="w-16 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-start outline-none" type="number" defaultValue="3" />
                    <span className="text-xs font-bold">{t('settings.complaints_per_month')}</span>
                  </div>
                </div>
                <div className="bg-surface-container-low p-4 rounded-xl border-r-4 border-error text-start">
                  <p className="text-xs text-on-surface-variant mb-1">{t('settings.trip_cancellations')}</p>
                  <div className="flex items-center gap-2">
                    <input className="w-16 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-start outline-none" type="number" defaultValue="15" />
                    <span className="text-xs font-bold">{t('settings.max_percent')}</span>
                  </div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface-variant block text-start">{t('settings.prohibited_words')}</label>
              <textarea
                className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-sm text-on-surface leading-relaxed text-start outline-none resize-none"
                placeholder={t('settings.words_placeholder')}
                rows={3}
                value={moderationWords}
                onChange={(event) => setModerationWords(event.target.value)}
              ></textarea>
              <p className="text-[10px] text-on-surface-variant italic text-start">{t('settings.words_desc')}</p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer Meta Info */}
      <div className="pt-10 flex flex-col sm:flex-row items-center justify-between text-on-surface-variant/60 text-xs font-medium gap-4">
        <div className="flex items-center gap-4">
          <span>{t('settings.system_version')}: v2.4.0-stable</span>
          <span className="w-1 h-1 bg-on-surface-variant/20 rounded-full"></span>
          <span>{t('settings.last_update')}: 24 مايو 2024 - 10:45 ص</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">verified_user</span>
          <span>{t('settings.secure_env')}</span>
        </div>
      </div>
    </div>
  );
};

export default Settings;
