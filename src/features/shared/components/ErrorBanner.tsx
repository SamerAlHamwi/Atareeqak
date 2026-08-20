import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorBannerProps {
  message?: string;
  onRetry?: () => void;
}

/** Error banner with an inline retry button so users don't have to refresh the page. */
const ErrorBanner: React.FC<ErrorBannerProps> = ({ message, onRetry }) => {
  const { t } = useTranslation();

  return (
    <div className="bg-error-container text-on-error-container px-6 py-4 rounded-2xl flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <AlertCircle size={20} />
        <span className="text-sm font-medium">{message || t('common.load_failed')}</span>
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 bg-error text-on-error text-xs font-bold px-4 py-2 rounded-full hover:opacity-90 transition-all"
        >
          <RefreshCw size={16} />
          {t('common.retry')}
        </button>
      )}
    </div>
  );
};

export default ErrorBanner;
