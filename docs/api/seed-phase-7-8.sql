-- ============================================================================
-- Phase 7 (Support / Complaints) + Phase 8 (Reviews) — DELIBERATE TEMPORARY SEED
-- ============================================================================
--
-- WHY THIS EXISTS
-- ---------------
-- Probed 2026-08-13 against the running backend, BOTH features have a completely
-- empty seed:
--
--     /staff/complaints            → total: 0, counts {all:0,pending:0,in_review:0,resolved:0,closed:0}
--     /staff/escalated-complaints  → total: 0, counts {escalated:0,resolved:0,closed:0}
--     /staff/reviews               → total: 0
--     complaints = 0 · complaint_attachments = 0 · profile_comments = 0
--
-- Nothing on either page renders against that seed — not a row, not a badge, not
-- a detail panel, not a single action. Filters and pagination cannot be told
-- apart from a broken query when every response is empty.
--
-- So this file seeds deliberately, is documented here, and is reverted by
-- `revert-phase-7-8.sql`. Same approach Phase 6 took for the four `photos` rows.
--
-- RUN
-- ---
--   "C:/Users/Tech/mysql-portable/mysql-8.0.40-winx64/bin/mysql.exe" \
--       -h 127.0.0.1 -P 3306 -u root 4th_year_project_db < docs/api/seed-phase-7-8.sql
--   cd ../4th_year_projects_refractored && php artisan cache:clear
--
-- The `cache:clear` matters: `staff.complaint-counts` and `staff.escalated-counts`
-- are 1-minute server caches, and the badge assertions read them.
--
-- WHAT IT EXERCISES
-- -----------------
-- complaints (12 rows, ids 1–12):
--   · all four `index` statuses  → pending 4 · in_review 2 · resolved 2 · closed 2
--   · plus 2 `escalated`, which `index` deliberately excludes and the separate
--     /staff/escalated-complaints endpoint serves
--   · 8 distinct `type` values across the rows (the whole ComplaintType enum)
--   · 10 index-visible rows → >1 page at per_page=5
--   · created_at spread so the `date` filter changes the ROW COUNT, not just its echo:
--         last_7_days  → 5 rows
--         last_30_days → 8 rows
--         (no filter)  → 10 rows
--   · complaint 4 is `pending` and UNASSIGNED, reserved for exercising the
--     GET /staff/complaints/{id} side effect (pending → in_review + assigned_to)
--
-- complaint_attachments (2 rows on complaint 1): one image/jpeg + one application/pdf,
--   so the inline-image path AND the download-link path both render. Both URLs 404
--   under BUG-7 — that is the point: the "unavailable" degradation is what ships.
--
-- profile_comments (8 rows, ids 1–8):
--   · 8 rows → >1 page at per_page=5
--   · distinct comment bodies containing the token "punctual" in exactly 2 of them
--     (ids 1 and 7) so `search=punctual` is provably server-side — ReviewModerationService
--     matches `comment LIKE %…%` ONLY, never the commenter/recipient name
--   · created_at spread: last_7_days → 3 · last_30_days → 6 · (none) → 8
--   · user 11 is the COMMENTER on id 1 and the RECIPIENT on id 8, so `user_id=11`
--     returns 2 rows and proves the service's commenter-OR-recipient branch
--
-- NOTE on profiles: profiles.id == profiles.user_id for every seeded row (verified),
-- so profile_id N addresses user N.
-- ============================================================================

-- ── complaints ──────────────────────────────────────────────────────────────
-- assigned_to is NULL everywhere except the two rows that model already-worked
-- tickets; employee 1 is the seeded `system_admin`.
INSERT INTO complaints (id, user_id, assigned_to, title, description, type, status, resolution_notes, resolved_at, created_at, updated_at) VALUES
 (1, 11, NULL, 'Driver took an unsafe route',        'The driver drove against traffic on the highway exit for about two kilometres. I felt genuinely unsafe for the whole trip.', 'trip_safety',        'pending',   NULL, NULL, NOW() - INTERVAL 2 DAY,  NOW() - INTERVAL 2 DAY),
 (2, 12, NULL, 'Driver was rude on pickup',          'The driver shouted at me for being one minute late to the pickup point and then complained for the rest of the ride.',        'driver_behavior',    'pending',   NULL, NULL, NOW() - INTERVAL 3 DAY,  NOW() - INTERVAL 3 DAY),
 (3, 13, NULL, 'Charged twice for one ride',         'My wallet was debited twice for the same trip on the same evening. Only one ride was actually taken.',                        'financial_issue',    'pending',   NULL, NULL, NOW() - INTERVAL 40 DAY, NOW() - INTERVAL 40 DAY),
 (4, 14, NULL, 'No seatbelt in the rear seats',      'None of the rear seatbelts in this vehicle were functional. The driver said it had been like that for months.',              'trip_safety',        'pending',   NULL, NULL, NOW() - INTERVAL 25 DAY, NOW() - INTERVAL 25 DAY),
 (5, 15, 1,    'App crashes when booking',           'The application closes itself every time I press the confirm booking button. It has happened six times today.',              'technical_issue',    'in_review', NULL, NULL, NOW() - INTERVAL 1 DAY,  NOW() - INTERVAL 1 DAY),
 (6, 16, 1,    'Cannot change my phone number',      'The account settings screen rejects my new phone number and says it is already registered, which it is not.',               'account_issue',      'in_review', NULL, NULL, NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 12 DAY),
 (7, 17, 1,    'Ride cancelled after I paid',        'The driver cancelled the ride after the payment had already gone through and I was left waiting at the pickup point.',      'ride_cancellation',  'resolved',  'Refund issued to the passenger wallet and the driver has been warned about late cancellations.', NOW() - INTERVAL 4 DAY,  NOW() - INTERVAL 5 DAY,  NOW() - INTERVAL 4 DAY),
 (8, 18, 1,    'Passenger left rubbish in my car',   'The passenger left food containers all over the back seat and refused to take them when I asked.',                          'passenger_behavior', 'resolved',  'Spoke to the passenger, who apologised. A cleaning credit was applied to the driver account.',   NOW() - INTERVAL 18 DAY, NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 18 DAY),
 (9, 19, 1,    'Wrong fare shown at drop-off',       'The fare on the summary screen was different from the one quoted when I booked the ride.',                                   'financial_issue',    'closed',    'Fare difference was the surge multiplier, which was displayed at booking. Explained to the user.', NOW() - INTERVAL 5 DAY,  NOW() - INTERVAL 6 DAY,  NOW() - INTERVAL 5 DAY),
