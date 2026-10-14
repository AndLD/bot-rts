[← Phase 8 — Multiplayer, public API & production hardening](../phase-8-multiplayer-api-hardening.md)

# Phase 8 — Multiplayer, public API & production hardening — work log

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

### 2026-10-14 — task 8.1 horizontally scalable API tier
- **Tasks:** 8.1
- **Branch:** `feature/8.1-scalable-api-tier` — done
- **Decisions / deviations from the plan:** the engine lives in a worker thread of the API process, so scaling the API needed the engine to be reachable from other processes. `APP_ROLE` (`all` | `api` | `engine`) and `REDIS_URL` select the layout (`docs/operations/DEPLOYMENT.md`). An `api` node's `ENGINE_PORT` is `RedisEnginePort`, the `engine` node answers through `RedisEngineBridge`; both use the existing `EngineRequest` protocol over Redis pub/sub, V8-serialized so dates survive. The engine's events are not carried over that link: the engine node emits them into the player's Socket.IO room and the Redis adapter delivers them to the node holding the socket. Sticky sessions are avoided rather than configured: the client uses the WebSocket transport only (documented for polling clients). There is no lease that stops a second `engine` node (documented as "exactly one"). The in-memory auth rate limit is still per node: 8.2 moves it to Redis.
- **Problems / blockers / findings:** the engine worker builds its own Nest context, so `RedisModule` had to be imported there and its config pinned to role `all` without a Redis URL. Redis is a new service of `docker-compose.yml` (`npm run db:up` starts it) and of the CI `verify` job.
- **Next step:** 8.2, rate limiting, request timeouts, input size limits and the helmet / CORS review.
- **Verify with:** `npm run db:up`; `npx jest src/redis src/config -w api` from `api`

### 2026-10-14 — task 8.2 request hardening
- **Tasks:** 8.2
- **Branch:** `feature/8.2-request-hardening` — done
- **Decisions / deviations from the plan:** `@nestjs/throttler` is replaced by an own `ratelimit` module (a `RateLimiter` use case over a `RateLimitStore` port; memory and Redis adapters; a global guard that runs before authentication), because 8.9 needs per-API-key limits and the Redis store must be shared across nodes. Auth routes keep `RATE_LIMIT_AUTH_MAX`; every other route now has a floor of 600 requests per minute per address (`RATE_LIMIT_API_*`; the e2e stack raises it). Redis failure falls back to the node's own count instead of failing open. New codes `PAYLOAD_TOO_LARGE` (413, body limit 256 KiB) and `REQUEST_TIMEOUT` (503, handler timeout 30 s); Node's request / headers / keep-alive timeouts are set from config. Helmet is 8.x with an explicit CSP (no `upgrade-insecure-requests` outside production), `Cross-Origin-Resource-Policy: same-site`, and HSTS in production only; CORS is narrowed to the used methods and headers and a `*` origin is refused by the config.
- **Problems / blockers / findings:** a Redis connection a test forgets to close keeps Jest alive for ever (no "did not exit" timeout): every Redis test closes its connections.
- **Next step:** 8.3, observability (structured logs, request IDs, metrics, health checks).
- **Verify with:** `npx jest src/ratelimit src/rate-limit src/shared src/config` from `api`

### 2026-10-14 — task 8.3 observability
- **Tasks:** 8.3
- **Branch:** `feature/8.3-observability` — done
- **Decisions / deviations from the plan:** logging stays on log4js but through one layout (`log-format.ts`): JSON lines in production, text with the request id elsewhere, `LOG_FILE=false` for containers. Request ids live in an `AsyncLocalStorage` (`request-context.ts`) opened by the request-logger middleware, which also writes the access line when the response finishes (no query string: sockets pass tokens there) and feeds `HttpMetrics`. The metrics endpoint is Prometheus text at `/api/v1/metrics`, guarded by `METRICS_TOKEN` (404 when unset) and excluded from OpenAPI. The engine snapshot gained the scheduler numbers: `queuedExecutions`, `deferredExecutions` and `maxWaitTicks` (fairness: the longest run of unserved ticks of any execution, tracked in `EngineCore.trackWaiting`). Health is split: `/health/live` and `/health` (readiness; database, Redis and engine checks as `HealthCheck`s, each with a 2 s timeout; the old `{status, database}` body is a subset of the new one).
- **Problems / blockers / findings:** none.
- **Next step:** 8.4, data lifecycle (cleanup of inactive users and bots, terminal log retention).
- **Verify with:** `npx jest src/metrics src/health src/shared src/app.int src/redis` from `api`

