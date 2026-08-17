import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import i18n from '../../src/app/i18n';
import { useChat } from '../../src/features/chat/hooks/useChat';
import type {
  ChatMessageResponse,
  ConversationResponse,
} from '../../src/features/chat/api/chatApi';
import { API_BASE, server } from '../testServer';

const AGENT_ID = 36;
const CUSTOMER_ID = 11;

const message = (overrides: Partial<ChatMessageResponse> = {}): ChatMessageResponse => ({
  id: 1,
  sender: { id: CUSTOMER_ID, name: 'Passenger1 Test', profile_photo: null },
  type: 'text',
  content: 'Hello, I was charged twice.',
  metadata: null,
  created_at: '2026-08-17T06:00:00+03:00',
  is_edited: false,
  ...overrides,
});

/**
 * The default fixture keeps `user: null` — the shape the API returned before
 * BUG-14 was fixed, when `Conversation::getOtherParticipant()` answered only
 * for `type: 'private'`. That is deliberate: it makes the reconstruction
 * fallback the default path under test, so it cannot rot now that the happy
 * path no longer needs it. The populated-block case has its own test below.
 */
const conversation = (overrides: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id: 9101,
  type: 'support',
  user: null,
  last_message: {
    content: 'Hello, I was charged twice.',
    sender_name: 'Passenger1',
    sent_by_agent: false,
    created_at: '2 hours ago',
    created_at_iso: '2026-08-17T06:00:00+03:00',
  },
  updated_at: '2026-08-17T09:40:00+03:00',
  ...overrides,
});

const conversationsHandler = (data: ConversationResponse[]) =>
  http.get(`${API_BASE}/staff/chat/conversations`, () =>
    HttpResponse.json({ status: 'success', total: data.length, data })
  );

/** Records every messages request so paging params can be asserted. */
const messagesHandler = (
  pages: Record<number, ChatMessageResponse[]>,
  urls: URL[] = [],
  conversationOverride?: ConversationResponse
) =>
  http.get(`${API_BASE}/staff/chat/conversations/:id/messages`, ({ request, params }) => {
    const url = new URL(request.url);
    urls.push(url);
    const page = Number(url.searchParams.get('page') ?? 1);
    return HttpResponse.json({
      status: 'success',
      conversation: conversationOverride ?? conversation({ id: Number(params.id) }),
      data: pages[page] ?? [],
      meta: { page, limit: Number(url.searchParams.get('limit') ?? 50) },
    });
  });

/** Fills `limit` slots so the hook infers "there may be older messages". */
const fullPage = (startId: number, count = 50): ChatMessageResponse[] =>
  Array.from({ length: count }, (_, index) =>
    message({
      id: startId + index,
      content: `message ${startId + index}`,
      created_at: `2026-08-17T06:${String(index).padStart(2, '0')}:00+03:00`,
    })
  );

