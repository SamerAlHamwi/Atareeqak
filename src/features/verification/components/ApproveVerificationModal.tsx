import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { X } from 'lucide-react';
import type { VerificationDocument } from '../api/verificationsApi';

interface ApproveVerificationModalProps {
  open: boolean;
  userName: string;
  /** Documents on the request — used to tell the reviewer where to read the ID. */
  documents: VerificationDocument[];
  isBusy?: boolean;
  onConfirm: (nationalId: string) => void | Promise<void>;
  onClose: () => void;
}

/** National ID must be exactly 10 digits per Syrian national ID format. */
const NATIONAL_ID_LENGTH = 10;

type FormProps = Omit<ApproveVerificationModalProps, 'open'>;

// Mounted fresh on every open so the field resets naturally.
const ApproveForm: React.FC<FormProps> = ({
  userName,
  documents,
  isBusy = false,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const [nationalId, setNationalId] = useState('');
  const [validationError, setValidationError] = useState('');

  const trimmed = nationalId.trim();

  // The pending payload carries document *images* only — no national ID value
  // exists anywhere in it (the column is written by this very endpoint), so the
  // field cannot be pre-filled. Point the reviewer at the ID scans instead.
  const idDocuments = documents.filter((doc) => doc.type === 'face_id' || doc.type === 'back_id');

  const handleConfirm = async () => {
    if (!trimmed) {
      setValidationError(t('verifications.national_id_required'));
      return;
    }
    if (!/^\d{10}$/.test(trimmed)) {
      setValidationError(t('verifications.national_id_digits'));
      return;
    }
    setValidationError('');
    await onConfirm(trimmed);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[80]"
        onClick={isBusy ? undefined : onClose}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-6 pointer-events-none">
        <div className="w-full max-w-md bg-surface-container-lowest rounded-3xl shadow-2xl p-8 space-y-6 pointer-events-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xl font-extrabold font-headline text-primary">
                {t('verifications.approve_title')}
              </h3>
              <p className="text-sm text-on-surface-variant">
                {t('verifications.approve_description', { name: userName })}
              </p>
            </div>
            <button
              onClick={onClose}
              disabled={isBusy}
              aria-label={t('common.cancel')}
              className="p-2 hover:bg-surface-container-high rounded-full transition-colors disabled:opacity-40"
            >
              <X size={24} />
            </button>
          </div>

          {validationError && (
            <div className="bg-error-container text-on-error-container text-sm px-4 py-3 rounded-xl">
              {validationError}
            </div>
          )}

          <div className="space-y-3">
            <label
              htmlFor="approve-national-id"
              className="text-xs font-bold text-on-surface-variant uppercase tracking-wider block"
            >
              {t('verifications.national_id_label')}
            </label>
            <input
              id="approve-national-id"
              data-testid="approve-national-id"
              value={nationalId}
              onChange={(e) => {
                const val = e.target.value;
                setNationalId(val);
                if (validationError) {
                  if (!val.trim()) {
                    setValidationError(t('verifications.national_id_required'));
                  } else if (!/^\d{10}$/.test(val.trim())) {
                    setValidationError(t('verifications.national_id_digits'));
                  } else {
                    setValidationError('');
                  }
                }
              }}
              maxLength={NATIONAL_ID_LENGTH}
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              className="w-full bg-surface-container-low border border-outline-variant rounded-2xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              placeholder={t('verifications.national_id_placeholder')}
            />
            <p className="text-xs text-on-surface-variant leading-relaxed">
              {idDocuments.length > 0
                ? t('verifications.national_id_hint', {
                    documents: idDocuments
                      .map((doc) => t(`common.documents.${doc.type}`))
                      .join('، '),
                  })
                : t('verifications.national_id_hint_no_documents')}
            </p>
            <p className="text-xs text-on-surface-variant">
              {t('verifications.national_id_unique_note')}
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              data-testid="approve-confirm"
              onClick={() => void handleConfirm()}
              disabled={isBusy}
              className="flex-1 bg-secondary text-on-secondary py-3 rounded-2xl font-bold text-sm hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isBusy ? t('common.loading') : t('verifications.approve_confirm')}
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
 * Approval dialog collecting the `national_id` the backend requires.
 *
 * Not `ConfirmActionModal`: that component collects a free-text *reason* with a
 * minimum length, which is the wrong control for a unique identifier that is
 * validated, stored on the user row and can collide with another account.
 */
const ApproveVerificationModal: React.FC<ApproveVerificationModalProps> = ({
  open,
  ...formProps
}) => {
  if (!open) {
    return null;
  }
  return <ApproveForm {...formProps} />;
};

export default ApproveVerificationModal;
