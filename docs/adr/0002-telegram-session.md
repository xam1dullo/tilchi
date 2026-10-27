# 0002. Telegram session and webhook

Date: 2026-10-27
Status: accepted

## Context

Learners, teachers, and admins share one session across the site, the bot, and the Telegram Mini App. An earlier review of the Cloudflare apps showed webhook IP allow-lists and bearer tokens in browser storage.

## Decision

Telegram deep link, confirm, and Mini App initData open the same session. Postgres is the source of truth. Redis caches a session for 5 minutes. A handoff lives 5 minutes. A session lasts 30 days, sliding, with an absolute cap, and is multi-device. Web logout clears the current session. The bot can revoke all sessions for a user.

`POST /auth/start` creates a handoff and sets `__Host-tilchi_hs` on the browser that called it (HttpOnly, Secure, SameSite=Lax, Path=/, 5 minutes). The handoff keeps only the SHA-256 of that cookie value, plus the requester's IP and user agent. The response never carries the cookie value.

The bot binds and confirms. `/start <id>` binds the handoff to the first Telegram user who opens it, then replies with the requester's IP and browser and a confirm button. Only a tap from that same user confirms. Anyone else, or an expired handoff, gets "expired or not yours".

`POST /auth/confirm` needs the handoff id, the `__Host-tilchi_hs` cookie, and the bot confirmation. It mints a session for the bound Telegram user, never a random id. Until all three hold it opens nothing:

- unknown, expired, or already used: `410 handoff_expired`
- cookie missing or from another browser: `403 wrong_browser`
- bot has not confirmed yet: `409 {"status":"waiting"}`, which the web app polls

A successful claim consumes the handoff with one atomic take (Redis `GETDEL`), so parallel claims cannot both open a session. Roles come from `TELEGRAM_TEACHER_ALLOWLIST` and `TELEGRAM_ADMIN_ALLOWLIST` on every login.

In production `POST /auth/confirm` returns `503 telegram_confirm_unavailable` while `TELEGRAM_WEBHOOK_SECRET` is unset, because the bot path cannot be trusted without it. `/bot/webhook` refuses in the same case.

`POST /auth/miniapp` opens the same session from Mini App `initData`. It checks the HMAC keyed by `TELEGRAM_BOT_TOKEN`, rejects an `auth_date` older than 1 hour or in the future, and fails closed when the bot token is unset.

Known residual risk: an attacker can start a handoff and send its deep link to a victim. If the victim confirms, the attacker's browser gets the victim's session. The bot message shows the requester's IP and browser and says to refuse a request the user did not start. A short match code shown in the browser and typed into the bot would close this. It is not built yet.

The browser receives only the `__Host-tilchi_sid` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. Redis (and later Postgres) store the SHA-256 of the cookie value (`secretHash`), never the raw token. The API rejects an `Authorization: Bearer` session. The web app does not write the session to localStorage or sessionStorage.

`/auth/start` allows 5 requests per minute per IP and 3 per minute per Telegram key. The IP comes from nginx `X-Real-IP` / Express `req.ip` (trust proxy 1), not from a client-controlled `X-Forwarded-For` list. Counters live in Redis with TTL.

`/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` with a constant-time compare. If that secret is unset, production refuses the webhook. There is no IP-range bypass.

## Consequences

Local HTTP cannot store a `__Host-` cookie. Production is HTTPS. The Phase 1 session store is in memory behind the cookie. Postgres and Redis replace it without changing the cookie.
