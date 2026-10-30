[← AGENTS.md](../../AGENTS.md) · values: [profile](../profile.md) · method: [method.md](./method.md)

# Stack

The tools of this repository and the rules that name them: the stack and test tooling, the architecture and layering of the
code, the coding conventions, the stack items of the definition of done, and the agent-runtime tools. The project-neutral
workflow is in the [method](./method.md); values (versions, commands, the coverage gate) are in the [profile](../profile.md).
Read this file before writing or changing code.

---

## 1. Tech stack and test tooling (do not substitute)

- **Language:** TypeScript (version in the [profile](../profile.md#7-runtime-versions)). `api` is CommonJS + `strict: true`;
  `client` (Next.js) is ESM + `strict: true`.
- **Backend:** **NestJS** (Express adapter) with Socket.IO 4 through `@nestjs/websockets`, and **PostgreSQL** accessed through
  **Prisma**, with the ORM confined to the infrastructure layer ([architecture §2](./architecture.md#2-persistence-isolation-postgresql--prisma)). Nest's DI container is the composition root; OpenAPI
  comes from `@nestjs/swagger`.
- **Frontend:** **Next.js** (App Router) with React, Redux Toolkit + RTK Query, Ant Design 5, CodeMirror 6, and `next-intl` for
  the user-facing languages. One Next.js app contains both the public marketing pages (statically rendered for SEO) and the
  game, whose routes are rendered client-side only (canvas, sockets, CodeMirror, window manager). Next.js is **presentation
  only**: no business logic and no database access in Next route handlers; NestJS stays the single backend. The frontend is
  intended to be hosted on Vercel and the API/engine on a long-running server (Socket.IO and the engine thread cannot run on
  Vercel).
- **Unit / integration tests:** **Jest** for **both** packages: `ts-jest` for `api`; `next/jest` with `jsdom`, a mapper for the
  `@lib` alias and style files, and `NEXT_PUBLIC_*` env for `client`. Vitest is not used.
- **Script sandbox:** player scripts run in **QuickJS compiled to WASM** behind a `ScriptRuntime` interface, in the engine
  (never Node's `vm`, which is not a security boundary).
- **Monorepo:** npm workspaces for `api`, `client` and `lib` and `mcp` (the MCP server).
- **Database:** PostgreSQL with a pinned version; locally and in CI it runs in **Docker** (`docker-compose.yml`), with the same
  image and version as production.
- **Integration DB:** a **real PostgreSQL in Docker**, never a shared or production database in tests. Each Jest worker uses its
  own database/schema created by `prisma migrate deploy`. **No in-memory or embedded database** (PGlite, pg-mem, SQLite,
  `mongodb-memory-server`) is used in tests.
- **E2E:** **Cypress**.
- **Coverage:** Istanbul via Jest `--coverage`; the coverage gate (the `coverageGate` of `harness-profile.json`) is enforced in
  CI and locally in the pre-push hook, and `scripts/check-changed-coverage.mjs` checks every changed file.

All of this tooling is installed (see the root `package.json` scripts and the commands of the
[profile](../profile.md#8-commands)). To add a capability, extend these tools rather than hand-rolling an alternative; the
[development plan](../development-plan/DEVELOPMENT-PLAN.md) lists what is still scheduled. Redis is used only for scaled
deployments (the Socket.IO adapter and the API-to-engine link, `docs/operations/DEPLOYMENT.md`); local development and tests run
without it unless the test needs it. How testing works in practice (commands, CI gates, conventions):
[`docs/testing/`](../testing/README.md).

---

## 2. Architecture and layering

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

Each feature is a **Nest module** (`auth`, `users`, `bots`, `map`, `modules`, `files`, `terminal`, …) that contains its own
slice of the four layers and exports only its use cases.

The engine is the single owner of world state by design ([architecture §3](./architecture.md#3-the-engine-as-the-single-owner-of-world-state)).

### 2.0 One API for every client

The official `client` talks to the backend **only through the public, versioned API** under the API prefix of the
[profile](../profile.md#5-public-api) (REST + WebSocket), the same surface offered to third-party clients and the MCP server.
No private endpoints for the official client. New endpoints are created under the API prefix and documented in the generated
OpenAPI spec.

### 2.1 Dependency direction (DIP)

Dependencies point **inward** toward stable abstractions:

```
presentation → application → domain
infrastructure → application (implements its ports) → domain
```

- `domain` imports nothing from the other layers or from NestJS/Express/Prisma.
- `application` depends on `domain` and on **ports** (TypeScript interfaces) that it owns. It may use Nest's `@Injectable()` /
  `@Inject()` for dependency injection only; it never imports HTTP types (`Request`, `Response`, `Socket`), Express or Prisma.
- `infrastructure` implements the ports (for example `PrismaUserRepository implements UserRepository`) and is bound to the
  port's **DI token** in the feature module's providers. Swapping an implementation (or a test fake) is a one-line provider
  change.
- `presentation` calls use cases through their interfaces and never touches repositories or the database.
- The Nest module system is the composition root; there are no module-level singletons.
- These rules are enforced in CI by an import-boundary check (`dependency-cruiser`, `npm run check:boundaries`).

### 2.2 What is forbidden in each layer

| Layer          | Forbidden                                                                                   |
| -------------- | ------------------------------------------------------------------------------------------- |
| presentation   | business logic, direct DB/repository access, status-code decisions inside use cases        |
| application    | `req`/`res`/`Socket`, HTTP status knowledge, `@prisma/client` types, importing `infrastructure`     |
| domain         | any framework import (Nest, Express, Prisma), I/O, importing other layers                  |
| infrastructure | business rules (it only adapts: persistence, tokens, email, messaging)                      |
| `lib`          | importing persistence types, runtime dependencies, I/O, Node- or browser-specific APIs       |

The legacy Express code is gone (Phase 1). Do not bring its anti-patterns back: a use case never receives a `Response` or sends
HTTP errors (it returns a value or throws a typed `AppError`), and a controller never touches a repository or the database.

### 2.3 Identity provider abstraction

Moved to [architecture §1](./architecture.md#1-identity-provider-abstraction).

### 2.4 Persistence isolation (PostgreSQL + Prisma)

Moved to [architecture §2](./architecture.md#2-persistence-isolation-postgresql--prisma).

---

## 3. Conventions

### 3.1 Naming

- Files: PascalCase for React components/domain classes (`Terminal.tsx`, `ScannerModule.ts`), camelCase for modules/utilities
  (`jwt.ts`, `app.reducer.ts`).
- Injectable classes are PascalCase with a role suffix: `*Controller`, `*Service` (use cases), `*Repository` (port),
  `Prisma*Repository` (adapter). No module-level service objects (`botsService`-style singletons). File names inside Nest
  modules follow `<name>.<role>.ts` (for example `users.controller.ts`).
- Domain classes: `Module`, `ScannerModule`, `Bot`, `MapPoint`.
- Test files co-located or in `__tests__/`: `foo.test.ts` / `foo.spec.ts`.
- Boolean flags/params: `is…` / `has…` / `can…`. Avoid positional booleans (`addUser(body, true)` → use options).

### 3.2 Style

- Prettier config in `.prettierrc.json` is authoritative (2 spaces, single quotes, no semi, width 120).
- TypeScript `strict: true`; no `any` unless documented with a `// TODO(type)` and a reason.
- Errors: typed error classes extending a base `AppError(statusCode, code, message)`; don't throw raw `Error` with human-facing
  messages, don't string-match error messages.
- Logging: inject the `Logger` port (`api/src/shared/application/logger.ts`, OpenTelemetry-backed: every record carries the
  trace id and the span id of the span it is written in) — no `console.log`.

### 3.3 Shared code

- `lib/` holds shared **types, interfaces, constants and small pure functions** (for example validation patterns and the
  `ErrorCode` set). It has **no runtime dependencies**, no I/O, and no Node- or browser-specific APIs, so both `api` and
  `client` can import it.
- `lib` must not import persistence libraries. Ids are plain strings (UUIDs) everywhere above the repositories.

### 3.4 SOLID in this code base

The checklist of [method §2](./method.md#2-solid-checklist-apply-per-file) applied here: module behaviors are polymorphic (a new
`Module` subclass, not a central `switch`); subclasses (`ScannerModule`, `WeaponModule`, …) honor the `IModule`/`IModuleProps`
contracts; the `lib` interfaces stay narrow (`IScannerModule`, `IWeaponModule`, …); the clock, RNG, logger and module registry
are injected.

---

## 4. Test tooling

- **Unit tests:** Jest with `jest.fn` or small hand-written fakes of a port.
- **Integration tests:** Jest + PostgreSQL in Docker (`npm run db:up`), files `*.int.test.ts`; Nest testing module +
  `supertest` for full controller → use case → repository slices; each Jest worker uses its own database/schema created by
  `prisma migrate deploy`; auth guards with real JWT signing where relevant, or the `FakeIdentityVerifier` ([architecture §1](./architecture.md#1-identity-provider-abstraction)).
- **E2E:** Cypress (`npm run e2e`); the matrix is [`docs/testing/e2e-matrix.md`](../testing/e2e-matrix.md).
- **Coverage:** Istanbul via Jest `--coverage`; the gate is read from the `coverageGate` of `harness-profile.json` by the three
  `jest.config.ts` files, whose `collectCoverageFrom` lists each exclusion with its reason; the targeted exclusion is
  `/* istanbul ignore next */` with a comment. CI (`npm run test:coverage`) and the pre-push hook enforce it for `api`,
  `client` and `mcp`; `scripts/check-changed-coverage.mjs` blocks a PR whose changed files are below the gate.

## 5. Definition of done: stack items

These complete the definition of done of [method §4](./method.md#4-definition-of-done):

- [ ] `npm run lint`, `npm run typecheck` and `npm run check:boundaries` pass (every package).
- [ ] Generated files are current: after an endpoint or DTO change run `npm run openapi:generate -w api` and
      `npm run api:generate -w client` and commit the result (CI fails on a stale `api/openapi.json` or client).
- [ ] `npm run i18n:check` (the message catalogues of the user-facing languages) and `npm run docs:check` (Markdown links) pass.
- [ ] If the change adds a Prisma migration, it is applied to the local development database (`npm run db:migrate -w api`; see
      the session protocol of [method §6](./method.md#6-session-protocol-resuming-and-pausing-a-phase) for the end-of-phase rule;
      without it the API starts with an outdated schema, for example the engine fails on a missing table).

## 6. Agent runtime

The agent runtime of this repository is Claude Code in the Claude desktop app. Its pull-request tools implement the steps that
[`AGENTS.md`](../../AGENTS.md) §7.5 names by role:

| Role in the rules | Tool |
| ----------------- | ---- |
| Attach a pull request to the session | `bind_pr` |
| CI monitoring with automatic fixes ("CI Auto-fix") | `set_monitor` with `auto_fix`: wakes the session on CI failures, merge conflicts and review comments |

Waiting and stale events:

- Never wait with `until ! pgrep -f "git push"`: the pattern matches the waiting command itself. Write a done-file at the end of the
  background command and wait for it.
- `gh pr checks` right after a push can show no checks or old ones: wait until the `verify` job exists, then until it is not pending.
  The logs of a run are readable only when the whole run has finished, and `gh run rerun <id> --failed` works only then too.
- A CI Auto-fix event can be stale (about a head that a rebase just replaced, or a pull request that is already merged): check
  `gh pr view <n> --json state,mergeable,headRefOid` before acting, and do not merge the integration branch in.
- Read `npm run lint` to the end: the packages print one after the other and the first failure hides the rest.
