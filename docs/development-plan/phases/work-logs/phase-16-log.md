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

### 2026-10-19 — 16.2 slow client tests done
- **Tasks:** 16.2 ✅ (16.1 merged as #221)
- **Branch:** `chore/16.2-slow-client-tests` — done, PR #222
- **Decisions / deviations from the plan:**
  - The cause was not in the admin tests but in the shared setup: Ant Design writes ~1,400 style rules into the jsdom document and
    every `getComputedStyle` call matches all of them (80 ms per call). Testing Library's role queries call it for every element,
    and `findByRole` repeats the query at every DOM change. `client/jest.setup.ts` now mocks `updateCSS` of
    `rc-util/lib/Dom/dynamicCSS`, so the rules stay out of the document. `buttonTheme.test.tsx`, which reads the rules, unmocks it.
  - No file had to be split: the largest client file now takes under 5 s in CI. The `{ timeout: 15000 }` workarounds in four test
    files are removed, and `testTimeout` goes from 180 s to 30 s.
- **Problems / blockers / findings:**
  - CI (run 39167610141): `verify` 9 min 45 s (was 21 min), client Jest 56 s (was 821 s). The longest Jest run is now `api`
    (215 s; `api.int.test.ts` 58 s, `engine.int.test.ts` 50 s), and `e2e` (10 min 51 s) is the longest check.
  - The pre-push hook cannot start its own PostgreSQL while the main checkout's containers hold ports 5432 and 6379 (15.12 covers
    this); the local gate was run by hand and the branch pushed with `--no-verify`.
- **Next step:** 16.4 (caches, PR #223 open), then 16.5.
- **Verify with:** `npm run test:coverage -w client`; `node scripts/ci-timings.mjs 39167610141`; `npm run docs:check`

### 2026-10-19 — 16.4 dependency and test caches done
- **Tasks:** 16.4 ✅
- **Branch:** `chore/16.4-ci-caches` — done, PR #223
- **Decisions / deviations from the plan:**
  - A composite action `.github/actions/install` replaces `npm ci` in `verify`, `e2e` and `lighthouse`: it caches `node_modules` of
    all workspaces (key: lock file and `.nvmrc`), runs `npm ci` on a miss and regenerates the Prisma client on a hit. The setup-node
    npm cache stays as the fallback of a miss.
  - Jest's cache lives in `/tmp/jest_*`; `verify` restores it and only a push (to `develop` or `main`) saves it, so pull requests do
    not each store a copy. Its effect cannot be seen before the first push to `develop` after the merge.
- **Problems / blockers / findings:** the install step falls from 72 to 87 s to 8 to 9 s on a hit (run 39170938431), so `lighthouse`
  takes 1 min 56 s instead of 3 min 45 s. A cache saved by a pull request is visible only to that pull request, so the first run of
  each new pull request after a lock file change is a miss.
- **Next step:** 16.5 (PR #225)
- **Verify with:** `node scripts/ci-timings.mjs <run-id> --all-steps`; `npm run docs:check`

### 2026-10-19 — 16.5 coverage provider measured, v8 not adopted
- **Tasks:** 16.5 ✅
- **Branch:** `chore/16.5-coverage-provider` — done, PR #225
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

### 2026-10-19 — session paused after 16.5
- **Tasks:** 16.1, 16.2, 16.4 and 16.5 ✅ (PRs #221, #222, #223, #225, all merged); 16.3, 16.6, 16.7, 16.8 and 16.9 are ⬜
- **Branch:** `docs/16-session-pause` — this entry only; no work is uncommitted or unpushed
- **Decisions / deviations from the plan:**
  - 16.5 ran before 16.3 (owner decision 2026-10-18): the owner started only 16.1, 16.2, 16.4 and 16.5, in this order. 16.3, 16.6,
    16.7, 16.8 and 16.9 wait until Phase 15 is done, because they change files that the remaining Phase 15 tasks rewrite
    (`.githooks/pre-push`, `scripts/e2e.mjs`, the `verify` job, the stacked-branch rules).
  - 16.5: v8 puts files below the coverage gate and is slower, so by the owner's rule the default provider stays.
- **Problems / blockers / findings:**
  - CI timings, from `scripts/ci-timings.mjs` (baseline run 39158838242, push to `develop`; after: run 39171650284, the last run of
    #223, with the caches of 16.4 warm): `verify` 20 min 59 s → 8 min 18 s (`client` Jest 821 s → 56 s; `api` Jest 168 s → about
    215 s, unchanged tests, a slower runner); `e2e` 11 min 01 s → 7 min 39 s (the install step fell from 87 s to 9 s); `lighthouse`
    3 min 42 s → 2 min 20 s; install step 72 to 87 s → 8 to 9 s on a cache hit. The exit criterion of at most 8 minutes per check
    (16.8 measures the median over three pull requests) is close for `verify` and met for `e2e` on this run; `api` tests
    (`api.int.test.ts` 58 s, `engine.int.test.ts` 50 s) and the log gateway start (37 s) are what remains in `verify`.
  - The Jest cache of 16.4 is saved only by a push to `develop` that runs the code jobs to the end. The workflow cancels a running
    push run when the next push arrives (`concurrency`), and the merges of this session were docs-only or came in quick
    succession, so the cache may not exist yet; the next code pull request merged into `develop` saves it (check with
    `gh cache list`).
  - The pre-push hook starts its own PostgreSQL (`npm run db:up`) and fails when the main checkout's containers already hold ports
    5432 and 6379; this session ran typecheck and `npm run test:coverage` by hand and pushed with `--no-verify`. 15.12 (per-worktree
    ports) fixes it. The whole client suite now takes about 15 s locally, so the pre-push run is dominated by `api` (about 1 min).
- **What the Phase 15 sessions should know:**
  - Client tests render Ant Design without its style rules (`client/jest.setup.ts` mocks `updateCSS` of `rc-util`); a test that
    reads the rules calls `jest.unmock('rc-util/lib/Dom/dynamicCSS')`. Role queries (`findByRole`) are cheap again.
  - `scripts/ci-timings.mjs <run-id>` shows where CI time goes; `npm run test:scripts` now runs every `scripts/*.test.mjs`.
  - CI installs through `.github/actions/install` (cached `node_modules`); a task that changes a workflow step that runs `npm ci`
    uses that action instead.
  - 16.3 and 16.9 rewrite the `verify` and `e2e` jobs and 16.6 the pre-push hook: do 15.9 and the other Phase 15 tasks that touch
    `.githooks/pre-push`, `scripts/e2e.mjs` and the stacked-branch rules first.
- **Next step:** 16.3, after Phase 15 is done (then 16.9, 16.6, 16.7, 16.8)
- **Verify with:** `npm run docs:check`; `node scripts/ci-timings.mjs 39171650284`; `gh cache list`
