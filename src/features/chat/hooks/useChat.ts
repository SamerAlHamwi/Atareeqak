import { useCallback, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { useFetchEffect } from '../../shared/hooks/useFetchEffect';
import type { IsStale } from '../../shared/hooks/useFetchEffect';
import { extractApiError, isForbiddenError } from '../../../services/apiError';
import { chatApi, imageMetaOf, MESSAGES_DEFAULT_LIMIT } from '../api/chatApi';
import type {
  ChatImageMeta,
  ChatMessageResponse,
  ChatMessagesResponse,
  ChatUserResponse,
  ConversationResponse,
} from '../api/chatApi';

/** Page sizes for the CLIENT-side conversation paging — see `useChat` below. */
export const CHAT_PER_PAGE_OPTIONS = [5, 10, 25, 50] as const;

/** The list is unpaged server-side, so it is polled whole; 30s matches useLiveTrips. */
const CONVERSATIONS_POLL_MS = 30_000;
/** The open thread is polled harder — it is the live half of the screen. */
const MESSAGES_POLL_MS = 15_000;

/**
 * How much we actually know about the person on the other end.
 *
 * `api` — straight from the payload's `user` block.
 * `thread` — reconstructed from message senders (see "Who is who" below).
 * `partial` — a first name only, off `last_message.sender_name`.
 * `unknown` — nothing at all: an empty conversation whose last message is null.
 */
export type CustomerSource = 'api' | 'thread' | 'partial' | 'unknown';

export interface ChatCustomer {
  id: number | null;
  name: string;
  email: string | null;
  photo: string | null;
  accountStatus: ChatUserResponse['account_status'] | null;
  source: CustomerSource;
}

export interface ChatConversationPreview {
  content: string;
  isImage: boolean;
  sentByAgent: boolean;
  /** Formatted in the ACTIVE locale from `created_at_iso` — never the API's English `created_at`. */
  at: string;
  atIso: string;
}

export interface ChatConversation {
  id: number;
  type: string;
  customer: ChatCustomer;
  lastMessage: ChatConversationPreview | null;
  updatedAtIso: string;
}

export interface ChatMessage {
  id: number;
  senderId: number;
  senderName: string;
  senderPhoto: string | null;
  isImage: boolean;
  /** Prose for a text message, the caption for an image (may be empty). */
  text: string;
  imageUrl: string | null;
  image: ChatImageMeta | null;
  createdAtIso: string;
  /** `HH:MM` in the active locale. */
  time: string;
  /** Day separator label; the thread renders one whenever this changes. */
  dayLabel: string;
  fromAgent: boolean;
  isEdited: boolean;
}

const isImageUrl = (content: string): boolean =>
  /^https?:\/\//i.test(content) && /\.(jpe?g|png|gif|webp|bmp|svg)(\?|#|$)/i.test(content);

const formatTime = (iso: string, language: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' });
};

const formatDay = (iso: string, language: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleDateString(language, { day: 'numeric', month: 'short', year: 'numeric' });
};

/** List rows show a date for older conversations and a time for today's. */
const formatPreviewStamp = (iso: string, language: string): string => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const now = new Date();
  const isToday =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  return isToday
    ? date.toLocaleTimeString(language, { hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(language, { day: 'numeric', month: 'short' });
};

/** Identity learned by reading a thread, keyed by conversation id. */
interface LearnedCustomer {
  id: number;
  name: string;
  photo: string | null;
}

/**
 * Staff support chat.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS HOOK IS SHAPED THE WAY IT IS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * **1. The conversation list is not paginated by the server.**
 * `GET /staff/chat/conversations` takes no `page`/`per_page` and answers with
 * every conversation plus a `total` (verified live: `total: 14`, 14 rows). So
 * paging, searching and page-size are all done here, over the full array —
 * which is also why the search box can filter on fields the API would never
 * have let us query.
 *
 * **2. Message paging runs backwards, and has no total.**
 * Page 1 is the NEWEST `limit` messages (ascending within the page), page 2 the
 * `limit` before those. `meta` echoes only `{page, limit}` — no `last_page`, no
 * `total` — so "are there older messages?" is inferred from whether a page came
 * back full. Loading older therefore means bumping a page counter, and the
 * messages array is merged by id rather than concatenated.
 *
 * That merge is not defensive coding for its own sake: the offset is measured
 * from the newest end, so every message that arrives while the agent is reading
 * shifts the window. Because the shift always moves the window towards NEWER
 * messages, an older page can only ever re-serve rows we already hold — it can
 * never skip one — and deduping by id absorbs that completely. (Deleting a
 * message would shift the other way and could skip, but no staff route deletes.)
 *
 * **3. Who is who — the `user: null` fallback.**
 * `conversation.user` is the authority and is normally populated. It was not
 * always: `Conversation::getOtherParticipant()` returned null unless
 * `type === 'private'`, while every conversation this screen exists for is
 * `type: 'support'`, so the block was null on every row (BUG-14, fixed
 * 2026-08-17). Rendering "Unknown user" against all of them would have been
 * honest and useless, so the identity is also reconstructed from data the API
 * returns regardless — which still covers a backend without the fix, and any
 * future conversation type the guard does not answer for:
 *
 *   · `conversation.last_message.sent_by_agent` says which side sent the newest
 *     message, and page 1's last element IS that message. One of the two ids is
 *     therefore pinned on every non-empty thread: `sent_by_agent` true names the
 *     AGENT's user id, false names THIS conversation's customer.
 *   · The agent's shadow user is the same for the whole session, so once learned
 *     it classifies every message in every thread — and any sender that is not
 *     the agent is the customer, which recovers their full name and photo.
 *   · Sending a message settles it outright: the 201 response's `data.sender.id`
 *     is the agent, by definition.
 *
 * `conversation.user` is checked first, which is why the fix landed without a
 * line changing here: the inference simply stopped being load-bearing.
 */
export const useChat = () => {
  const { t, i18n } = useTranslation();
  const language = i18n.language;

  // ── Conversation list ────────────────────────────────────────────────────
  const [rawConversations, setRawConversations] = useState<ConversationResponse[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isForbidden, setIsForbidden] = useState(false);
  /**
   * The one 422 this route can return: the employee has no email, so no shadow
   * user can be built and chat is unusable for this account. Held separately
   * from `error` because Retry cannot fix it — only an admin editing the
   * employee can.
   */
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  const [search, setSearchState] = useState('');
  const [perPage, setPerPageState] = useState<number>(10);
  const [page, setPage] = useState(1);

  // ── Open thread ──────────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [rawMessages, setRawMessages] = useState<ChatMessageResponse[]>([]);
  const [threadConversation, setThreadConversation] = useState<ConversationResponse | null>(null);
  const [isThreadLoading, setIsThreadLoading] = useState(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [hasOlder, setHasOlder] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);

  // ── Learned identities ───────────────────────────────────────────────────
  const [agentUserId, setAgentUserId] = useState<number | null>(null);
  const [learnedCustomers, setLearnedCustomers] = useState<Record<number, LearnedCustomer>>({});

  /**
   * The agent's id mirrored into a ref. The fetch callbacks need to READ it, but
   * they must not DEPEND on it: `useFetchEffect` refires whenever its callback's
   * identity changes, so learning the id from a response would immediately
   * trigger another fetch of the same thread. State drives the render, the ref
   * drives the callbacks.
   */
  const agentUserIdRef = useRef<number | null>(null);
  const rememberAgentId = useCallback((id: number, force = false) => {
    if (force || agentUserIdRef.current === null) {
      agentUserIdRef.current = id;
      setAgentUserId(id);
    }
  }, []);

  /** Which conversation the thread state currently describes. */
  const loadedThreadIdRef = useRef<number | null>(null);
  /** Whether THAT conversation has had one successful load — see `loadNewestMessages`. */
  const threadLoadedRef = useRef(false);
  /** Whether the conversation list has ever loaded, so polls can stay silent. */
  const conversationsLoadedRef = useRef(false);

  const setSearch = useCallback((next: string) => {
    setSearchState(next);
    setPage(1);
  }, []);

  const setPerPage = useCallback((next: number) => {
    setPerPageState(next);
    setPage(1);
  }, []);

  // ── Fetch: conversations ─────────────────────────────────────────────────

  const loadConversations = useCallback(
    async (silent: boolean, isStale: IsStale) => {
      if (!silent) {
        setIsLoading(true);
      }
      setError(null);
      setIsForbidden(false);
      try {
        const response = await chatApi.getConversations();
        if (isStale()) {
          return;
        }
        conversationsLoadedRef.current = true;
        setBlockedMessage(null);
        setRawConversations(response.data ?? []);
        setTotal(response.total ?? response.data?.length ?? 0);
      } catch (err) {
        if (isStale()) {
          return;
        }
        if (isForbiddenError(err)) {
          setIsForbidden(true);
          return;
        }
        // The no-email 422. Nothing else on this route validates, so a 422 can
        // only be that — and it must not look like a transient failure.
        if (axios.isAxiosError(err) && err.response?.status === 422) {
          setBlockedMessage(extractApiError(err, t('chat.no_email_hint')));
          setRawConversations([]);
          setTotal(0);
          return;
        }
        setError(extractApiError(err, t('chat.load_failed')));
      } finally {
        if (!silent && !isStale()) {
          setIsLoading(false);
        }
      }
    },
    [t]
  );

  /**
   * Only the FIRST load blanks the table; every poll tick after it refreshes in
   * place. The "have we loaded" flag is a ref so this callback's identity stays
   * stable — a new identity would restart the poll interval on every response.
   */
  const fetchConversations = useCallback(
    (isStale: IsStale) => loadConversations(conversationsLoadedRef.current, isStale),
    [loadConversations]
  );

  useFetchEffect(fetchConversations, CONVERSATIONS_POLL_MS);

  const refetch = useCallback(() => loadConversations(false, () => false), [loadConversations]);

  // ── Identity learning ────────────────────────────────────────────────────

  const rememberCustomer = useCallback(
    (conversationId: number, sender: ChatMessageResponse['sender']) => {
      setLearnedCustomers((prev) => {
        const existing = prev[conversationId];
        if (existing?.id === sender.id && existing.name === sender.name) {
          return prev;
        }
        return {
          ...prev,
          [conversationId]: { id: sender.id, name: sender.name, photo: sender.profile_photo },
        };
      });
    },
    []
  );

  /**
   * Pins one of the two ids from a NEWEST-page response (page 1 only — the
   * pairing below is meaningless on an older page).
   */
  const learnFromThread = useCallback(
    (response: ChatMessagesResponse) => {
      const newest = response.data?.[response.data.length - 1];
      const last = response.conversation?.last_message;
      if (!newest || !last) {
        return;
      }
      /**
       * `last_message` and the messages page are two separate queries, both
       * ordered by `created_at` alone. Messages sharing a timestamp can come
       * back in a different order in each, which would pin the WRONG id — so
       * only trust the pairing when the two agree on what the newest message
       * actually is.
       */
      if (last.created_at_iso !== newest.created_at || last.content !== newest.content) {
        return;
      }

      if (last.sent_by_agent) {
        rememberAgentId(newest.sender.id);
        return;
      }
      rememberCustomer(response.conversation.id, newest.sender);
    },
    [rememberAgentId, rememberCustomer]
  );

  /**
   * Once the agent's id is known, every sender that is not the agent is the
   * customer — which upgrades a thread's identity from a first name to a full
   * name and a photo. Runs on every thread response, not only the first.
   */
  const learnCustomerFromSenders = useCallback(
    (conversationId: number, messages: ChatMessageResponse[]) => {
      const agentId = agentUserIdRef.current;
      if (agentId === null) {
        return;
      }
      const fromCustomer = messages.find((message) => message.sender.id !== agentId);
      if (fromCustomer) {
        rememberCustomer(conversationId, fromCustomer.sender);
      }
    },
    [rememberCustomer]
  );

  // ── Fetch: the open thread ───────────────────────────────────────────────

  /** Merge by id, oldest first. Both paging and polling feed through here. */
  const mergeMessages = useCallback((incoming: ChatMessageResponse[]) => {
    setRawMessages((prev) => {
      const byId = new Map(prev.map((message) => [message.id, message]));
      for (const message of incoming) {
        byId.set(message.id, message);
      }
      return [...byId.values()].sort((a, b) => {
        const delta = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        // Ids are monotonic, so they settle same-second ties deterministically —
        // which the API's own `created_at`-only ordering does not.
        return delta !== 0 ? delta : a.id - b.id;
      });
    });
  }, []);

  /**
   * The initial load for a selection AND the poll tick, in one function.
   *
   * The two are told apart by `threadLoadedRef`, which tracks whether the
   * CURRENT selection has ever loaded successfully — not merely whether it has
   * been attempted. That distinction matters twice: a failed first attempt
   * still shows the skeleton and the error on its retry, and a poll tick that
   * fails is swallowed rather than dropping an error banner over a thread the
   * agent is reading perfectly well.
   */
  const loadNewestMessages = useCallback(
    async (isStale: IsStale) => {
      const conversationId = selectedId;
      if (conversationId === null) {
        return;
      }
      // A new selection: drop the previous thread's state before fetching, so
      // the old messages never flash under the new conversation's header.
      if (loadedThreadIdRef.current !== conversationId) {
        loadedThreadIdRef.current = conversationId;
        threadLoadedRef.current = false;
        setRawMessages([]);
        setThreadConversation(null);
        setPagesLoaded(0);
        setHasOlder(false);
        setThreadError(null);
      }
      const isInitial = !threadLoadedRef.current;
      if (isInitial) {
        setIsThreadLoading(true);
      }

      try {
        const response = await chatApi.getMessages(conversationId, {
          limit: MESSAGES_DEFAULT_LIMIT,
        });
        // A selection made mid-flight must win over this response.
        if (isStale() || loadedThreadIdRef.current !== conversationId) {
          return;
        }
        const received = response.data ?? [];

        setThreadConversation(response.conversation ?? null);
        mergeMessages(received);
        learnFromThread(response);
        learnCustomerFromSenders(conversationId, received);
        setThreadError(null);

        if (isInitial) {
          setPagesLoaded(1);
          setHasOlder(received.length >= MESSAGES_DEFAULT_LIMIT);
          threadLoadedRef.current = true;
        }
      } catch (err) {
        if (isStale() || loadedThreadIdRef.current !== conversationId) {
          return;
        }
        // Poll failures stay silent — there is already a thread on screen.
        if (isInitial) {
          setThreadError(extractApiError(err, t('chat.thread_load_failed')));
        }
      } finally {
        if (!isStale() && loadedThreadIdRef.current === conversationId && isInitial) {
          setIsThreadLoading(false);
        }
      }
    },
    [selectedId, mergeMessages, learnFromThread, learnCustomerFromSenders, t]
  );

  useFetchEffect(loadNewestMessages, MESSAGES_POLL_MS);

  /**
   * Walks backwards one page at a time. The page counter — not the message
   * count — drives the offset, because messages arriving mid-session inflate
   * the array and would make a length-derived offset overshoot and skip.
   */
  const loadOlderMessages = useCallback(async () => {
    const conversationId = selectedId;
    if (conversationId === null || !hasOlder || isLoadingOlder || pagesLoaded === 0) {
      return;
    }
    setIsLoadingOlder(true);
    setThreadError(null);
    const nextPage = pagesLoaded + 1;

    try {
      const response = await chatApi.getMessages(conversationId, {
        page: nextPage,
        limit: MESSAGES_DEFAULT_LIMIT,
      });
      if (loadedThreadIdRef.current !== conversationId) {
        return;
      }
      const received = response.data ?? [];
      mergeMessages(received);
      learnCustomerFromSenders(conversationId, received);
      setPagesLoaded(nextPage);
      // A short page is the only "you have reached the beginning" signal there
      // is — the payload carries no total and no last_page.
      setHasOlder(received.length >= MESSAGES_DEFAULT_LIMIT);
    } catch (err) {
      if (loadedThreadIdRef.current !== conversationId) {
        return;
      }
      setThreadError(extractApiError(err, t('chat.thread_load_failed')));
    } finally {
      setIsLoadingOlder(false);
    }
  }, [selectedId, hasOlder, isLoadingOlder, pagesLoaded, mergeMessages, learnCustomerFromSenders, t]);

  // ── Send ─────────────────────────────────────────────────────────────────

  /**
   * Awaits the POST before touching any state, so a 422 (empty body, over
   * 5,000 chars) or a 404 (conversation gone) leaves the thread exactly as it
   * was and the composer can keep the text the agent typed.
   */
  const sendMessage = useCallback(
    async (text: string) => {
      const conversationId = selectedId;
      if (conversationId === null) {
        return;
      }
      const response = await chatApi.sendMessage(conversationId, text);
      const sent = response.data;

      if (sent) {
        // The one unambiguous statement of who the agent is in the whole API —
        // it overrides anything inference had concluded.
        rememberAgentId(sent.sender.id, true);
        if (loadedThreadIdRef.current === conversationId) {
          mergeMessages([sent]);
        }
      }
      // Sending touches `conversations.updated_at`, so the row moves to the top
      // and its preview changes — reconcile rather than wait for the poll.
      // Swallowed on failure: the message HAS been sent, and reporting a list
      // refresh error as a send error would be a lie the agent acts on.
      await loadConversations(true, () => false).catch(() => {});
    },
    [selectedId, mergeMessages, loadConversations, rememberAgentId]
  );

  // ── Derived: conversations ───────────────────────────────────────────────

  const resolveCustomer = useCallback(
    (raw: ConversationResponse): ChatCustomer => {
      // 1. The payload's own block — the authority whenever it is there, which
      //    since the BUG-14 fix is every two-party conversation.
      if (raw.user) {
        return {
          id: raw.user.id,
          name: raw.user.name?.trim() || t('common.unknown_user'),
          email: raw.user.email,
          photo: raw.user.profile_photo,
          accountStatus: raw.user.account_status,
          source: 'api',
        };
      }
      // 2. Reconstructed by reading the thread.
      const learned = learnedCustomers[raw.id];
      if (learned) {
        return {
          id: learned.id,
          name: learned.name?.trim() || t('common.unknown_user'),
          email: null,
          photo: learned.photo,
          accountStatus: null,
          source: 'thread',
        };
      }
      // 3. A first name, when the newest message came from the customer.
      if (raw.last_message && !raw.last_message.sent_by_agent && raw.last_message.sender_name) {
        return {
          id: null,
          name: raw.last_message.sender_name,
          email: null,
          photo: null,
          accountStatus: null,
          source: 'partial',
        };
      }
      /**
       * 4. Nothing knowable yet — an empty conversation, or one whose newest
       * message came from the agent, which names nobody. That is a large share
       * of the inbox until each thread is opened, so the row is labelled with
       * the conversation number rather than a wall of "Unknown user": a chat
       * number is true, distinguishes one row from the next, and matches what
       * the thread header falls back to. Opening the thread replaces it with
       * the real name via branch 2.
       */
      return {
        id: null,
        name: t('chat.conversation_number', { id: raw.id }),
        email: null,
        photo: null,
        accountStatus: null,
        source: 'unknown',
      };
    },
    [learnedCustomers, t]
  );

  const conversations = useMemo<ChatConversation[]>(
    () =>
      rawConversations.map((raw) => {
        const last = raw.last_message;
        const isImage = !!last && isImageUrl(last.content);

        return {
          id: raw.id,
          type: raw.type,
          customer: resolveCustomer(raw),
          lastMessage: last
            ? {
                // An image's `content` is a URL; showing it raw would put a
                // storage path where the message preview belongs.
                content: isImage ? t('chat.preview_image') : last.content,
                isImage,
                sentByAgent: last.sent_by_agent,
                at: formatPreviewStamp(last.created_at_iso, language),
                atIso: last.created_at_iso,
              }
            : null,
          updatedAtIso: raw.updated_at,
        };
      }),
    [rawConversations, resolveCustomer, language, t]
  );

  const filteredConversations = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) {
      return conversations;
    }
    return conversations.filter((conversation) =>
      [
        String(conversation.id),
        conversation.customer.name,
        conversation.customer.email ?? '',
        conversation.lastMessage?.content ?? '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [conversations, search]);

  const lastPage = Math.max(1, Math.ceil(filteredConversations.length / perPage));
  // A narrowing search can strand the user on a page that no longer exists.
  const currentPage = Math.min(page, lastPage);

  const pagedConversations = useMemo(
    () => filteredConversations.slice((currentPage - 1) * perPage, currentPage * perPage),
    [filteredConversations, currentPage, perPage]
  );

  // ── Derived: the open thread ─────────────────────────────────────────────

  const selectedConversation = useMemo<ChatConversation | null>(() => {
    if (selectedId === null) {
      return null;
    }
    // The list row is preferred (its identity may have been learned already);
    // the thread's own copy covers a conversation that has since left the list.
    const fromList = conversations.find((conversation) => conversation.id === selectedId);
    if (fromList) {
      return fromList;
    }
    if (!threadConversation) {
      return null;
    }
    return {
      id: threadConversation.id,
      type: threadConversation.type,
      customer: resolveCustomer(threadConversation),
      lastMessage: null,
      updatedAtIso: threadConversation.updated_at,
    };
  }, [selectedId, conversations, threadConversation, resolveCustomer]);

  /** The customer's id for THIS thread, however we came to know it. */
  const selectedCustomerId = selectedConversation?.customer.id ?? null;

  const messages = useMemo<ChatMessage[]>(
    () =>
      rawMessages.map((raw, index) => {
        const isImage = raw.type === 'image' || isImageUrl(raw.content);
        const image = isImage ? imageMetaOf(raw.metadata) : null;
        // Compared against the previous row rather than carried in a running
        // variable: mutating a closed-over local across a render is exactly what
        // `react-hooks/immutability` exists to stop.
        const dayLabel = formatDay(raw.created_at, language);
        const previousDayLabel =
          index > 0 ? formatDay(rawMessages[index - 1].created_at, language) : '';
        const isNewDay = dayLabel !== previousDayLabel;

        /**
         * Alignment, in order of certainty: the agent's id when we have it,
         * else "not the customer" for this thread, else treat it as incoming.
         * The fallback deliberately errs towards the customer's side — claiming
         * a user's message was written by support is the worse mistake in a
         * moderation tool.
         */
        const fromAgent =
          agentUserId !== null
            ? raw.sender.id === agentUserId
            : selectedCustomerId !== null
              ? raw.sender.id !== selectedCustomerId
              : false;

        return {
          id: raw.id,
          senderId: raw.sender.id,
          senderName: raw.sender.name?.trim() || t('common.unknown_user'),
          senderPhoto: raw.sender.profile_photo,
          isImage,
          text: isImage ? image?.caption ?? '' : raw.content,
          imageUrl: isImage ? raw.content : null,
          image,
          createdAtIso: raw.created_at,
          time: formatTime(raw.created_at, language),
          dayLabel: isNewDay ? dayLabel : '',
          fromAgent,
          isEdited: raw.is_edited === true,
        };
      }),
    [rawMessages, agentUserId, selectedCustomerId, language, t]
  );

  const selectConversation = useCallback((id: number | null) => {
    setSelectedId(id);
    setThreadError(null);
  }, []);

  return {
    // list
    conversations: pagedConversations,
    total,
    filteredTotal: filteredConversations.length,
    isLoading,
    error,
    isForbidden,
    blockedMessage,
    refetch,
    search,
    setSearch,
    perPage,
    setPerPage,
    page: currentPage,
    setPage,
    lastPage,
    // thread
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
  };
};
