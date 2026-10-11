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

### 2026-10-11 — tasks 1.14 and 1.15: client structure and a typed socket service
- **Tasks:** 1.14, 1.15
- **Branch:** `feature/1.14-client-structure` — done
- **Decisions / deviations from the plan:**
  - New layout under `client/src`: `app/` (routes per visitor state, `AppRoutes`, global styles), `features/auth` (API slice, hooks, forms and pages), `features/terminal` (interpreter, hook, UI, styles), `features/game`, and `shared/` (`config`, `jwt`, `validation`, `notifications`, `errors`, `store/` with the session slice, the base query with refresh and typed hooks, `socket/`). The duplicated `src/store` and `src/hooks/store`, the empty route/hook files and the unused `FileEditor`/`CodeEditor` components, the unused users API slice and the dead notification helpers were deleted (the editor returns with the script runtime in Phase 6; CodeMirror, `prettier`, `json-beautify` and `axios` were dropped from the client dependencies and will be re-added when needed). The legacy ESLint override block of the client is gone.
  - 1.15: the socket lives in a `SocketProvider` (context) instead of Redux, so the `serializableCheck: false` workaround is removed. Event types are shared from `lib/utils/socket-events.ts` (`ClientToServerEvents`, `SocketAck`, `SocketError`) and the socket is `Socket<ServerToClientEvents, ClientToServerEvents>`; the terminal's `emit` calls are now type-checked. The connection is opened only on the game page, and a handshake rejected for an expired token refreshes the session and reconnects, with the connection reading the latest token through `auth: (cb) => cb({ token })`.
  - Refresh is single-flight (`shared/store/refresh.ts`): the refresh token rotates, so two simultaneous refreshes from the base query and the socket must share one request. Checked in a real browser with a 5-second access-token lifetime: after the token expired, a page load refreshed the session, reconnected the socket and the terminal worked.
  - The API base URL comes from `VITE_API_URL` (documented default `http://localhost:8080` for local development); there is no hardcoded URL in the code.
- **Problems / blockers / findings:** the server does not serialize two refreshes that arrive at the same instant with the same cookie (both can succeed); this is harmless for the client now that refresh is single-flight, and refresh-token reuse detection is a candidate for the sessions work in Phase 8.
- **Next step:** tasks 1.18 and 1.18a (Next.js migration), then 1.17 (i18n) and 1.13 (`AuthClient`).
- **Verify with:** `npm run lint && npm run typecheck && npm run build -w client`

### 2026-10-11 — tasks 1.18 and 1.18a: Next.js migration (spike, skeleton and pages)
- **Tasks:** 1.18, 1.18a
- **Branch:** `feature/1.18-nextjs-migration` — done
- **Compatibility spike (1.18):** Next.js 16.4 (Turbopack), React 19.3, Ant Design 5.29 with `@ant-design/nextjs-registry` and `@ant-design/v5-patch-for-react-19`, Redux Toolkit 2 / react-redux 9, `socket.io-client`, a `<canvas>` and CodeMirror 6 (`@uiw/react-codemirror`) were put on one throwaway client page: `next build` prerendered it and, in a browser, the antd button, the canvas and the highlighted editor rendered. The page and the CodeMirror packages were removed afterwards (the editor comes with Phase 6). Findings: (1) npm hoisted a second React 18 for Ant Design's dependencies, which would break hooks, so the root `package.json` pins `react` and `react-dom` with `overrides`; (2) `@next/eslint-plugin-next` 16 only supports ESLint 9 flat config, so the client keeps its ESLint 8 setup without the Next plugin (moving the repository to ESLint 9 is a candidate chore); (3) `next dev` writes an `AGENTS.md` into the app directory, which is disabled with `agentRules: false` because the repository's `AGENTS.md` is the single source of rules; (4) the `@lib` alias needs `experimental.externalDir` for sources outside `client/`; (5) the root now has a `postinstall` that generates the Prisma client.
- **Decisions (1.18a):** Vite, React Router and their config were removed. `src/app` is the App Router: a root layout (Ant Design registry, global SCSS, fonts moved to `public/fonts`), the `(marketing)` group with a statically rendered placeholder landing page at `/`, and the `(game)` group (`/auth`, `/verification`, `/forbidden`, `/blocked`, `/game`) whose layout renders nothing on the server: `Providers` mounts the Redux store only in the browser and a `RouteGuard` sends the visitor to the page that fits who they are (`app/access.ts`, a pure function: anonymous → `/auth`, unverified → `/forbidden`, blocked → `/blocked`, active → `/game`). Client components carry `'use client'`; the verification page sits in a `Suspense` boundary because it reads the query string. The API URL comes from `NEXT_PUBLIC_API_URL`; the dev and start scripts keep port 5173 so the API's default CORS origin still matches. `ecosystem.config.json` starts the client with `npm run start`. The README scripts table was brought up to date.
- **Verified:** `next build` prerenders `/`, `/auth`, `/blocked`, `/forbidden`, `/game`, `/verification`; in a browser the guard sends an anonymous visitor from any page to `/auth`, login leads to `/game`, the terminal reads bots and modules over Socket.IO and `exit` returns to `/auth`.
- **Problems / blockers / findings:** the developer's ignored `client/.env` still defines `VITE_API_URL`; it is unused now (rename it to `NEXT_PUBLIC_API_URL` if it differs from the default). Jest and Cypress for the client arrive with task 2.1.
- **Next step:** tasks 1.17 (i18n foundation) and 1.13 (client `AuthClient`).
- **Verify with:** `npm run lint && npm run typecheck && npm run build`

