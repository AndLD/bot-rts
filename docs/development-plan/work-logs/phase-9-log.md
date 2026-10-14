[← Phase 9 — Admin console](../phase-9-admin-console.md)

# Phase 9 — Admin console — work log

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

### 2026-10-14 — task 9.1 admin foundations
- **Tasks:** 9.1
- **Branch:** `feature/9.1-admin-foundations` — done
- **Decisions / deviations from the plan:** roles are the `UserStatus` values (`owner`, `admin`, plus the new `moderator` and `analyst`); the permission catalogue and the role sets are in `lib/utils/admin.ts` (shared with the client, and the source for the generated tables of 9.15). The second factor is TOTP (RFC 6238, own implementation over `crypto`, no new dependency) with a secret encrypted at rest (AES-256-GCM, key from `ADMIN_SECRET`, falling back to `JWT_ACCESS_SECRET`) and eight single-use recovery codes. A session is verified per session id (`admin_session_verifications`, valid for `ADMIN_2FA_TTL`, default 8 h), a code step cannot be replayed. `AdminAccessGuard` (after authentication) checks the address allow-list (`ADMIN_IP_ALLOWLIST`), the role's permission and the verification; `@RequirePermission` marks a route and also marks it session-only (API keys never reach it). `AuditInterceptor` writes the entry before the response leaves, for every non-GET admin call and every read marked `@Audited`; refusals are audited by the guard. The table `admin_audit_log` is append-only by trigger (update, delete, truncate), with no foreign key to users so the trail outlives accounts. The legacy `GET /api/v1/admin/statistics` is removed (and the dead `countByStatus`); no debug endpoint existed any more (removed by 0.8), 9.12 adds the new dev tools. The client has the `(admin)` route group (not indexed), the shell with the menu filtered by permission, and the enroll and verify screens. `users` list and update endpoints still use `RequireRole`; 9.4 replaces them with permissions.
- **Problems / blockers / findings:** none.
- **Next step:** 9.2, metrics history and alerting (`MetricsPort` over the 8.3 metrics).
- **Verify with:** `npx jest --selectProjects integration --testPathPattern admin.int` and `npx jest src/admin` from `api`; `npm test -w client -- admin`

### 2026-10-15 — task 9.2 metrics history and alerting
- **Tasks:** 9.2
- **Branch:** `feature/9.2-metrics-history-alerting` — done
- **Decisions / deviations from the plan:** a new `monitoring` feature module. `MetricsPort` (`RuntimeMetricsPort`) samples the engine through the engine port (so any node can), the HTTP counters of `HttpMetrics` (new `totals()`), and the process; rates and the latency percentile are computed between two samples. `MetricHistory` is a ring buffer per tier (10 s for 7 days, one-minute averages for 30 days, both tunable), in the memory of the process: each node keeps its own history and the console shows the node that answers (a database-backed store is the follow-up if that is not enough). The alert rules and default thresholds of design §25.5 that have a metric today are in `monitoring/domain/metric-catalog.ts` (engine up, tick p95 > 80 % of the interval, overrun rate > 1 %, 5xx share, latency, scheduler wait); the database, market, jobs and infrastructure (disk, backup) metrics of §25.5 are not sampled yet because their sources do not exist, and join by adding catalog entries. Thresholds can be overridden with `ADMIN_ALERT_THRESHOLDS`. A red alert is emailed to `ADMIN_ALERT_EMAILS` (the owner is not looked up; empty means no email). The Prometheus endpoint already existed (8.3); it gains `botrts_alerts_open`.
- **Problems / blockers / findings:** the CI gate also checks coverage per changed file (97 %), not only the package totals; check it with `node scripts/check-changed-coverage.mjs origin/develop api client` before pushing.
- **Next step:** 9.3, the dashboard page.
- **Verify with:** `npx jest --selectProjects integration --testPathPattern monitoring.int` and `npx jest src/monitoring` from `api`

### 2026-10-15 — task 9.3 dashboard
- **Tasks:** 9.3
- **Branch:** `feature/9.3-dashboard` (stacked on 9.2) — done
- **Decisions / deviations from the plan:** the admin Socket.IO namespace `/admin` has its own handshake (the access token of the game, then `createAdminSocketGuard`: a session, never an API key, with `dashboard.read` and a verified second factor); it pushes `monitoring-health` on connect and after every sample (`MonitoringService.onSample`). The client keeps the health report in the RTK Query cache and replaces it with each pushed report; it also polls every 30 s, so the dashboard works while the socket is down. Charts are a small SVG component (no charting dependency). The headline numbers "players online" and "active bots" of design §25.3 are not shown: there is no world metric for them yet (they join the metric catalog with the world metrics). Metric names for the page are the nested keys `admin.dashboard.metrics.<area>.<name>`. `AdminHome` is gone: the dashboard is the landing page.
- **Problems / blockers / findings:** next-intl reads a dot in a key as nesting, so a catalog id such as `engine.tickP95Ms` must be a nested key, not a flat one.
- **Next step:** 9.4, the Players page.
- **Verify with:** `npx jest --selectProjects integration --testPathPattern monitoring.int` from `api`; `npx jest src/features/admin` from `client`

