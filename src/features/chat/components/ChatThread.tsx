import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MessageCircle } from 'lucide-react';
import Avatar from '../../shared/components/Avatar';
import PageLoader from '../../shared/components/PageLoader';
import MessageBubble from './MessageBubble';
import MessageComposer from './MessageComposer';
import ImageLightbox from './ImageLightbox';
import type { ChatConversation, ChatMessage } from '../hooks/useChat';

interface ChatThreadProps {
  conversation: ChatConversation | null;
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  hasOlder: boolean;
  isLoadingOlder: boolean;
  onLoadOlder: () => void;
  onSend: (message: string) => Promise<void>;
}

const statusBadgeClasses: Record<string, string> = {
  active: 'bg-secondary/15 text-secondary',
  inactive: 'bg-surface-container-high text-on-surface-variant',
  banned: 'bg-error-container text-on-error-container',
};

/** Treat "within 80px of the bottom" as reading the live end of the thread. */
const NEAR_BOTTOM_PX = 80;

/**
 * The conversation itself: header, scrolling transcript, composer.
 *
 * Scrolling is the fiddly part, and it has three distinct jobs:
 *
 *   1. **Opening a conversation** lands at the newest message, because that is
 *      where a support thread is read from.
 *   2. **New messages** (a poll tick, or the agent's own send) scroll down ONLY
 *      when the agent was already at the bottom. Yanking the viewport while
 *      someone is reading back through a thread is the classic chat-UI sin.
 *   3. **Loading older messages** prepends content above the viewport, which
 *      would otherwise shove the reader down the page. The scroll offset is
 *      re-anchored from the recorded `scrollHeight` so the message they were
 *      looking at stays exactly where it was.
 */