### 2026-10-11 — task 1.17: i18n foundation
- **Tasks:** 1.17
- **Branch:** `feature/1.17-i18n-foundation` — done
- **Decisions / deviations from the plan:**
  - `next-intl` 4 without locale routing: the catalogues are `client/messages/en.json` (the source of all texts, namespaces `common`, `marketing`, `auth`, `terminal`, `errors`) and `ru.json`, which is empty as planned; `I18nProvider` (root layout) picks the language in the browser — a saved choice (`localStorage`), then the browser's language, then English — and merges the chosen catalogue over English, so a missing translation shows the English text. A `LanguageSwitcher` sits on the login page and on the landing page. Pages therefore render in English first and switch right after mount; the SEO-oriented landing page of Phase 7 will need locale-prefixed routes (`/en`, `/ru`), which this setup deliberately does not decide.
  - Every user-visible string moved to English keys: the auth forms and their validation messages (the old mix of Ukrainian and English is gone), the "check your email" and "blocked" pages, the landing placeholder, the terminal's own messages (the interpreter now returns message keys, `unknownCommand` / `unknownPath`, instead of English text) and the notifications. API failures are shown by their stable error code (`errors.<CODE>`, one entry per `ErrorCode` of `lib`), falling back to the server's text and then to a generic message. Antd form rules are built by `useAuthRules()` with translated messages; the allowed password characters are an ICU argument filled from `lib`.
  - CI check `npm run i18n:check` (`scripts/check-i18n.mjs`): every literal `t('…')` key (relative to the file's one `useTranslations` namespace) must exist in `en.json`; other catalogues may not contain keys English lacks; every `ErrorCode` needs an `errors.<CODE>` message; every message must parse as ICU MessageFormat; unused keys and the translated share per language are reported. A first run in the browser found that a message containing `{}` (the password characters) is an invalid ICU message, which is why that last check exists.
- **Problems / blockers / findings:** the server's own messages stay English; they are only a fallback now. Pluralization and number/date formatting helpers will be added with the first texts that need them. The i18n test of the pure helpers (`detectLocale`, `withFallback`) is scheduled with the client tests (task 2.6).
- **Next step:** task 1.13 (client `AuthClient` over `/api/v1/auth/*` and the account-management forms), which closes Phase 1.
- **Verify with:** `npm run lint && npm run typecheck && npm run i18n:check && npm run build`

### 2026-10-11 — task 1.13: client `AuthClient` and account management
- **Tasks:** 1.13
- **Branch:** `feature/1.13-auth-client` — done (tests for the new client code are still to write, see below)
- **Decisions:** `features/auth/auth-client.ts` is the provider-agnostic interface (sign in/up/out, refresh, verify and resend email, password reset/change, email change, account deletion; results are `{ ok } | { ok: false, failure: { code, message } }`); `local-auth-client.ts` implements it over the RTK Query endpoints of `/api/v1/auth/*` and the session slice; `AuthClientProvider` + `useAuth()` hand it to components, which never touch RTK mutations or endpoints. New pages in the `(game)` group: forgot/reset password, `confirm-email-change`, `confirm-account-deletion`, `/account` (change password, change email, delete account) and a "send the letter again" form on the unverified page; `app/access.ts` knows them (link pages are open to everyone). Emailed-link pages send the token once even under React StrictMode. In development without SMTP the API now logs emails (`LoggingEmailSender`), so links are in the server log. Texts are in `en.json`.
- **Verified in a browser:** register → verification link → forgot password → reset link → new password accepted by the API, old one rejected.
- **Not done:** browser checks of the account page, email change and account deletion; unit tests for the client code (client Jest arrives in task 2.1, tests listed in 2.6) and the API's `createEmailSender` branches are covered by unit tests.
- **Next step:** Phase 1 exit criteria review, then mark the phase ✅ and start Phase 2 when asked.
- **Verify with:** `npm run lint && npm run typecheck && npm run i18n:check && npm run build && npm test`
