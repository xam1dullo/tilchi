# Unified platform: inventory and migration design

**Status:** design for review; not permission to access, modify, migrate or deploy production.
**Baseline:** new Tilchi `a616cada74f96a8f473f6c0a393d7a8fcc18940d`.
**Evidence:** local legacy classroom `c9ac68ff08ddb32965f5a0a4febc18fd74859691`
(two commits ahead of its remote); slide PWA `aeb9fb00d1f06392b0f8015d22b3c4d6d28a77da`
(local edits exist); standalone bot `89deee493d510b85817a4dc59ec37c3b18ab74c7`.
These are code observations, not evidence of what is deployed or what data exists.

## Intent and scope

One user-facing Tilchi platform on the chosen VPS, with one identity, web
experience and codebase. Web, API/bot, Postgres, Redis and LiveKit/TURN remain
separate runtime processes with explicit responsibilities. Preserve existing
valuable capabilities and records until an explicit product decision says
otherwise. In particular, homework, presenter/offline, quiz, parent-facing flows,
attendance, payments and files cannot silently disappear at cutover.

This intent conflicts with parts of the older [v1 PRD](v1.md) and
[roles ADR](../adr/0003-roles.md), which omit parent roles and defer or drop
some legacy features. Those decisions remain in force until deliberately
revised; this document records the conflict, not an already-approved schema or
new payment product. Live deployment topology, feature usage, data volume,
ownership and retention obligations are unverified.

## Source inventory and semantic mapping

The immutable source instance, source table and complete source primary key must
accompany every imported entity. A source instance identifies the actual D1
database or the offline origin, profile and device; equal keys from different
instances are not the same record. No table is renamed solely because its name
matches.

| Legacy source | Meaning and key | Target state / required decision |
| --- | --- | --- |
| App D1 `users`; bot D1 `users` / app `tg_users` | App text user ID; Telegram ID where present; bot registration state and lead history. Separate databases may overlap. | Target `users` uses UUID and unique text Telegram ID. Reconcile verified Telegram IDs and retain source-ID mapping. Missing IDs, ambiguous identities and conflicting records go to quarantine; never merge by name or phone alone. Keep multiple distinct leads and partial registrations. |
| `sessions`, `login_requests` | Legacy authentication and browser bindings. | Do not copy session secrets, token hashes or pending login state. Users sign in again via the new Telegram session flow. |
| App D1 `lessons` keyed by `(user_id,id)` | Teacher-owned reusable slides/PDF material. | **Not** a target scheduled `Lesson`. A separate versioned Presentation/Deck model and asset mapping must be designed before import. Preserve owner and composite source key. |
| `hw_groups` | Teacher-owned homework group with segment, timetable, duration, level, invite code and legacy meeting URL. | Target `groups` lacks several fields. Preserve unmapped fields in staging and explicitly design group ownership, timetable and course linkage; do not infer a Course from a segment. |
| `hw_members` keyed by `(group_id, telegram_id)` | Group member; a kids-group Telegram account can belong to the parent. | Target `group_members` requires a user UUID. Preserve the account, member name and provenance; resolve guardian/learner relationships explicitly. Never silently make a parent a child. |
| `hw_assignments`, `hw_submissions`, `hw_reviews` | Assignment steps and deadlines; per-step text/voice/photo submissions; teacher reviews and feedback. | No equivalent new schema yet. Add versioned assignment, submission, file-reference and review models before import; retain `file_id`, timestamps and ownership. Verify file retrieval and lifecycle separately. |
| `attendance` | Manual group/date/member status and note. | Target LiveKit `attendance_events` describe token/join/leave and require a scheduled lesson. Preserve manual records with provenance; do not convert them into fabricated join events. |
| `payments` | Existing period, amount, status and notes for a group/member. | No equivalent target model. Preserve source records and explicitly decide authorized visibility and retention before a compatible model/import. Do not claim ledger parity. |
| `xp_events` and quiz Durable Object | Persisted XP history in D1; live quiz room state is separately held by the Durable Object. | Model and reconcile historical events separately. Drain or finish active rooms before cutover; a D1 dump alone does not capture live room state. |
| `hw_outbox`, reminder flags, new `outbox` | Legacy delivery and reminder state; target has a different transactional outbox and retry policy. | Do not replay old rows into the new outbox. Reconcile pending notices, sent markers and a cutover watermark, and approve a delivery policy before enabling senders. |
| Per-origin, per-browser IndexedDB `EnglishTeacherDB` | Lessons, student groups, settings and classroom sessions, with owner IDs and local tombstones. Only lessons sync to D1. | Inventory every relevant origin/profile/device separately. Snapshot owned, unowned and deleted rows and assets with counts and checksums; preserve provenance. Do not migrate session tokens or local PINs. |

