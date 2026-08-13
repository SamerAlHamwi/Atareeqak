-- ============================================================================
-- Phase 7 + 8 — REVERT the deliberate temporary seed
-- ============================================================================
--
-- Undoes `seed-phase-7-8.sql` exactly, plus anything a `--mutate` verification
-- run wrote on top of those rows.
--
-- RUN
-- ---
--   "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" \
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db < docs/api/revert-phase-7-8.sql
--   cd ../4th_year_projects_refractored && php artisan cache:clear
--
-- Then prove it, read-only:
--   GET /staff/complaints            → total 0, counts all zero
--   GET /staff/escalated-complaints  → total 0, counts all zero
--   GET /staff/reviews               → total 0
--
-- WHY THE NOTIFICATION DELETES ARE HERE
-- -------------------------------------
-- `respond` and `resolveEscalated` both fire NotificationService::createNotification
-- for the complaining user. A --mutate run therefore leaves rows behind in
-- `notifications` + the `user_notifications` join table (Phase 6 note: notifications
-- are linked through the JOIN TABLE, not notifications.user_id, which is left null).
-- Deleting only the complaints would leave those orphans behind.
-- ============================================================================

-- Notifications produced by respond() / resolveEscalated() on the seeded complaints.
-- data->>'$.complaint_id' is how the service stamps them.
DELETE un FROM user_notifications un
  JOIN notifications n ON n.id = un.notification_id
 WHERE n.type IN ('complaint_response', 'complaint_resolved')
   AND JSON_EXTRACT(n.data, '$.complaint_id') BETWEEN 1 AND 12;

DELETE FROM notifications
 WHERE type IN ('complaint_response', 'complaint_resolved')
   AND JSON_EXTRACT(data, '$.complaint_id') BETWEEN 1 AND 12;

-- Seeded rows themselves.
DELETE FROM complaint_attachments WHERE id BETWEEN 1 AND 2;
DELETE FROM complaints            WHERE id BETWEEN 1 AND 12;
DELETE FROM profile_comments      WHERE id BETWEEN 1 AND 8;

-- Return the auto-increment counters to their pre-seed state so a future seed
-- reproduces the same ids this document quotes.
ALTER TABLE complaints            AUTO_INCREMENT = 1;
ALTER TABLE complaint_attachments AUTO_INCREMENT = 1;
ALTER TABLE profile_comments      AUTO_INCREMENT = 1;

-- Verify (all three must be 0).
SELECT (SELECT COUNT(*) FROM complaints)            AS complaints,
       (SELECT COUNT(*) FROM complaint_attachments) AS attachments,
       (SELECT COUNT(*) FROM profile_comments)      AS profile_comments;
