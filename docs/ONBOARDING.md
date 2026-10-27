# Onboarding

Tilchi is one pnpm repo. `BUILD-BRIEF-v1.md` is the product contract. `AGENTS.md` is how agents work. `docs/adr` records decisions. 0007 and 0008 are superseded by 0010.

## Tree

- `apps/web` TanStack Start. `/` is the thin Kunduzgi hero. `/app` is the empty classroom, uz/ru/en. Tokens are `apps/web/src/styles/tokens.css`.
- `apps/api` NestJS and Drizzle. Health, Telegram handoff and cookie session stub, webhook guard, LiveKit token mint. Schema covers User, Session, Group, Lesson, Meeting. The live session store is still memory.
- `packages/content` is pure TypeScript copy. No React.
- `docker-compose.yml` runs nginx, Start, Nest, Postgres, Redis, LiveKit, and coturn.

## Commands

```bash
pnpm install
pnpm --filter @tilchi/web routes
pnpm lint && pnpm typecheck && pnpm test && pnpm contrast
docker compose config
docker compose up --build
```

## Do not

Do not commit secrets. `TELEGRAM_BOT_TOKEN` in `.env.example` is an empty name. Do not store the session outside `__Host-tilchi_sid`. Do not deploy from a push to `main`. Do not add a parent role or a cohort label.
