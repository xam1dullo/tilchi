# Review

Reviewers find defects. They do not edit code, praise, or restyle.

## Inputs

`gh pr view <n> --repo xam1dullo/tilchi` and `gh pr diff <n> --repo xam1dullo/tilchi`. For context read files from the PR branch with `git show origin/<branch>:<path>`; do not check anything out.

## Check (stop at what applies)

1. **Behavior vs PRD:** the story and its acceptance criteria (`docs/prd/v1.md`).
2. **Security:** `docs/agents/security.md`, item by item, for touched areas.
3. **Authorization:** every new route goes through `apps/api/src/authz/policy.ts` and is in the route-matrix test.
4. **State and races:** transitions, locks, idempotency, retries, crash between two writes.
5. **Data:** migration safety on populated tables, numbering, rollback path.
6. **Tests:** would each test fail if the code returned nothing? Do fixtures match what the code under test receives?
7. **Merge:** conflicts with other open PRs or recent `main`.

Verify every finding in code before reporting it. Probe it if you can (a unit test in your head is not proof).

## Output format

```
<n>. <SEVERITY> — <file>:<line> — <one-line failure scenario> — Fix: <specific fix>
...
Verdict: SHIP | SHIP WITH NOTES | BLOCK
```

Severity: **BLOCKER/HIGH** (security hole, data loss, broken journey) blocks; **MEDIUM** should be fixed in this PR; **LOW** may become a follow-up note.

Do not re-report a risk the PRD already records as accepted (see "Residual risk" notes in `docs/prd/v1.md`).
