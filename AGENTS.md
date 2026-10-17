# AGENTS.md — Engineering rules for agents

This file is the source of truth for **any agent or human contributor** working on this repository. Read it fully
before writing code. If a rule conflicts with existing legacy code, the rule wins for **new and modified** code —
refactor the touched area to comply rather than perpetuating the anti-pattern.

---

## 1. Mission & non-negotiables

The project is developed to align with:

- **SOLID** — single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion.
- **High scalability** — a stateless, horizontally scalable API tier and indexed data access. The one exception is by design: the
  **engine** is the single authoritative in-memory owner of world state (persisted to PostgreSQL by write-behind) and is
  reached only through a port (see `docs/product-knowledge/game-design/12-real-time-execution-model.md` §12.2.2 and §14.2).
- **High testability** — dependency injection, pure domain logic, no hidden I/O.
- **High maintainability** — small cohesive modules, no dead code, self-documenting names, up-to-date docs.
- **Low coupling** — layers talk through interfaces, not concrete singletons or HTTP objects.
- **Git Flow** — `main` / `develop` / `feature/*` / `release/*` / `hotfix/*`.
- **Tests for every feature** with a **coverage gate of ≥ 97 %** (statements, branches, functions, lines).

Non-negotiables (a PR that violates these is rejected):

1. Every feature ships with **unit + integration tests**, and user-visible flows get **e2e (Cypress)** tests.
2. Coverage must stay ≥ 97 %; CI fails below the gate.
3. No new `any`-typed public API boundaries. No new magic string logic without a typed constant.
4. No dead code, no commented-out blocks, no `console.log` left in committed code (use the logger).
5. No secrets in the repo; add values only to `.env.example`, never `.env`.

---

## 2. Tech stack & test tooling (do not substitute)

- **Language:** TypeScript 5.x. `api` is CommonJS + `strict: true`; `client` (Next.js) is ESM + `strict: true`. Node 20 LTS.
- **Backend:** **NestJS** (Express adapter) with Socket.IO 4 through `@nestjs/websockets`, and **PostgreSQL** accessed through **Prisma**, with the ORM confined to the infrastructure layer (§3.4).
  Nest's DI container is the composition root; OpenAPI comes from `@nestjs/swagger`.
- **Frontend:** **Next.js** (App Router) with React, Redux Toolkit + RTK Query, Ant Design 5, CodeMirror 6, and `next-intl`
  for English/Russian. One Next.js app contains both the public marketing pages (statically rendered for SEO) and the
  game, whose routes are rendered client-side only (canvas, sockets, CodeMirror, window manager). Next.js is
  **presentation only**: no business logic and no database access in Next route handlers; NestJS stays the single
  backend. The frontend is intended to be hosted on Vercel and the API/engine on a long-running server (Socket.IO and the
  engine thread cannot run on Vercel).
- **Unit / integration tests:** **Jest** for **both** packages: `ts-jest` for `api`; `next/jest` with `jsdom`, a mapper for the
  `@lib` alias and style files, and `NEXT_PUBLIC_*` env for `client`. Vitest is not used.
