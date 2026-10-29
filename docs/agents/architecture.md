# Architecture

## Map

- `apps/api` — NestJS. Modules: `auth`, `authz` (single permission policy), `bot`, `groups`, `lessons`, `meet` (LiveKit), `outbox` (delivery + reminders), `notifications`, `courses`, `assessment` (question bank, attempts, grading), `storage` (MinIO presign), `config` (typed, parsed once at boot), `db` (Drizzle schema + migrations in `apps/api/drizzle`).
- `apps/web` — TanStack Start. Routes in `src/routes`, pure view logic in `src/lib`, copy in `src/lib/i18n`, tokens in `src/styles/tokens.css`. `/ai/*` server routes call the model.
- `packages/content` — pure data for the landing and catalog. No React.
- `docker-compose.yml` (local stack) and `docker-compose.prod.yml` (VPS overlay). nginx paths are defined in `docker/nginx/locations.conf`.

## Where things go

| Adding                               | Put it                                                                | And                                                         |
| ------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------- |
| A permission rule                    | `apps/api/src/authz/policy.ts`                                        | a row in the route-matrix test                              |
| A route                              | the module's controller, using the actor guard                        | the route-matrix test                                       |
| A table or column                    | `apps/api/src/db/schema.ts` + `pnpm --filter @tilchi/api db:generate` | commit the SQL and journal; never edit an applied migration |
| A side effect (DM, room close, file) | an outbox event enqueued in the same transaction as the domain write  | a delivery adapter in `outbox`                              |
| A config value                       | the typed config module                                               | `.env.example` with required/optional and production rules  |
| A product decision                   | a new ADR in `docs/adr/` (next number)                                | update `docs/adr/README.md`                                 |

## Constraints

- One API instance and one web instance in v1 (single VPS); in-process rate limits are acceptable and must say so in a comment.
- Files stay small (≈200–400 lines, hard cap ≈800).
- Times are stored in UTC and shown in Asia/Tashkent.
