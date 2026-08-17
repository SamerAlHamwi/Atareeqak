import api from '../../../services/api';
import { ENDPOINTS } from '../../../services/endpoints';

/**
 * Staff support chat — `StaffChatController`.
 *
 * Every shape below was probed live against the running backend on 2026-08-17
 * (see `docs/api/seed-phase-chat.sql` for the data it was probed against).
 * Where the payload is surprising, the surprise is documented on the field
 * rather than smoothed over here — the hook is what adapts.
 */

/**
 * The OTHER participant in the conversation — the customer, not the agent.
 *
 * Null-safe by contract, and `useChat` still reconstructs the identity from
 * message senders when it IS null. That fallback used to be the only path that
 * ever ran: `Conversation::getOtherParticipant()` early-returned unless
 * `type === 'private'`, while every conversation this screen serves is
 * `type: 'support'`, so the block was null on every row (BUG-14, fixed
 * 2026-08-17 — see `docs/api/backend-issues.md`).
 *
 * The fallback is kept deliberately. It costs nothing when this block arrives
 * populated, and it is what keeps the page readable against a backend that has
 * not picked up the fix, or a conversation type nobody has thought about yet.
 */
export interface ChatUserResponse {
  id: number;
  name: string;
  email: string | null;
  profile_photo: string | null;
  /** Derived from `users.status`: -1 → banned, 0 → inactive, else active. */
  account_status: 'banned' | 'inactive' | 'active';
}

export interface ChatLastMessageResponse {
  /**
   * For an `image` message this is the storage URL, not prose — the list row
   * must not render it as text. `type` is NOT included in this block, so
   * "is it an image" has to be inferred from the URL shape.
   */
  content: string;
  /** The sender's FIRST name only (`"Passenger1"`, `"System"`). */
  sender_name: string | null;
  /** True when the agent (this employee's shadow user) sent it. */
  sent_by_agent: boolean;
  /**
   * Server-side `diffForHumans()` — **English only**, regardless of the UI
   * language, the same trap as the complaints endpoint's `type_label`. Ignored;
   * the hook formats `created_at_iso` in the active locale instead.
   */
  created_at: string;
  created_at_iso: string;
}

export interface ConversationResponse {
  id: number;
  /** `'support'` for everything the inbox serves; `'private'` exists too. */
  type: string;
  user: ChatUserResponse | null;
  /** Null for a conversation that exists but has no messages yet. */
  last_message: ChatLastMessageResponse | null;
  updated_at: string;
}

export interface ChatMessageSenderResponse {
  id: number;
  /** Full name here, unlike `last_message.sender_name`. */
  name: string;
  /**
   * Null whenever the file is missing from disk — `ChatMessageHandler` runs an
   * `exists()` check before building the URL. With `FILESYSTEM_DISK=local` and
   * no `storage:link` that is every message, so initials are the normal case.
   */
  profile_photo: string | null;
}

export const CHAT_MESSAGE_TYPES = ['text', 'image'] as const;
export type ChatMessageType = (typeof CHAT_MESSAGE_TYPES)[number];

export interface ChatMessageResponse {
  id: number;
  sender: ChatMessageSenderResponse;
  /** `MessageTypeFactory` accepts exactly `text` and `image`. */
  type: ChatMessageType | string;
  /** Prose for `text`; a fully-qualified `/storage/...` URL for `image`. */
  content: string;
  /**
   * `{ original_name, size, mime_type, caption }` on an image.
   *
   * ⚠️ Three different runtime shapes: `null` on a stored text message, `{...}`
   * on an image, and `[]` (an empty PHP array, serialised as a JSON **array**)
   * on the message a POST hands straight back. `imageMetaOf` normalises it.
   */
  metadata: Record<string, unknown> | unknown[] | null;
  created_at: string;
  /** `false` when read back from the list, `null` on a just-sent message. */
  is_edited: boolean | null;
}

