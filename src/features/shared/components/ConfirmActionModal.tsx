import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';

export interface ConfirmActionPayload {
  reason: string;
  banType?: 'permanent' | 'temporary';
  expiresAt?: string;
}

interface ConfirmActionModalProps {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel: string;
  /** Adds the ban-type selector (permanent/temporary) + expiry date picker. */
  showBanOptions?: boolean;
  isBusy?: boolean;
  /** Backend validators require min 10 chars for ban/cancel/escalate reasons. */
  minReasonLength?: number;
  onConfirm: (payload: ConfirmActionPayload) => void | Promise<void>;
  onClose: () => void;
}

type ModalFormProps = Omit<ConfirmActionModalProps, 'open'>;

// Mounted fresh every time the modal opens, so field state resets naturally.
const ModalForm: React.FC<ModalFormProps> = ({
  title,
  description,
  confirmLabel,
  showBanOptions = false,
  isBusy = false,
  minReasonLength = 10,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [banType, setBanType] = useState<'permanent' | 'temporary'>('permanent');
  const [expiresAt, setExpiresAt] = useState('');
  const [validationError, setValidationError] = useState('');
  const [minExpiryDate] = useState(() =>
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  const handleConfirm = async () => {
    const trimmedReason = reason.trim();
    if (trimmedReason.length < minReasonLength) {
      setValidationError(t('modal.reason_too_short', { count: minReasonLength }));
      return;
    }
    if (showBanOptions && banType === 'temporary' && !expiresAt) {
      setValidationError(t('modal.expiry_required'));
      return;
    }
    setValidationError('');
    await onConfirm({
      reason: trimmedReason,
      ...(showBanOptions
        ? {
            banType,
            // Backend expects "Y-m-d H:i:s" after now for temporary bans
            expiresAt: banType === 'temporary' ? `${expiresAt} 00:00:00` : undefined,
          }
        : {}),
    });
  };

  return (
    <>
      <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]" onClick={isBusy ? undefined : onClose} />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl p-8 space-y-6 pointer-events-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold font-headline text-primary">{title}</h3>
              {description && <p className="text-sm text-on-surface-variant">{description}</p>}
            </div>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-40"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          {validationError && (
            <div className="bg-error-container text-on-error-container text-sm px-4 py-3 rounded-xl">
              {validationError}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                {t('modal.reason_label')}
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                placeholder={t('modal.reason_placeholder', { count: minReasonLength })}
              />
            </div>

            {showBanOptions && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                    {t('modal.ban_type_label')}
                  </label>
                  <select
                    value={banType}
                    onChange={(e) => setBanType(e.target.value as 'permanent' | 'temporary')}
                    className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
                  >
                    <option value="permanent">{t('modal.ban_permanent')}</option>
                    <option value="temporary">{t('modal.ban_temporary')}</option>
                  </select>
                </div>
                {banType === 'temporary' && (
                  <div>
                    <label className="text-xs font-bold text-on-surface-variant uppercase tracking-wider mb-2 block">
                      {t('modal.ban_expiry_label')}
                    </label>
                    <input
                      type="date"
                      value={expiresAt}
                      min={minExpiryDate}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="w-full bg-surface-container-low border-none rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => void handleConfirm()}
              disabled={isBusy}
              className="flex-1 bg-error text-on-error py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isBusy ? t('common.loading') : confirmLabel}
            </button>
            <button
              onClick={onClose}
              disabled={isBusy}
              className="px-6 py-3 bg-surface-container-high text-on-surface rounded-2xl font-bold text-sm hover:bg-surface-container-highest transition-all disabled:opacity-50"
            >
              {t('common.cancel')}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

/**
 * Confirmation dialog for destructive actions (ban, trip cancel, escalate).
 * Collects a real reason — and for bans, type + expiry — instead of the
 * hardcoded defaults previously sent to the backend.
 */
const ConfirmActionModal: React.FC<ConfirmActionModalProps> = ({ open, ...formProps }) => {
  if (!open) {
    return null;
  }
  return <ModalForm {...formProps} />;
};

export default ConfirmActionModal;
