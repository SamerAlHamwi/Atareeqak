import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ImageOff, Image as ImageIcon } from 'lucide-react';
import Avatar from '../../shared/components/Avatar';
import type { ChatMessage } from '../hooks/useChat';

interface MessageBubbleProps {
  message: ChatMessage;
  /**
   * False for a message that continues a run from the same side, which hides
   * the repeated avatar and name. A support thread is mostly alternating runs
   * of several messages, and repeating "You · avatar" on each of them turns a
   * transcript into a column of labels.
   */
  showSender?: boolean;
  /** Opens the full-size viewer. Only ever called for a media message that loaded. */
  onOpenImage: (message: ChatMessage) => void;
}

const formatBytes = (bytes: number | null): string | null => {
  if (bytes === null || bytes <= 0) {
    return null;
  }
  const units = ['B', 'KB', 'MB'];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? Math.round(value) : value.toFixed(1)} ${units[unit]}`;
};

/**
 * One message.
 *
 * Agent messages sit on the end side and carry the filled tint; customer
 * messages sit on the start side. Which is which is decided in `useChat` —
 * `sender.id` alone cannot answer it, because the payload never names the agent
 * (BUG-14).
 *
 * Media is the interesting half. An `image` message's `content` is a
 * `/storage/...` URL built by `FileUploadService::url()` from a path, with no
 * check that the file is actually there. With `FILESYSTEM_DISK=local` and no
 * `storage:link` — the state of this backend — **every one of those URLs 404s**.
 * That is the same BUG-7 condition the verification documents and complaint
 * attachments hit, so failure is treated as the normal case: a labelled
 * "unavailable" panel that still names the file and still offers the raw link,
 * because opening it directly is how an agent confirms a file is genuinely gone
 * rather than merely slow.
 */
export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  showSender = true,
  onOpenImage,
}) => {
  const { t } = useTranslation();
  // The URL that failed, not a boolean: React recycling this row for a
  // different message gets a fresh attempt with no reset effect.
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  const { fromAgent } = message;
  const hasFailed = !!message.imageUrl && failedUrl === message.imageUrl;
  const size = formatBytes(message.image?.size ?? null);

  return (
    <div
      data-testid="chat-message"
      data-from-agent={fromAgent}
      className={`flex items-end gap-2 ${fromAgent ? 'flex-row-reverse' : 'flex-row'}`}
    >
      {showSender ? (
        <Avatar name={message.senderName} photo={message.senderPhoto} size="xs" />
      ) : (
        // Holds the bubbles in the same column as the run's first message.
        <div className="w-8 shrink-0" aria-hidden="true" />
      )}

      <div className={`max-w-[80%] sm:max-w-[70%] ${fromAgent ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {showSender && (
          <span className="text-[10px] font-bold text-on-surface-variant px-1">
            {fromAgent ? t('chat.you') : message.senderName}
          </span>
        )}

        <div
          className={`rounded-2xl overflow-hidden ${
            fromAgent
              ? 'bg-primary-fixed text-on-primary-fixed-variant rounded-ee-sm'
              : 'bg-surface-container-high text-on-surface rounded-es-sm'
          }`}
        >
          {message.isImage && message.imageUrl && !hasFailed && (
            <button
              type="button"
              data-testid="chat-message-image"
              onClick={() => onOpenImage(message)}
              className="block w-full"
              aria-label={message.image?.original_name ?? t('chat.image_open')}
            >
              <img
                src={message.imageUrl}
                alt={message.image?.original_name ?? t('chat.image_attachment')}
                onError={() => setFailedUrl(message.imageUrl)}
                className="w-full max-h-64 object-cover bg-surface-container-highest"
              />
            </button>
          )}

          {message.isImage && hasFailed && (
            <div
              data-testid="chat-image-unavailable"
              className="flex flex-col items-center justify-center gap-1 py-6 px-6 bg-surface-container-highest text-center"
            >
              <ImageOff className="text-on-surface-variant" />
              <p className="text-[11px] font-bold text-on-surface-variant">
                {t('chat.image_unavailable')}
              </p>
              <a
                href={message.imageUrl ?? undefined}
                target="_blank"
                rel="noreferrer"
                data-testid="chat-image-link"
                className="text-[11px] font-bold text-secondary hover:underline"
              >
                {t('chat.image_open')}
              </a>
            </div>
          )}

          {message.isImage && (message.image?.original_name || size) && (
            <div
              className={`flex items-center gap-2 px-3 py-2 text-[10px] ${
                fromAgent ? 'text-on-primary-fixed-variant/80' : 'text-on-surface-variant'
              }`}
            >
              <ImageIcon size={16} className="shrink-0" />
              <span className="truncate">{message.image?.original_name}</span>
              {size && <span className="shrink-0">· {size}</span>}
            </div>
          )}

          {message.text && (
            <p className="px-4 py-2.5 text-sm whitespace-pre-wrap break-words text-start">
              {message.text}
            </p>
          )}

          {/* An image with no caption would otherwise have no timestamp row. */}
          <div
            className={`flex items-center gap-1.5 px-4 pb-2 ${
              message.text ? '' : 'pt-2'
            } ${fromAgent ? 'justify-end' : 'justify-start'}`}
          >
            <span
              className={`text-[10px] ${
                fromAgent ? 'text-on-primary-fixed-variant/70' : 'text-on-surface-variant'
              }`}
            >
              {message.time}
            </span>
            {message.isEdited && (
              <span
                className={`text-[10px] italic ${
                  fromAgent ? 'text-on-primary-fixed-variant/70' : 'text-on-surface-variant'
                }`}
              >
                {t('chat.edited')}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