Evidence: legacy [remote schema](https://github.com/xam1dullo/inglish-teacher/blob/ad3a1e32711adc65361bb6ae64a7546bb2dfdc78/schema.sql),
[IndexedDB](https://github.com/xam1dullo/inglish-teacher/blob/ad3a1e32711adc65361bb6ae64a7546bb2dfdc78/src/db/dexie.ts),
[workspace sync](https://github.com/xam1dullo/inglish-teacher/blob/ad3a1e32711adc65361bb6ae64a7546bb2dfdc78/src/lib/workspaceSync.ts),
and current [Postgres schema](../../apps/api/src/db/schema.ts). The local legacy
schema adds XP events beyond that remote baseline. Verify the
actual deployed revisions and every live binding before using this mapping.

## Offline capture and conflict rules

- IndexedDB is scoped to browser profile **and origin**; matching database names
  do not imply shared contents. Enumerate the devices and origins in use.
- The existing JSON export omits settings, tombstones and unowned rows, so it is
  insufficient as the sole migration snapshot. Define a dedicated
  versioned, encrypted export with owner, source origin, record IDs, deletion
  metadata, attachment references and per-kind counts. Keep any credentials,
  browser sessions and local PINs out of migration artifacts.
- Do not blindly trigger legacy sync as a preparation step: legacy server delete
  is a hard delete, and a stale active local lesson can be uploaded when the
  server row is absent. A failed/unauthorized read can also be presented to sync
  as an empty list. Snapshot first; distinguish an empty successful read from
  an error; reconcile deletions explicitly before any source write.
- Legacy local lesson keys are `id`-only, while D1 uses `(user_id,id)`.
  Detect cross-owner and cross-device collisions; quarantine unresolved
  conflicts instead of overwriting. Record a tombstone/conflict policy and
  exercise two-device offline edit/delete/reconnect tests before cutover.
- Keep date-only attendance dates and weekly timetable values in their local
  civil-time meaning; convert actual instants to UTC with the agreed
  Asia/Tashkent interpretation. Preserve raw source values for review.

## Target ownership and adapter seams

- `Identity`: one verified Telegram account maps to one target user, and
  multiple verified source records may map to that user. Grant teacher/admin
  only via explicitly verified allowlists, never a legacy kind, name or
  username alone. The
  legacy parent/child relationship requires a deliberate domain and permission
  decision; it is not represented by the current target role enum.
- `Course` and `Group`: share one neutral segment/level vocabulary between
  bot and web. Add group-course assignment only with target validation,
  existing-data checks and explicit soft-delete behavior.
- `Lesson` is a scheduled Group event; `Presentation/Deck` is reusable
  teacher-owned content. Attachments must retain source identifiers and hashes.
- `Homework`, `Review`, `Attendance`, `Payment` and `Quiz` retain their
  distinct semantics and authorization. A human approves AI-generated review
  drafts; no legacy bearer token is sent to a peer.
- Postgres owns durable domain state; Redis is cache/coordination. Define and
  approve one object-storage adapter and file-retention policy before importing
  PDFs, voice or photos. ADR 0010 and ADR 0011 currently differ on storage;
  this document does not silently choose between them.

## Migration design: staging first

Choose snapshot + a controlled final write freeze rather than unverified
bidirectional sync. A brief freeze is a planning assumption, not an approved
production schedule. Exact capture and rollback mechanics must be rehearsed.

1. **Inventory without writes.** Confirm deployed code versions, D1 bindings,
   bot webhook, storage, quiz state, users, browser origins and accessible
   devices. Count records by source/type/owner and record unknowns without
   exposing personal data in reports.
2. **Create isolated fixtures and staging.** Use synthetic/anonymized examples,
   separate target Postgres/Redis and a test bot. Disable notification delivery.
   Model each missing domain before importing it; do not publish seeded courses
   or invent relationships.
3. **Capture and retain.** After explicit authorization where required, take
   consistent source snapshots and encrypted offline exports. Verify read access,
   retention, integrity and restoration. A source snapshot, imported data and
   reconciliation report need separate access controls; never commit them.
4. **Import with an idempotent mapping.** Store a durable unique mapping of
   `(source_instance, source_table, source_primary_key) → target UUID`.
   Generate UUID v7 once and reuse the mapping on retries. Validate relations
   before writes, use transactional checkpoints, quarantine ambiguous records
   and retain source timestamps/provenance. Never overwrite by row position.
5. **Reconcile.** Compare counts per source/type/owner and status, keys,
   referential integrity, duplicate Telegram IDs, orphaned members, deleted
   records, timezone interpretation, attachment availability and checksums.
   Review every quarantine item; a row-count match alone is not acceptance.
6. **Rehearse the final window.** Freeze legacy writers and gate stale offline
   clients from writing to either system. Track unavailable devices and reconcile
   their snapshots before readmission; do not assume the freeze can reach them.
   No D1 change-data capture is established, so after the freeze recapture the
   complete source and reconcile additions, changes **and deletions** rather
   than assuming timestamps capture a final delta. Validate teacher, learner,
   parent and admin workflows as applicable. Finish active quiz/meeting sessions.
   Rehearse notification watermarks and webhook handover with a test bot.
7. **Cutover only with separate approval.** Production migration, write freeze,
   webhook, DNS, secrets and deployment each require the documented owner
   approval. Keep the old stack and verified restore point available; do not
   promise a reverse-DNS-only rollback after new writes exist.

Rollback planning must say how writes made on the new platform are retained,
exported or reconciled with the old platform, how bot messages are handled, and
when returning to the old writer is no longer safe. Test rollback and restore on
staging before any production cutover.

## Acceptance gates and tests

- All source inventories and unknowns are signed off; no unreviewed quarantine
  records or unexplained count/hash differences remain.
- Repeated import and interrupted/resumed import produce the same target
  mappings without duplicate users, memberships, submissions or notices.
- Synthetic cases cover duplicate/missing Telegram IDs, parent-owned accounts,
  duplicate deck IDs across teachers, missing/deleted records, missing
  attachments, non-UTC civil dates, unauthorized source reads, verified-only
  privilege grants and same-key records from distinct source instances.
- Two-device tests cover offline edits, delete versus edit, reconnect, source
  errors and idempotent retries; no successful sync is inferred from an empty
  response or elapsed time alone. Include an unavailable device returning after
  cutover and a delete found only by comparing the final full source capture.
- The new product demonstrably preserves required user journeys and access
  control, including Telegram login, group lessons, materials, homework,
  feedback and the agreed parent/payment/quiz flows.
- A production-equivalent staging restore, webhook handover, rollback and
  multi-network LiveKit/TURN test have evidence and responsible owners.

## Open decisions and first implementation slices

1. Confirm the complete legacy feature/role parity and retention scope, including
   parent accounts, payments, offline settings and quiz history.
2. Resolve object storage jurisdiction and ADR conflict; define asset size,
   authorization and lifecycle limits.
3. Define guardian relationships, identity reconciliation and conflict
   resolution for unverifiable or unowned records.
4. Fix migration metadata drift: `0004_courses.sql` exists without a matching
   Drizzle snapshot. Reproduce generator behavior in isolation and add an
   upgrade/order test before relying on future generated migrations; the
   missing snapshot alone does not prove an already-applied migration failed.
5. Build the inventory exporter and synthetic reconciliation harness first;
   then implement domain schemas and import adapters in independently reviewed
   slices. Keep deployment and webhook changes outside these implementation PRs.
