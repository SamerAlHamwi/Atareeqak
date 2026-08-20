import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface PlatformSettingsEditorProps {
  value: number;
  isSaving: boolean;
  onSave: (value: number) => void;
}

/**
 * Edits the platform's profit percentage from trips. Kept remounted per tab
 * (`key="platform"` at the call site) so switching tabs or a successful save
 * always starts from the latest server state rather than carrying stale
 * local edits across.
 */
export const PlatformSettingsEditor: React.FC<PlatformSettingsEditorProps> = ({ value, isSaving, onSave }) => {
  const { t } = useTranslation();
  const [percentage, setPercentage] = useState(value);

  const isValid = Number.isFinite(percentage) && percentage >= 0 && percentage <= 100;

  return (
    <div className="space-y-6">
      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant space-y-2">
        <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
          {t('settings.platform_profit_percentage_label')}
        </label>
        <div className="relative max-w-xs">
          <input
            data-testid="platform-profit-percentage"
            type="number"
            min={0}
            max={100}
            step={0.01}
            value={percentage}
            onChange={(e) => setPercentage(e.target.valueAsNumber)}
            dir="ltr"
            className="w-full bg-surface-container-low border border-outline-variant rounded-xl text-sm px-4 py-3 pe-10 focus:ring-2 focus:ring-primary/30"
          />
          <span className="absolute inset-y-0 end-4 flex items-center text-on-surface-variant text-sm">%</span>
        </div>
        <p className="text-xs text-on-surface-variant">{t('settings.platform_profit_percentage_hint')}</p>
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          data-testid="platform-settings-save"
          onClick={() => onSave(percentage)}
          disabled={!isValid || isSaving}
          className="bg-primary text-on-primary py-3 px-8 rounded-xl font-bold hover:opacity-90 transition-all active:scale-95 text-sm shadow-md disabled:opacity-50"
        >
          {isSaving ? t('common.loading') : t('settings.save_platform_settings')}
        </button>
      </div>
    </div>
  );
};
