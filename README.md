# Tilchi

English lessons for groups in Uzbekistan. This repository is the Phase 1 monorepo: TanStack Start, NestJS, and Docker Compose.

## Local stack

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost. nginx sends `/` and `/app` to Start, and `/api`, `/auth`, and `/bot` to Nest. Postgres, Redis, LiveKit, and coturn come up with the same file.

`TELEGRAM_BOT_TOKEN` in `.env.example` is an empty placeholder. Do not commit a real token. Production reads `/etc/tilchi.env` on the VPS.

The session cookie is `__Host-tilchi_sid`, which must be `Secure`. Chrome keeps it on `http://localhost`; a browser that drops `Secure` cookies over plain HTTP will not keep the login, so put HTTPS in front of it there. `GET /api/health` returns `{ "ok": true, "service": "tilchi-api" }`.

To preview the signed-in empty state locally, set `TILCHI_PREVIEW_ROLE=learner` on the Start process. That variable is ignored when `NODE_ENV=production`.

## Sign in locally

`/app` signs in through the Telegram bot, and a dev machine has no bot token. Play the bot's Confirm press yourself:

1. Open http://localhost/app and press Continue in Telegram. The page waits and polls.
2. The link it offers ends in `start=login_<handoff id>`. Copy that id.
3. Post the Confirm press to the webhook. `from.id` is the Telegram user who signs in.

```bash
curl -X POST http://localhost/bot/webhook -H 'content-type: application/json' \
  -d '{"update_id":1,"callback_query":{"id":"1","from":{"id":2000,"is_bot":false,"first_name":"Dilnoza"},"message":{"message_id":2,"chat":{"id":2000,"type":"private"}},"data":"confirm:<handoff id>"}}'
```

The page signs in on its next poll, about two seconds later, and shows the user's groups, or the empty classroom when there are none. Everyone is a learner unless their Telegram id is in `TELEGRAM_TEACHER_ALLOWLIST` or `TELEGRAM_ADMIN_ALLOWLIST` (comma-separated ids); a change applies at the next sign-in.

The webhook is open only when `NODE_ENV` is `development` or `test` and `TELEGRAM_WEBHOOK_SECRET` is empty. Once the secret is set, send it as the `x-telegram-bot-api-secret-token` header. Any other environment refuses the webhook until the secret is set.

## Database

The Nest image applies `apps/api/drizzle` before it starts, and stops if a migration fails. After editing `apps/api/src/db/schema.ts`, run `pnpm --filter @tilchi/api db:generate` and commit the SQL. Tests build the same migration in PGlite, so they need no database.

## Checks

```bash
pnpm install
pnpm --filter @tilchi/web routes
pnpm lint
pnpm typecheck
pnpm test
pnpm contrast
docker compose config
```

## Deploy

Images build on `main` and push to GHCR tagged with the git SHA. Nothing migrates or deploys on that push. The deploy job is `workflow_dispatch` only, requires the GitHub `production` environment, and currently refuses to SSH.
