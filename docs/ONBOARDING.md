# Onboarding

Tilchi is one pnpm repo. `BUILD-BRIEF-v1.md` is the product contract. `AGENTS.md` is how agents work. `docs/adr` records decisions; 0007 and 0008 are superseded by 0010.

## Tree

- `apps/web` is TanStack Start. `/` is the thin Kunduzgi hero. `/app` is the empty classroom in uz, ru, and en. Tokens are in `apps/web/src/styles/tokens.css`.
- `apps/api` is NestJS and Drizzle. It has health, the cookie session stub, the webhook guard, the meet ticket, and a production config guard (`src/config.ts`). The schema covers User, Session, Group, Lesson, and Meeting. Migrations go to `apps/api/drizzle` (`db:generate`, `db:migrate`). The live session store is still in memory.
- `packages/content` is pure TypeScript copy. No React.
- `docker-compose.yml` is the local stack: nginx, Start, Nest, Postgres, Redis, LiveKit, and coturn. `docker-compose.prod.yml` is the VPS overlay with ghcr images by SHA, TLS, and required secrets.
- `docker/nginx/locations.conf` is the path contract. `dev.conf.template` and `prod.conf.template` wrap it.
- `scripts/vps-deploy.sh` is the held deploy order: pull, migrate, `up -d`.

## Commands

```bash
pnpm install
pnpm --filter @tilchi/web routes
pnpm lint && pnpm typecheck && pnpm test && pnpm contrast
docker compose config --quiet
cp .env.example .env && docker compose up --build
```

## Do not

- Do not commit secrets. `TELEGRAM_BOT_TOKEN` in `.env.example` is an empty name.
- Do not store the session outside `__Host-tilchi_sid`.
- Do not deploy from a push to `main`.
- Do not use `import type` for a Nest provider you inject.
- Do not set `proxy_set_header` inside an nginx location.
- Do not add a parent role or a cohort label.
