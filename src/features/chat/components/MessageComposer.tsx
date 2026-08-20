import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { extractApiError } from '../../../services/apiError';
import { MESSAGE_MAX_LENGTH } from '../api/chatApi';

interface MessageComposerProps {
  onSend: (message: string) => Promise<void>;
  disabled?: boolean;
}

/**
 * The reply box.
 *
 * Errors are shown INLINE rather than through the page's `ActionBanner`: a
 * failed send is about the text still sitting in this field, and the agent
 * needs it next to the field they will retry from. The text is deliberately
 * kept on failure and only cleared once the API has confirmed the send.
 *
 * `maxLength` mirrors `message => required|string|max:5000` so the 422 is
 * usually unreachable, but the server's message is still surfaced if it fires.
 */
export const MessageComposer: React.FC<MessageComposerProps> = ({ onSend, disabled = false }) => {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !isSending && !disabled;

  // `SyntheticEvent`, not `FormEvent`: this is both the form's submit handler
  // and the Enter-key handler on the textarea.
  const handleSubmit = async (event: React.SyntheticEvent) => {
    event.preventDefault();
    if (!canSend) {
      return;
    }
    setIsSending(true);
    setError(null);
    try {
      await onSend(trimmed);
      setValue('');
    } catch (err) {
      setError(extractApiError(err, t('chat.send_failed')));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t border-outline-variant bg-surface-container-lowest p-4 space-y-2"
    >
      {error && (
        <p data-testid="chat-send-error" className="text-xs font-medium text-error px-1 text-start">
          {error}
        </p>
      )}
      <div className="flex items-end gap-3">
        <textarea
          rows={1}
          value={value}
          disabled={disabled}
          maxLength={MESSAGE_MAX_LENGTH}
          data-testid="chat-composer-input"
          aria-label={t('chat.composer_placeholder')}
          placeholder={t('chat.composer_placeholder')}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            // Enter sends, Shift+Enter breaks the line — the convention every
            // chat client shares, and the reason this is a textarea at all.
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit(event);
            }
          }}
          className="flex-1 resize-none bg-surface rounded-2xl px-4 py-3 text-sm outline-none ring-1 ring-outline-variant/30 focus:ring-secondary max-h-32 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!canSend}
          data-testid="chat-send"
          aria-label={t('chat.send')}
          className="w-12 h-12 shrink-0 flex items-center justify-center rounded-full bg-primary text-white disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          <span className={`material-symbols-outlined ${isSending ? 'animate-pulse' : ''}`}>
            {isSending ? 'more_horiz' : 'send'}
          </span>
        </button>
      </div>
      {value.length > MESSAGE_MAX_LENGTH - 200 && (
        <p className="text-[10px] text-on-surface-variant text-end px-1" dir="ltr">
          {value.length} / {MESSAGE_MAX_LENGTH}
        </p>
      )}
    </form>
  );
};

export default MessageComposer;