- **Script sandbox:** player scripts run in **QuickJS compiled to WASM** behind a `ScriptRuntime` interface, in the engine
  (never Node's `vm`, which is not a security boundary).
- **Monorepo:** npm workspaces for `api`, `client` and `lib` and `mcp` (the MCP server).
- **Database:** PostgreSQL with a pinned version; locally and in CI it runs in **Docker** (`docker-compose.yml`), with the
  same image and version as production.
- **Integration DB:** a **real PostgreSQL in Docker** — never a shared or production database in tests. Each Jest worker
  uses its own database/schema created by `prisma migrate deploy`.
  **No in-memory or embedded database** (PGlite, pg-mem, SQLite, `mongodb-memory-server`) is used in tests.
- **E2E:** **Cypress**.
- **Coverage:** Istanbul via Jest `--coverage`; gate 97 % enforced in CI and locally in the pre-push hook.

All of this tooling is installed (see the root `package.json` scripts). To add a capability, extend these tools rather than
hand-rolling an alternative; the [development plan](./docs/development-plan/DEVELOPMENT-PLAN.md) lists what is still scheduled.
Redis is used only for scaled deployments (the Socket.IO adapter and the API-to-engine link, `docs/operations/DEPLOYMENT.md`);
local development and tests run without it unless the test needs it.

---

## 3. Architecture & layering

The `api` follows **clean architecture** on top of NestJS. Source is organised in four layers and in feature modules.

```
client  (React components → hooks → store/RTK Query)     [no business logic in JSX]
   │
   └── HTTP / WebSocket (/api/v1)
api
   presentation     — Nest controllers, WebSocket gateways, DTOs (validation), guards, pipes, exception filters:
                      HTTP/WS transport concerns ONLY (parse input, call a use case, map the result/error)
   application      — use cases (services) and PORTS: repository/gateway interfaces + their DI tokens
   domain           — entities, value objects, domain services and rules (Module, Bot, MapPoint, …); pure TypeScript
   infrastructure   — adapters implementing the ports: Prisma/PostgreSQL repositories, JWT, email sender, engine bridge, config
engine             — the game engine (tick loop, scheduler, QuickJS runtime), framework-free, reached through a port
mcp                — MCP server package: a thin client of /api/v1 using an API key (no direct DB or engine access)
lib
   shared types, interfaces, constants and pure functions used by api + client (NO runtime deps, NO persistence types)
```

Each feature is a **Nest module** (`auth`, `users`, `bots`, `map`, `modules`, `files`, `terminal`, …) that contains its
own slice of the four layers and exports only its use cases.

### 3.0 One API for every client

The official `client` talks to the backend **only through the public, versioned `/api/v1` API** (REST + WebSocket), the
same surface offered to third-party clients and the MCP server. No private endpoints for the official client. New
endpoints are created under `/api/v1` and documented in the generated OpenAPI spec.

### 3.1 Dependency direction (DIP)

Dependencies point **inward** toward stable abstractions:

```
presentation → application → domain
infrastructure → application (implements its ports) → domain
```

- `domain` imports nothing from the other layers or from NestJS/Express/Prisma.
- `application` depends on `domain` and on **ports** (TypeScript interfaces) that it owns. It may use Nest's `@Injectable()`
  / `@Inject()` for dependency injection only; it never imports HTTP types (`Request`, `Response`, `Socket`), Express
  or Prisma.
- `infrastructure` implements the ports (for example `PrismaUserRepository implements UserRepository`) and is bound to
  the port's **DI token** in the feature module's providers. Swapping an implementation (or a test fake) is a one-line
  provider change.
- `presentation` calls use cases through their interfaces and never touches repositories or the database.
- The Nest module system is the composition root; there are no module-level singletons.
- These rules are enforced in CI by an import-boundary check (`dependency-cruiser` or an equivalent ESLint rule).

### 3.2 What is forbidden in each layer

| Layer          | Forbidden                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------- |
| presentation   | business logic, direct DB/repository access, status-code decisions inside use cases        |
| application    | `req`/`res`/`Socket`, HTTP status knowledge, `@prisma/client` types, importing `infrastructure`     |
| domain         | any framework import (Nest, Express, Prisma), I/O, importing other layers                  |
| infrastructure | business rules (it only adapts: persistence, tokens, email, messaging)                      |
| `lib`          | importing persistence types, runtime dependencies, I/O, Node- or browser-specific APIs       |

The legacy Express code is gone (Phase 1). Do not bring its anti-patterns back: a use case never receives a `Response` or
sends HTTP errors (it returns a value or throws a typed `AppError`), and a controller never touches a repository or the database.

### 3.3 Identity provider abstraction

Authentication sits behind ports so the implementation can change (the current custom auth today; Clerk or another
provider later) without touching game code.

- **`IdentityVerifier` (application port, always required):** turns a bearer token into an `Identity`
  (`{ provider, subject, email, emailVerified }`). It is used by the HTTP guard, the WebSocket guard and the MCP/API
  layers. Nothing outside the identity adapters reads provider-specific tokens or claims.
- **`CredentialAuthService` (application port, only for providers whose credentials we manage):** register, login,
  refresh, logout, verify email, resend verification, request/perform password reset, change password, change email,
  delete account. The custom adapter implements it and exposes the `/api/v1/auth/*`
  endpoints. A hosted provider such as Clerk does these steps in the browser, so its adapter does not implement this
  port and those endpoints are not mounted.
- **Own user model:** the domain `User` (internal `userId`, name, roles, `active`/ban state) is separate from login
  credentials. Provider links live in an `identities` mapping `(provider, subject) → userId`. Custom-auth secrets
  (password hash, verification tokens) live only in the custom adapter's own table. Roles and bans are always
  checked against our database, never taken from the token.
- **Provisioning:** on the first verified identity, a `UserProvisioner` creates the `User` and the identity link (lazy
  creation); webhooks, if a provider has them, are only a backup.
- **Selection:** `AUTH_PROVIDER` (`local` by default) chooses the adapter in the auth Nest module's provider factory.
- **API keys** (third-party clients, MCP) are a separate authenticator that also resolves to an internal `userId`; a
  composite guard accepts a session token or an API key.
- **Client side:** the web client talks to an `AuthClient` interface (sign in, sign up, current token, sign out) with a
  `localAuthClient` implementation over the `/api/v1/auth/*` endpoints; a hosted provider would add its own
  implementation. Components use hooks only, never the provider SDK directly.
- **Tests:** a `FakeIdentityVerifier` for Jest, and a shared contract test suite that every adapter must pass.

### 3.4 Persistence isolation (PostgreSQL + Prisma)

The database is an implementation detail that must stay replaceable (clean architecture / DDD):

- **Prisma stays in `infrastructure`.** The Prisma schema, migrations, `PrismaClient` and the generated types live only in
  the persistence part of the infrastructure layer. They are never imported by `domain`, `application`, `presentation`,
  `engine` or `lib`; the import-boundary check (§3.1) enforces it.
- **Repositories map, ports are persistence-agnostic.** A repository takes and returns **domain entities**; the mapping
  between Prisma rows and entities happens inside the adapter. Port methods express domain intent (`findByEmail`,
  `listBotsOfBase`), not SQL or Prisma query shapes.
- **Ids are domain-owned strings (UUIDs).** No database-generated ids or Prisma types leak into entities or DTOs.
- **Transactions through a port.** Use cases that need atomicity use a `UnitOfWork` port implemented with Prisma's
  `$transaction`.
- **The engine persists through a `WorldStateStore` port** (batched upserts, one database transaction per flush). The
  adapter may use `createMany` or raw SQL for performance; that stays inside the adapter.
- **Migrations are code:** `prisma migrate` files are committed, applied migrations are never edited, and destructive
  changes follow an expand/contract plan.
- Replacing the database must mean rewriting the infrastructure adapters only.

---

## 4. SOLID checklist (apply per file)

- **S — Single responsibility:** one class/function = one reason to change. If a function both validates, transforms,
  persists, and formats a response, split it.
- **O — Open/closed:** extend behavior by adding modules/classes (e.g. a new `Module` subclass), not by editing a
  central `switch`. Module behaviors must be polymorphic.
- **L — Liskov:** subclasses (`ScannerModule`, `WeaponModule`, …) must honor the `IModule`/`IModuleProps` contracts.
- **I — Interface segregation:** keep the `lib` interfaces narrow (`IScannerModule`, `IWeaponModule`, …). Don't force
  clients to depend on methods they don't use.
- **D — Dependency inversion:** depend on abstractions (interfaces), inject dependencies (DB access, clock, RNG,
  logger, module registry), never import module-level mutable state.

---

## 5. Conventions

### 5.1 Naming

- Files: PascalCase for React components/domain classes (`Terminal.tsx`, `ScannerModule.ts`), camelCase for
  modules/utilities (`jwt.ts`, `app.reducer.ts`).
- Injectable classes are PascalCase with a role suffix: `*Controller`, `*Service` (use cases), `*Repository` (port),
  `Prisma*Repository` (adapter). No module-level service objects (`botsService`-style singletons). File names inside Nest
  modules follow `<name>.<role>.ts` (for example `users.controller.ts`).
- Domain classes: `Module`, `ScannerModule`, `Bot`, `MapPoint`.
- Test files co-located or in `__tests__/`: `foo.test.ts` / `foo.spec.ts`.
- Boolean flags/params: `is…` / `has…` / `can…`. Avoid positional booleans (`addUser(body, true)` → use options).

### 5.2 Style

- Prettier config in `.prettierrc.json` is authoritative (2 spaces, single quotes, no semi, width 120).
- TypeScript `strict: true`; no `any` unless documented with a `// TODO(type)` and a reason.
- Errors: typed error classes extending a base `AppError(statusCode, code, message)`; don't throw raw `Error` with
  human-facing messages, don't string-match error messages.
- Logging: inject the `Logger` port (`api/src/shared/application/logger.ts`, OpenTelemetry-backed: every record carries the trace id and the span id of the span it is written in) — no `console.log`.

### 5.3 Shared code

- `lib/` holds shared **types, interfaces, constants and small pure functions** (for example validation patterns and the
  `ErrorCode` set). It has **no runtime dependencies**, no I/O, and no Node- or browser-specific APIs, so both `api` and
  `client` can import it.
- `lib` must not import persistence libraries. Ids are plain strings (UUIDs) everywhere above the repositories.

---

## 6. Testing requirements (every feature)

### 6.1 Coverage gate

- **≥ 97 %** coverage on statements, branches, functions, and lines, enforced **separately per package** (`api` and
  `client`), so a well-tested package cannot hide an untested one.
- Scope: all source code is counted, including the engine, sandbox and React components. Only entry/bootstrap files
  (`index.ts`, `main.tsx`), config files, type-only files and generated code are excluded, and every exclusion is listed
  with its reason in a single coverage config file.
- The gate is enforced in CI (`npm run test:coverage`) and in the pre-push hook, for `api`, `client` and `mcp`. A PR that drops
  below 97 %, or whose changed files are below 97 % (`scripts/check-changed-coverage.mjs`), is blocked. How testing works in practice (commands, CI gates, conventions): [`docs/testing/`](./docs/testing/README.md).
- Exclusions are only allowed via targeted `/* istanbul ignore next */` with a comment explaining why, and must be
  justified in the PR.

### 6.2 Unit tests (Jest)

- Pure functions, domain models, utilities, middleware factories, validation.
- Use injected fakes/mocks (`jest.fn`, or small hand-written fakes of a port) — never real I/O and never a database,
  in-memory or otherwise. Anything that needs a database is an integration test (§6.3).
- Test edge cases: empty inputs, boundary values, error paths.

### 6.3 Integration tests (Jest + PostgreSQL in Docker)

- Repositories, use cases, and full controller→use case→repository slices (Nest testing module + `supertest`).
- Each Jest worker uses its own database/schema on the Docker PostgreSQL; isolate per test (transaction rollback or
  truncate).
- Auth guards + real JWT signing in tests where relevant (or the `FakeIdentityVerifier`, §3.3).

### 6.4 E2E tests (Cypress)

- **Every core user and game flow has a Cypress spec.** The list of flows and the plan task that owns each spec is the
  end-to-end coverage matrix in [`docs/testing/e2e-matrix.md`](./docs/testing/e2e-matrix.md).
  A PR that adds or changes a user-visible flow adds or updates its spec and the matrix.
- Use a seeded test backend with deterministic data (seeded RNG and injected clock); never depend on a production DB.
- The full suite runs in CI on every PR into `develop`; shard it when it grows slow.

### 6.5 Definition of Done (DoD)

A feature is done only when **all** of these hold:

- [ ] Business logic implemented behind interfaces; no `any` at public boundaries.
- [ ] Unit tests cover the new code's happy path + error paths.
- [ ] Integration tests exercise the new data access/use cases against PostgreSQL (Docker).
- [ ] E2E test added for any new user-visible flow.
- [ ] Coverage ≥ 97 % (CI green).
- [ ] `npm run lint`, `npm run typecheck` and `npm run check:boundaries` pass (every package).
- [ ] Generated files are current: after an endpoint or DTO change run `npm run openapi:generate -w api` and
      `npm run api:generate -w client` and commit the result (CI fails on a stale `api/openapi.json` or client).
- [ ] `npm run i18n:check` (English and Russian catalogues) and `npm run docs:check` (Markdown links) pass.
- [ ] No dead code, no commented-out blocks, no `console.log`.
- [ ] The task is marked ✅ in its phase file and the work log has an entry for it (§7.6).
- [ ] The development plan's status is updated (a phase becomes 🟡 when its first task starts and ✅ when its exit
      criteria are met, in the summary table and in the phase file), and the branch and PR of the task are added to the
      phase's implementation log.
