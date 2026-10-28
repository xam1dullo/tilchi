-- Lessons scheduled before the outbox existed got no reminders. Queue the
-- future T-24h / T-15m ones. Same idempotency keys as a freshly created lesson
-- (`...:created`), so re-running this changes nothing; past notices are not replayed.
INSERT INTO "outbox" ("id", "event", "payload", "idempotency_key", "available_at")
SELECT
  gen_random_uuid(),
  'lesson.reminder',
  jsonb_build_object(
    'lessonId', l."id",
    'groupId', l."group_id",
    'scheduledAt', to_char(l."scheduled_at" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'lead', r.lead
  ),
  'lesson.reminder.' || r.lead || ':' || l."id" || ':created',
  l."scheduled_at" - r.delta
FROM "lessons" l
CROSS JOIN (VALUES ('24h', interval '24 hours'), ('15m', interval '15 minutes')) AS r(lead, delta)
WHERE l."status" = 'scheduled' AND l."scheduled_at" - r.delta > now()
ON CONFLICT ("idempotency_key") DO NOTHING;
