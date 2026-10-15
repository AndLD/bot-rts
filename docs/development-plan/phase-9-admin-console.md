[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 9 — Admin console (119 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-9-log](./work-logs/phase-9-log.md)

A new admin console, specified in design [§25](../game-design/25-admin-console.md), that lets admins supervise any player's
bots and resources, monitor the health, performance and load of the game, moderate players, and operate the world safely.
The starting point is only a few legacy API endpoints and no UI (design §25.1); the security hotfix for them is task 0.8.

**Priorities:** must — 9.1–9.6, 9.10, 9.13, 9.14, 9.15; should — 9.7, 9.8, 9.9, 9.12, 9.16, 9.18; could — 9.11, 9.17. The phase depends on the engine and
the game event bus (Phase 5), the map renderer (Phase 6), the notification system (Phase 7) and the observability metrics
(8.3).

**Execution order:** 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.10 → 9.7 → 9.8 → 9.9 → 9.12 → 9.11 → 9.15 → 9.14 → 9.13 → 9.16 → 9.18 → 9.17.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 9.1 | Admin foundations (design §25.2): admin roles and fine-grained permissions with server-side guards and decorators, mandatory TOTP two-factor authentication, append-only audit log (port + interceptor) and its API, `/api/v1/admin/*` namespace (rejected for API keys), the `(admin)` route group and layout in the Next.js app; the legacy statistics and debug endpoints are removed (replaced by 9.3 and 9.12) | 8 | ✅ |
| 9.2 | Metrics history and alerting (design §25.5): a `MetricsPort` implemented over the 8.3 metrics, rolling time-series store with downsampling, health status per area, configurable alert thresholds, in-console and email alerts, Prometheus-compatible `/metrics` | 5 | ✅ |
| 9.3 | Dashboard page: live health and performance charts for engine, scripts, world, API and sockets, database, jobs and infrastructure, status tiles, alert list, time-range picker; live updates over an admin Socket.IO namespace | 8 | ✅ |
| 9.4 | Players page: server-side search and typed filters, profile with sessions, bases, bots, resources and activity timeline, moderation actions (ban / unban with reason and duration, force logout, resend verification, trigger password reset, change role, delete account), notes | 8 | ✅ |
| 9.5 | Inspector and world map: read-only inspection of any base or bot (modules, energy, position, storage, drives, executions, logs), file viewing behind a permission and an audit entry, map without fog of war reusing the map renderer, entity search by id or coordinates, heatmaps (density, depletion, activity), live game-event tail | 13 | ✅ |
| 9.6 | Supervision actions, each with reason, confirmation and audit: kill an execution, reboot a bot, quarantine a player (suspend all executions), pause and resume the world (maintenance mode), global script kill-switch, support actions (grant or remove resources, restore a module, compensation) | 8 | ✅ |
| 9.7 | Security and abuse monitoring: failed-password and lockout view, suspicious scripts (top ops consumers, wall-clock kills, sandbox violations), API-key usage and rate-limit hits, login anomalies and same-IP accounts, actions from the page (ban, quarantine, revoke key) | 8 | ✅ |
| 9.8 | Economy and balance: world economy dashboard (resource totals, depletion, crafting and blueprint statistics), balance configuration editor with validation, diff, versions and rollback, global feature and category switches (moved here from the settings of 6.8) | 8 | ✅ |
| 9.9 | Operations: announcements broadcast through the notification system (7.6), scheduled maintenance banners, engine status and script-runtime restart, status of retention and cleanup jobs, backup status | 5 | ✅ |
| 9.10 | Logs and audit viewer: structured log search by request, user and bot id, slow-tick traces, audit log filters and export | 8 | ✅ |
| 9.11 | Analytics and reports: DAU / MAU, retention, onboarding funnel, achievement rates, CSV export | 5 | ✅ |
| 9.12 | Dev tools, disabled in production by configuration: seed a world, advance the injected clock, spawn test bots, reset the database (replaces the legacy debug endpoint) | 3 | ✅ |
| 9.13 | E2E (Cypress) for the admin console: access control per role, two-factor sign-in, dashboard with data, ban cutting a player off, inspector and file-read audit, supervision action with audit entry, maintenance mode, balance edit and rollback, announcement reaching players, the Docs page (access per role, search, a "?" link opening its section) | 8 | ✅ |
| 9.14 | Authorization matrix tests: every admin endpoint × every role (and API keys, and plain players) returns the expected result; audit completeness test (every mutating admin call writes an audit entry) | 3 | ✅ |
| 9.15 | Admin console documentation: an in-console **Docs** page (`/admin/docs`, admin-only, rendered inside the `(admin)` route group, never public or indexed) with a sidebar tree and search, built on the player-documentation machinery of 7.11/7.12 (one content source, no second copy). Sections: roles and permissions (who sees and does what), two-factor sign-in and recovery, every page of design §25.3 with its actions, the audit log and what is recorded, supervision and maintenance procedures (quarantine, kill-switch, pause), alert thresholds and how to react (§25.5), moderation guidelines, dev tools (non-production only). Page-specific "?" links from every admin page open the matching section. Reference tables (permissions, audit action types, alert thresholds) are **generated from the code and config**, with a CI check that fails when they are stale; the link checker and the English/Russian check of 7.13 cover it, and a section is required for every admin page (a test fails when a page has none) | 3 | ✅ |
| 9.16 | **View as player** (design §25.2, added 2026-10-15 after the first tasks were done): an owner or an admin opens the game as a chosen player sees it, with the game's own screens in a read-only mode: the map with that player's fog of war and known cells, bases and bots, storage and factory, terminal history, the list and content of files, notifications, achievements and settings. Everything is read-only **on the server**: the session of the admin carries a `viewAs` claim that makes the API answer every read route with the target's data and refuse every request that changes something and every socket command (`VIEW_AS_READ_ONLY`), so no screen can write by mistake; the target is not told; it needs a new permission `players.view-as` (owners and admins, never API keys, never a higher rank than the admin), a reason typed at the start, and ends after a time limit (30 minutes, configurable) or by exit. A banner on every screen names the player and the end of the session, with an exit button. Each start and end is audited, and so is every read of sensitive data (files, terminal history) with the path or the session, as in the inspector. Includes: authorization-matrix entries, unit and integration tests of the claim and the guard, a Cypress spec (start with a reason, the player's own view, every write refused, the banner and the exit, the audit trail, the access per role), and the pages of the admin documentation in English and Russian | 8 | ⬜ |
| 9.17 | **Dev tools, part 2** (design §25.3, added 2026-10-15; non-production only, behind `DEV_TOOLS_ENABLED`, owners, audited with a reason): **(a) Advance the game clock.** The game reads time from the injected `Clock` (never `Date.now()`, design §12.4), so crafting, research, the day/night cycle, bans, notifications and the cleanup job all follow it. In a development or test server an owner moves it forward by a step (1 minute, 1 hour, 1 day) to see what happens without waiting. The offset is kept in the game settings and read by every process: the API node and the separate application context of the engine thread each get an offset clock that follows it (the engine receives a new request, `setTimeOffset`, and applies it between ticks, so the tick loop itself still runs on real time), and the other nodes of a scaled test deployment read it from the database. Time only moves forward; a reset puts it back. **(b) Reset the database.** With the world stopped (the engine pauses and flushes), every table of the game is emptied in an order that respects the foreign keys, the migrations stay, the root owner and the admin who pressed the button are kept (or recreated from `ROOT_USER_*`), the engine reloads an empty world, and every other session ends; it needs a typed word and a reason. Includes: unit and integration tests (the offset clock in both threads, the reset against PostgreSQL), the `authorization-matrix` entries, a Cypress spec (advance the clock and see a craft finish; reset and see an empty world), and the pages of the admin documentation in English and Russian | 5 | ⬜ |
| 9.18 | **Global feature switches** (design §25.3, Economy and balance, added 2026-10-15): the switches of whole features of the game, besides the categories of manual control that 9.8 moved to the console. A typed registry in `lib` lists them (each with its name, what it stops, and its default): the first set is sign-ups, deploying a base, creating and using API keys, spawn seeds and the public MCP/API access, and Phase 10 adds the market and the chat the same way. The state is stored in the game settings, read by every node (cached for a short time), and checked on the server by the use case that the feature belongs to (a refused request answers `FEATURE_DISABLED` with the feature's name, never a bare 500). A public status endpoint tells the client which features are off, so the screens hide or explain them. The Economy page gets a tab for them: each switch with a reason and an audit entry, and an owner/admin permission `balance.write` as for the categories. Switching a feature off never deletes data, never kills what is running unless the switch says so, and is shown to the players. Includes: unit and integration tests of every enforcement point, the `authorization-matrix` entries, a Cypress spec (switch sign-ups off and see the sign-up refused, switch a base deployment off, switch back), and the admin documentation in English and Russian | 5 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** an admin can sign in with two-factor authentication, see the game's health and load in real time, inspect
and supervise any player's bots and resources, moderate players, operate the world (maintenance, announcements, balance
changes), and every admin action is audited — covered by unit, integration, authorization-matrix and e2e tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/9.1-admin-foundations` | 9.1 | [#151](https://github.com/AndLD/bot-rts/pull/151) | merged |
| `feature/9.2-metrics-history-alerting` | 9.2 | [#152](https://github.com/AndLD/bot-rts/pull/152) | merged |
| `feature/9.3-dashboard` | 9.3 | [#153](https://github.com/AndLD/bot-rts/pull/153) | merged |
| `feature/9.4-players` | 9.4 | [#154](https://github.com/AndLD/bot-rts/pull/154) | merged |
| `feature/9.5-inspector-map` | 9.5 | [#155](https://github.com/AndLD/bot-rts/pull/155) | merged |
| `feature/9.6-supervision` | 9.6 | [#156](https://github.com/AndLD/bot-rts/pull/156) | merged |
| `feature/9.10-logs-audit` | 9.10 | [#157](https://github.com/AndLD/bot-rts/pull/157) | merged |
| `feature/9.7-security` | 9.7 | [#158](https://github.com/AndLD/bot-rts/pull/158) | merged |
| `feature/9.8-economy-balance` | 9.8 | [#159](https://github.com/AndLD/bot-rts/pull/159) | merged |
| `feature/9.9-operations` | 9.9 | [#160](https://github.com/AndLD/bot-rts/pull/160) | merged |
| `feature/9.12-devtools` | 9.12 | [#161](https://github.com/AndLD/bot-rts/pull/161) | merged |
| `feature/9.11-analytics` | 9.11 | [#162](https://github.com/AndLD/bot-rts/pull/162) | merged |
| `feature/9.15-admin-docs` | 9.15 | [#163](https://github.com/AndLD/bot-rts/pull/163) | merged |
| `feature/9.14-authorization-matrix` | 9.14 | [#164](https://github.com/AndLD/bot-rts/pull/164) | merged |
| `feature/9.13-admin-e2e` | 9.13 | [#165](https://github.com/AndLD/bot-rts/pull/165) | open |
