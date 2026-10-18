[← Game design index](./GAME-DESIGN.md)

# 25. Admin console

## 25.1 Starting point (review of the current code)

There is **no admin UI today**, and there never was one: no branch and no commit of the repository contains an admin
page. The commented-out admin routes were copied in with the authorization work (commit `a9e31af`) from another project's
template, and the components they refer to were never added. What exists:

- **Roles:** `admin`, `owner`, `user`, `unlimited`, `banned` (`UserStatus`). `admin` and `owner` are treated the same; a root
  admin is created from `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD`.
- **API:** `GET /api/private/statistics` (admin only): users by status, document counts per collection, start time and the
  size of a `public` directory (left over from another project). `DELETE /api/private/debug/collections` (admin only):
  deletes every document of the named collections, with no confirmation and no environment guard.
- **Client:** admin routes (`AdminLayout`, `Dashboard`, `Users`, `Settings`) are commented out in `routes/private.tsx` and the
  components do not exist; `ADMIN_URL` (the Socket.IO CORS origin) is a remnant of a former separate admin app.
- **Security findings (fixed by task 0.8, with 1.9, 1.11 and 8.2; every finding below except token revocation and the shared-store rate limit was fixed by 0.8 on 2026-10-11):**
  - `GET /api/private/users` and `PUT /api/private/users/:id` are behind the *login* check only, so **any logged-in player
    can list all users and edit any user, including setting their `status` to `admin`** (the next token refresh then carries
    the new role) or `active` to `true`.
  - The list endpoint passes a client-supplied JSON filter straight into a database query.
  - The debug endpoint can wipe whole collections in production.
  - The admin check trusts the role inside the token; banned and unverified users are not rejected anywhere on the server
    (`isActive` and `hasUserStatus` exist but are never used), and login and refresh do not check them either.
  - The Socket.IO handshake accepts an expired token and the event handlers then fail on the missing user; event payloads
    such as `botId` are not validated, so malformed input throws inside async handlers.
  - JWT payloads are not validated, refresh tokens cannot be revoked (logout only clears the cookie), and there is no rate
    limiting on login, signup or refresh.

## 25.2 Access model

- A separate **`(admin)` route group** in the Next.js app, served only to admin roles, backed by `/api/v1/admin/*`. Admin
  endpoints are closed to API keys (design §22.1) **except routes that opt in with an `admin:*:read` scope** (Phase 14, task 14.1; delivered).
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
  owner-only; **"view as player"** mode (delivered, task 9.16) is read-only, shows a banner and is audited: an owner or an admin
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

Every row is delivered (Phase 9, tasks 9.1–9.15) except what is marked *planned*, which belongs to an open task of the plan.

