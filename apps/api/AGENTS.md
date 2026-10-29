# apps/api — local rules

Read the root `AGENTS.md` first. Details: `docs/agents/architecture.md`, `docs/agents/security.md`.

- **Nest DI:** inject classes with value imports or `@Inject(Token)`. `import type` erases the class and the app will not boot (`app.module.test.ts` catches it).
- **Permissions:** only in `src/authz/policy.ts`, used through the actor guard and `@Actor()`. Every route goes in `src/http/route-matrix.test.ts`.
- **Database:** change `src/db/schema.ts`, then run `pnpm --filter @tilchi/api db:generate`. Commit the SQL and the journal. One migration per PR, next number, never edit an applied one.
- **Side effects:** enqueue an outbox event inside the domain transaction; never call Telegram, LiveKit or storage inline from a controller unless the outbox retries a failure.
- **Config:** read values only from the typed config module, never `process.env` elsewhere.
- **Tests:** DB tests need `TEST_DATABASE_URL` and `TEST_REDIS_URL` (`docs/agents/testing.md`).
- **nginx:** every `proxy_set_header` lives in `docker/nginx/locations.conf`.
