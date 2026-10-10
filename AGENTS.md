# AGENTS.md — Engineering rules for agents

This file is the source of truth for **any agent or human contributor** working on this repository. Read it fully
before writing code. If a rule conflicts with existing legacy code, the rule wins for **new and modified** code —
refactor the touched area to comply rather than perpetuating the anti-pattern.

---

## 1. Mission & non-negotiables

The project is developed to align with:

- **SOLID** — single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion.
- **High scalability** — a stateless, horizontally scalable API tier and indexed data access. The one exception is by design: the
  **engine** is the single authoritative in-memory owner of world state (persisted to MongoDB by write-behind) and is
  reached only through a port (see `docs/game-design/12-real-time-execution-model.md` §12.2.2 and §14.2).
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
- **Backend:** **NestJS** (Express adapter) with Socket.IO 4 through `@nestjs/websockets`, and the MongoDB driver (no ORM).
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
- **Monorepo:** npm workspaces for `api`, `client` and `lib` (plus the `mcp/` MCP-server package when it is added).
- **Integration DB:** **`mongodb-memory-server`** — never a shared/real DB in tests.
- **E2E:** **Cypress**.
- **Coverage:** Istanbul via Jest `--coverage`; gate 97 % enforced in CI and locally in the pre-push hook.

If a tool is not yet installed, the [development plan](./docs/DEVELOPMENT-PLAN.md) schedules it (Jest and
`mongodb-memory-server` in Phase 0, Cypress in Phase 2, and so on) — install it, don't hand-roll an alternative.

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
   infrastructure   — adapters implementing the ports: Mongo repositories, JWT, email sender, engine bridge, config
engine             — the game engine (tick loop, scheduler, QuickJS runtime), framework-free, reached through a port
mcp                — MCP server package: a thin client of /api/v1 using an API key (no direct DB or engine access)
lib
   shared types, interfaces, constants and pure functions used by api + client (NO runtime deps, NO mongodb types)
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

- `domain` imports nothing from the other layers or from NestJS/Express/MongoDB.
- `application` depends on `domain` and on **ports** (TypeScript interfaces) that it owns. It may use Nest's `@Injectable()`
  / `@Inject()` for dependency injection only; it never imports HTTP types (`Request`, `Response`, `Socket`), Express
  or MongoDB.
- `infrastructure` implements the ports (for example `MongoUserRepository implements UserRepository`) and is bound to
  the port's **DI token** in the feature module's providers. Swapping an implementation (or a test fake) is a one-line
  provider change.
- `presentation` calls use cases through their interfaces and never touches repositories or the database.
- The Nest module system is the composition root; there are no module-level singletons.
- These rules are enforced in CI by an import-boundary check (`dependency-cruiser` or an equivalent ESLint rule).

### 3.2 What is forbidden in each layer

| Layer          | Forbidden                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------- |
| presentation   | business logic, direct DB/repository access, status-code decisions inside use cases        |
| application    | `req`/`res`/`Socket`, HTTP status knowledge, `mongodb` types, importing `infrastructure`     |
| domain         | any framework import (Nest, Express, mongodb), I/O, importing other layers                  |
| infrastructure | business rules (it only adapts: persistence, tokens, email, messaging)                      |
| `lib`          | importing `mongodb` types, runtime dependencies, I/O, Node- or browser-specific APIs       |

**Legacy anti-patterns in the current Express code (eliminated by Phase 1; fix them whenever you touch a file):**

- `usersService.addUser(body, res)` — a service must **never** receive an Express `Response`. Split into a pure
  `addUser(body, status, active)` returning the user, and let the controller handle HTTP responses.
- Services calling `apiUtils.sendError(res, …)` — return domain errors / throw typed exceptions instead.
- Controllers reaching into `usersCollection` / `db.collection(...)` — move all data access to repositories.

### 3.3 Identity provider abstraction

Authentication sits behind ports so the implementation can change (the current custom auth today; Clerk or another
provider later) without touching game code.

- **`IdentityVerifier` (application port, always required):** turns a bearer token into an `Identity`
  (`{ provider, subject, email, emailVerified }`). It is used by the HTTP guard, the WebSocket guard and the MCP/API
  layers. Nothing outside the identity adapters reads provider-specific tokens or claims.
