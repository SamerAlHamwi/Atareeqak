-- ============================================================================
-- Chat page — DELIBERATE TEMPORARY SEED for `conversations` / `messages`
-- ============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Probed 2026-08-17 against the running backend, all three staff chat routes
-- answer but there is nothing to answer WITH:
--
--     GET /staff/chat/conversations           -> {"total":0,"data":[]}
--     SELECT COUNT(*) FROM conversations      -> 0
--     SELECT COUNT(*) FROM messages           -> 0
--
-- So the conversation list, its pagination, the thread view, message paging,
-- the image/media branch and the empty states all render against nothing.
-- This file seeds only `conversations`, `conversation_participants` and
-- `messages`; it is reverted by `revert-phase-chat.sql`. Same approach as
-- Phase 7/8's complaints and Phase 9's wallet requests.
--
-- RUN
-- ---
--   Get-Content docs/api/seed-phase-chat.sql -Encoding UTF8 -Raw | & "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" `
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db --default-character-set=utf8mb4
--
-- No `cache:clear` is needed — StaffChatController queries directly and caches
-- nothing.
--
-- ⚠️ THE AGENT IS USER 36, NOT EMPLOYEE 1
-- ------------------------------------------
-- Chat participants are `users` rows. Staff are `employees` rows. The bridge is
-- `Employee::email -> User::email`, and EmployeeManagementService::ensureShadowUser()
-- creates the User silently on first access. User 36 is the shadow account for
-- employee `system_admin` (primary@admin.com) and was created by the first
-- GET /staff/chat/conversations call. Seeding against any other id produces
-- conversations that employee cannot see.
--
-- WHAT IT EXERCISES
-- -----------------
-- 14 conversations (ids 9101-9114) and 87 messages (ids 9001-9087),
-- all ids far above the auto-increment so the revert is an exact, closed range:
--
--   · 13 `support` conversations -> **2 pages at per_page=10**, 3 at per_page=5.
--     The list endpoint is NOT paginated server-side (it returns every row plus
--     a `total`), so this is what makes the dashboard's client-side paging real.
--   · 9101 carries 62 messages -> **2 pages at the API's default limit=50**,
--     which is what makes "load older messages" a real request and not a no-op.
--   · BOTH message types: 58 `text` and 5 `image`. Image `content` is a storage
--     PATH (ChatMessageHandler::formatMessage turns it into a URL via
--     FileUploadService::url); `metadata` carries original_name/size/mime_type
--     /caption, exactly as FileUploadService::uploadChatImage writes it.
--     ⚠️ Those files do not exist on disk and FILESYSTEM_DISK=local with no
--     `storage:link`, so every image URL 404s — the same BUG-7 condition as
--     verification documents. That is deliberate: it exercises the dashboard's
--     "media unavailable" fallback, which is the NORMAL case in this
--     environment, not an edge case.
--   · 9104 has ZERO messages -> `last_message: null` on the list row.
--   · 9102 ends on an AGENT message and 9103 on a CUSTOMER message, so
--     `last_message.sent_by_agent` is exercised in both directions.
--   · 9113 is image-only, so a list row whose `last_message.content` is a URL
--     rather than prose is rendered for real.
--   · 9114 is the CONTROL: the only `private` conversation. It is what proved
--     BUG-14 — getOtherParticipant() early-returned null unless
--     type === 'private', so before the fix this was the ONLY row in the set
--     whose `user` block came back populated. Since the fix (2026-08-17) all 14
--     rows carry an identity, and 9114 is now the regression anchor: if it is
--     ever the only identified row again, that guard has been reverted.
--
-- `updated_at` is distinct per conversation (the list is orderBy updated_at
-- desc), so row order and page 2 are deterministic.
-- ============================================================================

START TRANSACTION;

-- ── 1. Conversations ────────────────────────────────────────────────────────
INSERT INTO `conversations` (`id`, `type`, `title`, `metadata`, `created_at`, `updated_at`)
VALUES
  -- long thread — 62 messages, 2 pages at limit=50, 2 images
  (9101, 'support', NULL, NULL, '2026-08-17 09:40:00', '2026-08-17 09:40:00'),
  -- last message sent by the AGENT
  (9102, 'support', NULL, NULL, '2026-08-17 08:15:00', '2026-08-17 08:15:00'),
  -- last message sent by the CUSTOMER
  (9103, 'support', NULL, NULL, '2026-08-16 19:02:00', '2026-08-16 19:02:00'),
  -- EMPTY — no messages at all (last_message null)
  (9104, 'support', NULL, NULL, '2026-08-16 17:30:00', '2026-08-16 17:30:00'),
  (9105, 'support', NULL, NULL, '2026-08-16 12:11:00', '2026-08-16 12:11:00'),
  (9106, 'support', NULL, NULL, '2026-08-15 20:45:00', '2026-08-15 20:45:00'),
  (9107, 'support', NULL, NULL, '2026-08-15 14:20:00', '2026-08-15 14:20:00'),
  (9108, 'support', NULL, NULL, '2026-08-14 18:05:00', '2026-08-14 18:05:00'),
  (9109, 'support', NULL, NULL, '2026-08-14 10:50:00', '2026-08-14 10:50:00'),
  (9110, 'support', NULL, NULL, '2026-08-13 16:35:00', '2026-08-13 16:35:00'),
  (9111, 'support', NULL, NULL, '2026-08-13 09:10:00', '2026-08-13 09:10:00'),
  (9112, 'support', NULL, NULL, '2026-08-12 21:25:00', '2026-08-12 21:25:00'),
  -- image-only thread
  (9113, 'support', NULL, NULL, '2026-08-12 11:00:00', '2026-08-12 11:00:00'),
  -- CONTROL — type=private (see the BUG-14 note in the header)
  (9114, 'private', NULL, NULL, '2026-08-11 15:00:00', '2026-08-11 15:00:00');

-- ── 2. Participants (agent + customer on each) ──────────────────────────────
INSERT INTO `conversation_participants`
  (`conversation_id`, `user_id`, `role`, `joined_at`, `created_at`, `updated_at`)
VALUES
  (9101, 36, 'agent', '2026-08-17 09:40:00', '2026-08-17 09:40:00', '2026-08-17 09:40:00'),
  (9101, 11, 'customer', '2026-08-17 09:40:00', '2026-08-17 09:40:00', '2026-08-17 09:40:00'),
  (9102, 36, 'agent', '2026-08-17 08:15:00', '2026-08-17 08:15:00', '2026-08-17 08:15:00'),
  (9102, 12, 'customer', '2026-08-17 08:15:00', '2026-08-17 08:15:00', '2026-08-17 08:15:00'),
  (9103, 36, 'agent', '2026-08-16 19:02:00', '2026-08-16 19:02:00', '2026-08-16 19:02:00'),
  (9103, 13, 'customer', '2026-08-16 19:02:00', '2026-08-16 19:02:00', '2026-08-16 19:02:00'),
  (9104, 36, 'agent', '2026-08-16 17:30:00', '2026-08-16 17:30:00', '2026-08-16 17:30:00'),
  (9104, 14, 'customer', '2026-08-16 17:30:00', '2026-08-16 17:30:00', '2026-08-16 17:30:00'),
  (9105, 36, 'agent', '2026-08-16 12:11:00', '2026-08-16 12:11:00', '2026-08-16 12:11:00'),
  (9105, 15, 'customer', '2026-08-16 12:11:00', '2026-08-16 12:11:00', '2026-08-16 12:11:00'),
  (9106, 36, 'agent', '2026-08-15 20:45:00', '2026-08-15 20:45:00', '2026-08-15 20:45:00'),
  (9106, 16, 'customer', '2026-08-15 20:45:00', '2026-08-15 20:45:00', '2026-08-15 20:45:00'),
  (9107, 36, 'agent', '2026-08-15 14:20:00', '2026-08-15 14:20:00', '2026-08-15 14:20:00'),
  (9107, 17, 'customer', '2026-08-15 14:20:00', '2026-08-15 14:20:00', '2026-08-15 14:20:00'),
  (9108, 36, 'agent', '2026-08-14 18:05:00', '2026-08-14 18:05:00', '2026-08-14 18:05:00'),
  (9108, 18, 'customer', '2026-08-14 18:05:00', '2026-08-14 18:05:00', '2026-08-14 18:05:00'),
  (9109, 36, 'agent', '2026-08-14 10:50:00', '2026-08-14 10:50:00', '2026-08-14 10:50:00'),
  (9109, 19, 'customer', '2026-08-14 10:50:00', '2026-08-14 10:50:00', '2026-08-14 10:50:00'),
  (9110, 36, 'agent', '2026-08-13 16:35:00', '2026-08-13 16:35:00', '2026-08-13 16:35:00'),
  (9110, 20, 'customer', '2026-08-13 16:35:00', '2026-08-13 16:35:00', '2026-08-13 16:35:00'),
  (9111, 36, 'agent', '2026-08-13 09:10:00', '2026-08-13 09:10:00', '2026-08-13 09:10:00'),
  (9111, 21, 'customer', '2026-08-13 09:10:00', '2026-08-13 09:10:00', '2026-08-13 09:10:00'),
  (9112, 36, 'agent', '2026-08-12 21:25:00', '2026-08-12 21:25:00', '2026-08-12 21:25:00'),
  (9112, 22, 'customer', '2026-08-12 21:25:00', '2026-08-12 21:25:00', '2026-08-12 21:25:00'),
  (9113, 36, 'agent', '2026-08-12 11:00:00', '2026-08-12 11:00:00', '2026-08-12 11:00:00'),
  (9113, 23, 'customer', '2026-08-12 11:00:00', '2026-08-12 11:00:00', '2026-08-12 11:00:00'),
  (9114, 36, 'agent', '2026-08-11 15:00:00', '2026-08-11 15:00:00', '2026-08-11 15:00:00'),
  (9114, 24, 'customer', '2026-08-11 15:00:00', '2026-08-11 15:00:00', '2026-08-11 15:00:00');

-- ── 3. Messages ─────────────────────────────────────────────────────────────
INSERT INTO `messages`
  (`id`, `conversation_id`, `sender_id`, `type`, `content`, `metadata`, `created_at`, `updated_at`)
VALUES
  (9001, 9101, 11, 'text', 'Hello, I was charged twice for trip #4821 last night.', NULL, '2026-08-17 06:00:00', '2026-08-17 06:00:00'),
  (9002, 9101, 36, 'text', 'Hello, thanks for reaching out. Let me pull up that trip for you.', NULL, '2026-08-17 06:03:00', '2026-08-17 06:03:00'),
  (9003, 9101, 11, 'text', 'Thank you. The amount was 12,500 SYP each time.', NULL, '2026-08-17 06:06:00', '2026-08-17 06:06:00'),
  (9004, 9101, 36, 'text', 'I can see two authorisations on the wallet, one at 21:14 and one at 21:15.', NULL, '2026-08-17 06:09:00', '2026-08-17 06:09:00'),
  (9005, 9101, 11, 'text', 'Yes, exactly those two.', NULL, '2026-08-17 06:12:00', '2026-08-17 06:12:00'),
  (9006, 9101, 36, 'text', 'The second one looks like a retry after a timeout. I am checking with the wallet team.', NULL, '2026-08-17 06:15:00', '2026-08-17 06:15:00'),
  (9007, 9101, 11, 'image', 'chat-images/11_36_1786940000.jpg', '{"original_name":"wallet-screenshot.jpg","size":184320,"mime_type":"image/jpeg","caption":"Here is my wallet history"}', '2026-08-17 06:18:00', '2026-08-17 06:18:00'),
  (9008, 9101, 36, 'text', 'Got the screenshot, that confirms the duplicate. Opening a refund request now.', NULL, '2026-08-17 06:21:00', '2026-08-17 06:21:00'),
  (9009, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 06:24:00', '2026-08-17 06:24:00'),
  (9010, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 06:27:00', '2026-08-17 06:27:00'),
  (9011, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 06:30:00', '2026-08-17 06:30:00'),
  (9012, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 06:33:00', '2026-08-17 06:33:00'),
  (9013, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 06:36:00', '2026-08-17 06:36:00'),
  (9014, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 06:39:00', '2026-08-17 06:39:00'),
  (9015, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 06:42:00', '2026-08-17 06:42:00'),
  (9016, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 06:45:00', '2026-08-17 06:45:00'),
  (9017, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 06:48:00', '2026-08-17 06:48:00'),
  (9018, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 06:51:00', '2026-08-17 06:51:00'),
  (9019, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 06:54:00', '2026-08-17 06:54:00'),
  (9020, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 06:57:00', '2026-08-17 06:57:00'),
  (9021, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 07:00:00', '2026-08-17 07:00:00'),
  (9022, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 07:03:00', '2026-08-17 07:03:00'),
  (9023, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 07:06:00', '2026-08-17 07:06:00'),
  (9024, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 07:09:00', '2026-08-17 07:09:00'),
  (9025, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 07:12:00', '2026-08-17 07:12:00'),
  (9026, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 07:15:00', '2026-08-17 07:15:00'),
  (9027, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 07:18:00', '2026-08-17 07:18:00'),
  (9028, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 07:21:00', '2026-08-17 07:21:00'),
  (9029, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 07:24:00', '2026-08-17 07:24:00'),
  (9030, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 07:27:00', '2026-08-17 07:27:00'),
  (9031, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 07:30:00', '2026-08-17 07:30:00'),
  (9032, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 07:33:00', '2026-08-17 07:33:00'),
  (9033, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 07:36:00', '2026-08-17 07:36:00'),
  (9034, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 07:39:00', '2026-08-17 07:39:00'),
  (9035, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 07:42:00', '2026-08-17 07:42:00'),
  (9036, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 07:45:00', '2026-08-17 07:45:00'),
  (9037, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 07:48:00', '2026-08-17 07:48:00'),
  (9038, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 07:51:00', '2026-08-17 07:51:00'),
  (9039, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 07:54:00', '2026-08-17 07:54:00'),
  (9040, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 07:57:00', '2026-08-17 07:57:00'),
  (9041, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 08:00:00', '2026-08-17 08:00:00'),
  (9042, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 08:03:00', '2026-08-17 08:03:00'),
  (9043, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 08:06:00', '2026-08-17 08:06:00'),
  (9044, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 08:09:00', '2026-08-17 08:09:00'),
  (9045, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 08:12:00', '2026-08-17 08:12:00'),
  (9046, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 08:15:00', '2026-08-17 08:15:00'),
  (9047, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 08:18:00', '2026-08-17 08:18:00'),
  (9048, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 08:21:00', '2026-08-17 08:21:00'),
  (9049, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 08:24:00', '2026-08-17 08:24:00'),
  (9050, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 08:27:00', '2026-08-17 08:27:00'),
  (9051, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 08:30:00', '2026-08-17 08:30:00'),
  (9052, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 08:33:00', '2026-08-17 08:33:00'),
  (9053, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 08:36:00', '2026-08-17 08:36:00'),
  (9054, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 08:39:00', '2026-08-17 08:39:00'),
  (9055, 9101, 36, 'text', 'The refund reference is REF-4821-02.', NULL, '2026-08-17 08:42:00', '2026-08-17 08:42:00'),
  (9056, 9101, 11, 'text', 'How long does a refund usually take?', NULL, '2026-08-17 08:45:00', '2026-08-17 08:45:00'),
  (9057, 9101, 36, 'text', 'Wallet refunds settle within one business day.', NULL, '2026-08-17 08:48:00', '2026-08-17 08:48:00'),
  (9058, 9101, 11, 'text', 'Understood, thank you.', NULL, '2026-08-17 08:51:00', '2026-08-17 08:51:00'),
  (9059, 9101, 36, 'text', 'Is there anything else about the trip I can help with?', NULL, '2026-08-17 08:54:00', '2026-08-17 08:54:00'),
  (9060, 9101, 11, 'text', 'The driver was fine, no complaints there.', NULL, '2026-08-17 08:57:00', '2026-08-17 08:57:00'),
  (9061, 9101, 36, 'image', 'chat-images/36_11_1786949000.png', '{"original_name":"refund-confirmation.png","size":96500,"mime_type":"image/png","caption":"Refund confirmation"}', '2026-08-17 09:00:00', '2026-08-17 09:00:00'),
  (9062, 9101, 11, 'text', 'Received, thank you very much for the help!', NULL, '2026-08-17 09:03:00', '2026-08-17 09:03:00'),
  (9063, 9102, 12, 'text', 'My driver cancelled after I already waited 15 minutes.', NULL, '2026-08-17 08:05:00', '2026-08-17 08:05:00'),
  (9064, 9102, 36, 'text', 'Sorry about that. I have flagged the driver and credited your wallet.', NULL, '2026-08-17 08:15:00', '2026-08-17 08:15:00'),
  (9065, 9103, 13, 'text', 'Hi, can I change the phone number on my account?', NULL, '2026-08-16 18:50:00', '2026-08-16 18:50:00'),
  (9066, 9103, 36, 'text', 'Yes — send me the new number and I will update it.', NULL, '2026-08-16 18:58:00', '2026-08-16 18:58:00'),
  (9067, 9103, 13, 'text', 'It is 0999 123 456.', NULL, '2026-08-16 19:02:00', '2026-08-16 19:02:00'),
  (9068, 9105, 15, 'text', 'The app shows my trip as still active but I arrived an hour ago.', NULL, '2026-08-16 12:00:00', '2026-08-16 12:00:00'),
  (9069, 9105, 36, 'text', 'Closed it on our side, it should refresh now.', NULL, '2026-08-16 12:10:00', '2026-08-16 12:10:00'),
  (9070, 9106, 16, 'text', 'How do I become a driver on the platform?', NULL, '2026-08-15 20:35:00', '2026-08-15 20:35:00'),
  (9071, 9106, 36, 'text', 'You can apply from the app under Account → Become a driver.', NULL, '2026-08-15 20:45:00', '2026-08-15 20:45:00'),
  (9072, 9107, 17, 'text', 'I was charged a cancellation fee I do not think is fair.', NULL, '2026-08-15 14:10:00', '2026-08-15 14:10:00'),
  (9073, 9107, 36, 'text', 'Reviewed it and waived the fee for you.', NULL, '2026-08-15 14:20:00', '2026-08-15 14:20:00'),
  (9074, 9108, 18, 'text', 'My verification has been pending for three days.', NULL, '2026-08-14 17:55:00', '2026-08-14 17:55:00'),
  (9075, 9108, 36, 'text', 'It is in the queue, you should hear back today.', NULL, '2026-08-14 18:05:00', '2026-08-14 18:05:00'),
  (9076, 9109, 19, 'text', 'Can I get a receipt for trip #3310?', NULL, '2026-08-14 10:40:00', '2026-08-14 10:40:00'),
  (9077, 9109, 36, 'text', 'Sent it to the email on your account.', NULL, '2026-08-14 10:50:00', '2026-08-14 10:50:00'),
  (9078, 9110, 20, 'text', 'The map keeps losing my location during trips.', NULL, '2026-08-13 16:25:00', '2026-08-13 16:25:00'),
  (9079, 9110, 36, 'text', 'Please update to the latest app version and try again.', NULL, '2026-08-13 16:35:00', '2026-08-13 16:35:00'),
  (9080, 9111, 21, 'text', 'I left a bag in the car, can you contact the driver?', NULL, '2026-08-13 09:00:00', '2026-08-13 09:00:00'),
  (9081, 9111, 36, 'text', 'Contacted them — they have the bag and will return it.', NULL, '2026-08-13 09:10:00', '2026-08-13 09:10:00'),
  (9082, 9112, 22, 'text', 'Why was my account suspended?', NULL, '2026-08-12 21:15:00', '2026-08-12 21:15:00'),
  (9083, 9112, 36, 'text', 'It was flagged automatically. I have restored it.', NULL, '2026-08-12 21:25:00', '2026-08-12 21:25:00'),
  (9084, 9113, 23, 'image', 'chat-images/23_36_1786930000.jpg', '{"original_name":"damaged-seat.jpg","size":240128,"mime_type":"image/jpeg","caption":""}', '2026-08-12 10:50:00', '2026-08-12 10:50:00'),
  (9085, 9113, 23, 'image', 'chat-images/23_36_1786930600.webp', '{"original_name":"receipt.webp","size":51200,"mime_type":"image/webp","caption":"And the receipt"}', '2026-08-12 11:00:00', '2026-08-12 11:00:00'),
  (9086, 9114, 24, 'text', 'This conversation is type=private, not support.', NULL, '2026-08-11 14:55:00', '2026-08-11 14:55:00'),
  (9087, 9114, 36, 'text', 'It exists only to show that `user` IS populated for private chats.', NULL, '2026-08-11 15:00:00', '2026-08-11 15:00:00');

COMMIT;

-- Expected afterwards (as employee `system_admin`):
--   GET /staff/chat/conversations                      -> total 14
--   GET /staff/chat/conversations/9101/messages        -> 50 rows (page 1)
--   GET /staff/chat/conversations/9101/messages?page=2 -> 12 rows
--   GET /staff/chat/conversations/9104/messages        -> 0 rows
--   the 9114 row is the only one with a non-null `user` block
SELECT c.id, c.type, COUNT(m.id) AS messages
FROM `conversations` c
LEFT JOIN `messages` m ON m.conversation_id = c.id
WHERE c.id BETWEEN 9101 AND 9114
GROUP BY c.id, c.type
ORDER BY c.id;
