# 0009. LiveKit meetings

Date: 2026-10-27
Status: accepted

## Decision

Meetings use self-hosted LiveKit. coturn provides TURN. A room holds at most 12 people (`room.max_participants`). The small VPS runs one to three rooms at once. The teacher starts and ends the meeting. Learners may join after start until end. Attendance is a LiveKit join.

Networking (see 0010):

- Signaling goes only through nginx at `/rtc`. Clients use `LIVEKIT_PUBLIC_URL=wss://<domain>/rtc`. Port 7880 is never published.
- Media uses 7881/tcp and one UDP port, 7882 (single-port mux). In production LiveKit advertises `--node-ip` (the public VPS IP).
- Nest calls the LiveKit server API inside the Docker network at `http://livekit:7880`.
- Nest and LiveKit share one key pair from env (`LIVEKIT_API_KEY`/`LIVEKIT_API_SECRET`). The entrypoint writes that pair into the server config and execs `/livekit-server`. Production refuses the dev pair.
- Browsers never hold LiveKit API keys. They get a per-room access token from Nest.

`POST /api/meet/ticket` is still a stub: it is not stored, not room-scoped, and not single-use. Do not mint LiveKit from it.

`POST /api/meet/lessons/:id/token` mints a 60-second room-scoped LiveKit JWT from `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` after the lesson is live and the actor is a group member (or admin). The handler reads `__Host-tilchi_sid` or, in `development`/`test` only, the demo preview header. It never puts the session cookie into the token or the response. Missing LiveKit credentials return `501 livekit_unconfigured` with a note. `/api/health` returns `{ ok, service }` and no secret flags.

`/app/meet/$lessonId` is the Phase 1 join surface. nginx keeps `/rtc` on shared server-level headers (no `proxy_set_header` inside the location). `location ^~ /rtc/` strips the prefix so `wss://<host>/rtc` + the SDK's `/rtc` path reaches LiveKit as `/rtc`. `location = /rtc` covers a connect to the bare `/rtc` path. Do not publish host port 7880.

## Open

- The ticket is issued but not yet stored or redeemable. It must be bound to user and room, and be single-use.
- coturn is not yet advertised to clients through `rtc.turn_servers` (0010, open item 3).
- LiveKit room teardown on lesson end is not wired.
