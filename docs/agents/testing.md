# Testing

## Rules

- Test behavior through the public seam (HTTP route, service method, pure function), not private internals.
- Write the test first and watch it fail for the expected reason.
- A test that would still pass if the code returned nothing is not a test.
- Pure logic (state machines, rules, parsers) is unit-tested exhaustively. IO is tested against real services.

## Real services for API tests

API database tests run only when these are set. Start throwaway containers with unique names, and stop them when done:

```bash
docker run -d --rm --name tilchi-pg-<slug> -e POSTGRES_PASSWORD=test -e POSTGRES_DB=tilchi_test -p 554xx:5432 postgres:17-alpine
docker run -d --rm --name tilchi-redis-<slug> -p 563xx:6379 redis:7.4-alpine
export TEST_DATABASE_URL=postgres://postgres:test@localhost:554xx/tilchi_test
export TEST_REDIS_URL=redis://localhost:563xx
pnpm test
docker stop tilchi-pg-<slug> tilchi-redis-<slug>
```

MinIO, when needed, uses the image pinned in `docker-compose.yml`.

## Quality gates on changed code (ub-mode)

If the tools are installed, run them on changed files. Their output goes to `.metrics/`, which is gitignored.

| Tool      | Pass                                                        |
| --------- | ----------------------------------------------------------- |
| `crapper` | CRAP < 10 for every changed function                        |
| `dryer`   | no duplicated pair scoring ≥ 0.8                            |
| `mutator` | no uncovered code and no surviving mutants in changed files |

`mutator` edits sources in place: run it on a clean, committed tree, then confirm `git status` is clean. If a tool cannot run, say so in the PR under "Not verified".
