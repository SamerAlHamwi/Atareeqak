import React from 'react';
import { useTranslation } from 'react-i18next';
import { Search, Image as ImageIcon, ChevronLeft, ChevronRight } from 'lucide-react';
import Avatar from '../../shared/components/Avatar';
import PerPageSelect from '../../shared/components/PerPageSelect';
import TablePagination from '../../shared/components/TablePagination';
import { CHAT_PER_PAGE_OPTIONS } from '../hooks/useChat';
import type { ChatConversation } from '../hooks/useChat';

interface ConversationListProps {
  conversations: ChatConversation[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  isLoading: boolean;
  search: string;
  onSearchChange: (value: string) => void;
  perPage: number;
  onPerPageChange: (value: number) => void;
  page: number;
  lastPage: number;
  onPageChange: (page: number) => void;
  /** Rows after the search filter — what the range label counts against. */
  filteredTotal: number;
  hasSearch: boolean;
}

const RowSkeleton: React.FC = () => (
  <li className="flex items-center gap-3 px-6 py-4 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-surface-container-high shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 bg-surface-container-high rounded-full w-1/2" />
      <div className="h-2.5 bg-surface-container-high rounded-full w-4/5" />
    </div>
  </li>
);

/**
 * The inbox side of the chat screen.
 *
 * Search and paging are both CLIENT-side, because `GET /staff/chat/conversations`
 * accepts no query parameters at all and returns the whole list — see `useChat`.
 * That is why the search box can match on the last message's text, which no
 * server-side filter here could have done.
 */
export const ConversationList: React.FC<ConversationListProps> = ({
  conversations,
  selectedId,
  onSelect,
  isLoading,
  search,
  onSearchChange,
  perPage,
  onPerPageChange,
  page,
  lastPage,
  onPageChange,
  filteredTotal,
  hasSearch,
}) => {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith('ar');

  const rangeFrom = filteredTotal === 0 ? 0 : (page - 1) * perPage + 1;
  const rangeTo = filteredTotal === 0 ? 0 : rangeFrom + conversations.length - 1;

  return (
    <div className="bg-surface-container-low rounded-xl overflow-hidden shadow-sm flex flex-col">
      <div className="p-6 bg-surface-container-lowest border-b border-outline-variant space-y-4">
        <div className="relative">
          <Search
            size={18}
            className={`absolute top-1/2 -translate-y-1/2 text-on-surface-variant ${
              isRtl ? 'right-4' : 'left-4'
            }`}
          />
          <input
            type="search"
            value={search}
            data-testid="chat-search"
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t('chat.search_placeholder')}
            aria-label={t('chat.search_placeholder')}
            className={`w-full bg-surface border-none rounded-full py-2.5 text-xs ring-1 ring-outline-variant/30 focus:ring-secondary outline-none ${
              isRtl ? 'pr-11 pl-4' : 'pl-11 pr-4'
            }`}
          />
        </div>
        <PerPageSelect
          value={perPage}
          options={CHAT_PER_PAGE_OPTIONS}
          onChange={onPerPageChange}
          disabled={isLoading}
        />
      </div>

      <ul className="divide-y divide-outline-variant/10 flex-1 overflow-y-auto max-h-[32rem]">
        {isLoading && conversations.length === 0 ? (
          Array.from({ length: 5 }).map((_, index) => <RowSkeleton key={index} />)
        ) : conversations.length === 0 ? (
          <li
            data-testid="chat-conversations-empty"
            className="py-12 px-6 text-center text-sm text-on-surface-variant"
          >
            {hasSearch ? t('chat.empty_filtered') : t('chat.empty')}
          </li>
        ) : (
          conversations.map((conversation) => {
            const isSelected = conversation.id === selectedId;
            return (
              <li key={conversation.id}>
                <button
                  type="button"
                  data-testid="chat-conversation-row"
                  aria-current={isSelected}
                  onClick={() => onSelect(conversation.id)}
                  className={`w-full flex items-center gap-3 px-6 py-4 text-start transition-colors hover:bg-surface-container ${
                    isSelected
                      ? `bg-surface-container ${isRtl ? 'border-r-4' : 'border-l-4'} border-secondary`
                      : 'bg-surface-container-lowest'
                  }`}
                >
                  <Avatar
                    name={conversation.customer.name}
                    photo={conversation.customer.photo}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p
                        data-testid="chat-conversation-name"
                        className="text-xs font-bold truncate text-on-surface"
                      >
                        {conversation.customer.name}
                      </p>
                      {conversation.lastMessage && (
                        <span className="text-[10px] text-on-surface-variant shrink-0">
                          {conversation.lastMessage.at}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-on-surface-variant truncate mt-0.5">
                      {conversation.lastMessage ? (
                        <>
                          {conversation.lastMessage.sentByAgent && (
                            <span className="font-bold text-secondary">
                              {t('chat.you_prefix')}{' '}
                            </span>
                          )}
                          {conversation.lastMessage.isImage && (
                            <ImageIcon size={13} className="inline-block align-middle me-1" />
                          )}
                          {conversation.lastMessage.content}
                        </>
                      ) : (
                        <span className="italic">{t('chat.no_messages_yet')}</span>
                      )}
                    </p>
                  </div>
                  {isRtl ? (
                    <ChevronLeft size={18} className="text-outline-variant shrink-0" />
                  ) : (
                    <ChevronRight size={18} className="text-outline-variant shrink-0" />
                  )}
                </button>
              </li>
            );
          })
        )}
      </ul>

      <TablePagination
        page={page}
        lastPage={lastPage}
        onPageChange={onPageChange}
        isLoading={isLoading}
        info={t('common.showing_range', {
          from: rangeFrom,
          to: rangeTo,
          count: filteredTotal,
        })}
      />
    </div>
  );
};

export default ConversationList;
