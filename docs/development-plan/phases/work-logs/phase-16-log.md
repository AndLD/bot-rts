[← Phase 16 — CI speed and agent throughput](../phase-16-ci-speed.md)

# Phase 16 — CI speed and agent throughput — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 16.x, 16.y
- **Branch:** `chore/16.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-18 — phase planned
- **Tasks:** none started; 16.1 to 16.9 are planned (26 SP)
- **Branch:** `docs/16-ci-speed-phase` — the plan only
- **Decisions / deviations from the plan:**
  - The owner asked to record the CI speed-up as a phase of the plan. The phase is placed after Phase 15 and before Phase 10, so
    the many task pull requests of Phase 10 wait less; the owner can move it.
  - Baseline, from the push run of #216 to `develop` (run 39158838242): `verify` 21 min, of which the tests with the coverage gate
    17 min (`client` 821 s, `api` 168 s, `mcp` 10 s, run one after another); `e2e` 11 min, `lighthouse` 4 min, `docker` 1.5 min;
    `npm ci` 70 s in each job. Slowest client files: `Economy.test.tsx` 495 s, `Logs.test.tsx` 215 s, `Supervision.test.tsx` 175 s,
    `AdminDocsPage.test.tsx` 173 s, `Inspector.test.tsx` 148 s, `RetentionCard.test.tsx` 146 s.
  - The required check names and the coverage gate (value and scope) must not change; the merged-coverage job keeps the name `verify`.
- **Problems / blockers / findings:** `e2e` (11 min, of which the Cypress run is 9 min) would become the longest required check
  once `verify` is fast, so 16.9 shards it as well; the agent waits for the slowest required check, not for `verify` alone.
- **Next step:** start 16.1 when the owner asks ("Start Phase 16").
- **Verify with:** `npm run docs:check`

### 2026-10-18 — 16.1 CI timing baseline and tool done
- **Tasks:** 16.1 ✅
- **Branch:** `chore/16.1-ci-timings` — done, PR #221
- **Decisions / deviations from the plan:**
  - The owner started Phase 16 for tasks 16.1, 16.2, 16.4 and 16.5 only, in this order, and stops after 16.5. Tasks 16.3, 16.6,
    16.7, 16.8 and 16.9 wait until Phase 15 is done (owner decision 2026-10-18), because they change files that the remaining
    Phase 15 tasks rewrite (`.githooks/pre-push`, `scripts/e2e.mjs`, the `verify` job, the stacked-branch rules).
  - `scripts/ci-timings.mjs <run-id>` calls `gh api`; the parsing and formatting are in `scripts/ci-timings-lib.mjs`, tested on
    the saved excerpt `scripts/fixtures/verify-log-excerpt.txt`. `npm run test:scripts` now runs every `scripts/*.test.mjs`.
  - Jest prints a file's duration only above its 5 s slow-test threshold, so the tool lists the slow files, not every file.
- **Problems / blockers / findings:** the baseline numbers of the introduction are confirmed by the tool: `verify` 20 min 59 s
  (tests 16 min 51 s: `api` 168 s, `client` 821 s, `mcp` 10 s), `e2e` 11 min 01 s, `lighthouse` 3 min 42 s, `docker` 1 min 33 s;
  `npm ci` 69 to 87 s per job.
- **Next step:** 16.2 (slow client tests), then 16.4, then 16.5.
- **Verify with:** `npm run test:scripts`; `node scripts/ci-timings.mjs 39158838242`; `npm run docs:check`

### 2026-10-19 — 16.5 coverage provider measured, v8 not adopted
- **Tasks:** 16.5 ✅
- **Branch:** `chore/16.5-coverage-provider` — done
- **Decisions / deviations from the plan:**
  - 16.5 runs before 16.3 (owner decision 2026-10-18), together with 16.1, 16.2 and 16.4; 16.3, 16.6, 16.7, 16.8 and 16.9 wait until
    Phase 15 is done, because they change files that the remaining Phase 15 tasks rewrite (`.githooks/pre-push`, `scripts/e2e.mjs`,
    the `verify` job, the stacked-branch rules).
  - Owner rule for this task: if v8 changes whether any file passes the coverage gate, keep the current provider and record the
    measurement. It does (5 files, 7 file metrics fall below 97 % under v8), so the default provider stays and nothing in the Jest
    configs changed. The table and the files are in `docs/testing/README.md` ("Coverage provider measurement").
- **Problems / blockers / findings:** v8 is also slower on this code: `api` 184 s against 52 s (the quickjs sandbox tests and
  ts-jest source maps), `client` 28 s against 17 s, `mcp` 11 s against 4 s. So there is no gain to trade against the changed gate.
- **Next step:** 16.3, after Phase 15 is done (then 16.9, 16.6, 16.7, 16.8)
- **Verify with:** `npm run docs:check`; `npx jest --coverage --coverageProvider=v8` in a package to repeat the measurement
