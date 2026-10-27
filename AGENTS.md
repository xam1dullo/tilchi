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
5. Remote and meet control: short-lived ticket. Never send the session token to peers.

## Workflow

Plan (PM) then implement with tests (Sonnet, AGY, or Auto) then review (Fable: SHIP / NOTES / BLOCK) then capture decisions in `docs/adr` or `BUILD-BRIEF-v1.md` then open a PR. No merge and no production deploy without the owner.

PR gate stays lint, typecheck, and unit tests. Do not require 80% coverage or e2e on every change. Prefer TDD on Nest services and auth. UI smoke comes later. Do not invent coverage theater.

## After scaffold

Keep `docs/ONBOARDING.md` and this file short. Refresh them from the tree. Do not replace this roster with ECC's interactive agent picker or its full agent catalog.
