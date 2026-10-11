[← Phase 1 — Architecture refactor, clean architecture & NestJS migration](../phase-1-architecture-refactor.md)

# Phase 1 — Architecture refactor, clean architecture & NestJS migration — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-11 — task 1.0: TypeScript 5 / Node 20 baseline, blocking changed-files coverage
- **Tasks:** 1.0
- **Branch:** `feature/1.0-typescript-node-baseline` — done
- **Decisions / deviations from the plan:** the upgrade itself happened in Phase 0 (task 0.3): `api`, `client` and `lib` all resolve TypeScript 5.9.3 from one root install. This task adds `.nvmrc` (20, also used by CI through `node-version-file`) and makes the changed-files coverage check (≥ 97 % on files touched by a PR) blocking, as planned for Phase 1.
- **Problems / blockers / findings:** none.
- **Next step:** task 1.7 (`ID` becomes `string`), then 1.1.
- **Verify with:** `npm ls typescript && npm run typecheck`

### 2026-10-11 — tasks 1.1 and 1.1a: ports, domain entities and PostgreSQL/Prisma adapters
- **Tasks:** 1.1, 1.1a
- **Branch:** `feature/1.1-ports-and-prisma-adapters` — done (the legacy Express code still runs on MongoDB; it is switched over in the next branch, tasks 1.7/1.2/1.3/1.4)
- **Decisions / deviations from the plan:**
  - New code lives in `api/src/<feature>/{domain,application,infrastructure}` (features: `users`, `bots`, `modules`, `files`, `map`, `persistence`, `shared`); file names follow `<name>.<role>.ts`. Ports have `Symbol` DI tokens next to the interface.
  - Prisma 6 (`prisma` + `@prisma/client` ^6; Prisma 7 changes the config model). Schema in `api/prisma/schema.prisma`, one `init` migration with a hand-added `bots_ownership_check` CHECK constraint (base ⇒ `user_id`, no `base_id`; any other bot ⇒ `base_id`, no `user_id`; design §8.1). `BOT_TYPE` gained `WORKER` (an ordinary bot) so the ownership model is expressible.
  - Modules keep common columns plus a `props` JSONB for type-specific fields. Map: `map_points` (real layer, unique `x,y,z`) and `known_points` (per player, `seen_at` tick as `bigint`). `z` is stored as 0 when absent.
  - `WorldStateStore.flush` writes map and known points through `INSERT … ON CONFLICT` from one JSON document (typed arrays with NULLs were not inferred by the driver) and upserts modules, all in one transaction.
  - Test harness: Jest projects `unit` and `integration` (`*.int.test.ts`). Global setup creates `botrts_template` by running `prisma migrate deploy` on an empty database (this is the "migrations apply cleanly" check); every test file clones its own database from the template and drops it afterwards. `npm test` therefore needs `npm run db:up`; `npx jest --selectProjects unit` does not.
  - CI generates the client and runs `prisma migrate diff` against a shadow database to catch schema/migration drift.
  - `prisma/seed.ts` creates the root user (`owner`) from `ROOT_USER_EMAIL`/`ROOT_USER_PASSWORD`.
- **Problems / blockers / findings:** none open.
- **Next step:** branch `feature/1.7-switch-to-postgres`: `ID` becomes `string` (1.7), a composition root builds a `PrismaClient` (1.2), legacy services/controllers move onto use cases and repositories (1.3, 1.4), `mongodb` is removed.
- **Verify with:** `npm run db:up && npm test`

