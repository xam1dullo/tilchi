# Tilchi context

Phase 1 replaces the Next marketing site with a pnpm monorepo.

- `packages/content` holds `site.ts` and `domain/*`. Those modules stay free of React. Do not add CELTA. Do not render a cohort label.
- `apps/web` is TanStack Start. `/` is the thin Kunduzgi hero. `/app` lists groups; `/app/groups/$id` and `/app/meet/$id` are the Phase 1 classroom. uz, ru, and en.
- `apps/api` is NestJS. Drizzle describes User, Session, Group, Lesson, and Meeting. The running session store is still in memory.
- Decisions are in `docs/adr`. Cloudflare runtime notes 0007 and 0008 are superseded by 0010.
- Visual tokens are `apps/web/src/styles/tokens.css`. `design.md` remains the marketing spec for a later port.
