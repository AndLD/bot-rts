[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 1 — Architecture refactor, clean architecture & NestJS migration (76 SP)

Behavior-preserving refactors that make the code testable and layered, the move from Express to **NestJS** with a
clean-architecture layout (AGENTS.md §3), and the client's move from Vite to **Next.js** (task 1.18, done while the client is small). Each refactor is its own small PR, verified by the Phase 0 safety-net tests.
The legacy Express routers keep running inside Nest until each feature module is migrated (strangler approach).

| # | Task                                                                                                     | SP |
| --- | ------------------------------------------------------------------------------------------------------- | -- |
| 1.0 | Upgrade TypeScript to 5.x and Node to 20 LTS across packages; fix resulting type errors | 2 |
| 1.1 | Introduce the **ports and repositories**: `UserRepository`, `BotRepository`, `ModuleRepository`, `MapRepository`, `FileRepository` as interfaces + DI tokens in `application`, Mongo implementations in `infrastructure` | 8 |
| 1.2 | Replace global `services/db.ts` singletons with a Nest `DatabaseModule` that provides the Mongo client/db through a DI token | 5 |
| 1.3 | Remove `req`/`res` from services: refactor `usersService` (`addUser`, `activateUser`, `getUserByEmail`, `countUsersByState`) to return domain values / throw `AppError`; controllers handle HTTP | 5 |
| 1.4 | Move all direct `usersCollection`/`db.collection()` access out of controllers into repositories/services | 3 |
| 1.5 | Introduce a typed `AppError(statusCode, code, message)` base and a Nest global exception filter that maps it to responses (replace `ErrorHandler` + the `tryCatch` that swallows errors) | 3 |
| 1.6 | Delete dead code & leftovers: `clusters/nodes` aggregations, commented blocks, `console.log`, unrelated `Utils` image helpers | 3 |
| 1.7 | Decouple `lib` from `mongodb`: change `ID` to `string` (map at repository edge), remove `@types/mongodb` | 3 |
| 1.8 | Split `client/src/components/Game/Terminal/Terminal.tsx` into a command interpreter (pure) + hooks + UI | 3 |
| 1.10 | **NestJS foundation**: bootstrap the Nest app on the Express adapter and mount the legacy Express routers inside it; typed config module with env validation; logger provider; health endpoint; import-boundary check in CI (`dependency-cruiser` or ESLint rule) enforcing the layer rules | 5 |
| 1.11 | Migrate the **auth and users** features to Nest modules behind the identity ports (AGENTS.md §3.3): `IdentityVerifier` and `CredentialAuthService` with the custom adapter, domain `User` split from credentials (data migration of the `users` collection into `users` + `identities` + custom credentials), lazy `UserProvisioner`, `AUTH_PROVIDER` selection, JWT/role guards for HTTP and WebSocket, DTO validation, `FakeIdentityVerifier` and adapter contract tests; remove the matching legacy routers | 8 |
| 1.12 | Migrate **bots, map, modules, files** features and the **Socket.IO gateway** (`get-user-bases`, `get-user-bots`, `get-bot-modules`, socket auth) to Nest modules/gateways; remove the legacy Express routers and setup | 6 |
| 1.13 | Client `AuthClient` interface with a `localAuthClient` over the `/api/v1/auth/*` endpoints and auth hooks; auth forms and RTK Query slices use only the hooks | 3 |
| 1.14 | Client structure cleanup: remove the duplicated `src/store` / `src/hooks/store` folders and dead files, reorganise into feature folders (`auth`, `terminal`, `map`, …), API base URL from env instead of the hardcoded `localhost:8080` | 3 |
| 1.15 | Move the socket out of Redux state into a typed `SocketProvider`/service (event types shared from `lib`), drop the `serializableCheck` workaround | 3 |
| 1.16 | Move validation rules shared by api and client (name/password patterns) into `lib` as one source of truth; remove duplicated regexes | 2 |
| 1.17 | i18n foundation (after 1.18): `next-intl`, English source strings and an empty Russian catalogue, namespaces per feature, language detection + switcher, all existing UI strings (currently mixed languages) moved to English keys, CI check for missing keys | 3 |
| 1.18 | **Migrate the client from Vite to Next.js (App Router)**: start with a compatibility spike (React 19, Ant Design 5 with the Next registry, RTK/react-redux, CodeMirror, Socket.IO client, canvas); route groups `(marketing)` (empty placeholder) and `(game)`; game routes client-rendered only; replace React Router with App Router pages (login, verification, game, forbidden); `NEXT_PUBLIC_*` env, `@lib` alias via `transpilePackages`/paths, SCSS; providers (Redux, socket, auth) as client components; Jest via `next/jest`; Cypress; remove Vite | 8 |

**Exit criteria:** the backend runs on NestJS with no legacy Express routers; layering matches `AGENTS.md` and the
import-boundary check passes; use cases have no Express/`mongodb` imports; controllers no longer touch the DB; `lib` is
Mongo-free; the Phase 0 safety-net tests still pass; client build still green.
