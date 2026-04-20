import React from 'react';
import { useTranslation } from 'react-i18next';
import type { MockFeedback } from '../useMockAction';

interface ActionBannerProps {
  feedback: MockFeedback | null;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  variant?: 'default' | 'compact';
  showDismiss?: boolean;
}

const defaultToneClasses: Record<MockFeedback['tone'], string> = {
  success: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  error: 'bg-red-50 text-red-700 border-red-200',
  info: 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

const compactToneClasses: Record<MockFeedback['tone'], string> = {
  success: 'bg-secondary-container/20 text-secondary',
  error: 'bg-error-container text-error',
  info: 'bg-surface-container-high text-on-surface',
};

const ActionBanner: React.FC<ActionBannerProps> = ({
  feedback,
  onDismiss,
  dismissLabel,
  className = '',
  variant = 'default',
  showDismiss = true,
}) => {
  const { t } = useTranslation();

  if (!feedback) {
    return null;
  }

  const resolvedDismissLabel = dismissLabel ?? t('common.dismiss');

  const toneClasses = variant === 'compact' ? compactToneClasses : defaultToneClasses;
  const baseClasses = variant === 'compact'
    ? 'text-sm p-4 rounded-xl font-medium'
    : 'rounded-xl px-4 py-3 text-sm font-semibold border';

  return (
    <div className={`${baseClasses} ${toneClasses[feedback.tone]} ${className}`.trim()}>
      <div className="flex items-center justify-between gap-3">
        <span>{feedback.message}</span>
        {showDismiss && onDismiss && (
          <button type="button" onClick={onDismiss} className="text-xs underline underline-offset-2">
            {resolvedDismissLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionBanner;

