# Tilchi v1 build brief (PM freeze — 2026-10-27)

Target repo: https://github.com/xam1dullo/tilchi (currently Next marketing site + design.md). Greenfield rewrite IN PLACE via PRs; do not merge without owner approval; never force-push main.

## Stack (locked)
- pnpm monorepo
- Docker Compose on UZ VPS: nginx + TanStack Start (Node) + NestJS + Postgres + Redis + LiveKit + coturn
- Cloudflare: DNS-only + R2 only (no Workers/Containers/D1 for app runtime)
- Images: ghcr.io, tag = git SHA; GHA SSH deploy: migrate then `compose up -d`; rollback = previous SHA
- TLS: Let's Encrypt certbot on VPS
- Firewall: 80/443 + LiveKit/TURN UDP; SSH not public
- Secrets: `/etc/tilchi.env` on VPS; local `.env` gitignored
- CI PR: lint + typecheck + unit; image build+auto-deploy only on main merge
- Prod deploy HELD until audit+owner approval

## Paths (nginx)
- `/api` `/auth` `/bot` → Nest
- `/ws/canvas` → Nest (Excalidraw live + Redis pub/sub)
- `/rtc` → LiveKit signaling (wss); media UDP on host
- `/ai/*` → TanStack Start (OpenAI|Anthropic via env)
- `/` `/app` `/slide` `/canvas` `/app/meet` → Start
- Cookie: `__Host-tilchi_sid` HttpOnly Secure SameSite=Lax Path=/ (Nest sets); browser calls Nest directly

## Auth
- Telegram deep-link + confirm + Mini App initData → same session
- Sessions: Postgres source of truth + Redis cache TTL 5m
- Pending handoff TTL 5m; session 30d sliding
- Multi-device sessions; web logout = current only; bot revoke-all
- Rate limit /auth/start: 5/min IP + 3/min telegram key
- CSRF: SameSite=Lax enough
- Bot registration fields: ism, til level, qancha o‘qigan, telefon, maqsad/qachon boshlash
- Roles v1: o‘quvchi + o‘qituvchi + admin (NO parent/ota)
- Teacher/admin: allowlist via bot; learner self-registers in bot then /app opens even without Group (empty + catalog CTA)
- Group membership add: admin-only; Group create: admin OR teacher

## Domain (EN code names)
- Aggregates: Group, Course, Lesson, Meeting (+ Question bank)
- First vertical slice: Group + Lesson + LiveKit meeting
- Lesson = Group + scheduled time + Meeting; statuses scheduled→live→ended (+cancelled)
- Attendance = LiveKit join
- Group max 12; LiveKit room up to 12; concurrent rooms 1–3 on small VPS
- Meeting open: teacher Start; close: teacher End; join anytime after Start until End
- Course = public marketing catalog; CTA → Telegram bot registration
- 1:1 = Group with 1 learner
- Tests: full bank; global bank; draft→published; teacher assigns to Group; 1 attempt; deadline by teacher; statuses assigned→submitted→graded; choice+multi+audio/speaking; speaking graded manually; choice also teacher-confirm; audio → R2 presigned
- No payment/billing v1
- Slide/canvas optional attach to Lesson
- AI = lesson helper chat only
- Notifications: web + bot, broad events
- Timezone Asia/Tashkent everywhere
- Teach English only; UI uz+ru+en; default from browser locale
- Soft delete: User/Group/Course; PKs UUID v7; single-tenant
- Audit: admin/teacher critical actions
- Admin UI inside /app role-based
- Excalidraw (not tldraw) for /canvas
- Keep marketing design language from design.md (Kunduzgi studiya tokens) for brand continuity where it fits app chrome