### 2026-10-14 — task 8.4 data lifecycle
- **Tasks:** 8.4
- **Branch:** `feature/8.4-data-lifecycle` — done
- **Decisions / deviations from the plan:** a scheduled job (`lifecycle` module, a plain timer on the `all`/`engine` node; no partitioned tables) instead of the lazy cleanup on session open. Retention of terminal lines, ended executions, notifications and expired logins; unverified accounts without a base are deleted after 7 days; free `user`-role players inactive for 365 days get an email and are erased 30 days later, with the erasure shared with the player's own account deletion (`eraseAccount`). A player with an active execution is never inactive (offline scripts run on), and one who returns after the notice keeps the account. New column `users.inactivity_notice_at` (migration `data_lifecycle`, applied locally) and an index on `executions.ended_at`. The job's work is exported as `botrts_lifecycle_*` metrics through a `MetricCollectors` hook. The privacy policy retention text now says this and `PRIVACY_POLICY_VERSION` is `2026-10-14`. "Inactive bots" are not deleted: a base of an erased player stays for the corpse-base rules (8.13); the per-bot line cap stays enforced at write time.
- **Problems / blockers / findings:** none.
- **Next step:** 8.5, performance pass (map queries, batching, caching, index verification).
- **Verify with:** `npx jest src/lifecycle src/config` from `api`

### 2026-10-14 — task 8.5 performance pass
- **Tasks:** 8.5 (and a fix of the flaky terminal-follow Cypress spec, found in the PRs of 8.1-8.4)
- **Branch:** `feature/8.5-performance-pass` — done
- **Decisions / deviations from the plan:** the engine flush was already batched except for modules (a statement per module); modules, the scan's known-point snapshots and the energy / factory / repair saves now write in one statement (`ModuleRepository.updateMany`, `writeModules`, `writeKnownPoints`). The only missing index was for bases (`map_points (type, x, y)`, migration `map_points_type_index`); `query-plans.int.test.ts` now checks 21 hot queries can use an index, and every other one passed already. Caching: only authentication is cached (`PrincipalCache`, 2 s, off in tests and the e2e stack), which cuts about five queries per request to one per burst; map data is not cached beyond the engine's chunk cache. `useStickyScroll` now judges "was at the bottom" when the content changes, from the live scroll position (a scroll event arriving after a new line made the terminal stop following, which failed the `interface.cy.ts` spec in most first CI runs).
- **Problems / blockers / findings:** no benchmark numbers yet: 8.6 measures them under load.
- **Next step:** 8.6, load and soak testing, and tuning the scheduler budget.
- **Verify with:** `npx jest src/persistence src/modules src/map tests/integration/query-plans src/auth` from `api`

### 2026-10-14 — task 8.6 load and soak testing
- **Tasks:** 8.6
- **Branch:** `feature/8.6-load-soak` — done
- **Decisions / deviations from the plan:** `scripts/load-test.mjs` (`npm run load`) plays N players against a throwaway stack and scrapes the metrics of 8.3; results and tuning in `docs/operations/LOAD-TESTING.md`. Because "bots" per player are limited by the processor's parallel limit, the load is players with a script each (extra scripts queue). The scheduler budget default (0.8) is kept: the data shows it only matters at the knee (about 600 scripts on a laptop) and fairness held with 0.6. The fairness metric `maxWaitTicks` now counts only executions the tick cap kept from running (those queued behind another script of their bot are not waiting for the scheduler).
- **Problems / blockers / findings:** the soak run found a real leak: `ScriptLogRecorder` stored every script line with several statements through one growing promise chain, so the API heap grew about 1 MB/s at 1,400 lines/s. Fixed in this task: lines are collected per bot, capped, and stored every 250 ms in one batch (`TerminalSessionRepository.appendLogs`); the repeat soak is flat.
- **Next step:** 8.7, release management (semantic versioning, release / hotfix flow, CHANGELOG, deploy docs, Dockerfile and compose).
- **Verify with:** `npm run db:up && npm run load -- --players 50 --duration 30`; `npx jest src/terminal src/engine/application/engine-core` from `api`

