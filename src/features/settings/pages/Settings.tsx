import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useApiAction } from '../../shared/useApiAction';
import ActionBanner from '../../shared/components/ActionBanner';
import { useSettings } from '../hooks/useSettings';
import type { ContactSettings, FaqGroup, PolicySection } from '../hooks/useSettings';
import type { PolicyType } from '../api/settingsApi';
import { PolicyEditor } from '../components/PolicyEditor';
import { FaqEditor } from '../components/FaqEditor';

type SettingsTab = PolicyType | 'faq';

const TABS: SettingsTab[] = ['privacy', 'cancellation', 'faq'];

const Settings: React.FC = () => {
  const { t } = useTranslation();
  const { runAction, isBusy, feedback, clearFeedback } = useApiAction();
  const [activeTab, setActiveTab] = useState<SettingsTab>('privacy');
  const [contactForm, setContactForm] = useState<ContactSettings | null>(null);

  const {
    privacy,
    cancellation,
    faq,
    contactSettings,
    isLoading,
    error,
    isBackendAvailable,
    refetch,
    updatePolicy,
    updateFaqGroups,
    updateContactSettings,
  } = useSettings();

  const canManage = isBackendAvailable === true;
  const activePolicy = activeTab === 'privacy' ? privacy : activeTab === 'cancellation' ? cancellation : null;
  const form = contactForm ?? contactSettings;

  const handleSavePolicy = async (lastUpdatedLabel: string, sections: PolicySection[]) => {
    if (!canManage || activeTab === 'faq') return;
    await runAction({
      key: `settings-save-${activeTab}`,
      action: () => updatePolicy(activeTab, lastUpdatedLabel, sections),
      successMessage: t(
        activeTab === 'privacy' ? 'settings.privacy_save_success' : 'settings.cancellation_save_success'
      ),
      errorMessage: t('settings.save_failed'),
    });
  };

  const handleSaveFaq = async (groups: FaqGroup[]) => {
    if (!canManage) return;
    await runAction({
      key: 'settings-save-faq',
      action: () => updateFaqGroups(groups),
      successMessage: t('settings.faq_save_success'),
      errorMessage: t('settings.save_failed'),
    });
  };

  const handleSaveContact = async () => {
    if (!canManage || !form) return;
    await runAction({
      key: 'settings-save-contact',
      action: () => updateContactSettings(form),
      successMessage: t('settings.contact_save_success'),
      errorMessage: t('settings.contact_save_failed'),
      onSuccess: () => setContactForm(null),
    });
  };

  return (
    <div className="space-y-10">
      <ActionBanner feedback={feedback} onDismiss={clearFeedback} />

      <div>
        <h2 className="text-3xl font-black text-primary tracking-tight mb-2 font-headline">
          {t('settings.title')}
        </h2>
        <p className="text-on-surface-variant text-sm">{t('settings.subtitle')}</p>
      </div>

      {isBackendAvailable === false ? (
        <div
          data-testid="settings-unavailable"
          className="bg-error-container text-on-error-container rounded-3xl p-8 space-y-5"
        >
          <div className="flex items-start gap-4">
            <span className="material-symbols-outlined text-3xl">report</span>
            <div className="space-y-2">
              <h3 className="text-xl font-extrabold font-headline">{t('settings.unavailable_title')}</h3>
              <p className="text-sm leading-relaxed">{t('settings.unavailable_body')}</p>
            </div>
          </div>
          {error && (
            <div className="bg-surface-container-lowest text-on-surface rounded-2xl p-4">
              <p className="text-sm ltr:font-mono break-words">{error}</p>
            </div>
          )}
          <button
            data-testid="settings-unavailable-retry"
            onClick={() => void refetch()}
            className="flex items-center gap-2 bg-error text-on-error text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-sm">refresh</span>
            {t('common.retry')}
          </button>
        </div>
      ) : isLoading && !privacy && !cancellation && !faq ? (
        <div className="bg-surface-container-lowest rounded-3xl p-12 text-center text-on-surface-variant">
          {t('common.loading')}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-8 space-y-6">
            <div className="flex gap-2 bg-surface-container-lowest p-1.5 rounded-2xl w-fit shadow-sm border border-outline-variant/10">
              {TABS.map((tab) => (
                <button
                  key={tab}
                  data-testid={`settings-tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all ${
                    activeTab === tab
                      ? 'bg-primary text-on-primary shadow-md'
                      : 'text-on-surface-variant hover:bg-surface-container-high'
                  }`}
                >
                  {t(
                    tab === 'privacy'
                      ? 'settings.tab_privacy'
                      : tab === 'cancellation'
                        ? 'settings.tab_cancellation'
                        : 'settings.tab_faq'
                  )}
                </button>
              ))}
            </div>

            {activeTab === 'faq'
              ? faq && (
                  <FaqEditor
                    key="faq"
                    faq={faq}
                    isSaving={isBusy('settings-save-faq')}
                    onSave={(groups) => void handleSaveFaq(groups)}
                  />
                )
              : activePolicy && (
                  <PolicyEditor
                    key={activeTab}
                    policy={activePolicy}
                    isSaving={isBusy(`settings-save-${activeTab}`)}
                    onSave={(label, sections) => void handleSavePolicy(label, sections)}
                  />
                )}
          </div>

          <div className="lg:col-span-4 sticky top-24">
            <div className="bg-surface-container-lowest rounded-3xl p-8 shadow-sm space-y-5 border-t-4 border-secondary border-x border-b border-outline-variant/10">
              <div className="flex items-center justify-between">
                <h4 className="font-bold text-lg text-primary">{t('settings.contact_title')}</h4>
                <span className="material-symbols-outlined text-secondary">contact_mail</span>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.company_label')}
                  </label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setContactForm({ ...form, company: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.app_name_label')}
                  </label>
                  <input
                    type="text"
                    value={form.appName}
                    onChange={(e) => setContactForm({ ...form, appName: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.contact_email_label')}
                  </label>
                  <input
                    type="email"
                    value={form.contactEmail}
                    onChange={(e) => setContactForm({ ...form, contactEmail: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.contact_phone_label')}
                  </label>
                  <input
                    type="text"
                    value={form.contactPhone}
                    onChange={(e) => setContactForm({ ...form, contactPhone: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.contact_address_label')}
                  </label>
                  <input
                    type="text"
                    value={form.contactAddress}
                    onChange={(e) => setContactForm({ ...form, contactAddress: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-on-surface-variant uppercase tracking-wider mb-1 block">
                    {t('settings.consent_label_label')}
                  </label>
                  <input
                    type="text"
                    value={form.consentLabel}
                    onChange={(e) => setContactForm({ ...form, consentLabel: e.target.value })}
                    className="w-full bg-surface-container-low border-none rounded-xl text-sm px-4 py-2.5 focus:ring-2 focus:ring-secondary/30"
                  />
                </div>
              </div>

              <button
                data-testid="settings-save-contact"
                onClick={() => void handleSaveContact()}
                disabled={!canManage || isBusy('settings-save-contact')}
                className="w-full bg-secondary text-on-secondary py-3 rounded-xl font-bold hover:opacity-90 transition-all text-sm shadow-md disabled:opacity-50"
              >
                {isBusy('settings-save-contact') ? t('common.loading') : t('settings.save_contact')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;