- [ ] If the change adds a Prisma migration, it is applied to the local development database
      (`npm run db:migrate -w api`; see §7.6 for the end-of-phase rule).
- [ ] README/docs updated if the change alters public behavior or env vars; if it changes a design decision, the matching
      file in `docs/product-knowledge/game-design/` and/or `docs/development-plan/` is updated in the same PR.
- [ ] New or changed endpoints are under `/api/v1` and appear in the OpenAPI spec; UI strings are i18n keys (English +
      Russian).
- [ ] Feature branch (named per §7.1), descriptive PR, reviewed, merged by the strategy in §7.2; the branch is kept (§7.3).

---

## 7. Git Flow

### 7.1 Branches

| Branch                | Purpose                                                              | Branched from | Merges into          |
| --------------------- | -------------------------------------------------------------------- | ------------- | -------------------- |
| `main`                | Production; always releasable; every release is tagged `vX.Y.Z`      | —             | —                    |
| `develop`             | Integration branch and GitHub default branch; all work starts here   | `main`        | —                    |
| `feature/<id>-<slug>` | New work                                                             | `develop`     | `develop`            |
| `bugfix/<id>-<slug>`  | Non-release fixes                                                    | `develop`     | `develop`            |
| `docs/<slug>`         | Documentation-only changes                                           | `develop`     | `develop`            |
| `chore/<slug>`        | Tooling, CI, dependencies, config                                    | `develop`     | `develop`            |
| `release/<x.y.z>`     | Release stabilization (fixes only, no new features)                  | `develop`     | `main` **and** `develop` |
| `hotfix/<x.y.z>`      | Urgent production fix                                                | `main`        | `main` **and** `develop` |

