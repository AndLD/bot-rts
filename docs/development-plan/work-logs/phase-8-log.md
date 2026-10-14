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
- **Decisions / deviations from the plan:** the engine lives in a worker thread of the API process, so scaling the API needed the engine to be reachable from other processes. `APP_ROLE` (`all` | `api` | `engine`) and `REDIS_URL` select the layout (`docs/DEPLOYMENT.md`). An `api` node's `ENGINE_PORT` is `RedisEnginePort`, the `engine` node answers through `RedisEngineBridge`; both use the existing `EngineRequest` protocol over Redis pub/sub, V8-serialized so dates survive. The engine's events are not carried over that link: the engine node emits them into the player's Socket.IO room and the Redis adapter delivers them to the node holding the socket. Sticky sessions are avoided rather than configured: the client uses the WebSocket transport only (documented for polling clients). There is no lease that stops a second `engine` node (documented as "exactly one"). The in-memory auth rate limit is still per node: 8.2 moves it to Redis.
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

