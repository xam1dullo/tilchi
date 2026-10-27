# Onboarding

Tilchi is one pnpm repo. `BUILD-BRIEF-v1.md` is the product contract. `AGENTS.md` is how agents work. `docs/adr` records decisions. 0007 and 0008 are superseded by 0010.

## Tree

- `apps/web` TanStack Start. `/` is the thin Kunduzgi hero. `/app` signs the user in through Telegram, then lists their groups, or shows the empty classroom when there are none; uz/ru/en. Tokens are `apps/web/src/styles/tokens.css`.
- `apps/api` NestJS and Drizzle. Modules: `auth` (Telegram handoff, `__Host-tilchi_sid` session), `bot` (webhook guard and the confirm prompt), `users` (Postgres, roles from env allow-lists), `groups` (up to 12 learners), `lessons`, `meet` (120 s LiveKit token for a live lesson). `apps/api/drizzle` holds the migrations. Sessions and handoffs are still memory.
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
