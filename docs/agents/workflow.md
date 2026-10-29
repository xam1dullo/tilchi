# Workflow — one feature, eleven steps

Any model can run this. Every step has an exit criterion; do not start the next step until it holds. Commands are plain shell and `gh`.

| #   | Step            | Do                                                                                                                                             | Exit criterion                                                            |
| --- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| 1   | Pick            | Take one PRD story or acceptance criterion (`docs/prd/v1.md`) or one review finding. Write its goal in one sentence.                           | `gh pr list --repo xam1dullo/tilchi --state open` shows no other open PR. |
| 2   | Branch          | `git switch main && git pull --ff-only && git switch -c <type>/<slug>`                                                                         | `git status` is clean on the new branch.                                  |
| 3   | Shape           | Define data shapes and types first (DB columns, DTOs, unions). Read `docs/agents/architecture.md` if a module, route, table or event is new.   | The change touches only the files you listed.                             |
| 4   | Red             | Write the failing test. Run it and see it fail **for the expected reason**.                                                                    | The failure message matches the missing behavior.                         |
| 5   | Green           | Make the smallest change that passes. No speculative code.                                                                                     | The new test and the whole suite pass.                                    |
| 6   | Gates           | Run the gates in `AGENTS.md`, plus `docs/agents/testing.md` gates for changed code.                                                            | lint 0 errors, typecheck, test, build (and contrast for CSS) all pass.    |
| 7   | Commit          | Small commits: `<type>(<scope>): <what>`. Body: Why / What / Proof. Push the branch.                                                           | `git log origin/<branch>` contains every commit.                          |
| 8   | Draft PR        | `gh pr create --draft --base main` with the PR template below.                                                                                 | The PR is a draft and links its PRD story.                                |
| 9   | Review          | Two reviewers, neither the writer, run `docs/agents/review.md`. The writer fixes every BLOCK and HIGH finding, pushes, and asks for re-review. | Both latest verdicts are SHIP or SHIP WITH NOTES, and no fix is unpushed. |
| 10  | Ready           | Mark ready: `gh pr ready <n>`. Comment the review summary (verdicts, what was fixed, what was accepted as a note).                             | The PR is ready with a review summary comment.                            |
| 11  | Merge and clean | The **owner** merges. After the merge: `git switch main && git pull --ff-only && git branch -d <branch>`.                                      | Local and remote feature branches are gone; `main` is current.            |

## Rules inside the flow

- A finding that changes the plan or the product goes to the owner as a question with a recommended answer. It does not go into the code silently.
- If two fixes built on the same idea fail review, stop. Write that idea in one sentence and replace it; do not patch a third time.
- Merged too early? If a PR merges before its fixes, open a follow-up PR from fresh `main` with the missing commits. Never push to a merged branch and expect it to land.
- Context nearly full (more than about 80%)? Commit, push, and hand off with the handoff note below.

## PR template

```markdown
## What

<one paragraph: the behavior that changes>

## Why

<PRD story / AC / review finding, with link>

## Proof

- Tests that failed first: <names>
- Gates: lint, typecheck, test (<counts>), build
- Not verified: <anything you could not run>

## Risks and follow-ups

<or "none">
```

## Handoff note (when you stop before step 11)

```
Feature: <slug>   Branch: <branch>   PR: <url or none>   Step: <n>
Done: <one line>   Next: <one line>   Open findings: <ids or none>
```