### 2026-10-11 — tasks 1.2–1.7 and 1.9: the Express layer runs on use cases and PostgreSQL
- **Tasks:** 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.9 (the execution order of the phase file put 1.7/1.2/1.3/1.4 before 1.9; they were done in one branch because the old and the new data types cannot coexist in a compiling tree)
- **Branch:** `feature/1.7-switch-to-postgres` — done
- **Decisions / deviations from the plan:**
  - Use cases are framework-free classes in `api/src/<feature>/application`: `UsersService`, `BotsService`, `ScanService`, `MapService` (+ `VerificationMailer`). They depend only on ports; ids, time and randomness come from the `IdGenerator`, `Clock` and `Rng` ports (`SeededRng`, seeded by `WORLD_SEED`). `api/src/composition.ts` is the composition root of the Express app (replaced by Nest modules in 1.10). World numbers (`WORLD_RESOURCE_CHANCE`, spawn distance/attempts) are configuration.
  - Errors: `AppError(statusCode, code, message)` with typed subclasses and the shared `ErrorCode` set in `lib`; `middlewares/error-handler.ts` is the single Express error handler (body `{ statusCode, code, error }`, `error` keeps the field the client already reads); `asyncHandler` replaces `tryCatch`. Unknown errors answer a generic 500 and are logged.
  - Behaviour changes made on purpose: ids are UUID strings (`ID = string`, ObjectIds are gone); the new base spawn skips occupied cells (the old upsert overwrote whatever was there); `GET /api/private/statistics` returns only `usersByStatus` and `startTimestamp` (document counts and the leftover `public` directory size are dropped; Phase 9 redesigns it); `DELETE /api/private/debug/collections` is removed together with MongoDB (use `npm run db:reset`); the scan refreshes the player's known cells with a `seenAt` stamp — the wall-clock time in ms until the engine's tick exists (Phase 5). The old `Module`/`ScannerModule`/`WeaponModule` classes and the Jimp image helpers were deleted; the polymorphic module classes return in Phase 4.
  - `mongodb`, `jimp`, `axios` dependencies removed. `api` `prod` script and `main` point at `ts-built/api/index` (the real build layout). The Socket.IO ack error is `{ code, msg }`; the client terminal was adapted. Debug `console.log` calls (one printed the JWT) were removed from the client.
  - Safety-net tests (1.9): `setup/app.int.test.ts` starts the whole server on a cloned test database and drives it over HTTP (supertest) and Socket.IO (`socket.io-client`): signup → verify → login → refresh → logout, role and ban checks, forged roles, expired tokens, deploy base, scan, the three socket events and the handshake rejections; `setup/start.int.test.ts` covers `startApp`/`stopApp`. All 237 tests pass; every file changed by the branch is above the 97 % bar.
- **Problems / blockers / findings:**
  - I overwrote and then deleted the developer's git-ignored `api/.env.development` while smoke-testing (its secrets and SMTP credentials are lost); it was recreated from `api/.env.example`, and the owner must re-enter their values.
  - Prisma 6 warns that the `package.json#prisma` key is deprecated in favour of `prisma.config.ts` (Prisma 7); migrate when upgrading.
- **Next step:** task 1.10 (NestJS foundation: bootstrap Nest on the Express adapter, mount the legacy routers, exception filter, `/api/v1`, typed config, logger, `PrismaModule`, health endpoint, import-boundary check).
- **Verify with:** `npm run db:up && npm run lint && npm run typecheck && npm test && npm run build`

### 2026-10-11 — task 1.8: terminal split into interpreter, hook and UI
- **Tasks:** 1.8
- **Branch:** `feature/1.8-split-terminal` — done
- **Decisions / deviations from the plan:** `client/src/components/Game/Terminal/` now holds `interpreter.ts` (pure: `interpret(input, session)` returns a `TerminalAction`, plus prefix and output formatting), `useTerminal.ts` (state and the effects of the actions: socket calls, logout) and `Terminal.tsx` (UI only). The old effect-driven "waiting for reply" state machine is gone. Output is HTML-escaped by the interpreter (`joinLines`), which closes an XSS hole through bot labels and typed input. The legacy lint override for `Terminal.tsx` was removed.
- **Problems / blockers / findings:** the client has no test runner until task 2.1, so the interpreter's unit tests are scheduled in task 2.6 (the interpreter was checked by hand through a one-off bundle). Behaviour kept as it was, including the not-yet-implemented `ls` inside a drive and shell-mode code execution.
- **Next step:** task 1.10 (NestJS foundation).
- **Verify with:** `npm run lint && npm run typecheck && npm run build -w client`

### 2026-10-11 — task 1.10: NestJS foundation
- **Tasks:** 1.10
- **Branch:** `feature/1.10-nestjs-foundation` — done
- **Decisions / deviations from the plan:**
  - Nest 11 on the Express adapter; `api` moved to Express 5 (one Express version in the tree), TypeScript target ES2021 with decorator metadata. `index.ts` → `src/bootstrap.ts` → `createApp(config)` (`src/app.factory.ts`, shared by the server and the tests): Helmet, CORS from an explicit origin list (the old check let every origin through when `WHITELIST_URLS` was unset; the default is now `FRONTEND_URL`, and a foreign origin gets 403), cookie parser, the legacy routers, global prefix `api` + URI versioning (default `v1`), the global `AppExceptionFilter`, Swagger/OpenAPI at `/api/docs` (JSON at `/api/docs-json`), then the Socket.IO server is attached to the HTTP server.
  - The legacy Express routers are mounted inside Nest (`src/legacy/`): `LegacyModule` hands the Nest-provided use cases to them as `AppServices`; the temporary `src/composition.ts` is gone. Nest modules (`*.module.ts`) are the composition root; the use-case classes stay decorator-free and are built by `useFactory` providers, so the application layer has no Nest import. `PersistenceModule` owns the single `PrismaClient` (config-driven, disconnected on shutdown), `UNIT_OF_WORK` and `WORLD_STATE_STORE`.
  - Typed config (`src/config/app-config.ts`): `loadConfig(env)` validates and reports every problem at once (`DATABASE_URL`, `PORT`, `NODE_ENV`; the three JWT secrets are mandatory in production, because the legacy JWT module still falls back to dev secrets). The logger is a port (`LOGGER`) backed by log4js. `GET /api/v1/health` (use case + `HealthProbe` port + Prisma adapter) answers 503 when the database is down.
  - One error mapping, `toErrorResponse`, serves both the Nest filter and the legacy Express handler (`{ statusCode, code, error }`).
  - Import-boundary check: `dependency-cruiser` (`api/.dependency-cruiser.cjs`, `npm run check:boundaries`, a CI step) enforces AGENTS.md §3.1–3.2 for `api/src`: no cross-layer imports against the dependency direction, no npm packages in `domain` or `application`, Prisma only in `infrastructure` and the modules, `lib` independent. It was verified to fail on deliberate violations.
