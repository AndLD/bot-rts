[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 9 — Admin console (101 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-9-log](./work-logs/phase-9-log.md)

A new admin console, specified in design [§25](../game-design/25-admin-console.md), that lets admins supervise any player's
bots and resources, monitor the health, performance and load of the game, moderate players, and operate the world safely.
The starting point is only a few legacy API endpoints and no UI (design §25.1); the security hotfix for them is task 0.8.

**Priorities:** must — 9.1–9.6, 9.10, 9.13, 9.14, 9.15; should — 9.7, 9.8, 9.9, 9.12; could — 9.11. The phase depends on the engine and
the game event bus (Phase 5), the map renderer (Phase 6), the notification system (Phase 7) and the observability metrics
(8.3).

**Execution order:** 9.1 → 9.2 → 9.3 → 9.4 → 9.5 → 9.6 → 9.10 → 9.7 → 9.8 → 9.9 → 9.12 → 9.11 → 9.15 → 9.14 → 9.13.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 9.1 | Admin foundations (design §25.2): admin roles and fine-grained permissions with server-side guards and decorators, mandatory TOTP two-factor authentication, append-only audit log (port + interceptor) and its API, `/api/v1/admin/*` namespace (rejected for API keys), the `(admin)` route group and layout in the Next.js app; the legacy statistics and debug endpoints are removed (replaced by 9.3 and 9.12) | 8 | ✅ |
| 9.2 | Metrics history and alerting (design §25.5): a `MetricsPort` implemented over the 8.3 metrics, rolling time-series store with downsampling, health status per area, configurable alert thresholds, in-console and email alerts, Prometheus-compatible `/metrics` | 5 | ✅ |
| 9.3 | Dashboard page: live health and performance charts for engine, scripts, world, API and sockets, database, jobs and infrastructure, status tiles, alert list, time-range picker; live updates over an admin Socket.IO namespace | 8 | ✅ |
| 9.4 | Players page: server-side search and typed filters, profile with sessions, bases, bots, resources and activity timeline, moderation actions (ban / unban with reason and duration, force logout, resend verification, trigger password reset, change role, delete account), notes | 8 | ✅ |
| 9.5 | Inspector and world map: read-only inspection of any base or bot (modules, energy, position, storage, drives, executions, logs), file viewing behind a permission and an audit entry, map without fog of war reusing the map renderer, entity search by id or coordinates, heatmaps (density, depletion, activity), live game-event tail | 13 | ✅ |
| 9.6 | Supervision actions, each with reason, confirmation and audit: kill an execution, reboot a bot, quarantine a player (suspend all executions), pause and resume the world (maintenance mode), global script kill-switch, support actions (grant or remove resources, restore a module, compensation) | 8 | ✅ |
| 9.7 | Security and abuse monitoring: failed-password and lockout view, suspicious scripts (top ops consumers, wall-clock kills, sandbox violations), API-key usage and rate-limit hits, login anomalies and same-IP accounts, actions from the page (ban, quarantine, revoke key) | 8 | ✅ |
| 9.8 | Economy and balance: world economy dashboard (resource totals, depletion, crafting and blueprint statistics), balance configuration editor with validation, diff, versions and rollback, global feature and category switches (moved here from the settings of 6.8) | 8 | ⬜ |
| 9.9 | Operations: announcements broadcast through the notification system (7.6), scheduled maintenance banners, engine status and script-runtime restart, status of retention and cleanup jobs, backup status | 5 | ⬜ |
| 9.10 | Logs and audit viewer: structured log search by request, user and bot id, slow-tick traces, audit log filters and export | 8 | ✅ |
| 9.11 | Analytics and reports: DAU / MAU, retention, onboarding funnel, achievement rates, CSV export | 5 | ⬜ |
| 9.12 | Dev tools, disabled in production by configuration: seed a world, advance the injected clock, spawn test bots, reset the database (replaces the legacy debug endpoint) | 3 | ⬜ |
| 9.13 | E2E (Cypress) for the admin console: access control per role, two-factor sign-in, dashboard with data, ban cutting a player off, inspector and file-read audit, supervision action with audit entry, maintenance mode, balance edit and rollback, announcement reaching players, the Docs page (access per role, search, a "?" link opening its section) | 8 | ⬜ |
| 9.14 | Authorization matrix tests: every admin endpoint × every role (and API keys, and plain players) returns the expected result; audit completeness test (every mutating admin call writes an audit entry) | 3 | ⬜ |
| 9.15 | Admin console documentation: an in-console **Docs** page (`/admin/docs`, admin-only, rendered inside the `(admin)` route group, never public or indexed) with a sidebar tree and search, built on the player-documentation machinery of 7.11/7.12 (one content source, no second copy). Sections: roles and permissions (who sees and does what), two-factor sign-in and recovery, every page of design §25.3 with its actions, the audit log and what is recorded, supervision and maintenance procedures (quarantine, kill-switch, pause), alert thresholds and how to react (§25.5), moderation guidelines, dev tools (non-production only). Page-specific "?" links from every admin page open the matching section. Reference tables (permissions, audit action types, alert thresholds) are **generated from the code and config**, with a CI check that fails when they are stale; the link checker and the English/Russian check of 7.13 cover it, and a section is required for every admin page (a test fails when a page has none) | 3 | ⬜ |

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
| `feature/9.7-security` | 9.7 | [#158](https://github.com/AndLD/bot-rts/pull/158) | open |
