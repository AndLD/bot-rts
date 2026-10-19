[← Game design index](./GAME-DESIGN.md)

# 25. Admin console

## 25.1 Starting point

_Removed: the review of the code before the console existed is history, not a rule of the product (kept in `archived-docs/`). The section number is kept so that references resolve._

## 25.2 Access model

- A separate **admin area** of the web client, served only to admin roles, backed by `/api/v1/admin/*`. Admin
  endpoints are closed to API keys except routes that opt in with an `admin:*:read` scope (the rule is stated once in
  [`API.md`](../integrations/API.md#administration-routes)).
  Those scopes (`admin:logs:read`, `admin:metrics:read`, `admin:audit:read`, `admin:health:read`) form a set of their own, outside the player scopes of
  `API_SCOPES`: the player key form, the generated client, the public OpenAPI spec and the player documentation never list them. A key gets them
  only from `POST /api/v1/admin/api-keys` (permission `apikeys.admin`: owners and admins, second factor, a reason, a mandatory expiry up to
  `ADMIN_API_KEY_MAX_DAYS`, an optional address allowlist); the public key endpoint refuses them. The owner of the key must hold an admin role
  with the matching permission **on every call** (roles come from the database), so demoting or banning them stops the key at once. A key cannot
  answer a second factor: this is accepted, and the key is read-only, expiring and audited instead. Every call of such a key is written to the
  audit trail with the key id (`apiKeyId`), reads included. These keys are listed and revoked only in the console, never in the player's key list.
- **Admin roles** (defaults, tunable): `owner` (everything, including role changes and destructive actions), `admin`
  (everything except owner-only actions), `moderator` (player moderation, read-only inspection, no balance or operations
  controls), `analyst` (read-only dashboards and reports). Permissions are fine-grained (for example `players.ban`,
  `inspector.files.read`, `ops.pause-world`); roles are sets of permissions, checked on the server.
- **Mandatory two-factor authentication (TOTP)** for every admin role, optional IP allow-list.
- **Audit trail:** every admin action — and every read of sensitive data such as a player's files — is recorded: who, what,
  when, target, reason, before/after values. The audit log is append-only and visible in the console.
- **Safety:** destructive or irreversible actions need a reason and a typed confirmation; the most dangerous ones are
  owner-only; **"view as player"** mode is read-only, shows a banner and is audited: an owner or an admin
  opens the game's own screens as a chosen player sees them (that player's fog of war, bases and bots, storage, factory, terminal
  history, files, notifications, achievements and settings). It is read-only **on the server**: starting it gives the admin a
  second session (a `viewAs` claim, opened in a new tab; the console stays open in the first) whose requests are answered with the
  player's data, while every change and every socket command is refused with `VIEW_AS_READ_ONLY` and the console routes are closed to
  it. It needs the permission `players.view-as` (owners and admins) and a reason, ends after a time limit (`ADMIN_VIEW_AS_TTL`,
  30 minutes), by the exit button or when the admin is demoted, never tells the player, never works for API keys, for oneself or for
  an equal or higher rank, and the start, the end and every sensitive read in it (file contents, terminal history) are audited with
  the admin as the actor. Test-only tools (§25.4, Dev tools) are disabled in production by
  configuration.

## 25.3 Pages and what they do

The plan tracks which of these pages and actions are built.

| Page | Shows | Admin can |
| --- | --- | --- |
| **Dashboard** | Live health and performance (§25.5), alerts, headline numbers (players online, active bots, running scripts) | Acknowledge alerts, pick a time range |
| **Players** | Search and filters; profile (status, verification, registration, last login, sessions, bases and bots, resources, activity timeline, notes) | Ban / unban (reason, duration), force logout, resend verification, trigger a password reset, change role (owner), delete account, add notes; view the game as the player (read-only, 9.16) |
| **Inspector** | Any base or bot: modules and condition, energy, position, storage, drives and files, running executions and logs | Read; open files (permission + audit); kill an execution; reboot a bot |
| **World map** | The whole map without fog of war, entity search by id or coordinates, heatmaps (density, depletion, activity), live event tail | Jump to entities, open the inspector |
| **Supervision** | Quarantined players, paused executions, maintenance state | Quarantine a player (suspend all their executions), pause / resume the world, global script kill-switch, support actions (grant or remove resources, restore a module, compensate) — each with a reason and audited |
| **Security** | Failed password attempts and lockouts, suspicious scripts (top ops consumers, wall-clock kills, sandbox violations), API-key usage and rate-limit hits, login anomalies and same-IP accounts | Ban, quarantine, revoke an API key |
| **Economy and balance** | Resource totals in the world and in storage, depletion rates, crafting and blueprint statistics | Edit the balance configuration (recipes, spawn weights, limits) with validation, a diff and rollback; set the global switches of the categories of manual control (§15.1); switch whole features of the game (sign-ups, base deployment, API keys, spawn seeds, public API access, the market and the chat) on the Features tab, with a reason and an audit entry; the public `GET /api/v1/features` tells the client what is off, and a refused request answers `FEATURE_DISABLED` |
| **Market and chat** | Wallets and the ledger, the money supply and both ledger invariants (§26.1), the treasury (main and pending trades), custom admin wallets and system accounts (flagged `system: true`, shown only here), order books and depth, auctions and editions, trade volume, price history and statistics (volume and fees by kind, credits minted by admins, top traders, the share of players who traded, chat volume and reports by day), price anomalies with a review status, automatically frozen wallets awaiting a decision, chat reports | Create system accounts and custom admin wallets; mint credits into main or a custom wallet; move credits between main and custom wallets; edit the fees (per kind and per resource) and the trading and transfer limits; manage the system trader (§26.10: rules per item and side, prices, caps, eligibility, schedules, campaigns with a preview of the expected spend, the global pause); cancel a listing (bidders refunded, a checkbox, on by default, refunds the listing fee); freeze or unfreeze a wallet; a compensation refund from main (an override checkbox, after a warning, allows a negative balance); mute a player, delete messages, review an anomaly, export CSV. Every action asks for a reason and is audited; minting and compensation need two-factor |
| **Operations** | Engine status and uptime, restarts, job status (retention cleanup), backup status | Broadcast announcements and set a maintenance banner (via notifications, §24), restart the script runtime; switch every retention job on or off and tune its ranges and timeouts within a floor and a ceiling (terminal lines, executions, notifications, expired logins and sign-in attempts, never-confirmed accounts, the erasure of inactive accounts with a typed word, the days of player activity, the monitoring history, the interval of the cleanup job), see what the last pass removed, and put them all back to the defaults with one button; the audit log is never a retention job |
| **Logs and audit** | Structured log search by request / user / bot, slow-tick traces, audit log; logs and traces of **every node**, search by trace id, a trace view with its spans and the logs of all nodes | Filter and export |
| **Analytics** | DAU / MAU, retention, onboarding funnel (sign-up → verified → base deployed → first script → first resource → tutorial completed), achievement rates | Export CSV |
| **Dev tools** (non-production only) | Test players with a verified email, a known password and a base; advance the game clock, reset the database (the world emptied, the owners and the one who pressed kept, a typed word) | – |
| **Game time** | The game clock, the day phase and the sunlight, live | Set the time of day (for example from 05:00 to 16:30); change the **day length** from 1 minute to 24 hours (the default is 24 real minutes), seamlessly: the cycle is re-anchored, so the time of day does not jump; sync the game to the **real-world time of a chosen time zone** (a 24-hour day, daylight saving included, computed from the zone's local time) and go back to the cycle at the same time of day; on a test server (owners, `DEV_TOOLS_ENABLED`) advance the game clock by a minute, an hour or a day. Every connected player is told by a socket event and sees a notice. Each change has a reason and is audited (`ops.game-time`: owners and admins) |
| **Docs** | The admin console documentation: roles and permissions, every page and action, procedures (supervision, maintenance, moderation), alert thresholds | Search; open from the "?" link of any admin page |

## 25.4 What is supervised

Everything a player can see, an admin can see with more detail — but through the console, never through the player
API — and every action is attributable.

## 25.5 Health, performance and load

Metrics are collected through a metrics port (engine, API tier, database, sockets) and kept as a rolling time series
(defaults: 7 days at 10-second resolution, 30 days at 1 minute; tunable), with a standard `/metrics`
endpoint for external tools. The dashboard shows status (green / yellow / red) and charts for:

**Storage of the history (decided 2026-10-16).** The history works with several API nodes and a separate engine node, so it is not kept
only in process memory: every node records its coarse (1 minute) tier durably, with a node column and, for latencies, histogram bucket
counts, so that a percentile across nodes is computed from buckets and never by averaging per-node percentiles. The console reads all
nodes, with a node filter, and the retention is a setting. A second store can be added later (see the entry on a metrics store in §25.6).

| Area | Metrics (default alert thresholds, tunable) |
| --- | --- |
| **Engine** | Tick duration p50 / p95 / p99 (yellow: p95 > 80 % of the tick interval); tick overruns per minute (red: > 1 %); world-flush duration and lag (red: > 5 s); ticks skipped; engine memory; restarts and crash-loop kills |
| **Scripts** | Running, queued and suspended executions; ops used vs budget; scripts killed by the wall-clock slice; script contexts and memory; scheduler fairness (spread of wait times between players) |
| **World** | Online players, active bots, bots per player, live scan areas and watchers, live-view diffs per second, map-chunk cache hit rate, events per second, commands applied per tick, conflict rate (`BLOCKED`, `EMPTY`) |
| **API and sockets** | Request rate, latency p50 / p95 / p99, 4xx / 5xx rate (yellow: 5xx > 1 %), socket connections and reconnects, rate-limit hits |
| **Database** | Query latency, connection-pool use, slow queries, table sizes and growth, flush transaction time |
| **Market** | Trade volume, order-book depth, auctions active / settled, fees collected, treasury balance (main and pending trades), credits minted by admins per day, deliveries waiting for inbox space, money supply and the ledger invariants (should be 0 drift), chat messages per minute |
| **Jobs and notifications** | Retention and cleanup jobs (last run, duration, failures; their ranges are set from the console), notification queue depth and delivery lag, email send failures |
| **Infrastructure** | CPU and memory of each process, disk usage, backup age, the health and the queue of the shared collector gateway |

The database rows come from the timing of every query and the statistics of the database; "suspended executions" does not exist in the engine (§12.3).

Alerts appear in the console and by email to the owner; webhook channels (Slack, Telegram) are in the backlog.

## 25.6 Backlog

- Webhook alert channels and an on-call schedule.
- Player reports and a support inbox.
- Scripted admin automation through a separate admin API key type.
- A retention window for the audit trail itself is open (Q6): it is append-only and never deleted today.
- **A second store for the metrics history** (decided 2026-10-16: not now; the history of §25.5 is used). The reasons, what it would add and cost, and when to adopt it are recorded in the operations guide.