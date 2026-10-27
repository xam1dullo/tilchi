# Tilchi

English lessons for groups in Uzbekistan. This repository is the Phase 1 monorepo: TanStack Start, NestJS, and Docker Compose.

## Local stack

```bash
cp .env.example .env
docker compose up --build
```

Open http://localhost. nginx sends `/` and `/app` to Start, `/api`, `/auth`, `/bot`, and `/ws/canvas` to Nest, and `/rtc` to LiveKit. Postgres, Redis, LiveKit, and coturn come up with the same file. The path contract lives in `docker/nginx/locations.conf`.

`TELEGRAM_BOT_TOKEN` in `.env.example` is an empty placeholder. Do not commit a real token. Production reads `/etc/tilchi.env` on the VPS.

The session cookie is `__Host-tilchi_sid`. Browsers only store that name over HTTPS, so local HTTP will not keep a login. `GET /api/health` returns `{ "ok": true, "service": "tilchi-api" }`.

To preview the signed-in empty state locally, set `TILCHI_PREVIEW_ROLE=learner` on the Start process. That variable is ignored when `NODE_ENV=production`.

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

Images build on `main` and push to GHCR, tagged with the git SHA. Nothing migrates or deploys on that push. The deploy job is `workflow_dispatch` only, requires the GitHub `production` environment, and is held: it exits before any SSH.

On the VPS, `scripts/vps-deploy.sh <sha>` pulls the images, migrates, and runs `docker compose up -d` with `docker-compose.prod.yml` and `/etc/tilchi.env`. Rollback is the same command with the previous SHA. See `docs/adr/0010-docker-vps.md`.
