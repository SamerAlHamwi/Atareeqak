import React from 'react';
import { useTranslation } from 'react-i18next';

interface ModerationRulesProps {
  moderationWords: string;
  setModerationWords: (val: string) => void;
}

export const ModerationRules: React.FC<ModerationRulesProps> = ({
  moderationWords,
  setModerationWords,
}) => {
  const { t } = useTranslation();

  return (
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
            <label className="text-sm font-semibold text-on-surface-variant">
              {t('settings.auto_block_threshold')}
            </label>
            <span className="text-error font-bold text-xs bg-error-container px-2 py-1 rounded">
              {t('settings.active')}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-surface-container-low p-4 rounded-xl border-r-4 border-error text-start">
              <p className="text-xs text-on-surface-variant mb-1">
                {t('settings.passenger_complaints')}
              </p>
              <div className="flex items-center gap-2">
                <input
                  className="w-16 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-start outline-none"
                  type="number"
                  defaultValue="3"
                />
                <span className="text-xs font-bold">{t('settings.complaints_per_month')}</span>
              </div>
            </div>
            <div className="bg-surface-container-low p-4 rounded-xl border-r-4 border-error text-start">
              <p className="text-xs text-on-surface-variant mb-1">
                {t('settings.trip_cancellations')}
              </p>
              <div className="flex items-center gap-2">
                <input
                  className="w-16 bg-transparent border-none p-0 text-xl font-bold focus:ring-0 text-start outline-none"
                  type="number"
                  defaultValue="15"
                />
                <span className="text-xs font-bold">{t('settings.max_percent')}</span>
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-semibold text-on-surface-variant block text-start">
            {t('settings.prohibited_words')}
          </label>
          <textarea
            className="w-full bg-surface-container-low border-none border-b-2 border-outline-variant/30 focus:border-secondary p-3 rounded-lg text-sm text-on-surface leading-relaxed text-start outline-none resize-none"
            placeholder={t('settings.words_placeholder')}
            rows={3}
            value={moderationWords}
            onChange={(e) => setModerationWords(e.target.value)}
          ></textarea>
          <p className="text-[10px] text-on-surface-variant italic text-start">
            {t('settings.words_desc')}
          </p>
        </div>
      </div>
    </section>
  );
};
