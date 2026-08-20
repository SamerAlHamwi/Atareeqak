import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, ExternalLink } from 'lucide-react';
import type { ChatMessage } from '../hooks/useChat';

interface ImageLightboxProps {
  message: ChatMessage | null;
  onClose: () => void;
}

/**
 * Full-size viewer for a chat image.
 *
 * The thumbnail in the thread is cropped to `object-cover`, which is fine for
 * scanning but useless for the thing an agent actually opens a support image
 * for — reading a receipt, a screenshot or a damage photo. This shows the whole
 * frame, plus the filename and MIME type, plus a link to the raw file.
 */
export const ImageLightbox: React.FC<ImageLightboxProps> = ({ message, onClose }) => {
  const { t } = useTranslation();

  useEffect(() => {
    if (!message) {
      return;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [message, onClose]);

  if (!message || !message.imageUrl) {
    return null;
  }

  const name = message.image?.original_name ?? t('chat.image_attachment');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={name}
      data-testid="chat-image-lightbox"
      onClick={onClose}
      className="fixed inset-0 z-[80] bg-primary-container/70 backdrop-blur-sm flex items-center justify-center p-6"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="bg-surface-container-lowest rounded-2xl overflow-hidden max-w-3xl w-full shadow-ambient"
      >
        <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-outline-variant">
          <div className="min-w-0 text-start">
            <p className="text-sm font-bold text-on-surface truncate">{name}</p>
            {message.image?.mime_type && (
              <p className="text-[11px] text-on-surface-variant ltr:font-mono" dir="ltr">
                {message.image.mime_type}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="chat-lightbox-close"
            aria-label={t('common.dismiss')}
            className="w-9 h-9 shrink-0 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant"
          >
            <X size={24} />
          </button>
        </div>

        <div className="bg-surface-container-high flex items-center justify-center max-h-[70vh] overflow-auto">
          <img src={message.imageUrl} alt={name} className="max-w-full max-h-[70vh] object-contain" />
        </div>

        <div className="px-5 py-3 flex items-center justify-between gap-4">
          {message.text ? (
            <p className="text-xs text-on-surface-variant text-start truncate">{message.text}</p>
          ) : (
            <span />
          )}
          <a
            href={message.imageUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-xs font-bold text-secondary hover:underline shrink-0"
          >
            <ExternalLink size={16} />
            {t('chat.image_open')}
          </a>
        </div>
      </div>
    </div>
  );
};

export default ImageLightbox;
