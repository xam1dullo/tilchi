# Tilchi

English lessons for groups in Uzbekistan. This repository is the Phase 1 monorepo: TanStack Start, NestJS, and Docker Compose.

## Local stack

```bash
cp .env.example .env
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

Open http://localhost. nginx sends `/` and `/app` to Start, `/api`, `/auth`, `/bot`, and `/ws/canvas` to Nest, and `/rtc` to LiveKit. Postgres, Redis, LiveKit, and coturn come up with the same files. The path contract lives in `docker/nginx/locations.conf`.

`docker-compose.yml` is the production shape: secrets use `${VAR:?required}` and LiveKit signaling (`7880`) stays on the compose network (nginx proxies `/rtc/`). `docker-compose.dev.yml` supplies local defaults only. Production adds `docker-compose.prod.yml`.

`TELEGRAM_BOT_TOKEN` in `.env.example` is a local placeholder, not a real token. Production reads `/etc/tilchi.env` on the VPS.

The session cookie is `__Host-tilchi_sid`. A login needs the Telegram bot to bind a handoff and the user to tap confirm, and only the browser that started it can claim it, once. An unconfirmed handoff cannot create a session, and production refuses confirm until `TELEGRAM_WEBHOOK_SECRET` is set. Browsers only store the host cookie over HTTPS, so local HTTP will not keep a login. `GET /api/health` returns `{ "ok": true, "service": "tilchi-api" }`.

Local compose is HTTP, so the browser will not store `__Host-tilchi_sid`. The classroom loop uses preview instead:

1. `docker-compose.dev.yml` sets `TILCHI_DEMO=1` and `TILCHI_PREVIEW_ROLE=learner` on Nest and Start.
2. Nest seeds one teacher, one learner, group `A1 morning`, and a scheduled lesson. It never seeds when `NODE_ENV=production`.
3. Open http://localhost/app. You should see the seeded group, not only the empty state.
4. Switch roles with `?preview=teacher` or `?preview=learner` (the top-bar control does the same). Teacher can create a group, schedule a lesson, start/end, and open the meeting. Learner can join only while the lesson is live.
5. `POST /api/meet/lessons/:id/token` mints a LiveKit JWT against compose LiveKit. The meet page connects through nginx `/rtc`. If credentials are missing the API returns `501` with a note.

`TILCHI_PREVIEW_ROLE` and `TILCHI_DEMO` are ignored when `NODE_ENV=production`. Do not set them on the VPS.

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

`pnpm test` also runs the Redis checks (the compare-and-set Lua) when `TEST_REDIS_URL` points at a Redis 6.0+ server, for example `TEST_REDIS_URL=redis://127.0.0.1:6379 pnpm --filter @tilchi/api test`. Without it they are skipped.

## Deploy

Images build on `main` and push to GHCR, tagged with the git SHA. Nothing migrates or deploys on that push. The deploy job is `workflow_dispatch` only, requires the GitHub `production` environment, and is held: it exits before any SSH.

On the VPS, `scripts/vps-deploy.sh <sha>` pulls the images, migrates, and runs `docker compose up -d` with `docker-compose.prod.yml` and `/etc/tilchi.env`. Rollback is the same command with the previous SHA. See `docs/adr/0010-docker-vps.md`.
