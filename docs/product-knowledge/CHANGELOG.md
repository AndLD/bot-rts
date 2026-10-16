# Changelog

All notable changes to Bot RTS are recorded here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/) (see [docs/operations/RELEASING.md](../operations/RELEASING.md)). Every pull request that
changes behaviour adds a line under "Unreleased"; a release moves them under its version.

## [Unreleased]

### Added

- The game: a procedurally generated world with fog of war, bases and bots made of modules, energy and day / night, crafting,
  a factory, radio links between bots, and combat.
- Scripting: a sandboxed (QuickJS / WebAssembly) TypeScript / JavaScript runtime with a Script API, the BotOS terminal, files on
  memory-module drives, and a fair scheduler on a single authoritative engine.
- The web client: landing and sign-up pages, the game with a live map, windows for the terminal, editor, factory and settings,
  achievements and notifications, English and Russian.
- The public `/api/v1` REST and Socket.IO API with an OpenAPI document.
- Horizontal scaling of the API tier: `APP_ROLE` (`all`, `api`, `engine`) with Redis for the Socket.IO adapter and the link to
  the engine node.
- Production hardening: rate limits for sign-in and for every other route, request size and time limits, security headers,
  request ids, JSON logs, Prometheus metrics, liveness and readiness checks.
- A scheduled data lifecycle job (retention of terminal logs, executions, notifications and expired logins; deletion of accounts
  that never confirmed their email; notice and erasure of long-inactive accounts).
- A load and soak test harness (`npm run load`) and measured capacity figures (docs/testing/load-testing.md).
- A Docker image of the API and engine, and a compose stack for the whole backend.
- API keys with scopes, per-key rate limits and a profile page; HTTP endpoints for scripts and the terminal history; an OpenAPI
  document with examples; the stability and deprecation policy (docs/product-knowledge/integrations/API.md).
- The MCP server (`mcp/`): about 50 tools, stdio and streamable HTTP, per-client keys (docs/product-knowledge/integrations/MCP.md).
- The web client on Vercel: cookie settings, preview-deployment origins, security headers (docs/operations/DEPLOYMENT.md).
- Admin console, Game time and Dev tools: set the time of day, change the day length without a jump, show the real-world time of a time
  zone, and (on a test server) advance the game clock and reset the database (`ops.game-time`, `POST /admin/devtools/reset-database`).
- The game clock: the rules of the game run on a separate `GAME_CLOCK` and the day cycle (length, time of day, real-world zone) is a
  runtime setting that the engine, the API nodes and the clients follow (`game-time-changed` socket event); sessions and logins stay on
  the real clock.
- Admin console, retention settings: every retention job (terminal lines, executions, notifications, expired logins, unverified and
  inactive accounts, player activity, monitoring history) can be switched and tuned from the Operations page and reset in one click;
  the new cleanup of `player_activity` (`PLAYER_ACTIVITY_RETENTION_DAYS`, 400 days); new permission `ops.retention`.
- Admin console, feature switches: sign-ups, base deployment, API keys, spawn seeds and the public API can be switched off from the
  Economy page with a reason (`FEATURE_DISABLED`, public `GET /api/v1/features`, `FEATURE_SWITCH_CACHE_MS`).
- Admin console, view as player: owners and admins open the game as a chosen player sees it, read-only (enforced on the server by
  a separate session; `VIEW_AS_READ_ONLY`), with a reason, a banner, a time limit (`ADMIN_VIEW_AS_TTL`) and an audit trail.
- Admin console foundations: the `moderator` and `analyst` roles with fine-grained permissions, mandatory TOTP two-factor sign-in
  with recovery codes, an append-only audit log (`GET /api/v1/admin/audit`), and the `/admin` area of the web client.
- Health monitoring for the admin console: metrics sampled every 10 s with a rolling history (7 days fine, 30 days at one minute),
  health per area, configurable alert thresholds, in-console alerts that can be acknowledged, and email for red alerts
  (`/api/v1/admin/monitoring/*`, `botrts_alerts_open` on `/metrics`).
- The admin dashboard: status per area, charts over a time range, open alerts, and live updates over the `/admin` Socket.IO namespace.
- The Players page: search with filters, a profile with sessions, bases, resources and an activity timeline, notes, and the moderation
  actions (ban with a duration, unban, sign out everywhere, resend verification, reset password, change role, delete), each with a
  reason, a rank check and an audit entry (`/api/v1/admin/players/*`).
- The Inspector and the world map of the admin console: any base or bot with modules, energy, storage, drives, executions and logs;
  opening a file is a separate permission and an audit entry; search by id or coordinates; the whole map without fog of war on the
  game's map renderer; density, depletion and activity heatmaps; a live tail of game events (`/api/v1/admin/inspector/*`).
- Supervision: kill an execution, reboot a bot, quarantine a player (their scripts are held), pause the world for maintenance, a global
  script kill-switch, and support actions (grant, remove, compensate, restore a module), each with a reason and an audit entry
  (`/api/v1/admin/supervision/*`). Validation errors of nested request bodies now name the field.
- Logs and audit in the admin console: a search of the node's recent log by text (a player or bot id) or by request id, slow-tick
  traces of the engine, audit filters and a CSV export of the trail (`LOG_BUFFER_SIZE`; `/api/v1/admin/logs`, `/api/v1/admin/audit/export`).
- Security monitoring in the admin console: every sign-in attempt is recorded (address, agent, outcome; removed by the data lifecycle), and
  the Security page shows failed sign-ins, accounts sharing an address or using many, locked bots, API keys with the times their rate limit
  held them back, scripts the sandbox stopped, and the scripts using the most ops; an admin can revoke any API key (`/api/v1/admin/security`).
