import React from 'react';
import { useTranslation } from 'react-i18next';
import { MailX } from 'lucide-react';
import ErrorBanner from '../../shared/components/ErrorBanner';
import NoPermissionPanel from '../../shared/components/NoPermissionPanel';
import ConversationList from '../components/ConversationList';
import ChatThread from '../components/ChatThread';
import { useChat } from '../hooks/useChat';

/**
 * Support chat — `GET/POST /staff/chat/conversations[/{id}/messages]`.
 *
 * Two panes: the inbox on the start side, the open conversation on the end
 * side. Both are live — the list re-polls every 30s and the open thread every
 * 15s, because the backend broadcasts `MessageSent` over a WebSocket this
 * dashboard has no client for. Polling is what makes an incoming customer
 * message appear without a page reload; swap it for Echo the day a socket
 * client is added, and `useChat` is the only file that changes.
 */
const Chat: React.FC = () => {
  const { t } = useTranslation();
  const {
    conversations,
    total,
    filteredTotal,
    isLoading,
    error,
    isForbidden,
    blockedMessage,
    refetch,
    search,
    setSearch,
    perPage,
    setPerPage,
    page,
    setPage,
    lastPage,
    selectedId,
    selectConversation,
    selectedConversation,
    messages,
    isThreadLoading,
    threadError,
    hasOlder,
    isLoadingOlder,
    loadOlderMessages,
    sendMessage,
  } = useChat();

  // `RoleRoute` already blocks navigation, but a role change mid-session can
  // still 403 a page it already let through.
  if (isForbidden) {
    return <NoPermissionPanel />;
  }

  return (
    <div className="space-y-8">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-headline text-3xl font-extrabold text-primary mb-1">
            {t('chat.title')}
          </h2>
          <p className="text-on-surface-variant text-sm">{t('chat.subtitle')}</p>
        </div>
        <span
          data-testid="chat-total"
          className="text-xs font-bold text-on-surface-variant bg-surface-container-low px-4 py-2 rounded-full"
        >
          {t('chat.total_conversations', { count: total })}
        </span>
      </section>

      {/*
        The employee has no email address, so `ensureShadowUser()` cannot build
        the `users` row that IS the chat participant. Retrying will not fix it —
        a system admin has to add an email to the account — so this replaces the
        page rather than sitting above a broken one, and gets no Retry button.
      */}
      {blockedMessage ? (
        <div
          data-testid="chat-blocked"
          className="bg-error-container text-on-error-container rounded-2xl px-6 py-8 flex flex-col items-center text-center gap-3"
        >
          <MailX size={28} />
          <p className="text-sm font-bold">{blockedMessage}</p>
          <p className="text-xs opacity-80 max-w-md">{t('chat.no_email_hint')}</p>
        </div>
      ) : (
        <>
          {error && <ErrorBanner message={error} onRetry={() => void refetch()} />}

          <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 xl:col-span-4">
              <ConversationList
                conversations={conversations}
                selectedId={selectedId}
                onSelect={selectConversation}
                isLoading={isLoading}
                search={search}
                onSearchChange={setSearch}
                perPage={perPage}
                onPerPageChange={setPerPage}
                page={page}
                lastPage={lastPage}
                onPageChange={setPage}
                filteredTotal={filteredTotal}
                hasSearch={search.trim().length > 0}
              />
            </div>

            <div className="lg:col-span-7 xl:col-span-8">
              <ChatThread
                conversation={selectedConversation}
                messages={messages}
                isLoading={isThreadLoading}
                error={threadError}
                hasOlder={hasOlder}
                isLoadingOlder={isLoadingOlder}
                onLoadOlder={() => void loadOlderMessages()}
                onSend={sendMessage}
              />
            </div>
          </section>
        </>
      )}
    </div>
  );
};

export default Chat;
