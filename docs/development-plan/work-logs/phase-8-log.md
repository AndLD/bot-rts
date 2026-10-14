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