- A branch may cover one task or a few closely related ones; name it after the first task and list all of them in the
  phase's implementation log.
- **`<id>` is the task number from the development plan**, for example `feature/3.12-api-v1-foundation`,
  `feature/1.18-nextjs-migration`. Use the plan task that the branch implements.
- A release is finished by merging `release/<x.y.z>` (or `hotfix/<x.y.z>`) into `main`, tagging `main` with `vX.Y.Z`, and
  **merging the same branch back into `develop`** so fixes are not lost.

### 7.2 Merge strategy

| Merge                                                       | Strategy                                                                  |
| ----------------------------------------------------------- | ------------------------------------------------------------------------- |
| `feature/*`, `bugfix/*`, `docs/*`, `chore/*` → `develop`    | **Squash merge** (one Conventional Commit per PR)                         |
| `release/*`, `hotfix/*` → `main` and `develop`              | **Merge commit** (no squash), so release history stays traceable          |

### 7.3 Branch retention

- **Branches are never deleted from GitHub after merging; they are kept for history.** Turn off "automatically delete head
  branches" in the repository settings, and never run `git push --delete` / `git push origin :branch` on a remote branch.
- Deleting a *local* branch is fine when it is already merged.
- `main` and `develop` are protected by the repository ruleset of `scripts/protect-branches.sh`: no direct pushes (for administrators
  too), no force-push, no deletion, every change through a PR, and the required CI jobs `verify` (lint, import boundaries, typecheck,
  message catalogues, Markdown links, tests with the coverage gate, build), `pr-title`, `e2e` and `lighthouse` (`.github/workflows/ci.yml`).
  An administrator may bypass the rules only when merging a PR, for example past a red check. That bypass is the owner's: an agent
  never uses it unless the owner asks for that specific merge.

