# Changelog

All notable changes to Bot RTS are recorded here, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and the project uses [Semantic Versioning](https://semver.org/) (see [docs/operations/RELEASING.md](./operations/RELEASING.md)). Every pull request that
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
  document with examples; the stability and deprecation policy (docs/integrations/API.md).
- The MCP server (`mcp/`): about 50 tools, stdio and streamable HTTP, per-client keys (docs/integrations/MCP.md).
- The web client on Vercel: cookie settings, preview-deployment origins, security headers (docs/operations/DEPLOYMENT.md).
- Admin console foundations: the `moderator` and `analyst` roles with fine-grained permissions, mandatory TOTP two-factor sign-in
  with recovery codes, an append-only audit log (`GET /api/v1/admin/audit`), and the `/admin` area of the web client.
- Health monitoring for the admin console: metrics sampled every 10 s with a rolling history (7 days fine, 30 days at one minute),
  health per area, configurable alert thresholds, in-console alerts that can be acknowledged, and email for red alerts
  (`/api/v1/admin/monitoring/*`, `botrts_alerts_open` on `/metrics`).
- The admin dashboard: status per area, charts over a time range, open alerts, and live updates over the `/admin` Socket.IO namespace.
- The Players page: search with filters, a profile with sessions, bases, resources and an activity timeline, notes, and the moderation
  actions (ban with a duration, unban, sign out everywhere, resend verification, reset password, change role, delete), each with a
  reason, a rank check and an audit entry (`/api/v1/admin/players/*`).

### Changed

- Authentication is cached for two seconds between requests (`AUTH_CACHE_TTL_MS`).

### Removed

- `GET /api/v1/admin/statistics`, which only counted users by status (the admin dashboard replaces it).

### Fixed

- The terminal stops following new lines when a scroll event arrives after a line was added.
- Script output no longer piles up in memory when a script writes faster than the database stores (lines are stored in batches).
- The load and soak harness (`npm run load`) no longer leaves its API server running after a run or an interrupt (the server was started
  through `npx` and only the wrapper was stopped; the whole process group is stopped now).

[Unreleased]: https://github.com/AndLD/bot-rts/commits/develop
