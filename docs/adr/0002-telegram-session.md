# 0002. Telegram session and webhook

Date: 2026-10-27
Status: accepted

## Context

Learners, teachers, and admins share one session across the site, the bot, and the Telegram Mini App. An earlier review of the Cloudflare apps showed webhook IP allow-lists and bearer tokens in browser storage.

## Decision

Telegram deep link, confirm, and Mini App initData open the same session. Postgres is the source of truth. Redis caches a session for 5 minutes. A handoff lives 5 minutes. A session lasts 30 days, sliding, and is multi-device. Web logout clears the current session. The bot can revoke all sessions for a user.

The browser receives only the `__Host-tilchi_sid` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. The API rejects an `Authorization: Bearer` session. The web app does not write the session to localStorage or sessionStorage.

`/auth/start` allows 5 requests per minute per IP and 3 per minute per Telegram key.

`/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` with a constant-time compare. If that secret is unset, production refuses the webhook. There is no IP-range bypass.

## Consequences

Local HTTP cannot store a `__Host-` cookie. Production is HTTPS. The Phase 1 session store is in memory behind the cookie. Postgres and Redis replace it without changing the cookie.