export interface ConversationsListResponse {
  status: string;
  /**
   * ⚠️ The count of the WHOLE list, not of a page — this endpoint takes no
   * `page`/`per_page` and returns every conversation the agent participates in,
   * ordered `updated_at` desc. Paging is therefore the dashboard's job; see
   * `useChat`.
   */
  total: number;
  data: ConversationResponse[];
}

export interface ChatMessagesMeta {
  page: number;
  limit: number;
}

export interface ChatMessagesResponse {
  status: string;
  /** The same row the list endpoint returns, recomputed for this request. */
  conversation: ConversationResponse;
  /**
   * Oldest-first within the page, but paged from the NEWEST end: page 1 is the
   * newest `limit` messages, page 2 the `limit` before those. There is no
   * total and no `last_page` — "are there older messages" can only be inferred
   * from whether a page came back full.
   */
  data: ChatMessageResponse[];
  meta: ChatMessagesMeta;
}

export interface SendMessageResponse {
  status: string;
  message: string;
  data: ChatMessageResponse;
}

/** `page => sometimes|integer|min:1`, `limit => sometimes|integer|min:1|max:100`. */
export const MESSAGES_LIMIT_MIN = 1;
export const MESSAGES_LIMIT_MAX = 100;
/** The server's own default when `limit` is omitted. */
export const MESSAGES_DEFAULT_LIMIT = 50;

/** `message => required|string|max:5000` on the send route. */
export const MESSAGE_MAX_LENGTH = 5000;

export interface ChatMessagesParams {
  page?: number;
  limit?: number;
}

/**
 * The image fields `FileUploadService::uploadChatImage` writes, once the three
 * possible `metadata` shapes have been collapsed to one.
 */
export interface ChatImageMeta {
  original_name: string | null;
  mime_type: string | null;
  size: number | null;
  caption: string | null;
}

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.length > 0 ? value : null;

/**
 * Normalises `metadata` into the image block, tolerating all three shapes the
 * API emits (`null`, `{...}`, `[]`). Returns every field as null when there is
 * nothing there, so callers never branch on the container.
 */
export const imageMetaOf = (metadata: ChatMessageResponse['metadata']): ChatImageMeta => {
  const source =
    metadata && !Array.isArray(metadata) ? (metadata as Record<string, unknown>) : {};
  const size = source.size;

  return {
    original_name: asString(source.original_name),
    mime_type: asString(source.mime_type),
    size: typeof size === 'number' ? size : null,
    caption: asString(source.caption),
  };
};

export const chatApi = {
  /**
   * ⚠️ Unpaged — returns EVERY conversation for this agent in one response.
   * Also creates the agent's shadow `users` row on first call, silently.
   *
   * A **422** here means the employee has no email address, so no shadow user
   * can be built and chat is unusable for that account. It is the only 422 this
   * route can produce (it validates nothing else), which is what lets `useChat`
   * treat it as a distinct, un-retryable state rather than a generic error.
   */
  getConversations: async (): Promise<ConversationsListResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.CHAT_CONVERSATIONS);
    return response.data;
  },

  getMessages: async (
    conversationId: string | number,
    params: ChatMessagesParams = {}
  ): Promise<ChatMessagesResponse> => {
    const response = await api.get(ENDPOINTS.STAFF.CHAT_MESSAGES(conversationId), { params });
    return response.data;
  },

  /**
   * Sends as the agent's shadow user and broadcasts `MessageSent`, so the
   * customer's app gets it in real time.
   *
   * The body field is `message`, not `content` — the controller remaps it for
   * `ChatMessageHandler` itself. Text only: the route's validator requires
   * `message` as a string, so there is no staff-side image upload to build
   * against.
   */
  sendMessage: async (
    conversationId: string | number,
    message: string
  ): Promise<SendMessageResponse> => {
    const response = await api.post(ENDPOINTS.STAFF.CHAT_MESSAGES(conversationId), { message });
    return response.data;
  },
};