### 2026-10-15 — task 9.4 players page
- **Tasks:** 9.4
- **Branch:** `feature/9.4-players` (stacked on 9.3) — done
- **Decisions / deviations from the plan:** a `players` feature module. Search is server-side (`q` matches name, email or the exact id; filters for status, email verification and registration dates; sort by name, email or registration). The profile is built by a read model (`PlayerDirectory`), and the moderation records (`player_bans`, `player_notes`) are part of the unit of work. Rank rule: an admin may act only on a lower rank (owner > admin > moderator > analyst > player), never on themselves; notes may be added to any account. A ban sets the status to `banned`, ends the player's sessions at once and remembers the previous status for the unban; a ban with a duration is lifted by a minute timer on the nodes that run the data lifecycle (`LIFECYCLE_ENABLED`); a ban does not stop running scripts: that is the quarantine of 9.6. A banned player's old token answers 401 (the session ended), signing in answers `USER_BANNED`. Role change is owner-only and never gives `banned`. Deleting uses the account erasure of the data lifecycle and needs the player's current email typed; the profile of an erased account stays for the trail, marked deleted. Every action needs a reason (3 to 500 characters) and writes the audit entry with before and after values (`AuditDetailParam`). Resource totals come from the storage modules in the database (the engine writes behind, so they can lag by a flush). The page is `/admin/players` and `/admin/players/[id]`.
- **Problems / blockers / findings:** none.
- **Next step:** 9.5, the inspector and the world map.
- **Verify with:** `npx jest --selectProjects integration --testPathPattern players.int` and `npx jest src/players` from `api`; `npx jest src/features/admin/players` from `client`

### 2026-10-15 — task 9.5 inspector and world map
- **Tasks:** 9.5
- **Branch:** `feature/9.5-inspector-map` (stacked on 9.4) — done
- **Decisions / deviations from the plan:** an `inspector` module, read-only. A bot or base shows its owner (a worker's owner through its base), place, energy (all batteries), storage, modules with their properties as text, drives, the latest executions and terminal lines. Listing a drive needs `inspector.read`; opening a file needs `inspector.files.read` and writes an audit entry (`inspector.read-file`, target `bot/drive/path`, never the content), also when the read fails. Search takes an id (bot, base, player) or `x,y`. The world map is `MapViewService.worldView`: the real layer, every body shown as the viewer's own, so the game's `MapCanvas` and `TileLoader` are reused as they are (the page gives the loader an admin request). Heatmaps: density (points per bucket), depletion (average share of a deposit used up, from the capacity the map already carries) and activity (bots with an active execution); the area is at most 512 cells a side and buckets are 8, 16, 32 or 64. The live event tail is `game-event-tail` on the admin namespace, to admins with `map.read`; unlike a player's `game-event` it is not filtered by who may hear of it. The handshake of the `/admin` namespace moved to one `AdminSocketGateway` (token, an admin role, a verified second factor, never an API key); each feature's gateway joins its room by permission. Not done: "view as player" mode of design §25.2 (it needs the player's own views through the console; not in the tasks of this phase).
- **Problems / blockers / findings:** the generated client turns `additionalProperties: true` into `any`, which the lint refuses, so module properties travel as `Record<string, string>` (each value as JSON text).
- **Next step:** 9.6, the supervision actions.
- **Verify with:** `npx jest --selectProjects integration --testPathPattern "inspector.int|monitoring.int"` and `npx jest src/inspector` from `api`; `npx jest src/features/admin/inspector` from `client`

### 2026-10-15 — task 9.6 supervision actions
- **Tasks:** 9.6
- **Branch:** `feature/9.6-supervision` — done
- **Decisions / deviations from the plan:** the engine gained two requests (`control`, `reboot`) on every link (worker thread, Redis, disabled port) and a persisted `ControlState` (`engine.control` in the game settings, loaded on recovery): `isPaused`, `areScriptsHalted`, `quarantined`. **Pause:** the tick loop does nothing but answer requests; start, manual calls and world actions are refused with `MAINTENANCE_MODE`; the support actions are not held, since they are the way back. **Kill-switch:** switching it on kills every running script and refuses new ones (`SCRIPTS_HALTED`) until it is off. **Quarantine:** the player's executions stay in memory but are not planned, so they resume when the quarantine ends; the player's starts, manual calls and world actions are refused (`PLAYER_QUARANTINED`). **Reboot:** each script of the bot is killed and started again from the beginning; refused during a pause, halt or quarantine. **Kill an execution** uses the engine's `kill` as the execution's owner. **Support actions** are world actions of a new `SupportService` (`support.grantResources`, `support.removeResources`, `support.restoreModule`), all or nothing; a compensation is a grant with its own audit action. The two world-wide switches need a typed word (`PAUSE`, `HALT`) on top of the reason. Roles: pause is for admins, the kill-switch and the support actions are owner-only (as in `lib/utils/admin.ts`). The state is read by the console from the database, so it shows also while the engine is down. The Supervision page, a Quarantine button on the player's profile and Kill / Reboot on the inspector are the UI. Not done: "paused executions" are shown as a count of the executions held by quarantine, not as a list; a banner for players during maintenance belongs to 9.9.
- **Problems / blockers / findings:** the global validation pipe assumed flat DTOs and answered 500 for an invalid nested body (the support stacks); it now collects the messages of nested properties (`validationMessages`).
- **Next step:** 9.10, the logs and audit viewer (execution order of the phase: 9.6 → 9.10 → 9.7 → 9.8 → 9.9 → 9.12 → 9.11 → 9.15 → 9.14 → 9.13).
- **Verify with:** `npx jest src/engine/application/engine-core.test.ts src/support src/supervision` and `npx jest --selectProjects integration --testPathPattern supervision.int` from `api`; `npx jest src/features/admin/supervision` from `client`

