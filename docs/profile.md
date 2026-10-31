[← README](../README.md) · rules: [`AGENTS.md`](../AGENTS.md)

# Project profile

Every injectable value of this project's harness, named by its **role**. Rules elsewhere cite the role ("the coverage gate",
"the integration branch") and link here; they do not repeat the value.

**This document is generated** from [`harness-profile.json`](../harness-profile.json) and the template `profile/roles.md` of the
framework. To change a value, change it in the file and run `npm run harness -- sync --local`; never edit this document by hand.
`npm run docs:check` fails when the file, this document and `harness.lock.json` disagree. The hooks and scripts read the file through
`harness profile get <role>`. A role that has no value in the file is left out of this document.

The method documents keep their own `bindings.md` (plan, phases, code review, harness review). A binding that needs a value
below links to its row instead of copying it.

---

## 1. Project

| Role | Value |
| ---- | ----- |
| Project name | `bot-rts` (Bot RTS) |
| Product | A programmable real-time strategy sandbox: players write scripts that control bots on a shared map |
| Repository | `AndLD/bot-rts` on GitHub |
| Packages | `api` (backend and engine), `client` (web client), `lib` (shared types and pure functions), `mcp` (MCP server) |
| Agent entry file | `AGENTS.md`, loaded through `CLAUDE.md` (which holds only `@AGENTS.md`) |
| Framework and its adapters | `harness/`, a copy of `harness-framework` pinned by `harness.lock.json` (source: the staging folder `docs/harness-framework/framework/` until task 17.15); adapters `node-ts` (stack), `claude-code` (agent runtime) and `github` (host) |
| Owner | The repository owner; the only person who approves rule changes and merges outside the started phases |

## 2. Quality gates

| Role | Value | Mechanism |
| ---- | ----- | --------- |
| **Coverage gate** | **97 % of statements, branches, functions and lines** | the `coverageGate` of [`harness-profile.json`](../harness-profile.json), read by the three `jest.config.ts` files, `scripts/check-changed-coverage.mjs` and `scripts/merge-coverage.mjs` |
| Coverage gate scope | separately per package (`api`, `client`, `mcp`) **and** per changed source file of a pull request | Jest `coverageThreshold` per package; `scripts/check-changed-coverage.mjs` in CI |
| Coverage exclusions | entry and bootstrap files, config files, type-only files and generated code, each listed with its reason in the package's `jest.config.ts` | `collectCoverageFrom` |
| Local gate | the pre-push hook runs, for the files of the push only, typecheck and lint of the changed packages, the tests related to the changed files and the coverage gate on the changed files, and the generated-files check; no code check for a push that changes no file or only Markdown; the full run is CI's and `npm run test:coverage` | `.githooks/pre-push`, `scripts/local-gate.mjs` |
| **Required checks** (the merge gates) | `verify` (the job that needs the parallel jobs static checks, api tests, client tests in shards and mcp tests, merges their coverage, and applies the coverage gate and the changed-file coverage to the merged data; the static checks are generated files, the migration diff, lint, import boundaries, typecheck, message catalogues, Markdown links, script tests, framework tests and build), `pr-title` (Conventional Commit title), `e2e` (the job that needs the four shards of the end-to-end suite), `lighthouse` (public pages); jobs of the host's CI workflow | set by `scripts/protect-branches.sh` (GitHub repository ruleset `protected-branches`) from the `requiredChecks` list of [`harness-profile.json`](../harness-profile.json); the notes above are the `requiredCheckNotes` of the same file |

## 3. Branches and merging

| Role | Value |
| ---- | ----- |
| **Production branch** | `main`; every release is tagged `vX.Y.Z` |
| **Integration branch** | `develop`; also the GitHub default branch; all work starts here |
| Protected branches | the production and the integration branch |
| Branch retention | merged branches are kept on GitHub; automatic deletion of head branches is off |

Branch types:

