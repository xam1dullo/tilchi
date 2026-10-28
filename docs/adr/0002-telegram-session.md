# 0002. Telegram session and webhook

Date: 2026-10-27
Status: accepted

## Context

Learners, teachers, and admins share one session across the site, the bot, and the Telegram Mini App. An earlier review of the Cloudflare apps showed webhook IP allow-lists and bearer tokens in browser storage.

## Decision

Telegram deep link, confirm, and Mini App initData open the same session. Postgres is the source of truth. Redis caches a session for 5 minutes. A handoff lives 5 minutes. A session lasts 30 days, sliding, with an absolute cap, and is multi-device. Web logout clears the current session. The bot can revoke all sessions for a user.

`POST /auth/start` creates a handoff only. `POST /auth/confirm` creates a session only after `/bot/webhook` marks that handoff confirmed with a `telegramUserId`. An unconfirmed handoff cannot create a session. In production that refusal is `403 handoff_unconfirmed` (same posture as an unset webhook secret).

The browser receives only the `__Host-tilchi_sid` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. Redis (and later Postgres) store the SHA-256 of the cookie value (`secretHash`), never the raw token. The API rejects an `Authorization: Bearer` session. The web app does not write the session to localStorage or sessionStorage.

`/auth/start` allows 5 requests per minute per IP and 3 per minute per Telegram key. The IP comes from nginx `X-Real-IP` / Express `req.ip` (trust proxy 1), not from a client-controlled `X-Forwarded-For` list. Counters live in Redis with TTL.

`/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` with a constant-time compare. If that secret is unset, production refuses the webhook. There is no IP-range bypass.

## Consequences

Local HTTP cannot store a `__Host-` cookie. Production is HTTPS. The Phase 1 session store is in memory behind the cookie. Postgres and Redis replace it without changing the cookie.
