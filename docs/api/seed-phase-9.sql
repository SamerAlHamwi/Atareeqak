-- ============================================================================
-- Phase 9 (Reports & Wallet) — DELIBERATE TEMPORARY SEED for `wallet_requests`
-- ============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Probed 2026-08-13 against the running backend, Phase 9 is **mixed**:
--
--     /admin/reports                → real data (71 rides, real balances)   ← no seed needed
--     /admin/wallets                → admin_wallets 2 · all_wallets 32       ← no seed needed
--     /admin/wallet/1/transactions  → 31 rows over 4 pages (194 total)       ← no seed needed
--     /admin/wallet/requests        → total 0, counts {0,0,0}                ← EMPTY
--
-- So `TransactionTable`, its `counts` badges, the status and type filters,
-- paging, and both the approve and reject actions render and verify against
-- nothing at all. This file seeds only `wallet_requests`, is documented here,
-- and is reverted by `revert-phase-9.sql`. Same approach as Phase 6's four
-- `photos` rows and Phase 7/8's complaints.
--
-- RUN
-- ---
--   Get-Content docs/api/seed-phase-9.sql -Encoding UTF8 -Raw | & "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" `
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db --default-character-set=utf8mb4
--
-- No `cache:clear` is needed: `AdminWalletRequestController::index()` queries
-- directly and its `counts` block is NOT cached. (`GET /admin/reports` *is*
-- cached 5 minutes, but this seed does not change anything it reports.)
--
-- WHAT IT EXERCISES
-- -----------------
-- 12 rows, ids 9001–9012 (deliberately far above the auto-increment so the
-- revert can delete an exact, closed id range):
--
--   · all THREE statuses, each non-zero, so every `counts` badge has a value:
--         pending 7 · approved 3 · rejected 2
--   · BOTH `type` values in every status, so the type filter is a real filter
--     and not just an echo:
--         pending  → charge 4 · withdraw 3
--         approved → charge 2 · withdraw 1
--         rejected → charge 1 · withdraw 1
--   · 7 pending rows → **2 pages at the smallest per_page (5)**, which is what
--     makes `TablePagination` and the page-resets-on-filter-change assertion
--     testable on the default tab.
--   · `user_notes` populated on some rows and NULL on others, so the note block
--     in the confirm dialog is exercised in both directions.
--   · `admin_notes` populated on the already-processed rows, so the table's
--     notes column renders.
--   · `created_at` spread over distinct days — the list is
--     `orderByDesc('created_at')`, so this makes row order deterministic and
--     page 2 genuinely different from page 1.
--
-- FK REALITY
-- ----------
-- A request points at BOTH a `user` and a `wallet`, and the pairs below are the
-- real ones from this seed (wallet 3 belongs to user 1, …, wallet 10 to user 8),
-- verified with:
--     SELECT w.id, w.user_id FROM wallets w JOIN users u ON u.id = w.user_id;
-- Mismatched pairs would still insert but would render a user against someone
-- else's phone number, which is worse than an empty table.
--
-- ⚠️ THESE ROWS DID NOT MOVE ANY MONEY
-- ------------------------------------
-- The `approved` and `rejected` rows are inserted with their final status
-- directly. No balance was changed and no `wallet_transactions` row was written
-- for them — unlike a real approve, which does both. That is deliberate: it
-- keeps this seed reversible by a single DELETE.
--
-- A `--mutate` verification run approves and rejects a **pending** row for real,
-- and that IS irreversible through the API: it changes a wallet balance and
-- writes a `wallet_transactions` row. `verify-reports.mjs` prints the balances,
-- the transaction rows created, and the SQL to undo all of it.
-- ============================================================================

START TRANSACTION;

INSERT INTO `wallet_requests`
  (`id`, `user_id`, `wallet_id`, `type`, `amount`, `status`, `user_notes`, `admin_notes`, `processed_by`, `processed_at`, `created_at`, `updated_at`)
VALUES
  -- ── pending · charge (4) ────────────────────────────────────────────────
  (9001, 1,  3, 'charge',   50000.00, 'pending',  'Please top up my wallet, receipt attached.', NULL, NULL, NULL, '2026-08-12 09:15:00', '2026-08-12 09:15:00'),
  (9002, 2,  4, 'charge',  125000.00, 'pending',  NULL,                                        NULL, NULL, NULL, '2026-08-12 11:40:00', '2026-08-12 11:40:00'),
  (9003, 3,  5, 'charge',    7500.00, 'pending',  'Small top-up before tonight’s ride.',        NULL, NULL, NULL, '2026-08-11 16:05:00', '2026-08-11 16:05:00'),
  (9004, 4,  6, 'charge',  300000.00, 'pending',  NULL,                                        NULL, NULL, NULL, '2026-08-11 08:20:00', '2026-08-11 08:20:00'),
  -- ── pending · withdraw (3) ──────────────────────────────────────────────
  (9005, 5,  7, 'withdraw', 25000.00, 'pending',  'Cash out to my bank account.',               NULL, NULL, NULL, '2026-08-10 14:00:00', '2026-08-10 14:00:00'),
  (9006, 6,  8, 'withdraw',  9000.00, 'pending',  NULL,                                        NULL, NULL, NULL, '2026-08-10 10:30:00', '2026-08-10 10:30:00'),
  (9007, 7,  9, 'withdraw', 60000.00, 'pending',  'Monthly earnings withdrawal.',               NULL, NULL, NULL, '2026-08-09 18:45:00', '2026-08-09 18:45:00'),
  -- ── approved · charge (2) + withdraw (1) ────────────────────────────────
  (9008, 8, 10, 'charge',   80000.00, 'approved', 'Top-up request.',                            'Receipt verified against the bank statement.', NULL, '2026-08-08 12:00:00', '2026-08-08 09:00:00', '2026-08-08 12:00:00'),
  (9009, 1,  3, 'charge',   15000.00, 'approved', NULL,                                        'Approved — routine top-up.',                   NULL, '2026-08-07 15:30:00', '2026-08-07 13:10:00', '2026-08-07 15:30:00'),
  (9010, 2,  4, 'withdraw', 40000.00, 'approved', 'Withdraw part of my earnings.',              'Identity confirmed, payout sent.',             NULL, '2026-08-06 17:20:00', '2026-08-06 10:05:00', '2026-08-06 17:20:00'),
  -- ── rejected · charge (1) + withdraw (1) ────────────────────────────────
  (9011, 3,  5, 'charge',  500000.00, 'rejected', 'Large top-up.',                              'Rejected — the uploaded receipt does not match the amount requested.', NULL, '2026-08-05 11:45:00', '2026-08-05 08:30:00', '2026-08-05 11:45:00'),
  (9012, 4,  6, 'withdraw',950000.00, 'rejected', NULL,                                        'Rejected — requested amount exceeds the available balance.',           NULL, '2026-08-04 19:00:00', '2026-08-04 16:15:00', '2026-08-04 19:00:00');

COMMIT;

-- Expected afterwards:
--   GET /admin/wallet/requests                        → counts {pending:7, approved:3, rejected:2}
--   GET /admin/wallet/requests?per_page=5             → meta.total 7, meta.last_page 2
--   GET /admin/wallet/requests?status=approved        → meta.total 3
--   GET /admin/wallet/requests?status=rejected        → meta.total 2
--   GET /admin/wallet/requests?type=withdraw          → meta.total 3   (pending ∩ withdraw)
--   GET /admin/wallet/requests?status=approved&type=charge → meta.total 2
SELECT status, type, COUNT(*) AS rows_seeded
FROM `wallet_requests`
WHERE `id` BETWEEN 9001 AND 9012
GROUP BY status, type
ORDER BY status, type;
