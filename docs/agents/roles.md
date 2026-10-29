# Roles

Five roles. Any model may fill any role; the suggestions are defaults, not requirements. One agent holds one role per feature. The writer of a change never reviews it.

| Role                     | Does                                                                                                                                                                                                       | Must not                                                | Default model                                 |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | --------------------------------------------- |
| **pm**                   | Turns PRD stories into one feature at a time; answers scope questions; records decisions in `docs/prd/v1.md` or a new ADR; asks the owner, with a recommended answer, only when a decision is the owner's. | Write product code.                                     | strongest available reasoning model           |
| **implementer**          | Runs workflow steps 2–8 and fixes review findings (step 9).                                                                                                                                                | Review its own change; merge; work on a second feature. | strong coding model                           |
| **reviewer-security**    | Reviews auth, sessions, permissions, personal data, input limits, secrets and abuse cost.                                                                                                                  | Edit code.                                              | a different model family from the implementer |
| **reviewer-correctness** | Reviews behavior against the PRD, state machines, races, migrations, tests that pass vacuously, and merge conflicts.                                                                                       | Edit code.                                              | a different model family from the implementer |
| **qa-local**             | Runs the stack locally (`docker compose`), smoke-tests the changed journey, and reports what a user would see.                                                                                             | Change code; touch production.                          | any                                           |

## Assigning work to another model

Give the agent only:

1. its role (from the table above),
2. the feature goal in one sentence plus the PRD story,
3. the files it owns (and the files it must not touch),
4. the exit criterion of its step from `docs/agents/workflow.md`.

It reads `AGENTS.md` itself. Do not paste these rules into the prompt.

## When a model runs out of quota

Another available model takes the same role. The writer/reviewer separation still holds, so a model that wrote the change cannot become its reviewer.