- **`CredentialAuthService` (application port, only for providers whose credentials we manage):** register, login,
  refresh, logout, verify email, resend verification. The custom adapter implements it and exposes the `/api/v1/auth/*`
  endpoints. A hosted provider such as Clerk does these steps in the browser, so its adapter does not implement this
  port and those endpoints are not mounted.
- **Own user model:** the domain `User` (internal `userId`, name, roles, `active`/ban state) is separate from login
  credentials. Provider links live in an `identities` mapping `(provider, subject) → userId`. Custom-auth secrets
  (password hash, verification tokens) live only in the custom adapter's own collection. Roles and bans are always
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
  `Mongo*Repository` (adapter). No module-level service objects (`botsService`-style singletons). File names inside Nest
  modules follow `<name>.<role>.ts` (for example `users.controller.ts`).
- Domain classes: `Module`, `ScannerModule`, `Bot`, `MapPoint`.
- Test files co-located or in `__tests__/`: `foo.test.ts` / `foo.spec.ts`.
- Boolean flags/params: `is…` / `has…` / `can…`. Avoid positional booleans (`addUser(body, true)` → use options).

### 5.2 Style

- Prettier config in `.prettierrc.json` is authoritative (2 spaces, single quotes, no semi, width 120).
- TypeScript `strict: true`; no `any` unless documented with a `// TODO(type)` and a reason.
- Errors: typed error classes extending a base `AppError(statusCode, code, message)`; don't throw raw `Error` with
  human-facing messages, don't string-match error messages.
- Logging: inject the logger provider (log4js-backed, set up in Phase 1 task 1.10) — no `console.log`. (Until then the
  legacy `getLogger('module')` from `api/utils/logger` is used.)

### 5.3 Shared code

- `lib/` holds shared **types, interfaces, constants and small pure functions** (for example validation patterns and the
  `ErrorCode` set). It has **no runtime dependencies**, no I/O, and no Node- or browser-specific APIs, so both `api` and
  `client` can import it.
- `lib` must not import `mongodb`. Replace `ID = string | ObjectId` with `string` at the API boundary and map at the
  repository edge.

---

## 6. Testing requirements (every feature)

### 6.1 Coverage gate

- **≥ 97 %** coverage on statements, branches, functions, and lines, enforced **separately per package** (`api` and
  `client`), so a well-tested package cannot hide an untested one.
- Scope: all source code is counted, including the engine, sandbox and React components. Only entry/bootstrap files
  (`index.ts`, `main.tsx`), config files, type-only files and generated code are excluded, and every exclusion is listed
  with its reason in a single coverage config file.
- The gate is enforced in CI. A PR that drops below 97 % is blocked.
- Exclusions are only allowed via targeted `/* istanbul ignore next */` with a comment explaining why, and must be
  justified in the PR.

### 6.2 Unit tests (Jest)

- Pure functions, domain models, utilities, middleware factories, validation.
- Use injected fakes/mocks (`jest.fn`) — never real I/O.
- Test edge cases: empty inputs, boundary values, error paths.

### 6.3 Integration tests (Jest + `mongodb-memory-server`)

- Repositories, use cases, and full controller→use case→repository slices (Nest testing module + `supertest`).
- Each suite boots its own in-memory Mongo instance; isolate per test (unique DB name or clean collections).
- Auth guards + real JWT signing in tests where relevant (or the `FakeIdentityVerifier`, §3.3).

### 6.4 E2E tests (Cypress)

- Critical user journeys only:
  1. Sign-up → email verification → deploy base → see terminal.
  2. Login → open terminal → run `list` / `modules`.
  3. (future) connect to a bot, edit a script, `run` it, observe output.
- Use a seeded test backend with deterministic data; never depend on the production DB.

### 6.5 Definition of Done (DoD)

A feature is done only when **all** of these hold:

