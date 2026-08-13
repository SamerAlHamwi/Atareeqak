-- ============================================================================
-- Phase 9 — REVERT the deliberate temporary `wallet_requests` seed
-- ============================================================================
--
-- Undoes `seed-phase-9.sql` exactly, plus anything a `--mutate` verification run
-- wrote **on top of** those rows.
--
-- RUN
-- ---
--   Get-Content docs/api/revert-phase-9.sql -Encoding UTF8 -Raw | & "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" `
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db --default-character-set=utf8mb4
--
-- Then prove it, read-only:
--   GET /admin/wallet/requests → total 0, counts {pending:0, approved:0, rejected:0}
--
-- ⚠️ WHAT THIS FILE CANNOT UNDO BY ITSELF
-- ---------------------------------------
-- Deleting a request row does NOT reverse an approval. A real `--mutate` approve
-- also:
--   1. changed `wallets.balance` for the target wallet, and
--   2. wrote a `wallet_transactions` row (`reference = 'wallet_request:<id>'`).
--
-- Both are undone below, but the balance restore needs the ORIGINAL value, which
-- is machine-specific. `verify-reports.mjs --mutate` prints the exact
-- `UPDATE wallets SET balance = … WHERE id = …;` for whatever it touched — paste
-- it in place of the placeholder in step 2 before running that section.
--
-- The same applies to `POST /admin/wallet/charge`: a wallet charge is NOT
-- reversible through the API. It is a balance write plus an `ADM-*`
-- `wallet_transactions` row, exactly as Phase 5's passenger charge was.
-- ============================================================================

START TRANSACTION;

-- ── 1. Transactions written by a --mutate approve of a seeded request ───────
-- Safe to run even when nothing was mutated: the reference range is closed to
-- the seeded ids, so it can never touch the 194 original seed transactions.
DELETE FROM `wallet_transactions`
WHERE `reference` IN (
  'wallet_request:9001', 'wallet_request:9002', 'wallet_request:9003',
  'wallet_request:9004', 'wallet_request:9005', 'wallet_request:9006',
  'wallet_request:9007', 'wallet_request:9008', 'wallet_request:9009',
  'wallet_request:9010', 'wallet_request:9011', 'wallet_request:9012'
);

-- ── 2. Balance restore (fill in from the verify script's output) ────────────
-- UPDATE `wallets` SET `balance` = <original> WHERE `id` = <wallet_id>;

-- ── 3. Notifications created by a --mutate approve/reject ──────────────────
-- Both actions call NotificationService::createNotification, which writes to
-- `notifications` and to the `user_notifications` join table — the same pair
-- Phase 7/8's revert had to clean up.
DELETE un FROM `user_notifications` un
JOIN `notifications` n ON n.id = un.notification_id
WHERE n.type IN ('wallet_request_approved', 'wallet_request_rejected')
  AND n.created_at >= '2026-08-13';

DELETE FROM `notifications`
WHERE `type` IN ('wallet_request_approved', 'wallet_request_rejected')
  AND `created_at` >= '2026-08-13';

-- ── 4. The seeded rows themselves ───────────────────────────────────────────
DELETE FROM `wallet_requests` WHERE `id` BETWEEN 9001 AND 9012;

COMMIT;

-- Expected afterwards: 0 rows, and the auto-increment untouched by the seed
-- because every seeded id was explicit.
SELECT COUNT(*) AS wallet_requests_remaining FROM `wallet_requests`;
SELECT COUNT(*) AS wallet_transactions_remaining FROM `wallet_transactions`;
