[← README](../README.md)

# Deployment and scaling

## Processes

| Process                        | Role (`APP_ROLE`) | Count                       | Needs                  |
| ------------------------------ | ----------------- | --------------------------- | ---------------------- |
| API + engine thread (default)  | `all`             | 1                           | PostgreSQL             |
| API node                       | `api`             | any number                  | PostgreSQL, Redis      |
| Engine node                    | `engine`          | **exactly 1**               | PostgreSQL, Redis      |
| Client (Next.js)               | –                 | any number (e.g. Vercel)    | the public API URL     |

The game world has one authoritative owner, the engine (design §12.2.2, §14.2), so the engine node is never replicated:
two engine nodes would both write the world. The API tier is stateless and scales horizontally.

## How the nodes work together

- **Requests that change the world** (deploying a base, crafting, scripts, manual control) are sent by an `api` node to the
  engine node over Redis pub/sub (`botrts:engine:requests`; the answer comes back on a channel of the asking node). When no
  engine node is listening the API answers `503 SERVICE_UNAVAILABLE` at once; when it does not answer within
  `ENGINE_REQUEST_TIMEOUT_MS` the request fails the same way.
- **Events to players** (script logs, radio, map vision, notifications, achievements) are emitted by the engine node into the
  player's Socket.IO room `user:<id>`. The Socket.IO Redis adapter delivers them to the node the player is connected to.
- **Sockets are stateless:** the handshake token identifies the player on whichever node accepts the connection, and the room
  is joined there. The official client connects with the WebSocket transport only, so a load balancer needs no sticky
  sessions for it. Third-party clients that use HTTP long polling need sticky routing (by client IP or cookie) on `/socket.io`.
- **Reads** are answered by the API node from PostgreSQL.

## Configuration

| Variable                    | Where          | Meaning                                                              |
| --------------------------- | -------------- | -------------------------------------------------------------------- |
| `APP_ROLE`                  | every node     | `all`, `api` or `engine`                                             |
| `REDIS_URL`                 | `api`, `engine`| Required for those roles; with `all` it only enables the adapter     |
| `ENGINE_REQUEST_TIMEOUT_MS` | `api`          | How long to wait for the engine node (default 15000)                 |
| `TRUST_PROXY`               | every node     | `true` behind the load balancer                                      |

Locally `npm run db:up` starts PostgreSQL and Redis (`docker-compose.yml`).

## Reverse proxy

Terminate TLS at the proxy, forward `X-Forwarded-*`, set `TRUST_PROXY=true`, and allow WebSocket upgrades on `/socket.io`.

## Request limits and security headers (Phase 8.2)

- **Rate limits** are counted per client address, in Redis when `REDIS_URL` is set (all nodes share the count) and in memory
  otherwise. Auth routes use `RATE_LIMIT_AUTH_MAX` per `RATE_LIMIT_WINDOW_MS`; every other route, `RATE_LIMIT_API_MAX` per
  `RATE_LIMIT_API_WINDOW_MS`; the health check is never limited. A refused request gets `429 TOO_MANY_REQUESTS` with
  `Retry-After`; answered ones carry `X-RateLimit-Limit` and `X-RateLimit-Remaining`. If Redis fails the node counts on its own.
- **Body size:** JSON bodies above `HTTP_BODY_LIMIT_BYTES` get `413 PAYLOAD_TOO_LARGE`.
- **Timeouts:** a handler that has not answered within `HTTP_HANDLER_TIMEOUT_MS` gets `503 REQUEST_TIMEOUT`; Node's own
  `requestTimeout`, `headersTimeout` and `keepAliveTimeout` (set above the usual 60 s idle timeout of load balancers) end slow clients.
- **CORS:** only origins in `WHITELIST_URLS` (`*` is refused), methods GET / POST / PUT / PATCH / DELETE, headers
  `Authorization` and `Content-Type`, preflight cached for 10 minutes.
- **Headers (helmet 8):** CSP, `X-Content-Type-Options`, `Cross-Origin-Resource-Policy: same-site`, and HSTS in production.

## Observability (Phase 8.3)