| Page | Shows | Admin can |
| --- | --- | --- |
| **Dashboard** | Live health and performance (§25.5), alerts, headline numbers (players online, active bots, running scripts) | Acknowledge alerts, pick a time range |
| **Players** | Search and filters; profile (status, verification, registration, last login, sessions, bases and bots, resources, activity timeline, notes) | Ban / unban (reason, duration), force logout, resend verification, trigger a password reset, change role (owner), delete account, add notes; view the game as the player (read-only, 9.16) |
| **Inspector** | Any base or bot: modules and condition, energy, position, storage, drives and files, running executions and logs | Read; open files (permission + audit); kill an execution; reboot a bot |
| **World map** | The whole map without fog of war, entity search by id or coordinates, heatmaps (density, depletion, activity), live event tail | Jump to entities, open the inspector |
| **Supervision** | Quarantined players, paused executions, maintenance state | Quarantine a player (suspend all their executions), pause / resume the world, global script kill-switch, support actions (grant or remove resources, restore a module, compensate) — each with a reason and audited |
| **Security** | Failed password attempts and lockouts, suspicious scripts (top ops consumers, wall-clock kills, sandbox violations), API-key usage and rate-limit hits, login anomalies and same-IP accounts | Ban, quarantine, revoke an API key |
| **Economy and balance** | Resource totals in the world and in storage, depletion rates, crafting and blueprint statistics | Edit the balance configuration (recipes, spawn weights, limits) with validation, a diff and rollback; set the global switches of the categories of manual control (§15.1; delivered); switch whole features of the game (delivered, 9.18: sign-ups, base deployment, API keys, spawn seeds, public API access; the market and the chat join in Phase 10) on the Features tab, with a reason and an audit entry; the public `GET /api/v1/features` tells the client what is off, and a refused request answers `FEATURE_DISABLED` |
| **Market and chat** (*Phase 10*) | Wallets and the ledger, the money supply and both ledger invariants (§26.1), the treasury (main and pending trades), custom admin wallets and system accounts (flagged `system: true`, shown only here), order books and depth, auctions and editions, trade volume, price history and statistics (volume and fees by kind, credits minted by admins, top traders, the share of players who traded, chat volume and reports by day), price anomalies with a review status, automatically frozen wallets awaiting a decision, chat reports (tasks 10.11 and 10.15) | Create system accounts and custom admin wallets; mint credits into main or a custom wallet; move credits between main and custom wallets; edit the fees (per kind and per resource) and the trading and transfer limits; manage the system trader (§26.10: rules per item and side, prices, caps, eligibility, schedules, campaigns with a preview of the expected spend, the global pause); cancel a listing (bidders refunded, a checkbox, on by default, refunds the listing fee); freeze or unfreeze a wallet; a compensation refund from main (an override checkbox, after a warning, allows a negative balance); mute a player, delete messages, review an anomaly, export CSV. Every action asks for a reason and is audited; minting and compensation need two-factor |
| **Operations** | Engine status and uptime, restarts, job status (retention cleanup), backup status | Broadcast announcements and set a maintenance banner (via notifications, §24; delivered), restart the script runtime (delivered); switch every retention job on or off and tune its ranges and timeouts within a floor and a ceiling (delivered, 9.19: terminal lines, executions, notifications, expired logins and sign-in attempts, never-confirmed accounts, the erasure of inactive accounts with a typed word, the days of player activity, the monitoring history, the interval of the cleanup job), see what the last pass removed, and put them all back to the defaults with one button; the audit log is never a retention job |
| **Logs and audit** | Structured log search by request / user / bot, slow-tick traces, audit log (delivered: the search reads the recent lines of the node that answers); *planned (Phase 13):* logs and traces of **every node** from Elasticsearch through OpenTelemetry, search by trace id, a trace view with its spans and the logs of all nodes | Filter and export |
| **Analytics** | DAU / MAU, retention, onboarding funnel (sign-up → verified → base deployed → first script → first resource → tutorial completed), achievement rates | Export CSV |
| **Dev tools** (non-production only) | Test players with a verified email, a known password and a base (delivered, 9.12); advance the game clock (9.17a), reset the database (9.17b: the world emptied, the owners and the one who pressed kept, a typed word) | Replaces the legacy debug endpoint |
| **Game time** (delivered, 9.17 and 9.17a) | The game clock, the day phase and the sunlight, live | Set the time of day (for example from 05:00 to 16:30); change the **day length** from 1 minute to 24 hours (the default is 24 real minutes), seamlessly: the cycle is re-anchored, so the time of day does not jump; sync the game to the **real-world time of a chosen time zone** (a 24-hour day, daylight saving included, computed from the zone's local time with `Intl`) and go back to the cycle at the same time of day; on a test server (owners, `DEV_TOOLS_ENABLED`) advance the game clock by a minute, an hour or a day. Every connected player is told by a socket event and sees a notice. Each change has a reason and is audited (`ops.game-time`: owners and admins) |
| **Docs** | The admin console documentation: roles and permissions, every page and action, procedures (supervision, maintenance, moderation), alert thresholds | Search; open from the "?" link of any admin page |

## 25.4 What is supervised

Everything a player can see, an admin can see with more detail — but through the console, never through the player
API — and every action is attributable.

## 25.5 Health, performance and load

Metrics are collected through a metrics port (engine, API tier, database, sockets) and kept as a rolling time series
(defaults: 7 days at 10-second resolution, 30 days at 1 minute; tunable), with a Prometheus-compatible `/metrics`
endpoint for external tools. The dashboard shows status (green / yellow / red) and charts for:

**Storage of the history (decided 2026-10-16).** The history must work with several API nodes and a separate engine node, so it
cannot live only in process memory. The fine tier (10-second steps) stays in memory per node for the live view; the coarse tier (1 minute)
is written by **every node to PostgreSQL**, with a `node` column and, for latencies, histogram bucket counts, so that a percentile across
nodes is computed from buckets and never by averaging per-node percentiles. The console reads all nodes, with a node filter, and the
retention is a setting (9.19). The console reads the history through a **history port**, so another store can be added later (see the
Prometheus entry in §25.6). The `/metrics` endpoint stays as it is, for external tools; the console does not use it.

| Area | Metrics (default alert thresholds, tunable) |
| --- | --- |
| **Engine** | Tick duration p50 / p95 / p99 (yellow: p95 > 80 % of the tick interval); tick overruns per minute (red: > 1 %); world-flush duration and lag (red: > 5 s); ticks skipped; engine memory; restarts and crash-loop kills |
| **Scripts** | Running, queued and suspended executions; ops used vs budget; scripts killed by the wall-clock slice; QuickJS contexts and memory; scheduler fairness (spread of wait times between players) |
| **World** | Online players, active bots, bots per player, live scan areas and watchers, live-view diffs per second, map-chunk cache hit rate, events per second, commands applied per tick, conflict rate (`BLOCKED`, `EMPTY`) |
| **API and sockets** | Request rate, latency p50 / p95 / p99, 4xx / 5xx rate (yellow: 5xx > 1 %), Socket.IO connections and reconnects, rate-limit hits |
| **Database** | Query latency, connection-pool use, slow queries, table sizes and growth, flush transaction time |
| **Market** | Trade volume, order-book depth, auctions active / settled, fees collected, treasury balance (main and pending trades), credits minted by admins per day, deliveries waiting for inbox space, money supply and the ledger invariants (should be 0 drift), chat messages per minute |
| **Jobs and notifications** | Retention and cleanup jobs (last run, duration, failures; their ranges are set from the console, *planned 9.19*), notification queue depth and delivery lag, email send failures |
| **Infrastructure** | CPU and memory of each process, disk usage, backup age; *planned (Phase 13):* the health and the queue of the shared collector gateway |

Delivered by task 13.8: every row above except **Market**, which comes with Phase 10 (10.11 and 10.15). Notes on what is measured: the database rows come from the timing of every query of the API process (`SLOW_QUERY_MS`) and the statistics views of PostgreSQL (connections, sizes every five minutes; "flush transaction time" is the world-write duration of the Engine row); the jobs row is the data lifecycle job and the notification queue; "engine memory" and the machine are the Infrastructure row of each node; restarts of the engine are seen as its uptime going back; "suspended executions" does not exist in the engine.

Alerts appear in the console and by email to the owner; webhook channels (Slack, Telegram) are in the backlog.

## 25.6 Backlog

- Webhook alert channels and an on-call schedule.
- Player reports and a support inbox.
- Scripted admin automation through a separate admin API key type.
- A retention window for the audit trail itself is open (Q6): it is append-only and never deleted today.
- **Prometheus as a second store for the metrics history** (decided 2026-10-16: not now; the PostgreSQL history above is used). The
  console would query Prometheus through its HTTP API behind the history port, without Grafana. What it adds over PostgreSQL: a time-series
  store with built-in compression and retention; PromQL (`rate()`, `histogram_quantile()`, aggregation by node or label) without writing a
  query per chart; correct counter handling across restarts; pull-based collection, so a silent node shows as `up == 0`; ready-made exporters
  for host, PostgreSQL and Redis metrics; alert rules with routing and silences; exemplars. What it costs: another service in development,
  CI and production (disk, retention, upgrades), a console that depends on it (an in-memory fallback is still needed), real histograms
  (`prom-client`) instead of the hand-written text writer, and a fixed list of server-side queries (the browser never sends PromQL).
  Both Prometheus (Apache 2.0) and Grafana OSS (AGPL v3) are free to self-host.
  **Adopt it when** one of these holds: several API nodes run in production and cross-node percentiles or exploration are needed; infrastructure
  metrics (host, database, Redis) are wanted without writing collectors; alert routing outgrows the in-app alerts; or the number of series
  outgrows PostgreSQL. **How:** a Prometheus adapter behind the history port, chosen by an environment variable like `LOG_STORE`; keep
  the same metric names and units. **Switching without a migration:** run both for one retention window and then switch the reads, or use a
  composite reader (Prometheus after the switch date, PostgreSQL before it) until the old rows expire; do not backfill, since the stored
  minute aggregates cannot be turned into histograms. **Avoid in any store:** labels per bot or per player (they multiply series).
