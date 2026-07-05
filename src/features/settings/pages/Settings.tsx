import React, { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import ErrorBanner from '../../shared/components/ErrorBanner';
import { useSettings } from '../hooks/useSettings';
import { PlatformConfig } from '../components/PlatformConfig';
import { PaymentSettings } from '../components/PaymentSettings';
import { NotificationRules } from '../components/NotificationRules';
import { ModerationRules } from '../components/ModerationRules';

const Settings: React.FC = () => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === 'ar';
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();

  const {
    appName,
    setAppName,
    supportEmail,
    setSupportEmail,
    commission,
    setCommission,
    minWithdrawal,
    setMinWithdrawal,
    moderationWords,
    setModerationWords,
    error,
    saveSettings,
    refresh,
  } = useSettings();

  const handleSaveChanges = useCallback(async () => {
    await runAction({
      key: 'save-settings',
      action: saveSettings,
      successMessage: t('settings.save_success'),
      errorMessage: t('settings.save_failed'),
    });
  }, [runAction, saveSettings, t]);

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />
      {error && <ErrorBanner onRetry={refresh} />}

      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold font-headline text-on-surface tracking-tight">
            {t('settings.title')}
          </h2>
          <p className="text-on-surface-variant mt-1">{t('settings.subtitle')}</p>
        </div>
        <button
          onClick={handleSaveChanges}
          disabled={isBusy('save-settings')}
          className="bg-primary text-on-primary px-8 py-3 rounded-xl font-bold flex items-center gap-2 hover:opacity-90 transition-all shadow-lg shadow-primary/20 self-start md:self-auto disabled:opacity-50"
        >
          <span className="material-symbols-outlined">save</span>
          {isBusy('save-settings') ? t('common.loading') : t('settings.save_changes')}
        </button>
      </div>

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-12 gap-6">
        <PlatformConfig
          appName={appName}
          setAppName={setAppName}
          supportEmail={supportEmail}
          setSupportEmail={setSupportEmail}
        />

        <PaymentSettings
          commission={commission}
          setCommission={setCommission}
          minWithdrawal={minWithdrawal}
          setMinWithdrawal={setMinWithdrawal}
          isRtl={isRtl}
        />

        <NotificationRules />

        <ModerationRules
          moderationWords={moderationWords}
          setModerationWords={setModerationWords}
        />
      </div>

      {/* Footer Meta Info */}
      <div className="pt-10 flex flex-col sm:flex-row items-center justify-between text-on-surface-variant/60 text-xs font-medium gap-4">
        <div className="flex items-center gap-4">
          <span>{t('settings.system_version')}: v2.4.0-stable</span>
          <span className="w-1 h-1 bg-on-surface-variant/20 rounded-full"></span>
          <span>{t('settings.last_update')}: {t('settings.last_update_value')}</span>
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