- [ ] Business logic implemented behind interfaces; no `any` at public boundaries.
- [ ] Unit tests cover the new code's happy path + error paths.
- [ ] Integration tests exercise the new data access/use cases against in-memory Mongo.
- [ ] E2E test added for any new user-visible flow.
- [ ] Coverage ≥ 97 % (CI green).
- [ ] `npm run lint` and `npm run typecheck` pass (both packages).
- [ ] No dead code, no commented-out blocks, no `console.log`.
- [ ] README/docs updated if the change alters public behavior or env vars; if it changes a design decision, the matching
      file in `docs/game-design/` and/or `docs/development-plan/` is updated in the same PR.
- [ ] New or changed endpoints are under `/api/v1` and appear in the OpenAPI spec; UI strings are i18n keys (English +
      Russian).
- [ ] Feature branch (named per §7.1), descriptive PR, reviewed, merged by the strategy in §7.2; the branch is kept (§7.3).

---

## 7. Git Flow

### 7.1 Branches

| Branch                | Purpose                                                              | Branched from | Merges into          |
| --------------------- | -------------------------------------------------------------------- | ------------- | -------------------- |
| `main`                | Always releasable; every release is tagged `vX.Y.Z`                  | —             | —                    |
| `develop`             | Integration branch; all work starts here                             | `main`        | —                    |
| `feature/<id>-<slug>` | New work                                                             | `develop`     | `develop`            |
| `bugfix/<id>-<slug>`  | Non-release fixes                                                    | `develop`     | `develop`            |
| `docs/<slug>`         | Documentation-only changes                                           | `develop`     | `develop`            |
| `chore/<slug>`        | Tooling, CI, dependencies, config                                    | `develop`     | `develop`            |
| `release/<x.y.z>`     | Release stabilization (fixes only, no new features)                  | `develop`     | `main` **and** `develop` |
| `hotfix/<x.y.z>`      | Urgent production fix                                                | `main`        | `main` **and** `develop` |

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
- `main` and `develop` are protected: no direct commits, no force-push, required PR and required CI checks (branch
  protection and CI are set up in Phase 0, tasks 0.5–0.6; until then these rules are followed by convention).

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
- **Ask the user before creating a pull request and before merging a pull request.** Approval for one does not carry over
  to the other.
- Never delete a remote branch, never force-push to `main` or `develop`, never rewrite published history.
- Never enable auto-merge unless the user asks.

---

## 8. Do's & Don'ts quick reference

### ✅ Do

- Inject dependencies (including the clock and RNG); use interfaces from `lib`.
- Keep controllers thin; use cases depend on repository ports and never touch the database directly.
- Add `mongodb-memory-server` integration tests with every repository/service.
- Add a Cypress spec with every user-visible flow.
- Add/update `.env.example` for new env vars.
- Run formatter, linter, typecheck, and tests before pushing.

### ❌ Don't

- Don't pass `req`/`res`/`Socket` into services or models.
- Don't read `db`/collections directly outside repositories.
- Don't use module-level mutable singletons as test state.
- Don't commit secrets, `.env`, `node_modules`, or build output.
- Don't leave `console.log`, commented-out code, or dead aggregation pipelines.
- Don't introduce new `any`-typed public signatures.
- Don't merge without green CI and ≥ 97 % coverage.
- Don't delete remote branches after merging; keep them for history (§7.3).
- Don't create or merge a PR without asking the user first (§7.5).

---

## 9. Project-specific rules (details in `docs/`)

- **Docs are the source of truth** for game rules and plan: [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) and
  [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md). Check them before implementing a feature and keep them in sync.
- **Single writer for world state:** every change to the game world goes through the engine as a command — scripts,
  terminal, manual GUI control and API requests alike. Never write world collections from the API tier directly
  (design §14.2).
- **Determinism:** game logic must not call `Date.now()` or `Math.random()`; use the injected clock and the seeded RNG
  (design §12.4).
- **Tunable balance:** gameplay numbers (costs, ranges, tick rate, limits) live in config, not in code.
- **Script API results:** every script API call returns `Result<T>`; expected failures are values, not exceptions
  (design §10.3).
- **Game events:** the engine emits typed events after applying a tick's commands; animations, achievements and
  notifications consume them outside the tick path (design §24).