### 2026-10-14 — task 8.7 release management and Docker
- **Tasks:** 8.7
- **Branch:** `feature/8.7-release-management` — done
- **Decisions / deviations from the plan:** one shared version for the root package, `lib`, `api` and `client`, all reset to `0.0.0` (the first release, 1.0.0, is cut from `release/1.0.0` when the owner decides). `scripts/release.mjs` (pure parts in `release-lib.mjs`, tested with `node --test`, run in CI as `npm run test:scripts`) takes the version from the branch name, sets it in every manifest and the lock file, and moves the changelog entries. `.github/workflows/release.yml` runs on a `vX.Y.Z` tag: it checks the tag against the version and the changelog, publishes `ghcr.io/<owner>/bot-rts-api:<version>` and creates the GitHub release. Nothing publishes until the owner pushes a tag. One image (`api/Dockerfile`) serves all roles; the `stack` compose profile adds `migrate`, `api` and `engine` next to the existing `db` and `redis`, so `npm run db:up` is unchanged. The image keeps the dev dependencies on purpose (the Prisma CLI applies the migrations). CI builds the image on every pull request (`docker` job). I built the image and ran the stack locally: `/api/v1/health` answered with the database, Redis and the engine up, the API node reaching the engine node through Redis.
- **Problems / blockers / findings:** the first image failed to start because `npm ci --ignore-scripts` skipped the native build of bcrypt, and a package that npm did not hoist (`api/node_modules/helmet`) was not copied; both fixed. A required-variable compose default would have broken `docker compose up db` for everyone, so a missing `JWT_ACCESS_SECRET` is refused by the application instead.
- **Next step:** 8.8 is the final coverage sweep and comes last in the phase; the order continues with 8.9 (API keys).
- **Verify with:** `npm run test:scripts`; `docker build -f api/Dockerfile -t botrts-api .`; `docker compose --profile stack config -q`

### 2026-10-14 — task 8.9 API keys
- **Tasks:** 8.9
- **Branch:** `feature/8.9-api-keys` — done
- **Decisions / deviations from the plan:** new `apikeys` module. `AuthService` resolves a `botrts_…` bearer token through an `ApiKeyAuthenticator` port (the composite of AGENTS.md §3.3), never from the principal cache, and the principal carries the key's grant. `ApiAccessGuard` (registered right after `AuthGuard`) holds a key to the scope its route names via `@RequireScope(scope | (request) => scope)`, refuses keys on `@SessionOnly()` routes and, **deny by default**, on routes naming neither; `api-keys.int.test.ts` walks every controller route and fails if one names nothing. Socket events are held the same way by a packet middleware (`SOCKET_EVENT_SCOPES` is an exhaustive `Record` over `ClientToServerEvents`, so a new event does not compile without a scope). Scopes: `read`, `base`, `files`, `scripts`, `terminal` and the eight manual-control categories; a manual action's scope is read from its function name. Per-key rate limit uses the 8.2 limiter (`key:<id>`, per minute, shared across nodes). Added HTTP endpoints for scripts (`GET /executions`, `POST /bots/:botId/executions`, `DELETE /executions/:id`) so clients, and the MCP server of 8.11, need not drive the terminal socket. The profile UI is a card in the account page (create with scopes / rate / expiry, secret shown once with copy, revoke). Deleting an account leaves its keys unusable (the user is gone for `assertCanUseApi`) rather than deleting them.
- **Problems / blockers / findings:** none. The `trade` and `communication` scopes exist because the categories do, though nothing needs them yet.
- **Next step:** 8.10, public API hardening (API keys on all routes and sockets are in; the stability / deprecation policy, OpenAPI with examples and the contract tests that a key client and the official client behave the same remain).
- **Verify with:** `npx jest src/apikeys src/auth` from `api`; `npm test -w client -- ApiKeysCard`