- Economy and balance in the admin console: the resources in the deposits and in storage, the blueprints players learned, the modules that
  exist, and an editor for the balance of the game (resource spawn weights and amounts, recipes, crafting numbers) with a check, a diff,
  versions that are only added, and rollback; the active version applies when the server next starts
  (`/api/v1/admin/economy`, `/api/v1/admin/balance`). The links for the pages of the console now appear in its menu.
- Operations in the admin console: the state of the engine (uptime, tick, running scripts), the last pass of the data lifecycle job, the
  age of the last backup (`BACKUP_STATUS_FILE`), announcements to every player through the notifications, a scheduled maintenance banner
  and a notice while the world is paused (shown in the game and on its sign-in pages; public `GET /api/v1/maintenance`), and a restart of
  all running scripts (`/api/v1/admin/operations/*`).
- Dev tools in the admin console, for development and test servers: test players with a verified email, a known password and a base,
  and their removal (`DEV_TOOLS_ENABLED=true`; the server refuses to start with it in production; `/api/v1/admin/devtools/*`, owners only).
- Analytics in the admin console: players active each day and in the month, retention of weekly sign-up cohorts (day 1, 7 and 30), the
  onboarding funnel and the share of players who earned each achievement, each as a CSV download (`/api/v1/admin/analytics`). A day of
  activity is noted when a player signs in or renews the session (the new `player_activity` table).
- The documentation of the admin console, inside the console at `/admin/docs` (English and Russian): the roles, signing in with the second
  factor, every page of the console, procedures for maintenance and moderation, and reference tables of the permissions, the audited
  actions and the alert thresholds that are written from the code (`npm run docs:generate`). Every page has a "?" that opens its section.

### Changed

- Logs and traces run on OpenTelemetry (replacing log4js): every log record carries the trace id and the span id of the request, socket
  event, engine tick or scheduled job it was written in, and the trace continues over the engine thread, the Redis link of a scaled
  deployment, the notifications an engine event causes, and from the MCP server into the API. A caller may send a W3C `traceparent`; every
  response carries `X-Trace-Id` and `traceresponse`, and `X-Request-Id` is the trace id unless the caller sent its own. With
  `OTEL_EXPORTER_OTLP_ENDPOINT` set, logs and traces are sent to a collector gateway (`OTEL_TRACES_SAMPLER_ARG` samples new traces).
- The Logs page of the admin console can search the log of every node (`LOG_STORE=elasticsearch`, with a read-only Elasticsearch
  account): by text, level, request id, trace id, player, bot, node and time, with a node filter, the trace id of each line and paging.
  A search is limited in time range (`LOG_SEARCH_MAX_WINDOW_DAYS`) and duration (`LOG_SEARCH_TIMEOUT_MS`); when the store is down the
  console says so (`LOG_STORE_UNAVAILABLE`). The default stays the recent log of the node that answers (`LOG_STORE=memory`).
- Privacy of the logs and traces: emails, tokens (JWT and Bearer), passwords, secrets and API keys are taken out of every log line and
  span before it is written anywhere, in every node, and again in the gateway; every search of the log is written to the audit trail
  (`logs.search`, with what was asked), like each read of a trace; and the retention of the logs and traces is a setting of the
  Operations page (`logs`, 1 to 365 days, reset to the default with the others), applied to the lifecycle policy of the log store.
- Traces in the admin console: a line of the log has an **Open trace** action, and a trace can be opened by its trace id or by the
  request id of an older line. It shows the spans of the request over the API node, the engine and the notifications it caused as a
  timeline (name, node, start, duration, status) and every log line of the trace from every node in order (`GET /api/v1/admin/traces/:id`,
  `logs.read`; every read is audited as `logs.read-trace`). The spans need `LOG_STORE=elasticsearch`; without it the trace is its lines.
- The dashboard's history can be kept in the database (`MONITORING_HISTORY=postgres`, the default in production and on a node of a scaled
  deployment): every node, the engine node included, writes a one-minute row per metric (a sum and a count, so that averages merge) and
  per distribution (the API latency and the engine's tick duration as counts per bucket, with the slowest request or tick and its
  trace id). The charts show every node together, or one node chosen in a list; the 95th percentile of several nodes is computed from the
  merged buckets and never by averaging their percentiles. The retention of the "coarse series" of the Operations page now applies to
  these rows, and the cleanup job removes the older ones (new tables `metric_minutes` and `histogram_minutes`).
- The admin dashboard shows whether the log gateway is up and how full its export queue is, when `OTEL_GATEWAY_HEALTH_URL` and
  `OTEL_GATEWAY_METRICS_URL` are set (warnings when the gateway is down or its queue is more than half full).
- `docker compose --profile observability up -d` (or `npm run obs:up`) starts the log gateway (an OpenTelemetry Collector that checks a
  bearer token and writes to Elasticsearch through a queue on disk) and a single-node Elasticsearch with index templates and a retention
  policy (`LOG_RETENTION_DAYS`, default 14).
- Authentication is cached for two seconds between requests (`AUTH_CACHE_TTL_MS`).

### Removed

- The switches of the categories of manual control for the whole game moved from the settings panel of the game to the Economy page of
  the console (the route `/api/v1/admin/settings` stays, and now needs the second factor like every admin route).
- `GET /api/v1/admin/statistics`, which only counted users by status (the admin dashboard replaces it).

### Fixed

- A dialog of the admin console no longer opens with the reason of the previous action already typed in.
- The terminal stops following new lines when a scroll event arrives after a line was added.
- Script output no longer piles up in memory when a script writes faster than the database stores (lines are stored in batches).
- The load and soak harness (`npm run load`) no longer leaves its API server running after a run or an interrupt (the server was started
  through `npx` and only the wrapper was stopped; the whole process group is stopped now).

[Unreleased]: https://github.com/AndLD/bot-rts/commits/develop
