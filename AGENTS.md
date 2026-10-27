# Tilchi — agent instructions (ECC-adapted)

Greenfield rewrite of https://github.com/xam1dullo/tilchi. Source of truth for product and stack: `BUILD-BRIEF-v1.md`. Never merge to main or deploy prod without owner approval. No secrets in git.

## Roster

| Role | Who | Does |
|------|-----|------|
| PM / adviser | Grok Bot | Decisions, briefs, conflict synthesis, no owner questions unless blocked |
| Scaffold | Cursor Auto (cloud) | Monorepo Phase 1 PR |
| Executor | Claude Code Sonnet 5.5 + AGY | Nest/Start/Docker/CI vertical code |
| Small tasks | Claude Code Haiku 5.5 | Typos, `.env.example`, one-line CI |
| Review | Fable | SHIP / SHIP WITH NOTES / BLOCK (security + architecture) |
| Hard arch (optional) | Claude Opus 5.5 | Only when PM assigns |

Max 5 active implementers or reviewers on one collision domain. Parallel only on non-overlapping paths.

## Principles

- Security-first. See the must-not-repeat list below and in `BUILD-BRIEF-v1.md`.
- Plan, then implement with tests, then Fable review, then ADR or docs, then PR. Do not merge without the owner.
- Immutability-friendly TypeScript. Small focused files, typically 200–400 lines, hard cap about 800.
- Conventional commits: `feat|fix|refactor|docs|test|chore|perf|ci: …`
- Cookie session `__Host-tilchi_sid`. Clients never hold LiveKit API keys.
- Avoid burning the last part of a context window on a large refactor. Hand off or open a fresh agent.
- poteto-mode, ub-mode (`.cursor/skills/ub-mode/SKILL.md`), and the short ECC floor in `.cursor/rules/tilchi.mdc` still apply. Do not load ECC's agent catalog.

## Security must-not-repeat

1. Webhook: require the secret header when `TELEGRAM_WEBHOOK_SECRET` is set. Refuse the webhook in production when it is unset. No IP-range bypass.
2. Deploy: GitHub `environment: production` plus reviewers. No ungated migrate and deploy on a bare `main` push.
3. Session: HttpOnly `__Host-tilchi_sid` only. Never put a bearer token in localStorage.
4. Health: no secret presence flags (`hasBotToken`, `hasDb`, and the like).
5. Remote and meet control: short-lived token minted by Nest (LiveKit JWT, 120 s). Never send the session token to peers; clients never hold the LiveKit secret.
6. Client IP comes from `req.ip` behind nginx, which overwrites `X-Forwarded-For`. Never key a limit on a client-sent header.
7. A session opens only in the browser holding the handoff cookie, after the bot confirms. No HTTP route confirms a handoff.

## Map

| Path | What |
|------|------|
| `apps/web` | TanStack Start: `/`, `/app` (Telegram sign-in, then the group list or the empty state), `/ai/*` (later `/slide`, `/canvas`, `/app/meet`) |
| `apps/api` | NestJS + Drizzle. Modules `auth`, `bot`, `users`, `groups`, `lessons`, `meet` serve `/api`, `/auth`, `/bot` (`/ws/canvas` later) |
| `apps/api/drizzle` | Committed SQL migrations. The API container applies them at start (ADR 0010) |
| `packages/content` | Marketing copy, plain TypeScript |
| `docker/nginx/nginx.conf` | The only edge. `/rtc` passes through to LiveKit unchanged |
| `docker/{livekit,coturn}` | No keys or users in these files; compose requires them from `.env` / `/etc/tilchi.env` |
| `docs/adr` | Decisions. Amend the ADR in the same PR that changes the behaviour |

## Commands

```bash
pnpm install && pnpm --filter @tilchi/web routes
pnpm lint && pnpm typecheck && pnpm test && pnpm contrast   # PR gate
cp .env.example .env && docker compose up --build         # local stack on :80
```

`pnpm test` runs a Nest boot test (`apps/api/src/app.test.ts`). Keep it: green unit tests once hid an API that could not start. Inject Nest providers with `@Inject(Class)`; `import type` erases the DI token.

API tests need no database. `apps/api/src/testing/harness.ts` boots the real app on PGlite built from `apps/api/drizzle`. After editing `apps/api/src/db/schema.ts`, run `pnpm --filter @tilchi/api db:generate` and commit the SQL it writes.

ub-mode gates on changed code (tools in `~/Developer/tools/unclebob/`, output in `.metrics/`): `crapper` CRAP < 10, `dryer` no pair ≥ 0.8, `mutator` no survivors.

## Workflow

Plan (PM) then implement with tests (Sonnet, AGY, or Auto) then review (Fable: SHIP / NOTES / BLOCK) then capture decisions in `docs/adr` or `BUILD-BRIEF-v1.md` then open a PR. No merge and no production deploy without the owner.

PR gate stays lint, typecheck, and unit tests. Do not require 80% coverage or e2e on every change. Prefer TDD on Nest services and auth. UI smoke comes later. Do not invent coverage theater.

## After scaffold

Keep `docs/ONBOARDING.md` and this file short. Refresh them from the tree. Do not replace this roster with ECC's interactive agent picker or its full agent catalog.