### 7.4 Commit & PR rules

- Commit messages: Conventional Commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`, `perf:`, `ci:`, with an
  optional scope in parentheses (`feat(engine): …`, `fix(auth): …`). Breaking changes use `!` after the type
  (`feat(api)!: …`) and a `BREAKING CHANGE:` footer. Mention the plan task id in the body (for example `Plan: 3.12`).
- One logical change per commit; PRs should be small and single-purpose.
- No direct commits to `main` or `develop`; merge via PR with at least one review (while the project is solo, the owner's
  approval to merge counts as the review).
- CI must be green (lint, typecheck, unit/integration, e2e, coverage gate) before merge.

### 7.5 Rules for agents

- If the current branch is `main` or `develop`, **create the right branch first** (names per §7.1) before changing files.
- Committing and pushing to a feature/bugfix/docs/chore branch is routine and **needs no confirmation**. Never commit or
  push directly to `main` or `develop`.
- **Plan work (approval given by the request):** when the user asks to start or continue one or more phases ("Start Phase 0",
  "Start Phases 0-3", "Continue Phase 2"), that request is the approval for **every task PR of the named phases**. Create each
  task's pull request into `develop` and squash-merge it **without asking**, once the required checks pass (before CI
  exists: once lint, typecheck and tests pass locally). Do not pause between tasks, and when a named phase's exit criteria are
  met, record it and start the next named phase. Stop after the last named phase with a summary, and earlier only when
  blocked or when a decision is needed that only the user can make. The approval does not extend to phases that were not named.
- **Plan-related PRs merge the same way.** Every PR that belongs to a named phase is covered by the same approval: its task
  PRs, and also the documentation and chore PRs that exist because of the plan (the phase's implementation log, task and
  status updates in the phase file and the development plan, the work log, the matching `docs/product-knowledge/game-design/` updates, and
  the fixes of tooling or tests that block a task). Merge them without asking once the required checks pass. A PR counts as
  plan-related only when it serves a named phase; anything else follows the next rule.
- **Opening a pull request is automatic.** Create the PR as soon as a branch is ready (any branch type, including
  `release/*` and `hotfix/*` into `main`) without asking.
- **Ask the user before merging any other pull request:** documentation or chore PRs that are not related to the development plan of a named phase, anything
  targeting `main`, and `release/*` / `hotfix/*` branches. Approval for one merge does not carry over to another.
- Never delete a remote branch, never force-push to `main` or `develop`, never rewrite published history.
- Never enable auto-merge unless the user asks.
- **CI Auto-fix is on for plan work.** After opening a PR for a named phase, bind it (`bind_pr`) and turn on the app's CI Auto-fix
  (`set_monitor` with `auto_fix`) without asking; it wakes the session on CI failures, merge conflicts and review comments. Do not
  poll CI yourself. When CI is green, merge per the rules above and go on to the next task, so work flows across phases.

### 7.6 Session protocol (resuming and pausing a phase)

Sessions can end at any time, so the repository, not the chat, carries the state of the work.

- **Pacing:** the phases named in the user's request are worked straight through in the plan's order, across phase
  boundaries; the pause points are a blocker, a decision that only the user can make, and the end of the last named phase.
  A finished phase is recorded (status, work log) and the next named phase starts.
- **At the start of a session** that continues a phase: read the phase file (`docs/development-plan/phases/phase-N-*.md`: task
  statuses, implementation log) and its work log (`docs/development-plan/phases/work-logs/phase-N-log.md`), then check `git status`,
  `git branch -a` and the open pull requests, and continue from the latest "next step".
- **While working:** set a task to 🟡 in the phase file when you start it and to ✅ when its definition of done holds.
  Commit often and push the task branch, so unfinished work is in git and not only in a working tree.
- **When a session ends or pauses, and when a task finishes:** append an entry to the phase's work log (template inside
  the file): tasks, branch and its state, decisions and deviations from the plan, problems and findings, the exact next
  step, and the commands that verify the current state. Commit and push it on the task branch, in the same pull request
  as the work.
- **Local database after a phase:** when a phase's exit criteria are met (and the task PRs are merged into `develop`), bring
  the developer's local database up to date before reporting the phase as done: `npm run db:up`, then
  `npm run db:migrate -w api` (and `npm run db:seed -w api` when the phase changed the seed data). Run it from the
  updated `develop`, never against a shared or production database. Record the result in the phase's work log and tell
  the user in the final summary; if the database is not reachable, say so and give the commands instead of skipping the step.
  Without it the API starts with an outdated schema (for example the engine fails on a missing table).
- Decisions that change the design or the plan go into the matching file in `docs/` in the same pull request, not only
  into the log.

---

## 8. Do's & Don'ts quick reference

### ✅ Do

- Inject dependencies (including the clock and RNG); use interfaces from `lib`.
- Keep controllers thin; use cases depend on repository ports and never touch the database directly.
- Add integration tests against PostgreSQL (Docker) with every repository.
- Add a Cypress spec with every user-visible flow.
- Add/update `.env.example` for new env vars.
- Run formatter, linter, typecheck, and tests before pushing.

### ❌ Don't

- Don't pass `req`/`res`/`Socket` into services or models.
- Don't use Prisma (`PrismaClient`, generated types) outside the infrastructure layer.
- Don't use module-level mutable singletons as test state.
- Don't commit secrets, `.env`, `node_modules`, or build output.
- Don't leave `console.log`, commented-out code, or dead aggregation pipelines.
- Don't introduce new `any`-typed public signatures.
- Don't merge without green CI and ≥ 97 % coverage.
- Don't delete remote branches after merging; keep them for history (§7.3).
- Don't merge a PR unrelated to the phases the user asked for without asking the user first (§7.5); opening PRs needs no approval.

---

## 9. Project-specific rules (details in `docs/`)

- **Docs are the source of truth** for game rules and plan: [`docs/product-knowledge/game-design/GAME-DESIGN.md`](./docs/product-knowledge/game-design/GAME-DESIGN.md) and
  [`docs/development-plan/DEVELOPMENT-PLAN.md`](./docs/development-plan/DEVELOPMENT-PLAN.md). Check them before implementing a feature and keep them in sync.
- **Harness quality:** the docs and this harness are reviewed by [`docs/quality-reviews/harness/README.md`](./docs/quality-reviews/harness/README.md)
  (layers, scoring, procedure; this repository's values in `bindings.md` there). A review adds one dated report and changes nothing else;
  fixes follow in separate pull requests.
- **Single writer for world state:** every change to the game world goes through the engine as a command — scripts,
  terminal, manual GUI control and API requests alike. Never write world tables from the API tier directly
  (design §14.2). The engine (`api/src/engine`) is the only writer: use cases send it commands through the engine port, and it
  runs in a worker thread of the API process or, when scaled, on its own node (`APP_ROLE`, `docs/operations/DEPLOYMENT.md`).
- **Determinism:** game logic must not call `Date.now()` or `Math.random()`; use the injected clock and the seeded RNG
  (design §12.4).
- **Tunable balance:** gameplay numbers (costs, ranges, tick rate, limits) live in config, not in code.
- **Script API results:** every script API call returns `Result<T>`; expected failures are values, not exceptions
  (design §10.3).
- **Game events:** the engine emits typed events after applying a tick's commands; animations, achievements and
  notifications consume them outside the tick path (design §24).
- **Events are edges, not levels:** an event is raised when something happens or a state begins, never on every tick or cycle a
  state lasts; keep such a state in persisted data (module properties, not engine memory) so a restart does not repeat the
  event, and cover it with a test that runs many ticks in the unchanged state (design §24.1).
- **Public API stability:** changes inside `/api/v1` must stay compatible; breaking changes ship as `/api/v2`, and a
  deprecated route is marked and announced per `docs/product-knowledge/integrations/API.md`. New player-facing endpoints declare their API-key scope,
  and the MCP server (`mcp/`) only calls the public API.
- **Player-facing text:** every UI string, error code and documentation page exists in English and Russian
  (`client/messages`, `npm run i18n:check`); player documentation is generated from `lib` and the balance config where possible.
- **Operations:** processes, scaling and releases follow `docs/operations/` (`DEPLOYMENT.md`, `RELEASING.md`); a pull request that changes behaviour adds a line under "Unreleased" in `docs/product-knowledge/CHANGELOG.md`.
- **Admin endpoints** (Phase 9, delivered in tasks 9.1–9.15 and extended by the open tasks; `/api/v1/admin/*`, design §25) are guarded by role-based permissions and two-factor authentication,
  every call is written to the audit log, and they are closed to API keys **except routes that opt in with an `admin:*:read` scope** (Phase 14: read-only keys
  granted from the console only; the owner must still hold the admin role on every call; such keys never appear in a player-facing list, spec or documentation).
- **Money and goods** (planned, Phase 10): credits and traded items move only through engine commands that write double-entry **ledger**
  entries (design §26.1); nothing updates a wallet, escrow or inbox directly, and a reconciliation test must prove that the
  money supply and item counts are conserved.