- **Logs** go to the console (and to `api/logs/` unless `LOG_FILE=false`). With `LOG_FORMAT=json` (the default in production)
  every line is one JSON object: `time`, `level`, `category`, `requestId`, `message`. Each HTTP request logs one line when it
  finishes (method, path without the query string, status, duration).
- **Request ids:** every response carries `X-Request-Id`. A caller (or the load balancer) may send its own id (up to 64 characters of
  `A-Z a-z 0-9 _ . -`); everything the request logs carries it, so a player's report can be traced.
- **Health:** `GET /api/v1/health/live` answers while the process runs (use it for restarts). `GET /api/v1/health` is readiness: it
  checks the database, Redis (when configured) and the engine (when the node uses it) and answers `503` naming what is down
  (use it for taking a node out of rotation).
- **Metrics:** `GET /api/v1/metrics` (Prometheus text format) with `Authorization: Bearer $METRICS_TOKEN`; the endpoint does not
  exist (404) while `METRICS_TOKEN` is unset. Series:

| Series                                              | Meaning                                                              |
| --------------------------------------------------- | -------------------------------------------------------------------- |
| `botrts_http_request_duration_seconds`              | histogram per method, route pattern and status class                 |
| `botrts_engine_up`                                  | 1 while the engine answers                                           |
| `botrts_engine_last_tick_milliseconds`, `..._tick_p95_milliseconds` | tick latency (last, p95 of the last 100)             |
| `botrts_engine_overrun_ticks_total`, `..._cut_ticks_total` | ticks over the interval / cut at the tick cap                 |
| `botrts_engine_queued_executions`                   | queue depth: executions above their bot's parallel limit              |
| `botrts_engine_deferred_executions`                 | executions the tick cap kept from running in the last tick            |
| `botrts_engine_max_wait_ticks`                      | scheduler fairness: the longest run of ticks an execution went unserved |
| `botrts_engine_executions`, `..._sandbox_memory_bytes` | live executions and the sandboxes' heap                            |
| `botrts_process_*`                                  | uptime, resident memory and heap of the API process                  |

  A scrape config: `bearer_token: <METRICS_TOKEN>`, `metrics_path: /api/v1/metrics`. Alert on `botrts_engine_up == 0`, on
  `botrts_engine_tick_p95_milliseconds` near the tick interval (100 ms by default), and on a growing `botrts_engine_max_wait_ticks`.

## Data lifecycle (Phase 8.4)

A job on the node that owns the engine (`all` or `engine`; never on `api` nodes) runs `LIFECYCLE_INTERVAL_MS` after a first pass
a minute after start. Each step is independent, and a failing one is logged and counted
(`botrts_lifecycle_step_failures_total`); `botrts_lifecycle_*` series show the last run and what was removed.

| Data                                              | Kept for                                                        |
| ------------------------------------------------- | --------------------------------------------------------------- |
| Terminal lines (input, output, errors)            | 30 days, and 5,000 per bot (the cap is enforced when a line is written) |
| Security lines (failed attempts, lockouts, adopt) | 90 days                                                         |
| Ended terminal sessions without lines             | as long as ordinary lines                                       |
| Finished and killed script executions             | `EXECUTION_RETENTION_DAYS` (30)                                 |
| Notifications                                     | `NOTIFICATION_RETENTION_DAYS` (30)                              |
| Expired, revoked or used logins and links         | `AUTH_DATA_RETENTION_DAYS` (7)                                  |
| Accounts whose email was never confirmed, no base | deleted after `UNVERIFIED_ACCOUNT_DAYS` (7)                     |
| Inactive accounts                                 | emailed after `INACTIVE_ACCOUNT_DAYS - INACTIVE_ACCOUNT_NOTICE_DAYS`, personal data erased `INACTIVE_ACCOUNT_NOTICE_DAYS` later |

Inactivity is the newest login activity (sign-up for a player who never logged in). **Offline scripts keep running, so a player
with an active execution is never inactive**; paid plans and the roles other than `user` are never erased for inactivity, and a
player who signs in after the notice keeps the account. Erasure is the same as a player's own account deletion (name, email,
credentials and logins removed; the row and the base stay, so the base can become a corpse base). Bots and bases are not
deleted by the job. `INACTIVE_ACCOUNT_DAYS=0` switches the inactivity steps off.

