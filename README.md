# Tilchi

English lessons for groups in Uzbekistan. This repository is the Phase 1 monorepo: TanStack Start, NestJS, and Docker Compose.

## Local stack

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open http://localhost. nginx sends `/` and `/app` to Start, and `/api`, `/auth`, and `/bot` to Nest. Postgres, Redis, LiveKit, and coturn come up with the same files.

`docker-compose.yml` is the production shape: secrets use `${VAR:?required}` and LiveKit signaling (`7880`) stays on the compose network (nginx proxies `/rtc/`). `docker-compose.dev.yml` supplies local defaults only.

`TELEGRAM_BOT_TOKEN` in `.env.example` is an empty placeholder. Do not commit a real token. Production reads `/etc/tilchi.env` on the VPS.

The session cookie is `__Host-tilchi_sid`. A login needs the Telegram bot to bind a handoff and the user to tap confirm, and only the browser that started it can claim it, once. An unconfirmed handoff cannot create a session, and production refuses confirm until `TELEGRAM_WEBHOOK_SECRET` is set. Browsers only store the host cookie over HTTPS, so local HTTP will not keep a login. `GET /api/health` returns `{ "ok": true, "service": "tilchi-api" }`.

To preview the signed-in empty state locally, set `TILCHI_PREVIEW_ROLE=learner` on the Start process (via the dev compose override). That variable is ignored when `NODE_ENV=production`.

## Checks

```bash
pnpm install
pnpm --filter @tilchi/web routes
pnpm lint
pnpm typecheck
pnpm test
pnpm contrast
docker compose -f docker-compose.yml -f docker-compose.dev.yml config
```

## Deploy

Images build on `main` and push to GHCR tagged with the git SHA. Nothing migrates or deploys on that push. The deploy job is `workflow_dispatch` only, requires the GitHub `production` environment, and currently refuses to SSH.
