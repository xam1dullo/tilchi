# 0009. LiveKit meetings

Date: 2026-10-27
Status: accepted

## Decision

Meetings use LiveKit for signaling at `/rtc` and host UDP for media. coturn provides TURN. A room holds at most 12 people. The small VPS runs one to three rooms at once. The teacher starts and ends the meeting. Learners may join after start until end.

A remote or meet control uses `POST /api/meet/ticket`. The ticket lasts 60 seconds and is a fresh random value. The handler reads `__Host-tilchi_sid` and does not put that cookie, or any bearer token, into the ticket or forward it to another peer. `/api/health` returns `{ ok, service }` and no secret flags.

Phase 1 does not render `/app/meet`. Ink-dark tiles are allowed later. See 0004.
