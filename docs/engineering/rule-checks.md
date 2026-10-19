[← Engineering documents](../profile.md#10-document-map)

# Rule-to-check map

Every normative rule of the repository with the mechanism that holds it. A rule with a mechanism cannot be broken without a red
check or a refused call; a rule marked _judgment_ is held by review and by the tests the feature brings, and its row says why no
mechanism can hold it. Values are in the [profile](../profile.md); the rules are in [`AGENTS.md`](../../AGENTS.md), the
[method](./method.md) and the [stack file](./stack.md). Rows 1 to 27 are the sample of the
[harness review of 2026-10-17](../quality-reviews/harness/2026-10-17.md#d7-enforceability--3), rows 28 to 36 the checks added by the
harness-fixes phase, and rows 37 on the remaining normative bullets of the three sources, so that the
[source index](#source-index) below covers every one of them.

**Statuses.** _enforced_: a red check or a refused call. _partly_: a mechanism holds part of the rule, and the row names the rest.
_judgment_: held by review; the row gives the reason. _planned_: the mechanism comes with a task of the plan, named in the row.
_permission_: the rule allows an action and sets no limit; the limits are in the rows it names.

**Mechanisms.** _CI_: a job of the pipeline that gates the merge (the profile lists the required checks). _Pre-push_: `.githooks/pre-push`
(code changes only). _Lint_: `npm run lint`. _Hook_: a script of `.claude/settings.json`, which refuses the call or acts on it in the
agent runtime. _Protection_: the repository ruleset of `scripts/protect-branches.sh`.

| # | Rule | Mechanism | Status |
| - | ---- | --------- | ------ |
| 1 | Coverage stays at or above the coverage gate (AGENTS §1) | Jest thresholds read from `scripts/coverage-threshold.json`; CI `verify`; pre-push | enforced |
| 2 | Every changed file meets the gate too (AGENTS §1, method §3) | `scripts/check-changed-coverage.mjs`; CI; pre-push | enforced |
| 3 | No `any` at public boundaries (AGENTS §1) | `@typescript-eslint/no-explicit-any` with `--max-warnings 0`; Lint | enforced |
| 4 | Import boundaries and layering (stack §2) | `npm run check:boundaries` (dependency-cruiser); CI | enforced |
| 5 | Prisma only in infrastructure (architecture §2) | dependency-cruiser; CI | enforced |
| 6 | Lint, typecheck, message catalogues, documentation links (definition of done) | CI `verify` | enforced |
| 7 | Generated files are current after an endpoint or DTO change (stack §5) | CI steps "API document and generated client are up to date" and "Documentation data is up to date"; pre-push runs the same | enforced |
| 8 | Migrations match the Prisma schema (architecture §2) | CI step | enforced |
| 9 | A pull request title is a Conventional Commit (AGENTS §7.4) | CI `pr-title` | enforced |
| 10 | Branches are kept after merging (AGENTS §7.3) | repository setting "delete head branches" off; the Hook refuses a remote deletion | enforced |
| 11 | No force-push or deletion of `main` or `develop` (AGENTS §7.3) | Protection | enforced |
| 12 | A pull request needs the required checks green (AGENTS §7.3, §7.4) | Protection lists the required status contexts | enforced; the owner may bypass when merging (profile) |
| 13 | No commits or pushes directly on `main` or `develop` (AGENTS §7.5) | Protection (administrators bypass it); the Hook `hook-guard-bash` refuses `git commit` and `git push` on them and any push naming them | enforced |
| 14 | Formatting (stack §3) | Prettier check inside Lint; the Hook `hook-format-edited` formats each edited file | enforced |
| 15 | No `console.log` in committed code (AGENTS §1) | ESLint `no-console` in `api`, `client`, `lib`, `mcp` (tests, command-line scripts and the seed excepted); Lint | enforced |
| 16 | No `Date.now()`, `new Date()` without arguments or `Math.random()` in game logic (AGENTS §9) | ESLint `no-restricted-properties` (`Date.now`, `Math.random`) and `no-restricted-syntax` (`new Date()`) in `api/src/**/domain`, `api/src/engine` and `lib/utils` (tests and the engine supervisor, `engine-process.ts` and `kill-stalled.ts`, excepted: they time and stamp a thread's stall on the real clock by design; the clock and generator adapters are in `api/src/shared/infrastructure`, outside the scope); `docs/testing/clock-consumers.md` classifies who reads which clock | enforced |
| 17 | No dead code or commented-out blocks (AGENTS §1) | `@typescript-eslint/no-unused-vars`; review | partly |
| 18 | Single writer of world state (AGENTS §9) | architecture and review; the engine port is the only way in | judgment |
| 19 | Events are edges, not levels (AGENTS §9) | the per-feature test over many ticks that the rule asks for | judgment |
| 20 | Tunable balance lives in config (AGENTS §9) | review | judgment |
| 21 | Every UI string, error code and page exists in every user-facing language (AGENTS §9) | `npm run i18n:check`; CI | enforced |
| 22 | A user-visible flow has an end-to-end spec and a row in the e2e matrix (method §3.4) | CI `e2e` runs every spec; whether a change adds a user-visible flow is a question of meaning that no script can answer, and the matrix names some specs only by task id, so it cannot be matched to the spec files mechanically | judgment |
| 23 | A behaviour change adds a changelog fragment (AGENTS §9) | `scripts/check-changelog-fragments.mjs` in `npm run docs:check` checks the format of each fragment; whether a change is behaviour that a user sees is a question of meaning, so the need for a fragment is review | partly |
| 24 | The task status, the task log and the phase file are updated in the task's pull request (method §6) | the implementation log and the plan summary are generated from the merged commits and the phase files (`npm run plan:log`, `npm run plan:summary`; the summary is checked in `docs:check`); the Hook `hook-session-start` prints the phase in progress and the last "Next step"; the status cell and the log entry are hand-written and a script cannot tell whether a task is finished, so they are review | partly |
| 25 | The local database is migrated after a phase (method §6) | the state of a developer's own database is outside the repository and CI, so nothing can read it; the end-of-phase entry of the work log records the result | judgment |
| 26 | Ask the owner before merging a pull request that is not plan work (AGENTS §7.5) | agent judgment | judgment |
| 27 | No secrets in the repository, `.env` never committed (AGENTS §1) | `.gitignore`; the Hook `hook-guard-edit` refuses edits of `.env` files except `.env.example` | enforced |
| 28 | Design status shows decisions only; every open point has a register row (AGENTS §9) | `scripts/check-open-items.mjs` in `npm run docs:check` | enforced |
| 29 | One name for one concept; terms emphasised in two design files are defined (AGENTS §9) | `scripts/check-glossary.mjs` in `npm run docs:check` | enforced |
| 30 | The product knowledge names no stack term, plan task or implementation path (AGENTS §9) | `scripts/check-product-knowledge.mjs` in `npm run docs:check` | enforced |
| 31 | Documentation links and anchors resolve | `scripts/check-markdown-links.mjs` in `npm run docs:check`; CI | enforced |
| 32 | The changed-file coverage and the generated files are checked before a push (AGENTS §7.5) | Pre-push | enforced |
| 33 | Never delete a remote branch (AGENTS §7.3, §7.5) | the Hook `hook-guard-bash` refuses `git push --delete`, `git push origin :branch` and the API call that deletes a ref | enforced |
| 34 | A task, branch, worktree and session start from the integration branch on the remote (method §5, AGENTS §7.5) | agent judgment; the session-start hook prints the branch | judgment |
| 35 | A change to a non-negotiable needs the owner's explicit confirmation, recorded in the pull request (AGENTS §1) | agent judgment | judgment |
| 36 | The CORE files name no stack term, product term or project value; the rules of AGENTS §1 and §7 cite roles, and one line binds them (method §5) | `scripts/check-core-leaks.mjs` in `npm run docs:check` | enforced |

| 36 | The CORE files name no stack term, product term or project value; the rules of AGENTS §1 and §7 cite roles, and one line binds them (method §5) | `scripts/check-core-leaks.mjs` in `npm run docs:check` | enforced |
| 37 | When a rule conflicts with existing code, the rule wins for new and modified code (AGENTS §1, method §1) | whether touched code complies is a question of design; reviewers and the tests the change brings | judgment |
| 38 | Every feature ships with unit and integration tests (AGENTS §1, method §3.2, §3.3, §4) | rows 1 and 2 fail a changed file whose tests leave it below the coverage gate; whether the tests are the right ones is review | partly |
| 39 | No new magic-string logic without a typed constant (AGENTS §1) | no lint rule tells a magic string from legitimate text (messages, keys, test data), so it is review | judgment |
| 40 | Branch names follow the types of the profile, with the plan task id (AGENTS §7.1, method §5) | nothing reads a branch name (the plan log reads the `Plan:` line of the commit, row 41), so a wrong name breaks no tool and is caught in review | judgment |
| 41 | Unplanned work becomes a task of the open-ended phase first; documentation and tooling work that no task covers uses a slug (AGENTS §7.1) | the choice depends on what the change is, which only a reader can tell; the generated plan log shows a missing `Plan:` line | judgment |
| 42 | A pull request is merged by the merge strategy of its branch type: squash for work branches, a merge commit for release and hotfix (AGENTS §7.2, profile §3) | the ruleset does not restrict merge methods, because one repository needs both; the person who merges chooses it | judgment |
| 43 | The required checks are the status contexts that the protection script sets, listed in the profile (AGENTS §7.3) | `scripts/protect-branches.sh` sets them; that the profile's list matches the script is compared by the harness review (M9) | partly |
| 44 | Only the owner bypasses the rules, and only when merging a pull request (AGENTS §7.3) | Protection allows the bypass for the `pull_request` mode only; that an agent does not use it unless asked is judgment | partly |
| 45 | A local branch may be deleted when merged (AGENTS §7.3) | none needed: this permits an action and limits nothing | permission |
| 46 | The commit message has the commit format of the profile, with the plan task id in the body (AGENTS §7.4) | CI `pr-title` checks the title of the pull request, which becomes the squash commit (row 9); the `Plan:` line is read by `npm run plan:log`, so a missing one is missing from the generated log | partly |
| 47 | One logical change per commit; pull requests are small and single-purpose (AGENTS §7.4) | size and purpose are a matter of reading the diff | judgment |
| 48 | A pull request has at least one review; while the project is solo, the owner's approval to merge counts as the review (AGENTS §7.4) | the ruleset requires zero approvals, by design for a solo project; the approval is the owner's act | judgment |
| 49 | Committing and pushing to a work branch is routine and needs no confirmation (AGENTS §7.5) | none needed: this permits an action; the limits are rows 13 and 33 | permission |
| 50 | A request to start or continue phases approves every task pull request and every plan-related pull request of the named phases, merged once the required checks pass (AGENTS §7.5) | Protection holds the "once the checks pass" part (row 12); that a pull request serves a named phase is judgment | permission |
| 51 | A task is claimed by a draft pull request before any other work; a task with an open pull request belongs to its session (AGENTS §7.5, method §6, §7) | the claim needs knowledge of who is working, which the repository does not hold; the session-start hook shows the tasks in progress and an open claim is visible in the list of pull requests | judgment |
| 52 | A pull request is opened as soon as a branch is ready, without asking (AGENTS §7.5) | none needed: this permits an action | permission |
| 53 | Any other pull request (not plan work, to the production branch, release and hotfix) is merged only after the user asks (AGENTS §7.5) | row 26; Protection holds the checks | judgment |
| 54 | Never rewrite published history (AGENTS §7.5) | Protection refuses a force-push to the protected branches (row 11); on a work branch an own history may be rewritten before others use it, so the rule is judgment there | partly |
| 55 | Never enable auto-merge unless the user asks (AGENTS §7.5) | the exception depends on what the user said, which a hook cannot see; the desktop app asks the user to approve each change of the monitor switches | judgment |
| 56 | CI monitoring with automatic fixes is on for the pull requests of plan work; CI is not polled (AGENTS §7.5, stack §6) | the agent runtime wakes the session on a failure; whether the agent turned it on is judgment | judgment |
| 57 | The design and the plan are the source of truth and are kept in sync with the code (AGENTS §9, method §4, §6) | links, the register, the glossary, the product-knowledge scan and the plan summary are checked in `docs:check` (rows 28 to 31 and `npm run plan:summary --check`); that a change updates the matching document is review | partly |
| 58 | A harness review adds one dated report and changes nothing else; fixes follow in separate pull requests (AGENTS §9) | the reviewer follows the method; a pull request that mixes them is visible in review | judgment |
| 59 | Every script API call returns `Result<T>`; expected failures are values, not exceptions (AGENTS §9) | the types of the script catalogue (`lib/utils/script-api.ts`) and the catalogue test `script-api-catalog.test.ts`; the design examples run in `design-examples.test.ts` | partly |
| 60 | The engine emits typed events after applying a tick's commands; animations, achievements and notifications consume them outside the tick path (AGENTS §9) | the typed event union checks the shape; where a consumer runs is architecture review | partly |
| 61 | Public API changes stay compatible inside a version; a deprecated route is marked and announced (AGENTS §9, profile §5) | CI regenerates the API description and fails on a stale one (row 7), so a change is visible in the diff of `api/openapi.json`; whether it is compatible is review | partly |
| 62 | New player-facing endpoints declare their API-key scope (AGENTS §9) | closed by default: a route with neither `@RequireScope` nor `@SessionOnly` is refused to keys (`api-access.guard.test.ts`), and the scope appears in the API description | enforced |
| 63 | The MCP server only calls the public API (AGENTS §9, stack §2) | no mechanism: the package has no import boundary rule, and a relative import of the `api` sources would resolve; kept by review and by the package's own client class | judgment |
| 64 | Administration routes are guarded by role and two-factor authentication, every call is audited, and API keys are refused except for the `admin:*:read` routes that opt in (AGENTS §9) | the authorization matrix test `api/src/admin/authorization-matrix.int.test.ts`, the guard tests (`admin-guards.test.ts`, `api-access.guard.test.ts`) | enforced |
| 65 | Credits and traded items move only through engine commands that write ledger entries; a reconciliation test proves conservation (AGENTS §9) | planned: the ledger and its reconciliation test belong to Phase 10 (design §26); until then no money moves | planned |
| 66 | Operations follow `docs/operations/` (processes, scaling, releases) (AGENTS §9) | `scripts/release.mjs` performs the release steps it can; the rest is the operator's judgment | partly |
| 67 | Principles: SOLID, scalability, testability, maintainability, low coupling (method §1, §2; stack §3.4) | the import-boundary rules hold the layering (row 4) and dependency injection of the clock and logger is held by rows 15 and 16; the rest is design review | partly |
| 68 | Coverage is measured separately per package, all source is counted, and every exclusion is listed with its reason (method §3.1) | each `jest.config.ts` has its own threshold and lists the exclusions; that every listing carries a reason is review | partly |
| 69 | Any other coverage exclusion is a targeted ignore comment that explains why, justified in the pull request (method §3.1, stack §4) | an ignore comment is visible in the diff; whether its reason holds is review | judgment |
| 70 | Unit tests use injected fakes and no real I/O or database; integration tests use a real database of the production version, never an in-memory substitute (method §3.2, §3.3; stack §1) | integration tests run against the image pinned in `docker-compose.yml` in CI and in the pre-push hook; a substitute would need a new dependency, which review sees | partly |
| 71 | End-to-end tests use a seeded backend with deterministic data, and the full suite runs in CI on every pull request (method §3.4) | CI `e2e` runs the suite on every pull request into the protected branches | enforced |
| 72 | The definition of done holds (method §4) | the items map to rows 1 to 8, 14 to 17, 21, 22, 24, 25 and 73 | partly |
| 73 | New or changed endpoints are under the API prefix and appear in the API description (method §4, stack §2.0) | the global prefix is set in `api/src/app.factory.ts`; the description is generated and checked (row 7) | enforced |
| 74 | Docs are updated when a change alters public behavior, configuration or a design decision, in the same pull request (method §4, §6) | the changelog fragment format (row 23) and the generated files (row 7); the rest is review | judgment |
| 75 | A release branch or hotfix branch is merged into the production branch, tagged, and merged back into the integration branch (method §5) | `docs/operations/RELEASING.md` lists the steps and `scripts/release.mjs` prepares the version; the merge back is the releaser's step | judgment |
| 76 | Stacked pull requests are rebased onto the integration branch after each squash merge, and pushed together (method §5) | a stale stack shows as a merge conflict in the pull request; the commands are advice | judgment |
| 77 | A phase is worked straight through; the pause points are a blocker, an owner decision and the end of the last named phase (method §6) | the work log records each pause; the session-start hook prints the last "Next step" | judgment |
| 78 | A session starts by reading the phase file, its log and the open pull requests (method §6) | the session-start hook prints the phase in progress and its last "Next step" | partly |
| 79 | Commit often and push the task branch; write the log entry when a session ends, pauses or finishes a task, in the same pull request (method §6) | nothing can tell that a session is about to end; the hook prints the last entry at the next start | judgment |
| 80 | Decisions that change the design or the plan go into the matching document in the same pull request (method §6) | the plan summary is checked against the phase files in `docs:check`; other documents are review | judgment |
| 81 | Several agents: the roles, the integration by one person, the routing of events and comments to the owning session, hotspot owners, per-task records (method §7) | a division of labour between sessions is not visible to the repository; the app routes events of a bound pull request to its session; records per task are the form of the files (row 23, the task log) | judgment |
| 82 | An agent does not merge its own pull request while others work (method §7) | Protection cannot tell how many agents work; the orchestrator or the owner merges | judgment |
| 83 | Generated files are regenerated after a rebase and never merged by hand (method §7) | CI and the pre-push hook fail on a stale generated file (rows 7 and 32); a hand-merged but current file passes, which is harmless | partly |
| 84 | Two working copies must not share ports, databases or running servers (method §7) | `scripts/e2e.mjs` takes ports of its own, refuses a busy port and stops only what it started; the database and Redis ports and the compose project are set per worktree in `.env` | partly |
| 85 | The tools of the stack are not substituted; a capability extends them (stack §1) | a substitute adds a dependency, which review sees | judgment |
| 86 | The official client talks to the backend only through the public API; Next.js route handlers hold no business logic or database access (stack §1, §2.0) | the generated client is the only API layer (row 7); import boundaries (row 4) keep Prisma out of presentation; the rest is review | partly |
| 87 | Dependencies point inward, and each layer has forbidden content (stack §2.1, §2.2) | `npm run check:boundaries` holds the import rules (row 4); business logic in a controller is design review | partly |
| 88 | Naming conventions of files, classes, tests and booleans (stack §3.1) | no lint rule covers them; review | judgment |
| 89 | Prettier is authoritative and TypeScript is strict (stack §3.2) | row 14 and `npm run typecheck` with `strict: true` | enforced |
| 90 | Errors are typed `AppError` values and are not matched by message (stack §3.2) | review; a raw `Error` carries no code and fails the tests that read the error code | judgment |
| 91 | `lib` has no runtime dependencies, no I/O and no persistence types (stack §3.3) | the `lib-is-independent` rule of `api/.dependency-cruiser.cjs` and the `lib` package manifest; a runtime dependency is visible in the diff | partly |
| 92 | Integration test files are `*.int.test.ts`; the end-to-end matrix is kept (stack §4) | the Jest configuration separates them; the matrix is row 22 | partly |
| 93 | `npm run lint`, `typecheck`, `check:boundaries`, `i18n:check` and `docs:check` pass in every package (stack §5) | CI `verify` and the pre-push hook (row 6) | enforced |
| 94 | A Prisma migration is applied to the local development database (stack §5) | row 8 checks the migration against the schema in CI; the developer's own database is outside the repository (row 25) | partly |
| 95 | The agent-runtime tools are used as the table of stack §6 says; waiting patterns and stale events are handled as listed (stack §6) | advice on a tool; the Hook set refuses the unsafe Git commands (rows 13 and 33) | judgment |

## Source index

Every normative bullet of the sources, by section, with the rows that hold it.

| Source | Section | Rows |
| ------ | ------- | ---- |
| `AGENTS.md` | §1 principles and non-negotiables | 1, 2, 3, 15, 17, 27, 35, 37, 38, 39 |
| `AGENTS.md` | §7.1 branches | 40, 41 |
| `AGENTS.md` | §7.2 merge strategy | 42 |
| `AGENTS.md` | §7.3 branch retention and protection | 10, 11, 12, 43, 44, 45 |
| `AGENTS.md` | §7.4 commit and pull request rules | 9, 12, 13, 46, 47, 48 |
| `AGENTS.md` | §7.5 rules for agents | 13, 26, 32, 33, 34, 49, 50, 51, 52, 53, 54, 55, 56 |
| `AGENTS.md` | §9 project rules | 16, 18, 19, 20, 21, 23, 30, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66 |
| `docs/engineering/method.md` | §1, §2 principles and SOLID | 67 |
| `docs/engineering/method.md` | §3 testing | 1, 2, 22, 68, 69, 70, 71 |
| `docs/engineering/method.md` | §4 definition of done | 72, 73, 74 |
| `docs/engineering/method.md` | §5 Git workflow | 34, 40, 75, 76 |
| `docs/engineering/method.md` | §6 session protocol | 23, 24, 25, 51, 77, 78, 79, 80 |
| `docs/engineering/method.md` | §7 several agents | 34, 51, 81, 82, 83, 84 |
| `docs/engineering/stack.md` | §1 stack and test tooling | 70, 85, 86 |
| `docs/engineering/stack.md` | §2 architecture and layering | 4, 5, 73, 86, 87 |
| `docs/engineering/stack.md` | §3 conventions | 14, 15, 67, 88, 89, 90, 91 |
| `docs/engineering/stack.md` | §4 test tooling | 1, 2, 92 |
| `docs/engineering/stack.md` | §5 definition of done, stack items | 6, 7, 8, 21, 31, 93, 94 |
| `docs/engineering/stack.md` | §6 agent runtime | 56, 95 |

Rules added to the sources change this table in the same pull request: a rule without a row is a rule nobody checks.