## Existing assets
- Repo has design.md, CONTEXT.md, Next marketing — preserve design tokens/copy modules where useful; replace Next runtime with TanStack Start path modules
- Mac: tilchi-mukhtasar/{tilchi,tilchi-app,tilchi-slide,bot-tilchi} ADRs 0001–0006 uncommitted in tilchi-app — port into docs/adr/
- BOT_TOKEN in bot-tilchi/.env is EXAMPLE placeholder — do NOT invent secrets; use env placeholder TELEGRAM_BOT_TOKEN

## Tooling in repo
- Wire poteto-mode + ub-mode (https://github.com/unclebob/ub-mode) + ECC plugin conventions into AGENTS.md / .cursor/skills as appropriate
- Docker required for local stack; blazing-fast: lean images, parallel pnpm, no fluff

## Phase 1 deliverable (this PR)
1. Monorepo scaffold: apps/web (TanStack Start), apps/api (Nest+Drizzle), docker-compose.yml (nginx, start, nest, postgres, redis, livekit, coturn), Dockerfiles, .env.example
2. docs/adr/0001–0010 capturing decisions above (0007/0008 CF superseded by 0010 Docker/VPS; LiveKit ADR)
3. Minimal Nest health + session/auth stubs + Drizzle schema skeleton (User Session Group Lesson Meeting)
4. Minimal Start routes for /, /app empty state
5. GHA: pr-ci.yml + main-build-push.yml (deploy job can be workflow stub gated)
6. README: local `docker compose up` path
7. Do NOT deploy to prod. Do NOT commit secrets.

Success: `docker compose config` valid; apps typecheck; PR open against main.
## Security must-not-repeat (from Fable 2026-10-28 review of legacy tilchi-app/slide)

1. Webhook: require secret header when set; refuse if unset in prod; no IP-range bypass.
2. Deploy: GitHub environment gate + reviewers; no ungated migrate+deploy on main push.
3. Session: HttpOnly `__Host-tilchi_sid` only; never Bearer in localStorage.
4. Health: no secret presence flags.
5. Remote/meet: short-lived ticket; never send session token to peers.


## Agent workflow (ECC-adapted — 2026-10-28)

From [affaan-m/ECC](https://github.com/affaan-m/ECC) AGENTS.md + codebase-onboarding + team-builder — only what fits Tilchi:

### Principles (adopt)
1. Agent-first: domain work goes to the matching teammate, not one mega-agent.
2. Security-first: no secrets in git; validate inputs; parameterized SQL; HttpOnly session; no health secret leaks; webhook secret required in prod.
3. Plan before execute for multi-file / vertical slices.
4. Immutability preference in app code; many small files (typ. 200–400 lines, hard cap ~800).
5. Conventional commits: `feat|fix|refactor|docs|test|chore|perf|ci: …`
6. Context: avoid burning the last ~20% of a model window on big refactors — hand off or open a fresh agent.

### Pipeline (adopt)
Plan (PM) → implement with tests (Sonnet/AGY/Auto) → review (Fable: SHIP / NOTES / BLOCK) → capture decisions in docs/adr or BUILD-BRIEF → PR (no merge without owner).

### Team cap (team-builder)
Max ~5 active coders/reviewers on one task: Cursor Auto, Claude Sonnet, AGY, Haiku, Fable. Parallel only when work does not collide on the same files. PM synthesizes agreements/conflicts — do not merge conflicting scaffolds.

### Testing (Tilchi override vs ECC 80%+e2e)
- PR gate stays: lint + typecheck + unit (no e2e required every PR in v1).
- TDD preferred on Nest services and auth; UI smoke later.
- Do not invent coverage theater.

### After Phase 1 lands (codebase-onboarding)
Run recon → architecture map → conventions → write short `docs/ONBOARDING.md` + root `CLAUDE.md`/`AGENTS.md` (<100 lines, enhance don't replace). Don't dump every dependency; flag unknowns.

### Explicitly NOT adopted
- ECC interactive agent picker / `claude agents` discovery (Tilchi roster is fixed).
- Mandatory 80% coverage + e2e on every change.
- ECC's full 71-agent catalog — map roles onto our five, don't spawn ECC personas.
