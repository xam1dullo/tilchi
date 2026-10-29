# 0012. Phase 1 classroom loop

Date: 2026-10-28
Status: accepted

## Decision

Phase 1 `/app` lists the session user's groups from the API. An empty membership still shows the existing empty state. Teachers and admins can create a group, schedule a lesson, start and end it, and open `/app/meet/$lessonId` while it is live. Learners see membership groups and join only after start.

Local compose is HTTP, so `__Host-tilchi_sid` will not stick in the browser. Preview stays an env/query path (`TILCHI_PREVIEW_ROLE`, `?preview=learner|teacher|admin`) and never writes the session to localStorage. Nest accepts `X-Tilchi-Preview-Role` only when `NODE_ENV` is `development` or `test` and `TILCHI_DEMO=1` or a preview role is set. The same gate seeds one teacher, one learner, one group with both members, and one scheduled lesson on boot. Production never seeds, nginx clears the preview header, and Nest refuses to start if either flag is set.

Web reads `process.env['NODE_ENV']` and `process.env['TILCHI_PREVIEW_ROLE']` with bracket access so a Vite-built image still sees compose.dev runtime values.

## Consequences

`GET /api/demo/preview` is 404 in production. Health stays `{ ok, service }`. Auth confirm, handoff, webhook, and `Kv.take` / `Kv.cas` stay on the XAM-776 line.
