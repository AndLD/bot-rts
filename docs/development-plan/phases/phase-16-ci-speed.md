[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 16 — CI speed and agent throughput (23 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-16-log](./work-logs/phase-16-log.md)

Every task pull request waits for the required checks before it merges (`AGENTS.md` §7.5), and the `verify` job is the longest of
them: about 21 minutes on the push run of #216 to `develop` (run 39158838242, 2026-10-18). Of those, 17 minutes are the tests with
the coverage gate, run one package after another: `client` 821 s, `api` 168 s, `mcp` 10 s. Inside `client`, a few admin pages
(Ant Design under jsdom with coverage) take most of the time: `Economy.test.tsx` 495 s, `Logs.test.tsx` 215 s,
`Supervision.test.tsx` 175 s, `AdminDocsPage.test.tsx` 173 s, `Inspector.test.tsx` 148 s. Jest cannot finish before its slowest
file, so one file alone sets an eight-minute floor. `npm ci` costs another 70 s in each of the four jobs. The next longest required check, `e2e`, takes 11 minutes, so it becomes the
bound once `verify` is fast. This phase makes the required checks short without weakening any gate.

**Execution order:** 16.1 → 16.2 → 16.4 → 16.3 → 16.9 → 16.5 → 16.6 → 16.8. The baseline comes first, so every later task can show
its gain. The slow tests are fixed (16.2) before the client tests are sharded (16.3), so the shards are balanced and not bound by
one file. The caches (16.4) come before the job splits (16.3, 16.9), because each new job installs the dependencies.

| #   | Task | SP  | Status |
| --- | ---- | --- | ------ |
| 16.1 | **CI timing baseline and tool**: `scripts/ci-timings.mjs <run-id>` prints the duration of each job and step of a GitHub Actions run and the slowest test files of the `verify` log (from Jest's `PASS … (N s)` lines). A new section on CI performance in `docs/testing/README.md` records the baseline of run 39158838242 (the numbers in the introduction above). Verified by a `node --test` test of the parsing on a saved log excerpt, run by `npm run test:scripts` | 2 | ✅ |
| 16.2 | **Slow client tests**: find why the admin page tests are slow (profile `Economy.test.tsx` first: Ant Design motion and animations, `getByRole` queries on large trees, `waitFor` calls that run to their 15 s timeout) and fix the cause in the shared test wrapper or the tests, then split the files that are still large. Lower the client `testTimeout` (180 s today) to what the fixed tests need. No test is removed and no coverage is lost. Verified by the tool of 16.1 on a CI run: no client test file above 60 s, and the per-package coverage unchanged | 5 | ✅ |
| 16.3 | **Parallel CI jobs**: `verify` is split into jobs that run at the same time: the static checks (generated files, the migration diff, lint, import boundaries, typecheck, message catalogues, Markdown links, release scripts, build); the `api` tests; the `client` tests in shards (`jest --shard=i/N`); the `mcp` tests. A final job named `verify` needs them all, merges each package's coverage from its shards, and runs the coverage gate and `scripts/check-changed-coverage.mjs` on the merged data, so the required check names of `scripts/protect-branches.sh` and the coverage gate of the profile do not change. A Markdown-only change still skips the code jobs and reports green. Verified by a pull request whose coverage drops below the gate in one shard failing `verify`, and by the ruleset needing no change | 5 | ✅ |
| 16.4 | **Dependency and test caches**: `node_modules` (or the npm cache with `npm ci --prefer-offline`) and Jest's cache directory are cached across runs, keyed on `package-lock.json` and the Jest configs, in every job that installs (`verify` and its new jobs, `e2e`, `lighthouse`). Verified by the tool of 16.1: the install step of a run with a cache hit under 20 s | 2 | ✅ |
| 16.5 | **Coverage provider**: measure `coverageProvider: 'v8'` against the current provider on all three packages: run time and the coverage of every file. Adopt it only if no file crosses the coverage gate in either direction; otherwise record the measurement in the work log and keep the current provider. A change of provider that changes which files pass the gate asks the owner before merging. Verified by the comparison table in the pull request | 2 | ✅ |
| 16.6 | **Fast local gate**: the pre-push hook (the local gate of the profile, extended by 15.9) runs lint and typecheck of the changed packages, the tests related to the changed files (`jest --findRelatedTests` or `--changedSince=origin/develop`) and `scripts/check-changed-coverage.mjs` on them, instead of every test of every package. The full run stays in CI and is available as `npm run test:coverage`. `docs/testing/README.md` and the profile describe the new local gate. Verified by a test of the script that picks the packages and files, and by a push that changes one client file running only the related tests | 3 | ⬜ |
| 16.8 | **Measured result**: the CI performance section of 16.1 gets the numbers after the phase: the median wall time of `verify`, of `e2e` and of the whole run over three consecutive code CI runs with both job splits in place, next to the baseline (the CI times only, not the agent wait) | 1 | ⬜ |
| 16.9 | **Parallel e2e**: the Cypress specs of `scripts/e2e.mjs` run in shards across parallel jobs (each with its own PostgreSQL service and stack, the client built once and shared as a workflow artifact, or built per job if that is faster), split by recorded spec durations so the shards are even. A final job named `e2e` needs the shards, so the required check name does not change; the screenshots and server logs of a failed shard are still uploaded. Verified by the tool of 16.1: the `e2e` check under 6 min, and a failing spec in one shard failing `e2e` | 3 | 🟡 |

16.7 (stacked branches while CI runs, 3 SP) was deferred by the owner on 2026-10-21: 16.3 shortened the wait it was meant to use; revisit when CI waits grow again or several agents work at once.

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:**
- over three consecutive code CI runs with both job splits in place (pull request or push runs), the median wall time of `verify` and of `e2e` is at most 8 minutes each
  (21 and 11 minutes before), so no required check keeps an agent waiting longer, as recorded by 16.8;
- no client test file takes more than 60 s in CI;
- the required check names in `scripts/protect-branches.sh`, the coverage gate of the profile and its per-package and per-file scope are unchanged;
- `npm run docs:check`, `npm run lint`, `npm run test:scripts` and the coverage gate pass.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
`AGENTS.md` §7.1).

| Branch | Tasks | PR | Status |
| ------ | ----- | -- | ------ |
| `chore/16.1-ci-timings` | 16.1 | [#221](https://github.com/AndLD/bot-rts/pull/221) | ✅ merged |
| `chore/16.2-slow-client-tests` | 16.2 | [#222](https://github.com/AndLD/bot-rts/pull/222) | ✅ merged |
| `chore/16.4-ci-caches` | 16.4 | [#223](https://github.com/AndLD/bot-rts/pull/223) | ✅ merged |
| `chore/16.5-coverage-provider` | 16.5 | [#225](https://github.com/AndLD/bot-rts/pull/225) | ✅ merged |
| `chore/16.3-parallel-ci-jobs` | 16.3 | [#249](https://github.com/AndLD/bot-rts/pull/249) | ✅ merged |
