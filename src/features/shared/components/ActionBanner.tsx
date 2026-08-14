import React from 'react';
import { useTranslation } from 'react-i18next';
import type { ActionFeedback } from '../useApiAction';

interface ActionBannerProps {
  feedback: ActionFeedback | null;
  onDismiss?: () => void;
  dismissLabel?: string;
  className?: string;
  variant?: 'default' | 'compact';
  showDismiss?: boolean;
}

const defaultToneClasses: Record<ActionFeedback['tone'], string> = {
  success: 'bg-tertiary-fixed text-on-tertiary-fixed-variant border-tertiary-fixed-dim',
  error: 'bg-error-container text-on-error-container border-error/30',
  info: 'bg-primary-fixed text-on-primary-fixed-variant border-primary-fixed-dim',
};

const compactToneClasses: Record<ActionFeedback['tone'], string> = {
  success: 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant',
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
    <div
      data-testid="action-banner"
      className={`${baseClasses} ${toneClasses[feedback.tone]} ${className}`.trim()}
    >
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

