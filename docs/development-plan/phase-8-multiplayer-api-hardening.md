[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 8 — Multiplayer, public API & production hardening (71 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-8-log](./work-logs/phase-8-log.md)

| # | Task                                                                                                        | SP | Status |
| --- | ---------------------------------------------------------------------------------------------------------- | -- | --- |
| 8.1 | Scale the **API tier** horizontally: Socket.IO Redis adapter, sticky sessions, stateless sockets (the engine stays a single authoritative instance; map addressed in chunks to keep region sharding possible later) | 8 | ✅ |
| 8.2 | Rate limiting (login/signup), request timeouts, input size limits, helmet/CORS review | 5 | ✅ |
| 8.3 | Observability: structured logs, request IDs, metrics (tick latency, scheduler fairness, queue depth), health checks | 5 | ✅ |
| 8.4 | Data lifecycle: cleanup inactive users/bots, terminal session retention (30 days / 5,000 lines per bot via a scheduled cleanup job or time-partitioned tables; security events 90 days); offline-player executions continue, so account-inactivity policy must account for running scripts | 3 | ✅ |
| 8.5 | Performance pass: map query optimization, batching, caching, index verification | 5 | ✅ |
| 8.6 | Load/soak testing (many players × bots) and tuning the scheduler budget | 5 | ✅ |
| 8.7 | Release management: semantic versioning, `release/*`/`hotfix/*` flow, CHANGELOG, deploy docs; Dockerfile + compose (API, engine, PostgreSQL) alongside the PM2 setup | 6 | ✅ |
| 8.8 | Final coverage & quality sweep to ≥ 97 % per package | 5 | ⬜ |
| 8.9 | API keys: per-player keys (shown once, stored hashed), scopes that only narrow the player's rights, per-key rate limit, revocation, profile UI; Nest API-key guard and scope decorators for HTTP and WebSocket | 8 | ✅ |
| 8.10 | Public API hardening: API-key authentication on all `/api/v1` routes and sockets, stability/deprecation policy, OpenAPI published with examples, contract tests that the official client and key clients get identical behavior | 3 | ✅ |
| 8.11 | MCP server (`mcp/` workspace package): tools for observation, manual control per category, files, scripts, fabrication; calls only `/api/v1` with an API key; stdio + streamable HTTP transports; tests against a seeded test backend | 8 | ✅ |
| 8.12 | Frontend deployment on Vercel with the API/engine on a long-running host: shared registrable domain, cookie domain and CORS, Socket.IO direct to the API domain, environment configuration and preview deployments | 3 | ⬜ |
| 8.13 | E2E (Cypress + a second API-driven player): API key create / use / revoke in the profile; two players — contested cell (`BLOCKED`), private fog of war, an attack visible to the defender, adopting a stale bot; also a read-only API key that cannot act, an MCP smoke test (scan, move), and a corpse base visible to others with stale bots | 7 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the game runs under realistic multi-player load, has a horizontally scalable API tier, is observable, and is
released via full Git Flow.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/8.1-scalable-api-tier` | 8.1 | [#128](https://github.com/AndLD/bot-rts/pull/128) | ✅ merged |
| `feature/8.2-request-hardening` | 8.2 | [#129](https://github.com/AndLD/bot-rts/pull/129) | ✅ merged |
| `feature/8.3-observability` | 8.3 | [#130](https://github.com/AndLD/bot-rts/pull/130) | ✅ merged |
| `feature/8.4-data-lifecycle` | 8.4 | [#131](https://github.com/AndLD/bot-rts/pull/131) | ✅ merged |
| `feature/8.5-performance-pass` | 8.5 | [#132](https://github.com/AndLD/bot-rts/pull/132) | ✅ merged |
| `feature/8.6-load-soak` | 8.6 | [#133](https://github.com/AndLD/bot-rts/pull/133) | ✅ merged |
| `feature/8.7-release-management` | 8.7 | [#134](https://github.com/AndLD/bot-rts/pull/134) | ✅ merged |
| `feature/8.9-api-keys` | 8.9 | [#135](https://github.com/AndLD/bot-rts/pull/135) | ✅ merged |
| `feature/8.10-public-api-hardening` | 8.10 | [#136](https://github.com/AndLD/bot-rts/pull/136) | ✅ merged |
| `feature/8.11-mcp-server` | 8.11 | [#137](https://github.com/AndLD/bot-rts/pull/137) | 🟡 |