- **Problems / blockers / findings:** with Express 5 `?email[$ne]=x` is no longer parsed into an object (the key is ignored), so the users-list test changed from "rejects" to "ignores"; a repeated key is still rejected.
- **Next step:** tasks 1.11 / 1.11a (identity ports, custom adapter, sessions, account management, users/identities data model).
- **Verify with:** `npm run db:up && npm run lint && npm run check:boundaries && npm run typecheck && npm test && npm run build`

### 2026-10-11 — tasks 1.11, 1.11a, 1.16: identity ports, custom adapter, sessions, account management
- **Tasks:** 1.11, 1.11a, 1.16
- **Branch:** `feature/1.11-identity-and-sessions` — done
- **Decisions / deviations from the plan:**
  - **Data model (1.11a):** `users` no longer holds credentials. New tables (migration `identities_sessions_tokens`, which copies the existing credentials into the new tables before dropping `users.password_hash` / `users.is_active`; the copy was verified on a database that held a user): `identities` (provider, subject → user), `local_credentials` (password hash, `email_verified`; the custom adapter's own table), `sessions` (refresh token stored as a SHA-256 hash, rotates on every refresh, `revoked_at`) and `auth_tokens` (single-use links: email verification, password reset, email change, account deletion; hash only). The domain `User` has `deletedAt` and no password or `isActive`; "active" in the API (`IUserState.active`) now means the email is verified and comes from the identity.
  - **Ports and adapters (1.11, AGENTS.md §3.3):** `IdentityVerifier` (token → `Identity`), `CredentialAuthService` (register, login, refresh, logout, verify/resend email, forgot/reset password, change password, change email, delete account), `AuthService.authenticate` (identity → player via `UserProvisioner`, then the access policy: unknown/deleted → 401, banned → 403, unverified email → 403). The custom provider is application logic over ports (`LocalAuthService`, `LocalIdentityVerifier`; Prisma repositories, a JWT access-token service, a crypto secret generator and an email mailer are the adapters). `AUTH_PROVIDER=local` selects the adapter in `AuthModule`; the repositories of the auth feature are part of the `UnitOfWork`. A `FakeIdentityVerifier` and a shared contract suite (`tests/contracts/identity-verifier.contract.ts`) that every verifier must pass are included.
  - **Tokens and sessions:** access tokens are HS256 JWTs with only `sub` (user) and `sid` (session) for 10 minutes; roles, bans and the verified flag are read from the database on every request, and a revoked session ends access immediately (logout, password reset, password change on other devices, ban at the next request). The refresh token is an opaque random value in an HTTP-only cookie limited to `/api/v1/auth` (`SameSite=None; Secure` in production). The stateless JWT email-verification and refresh secrets are gone (`JWT_REFRESH_SECRET`, `JWT_EMAIL_VERIFICATION_*` removed). Session lifetime is `JWT_REFRESH_EXPIRES_IN` (default 30 d, sliding).
  - **API (`/api/v1`):** `POST auth/register|login|refresh|logout`, `auth/email/verify|resend`, `auth/password/forgot|reset|change`, `auth/email/change`, `auth/email/change/confirm`, `auth/account/delete`, `auth/account/delete/confirm`; `GET users/me`, admin `GET users`, `PUT users/:id`, `GET admin/statistics`. Verification and confirmation links are POSTs with the token in the body. Login of an unverified user is now rejected (403 `EMAIL_NOT_VERIFIED`), as 0.8 planned; registration still returns tokens, which the client uses to show the "check your email" page. Password-reset, resend and similar requests never reveal whether an address is registered, and a login for an unknown email costs the same time as a wrong password.
  - **Default deny and validation:** a global `AuthGuard` (every route needs a signed-in player unless `@Public()`), a `RolesGuard` (`@RequireRole('admin' | 'owner')`), `@nestjs/throttler` on the sensitive auth routes (`RATE_LIMIT_*`, `TRUST_PROXY`), DTOs validated with `class-validator` through a global `ValidationPipe` (whitelist + forbid unknown fields, errors answer `VALIDATION_FAILED`). The old express-rate-limit, JWT utilities and `simple-express-validation` schemas were deleted.
  - **Account deletion** erases personal data (name "Deleted player", tombstone email, credentials, identities, sessions and tokens are deleted) and keeps the row and the player's base, so Phase 3 can turn it into a corpse base (design §5.1, §6.3).
  - **Legacy:** `routers/public/*`, the legacy users/auth/statistics routers and the debug of earlier tasks are gone; what remains of Express is `/api/private/bots/*` and the Socket.IO server, both authenticating through `AuthService` (the handshake maps the new `TOKEN_EXPIRED` error to the `Token expired` message the client understands). `GET /api/v1/admin/statistics` replaces the old statistics route.
  - **Shared validation (1.16):** `lib/utils/validation.ts` holds the email, name and password patterns; the API DTOs and the client forms import them (the duplicated regexes are deleted).
  - **Client:** the API layer talks to the new endpoints; because the access token no longer carries the player, a `useCurrentUser` hook asks `GET /api/v1/users/me` (the token is the cache key) and routes by the answer (active / unverified / blocked / anonymous), with a new "blocked" page. Checked in a real browser against the running API: sign-up → "check your email" → (email marked verified in the database) → game terminal with `list` and `modules` over Socket.IO → `exit` logs out.
- **Problems / blockers / findings:**
  - Refresh-token reuse (an old token presented after rotation) is rejected but not treated as theft; reuse detection with token families can be added when the sessions UI arrives.
  - The root `seed` script now creates the owner through the same repositories (verified email, `owner` status).
  - Nothing emails in development without SMTP settings; verify a local account by setting `local_credentials.email_verified` or configure SMTP.
- **Next step:** task 1.12 (bots, map, modules, files and the Socket.IO gateway as Nest modules under `/api/v1`; delete the remaining Express routers and `api/setup`).
- **Verify with:** `npm run db:up && npm run lint && npm run check:boundaries && npm run typecheck && npm test && npm run build`

### 2026-10-11 — task 1.12: bots, the Socket.IO gateway and the end of the Express layer
- **Tasks:** 1.12
- **Branch:** `feature/1.12-bots-gateway-nest` — done
- **Decisions / deviations from the plan:**
  - `BotsController` (`/api/v1/bots`): `POST base` (201; deploy the first base), `GET` (own bots, optional `type`), `GET :id/modules`, `POST :id/scan`. Ids are validated as UUIDs, DTOs with `class-validator`. The `map`, `modules` and `files` features are Nest modules (`MapModule`, `ModulesModule`, `FilesModule`) that provide their repositories and use cases; they have no routes of their own yet because the game does not read maps or files over HTTP (the scan returns the cells; modules are read per bot).
  - `BotsGateway` is a Nest `@WebSocketGateway` (`@nestjs/websockets` + `@nestjs/platform-socket.io`) that authenticates the handshake with the same `AuthService` and policy as the HTTP guard (`socket-auth.middleware.ts`) and keeps the acknowledgement protocol of the client terminal — `(result)` on success, `(null, { code, msg })` on failure — through a shared `guarded` wrapper, because Nest's `@SubscribeMessage` cannot send a two-argument acknowledgement. The CORS origin comes from the configuration through `ConfiguredIoAdapter`.
  - The whole legacy layer is deleted: `routers/`, `controllers/`, `middlewares/`, `setup/`, `utils/`, `src/legacy/`, plus the `cors`, `simple-express-validation`, `moment` and `express-rate-limit` dependencies and the legacy ESLint override block. Logging is configured in `src/shared/infrastructure/log4js-logger.ts` (no `moment`), request logging is a small middleware over the `Logger` port, `.env` loading is `src/load-env.ts`.
  - The throttler guard is now applied to `AuthController` only (it had been registered globally, which would have limited every route to the auth budget); logout is excluded. The general API rate limit comes with task 8.2.
  - Tests: the old HTTP/socket tests were ported to the gateway (`bots.gateway.test.ts`), the handshake middleware and the safety-net suite, which now drives `/api/v1/bots/*` and the sockets; the controller is covered by the integration suite.
- **Problems / blockers / findings:** none open. The client needed no change: its REST calls were already on `/api/v1` and the socket protocol is unchanged.
- **Next step:** tasks 1.14, 1.15, then 1.18 / 1.18a (Next.js), 1.17 (i18n) and 1.13 (client `AuthClient`), in the order of the phase file.
- **Verify with:** `npm run db:up && npm run lint && npm run check:boundaries && npm run typecheck && npm test && npm run build`
