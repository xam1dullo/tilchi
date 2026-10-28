# 0010. Docker Compose on a VPS

Date: 2026-10-27
Status: accepted
Supersedes: 0007, 0008

## Decision

The production runtime is Docker Compose on a UZ VPS: nginx, TanStack Start, NestJS, Postgres, Redis, LiveKit, and coturn. Images are `ghcr.io/<repo>/{web,api}:<git sha>`. TLS is Let's Encrypt on the VPS. The firewall opens 80, 443, and LiveKit/TURN UDP. SSH is not public. Secrets live in `/etc/tilchi.env`. `TELEGRAM_BOT_TOKEN` appears in git only as an empty name in `.env.example`.

`docker-compose.yml` is the production shape: database, Redis, Telegram, LiveKit, and TURN secrets use `${VAR:?required}` with no silent `devkey` defaults. LiveKit and coturn configs are rendered from env at container start. Host port `7880` is not published; nginx proxies `/rtc/`. Local development adds `docker-compose.dev.yml` for defaults only.

Pushing `main` may build and push images. It does not migrate and it does not deploy. The deploy job runs only on `workflow_dispatch` with `deploy=true`, and only inside the GitHub `production` environment. The job is a stub that exits before any SSH or migration.

## Consequences

Local development is `docker compose up`. Rollback, when deploy exists, is the previous image SHA.
