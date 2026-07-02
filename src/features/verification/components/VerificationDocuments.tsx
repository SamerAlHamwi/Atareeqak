import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { VerificationRequest } from '../hooks/useVerifications';

interface VerificationDocumentsProps {
  request: VerificationRequest | null;
  onApprove: () => void;
  onReject: () => void;
  isApproving: boolean;
  isRejecting: boolean;
}

const documentIcons: Record<string, string> = {
  face_id: 'badge',
  back_id: 'id_card',
  license: 'directions_car',
  mechanic_card: 'build',
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

  if (!request) {
    return (
      <div className="lg:col-span-7 flex items-center justify-center p-12 text-on-surface-variant bg-surface-container-low rounded-xl border border-outline-variant/10 min-h-[320px]">
        {t('verifications.select_hint')}
      </div>
    );
  }

  const isBusy = isApproving || isRejecting;

  return (
    <div className="lg:col-span-7 space-y-6 sticky top-24">
      <div className="bg-surface-container-lowest rounded-xl shadow-lg border border-outline-variant/10 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-primary text-on-primary">
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center font-bold text-lg">
                {request.name.charAt(0)}
              </div>
              <div className="text-start">
                <p className="font-bold text-sm">{request.name}</p>
                <p className="text-xs opacity-80">{request.email}</p>
              </div>
            </div>
            <span className="bg-white/20 text-[10px] px-3 py-1 rounded-full text-white font-bold">
              {t(`verifications.type_${request.type}`)}
            </span>
          </div>
          <p className="text-[11px] opacity-70 mt-4 text-start">
            {t('verifications.submitted_at', { date: request.submittedDate })}
          </p>
        </div>

        {/* Documents grid */}
        <div className="p-6">
          <h5 className="text-xs font-bold text-indigo-900 mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">folder_open</span>
            {t('verifications.documents_title', { count: request.documents.length })}
          </h5>

          {request.documents.length === 0 ? (
            <p className="text-sm text-on-surface-variant py-8 text-center">
              {t('verifications.no_documents')}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {request.documents.map((doc) => (
                <div
                  key={doc.type}
                  className="rounded-2xl overflow-hidden border border-outline-variant/20 bg-surface-container-low group"
                >
                  <button
                    onClick={() => setPreviewUrl(doc.url)}
                    className="relative w-full h-40 overflow-hidden block"
                  >
                    <img
                      src={doc.url}
                      alt={t(`verifications.doc.${doc.type}`, doc.type)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      loading="lazy"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                    </div>
                  </button>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-secondary text-lg">
                        {documentIcons[doc.type] ?? 'description'}
                      </span>
                      <span className="text-xs font-bold">
                        {t(`verifications.doc.${doc.type}`, doc.type)}
                      </span>
                    </div>
                    <a
                      href={doc.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-secondary font-bold hover:underline"
                    >
                      {t('verifications.open_document')}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-6 pt-0 flex gap-3">
          <button
            onClick={onApprove}
            disabled={isBusy}
            className="flex-1 bg-secondary text-on-secondary text-sm font-bold py-3.5 rounded-xl hover:bg-secondary/90 transition-all flex items-center justify-center gap-2 shadow-sm shadow-secondary/20 disabled:opacity-50"
          >
            <span className="material-symbols-outlined text-lg">check_circle</span>
            {isApproving ? t('common.loading') : t('verifications.approve')}
          </button>
          <button
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
          <img
            src={previewUrl}
            alt={t('verifications.document_preview')}
            className="max-w-full max-h-full rounded-2xl shadow-2xl object-contain"
          />
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-6 end-6 w-12 h-12 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>
      )}
    </div>
  );
};
