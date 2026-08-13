import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { ComplaintAttachmentResponse } from '../api/supportApi';

interface ComplaintAttachmentsProps {
  attachments: ComplaintAttachmentResponse[];
}

const formatIcon = (mimeType: string): string => {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType === 'application/pdf') return 'picture_as_pdf';
  if (mimeType.startsWith('video/')) return 'movie';
  if (mimeType.startsWith('audio/')) return 'graphic_eq';
  return 'draft';
};

/**
 * Evidence attached to a complaint.
 *
 * `ComplaintResponse.attachments` was typed since Phase 0 but had never been
 * rendered or verified — `complaint_attachments` is empty in the seed, so Phase 7
 * seeded two rows (one `image/jpeg`, one `application/pdf`) to exercise both
 * branches for real.
 *
 * Images render inline; every other MIME type renders as a download link, since
 * the payload gives us a URL, an original filename and a MIME type and nothing
 * else to preview with.
 *
 * BUG-7 makes failure the NORMAL case here, exactly as it is for verification
 * documents: the API builds `/storage/...` URLs for files that were never
 * written and with no `storage:link`, so they 404 (and Chromium reports it as
 * `ERR_BLOCKED_BY_ORB` on `requestfailed`, not as a response). A failed image
 * therefore flips to a labelled "unavailable" panel rather than showing the
 * browser's broken-image glyph inside a moderation tool — while still offering
 * the raw link, because opening it directly is how a reviewer confirms the file
 * is genuinely missing rather than merely slow.
 */
export const ComplaintAttachments: React.FC<ComplaintAttachmentsProps> = ({ attachments }) => {
  const { t } = useTranslation();
  // The URLs that failed, not a boolean — switching complaints re-attempts each
  // new attachment without needing a reset effect.
  const [failedUrls, setFailedUrls] = useState<string[]>([]);
  const markFailed = (url: string) =>
    setFailedUrls((prev) => (prev.includes(url) ? prev : [...prev, url]));

  if (attachments.length === 0) {
    return (
      <div>
        <h5 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">attach_file</span>
          {t('support.attachments_title', { count: 0 })}
        </h5>
        <p
          data-testid="complaint-no-attachments"
          className="text-xs text-on-surface-variant bg-surface-container-low rounded-lg p-3 text-start"
        >
          {t('support.no_attachments')}
        </p>
      </div>
    );
  }

  return (
    <div>
      <h5 className="text-xs font-bold text-primary mb-2 flex items-center gap-2">
        <span className="material-symbols-outlined text-sm">attach_file</span>
        {t('support.attachments_title', { count: attachments.length })}
      </h5>
      <ul className="space-y-3" data-testid="complaint-attachments">
        {attachments.map((attachment) => {
          const isImage = attachment.mime_type.startsWith('image/');
          const hasFailed = failedUrls.includes(attachment.url);

          return (
            <li
              key={attachment.id}
              data-testid="complaint-attachment"
              className="bg-surface-container-low rounded-lg overflow-hidden border border-outline-variant/10"
            >
              {isImage && !hasFailed ? (
                <a href={attachment.url} target="_blank" rel="noreferrer" className="block">
                  <img
                    src={attachment.url}
                    alt={attachment.original_name}
                    onError={() => markFailed(attachment.url)}
                    className="w-full max-h-48 object-cover bg-surface-container-high"
                  />
                </a>
              ) : null}

              {isImage && hasFailed && (
                <div
                  data-testid="attachment-unavailable"
                  className="flex flex-col items-center justify-center gap-1 py-6 px-3 bg-surface-container-high text-center"
                >
                  <span className="material-symbols-outlined text-on-surface-variant">
                    broken_image
                  </span>
                  <p className="text-[11px] font-bold text-on-surface-variant">
                    {t('support.attachment_unavailable')}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between gap-3 p-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="material-symbols-outlined text-base text-on-surface-variant shrink-0">
                    {formatIcon(attachment.mime_type)}
                  </span>
                  <div className="min-w-0 text-start">
                    <p className="text-[11px] font-bold text-on-surface truncate">
                      {attachment.original_name}
                    </p>
                    <p className="text-[10px] text-on-surface-variant ltr:font-mono">
                      {attachment.mime_type}
                    </p>
                  </div>
                </div>
                <a
                  href={attachment.url}
                  target="_blank"
                  rel="noreferrer"
                  data-testid="attachment-link"
                  className="flex items-center gap-1 text-[11px] font-bold text-secondary hover:underline shrink-0"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  {t('support.attachment_open')}
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default ComplaintAttachments;
