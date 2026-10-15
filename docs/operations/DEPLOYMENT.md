[← README](../../README.md)

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

## Running it

**Docker** (the image is built from `api/Dockerfile`; one image runs every role, chosen by `APP_ROLE`):

```bash
JWT_ACCESS_SECRET=$(openssl rand -hex 32) METRICS_TOKEN=... \
  docker compose --profile stack up -d --build      # db, redis, migrate (one-shot), engine, api
docker compose --profile stack up -d --scale api=3  # more API nodes (put a load balancer in front; publish no fixed port for them)
```

`migrate` applies the Prisma migrations before the others start. Settings come from the environment (`FRONTEND_URL`,
`WHITELIST_URLS`, `SMTP_*`, `TRUST_PROXY`, … see `api/.env.example`); a production start without `JWT_ACCESS_SECRET` is refused. A
release publishes `ghcr.io/<owner>/bot-rts-api:<version>` ([RELEASING.md](./RELEASING.md)). The development `npm run db:up` starts only
the database and Redis.

**PM2** (`ecosystem.config.json`, one process of each kind, `APP_ROLE=all`): `npm run build -w api`, apply the migrations with
`npm run db:migrate -w api` against the production `DATABASE_URL`, then `pm2 start ecosystem.config.json`. To scale out with PM2, add a
second app entry with `APP_ROLE=engine` (exactly one) and set `APP_ROLE=api` on the others.

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

After each pass the job stores its result in the game settings (`job.lifecycle`), so the Operations page of the admin console shows
the last run and the totals from any node.

## Backups and the Operations page (Phase 9.9)

The application does not make backups: the database host or a job of the operator does (`pg_dump`, or the snapshots of a managed
PostgreSQL). To have the age of the last backup shown on the Operations page, let that job write a small JSON file when it
finishes, and give the API nodes its path in `BACKUP_STATUS_FILE`:

```json
{ "finishedAt": "2026-10-15T03:00:00Z", "sizeBytes": 123456789, "location": "s3://backups/botrts-2026-10-15.dump" }
```

`finishedAt` is required; the other fields are optional. Without `BACKUP_STATUS_FILE` the page says that no backup is reported. The
file must be readable by the API process (on a node of the `api` role it is a file on that node or on a mounted volume).

The maintenance banner and the announcements of the Operations page are stored in the database and in the notifications of the players,
so they reach every node. `GET /api/v1/maintenance` (public) tells whether the world is paused and returns the banner while it is shown.

## Performance notes (Phase 8.5)

- **Writes are batched.** The engine's flush writes map cells, what players know, items, headings and modules each as one
  statement per kind, in one transaction. The use cases that touch several modules (energy, the factory, repairs) and the
  scan's knowledge snapshots use the same one-statement writes instead of a statement per row.
- **Indexes are verified** by `tests/integration/query-plans.int.test.ts`: for the hot queries (map areas, bases in an area and
  their count, knowledge of an area, bots, modules, files, executions, terminal lines, notifications, logins) the planner must be
  able to answer from an index. A new hot query goes into that list. `map_points (type, x, y)` serves the base queries.
- **Authentication is cached for `AUTH_CACHE_TTL_MS`** (2 s): a screen that loads with a dozen requests checks the session,
  the user and the identity once. The price is that a ban or a logout takes effect up to that long later; set `0` to check on
  every request.
- The world map is read and written by chunk, and the engine keeps hot chunks in memory (`ENGINE_MAX_CHUNKS`).

## The web client on Vercel (Phase 8.12)

The client is a Next.js app and runs on Vercel; the API and the engine need a long-running host (Socket.IO and the engine thread cannot
run on Vercel), so they stay on the Docker / PM2 side described above. The two sides meet only through the public API.

```text
https://play.example.com      Vercel   the Next.js client (pages, no business logic)
https://api.example.com       host     the API (HTTP and Socket.IO), behind TLS
```

### Project settings

- Import the repository in Vercel; the root `vercel.json` sets the framework, `npm ci` and `npm run build -w client`. Leave the
  Root Directory empty (the repository root) so that the shared `lib/` package is part of the build, and keep
  "Include source files outside of the Root Directory" on.
- Environment variables (Project → Settings → Environment Variables):

  | Variable | Production | Preview |
  | --- | --- | --- |
  | `NEXT_PUBLIC_API_URL` | `https://api.example.com` | the staging API, `https://staging-api.example.com` |
  | `NEXT_PUBLIC_SITE_URL` | `https://play.example.com` | the preview's own address, or the staging one |
  | `NEXT_PUBLIC_CONTACT_EMAIL` | the privacy contact | the same |

  They are read at build time, so a change needs a new deployment.
- The `main` and `develop` branches deploy (production and a stable staging); every pull request gets a preview deployment.

### Domains, cookies and CORS

- **Socket.IO goes straight to the API host.** The client connects to `NEXT_PUBLIC_API_URL`; nothing is proxied through Vercel, and the
  client uses the WebSocket transport only, so any number of API nodes behind a load balancer work without sticky sessions.
- **One registrable domain** (`play.example.com` and `api.example.com`) makes the client and the API *same-site*. Set on the API
  `COOKIE_SAME_SITE=lax` (so third-party sites can never use the refresh cookie) and, if you want the cookie visible to sibling hosts,
  `COOKIE_DOMAIN=example.com`. The refresh cookie is HTTP-only, `Secure`, and limited to `/api/v1/auth`.
- **Preview deployments live on another site** (`*.vercel.app`), so for them the API needs `COOKIE_SAME_SITE=none` (the production
  default, HTTPS only) and the preview origins in `WHITELIST_URLS`. Point previews at a *staging* API, never at production:
  `WHITELIST_URLS=https://play.example.com,https://bot-rts-*.vercel.app`. A wildcard may stand only in the first label of the host and
  a bare `https://*.vercel.app` is refused, because it would let every project on Vercel call the API with a player's cookie.
- **CORS and Socket.IO use one list**, `WHITELIST_URLS` (and `ADMIN_URL` for the socket). A request with a disallowed `Origin` is answered
  `403` before any handler runs, which is also what stops other sites from using the cookie routes (`/auth/refresh`, `/auth/logout`).
- Set `TRUST_PROXY=true` on the API behind the load balancer so that rate limits see the players' addresses.

### Checklist

1. API deployed with `NODE_ENV=production`, `JWT_ACCESS_SECRET`, `FRONTEND_URL`, `WHITELIST_URLS`, `COOKIE_*`, HTTPS.
2. `GET https://api.example.com/api/v1/health` answers `{"status":"ok", …}`.
3. Vercel variables set, production deployed from `main`.
4. Sign in on the client, deploy a base, open the terminal (the socket connects to the API host), reload (the refresh cookie works).
5. Open a preview deployment of a pull request and repeat step 4 against the staging API.

