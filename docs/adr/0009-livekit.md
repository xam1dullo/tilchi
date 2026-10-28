# 0009. LiveKit meetings

Date: 2026-10-27
Status: accepted

## Decision

Meetings use LiveKit for signaling at `/rtc` and host UDP for media. coturn provides TURN. A room holds at most 12 people. The small VPS runs one to three rooms at once. The teacher starts and ends the meeting. Learners may join after start until end.

`POST /api/meet/ticket` is a stub: it is not stored, not room-scoped, and not single-use. Do not mint LiveKit from it. LiveKit join waits on a signed, scoped, single-use ticket. Until then `POST /api/meet/lessons/:id/token` returns `501 meet_ticket_not_ready`. The handler still reads `__Host-tilchi_sid` only and never puts that cookie into a peer-facing value. `/api/health` returns `{ ok, service }` and no secret flags.

Phase 1 does not render `/app/meet`. Ink-dark tiles are allowed later. See 0004. LiveKit signaling stays on the compose network; nginx proxies `/rtc/`. Do not publish host port 7880.