| Type | Name | Purpose | Branched from | Merges into | Merge strategy |
| ---- | ---- | ------- | ------------- | ----------- | -------------- |
| feature | `feature/<id>-<slug>` | new work | integration | integration | squash merge |
| bugfix | `bugfix/<id>-<slug>` | non-release fixes | integration | integration | squash merge |
| docs | `docs/<slug>` | documentation-only changes | integration | integration | squash merge |
| chore | `chore/<slug>` | tooling, CI, dependencies, config | integration | integration | squash merge |
| release | `release/<x.y.z>` | release stabilization (fixes only) | integration | production **and** integration | merge commit |
| hotfix | `hotfix/<x.y.z>` | urgent production fix | production | production **and** integration | merge commit |

`<id>` is a plan task id (section 4); a docs or chore branch that implements a plan task may carry it too
(`docs/15.1-project-profile`). A squash merge produces one Conventional Commit per pull request; a merge commit keeps release history traceable.

| Role | Value |
| ---- | ----- |
| Commit format | [Conventional Commits](https://www.conventionalcommits.org/): `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `ci`, optional scope in parentheses, `!` and a `BREAKING CHANGE:` footer for breaking changes |
| Plan reference in a commit | a `Plan: <task id>` line in the body |
| Pull-request title | the squash commit's message, checked by the CI job `pr-title` |

## 4. Plan

| Role | Value |
| ---- | ----- |
| Plan index | [`development-plan/DEVELOPMENT-PLAN.md`](./development-plan/DEVELOPMENT-PLAN.md) |
| Milestone | a phase, one file `docs/development-plan/phases/phase-<n>-<slug>.md` |
| Task id | `<phase>.<number>`, with an optional letter suffix (`3.12`, `1.1a`) |
| Session log | `docs/development-plan/phases/work-logs/phase-<n>-log.md`, one per phase, append-only: the phase-wide entries (decisions before the start, pauses) |
| Phases with per-task records | Phase 10 and every phase planned after 2026-10-19: each task writes one log fragment `docs/development-plan/phases/work-logs/phase-<n>/<task id>.md` (template: `work-logs/_task-template.md`), and the phase file carries no implementation-log table |
| Phases with one log | Phases 0 to 9 and 11 to 16: the phase's own log only, and the implementation-log table of the phase file |
| Plan-log command | `npm run plan:log -- <n>` |
| Implementation log | printed from the merged pull requests by the plan-log command (the `Plan: <task id>` lines of the squash commits); the phases with one log keep the table written in the phase file |
| Task claim | a draft pull request titled `chore(plan): claim task <task id>` with `Plan: <task id>` in the body, opened before any other work on the task |
| Status symbols | ⬜ not started · 🟡 in progress · ✅ done |
| Estimation scale | story points (SP), Fibonacci; 1 SP is about half a developer-day or one focused agent session; estimates include the tests the definition of done requires |
| Resume phrases | "Start Phase N", "Start Phases N-M", "Continue Phase N"; the phrase approves the pull requests of the named phases |
| Open-ended phase | Phase 12 (issues found in use); its size grows |
| Specification citation | `design §<section>` for the game design (for example `design §12.4`) |

## 5. Public API

| Role | Value |
| ---- | ----- |
| **API prefix** | `/api/v1` (REST and WebSocket); the official client, third-party clients and the MCP server use the same surface |
| Versioning policy | changes inside a version stay compatible; a breaking change ships as the next version (`/api/v2`); deprecation and announcement per [`product-knowledge/integrations/API.md`](./product-knowledge/integrations/API.md) |
| API description | the OpenAPI document `api/openapi.json`, generated from the controllers and DTOs |

## 6. Languages

| Role | Value |
| ---- | ----- |
| **User-facing languages** | English (`en`) and Russian (`ru`): every UI string, error message and player documentation page |
| Message catalogues | `client/messages/en.json`, `client/messages/ru.json`, checked by `npm run i18n:check` |
| Language of the harness and the design documents | English |

## 7. Runtime versions

| Role | Value |
| ---- | ----- |
| Language | TypeScript 5.x, `strict: true` |
| Runtime | Node.js 20 LTS |
| Database | PostgreSQL, the image pinned in `docker-compose.yml` (`postgres:16.4`), the same version locally, in CI and in production |

## 8. Commands

Run from the repository root unless a package is named.

| Role | Command |
| ---- | ------- |
| Lint (ESLint of every package and the Prettier check) | `npm run lint` |
| Format | `npm run format` |
| Typecheck | `npm run typecheck` |
| Unit and integration tests | `npm test` (needs `npm run db:up`) |
| Tests with the coverage gate | `npm run test:coverage` |
| Changed-file coverage | `node scripts/check-changed-coverage.mjs origin/develop api client mcp` (after `npm run test:coverage`) |
| Import boundaries | `npm run check:boundaries` |
| Message catalogues | `npm run i18n:check` |
| Every check of the framework (`harness check all`): the vendored copy, the profile file, the layer map, links, backticked paths, the CORE scan, the plan summary, the changelog fragments and the product knowledge | `npm run docs:check` |
| Take the framework again from its source into `harness/`; regenerate the managed files only; show a local change of `harness/` | `npm run harness -- sync`; `npm run harness -- sync --local`; `npm run harness -- diff` |
| Build | `npm run build` |
| End-to-end tests | `npm run e2e` |
| Regenerate the API description | `npm run openapi:generate -w api` |
| Regenerate the web client's API layer | `npm run api:generate -w client` |
| Start the local database (and Redis) | `npm run db:up` |
| Apply migrations to the local database | `npm run db:migrate -w api` |
| Seed the local database | `npm run db:seed -w api` |

A release (`harness release`, on a release or hotfix branch) sets the version of package.json, lib/package.json, api/package.json, client/package.json, and then runs `npm install --package-lock-only --ignore-scripts`.

## 9. Review values

The harness review's term lists (M1, M2 of its method) and the bounded contexts of the product knowledge.

Stack terms (case-insensitive), which must not appear in CORE or DOMAIN text:

```bash
STACK='nestjs|prisma|postgres|\bjest\b|cypress|quickjs|socket\.io|next\.js|vercel|docker|redis|expressjs|express\.js|reactjs|react\.js|redux|ant design|codemirror|\bnpm\b|node\.js|nodejs|github actions|husky|playwright|lighthouse|\btypescript\b'
```

Product terms, which must not appear in CORE sections (the CORE scan skips the generic words below):

```bash
PRODUCT='bot-rts|\bbots?\b|\bmodules?\b|scanner|botos|\bterminal\b|\btick\b|credits|\bbase\b|\bscripts?\b|\bplayers?\b'
```

Generic words of the product list, judged in context and not scanned in CORE text:

```bash
PRODUCT_GENERIC='\bmodules?\b|\bscripts?\b'
```

Project values, which must not appear in CORE text except on the **Role binding** line of `AGENTS.md` (the CORE scan of
`npm run docs:check` reads this list from the profile file; the CORE files are listed in the [harness bindings](./quality-reviews/harness/bindings.md)):

```bash
PROJECT_VALUES='`main`|`develop`|\b97 ?%|\bPhase [0-9]+|/api/v1|andld|bind_pr|set_monitor|auto-fix|\bgithub\b|design §|npm run [a-z:]+|scripts/[a-z-]+\.(mjs|sh)|\benglish\b|\brussian\b|\.claude/|\.githooks|(feature|bugfix|docs|chore)/[0-9]|[0-9]{4}-[0-9]{2}-[0-9]{2}(-[0-9]+)?\.md'
```

The product-knowledge check (`harness check product-knowledge`, part of `npm run docs:check`) reads the product specification in
`docs/product-knowledge/game-design/`: its glossary `02-glossary.md`, its register of open items `20-open-questions.md` and its backlog `21-backlog.md`.
A line may point to the backlog by its section, §21.
It scans `docs/product-knowledge/` for stack terms, plan references and code paths (`\b(?:api|client)\/src\/|\.(?:int\.)?test\.tsx?\b|module-catalog`), except `archived-docs/**, CHANGELOG.md, game-design/20-open-questions.md, game-design/21-backlog.md`.
A file keeps the stack terms that are part of its product: `productKnowledge.allowedTerms` of the profile file.

Bounded contexts (files of the product specification):

| Context | Sections |
| ------- | -------- |
| Foundations | 01 vision, 02 glossary, 03 core loop, 05 onboarding |
| World and base | 04 world and map, 06 the base |
| Machines and items | 07 modules, 08 bots, 09 resources, items and crafting, 28 energy, power and the day cycle |
| Scripting and runtime | 10 script API, 11 terminal, 12 execution model, 13 security, 14 concurrency, 18 example scripts |
| Interface and play | 15 screens, 17 in-game scenarios |
| Economy and social | 16 economy and progression, 23 achievements, 26 market and currency, 27 chat and transfers |
| Platform | 22 public API, 24 events and notifications, 25 admin console, 20 open questions, 21 backlog |

## 10. Document map

| Role | Document |
| ---- | -------- |
| Agent rules (always loaded) | [`AGENTS.md`](../AGENTS.md) |
| Engineering method (read on demand) | [`engineering/method.md`](./engineering/method.md) |
| Stack, layering, conventions (read on demand) | [`engineering/stack.md`](./engineering/stack.md) |
| Architecture decisions (read on demand) | [`engineering/architecture.md`](./engineering/architecture.md) |
| Rule-to-check map (read on demand) | [`engineering/rule-checks.md`](./engineering/rule-checks.md) |
| Project profile | this file |
| Project overview, setup, environment variables | [`README.md`](../README.md) |
| Product specification | [`product-knowledge/game-design/GAME-DESIGN.md`](./product-knowledge/game-design/GAME-DESIGN.md) |
| Glossary | [`product-knowledge/game-design/02-glossary.md`](./product-knowledge/game-design/02-glossary.md) |
| Public API contract | [`product-knowledge/integrations/API.md`](./product-knowledge/integrations/API.md), [`product-knowledge/integrations/MCP.md`](./product-knowledge/integrations/MCP.md) |
| Changelog | [`product-knowledge/CHANGELOG.md`](./product-knowledge/CHANGELOG.md); entries of unreleased changes are fragments in [`product-knowledge/changelog.d/README.md`](./product-knowledge/changelog.d/README.md), collected by the release script |
| Plan index | [`development-plan/DEVELOPMENT-PLAN.md`](./development-plan/DEVELOPMENT-PLAN.md) |
| Plan method and its values | [`development-plan/README.md`](./development-plan/README.md), [`development-plan/bindings.md`](./development-plan/bindings.md) |
| Definition of done | [`development-plan/cross-cutting/definition-of-done.md`](./development-plan/cross-cutting/definition-of-done.md) |
| Guiding principles | [`development-plan/cross-cutting/guiding-principles.md`](./development-plan/cross-cutting/guiding-principles.md) |
| Testing guide, e2e matrix | [`testing/README.md`](./testing/README.md), [`testing/e2e-matrix.md`](./testing/e2e-matrix.md) |
| Deployment and releases | [`operations/DEPLOYMENT.md`](./operations/DEPLOYMENT.md), [`operations/RELEASING.md`](./operations/RELEASING.md) |
| Code quality reviews | [`quality-reviews/code/README.md`](./quality-reviews/code/README.md) |
| Harness quality reviews | [`quality-reviews/harness/README.md`](./quality-reviews/harness/README.md), [`quality-reviews/harness/bindings.md`](./quality-reviews/harness/bindings.md) |
| Harness-to-framework plan | [`harness-framework/README.md`](./harness-framework/README.md) |
