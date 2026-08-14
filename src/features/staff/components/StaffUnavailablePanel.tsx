import React from 'react';
import { useTranslation } from 'react-i18next';

interface StaffUnavailablePanelProps {
  /** The real message from the failed `GET /employees`, not a canned string. */
  message: string | null;
  onRetry: () => void;
}

/**
 * Rendered instead of the staff table — and instead of every write control —
 * whenever `GET /employees` fails. An empty table would read as "this
 * platform has no staff" when the directory just couldn't be loaded; this
 * shows the server's own error and offers a retry instead.
 */
export const StaffUnavailablePanel: React.FC<StaffUnavailablePanelProps> = ({
  message,
  onRetry,
}) => {
  const { t } = useTranslation();

  return (
    <div
      data-testid="staff-unavailable"
      className="bg-error-container text-on-error-container rounded-3xl p-8 space-y-5"
    >
      <div className="flex items-start gap-4">
        <span className="material-symbols-outlined text-3xl">report</span>
        <div className="space-y-2">
          <h3 className="text-xl font-extrabold font-headline">{t('staff.unavailable_title')}</h3>
          <p className="text-sm leading-relaxed">{t('staff.unavailable_body')}</p>
          <p className="text-sm font-bold leading-relaxed">{t('staff.unavailable_actions')}</p>
        </div>
      </div>

      {message && (
        <div className="bg-surface-container-lowest text-on-surface rounded-2xl p-4">
          <p className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant mb-1">
            {t('staff.unavailable_server_error')}
          </p>
          <p data-testid="staff-unavailable-message" className="text-sm ltr:font-mono break-words">
            {message}
          </p>
        </div>
      )}

      <button
        data-testid="staff-unavailable-retry"
        onClick={onRetry}
        className="flex items-center gap-2 bg-error text-on-error text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-all"
      >
        <span className="material-symbols-outlined text-sm">refresh</span>
        {t('common.retry')}
      </button>
    </div>
  );
};
