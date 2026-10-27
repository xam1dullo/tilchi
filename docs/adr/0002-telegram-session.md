# 0002. Telegram session and webhook

Date: 2026-10-27
Status: accepted
Source: reconstructed from BUILD-BRIEF-v1. The Mac originals in `tilchi-app` are not ported yet; reconcile when they are.

## Context

Learners, teachers, and admins share one session across the site, the bot, and the Telegram Mini App. An earlier review of the Cloudflare apps showed webhook IP allow-lists and bearer tokens in browser storage.

## Decision

Telegram deep link, confirm, and Mini App initData open the same session. The browser gets a handoff from `/auth/start`. The bot approves that handoff from the verified webhook with the Telegram user id. Only then does `/auth/confirm` set the cookie. An unapproved handoff gets `409 handoff_pending`, and each handoff opens at most one session. Postgres is the source of truth. Redis caches a session for 5 minutes. A handoff lives 5 minutes. A session lasts 30 days, sliding, and is multi-device. Web logout clears the current session. The bot can revoke all sessions for a user.

The browser receives only the `__Host-tilchi_sid` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. The API rejects an `Authorization: Bearer` session. The web app does not write the session to localStorage or sessionStorage.

`/auth/start` allows 5 requests per minute per IP and 3 per minute per Telegram key. The IP is `req.ip` behind one trusted proxy hop. nginx overwrites `X-Forwarded-For`, so a client cannot choose its own bucket.

`/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` with a constant-time compare. If that secret is unset, production refuses the webhook, and the API also refuses to boot in production without it (0010). There is no IP-range bypass.

## Consequences

Over plain HTTP, only browsers that treat `localhost` as a secure origin keep a `__Host-` cookie. Production is HTTPS. The Phase 1 session store is in memory behind the cookie. Postgres and Redis replace it without changing the cookie.