### 2026-10-14 — task 8.10 public API hardening
- **Tasks:** 8.10
- **Branch:** `feature/8.10-public-api-hardening` — done
- **Decisions / deviations from the plan:** key authentication on every route and socket was done with 8.9 (deny-by-default guard and the route-coverage test); this task adds the policy, the reference and the contract. `docs/integrations/API.md` holds the stability and deprecation policy (compatible changes in `/api/v1`, breaking ones as `/api/v2`, six months' notice, `Deprecation` / `Sunset` / `Link` headers set by `@ApiDeprecated` and `DeprecationInterceptor`; no route is deprecated yet). The OpenAPI document gets a request example, a response example and a curl sample for every operation, generated from the schemas by `addExamples` (so a DTO's own `@ApiProperty` example wins). `contract.int.test.ts` asks a session and an all-scopes key the same questions and requires identical answers: every parameter-free-or-known-id `read` route of the document, a set of identical mistakes, malformed tokens, and the read events of the socket (the server clock `now` is ignored).
- **Problems / blockers / findings:** none.
- **Next step:** 8.11, the MCP server (`mcp/` workspace package) on top of the API keys and the HTTP script endpoints.
- **Verify with:** `npx jest src/apikeys src/shared/presentation src/openapi` from `api`

### 2026-10-14 — task 8.11 MCP server
- **Tasks:** 8.11
- **Branch:** `feature/8.11-mcp-server` — done
- **Decisions / deviations from the plan:** new workspace package `mcp/` (`@bot-rts/mcp`, TypeScript, the official SDK with zod 3.25 shared with the SDK, its own Jest config and the 97 % gate; CI runs it and checks changed files). It talks to the game only through `ApiClient` (HTTP, `/api/v1`, a bearer key). Tools are plain data (`defineTool`: name, scope, zod input, a call on the client). Manual control is generated from `SCRIPT_FUNCTIONS` (one `bot_<function>` each, scope from `categoryOfFunction`, `read` for observation), minus the functions that have dedicated tools (craft / assemble / research / learn / repair / disassemble) or files tools (read / write) or make no sense by hand (sleep). A refusal of the game is a tool result with `isError` and the code (a missing scope gets a hint), not a protocol error. Transports: stdio, and stateless streamable HTTP (`POST /mcp`, `GET /health`) where each client brings its key in `Authorization`. The API gained `GET /bots/{botId}/terminal-history` (scope `read`), because the terminal history was socket-only. Tests: unit tests with a fake API, the SDK client over in-memory and HTTP transports, and `api/src/mcp.int.test.ts`, which runs the server against the real API on a seeded database. A stdio/HTTP smoke of the built server was run by hand.
- **Problems / blockers / findings:** two copies of zod (the SDK's and a newer one for the package) made the types incompatible; the package pins the shared 3.25.76. The generated schemas are too deep for the compiler to infer the SDK's callback type, so the registration is typed by what the server needs.
- **Next step:** 8.12 (frontend on Vercel, API on a long-running host), then 8.13 (e2e) and 8.8 (the final coverage sweep).
- **Verify with:** `npm test -w mcp`; `npx jest src/mcp.int src/apikeys` from `api`; `npm run build -w mcp`

### 2026-10-14 — task 8.12 frontend on Vercel
- **Tasks:** 8.12
- **Branch:** `feature/8.12-vercel-deployment` — done
- **Decisions / deviations from the plan:** the client already talked to the API host directly (`NEXT_PUBLIC_API_URL`, Socket.IO to the API); what was missing is the configuration around it. The refresh cookie's `SameSite` and `Domain` are now settings (`COOKIE_SAME_SITE`, `COOKIE_DOMAIN`; `none` stays the production default, which is what preview deployments on another site need; `lax` is advised on one registrable domain). CORS and Socket.IO now share one origin list with a safe wildcard for previews (`https://bot-rts-*.vercel.app`; the config refuses a bare `https://*.vercel.app` and a wildcard anywhere but in the first host label); before, the socket accepted only `ADMIN_URL`. The CSRF risk of a `SameSite=None` cookie needs no extra guard: CORS answers a request with a foreign `Origin` with 403 before the handler runs, including simple POSTs. `vercel.json` at the root, security headers for the client's pages (`client/src/shared/security-headers.ts`; a CSP is left for later and said so), and the deployment guide with a checklist in `docs/operations/DEPLOYMENT.md`. Not done here: creating the Vercel project and the DNS records, which belong to the owner; so nothing was deployed.
- **Problems / blockers / findings:** none.
- **Next step:** 8.13, the Cypress specs of the phase (API keys, two players, the read-only key, the MCP smoke test), then 8.8, the final coverage and quality sweep, and the end-of-phase database step.
- **Verify with:** `npx jest src/config src/shared/presentation src/auth` from `api`; `npm test -w client -- security-headers`

### 2026-10-14 — task 8.13 end-to-end specs
- **Tasks:** 8.13
- **Branch:** `feature/8.13-e2e` — done
- **Decisions / deviations from the plan:** three specs. `api-keys.cy.ts`: the account page (create with a scope, the secret shown once and gone after a reload, use within scopes, `SESSION_ONLY` on key management, revoke → 401), a key with the `base` scope that deploys a base, and a read-only key that looks (modules, storage, scan) but is refused every action, script, craft and repair. `mcp.cy.ts`: the built MCP server (`scripts/mcp-smoke.mjs`, started by a Cypress task) lists the bots, scans and moves a real bot with a `read + movement` key, and is refused `write_file`; the bot is checked to have moved one cell in the database. `multiplayer.cy.ts`: two players who start next to each other with the same spawn seed and act through the API only: a contested cell (one `ok`, one `BLOCKED`), private fog of war (unknown until the scout looks, then seen as someone else's base), an attack the defender is told of (API and Notifications window), and a base that becomes a corpse base (marked when its owner deploys again) with its stale bot adopted by the other player. New helpers `createApiKey`, `runScript`, `historyHas`; `scripts/e2e.mjs` builds `mcp/` first.
- **Problems / blockers / findings:** (1) a bot out of radio reach of its own base cannot have files written (`NO_SIGNAL`) and its events are not notified, so the two players must act inside the reach of both bases, hence the shared spawn seed. (2) The engine keeps module properties in memory: a test that sets them in the database must make the engine read the base again with a scan, or the old values apply (a flaky miss). (3) The corpse marker on the real map is written by `syncMapState`, which runs on deploy and repair, not on listing. All of the three specs were run locally (`E2E_API_PORT=18080 E2E_CLIENT_PORT=15173 node scripts/e2e.mjs -- --spec …`).
- **Next step:** 8.8, the final coverage and quality sweep, then the end-of-phase database step of AGENTS.md §7.6 and the summary.
- **Verify with:** `npm run e2e -- -- --spec 'cypress/e2e/{api-keys,mcp,multiplayer}.cy.ts'`

### 2026-10-14 — task 8.8 quality sweep; phase 8 closed
- **Tasks:** 8.8
- **Branch:** `feature/8.8-quality-sweep` — done
- **Decisions / deviations from the plan:** coverage was already far above the gate in all three packages (see `testing-strategy.md`), so the sweep went into what made the gate hard to pass: flaky tests. The causes were real-time bounds and slow Ant Design tests under a parallel run with coverage, a scroll-event race in `useStickyScroll` (fixed with 8.4), and a Cypress notification race; each is loosened or fixed at its cause and recorded in the testing strategy. Docs brought up to date: README ("What works today"), CHANGELOG (Unreleased), the plan (phase 8 ✅).
- **Problems / blockers / findings:** the line `Aborted(Assertion failed: list_empty(&rt->gc_obj_list)…` in the output is the sandbox attack tests, by design. A jest worker was killed with SIGABRT once in `scale-out.int.test.ts` in CI and could not be reproduced (the same file passed dozens of times); if it comes back, run it alone with `--detectOpenHandles` and look at the engine thread's shutdown.
- **Exit criteria of the phase:** the game runs under realistic multi-player load (8.6, with the leak the soak run found fixed), has a horizontally scalable API tier (8.1), is observable (8.3) and is released via full Git Flow (8.7; no release has been cut: that is the owner's decision).
- **Next step:** none in this phase; the end-of-phase database step (`npm run db:up`, `npm run db:migrate -w api`) is run from the updated `develop` after the merge. Phases 9 and 10 are next in the plan.
- **Verify with:** `npm run lint && npm run typecheck && npm run docs:check && npm run test:coverage`
- **Local database (AGENTS.md §7.6):** run from the updated `develop` after the last merge: `npm run db:up` started PostgreSQL and Redis, and `npm run db:migrate -w api` reported "No pending migrations to apply" (the three migrations of this phase, `data_lifecycle`, `map_points_type_index` and `api_keys`, were applied while the tasks were developed). `npm run db:seed` was not needed: the phase changed no seed data.

