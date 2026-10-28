# 0009. LiveKit meetings

Date: 2026-10-27
Status: accepted

## Decision

Meetings use LiveKit for signaling at `/rtc` and host UDP for media. coturn provides TURN. A room holds at most 12 people. The small VPS runs one to three rooms at once. The teacher starts and ends the meeting. Learners may join after start until end.

`POST /api/meet/ticket` is still a stub: it is not stored, not room-scoped, and not single-use. Do not mint LiveKit from it.

`POST /api/meet/lessons/:id/token` mints a 60-second room-scoped LiveKit JWT from `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` after the lesson is live and the actor is a group member (or admin). The handler reads `__Host-tilchi_sid` or, outside production, the demo preview header. It never puts the session cookie into the token or the response. Missing LiveKit credentials return `501 livekit_unconfigured` with a note. `/api/health` returns `{ ok, service }` and no secret flags.

`/app/meet/$lessonId` is the Phase 1 join surface. nginx proxies `/rtc` to LiveKit without stripping the path (the SDK talks to `/rtc` on the public host). Do not publish host port 7880.
