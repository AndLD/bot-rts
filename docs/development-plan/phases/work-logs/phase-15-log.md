[← Phase 15 — Harness fixes](../phase-15-harness-fixes.md)

# Phase 15 — Harness fixes — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 15.x, 15.y
- **Branch:** `docs/15.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-18 — phase planned
- **Tasks:** none started; 15.1 to 15.14 are planned
- **Branch:** `docs/15-harness-fixes-phase` — the plan only
- **Decisions / deviations from the plan:**
  - The owner decided to run step 2 of the harness-framework plan as a development phase instead of a standalone procedure,
    developed before Phase 10.
  - The tasks follow the triage of the 2026-10-17 harness review (its follow-up table, merged in #213) and the order of groups in
    `docs/harness-framework/README.md` §2.2, whose step 2 now points to this phase.
  - A task that changes the meaning of a product rule or an `AGENTS.md` rule asks the owner before merging, even inside the phase.
- **Problems / blockers / findings:** none.
- **Next step:** start 15.1 (the profile) when the owner asks ("Start Phase 15").
- **Verify with:** `npm run docs:check`

### 2026-10-18 — serial execution order
- **Tasks:** none started; the execution order changed
- **Branch:** `docs/15-serial-order` — the plan only
- **Decisions / deviations from the plan:** the owner decided to run Phase 15 as one serial line instead of parallel agents.
  The tasks share `AGENTS.md`, the hooks, the design files and the docs check, and depend on conventions set by earlier tasks
  (the role names of 15.1, the rule locations of 15.2, the status-marker model of 15.8). The order puts 15.8 before 15.5 and 15.4,
  and 15.10 (which renumbers §12.5) last before the re-review.
- **Problems / blockers / findings:** none.
- **Next step:** start 15.1 when the owner asks ("Start Phase 15"). Ask the owner the two questions of 15.6 before that task:
  a seeded `random()` in the script API, and a password parameter of `connect` for another player's bot.
- **Verify with:** `npm run docs:check`

### 2026-10-18 — decisions before the start
- **Tasks:** none started; the texts of all tasks and the sizes of 15.5 (3 → 5) and 15.6 (3 → 5) changed; the phase is 58 SP
- **Branch:** `docs/15-serial-order` — the plan only
- **Decisions / deviations from the plan:** the owner answered every question the phase would raise, so it can run without stops.
  These answers pre-approve the changes of meaning they cover; a change they do not cover still asks first.
  - 15.1: the profile is `docs/profile.md`; one shared constant holds the coverage threshold.
  - 15.2: the method and stack files are `docs/engineering/method.md` and `docs/engineering/stack.md`. The always-loaded set keeps
    the rules every task needs and a reading map; the method and stack files are read on demand.
  - 15.3: the architecture moves to `docs/engineering/architecture.md`.
  - 15.4: implementation notes go to `docs/operations`, `docs/testing` or the architecture document; history to `archived-docs/`.
  - 15.5: the implemented behaviour wins for the empty battery, local imports, the admin-key rule and world generation. The repair
    rule changes in the code: below the 20 % threshold, condition 0 included, a module can only be disassembled. So a broken memory
    module's files are lost when it is disassembled, and a corpse base cannot be restored (this resolves the conflict with the
    one-living-base rule). A living base's modules at or above 20 % stay repairable.
  - 15.6: `Math.random()` in scripts is the seeded random function (as implemented). The script `connect` gets a password
    parameter with the terminal's lockout (a code change; 3 → 5 SP).
  - 15.7: one name per concept, the code name ("wireless adapter", "drive" with "memory" as an alias); "Deploy" for a base,
    "assemble" for a bot.
  - 15.8: the design shows only decision status; the build status lives in the plan.
  - 15.9: the hooks and their scope as written in the task; the lint ban covers domain, engine and `lib`.
  - 15.10: §12.5 becomes design §28 with a stub.
  - 15.11: per-task log files, changelog fragments, claims by draft pull request, merges by the orchestrator or the owner.
  - 15.12: e2e ports 18080 and 15173; per-worktree database and Redis ports and compose project name in `.env`.
  - 15.13: the moved notes are removed from the user memory afterwards.
- **Problems / blockers / findings:** the task table of this file had multi-line cells (lists inside a table row), which GitHub
  does not render as a table; every row is one line now.
- **Next step:** start 15.1 when the owner asks ("Start Phase 15"); no open question remains.
- **Verify with:** `npm run docs:check`

### 2026-10-18 — 15.1 project profile done
- **Tasks:** 15.1 ✅ (H-20261017-08, export blockers B1 and B5)
- **Branch:** `docs/15.1-project-profile` — done, merged through its pull request
- **Decisions / deviations from the plan:**
  - `docs/profile.md` holds the values by role: project, quality gates, branches and merging (branch-type table, merge strategy,
    commit format), plan (task id, status symbols, SP scale, resume phrases), public API (prefix, versioning policy), languages,
    runtime versions, commands, the review term lists and bounded contexts, and the document map.
  - The coverage gate is the constant `scripts/coverage-threshold.json` (`{ statements, branches, functions, lines }`). The three
    `jest.config.ts` files import it (`mcp/tsconfig.json` gained `resolveJsonModule`); `scripts/check-changed-coverage.mjs` reads
    it and reports the gate per metric; the CI step names and the pre-push hook name the gate without its value.
  - The branch-type and merge-strategy tables left `AGENTS.md` §7.1–7.2 and `README.md` for the profile; the rules cite roles
    ("the coverage gate", "the player languages", "the API prefix", "the versioning policy"). The plan and phases bindings link to
    the profile for the shared rows; the harness bindings take the term lists and bounded contexts from it.
  - The corrected layer map of the review (its section 2) is in `docs/quality-reviews/harness/bindings.md` §1.
  - Scope of the M4 search: the rule and reference documents. Historical STATE (finished phase files, work logs, dated reports,
    `archived-docs/`) keeps the values it recorded at the time; product facts (the design, the changelog, `API.md` endpoint
    lists) keep `/api/v1` and the language names, because they describe the product, not the harness.
- **Problems / blockers / findings:**
  - `npm run lint` fails locally only on Prettier warnings for two untracked worktrees under `.claude/worktrees/`
    (their `api/openapi.json`); ESLint is clean, and CI does not see those folders.
  - `npm run test:coverage` was not run in full locally (it needs the Docker database); the gate was verified with
    `npx jest --showConfig` in all three packages (97 on each metric) and by `mcp` failing with a raised threshold in the constant.
- **Next step:** start 15.2 (method and stack split of `AGENTS.md`).
- **Verify with:** `npm run docs:check`; `git grep -nE '97 ?%' -- AGENTS.md README.md docs/testing docs/development-plan/cross-cutting`
  (no hit); `(cd mcp && npx jest --showConfig | grep -A5 coverageThreshold)`
