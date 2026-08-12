import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Avatar from '../../shared/components/Avatar';
import { VERIFICATION_DOCUMENT_TYPES } from '../api/verificationsApi';
import type { VerificationDocumentType } from '../api/verificationsApi';
import type { VerificationRequest } from '../hooks/useVerifications';

interface VerificationDocumentsProps {
  request: VerificationRequest | null;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const documentIcons: Record<VerificationDocumentType, string> = {
  face_id: 'badge',
  back_id: 'id_card',
  license: 'directions_car',
  mechanic_card: 'build',
};

const typeOrder = (type: VerificationDocumentType): number => {
  const index = VERIFICATION_DOCUMENT_TYPES.indexOf(type);
  return index === -1 ? VERIFICATION_DOCUMENT_TYPES.length : index;
};

export const VerificationDocuments: React.FC<VerificationDocumentsProps> = ({
  request,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}) => {
  const { t } = useTranslation();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  /**
   * The *URLs* that failed to load, not a boolean — selecting a different
   * request re-attempts its own documents with no reset effect needed.
   *
   * This is the normal case on the current seed, not an edge case: every
   * `/storage/...` URL the API builds 404s because no files were written and
   * `storage:link` was never run (BUG-7). A broken document must say so, not
   * render the browser's broken-image glyph inside a review tool.
   */
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const markFailed = (url: string) =>
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));

  if (!request) {
    return (
      <div
        data-testid="verification-select-hint"
        className="lg:col-span-7 flex items-center justify-center p-12 text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/10 min-h-[320px]"
      >
        {t('verifications.select_hint')}
      </div>
    );
  }

  const isBusy = isApproving || isRejecting;
  const documents = [...request.documents].sort((a, b) => typeOrder(a.type) - typeOrder(b.type));
  const previewFailed = previewUrl !== null && failedUrls.includes(previewUrl);

  return (
    <div className="lg:col-span-7 space-y-6 sticky top-24">
      <div
        data-testid="verification-detail"
        className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden"
      >
        {/* Header */}
        <div className="p-6 bg-primary text-on-primary">
          <div className="flex justify-between items-start gap-4">
            <div className="flex items-center gap-3">
              <Avatar name={request.name} photo={request.photo} size="md" />
              <div className="text-start">
                <p className="font-bold text-sm">{request.name}</p>
                <p className="text-xs opacity-80">{request.email}</p>
              </div>
            </div>
            <span className="bg-white/20 text-[10px] px-3 py-1 rounded-full font-bold shrink-0">
              {t(`verifications.type_${request.type}`)}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-1 mt-4 text-[11px] opacity-80 text-start">
            <span>{t('verifications.submitted_at', { date: request.submittedLabel })}</span>
            {request.gender && (
              <span>
                {t('verifications.gender_label')}: {t(`verifications.gender_${request.gender}`, request.gender)}
              </span>
            )}
            {request.address && (
              <span>
                {t('verifications.address_label')}: {request.address}
              </span>
            )}
          </div>
        </div>

        {/* Documents grid */}
        <div className="p-6">
          <h5 className="text-xs font-bold text-primary mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">folder_open</span>
            {t('verifications.documents_title', { count: documents.length })}
          </h5>

          {documents.length === 0 ? (
            <p
              data-testid="verification-no-documents"
              className="text-sm text-on-surface-variant py-8 text-center"
            >
              {t('verifications.no_documents')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {documents.map((doc) => {
                const label = t(`common.documents.${doc.type}`);
                const failed = failedUrls.includes(doc.url);
                return (
                  <div
                    key={doc.type}
                    data-testid={`verification-doc-${doc.type}`}
                    className="rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-low group"
                  >
                    <button
                      onClick={() => setPreviewUrl(doc.url)}
                      disabled={failed}
                      aria-label={label}
                      className="relative w-full h-40 overflow-hidden block disabled:cursor-default"
                    >
                      {failed ? (
                        <span
                          data-testid={`verification-doc-failed-${doc.type}`}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-container-high text-on-surface-variant px-4 text-center"
                        >
                          <span className="material-symbols-outlined text-3xl">broken_image</span>
                          <span className="text-[11px] font-bold leading-tight">
                            {t('verifications.preview_unavailable')}
                          </span>
                        </span>
                      ) : (
                        <>
                          <img
                            src={doc.url}
                            alt={label}
                            onError={() => markFailed(doc.url)}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                            loading="lazy"
                          />
                          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="material-symbols-outlined text-white text-3xl">
                              zoom_in
                            </span>
                          </span>
                        </>
                      )}
                    </button>
                    <div className="flex items-center justify-between px-4 py-3 gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="material-symbols-outlined text-secondary text-lg shrink-0">
                          {documentIcons[doc.type] ?? 'description'}
                        </span>
                        <span className="text-xs font-bold truncate">{label}</span>
                      </div>
                      {/* Still offered when the inline preview failed: the URL is
                          what the backend stored, and opening it directly is how
                          a reviewer confirms the file is genuinely missing. */}
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-secondary font-bold hover:underline shrink-0"
                      >
                        {t('verifications.open_document')}
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            data-testid="verification-approve"
            onClick={onApprove}
            disabled={isBusy}
            className="flex-1 bg-secondary text-on-secondary text-sm font-bold py-3.5 rounded-xl hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            {isApproving ? t('common.loading') : t('verifications.approve')}
          </button>
          <button
            data-testid="verification-reject"
            onClick={onReject}
            disabled={isBusy}
            className="flex-1 bg-error-container text-on-error-container text-sm font-bold py-3.5 rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">cancel</span>
            {isRejecting ? t('common.loading') : t('verifications.reject')}
          </button>
        </div>
      </div>

      {/* Fullscreen preview */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
          onClick={() => setPreviewUrl(null)}
        >
          {previewFailed ? (
            <div className="flex flex-col items-center gap-3 text-white">
              <span className="material-symbols-outlined text-5xl">broken_image</span>
              <p className="text-sm font-bold">{t('verifications.preview_unavailable')}</p>
            </div>
          ) : (
            <img
              src={previewUrl}
              alt={t('verifications.document_preview')}
              onError={() => markFailed(previewUrl)}
              className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
            />
          )}
          <button
            onClick={() => setPreviewUrl(null)}
            aria-label={t('common.cancel')}
            className="absolute top-6 end-6 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
