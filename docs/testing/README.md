[← README](../../README.md)

# Testing

The rules (what every feature must ship with) are in [method §3](../engineering/method.md#3-testing); the tools are in [stack §4](../engineering/stack.md#4-test-tooling). This folder describes how testing
works in practice.

| Page | What it holds |
| --- | --- |
| This page | Test types, commands, CI gates, conventions |
| [e2e-matrix.md](./e2e-matrix.md) | Every core user and game flow and the Cypress spec that covers it. Update it in the same PR as a flow |
| [load-testing.md](./load-testing.md) | The load and soak harness, measured capacity, tuning |
| [known-issues.md](./known-issues.md) | Flaky-test notes and output that looks like an error but is expected |
| [reports/](./reports) | Dated one-off reports, such as the quality sweep of a phase |
| [by-phase.md](./by-phase.md) | Historical: what each phase scheduled |

## Test types

| Type | Tooling | What it covers | Database |
| --- | --- | --- | --- |
| **Unit** | Jest, mocks and small fakes of the ports | Pure functions, domain rules, use cases, the engine, scheduler, combat and energy rules (clock and RNG are injected, so results are deterministic) | none, ever |
| **Integration** | Jest + `supertest`, Nest testing module | Prisma repositories, use cases with real data, HTTP and socket slices | real PostgreSQL in Docker, one database per test file |
| **End-to-end** | Cypress against a seeded backend | **Every core user and game flow** ([matrix](./e2e-matrix.md)) | real PostgreSQL in Docker |
| **Quality gates in CI** | Lighthouse CI, import-boundary check, migration check, OpenAPI drift check, missing-translation check, Markdown link check | Landing-page SEO and performance, layering rules, migrations apply to an empty database, the committed OpenAPI spec equals the generated one, translation keys are complete, no broken links | — |

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Jest of every package (`npm run db:up` first: integration tests need PostgreSQL) |
| `npm run test:coverage` | The same with coverage; fails below the coverage gate per package |
| `npm run e2e` | Cypress against a fresh database, the API and the built client on ports 18080 and 15173 (`--open` for the runner, `--skip-build` to reuse the build, `--shard <i>/<n>` for one slice of the specs; `E2E_API_PORT` and `E2E_CLIENT_PORT` change the ports) |
| `npm run check:boundaries` | Import-boundary rules of the layered `api/src` |
| `npm run i18n:check` | The message catalogues of every user-facing language are complete |
| `npm run docs:check` | Markdown links |
| `npm run lighthouse` | Lighthouse CI on the landing page |
| `npm run load` | The load and soak harness ([load-testing.md](./load-testing.md)) |
| `npm run test:scripts` | The `node --test` tests of the scripts in `scripts/` (release, CI timings, coverage merge) |
| `node scripts/merge-coverage.mjs <artifacts-dir>` | What the `verify` job of CI runs: merges the `coverage-final.json` of the shards of each package and applies the coverage gate to the merged data ([CI jobs](#ci-jobs)) |
| `node scripts/ci-timings.mjs <run-id>` | The duration of each job and step of a GitHub Actions run and the slowest test files ([CI performance](#ci-performance)) |

The pre-push hook (`.githooks/pre-push`) runs the typecheck and the coverage gate before code leaves the machine; pushes that
change only Markdown skip it.

## Local environment

- After pulling new phases bring the database up to date: `npm run db:up` and `npm run db:migrate -w api`. An outdated schema makes the
  engine crash-loop on a missing table. `npm run db:seed -w api` creates the root owner (`ROOT_USER_EMAIL` and `ROOT_USER_PASSWORD` of
  `api/.env.development`) and is idempotent.
- `npm run db:up` starts PostgreSQL and Redis; Redis is needed by the integration tests of the scale-out and of the rate-limit store.
- The pre-push hook needs Docker, runs the typecheck and the API and client tests with the coverage gate, and takes a few minutes.
- The client typecheck uses `client/tsconfig.typecheck.json`, so a running `next dev` does not break it.
- The engine ticks a base only while a client is connected: open `/game` when a manual check needs the world running.
- zsh: quote globs (`--include='*.ts'`), BSD `sed -i` needs `-i ''`, and wait for a condition with a loop on a done-file, not with `sleep`.

## Writing and running Cypress specs locally

- `npm run e2e -- --skip-build -- --spec cypress/e2e/<file>` runs one spec; `--skip-build` reuses the client build when only specs changed
  (the API and `mcp/` are started and built each run). The ports and the separation from the development servers are in
  [Two checkouts at once](#two-checkouts-at-once).
- A spec that needs two players gives both one spawn seed (`deployBaseViaApi(token, { spawnSeed })`) and keeps the bots within radio range
  of their own base, or the calls answer `NO_SIGNAL` and the events never arrive.
- The engine keeps module properties and cells in memory: after a task changes the database, make the base scan so that it reads again.
  A cell that is missing is regenerated from the world seed, so use the `emptyCell` task for a cell that is surely free.

## Two checkouts at once

Development servers use 8080 (API) and 5173 (client), as in `.claude/launch.json`; leave them running. Everything a test run starts avoids
them and avoids a second checkout's run:

- **End-to-end runs** use the ports **18080** (API) and **15173** (client) and their own database, `botrts_e2e_<API port>`. The script
  refuses to start when one of its ports is taken, and stops only the processes it started; it never kills a development server.
  Two runs at once (two checkouts) give each its own pair: `E2E_API_PORT=18081 E2E_CLIENT_PORT=15174 npm run e2e`.
- **The database and Redis** of Docker Compose listen on 5432 and 6379 by default. A checkout that runs next to another one gets its own
  containers and ports through a `.env` file in its root (copy `.env.example`): `COMPOSE_PROJECT_NAME`, `POSTGRES_PORT` and `REDIS_PORT`
  (Compose reads the file; `npm run db:up` and the pre-push hook follow it). The pre-push hook builds `DATABASE_URL` from `POSTGRES_PORT`;
  when you run `npm test` yourself, export `DATABASE_URL` (and `REDIS_URL` for the two Redis tests), and pass `POSTGRES_PORT` to
  `npm run e2e` so that it finds the same server.
- **Integration tests** create their own databases on the server (one per test file), so two runs on one server do not meet.
- **New working copies and sessions** start from the integration branch as it is on the remote (fetch first).

Verified on 2026-10-19 (task 15.12): with listeners holding 8080 and 5173 as development servers would, and the other checkout's database
up on 5432 and 6379, one worktree ran the integration tests of `api` against its own PostgreSQL and Redis (project name, ports 15432 and 16379)
and the `gameplay` end-to-end spec on the default ports 18080 and 15173; all passed, and the listeners on 8080 and 5173 were still there
afterwards. `E2E_API_PORT=8080 npm run e2e` was refused without touching the listener.

## CI performance

Every task pull request waits for the required checks, so their duration is measured and kept short (Phase 16). Measure a run
with the tool, which needs the GitHub CLI (`gh`) signed in to the repository:

```bash
node scripts/ci-timings.mjs 39158838242 --top 10
```

It prints the wall time of the run, the duration of each job, the steps of 5 s or more (`--all-steps` for every step), the
`Time:` line of each Jest run of the test jobs' logs (`verify` for a run before 16.3) and the slowest test files. The test files come from Jest's
`PASS … (N s)` lines, which Jest prints only for files above its slow-test threshold of 5 s. `--job <name>` picks one job's
log instead of all the test jobs and `--log <file>` reads a saved one. The parsing is tested on a saved excerpt (`scripts/fixtures/verify-log-excerpt.txt`) by
`npm run test:scripts`.

**Baseline** (push run of #216 to the integration branch, run 39158838242, 2026-10-18):

| Job | Wall time | Largest steps |
| --- | --------- | ------------- |
| `verify` | 21 min | tests with the coverage gate 16 min 51 s; `npm ci` 1 min 09 s; start of the log gateway and Elasticsearch 50 s; build 32 s; typecheck 25 s; lint 20 s |
| `e2e` | 11 min | Cypress run 9 min 02 s; `npm ci` 1 min 27 s |
| `lighthouse` | 3 min 42 s | Lighthouse 1 min 32 s; `npm ci` 1 min 27 s; client build 29 s |
| `docker` | 1 min 33 s | image build 1 min 30 s |

The whole run took 21 min 02 s, bound by `verify`. The tests of `verify` run one package after another (Jest `Time:` line:
`client` 821 s, `api` 168 s, `mcp` 10 s). The slowest client files:

| Test file | Time |
| --------- | ---- |
| `src/features/admin/economy/Economy.test.tsx` | 495 s |
| `src/features/admin/logs/Logs.test.tsx` | 215 s |
| `src/features/admin/supervision/Supervision.test.tsx` | 175 s |
| `src/features/admin/docs/AdminDocsPage.test.tsx` | 173 s |
| `src/features/admin/inspector/Inspector.test.tsx` | 148 s |
| `src/features/admin/operations/RetentionCard.test.tsx` | 146 s |

Jest cannot finish before its slowest file, so `Economy.test.tsx` alone sets a floor of eight minutes for `client`. The
measurements after each Phase 16 task are added below.

**After 16.2** (slow client tests). CI, the pull request run 39167610141 (`chore/16.2-slow-client-tests`), against the baseline run:

| | Baseline | After 16.2 |
| --- | -------- | ---------- |
| `verify` | 20 min 59 s | 9 min 45 s |
| tests with the coverage gate (one step) | 16 min 51 s | 4 min 57 s |
| `client` Jest `Time:` | 821 s | 56 s |
| `api` Jest `Time:` | 168 s | 215 s (this run's runner; the `api` tests were not changed) |
| Slowest client test file | `Economy.test.tsx`, 495 s | under 5 s (Jest prints no time) |
| Client `testTimeout` | 180 s | 30 s |

Locally (`npx jest --coverage` in `client`): the whole run 239 s → 13 s, `Economy.test.tsx` 196 s → 6.8 s, the slowest single test 26 s → 1.0 s,
and the same coverage (4390 of 4393 statements, 1602 of 1603 branches). All 883 tests are kept. The slowest files of the `verify` run are now
in `api`: `api.int.test.ts` 58 s and `engine.int.test.ts` 50 s.

The cause was in the shared setup, not in the files: a CPU profile of `Economy.test.tsx` put 96 s of 105 s in jsdom's
`getComputedStyle`, called by Testing Library's role queries (`findByRole` runs again at every DOM change) and by `rc-util`'s
scrollbar measurement. Ant Design writes its style rules into the document (1,400 rules after a few components) and jsdom
matches every rule on each call (80 ms per call).

**After 16.4** (caches). `.github/actions/install` restores `node_modules` of every workspace from a cache keyed on
`package-lock.json` and `.nvmrc`, and runs `npm ci` only on a miss; `verify`, `e2e` and `lighthouse` use it. `verify` also restores
Jest's transform cache (`/tmp/jest_*`), which a push to a protected branch saves and pull requests read. The numbers are from the
pull request that added them (run 39167692779 was the first run, a cache miss; run 39170938431 the second, a hit):

| Install step | Cache miss | Cache hit |
| ------------ | ---------- | --------- |
| `verify` | 1 min 12 s | 8 s |
| `e2e` | 1 min 26 s | 9 s |
| `lighthouse` | 1 min 27 s | 9 s |

A miss costs the same as before plus 4 to 14 s to save the cache, once per change of the lock file. A change of `package-lock.json`
or of the Node version (`.nvmrc`) starts a new cache; the old one is evicted by GitHub when the repository passes its cache quota.
The Jest cache cannot be measured on a pull request: no push to a protected branch has saved one yet. The first push after this change
saves it, and the numbers of 16.8 show its effect.

**After 16.3** (parallel jobs, [CI jobs](#ci-jobs)). The time from the start of the workflow to the end of `verify`, from the pull request
runs of #249: 39435749539 (the first run, caches missed: 6 min 10 s) and 39447341042 (caches hit: 6 min 04 s). Before: `verify` 20 min 59 s
(baseline) and 8 min 18 s (after 16.2 and 16.4, run 39171650284).

| Job (run 39447341042, caches hit) | Time | Largest steps |
| --------------------------------- | ---- | ------------- |
| `api tests` | 5 min 20 s | Jest 3 min 44 s (`api.int.test.ts` 62 s, `engine.int.test.ts` 52 s); the log gateway start 52 s |
| `static checks` | 2 min 50 s | typecheck, build, lint |
| `client tests 1/3`, `2/3`, `3/3` | 1 min 02 s, 46 s, 43 s | Jest 24 to 29 s each |
| `mcp tests` | 40 s | Jest 13 s |
| `verify` | 32 s | the coverage merge and the changed-file gate |

The longest job is `api tests`, so the `verify` check is now bound by the `api` tests (one Jest run of 2532 tests) and the 52 s start of the log
gateway; sharding `api` like `client` is the next step if 6 minutes is too long. The `e2e` check (9 min 13 s here) was longer than `verify`; 16.9 shards it (below). A Markdown-only pull request reports `verify` after 2 min 35 s in all (run 39447519939): `static checks` runs the Markdown
links and the script tests, the `api`, `client` and `mcp` jobs are skipped. The same tests ran as before the split: 3489 tests in 432 suites
(`api` 2532, `client` 245 + 254 + 384 = 883, `mcp` 74). The merge counts exactly the entries of one unsharded run: for `client`
4390 of 4393 statements, 1602 of 1603 branches, 1066 of 1066 functions and 4106 of 4108 lines ([how the merge guarantees it](#ci-jobs)).

**After 16.9** (parallel e2e). The pull request run 39540515869 (`chore/16.9-parallel-e2e`, caches hit), against the run above (39447341042):

| | Before (run 39447341042) | After 16.9 |
| --- | ------------------------ | ---------- |
| `e2e` check (from the start of the shards to the end of `e2e`) | 9 min 13 s | about 4 min 1 s (slowest shard 3 min 57 s, the final job 4 s) |
| Shards `e2e tests 1/4` to `4/4` | one job | 3 min 44 s, 3 min 27 s, 3 min 57 s, 3 min 57 s (Cypress 2 min 42 s to 3 min 21 s, installation 8 s, containers 12 to 16 s) |
| Whole run | 12 min 52 s | 5 min 31 s, bound by `api tests` (4 min 57 s) |

A failing spec fails `e2e`: the temporary spec `ci-proof-failing.cy.ts` (`expect(1).to.equal(2)`), run 39541130529, was placed in shard 4/4; that shard failed
with `1 failing` and `AssertionError: expected 1 to equal 2` in `ci-proof-failing.cy.ts`, the shards 1/4, 2/4 and 3/4 and every other job passed, the final job `e2e` failed with
`Unexpected result: e2e-shard failure`, and the artifact `e2e-failure-4` held the screenshot. The spec was reverted afterwards.

## CI jobs

The required checks `verify` and `e2e` are the last jobs of several that of `.github/workflows/ci.yml` that run at the same time (tasks 16.3 and 16.9):

| Job | What it runs |
| --- | ------------ |
| `changes` | decides whether the change is Markdown-only; the code jobs below run only when it is not |
| `static checks` | generated files up to date, the migration diff, lint, import boundaries, typecheck, message catalogues, Markdown links, the script tests, build; the Markdown links and the script tests run for a Markdown-only change too |
| `api tests` | Jest of `api` with PostgreSQL, Redis and the log gateway |
| `client tests i/3` | Jest of `client`, one of three shards (`jest --shard=i/3`) |
| `mcp tests` | Jest of `mcp` |
| `e2e tests i/4` | Cypress, one of four shards (`npm run e2e -- --shard i/4`), each with its own PostgreSQL service, API and client build |
| `e2e` | needs the four shards (skipped shards are right only for a Markdown-only change); fails when one failed |
| `verify` | needs the jobs above from `static checks` to `mcp tests` (a skipped code job is right only for a Markdown-only change), merges the coverage of each package, applies the coverage gate and, on a pull request, the changed-file coverage |

Every test job runs Jest with `--coverage --coverageThreshold='{}'`, so a shard cannot fail the package gate on its own coverage, and
uploads `coverage/coverage-final.json` as the artifact `coverage-<package>-<shard>-of-<count>`. `verify` downloads them,
`scripts/merge-coverage.mjs` adds up the hit counts of statements, functions and branches of the shards entry by entry (the shards are
instrumented from the same source, so entry `i` of a file is the same code in each) and writes the `coverage-final.json` and
`coverage-summary.json` that one Jest run would write. It does not use `CoverageMap.merge` of `istanbul-lib-coverage`, which matches
entries by source location: two functions at one location (as in `client/src/site/LazyAmbient.tsx`) became one and the covered one hid
the uncovered one. If a file's statement, function or branch map differs between shards, the merge fails (exit code 2) and names the
file and the map, instead of merging around the difference. The merged package fails when any metric is below the gate of the profile:
the same value and scope as before (separately per package, plus every changed file), measured on the whole package. A missing shard fails
the merge as well, and Jest fails on a shard with no test files, so a test cannot be lost. The merge prints the absolute counts per
package, which are those of one unsharded run. To count the tests across the jobs, add the `Tests:` lines of the
jobs' logs (`node scripts/ci-timings.mjs <run-id>` lists the jobs). To try the same locally: run a package with `--shard=i/n` and
`--coverageThreshold='{}'`, copy each `coverage/coverage-final.json` to `<dir>/coverage-<package>-<i>-of-<n>/`, and run
`node scripts/merge-coverage.mjs <dir> --out <scratch-dir> <package>`.

The Cypress specs are split by `scripts/e2e-durations.json` (seconds per spec, taken from the Cypress summary of a CI run): longest spec
first into the shard with the least time so far (`specsOfShard` in `scripts/e2e-lib.mjs`). A spec that is not recorded counts as the median,
but a test of the script fails until it is recorded, so the shards stay even. Each shard builds the client itself (13 s, faster than sharing an
artifact). The screenshots and server logs of a failed shard are uploaded as `e2e-failure-<shard>`. To run one shard locally: `npm run e2e -- --shard 2/4`.

## Coverage

- The **coverage gate** of the [profile](../profile.md#2-quality-gates) on statements, branches, functions and lines,
  separately for `api`, `client` and `mcp`; its value is the constant `scripts/coverage-threshold.json`.
- The coverage provider is Jest's default (Babel instrumentation). Phase 16 measured `coverageProvider: 'v8'` and kept the default:
  v8 puts files below the gate that pass today and is slower (see [the measurement](#coverage-provider-measurement)).
- CI also blocks a PR whose **changed files** are below the gate (`scripts/check-changed-coverage.mjs`); the pre-push hook runs the same
  check after the coverage run, and you can run it yourself:
  `node scripts/check-changed-coverage.mjs origin/<integration> api client mcp` after `npm run test:coverage` (`<integration>` is the integration branch of the [profile](../profile.md#3-branches-and-merging)). A package can pass its total
  and still fail here, because every changed file is held to the gate on its own. Causes: a mocked-away module (a mocked file shows 0 %),
  an unused helper (dead code shows 0 %), and an untested side of `??` or a ternary (cover it with an input that takes each side).
- Read `Test Suites:` in the Jest summary, not only `Tests:`: a suite that fails to compile (a type error in a fixture after a shared
  interface changed) is not counted in `Tests:`. After changing a shared type run the whole unit project, never only `-t` filtered tests.
- Every task ships its own tests; the story points include them. Exclusions are listed with their reason in the Jest configs, or
  are a targeted `/* istanbul ignore next */` with a comment.

### Coverage provider measurement

Measured on 2026-10-19 (task 16.5, laptop, the default `babel` provider against `--coverageProvider=v8`, same tree and tests):

| Package | Run time, babel | Run time, v8 | Statements, babel | Statements, v8 | Files that cross the coverage gate |
| ------- | --------------- | ------------ | ----------------- | -------------- | ------------------------------ |
| `api` | 52 s | 184 s (one timing test of `quickjs-sandbox.test.ts` failed under the slower run) | 99.96 % (13008 / 13013) | 98.88 % (35921 / 36326) | 4 files, 6 metrics |
| `client` | 17 s | 28 s (with the fix of 16.2) | 99.93 % (4390 / 4393) | 99.66 % (12903 / 12947) | 1 file |
| `mcp` | 4 s | 11 s | 100 % | 100 % | none |

v8 counts source differently (about three times as many statements), reports 19 more `api` files than Babel, and lowers files whose branches Babel counted as covered. The files that fall below the gate in
v8, which pass with Babel: `api/src/engine/application/handlers/maintenance-handler.ts` (branches 66.7 %, statements and lines
87.5 %), `api/src/engine/application/handlers/factory-handler.ts` (branches 81.8 %), `api/src/logs/infrastructure/elasticsearch-client.ts`
(branches 95.7 %), `api/src/monitoring/infrastructure/http-gateway.probe.ts` (branches 96.2 %) and
`client/src/features/viewas/view-as-storage.ts` (branches 96.7 %). Decision (owner, 2026-10-18): a provider that changes which
file passes the gate is not adopted, so the default stays. Run the comparison again with
`npx jest --coverage --coverageProvider=v8` in a package and compare the two `coverage/coverage-summary.json` files.

## Conventions

- Unit tests are `*.test.ts` next to the code; integration tests are `*.int.test.ts`; contract tests and fakes of ports live in
  `api/tests/` (`contracts`, `fakes`, `integration`).
- Fakes are hand-written for ports or `jest.fn`. No in-memory or embedded database is ever used.
- Game logic never calls `Date.now()` or `Math.random()`; tests inject the clock and the seeded RNG, so a run is repeatable. Which of the two clocks (the real one, or the game's) a piece of code reads is classified in [clock-consumers.md](./clock-consumers.md) and enforced by a test.
- An event is an edge, not a level: a test runs many ticks in an unchanged state and asserts the event fires once
  (design §24.1).
- Cypress specs are in `client/cypress/e2e/<flow>.cy.ts`, run against a seeded backend with deterministic data, and are listed
  in the [matrix](./e2e-matrix.md).
- Client tests render Ant Design without its style rules (`client/jest.setup.ts`): jsdom does no layout, and the rules made every
  `getComputedStyle` call, and so every role query, slow. Do not assert on layout or on a rule's presence; a test that must read
  the rules unmocks `rc-util/lib/Dom/dynamicCSS` ([known-issues.md](./known-issues.md)).
- Test bounds on real time must be generous (a busy machine runs everything in parallel); measure real cost with the load
  harness, not with a unit test ([known-issues.md](./known-issues.md)).

## Feature-specific test requirements

Some designs define their own tests: determinism and fairness ([§12](../product-knowledge/game-design/12-real-time-execution-model.md)), sandbox
attacks ([§13](../product-knowledge/game-design/13-security-sandboxing.md)), race conditions
([§14](../product-knowledge/game-design/14-concurrency-race-conditions.md)), events ([§24](../product-knowledge/game-design/24-notifications-and-events.md)), and
for the planned phases the admin authorization matrix ([§25](../product-knowledge/game-design/25-admin-console.md)) and money conservation
([§26](../product-knowledge/game-design/26-market-and-currency.md)). The MCP server's tests are described in
[The public API and the MCP server](#the-public-api-and-the-mcp-server).

## The public API and the MCP server

Moved from `integrations/API.md` and `integrations/MCP.md` by task 15.4 of the development plan.

Contract tests keep the official client and key clients on the same API: `api/src/apikeys/contract.int.test.ts` asks the same questions
with a session and with a key and requires identical answers, and `api/src/apikeys/api-keys.int.test.ts` requires every route to
name its scope.

`mcp/` has unit tests (a fake game API, the SDK's own client over an in-memory transport and over HTTP) with the coverage gate, and
`api/src/mcp.int.test.ts` runs the server against the real API on a seeded database. The end-to-end spec of Phase 8.13 plays a scan and a
move through it with the engine running.

## The scripts of the game design

`api/src/engine/infrastructure/design-examples.test.ts` runs every `js` block of design §17 and §18 in the script sandbox against canned
answers of the game API (cells of the real shape, see `lib/utils/interfaces/map.ts`), so a design script that uses a function a bot does not
have or a field a cell does not have fails the build. `doc-examples.test.ts` does the same for the gallery of the player documentation.