export const ChatThread: React.FC<ChatThreadProps> = ({
  conversation,
  messages,
  isLoading,
  error,
  hasOlder,
  isLoadingOlder,
  onLoadOlder,
  onSend,
}) => {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [lightboxMessage, setLightboxMessage] = useState<ChatMessage | null>(null);

  const conversationId = conversation?.id ?? null;
  const newestId = messages.length > 0 ? messages[messages.length - 1].id : null;
  const oldestId = messages.length > 0 ? messages[0].id : null;

  /** Scroll height captured just before an older page is merged in (job 3). */
  const heightBeforePrependRef = useRef<number | null>(null);
  /** Whether the agent was at the live end when the last render committed (job 2). */
  const wasAtBottomRef = useRef(true);
  const lastConversationRef = useRef<number | null>(null);

  const handleScroll = useCallback(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }
    wasAtBottomRef.current =
      element.scrollHeight - element.scrollTop - element.clientHeight <= NEAR_BOTTOM_PX;
  }, []);

  const handleLoadOlder = useCallback(() => {
    heightBeforePrependRef.current = scrollRef.current?.scrollHeight ?? null;
    onLoadOlder();
  }, [onLoadOlder]);

  useLayoutEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    // Job 1 — a different conversation always opens at the bottom.
    if (lastConversationRef.current !== conversationId) {
      lastConversationRef.current = conversationId;
      wasAtBottomRef.current = true;
      element.scrollTop = element.scrollHeight;
      return;
    }

    // Job 3 — older messages were prepended; restore the reading position.
    const heightBefore = heightBeforePrependRef.current;
    if (heightBefore !== null) {
      heightBeforePrependRef.current = null;
      element.scrollTop += element.scrollHeight - heightBefore;
      return;
    }

    // Job 2 — new messages at the end, only followed if already there.
    if (wasAtBottomRef.current) {
      element.scrollTop = element.scrollHeight;
    }
  }, [conversationId, newestId, oldestId]);

  /**
   * The layout effect above runs before images have loaded, and an image
   * message changes the transcript's height when it resolves — including when
   * it FAILS and swaps to the taller "unavailable" panel, which is the normal
   * outcome here (BUG-7). Measured in a real browser, that left a thread
   * opening 113px short of the newest message.
   *
   * So the bottom is re-pinned whenever the content's height changes while the
   * agent is at the live end. It never fights job 3: a pending prepend owns the
   * scroll position for that render, and reaching the "load older" button at
   * the top requires scrolling away from the bottom first.
   */
  useEffect(() => {
    const element = scrollRef.current;
    const content = contentRef.current;
    if (!element || !content || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(() => {
      if (wasAtBottomRef.current && heightBeforePrependRef.current === null) {
        element.scrollTop = element.scrollHeight;
      }
    });
    observer.observe(content);
    return () => observer.disconnect();
    // Keyed on the selection, NOT `[]`: with nothing selected this component
    // returns the placeholder early and both refs are null, so a mount-only
    // effect would bail once and never attach the observer at all.
  }, [conversationId]);

  /**
   * The viewer is DERIVED from the thread rather than reset by an effect: an
   * image is only shown while its message is still in the messages we hold, so
   * switching conversations closes it on the same render the new thread arrives
   * on, with no cascading state write.
   */
  const openImage =
    lightboxMessage && messages.some((message) => message.id === lightboxMessage.id)
      ? lightboxMessage
      : null;

  if (!conversation) {
    return (
      <div
        data-testid="chat-no-selection"
        className="bg-surface-container-low rounded-xl shadow-sm min-h-[36rem] flex flex-col items-center justify-center gap-3 text-center px-8"
      >
        <div className="w-16 h-16 rounded-full bg-surface-container-high flex items-center justify-center text-on-surface-variant">
          <MessageCircle size={28} />
        </div>
        <h3 className="font-headline text-lg font-bold text-primary">{t('chat.select_title')}</h3>
        <p className="text-sm text-on-surface-variant max-w-xs">{t('chat.select_hint')}</p>
      </div>
    );
  }

  const { customer } = conversation;

  return (
    <div className="bg-surface-container-low rounded-xl shadow-sm flex flex-col min-h-[36rem] max-h-[44rem] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-surface-container-lowest border-b border-outline-variant">
        <Avatar name={customer.name} photo={customer.photo} size="md" />
        <div className="min-w-0 flex-1 text-start">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 data-testid="chat-thread-name" className="text-sm font-bold text-on-surface truncate">
              {customer.name}
            </h3>
            {customer.accountStatus && (
              <span
                data-testid="chat-thread-status"
                className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                  statusBadgeClasses[customer.accountStatus] ??
                  'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                {t(`chat.account_${customer.accountStatus}`)}
              </span>
            )}
          </div>
          {/*
            The subtitle carries whatever the title could not. An email when
            the API gave one; "unidentified" when nothing is known yet, because
            the title is already the conversation number in that case; the
            conversation number otherwise.
          */}
          <p data-testid="chat-thread-subtitle" className="text-[11px] text-on-surface-variant truncate">
            {customer.email ??
              (customer.source === 'unknown'
                ? t('chat.unidentified_customer')
                : t('chat.conversation_number', { id: conversation.id }))}
          </p>
        </div>
      </div>

      {/* Transcript */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        data-testid="chat-thread-scroll"
        className="flex-1 overflow-y-auto"
      >
        {/* The observed element: its height, not the scrollport's, is what
            changes when an image resolves. */}
        <div ref={contentRef} className="px-6 py-5 space-y-4">
          {isLoading ? (
            <div className="min-h-[20rem] flex items-center justify-center">
              <PageLoader size="md" />
            </div>
          ) : error ? (
            <p data-testid="chat-thread-error" className="text-sm text-error text-center py-10">
              {error}
            </p>
          ) : messages.length === 0 ? (
            <p
              data-testid="chat-thread-empty"
              className="text-sm text-on-surface-variant text-center py-10"
            >
              {t('chat.thread_empty')}
            </p>
          ) : (
            <>
              {hasOlder && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleLoadOlder}
                    disabled={isLoadingOlder}
                    data-testid="chat-load-older"
                    className="text-xs font-bold text-secondary bg-surface-container-lowest px-4 py-2 rounded-full hover:bg-surface-container-high transition-colors disabled:opacity-50"
                  >
                    {isLoadingOlder ? t('common.loading') : t('chat.load_older')}
                  </button>
                </div>
              )}

              {messages.map((message, index) => (
                <React.Fragment key={message.id}>
                  {message.dayLabel && (
                    <div className="flex justify-center">
                      <span className="text-[10px] font-bold text-on-surface-variant bg-surface-container-high px-3 py-1 rounded-full">
                        {message.dayLabel}
                      </span>
                    </div>
                  )}
                  <MessageBubble
                    message={message}
                    // The first of a run, or anything after a day break.
                    showSender={
                      index === 0 ||
                      !!message.dayLabel ||
                      messages[index - 1].senderId !== message.senderId
                    }
                    onOpenImage={setLightboxMessage}
                  />
                </React.Fragment>
              ))}
            </>
          )}
        </div>
      </div>

      <MessageComposer onSend={onSend} disabled={isLoading} />

      <ImageLightbox message={openImage} onClose={() => setLightboxMessage(null)} />
    </div>
  );
};

export default ChatThread;
