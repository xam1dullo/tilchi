# Security

## Must not repeat

1. **Session:** only the HttpOnly `__Host-tilchi_sid` cookie, set by Nest. Never a bearer token, never localStorage or sessionStorage. A login handoff mints a cookie only after the bot confirms it from the same browser.
2. **Webhooks:** `/bot/webhook` requires the Telegram secret header; production refuses to boot without the secret. LiveKit webhooks are signature-verified on the raw body. No IP-range bypass.
3. **Health:** returns `{ ok, service }` only.
4. **Meetings:** short-lived, room-scoped LiveKit tokens minted by Nest. Browsers never hold API keys; peers never see a session token.
5. **Deploy:** only through the gated `production` environment with the owner's approval.

## Rules for new code

- Every route is authorized through `apps/api/src/authz/policy.ts` and listed in the route-matrix test. Responses that drive the UI carry server-computed `can` flags; the web never re-derives permissions.
- Parse and size-limit input at the boundary: body size, string length, enum values, UUIDs.
- Rate-limit on a server-verified identity, never on a client-controlled header or cookie string.
- Parameterized SQL only (Drizzle). Log variable names, never values of secrets or tokens.
- Side effects (Telegram, LiveKit, storage) go through the outbox so a failure retries instead of being lost.

## Personal data (Uzbekistan, ZRU-547)

- Personal data stays on infrastructure in Uzbekistan: Postgres, Redis, backups, and learner audio in MinIO (ADR 0011).
- Nothing sent abroad (Telegram messages, AI prompts) carries a phone number, Telegram id or group name.
- The AI helper refuses questions with an explicit name phrase. **Residual risk (accepted):** a name typed without such a phrase still reaches the model; the consent text and UI warning cover it.