(10, 20, 1,    'Duplicate account on my number',     'There appears to be a second account registered against my phone number that I did not create.',                            'other',              'closed',    'Duplicate account was disabled after identity confirmation. No further action needed.',            NOW() - INTERVAL 44 DAY, NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 44 DAY),
(11, 21, NULL, 'Driver refused to stop the trip',    'I asked the driver several times to stop and let me out and he kept driving for another ten minutes.',                      'trip_safety',        'escalated', '[ESCALATED by System Admin at 2026-08-09 10:00:00]\nSafety issue, needs an admin decision on the driver account.', NULL, NOW() - INTERVAL 4 DAY,  NOW() - INTERVAL 4 DAY),
(12, 22, NULL, 'Repeated overcharging by a driver',  'This is the third time the same driver has added charges to the fare that were never agreed at booking time.',              'financial_issue',    'escalated', '[ESCALATED by System Admin at 2026-08-01 10:00:00]\nRepeat offender, agent cannot action a payout reversal.',      NULL, NOW() - INTERVAL 15 DAY, NOW() - INTERVAL 15 DAY);

-- ── complaint_attachments ───────────────────────────────────────────────────
-- Both files are absent from disk (BUG-7): no `storage:link`, no written files.
-- That is deliberate — the UI must degrade visibly rather than show a broken glyph.
INSERT INTO complaint_attachments (id, complaint_id, path, original_name, mime_type, size, created_at, updated_at) VALUES
 (1, 1, 'complaints/seed-dashcam.jpg', 'dashcam-still.jpg', 'image/jpeg',       184320, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY),
 (2, 1, 'complaints/seed-route.pdf',   'route-report.pdf',  'application/pdf',   40960, NOW() - INTERVAL 2 DAY, NOW() - INTERVAL 2 DAY);

-- ── profile_comments (the "reviews" of Phase 8) ─────────────────────────────
-- profile_id = who the comment is ABOUT · user_id = who WROTE it.
INSERT INTO profile_comments (id, profile_id, user_id, comment, created_at, updated_at) VALUES
 (1,  5, 11, 'Driver was very punctual and the car was spotless.',            NOW() - INTERVAL 2 DAY,  NOW() - INTERVAL 2 DAY),
 (2,  5, 12, 'سائق ممتاز والسيارة نظيفة جدا، أنصح بالتعامل معه',              NOW() - INTERVAL 3 DAY,  NOW() - INTERVAL 3 DAY),
 (3,  6, 13, 'Arrived late but the ride itself was comfortable enough.',      NOW() - INTERVAL 4 DAY,  NOW() - INTERVAL 4 DAY),
 (4,  7, 14, 'Rude behaviour throughout, I would not ride with him again.',   NOW() - INTERVAL 10 DAY, NOW() - INTERVAL 10 DAY),
 (5,  8, 15, 'تعامل راق جدا والتزم بالموعد تماما',                            NOW() - INTERVAL 12 DAY, NOW() - INTERVAL 12 DAY),
 (6,  9, 16, 'The car smelled strongly of smoke for the whole trip.',         NOW() - INTERVAL 20 DAY, NOW() - INTERVAL 20 DAY),
 (7, 10, 17, 'Excellent driver, punctual as always and very polite.',         NOW() - INTERVAL 40 DAY, NOW() - INTERVAL 40 DAY),
 (8, 11, 18, 'لم يلتزم بالمسار المتفق عليه وتأخر كثيرا',                      NOW() - INTERVAL 45 DAY, NOW() - INTERVAL 45 DAY);
