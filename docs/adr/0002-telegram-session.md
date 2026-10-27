# 0002. Telegram session and webhook

Date: 2026-10-27
Amended: 2026-10-28
Status: accepted

## Context

Learners, teachers, and admins share one session across the site, the bot, and the Telegram Mini App. An earlier review of the Cloudflare apps showed webhook IP allow-lists and bearer tokens in browser storage.

## Decision

Telegram deep link, confirm, and Mini App initData open the same session. Postgres is the source of truth. Redis caches a session for 5 minutes. A handoff lives 5 minutes. A session lasts 30 days, sliding, and is multi-device. Web logout clears the current session. The bot can revoke all sessions for a user.

The browser receives only the `__Host-tilchi_sid` cookie: HttpOnly, Secure, SameSite=Lax, Path=/. The API rejects an `Authorization: Bearer` session. The web app does not write the session to localStorage or sessionStorage.

Handoff: `POST /auth/start` returns a public `handoffId` for the bot deep link and sets `__Host-tilchi_handoff` (HttpOnly, 5 minutes) holding `<handoffId>.<secret>`. Only the bot confirms a handoff, after the Telegram user taps confirm; there is no HTTP route that confirms. The first confirm wins, so a forwarded deep link cannot swap the account. Whoever holds the claim cookie gets the session of whoever confirms, so the bot's confirm prompt must show the requesting device and time. The prompt names the browser and system, picked from a fixed list matched against the `User-Agent` so no request text is echoed, and the time in Asia/Tashkent. `POST /auth/claim` answers 202 while waiting, 410 when expired or when the cookie secret does not match, and on success sets `__Host-tilchi_sid` and clears the handoff cookie. A leaked deep link cannot open a session in another browser. The same Telegram user maps to the same user id on every device.

`/auth/start` allows 5 requests per minute per IP and 3 per minute per Telegram key. The Telegram key is a verified Telegram user id (Mini App initData) and is never read from the request body: a client-chosen key would let anyone lock a victim out. The IP is Express `req.ip` with `trust proxy` 1. nginx is the edge (Cloudflare is DNS-only), so it overwrites `X-Forwarded-For` with `$remote_addr`; a client-sent header never reaches the limiter.

`/bot/webhook` checks `X-Telegram-Bot-Api-Secret-Token` against `TELEGRAM_WEBHOOK_SECRET` with a constant-time compare. If that secret is unset, production refuses the webhook. There is no IP-range bypass.

## Consequences

Browsers store a `__Host-` cookie over plain HTTP only on `localhost`. Every other host needs HTTPS. The Phase 1 session store is in memory behind the cookie. Postgres and Redis replace it without changing the cookie.

What Phase 1 ships: the deep link and the bot confirm. Mini App initData (`POST /auth/miniapp`, checked with `TELEGRAM_BOT_TOKEN`) is not built, so the per-Telegram-key limit has no caller yet. The bot answers inside the webhook response, so signing in makes no outbound Telegram call and needs no bot token. The user row is written to Postgres at confirm. Sessions and handoffs are in memory: an API restart signs everyone out, and a handoff that was waiting expires. The role is fixed when the session opens. The server-side expiry slides on every read, but the cookie's `Max-Age` (30 days) is set once at claim and is not refreshed, so a browser signs out 30 days after login.

A web page that cannot reach the API shows a retry and keeps the user on `/app`; only an answer of `{ "user": null }` shows the sign-in screen.
