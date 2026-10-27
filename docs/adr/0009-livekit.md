# 0009. LiveKit meetings

Date: 2026-10-27
Amended: 2026-10-28
Status: accepted

## Decision

Meetings use LiveKit. Signaling goes through nginx at `/rtc` with the path kept as is: the client is given the site origin and appends `/rtc`, `/rtc/v1`, or `/rtc/validate` itself. Port 7880 is not published on the host. Media uses one muxed UDP port, 7882, with TCP 7881 as fallback; a bridge network cannot publish a port range big enough for 12 people × 3 rooms. On the VPS LiveKit must advertise the public address (`use_external_ip: true` or `--node-ip`), or remote clients get the container IP. coturn provides TURN on 3478 with relays on UDP 49160–49200. A room holds at most 12 people. The small VPS runs one to three rooms at once. The teacher starts and ends the meeting. Learners may join after start until end. The LiveKit identity is the user id, so a second device of the same user replaces the first in the room.

`POST /api/meet/token` with body `{ room }` reads `__Host-tilchi_sid` and returns a LiveKit access token: an HS256 JWT with `iss` = API key, `sub` = user id, a grant for that one room, and a 120-second lifetime. Nest mints it with the API secret, which never leaves the server. The token carries no session value, and the session cookie is never forwarded to a peer. A room name is `[A-Za-z0-9_-]{1,64}`.

LiveKit reads its keys from `LIVEKIT_KEYS`, built in `docker-compose.yml` from `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`. No key lives in `docker/livekit/livekit.yaml`. Compose has no default for either, or for `TURN_USER`/`TURN_PASSWORD`: a missing value stops `docker compose up` instead of starting LiveKit or coturn with a secret that is in git. Nest refuses to mint when the secret is shorter than 32 characters, and in production when the dev key or dev secret is set.

Phase 1 stub limit: there is no Group membership check yet, so production answers `503 meet_not_ready`. The check lands with the Group slice and the production refusal goes with it.

coturn takes its user from `--user` in compose, not from the config file, and denies relays to private, loopback, link-local, and CGNAT ranges so a TURN client cannot reach Postgres, Redis, or Nest. On the VPS, coturn needs `external-ip` and long-term credentials replaced by `use-auth-secret` before launch.

Phase 1 does not render `/app/meet`. Ink-dark tiles are allowed later. See 0004.