describe('useChat', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en');
  });

  it('exposes the server total and pages the unpaginated list client-side', async () => {
    const rows = Array.from({ length: 12 }, (_, index) =>
      conversation({ id: 9101 + index, updated_at: `2026-08-${17 - index}T09:00:00+03:00` })
    );
    server.use(conversationsHandler(rows), messagesHandler({}));

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations.length).toBeGreaterThan(0));

    // `total` is the whole list, `conversations` is only the current page —
    // the endpoint takes no page/per_page at all.
    expect(result.current.total).toBe(12);
    expect(result.current.conversations).toHaveLength(10);
    expect(result.current.lastPage).toBe(2);

    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    act(() => result.current.setPerPage(5));
    await waitFor(() => expect(result.current.conversations).toHaveLength(5));
    // A page-size change must reset the page, or the user lands past the end.
    expect(result.current.page).toBe(1);
    expect(result.current.lastPage).toBe(3);
  });

  it('filters client-side on name, message text and chat id, and resets the page', async () => {
    server.use(
      conversationsHandler([
        conversation({ id: 9101 }),
        conversation({
          id: 9102,
          last_message: {
            content: 'My driver cancelled the trip',
            sender_name: 'Passenger2',
            sent_by_agent: false,
            created_at: '3 hours ago',
            created_at_iso: '2026-08-17T08:05:00+03:00',
          },
        }),
      ]),
      messagesHandler({})
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations).toHaveLength(2));

    // Matching on the last message's text is only possible because the whole
    // list is already in memory — no server-side filter exists for it.
    act(() => result.current.setSearch('cancelled'));
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));
    expect(result.current.conversations[0].id).toBe(9102);
    expect(result.current.filteredTotal).toBe(1);
    expect(result.current.page).toBe(1);

    act(() => result.current.setSearch('9101'));
    await waitFor(() => expect(result.current.conversations[0].id).toBe(9101));
  });

  it('renders an image last_message as a label, never as the raw storage URL', async () => {
    server.use(
      conversationsHandler([
        conversation({
          last_message: {
            content: 'http://127.0.0.1:8000/storage/chat-images/23_36_1786930600.webp',
            sender_name: 'Passenger13',
            sent_by_agent: false,
            created_at: '5 days ago',
            created_at_iso: '2026-08-12T11:00:00+03:00',
          },
        }),
      ]),
      messagesHandler({})
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    expect(result.current.conversations[0].lastMessage?.isImage).toBe(true);
    expect(result.current.conversations[0].lastMessage?.content).not.toContain('http');
  });

  it('infers who the agent is from sent_by_agent and aligns every message with it', async () => {
    // The newest message came from the AGENT, so its sender id IS the agent's —
    // the only place the API ever names them.
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler(
        {
          1: [
            message({ id: 1, sender: { id: CUSTOMER_ID, name: 'Passenger1 Test', profile_photo: null } }),
            message({
              id: 2,
              sender: { id: AGENT_ID, name: 'System Admin', profile_photo: null },
              content: 'Looking into it now.',
              created_at: '2026-08-17T06:10:00+03:00',
            }),
          ],
        },
        [],
        conversation({
          last_message: {
            content: 'Looking into it now.',
            sender_name: 'System',
            sent_by_agent: true,
            created_at: '2 hours ago',
            created_at_iso: '2026-08-17T06:10:00+03:00',
          },
        })
      )
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(2));

    expect(result.current.messages.map((m) => m.fromAgent)).toEqual([false, true]);
    // And the customer's FULL name is recovered from the sender block, which
    // the null `user` block never gave us.
    expect(result.current.selectedConversation?.customer.name).toBe('Passenger1 Test');
    expect(result.current.selectedConversation?.customer.source).toBe('thread');
  });

  it('refuses to infer when last_message and the newest row disagree', async () => {
    // Same timestamp, different content: the two queries have ordered a tie
    // differently, so the pairing cannot be trusted and nothing is pinned.
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler(
        {
          1: [
            message({ id: 1, sender: { id: AGENT_ID, name: 'System Admin', profile_photo: null } }),
          ],
        },
        [],
        conversation({
          last_message: {
            content: 'a different message with the same timestamp',
            sender_name: 'System',
            sent_by_agent: true,
            created_at: '2 hours ago',
            created_at_iso: '2026-08-17T06:00:00+03:00',
          },
        })
      )
    );

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    // Unknown side falls back to "incoming" rather than claiming support wrote it.
    expect(result.current.messages[0].fromAgent).toBe(false);
  });

  it('prefers the API user block over inference when it is populated', async () => {
    const withUser = conversation({
      id: 9114,
      type: 'private',
      user: {
        id: 24,
        name: 'Passenger14 Test',
        email: 'passenger14@test.com',
        profile_photo: 'http://127.0.0.1:8000/storage/profiles/p.jpg',
        account_status: 'banned',
      },
    });
    server.use(conversationsHandler([withUser]), messagesHandler({}, [], withUser));

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    expect(result.current.conversations[0].customer).toMatchObject({
      id: 24,
      name: 'Passenger14 Test',
      email: 'passenger14@test.com',
      accountStatus: 'banned',
      source: 'api',
    });
  });

  it('walks backwards a page at a time and merges without duplicating', async () => {
    const urls: URL[] = [];
    const page1 = fullPage(101);
    // Page 2 deliberately re-serves one row from page 1 — the offset is measured
    // from the newest end, so any message that arrives shifts the window.
    const page2 = [message({ id: 101, content: 'message 101' }), ...fullPage(1, 11)];
    server.use(conversationsHandler([conversation()]), messagesHandler({ 1: page1, 2: page2 }, urls));

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(50));

    // A full page means there may be older ones; there is no total to consult.
    expect(result.current.hasOlder).toBe(true);

    await act(async () => {
      await result.current.loadOlderMessages();
    });

    expect(urls.at(-1)?.searchParams.get('page')).toBe('2');
    expect(urls.at(-1)?.searchParams.get('limit')).toBe('50');
    // 50 + 12 received, minus the one overlap — deduped by id, not concatenated.
    expect(result.current.messages).toHaveLength(61);
    expect(new Set(result.current.messages.map((m) => m.id)).size).toBe(61);
    // A short page is the only end-of-thread signal the payload offers.
    expect(result.current.hasOlder).toBe(false);
  });

  it('does not offer older messages when the first page is short', async () => {
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler({ 1: [message({ id: 1 })] })
    );

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    expect(result.current.hasOlder).toBe(false);
  });

  it('sends `message` (not `content`), merges the reply and pins the agent id from it', async () => {
    let body: unknown;
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler({ 1: [message({ id: 1 })] }),
      http.post(`${API_BASE}/staff/chat/conversations/:id/messages`, async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          {
            status: 'success',
            message: 'Message sent.',
            data: message({
              id: 500,
              sender: { id: AGENT_ID, name: 'System Admin', profile_photo: null },
              content: 'On it.',
              // The live 201 really does answer with these two oddities.
              metadata: [],
              is_edited: null,
              created_at: '2026-08-17T11:18:18+03:00',
            }),
          },
          { status: 201 }
        );
      })
    );

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await act(async () => {
      await result.current.sendMessage('On it.');
    });

    // The controller's body field is `message`; it remaps to `content` itself.
    expect(body).toEqual({ message: 'On it.' });
    expect(result.current.messages).toHaveLength(2);

    const sent = result.current.messages[1];
    expect(sent.text).toBe('On it.');
    // The 201's sender IS the agent, by definition — so alignment is now certain
    // for this message and retroactively for the customer's.
    expect(sent.fromAgent).toBe(true);
    expect(result.current.messages[0].fromAgent).toBe(false);
    expect(sent.isEdited).toBe(false);
  });

  it('leaves the thread untouched when a send fails, so the composer can retry', async () => {
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler({ 1: [message({ id: 1 })] }),
      http.post(`${API_BASE}/staff/chat/conversations/:id/messages`, () =>
        HttpResponse.json(
          { status: 'error', errors: { message: ['Message content is required.'] } },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    await expect(result.current.sendMessage('   ')).rejects.toBeTruthy();
    expect(result.current.messages).toHaveLength(1);
  });

  it('maps image messages to a URL plus normalised metadata', async () => {
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler({
        1: [
          message({
            id: 1,
            type: 'image',
            content: 'http://127.0.0.1:8000/storage/chat-images/11_36_1786940000.jpg',
            metadata: {
              size: 184320,
              caption: 'Here is my wallet history',
              mime_type: 'image/jpeg',
              original_name: 'wallet-screenshot.jpg',
            },
          }),
        ],
      })
    );

    const { result } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));

    const media = result.current.messages[0];
    expect(media.isImage).toBe(true);
    expect(media.imageUrl).toContain('/storage/chat-images/');
    // The caption is the message's text; `content` is the file, not prose.
    expect(media.text).toBe('Here is my wallet history');
    expect(media.image).toMatchObject({
      original_name: 'wallet-screenshot.jpg',
      mime_type: 'image/jpeg',
      size: 184320,
    });
  });

  it('treats the no-email 422 as a block, not a retryable error', async () => {
    server.use(
      http.get(`${API_BASE}/staff/chat/conversations`, () =>
        HttpResponse.json(
          {
            status: 'error',
            message: "Staff account 'system_admin' has no email address.",
          },
          { status: 422 }
        )
      )
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.blockedMessage).not.toBeNull());

    // Not `error`: no Retry button, because retrying can never fix it.
    expect(result.current.blockedMessage).toContain('no email address');
    expect(result.current.error).toBeNull();
    expect(result.current.conversations).toHaveLength(0);
  });

  it('sets isForbidden (not error) on a 403 — a role change mid-session', async () => {
    server.use(
      http.get(`${API_BASE}/staff/chat/conversations`, () =>
        HttpResponse.json({ status: 'error', code: 'FORBIDDEN' }, { status: 403 })
      )
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.isForbidden).toBe(true));

    expect(result.current.error).toBeNull();
    expect(result.current.isLoading).toBe(false);
  });

  it('surfaces a thread load failure without taking the conversation list down', async () => {
    server.use(
      conversationsHandler([conversation()]),
      http.get(`${API_BASE}/staff/chat/conversations/:id/messages`, () =>
        HttpResponse.json(
          { status: 'error', message: 'Conversation not found or access denied.' },
          { status: 404 }
        )
      )
    );

    const { result } = renderHook(() => useChat());
    await waitFor(() => expect(result.current.conversations).toHaveLength(1));

    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.threadError).not.toBeNull());

    expect(result.current.threadError).toContain('not found');
    expect(result.current.error).toBeNull();
    expect(result.current.conversations).toHaveLength(1);
  });

  it('formats message stamps in the active locale rather than a pinned one', async () => {
    server.use(
      conversationsHandler([conversation()]),
      messagesHandler({ 1: [message({ id: 1 })] })
    );

    const { result, rerender } = renderHook(() => useChat());
    act(() => result.current.selectConversation(9101));
    await waitFor(() => expect(result.current.messages).toHaveLength(1));
    const englishDay = result.current.messages[0].dayLabel;

    await act(async () => {
      await i18n.changeLanguage('ar');
    });
    rerender();
    await waitFor(() => expect(result.current.messages[0].dayLabel).not.toBe(englishDay));

    await i18n.changeLanguage('en');
  });
});
