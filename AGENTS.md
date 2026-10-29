# Tilchi — agent rules

These rules apply to every agent and model (Claude, Codex, Gemini/Antigravity, Grok, Cursor, others) and to humans. This file is always loaded. Everything else is loaded only when a task needs it (see "Read on demand").

Tilchi: online English lessons in Uzbekistan. Monorepo: `apps/api` (NestJS + Drizzle + Postgres + Redis), `apps/web` (TanStack Start), `packages/content` (copy data). Product copy is Uzbek first (plus ru, en). Code, commits, PRs and docs are English.

## Hard rules

1. **One checkout.** Work only in this repository checkout. Never run `git worktree`, never clone the repo elsewhere.
2. **Code lives in the repo.** Never write product code, tests or docs under `/tmp`, `/private`, `/var/folders` or any path outside this repository. Throwaway test containers are fine; their data is not code.
3. **One feature at a time.** Before starting new work, run `gh pr list --repo xam1dullo/tilchi --state open`. If an open PR exists, finish it (review fixes included) before starting anything else.
4. **Branch from fresh `main`.** `git switch main && git pull --ff-only && git switch -c <type>/<slug>` (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`). Never commit to `main`. Never force-push `main`.
5. **Draft first.** Every PR opens as a draft. It is marked ready only when both reviewers report no BLOCK **and** every fix commit is pushed. Agents never merge; the owner merges.
6. **Writer ≠ reviewer.** The agent that wrote a change never reviews it. A reviewer never edits code.
7. **No secrets.** Never commit, print or paste `.env*`, tokens, keys or database dumps.
8. **No production changes without the owner.** Deploys, production migrations, secrets, DNS and webhook changes need the owner's explicit "yes" in the current conversation.
9. **Prove it.** Every behavior change ships with a test that fails without it, and the gates below pass locally before the PR is opened.

## Gates (run from the repo root)

```bash
pnpm install --frozen-lockfile
pnpm lint          # 0 errors
pnpm typecheck
pnpm test          # API DB tests need TEST_DATABASE_URL / TEST_REDIS_URL — docs/agents/testing.md
pnpm build
pnpm contrast      # when CSS or tokens change
```

## Read on demand (progressive disclosure)

Open only the files your task needs.

| Read this | When |
| --- | --- |
| `docs/agents/workflow.md` | Before starting any change: the 11-step lifecycle and its exit criteria |
| `docs/agents/roles.md` | When you are given a role, or assign work to other agents |
| `docs/agents/review.md` | When you review a PR |
| `docs/agents/testing.md` | Before writing tests or running quality gates |
| `docs/agents/security.md` | When touching auth, sessions, the bot, AI, storage, uploads or personal data |
| `docs/agents/architecture.md` | When adding a module, route, table, event or config value |
| `apps/api/AGENTS.md` | When working under `apps/api` |
| `apps/web/AGENTS.md` | When working under `apps/web` |
| `docs/prd/v1.md` | For product scope: search the relevant section, don't read it whole |
| `docs/adr/` | For past decisions: read the ADR your task names |
| `design.md` | For UI: tokens, type and copy style |

If two documents disagree: this file wins, then `docs/agents/*`, then the app `AGENTS.md`, then the PRD.
