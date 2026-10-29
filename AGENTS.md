# Tilchi: agent instructions (ECC-adapted)

Greenfield rewrite of https://github.com/xam1dullo/tilchi. Product and stack contract: `BUILD-BRIEF-v1.md`. Decisions: `docs/adr/` (0010 is the runtime). Tree tour: `docs/ONBOARDING.md`.

Never merge to `main`, never deploy production, never commit a secret. The owner does all three.

## Roster

| Role | Who | Does |
|------|-----|------|
| PM / adviser | Grok Bot | Decisions, briefs, conflict synthesis. Asks the owner only when blocked |
| Scaffold | Cursor Auto (cloud) | Phase 1 scaffold ([#25](https://github.com/xam1dullo/tilchi/pull/25), merged) |
| Architecture | Claude Opus 5.5 high | ADRs, security hardening, structural gaps (infra, deploy, boundaries) |
| Executor | Claude Sonnet 5.5 max (+ AGY) | Nest / Start / Docker / CI vertical slices |
| Small tasks | Claude Haiku 5.5 | Typos, doc sync, `.env.example`, one-line CI |
| Review | Fable | SHIP / SHIP WITH NOTES / BLOCK (security + architecture) |

At most 5 active implementers or reviewers per collision domain. Run in parallel only on non-overlapping paths. If two agents produce conflicting scaffolds, the PM picks one. Do not merge both.

## Pipeline

1. **Plan** (PM, or the assignee for multi-file work): files to touch, the test that proves it, and the ADR the change affects.
2. **Implement, TDD-lean.** Write the failing test first for Nest services, auth, guards, and policy. UI gets smoke tests later.
3. **Review** by Fable. BLOCK stops the PR.
4. **Record.** A decision change updates `docs/adr` or `BUILD-BRIEF-v1.md` in the same PR.
5. **PR** against `main`, conventional title. No merge without the owner.

PR gate: `lint + typecheck + unit` and the compose config checks (`.github/workflows/pr-ci.yml`). There is no 80% coverage or e2e mandate, and no coverage theater.

## Workspace

- **No git worktrees.** Do not create or use `git worktree`. Work only in the single checkout of this repository.
- **Code stays in the repo tree.** Write product and source only inside the repository working tree. Do not put app code under `/tmp`, `/private`, or other scratch paths outside the repo.
- **One feature at a time.** Across agents, only one feature or slice may be in active implementation. Finish or park it before starting another.

## Commands

```bash
pnpm install && pnpm --filter @tilchi/web routes
pnpm lint && pnpm typecheck && pnpm test && pnpm contrast
docker compose config --quiet
cp .env.example .env && docker compose up --build   # http://localhost
```

## Security must-not-repeat

1. **Webhook:** `/bot/webhook` requires `X-Telegram-Bot-Api-Secret-Token` when `TELEGRAM_WEBHOOK_SECRET` is set, and is refused in production when it is unset. The API also will not boot in production without it. No IP-range bypass.
2. **Deploy:** only `workflow_dispatch` plus `environment: production` with reviewers. No migrate or deploy on a bare `main` push. The job is held.
3. **Session:** the HttpOnly `__Host-tilchi_sid` cookie only, set by Nest. Never a bearer token, never localStorage or sessionStorage. A handoff mints a cookie only after the bot confirms it.
4. **Health:** `{ ok, service }` only. No `hasBotToken`/`hasDb`-style flags.
5. **Meet / remote:** a short-lived, single-purpose ticket. Never send the session token to peers. Browsers never hold LiveKit API keys.

Also: parameterized SQL only (Drizzle), validate input at the controller boundary, rate-limit on `req.ip` (never parse `X-Forwarded-For` yourself), and log variable names, never secret values.

## Code conventions

- Immutability-friendly TypeScript. Files are small and focused, typically 200–400 lines, hard cap about 800.
- Nest DI: inject with `@Inject(Service)`. `import type` erases the class from decorator metadata and the app will not boot. `src/app.module.test.ts` catches this.
- nginx: every `proxy_set_header` lives in `docker/nginx/locations.conf`. A location that sets its own header drops all inherited ones.
- Commits: `feat|fix|refactor|docs|test|chore|perf|ci: …`, one logical change each.
- Context hygiene: do not start a big refactor in the last ~20% of a context window. Hand off or open a fresh agent.
- Short conventions in `.cursor/rules/tilchi.mdc` and `.cursor/skills/ub-mode/SKILL.md` (poteto-mode, ub-mode) still apply.

## Not adopted from ECC

The interactive agent picker, the full agent catalog, ECC personas, and mandatory 80% coverage with e2e. Map ECC roles onto the five above.
