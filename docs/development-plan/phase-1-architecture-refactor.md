[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 1 — Architecture refactor, clean architecture & NestJS migration (100 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-1-log](./work-logs/phase-1-log.md)

Mostly behavior-preserving refactors that make the code testable and layered, the move from Express to **NestJS** with a
clean-architecture layout (AGENTS.md §3), and the client's move from Vite to **Next.js** (tasks 1.18 and 1.18a, done while the client is small). Each refactor is its own small PR, verified by the repository integration tests (1.1a) and, from task 1.9 on, by the safety-net tests.
The legacy Express routers keep running inside Nest until each feature module is migrated (strangler approach).

**Execution order:** the persistence move comes first, so no work is spent on MongoDB-specific code: 1.0 → 1.7 → 1.1 → 1.1a → 1.2 → 1.3 → 1.4 → 1.5, 1.6, 1.8 → **1.9 (safety-net tests)** → 1.10 (NestJS foundation) → 1.11 / 1.11a → 1.12 → 1.14–1.16 → 1.18 / 1.18a → 1.17 → 1.13.

| # | Task                                                                                                     | SP | Status |
| --- | ------------------------------------------------------------------------------------------------------- | -- | --- |
| 1.0 | Upgrade TypeScript to 5.x and Node to 20 LTS across packages; fix resulting type errors | 2 | ✅ |
| 1.1 | Introduce the **ports** in `application` as interfaces + DI tokens: `UserRepository`, `BotRepository`, `ModuleRepository`, `MapRepository`, `FileRepository`, the `UnitOfWork` and `WorldStateStore` ports, and the domain entities they exchange (persistence-agnostic, AGENTS.md §3.4) | 5 | ✅ |
| 1.1a | **PostgreSQL + Prisma adapters** (AGENTS.md §3.4) for the data the app has today: Prisma schema (users incl. their current credentials, bases and bots with the ownership model of design §8.1 — ordinary bots carry `baseId`, only bases carry `userId` —, modules, drives/files, map points, per-user known points) with committed migrations, `Prisma*Repository` classes mapping rows to domain entities, seed script, per-worker Docker test database harness, integration tests of every repository, and a CI check that applies all migrations to an empty database; the prototype's MongoDB data is discarded. Later phases extend the schema with their own migrations; known cells carry `seenAt` (design §4.2) | 14 | ✅ |
| 1.2 | Replace global `services/db.ts` singletons with an injected `PrismaClient` provided by the composition root (infrastructure only), configured from `DATABASE_URL`; it is wrapped as a Nest `PrismaModule` in 1.10 | 5 | ✅ |
| 1.3 | Remove `req`/`res` from services: refactor `usersService` (`addUser`, `activateUser`, `getUserByEmail`, `countUsersByState`) to return domain values / throw `AppError`; controllers handle HTTP | 5 | ✅ |
| 1.4 | Move all direct `usersCollection`/`db.collection()` access out of controllers into repositories/use cases, then remove the `mongodb` dependency | 3 | ✅ |
| 1.5 | Introduce a typed `AppError(statusCode, code, message)` base and a single error-handling middleware (replace `ErrorHandler` + the `tryCatch` that swallows errors); the Nest exception filter that maps `AppError` arrives in 1.10 | 3 | ✅ |
| 1.6 | Delete dead code & leftovers: `clusters/nodes` aggregations, commented blocks, `console.log`, unrelated `Utils` image helpers | 3 | ✅ |
| 1.7 | Decouple `lib` from persistence types: `ID` becomes `string` (UUID), remove `@types/mongodb` | 3 | ✅ |
| 1.8 | Split `client/src/components/Game/Terminal/Terminal.tsx` into a command interpreter (pure) + hooks + UI | 3 | ✅ |
| 1.9 | **Safety-net tests** on the PostgreSQL-backed app, before the NestJS migration: coarse HTTP-level tests (via `supertest`, real Docker database) of the golden flows — signup, login/refresh/logout, email verification, deploy base, scan, socket events `get-user-bases` / `get-user-bots` / `get-bot-modules`; plus authorization checks: a normal player cannot reach admin routes or edit users, and banned or unverified users are rejected | 6 | ✅ |
| 1.10 | **NestJS foundation**: bootstrap the Nest app on the Express adapter and mount the legacy Express routers inside it; global exception filter mapping `AppError`; `/api/v1` URI versioning for all Nest controllers; typed config module with env validation; logger provider; the `PrismaModule` wrapping the `PrismaClient` from 1.2; health endpoint; import-boundary check in CI (`dependency-cruiser` or ESLint rule) enforcing the layer rules | 6 | ✅ |
| 1.11 | Identity ports and the custom adapter (AGENTS.md §3.3): `IdentityVerifier`, `CredentialAuthService`, lazy `UserProvisioner`, `AUTH_PROVIDER` selection, JWT/role guards for HTTP and WebSocket, DTO validation, `FakeIdentityVerifier` and adapter contract tests; auth and users as Nest modules; includes the account-management operations of design §5.1 (password reset, change password, change email, delete account); plus revocable server-side sessions (refresh tokens tied to a `sessions` record; logout, ban and "force logout" revoke them) and role / ban / verified checks against the database, never the token | 9 | ✅ |
| 1.11a | Users / identities data model: domain `User` split from login credentials, with `users`, `identities` and custom-credentials tables in the Prisma schema (no data migration, the prototype data is discarded), removal of the matching legacy routers | 3 | ✅ |
| 1.12 | Migrate **bots, map, modules, files** features and the **Socket.IO gateway** (`get-user-bases`, `get-user-bots`, `get-bot-modules`, socket auth) to Nest modules/gateways; everything lives under `/api/v1` and the web client uses it; remove the legacy Express routers and setup | 7 | ✅ |
| 1.13 | Client `AuthClient` interface with a `localAuthClient` over the `/api/v1/auth/*` endpoints and auth hooks; auth forms and RTK Query slices use only the hooks; plus the matching account-management forms | 4 | ⬜ |
| 1.14 | Client structure cleanup: remove the duplicated `src/store` / `src/hooks/store` folders and dead files, reorganise into feature folders (`auth`, `terminal`, `map`, …), API base URL from env instead of the hardcoded `localhost:8080` | 3 | ✅ |
| 1.15 | Move the socket out of Redux state into a typed `SocketProvider`/service (event types shared from `lib`), drop the `serializableCheck` workaround | 3 | ✅ |
| 1.16 | Move validation rules shared by api and client (name/password patterns) into `lib` as one source of truth; remove duplicated regexes | 2 | ✅ |
| 1.17 | i18n foundation (after 1.18a): `next-intl`, English source strings and an empty Russian catalogue, namespaces per feature, language detection + switcher, all existing UI strings (currently mixed languages) moved to English keys, CI check for missing keys | 3 | ⬜ |
| 1.18 | **Next.js migration, part 1**: start with a compatibility spike (React 19, Ant Design 5 with the Next registry, RTK/react-redux, CodeMirror, Socket.IO client, canvas); Next.js app skeleton with route groups `(marketing)` (empty placeholder) and `(game)`, `NEXT_PUBLIC_*` env, `@lib` alias, SCSS, Redux/socket/auth providers as client components | 3 | ✅ |
| 1.18a | **Next.js migration, part 2**: replace React Router with App Router pages (login, verification, game, forbidden), game routes client-rendered only; remove Vite; keep build, typecheck and lint green (Jest and Cypress setup is task 2.1) | 5 | ✅ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the backend runs on NestJS with no legacy Express routers; layering matches `AGENTS.md` and the
import-boundary check passes; use cases have no Express/Prisma imports; controllers no longer touch the DB; `lib` is
persistence-free; the backend runs on PostgreSQL + Prisma; the safety-net tests (1.9) still pass; client build still green.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/1.0-typescript-node-baseline` | 1.0 | [#31](https://github.com/AndLD/bot-rts/pull/31) | ✅ |
| `feature/1.1-ports-and-prisma-adapters` | 1.1, 1.1a | [#32](https://github.com/AndLD/bot-rts/pull/32) | ✅ |
| `feature/1.7-switch-to-postgres` | 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9 | [#33](https://github.com/AndLD/bot-rts/pull/33) | ✅ |
| `feature/1.8-split-terminal` | 1.8 | [#34](https://github.com/AndLD/bot-rts/pull/34) | ✅ |
| `feature/1.10-nestjs-foundation` | 1.10 | [#35](https://github.com/AndLD/bot-rts/pull/35) | ✅ |
| `feature/1.11-identity-and-sessions` | 1.11, 1.11a, 1.16 | [#36](https://github.com/AndLD/bot-rts/pull/36) | ✅ |
| `feature/1.12-bots-gateway-nest` | 1.12 | [#37](https://github.com/AndLD/bot-rts/pull/37) | ✅ |
| `feature/1.14-client-structure` | 1.14, 1.15 | [#38](https://github.com/AndLD/bot-rts/pull/38) | ✅ |
| `feature/1.18-nextjs-migration` | 1.18, 1.18a | [#39](https://github.com/AndLD/bot-rts/pull/39) | ✅ |
