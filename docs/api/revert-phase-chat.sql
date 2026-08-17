-- ============================================================================
-- Chat page — REVERT the deliberate temporary chat seed
-- ============================================================================
--
-- Undoes `seed-phase-chat.sql` exactly, plus anything a live verification run
-- sent **into** those conversations.
--
-- RUN
-- ---
--   Get-Content docs/api/revert-phase-chat.sql -Encoding UTF8 -Raw | & "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" `
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db --default-character-set=utf8mb4
--
-- Then prove it, read-only:
--   GET /staff/chat/conversations -> {"total":0,"data":[]}
--
-- WHAT A VERIFICATION RUN ADDS ON TOP
-- -----------------------------------
-- `POST /staff/chat/conversations/{id}/messages` writes a `messages` row with a
-- fresh auto-increment id — BELOW the seeded 9001-9087 range, so an id-range
-- delete would miss it. Step 1 therefore deletes by `conversation_id` instead,
-- which is closed to the seeded conversations and cannot reach anything else.
-- (`messages.conversation_id` is ON DELETE CASCADE, so step 3 would catch them
-- anyway; step 1 is explicit so the row counts below are meaningful.)
--
-- Sending also `touch()`es `conversations.updated_at`. Nothing needs to undo
-- that — the rows are deleted outright.
--
-- ⚠️ WHAT THIS FILE DELIBERATELY DOES NOT TOUCH
-- ---------------------------------------------
-- The shadow `users` row for employee `system_admin` (user 36,
-- primary@admin.com). It was NOT created by this seed — the first
-- `GET /staff/chat/conversations` call created it via
-- EmployeeManagementService::ensureShadowUser(), it is permanent by design, and
-- the next such call would recreate it anyway. Deleting it would cascade
-- through `conversation_participants` and `messages` for real user data.
-- ============================================================================

START TRANSACTION;

-- ── 1. Messages in the seeded conversations (seeded AND live-sent) ──────────
DELETE FROM `messages` WHERE `conversation_id` BETWEEN 9101 AND 9114;

-- ── 2. Participants ─────────────────────────────────────────────────────────
DELETE FROM `conversation_participants` WHERE `conversation_id` BETWEEN 9101 AND 9114;

-- ── 3. The conversations themselves ─────────────────────────────────────────
DELETE FROM `conversations` WHERE `id` BETWEEN 9101 AND 9114;

COMMIT;

-- Expected afterwards: 0 rows in all three, and the auto-increment untouched by
-- the seed because every seeded conversation/message id was explicit.
SELECT COUNT(*) AS conversations_remaining FROM `conversations`;
SELECT COUNT(*) AS participants_remaining  FROM `conversation_participants`;
SELECT COUNT(*) AS messages_remaining      FROM `messages`;
