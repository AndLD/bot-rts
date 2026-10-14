[← Game design index](../GAME-DESIGN.md)

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

## 25.2 Access model ✅

- A separate **`(admin)` route group** in the Next.js app, served only to admin roles, backed by `/api/v1/admin/*`. Admin
  endpoints are **never reachable with API keys** (design §22.1).
- **Admin roles** (defaults, tunable): `owner` (everything, including role changes and destructive actions), `admin`
  (everything except owner-only actions), `moderator` (player moderation, read-only inspection, no balance or operations
  controls), `analyst` (read-only dashboards and reports). Permissions are fine-grained (for example `players.ban`,
  `inspector.files.read`, `ops.pause-world`); roles are sets of permissions, checked on the server.
- **Mandatory two-factor authentication (TOTP)** for every admin role, optional IP allow-list.
- **Audit trail:** every admin action — and every read of sensitive data such as a player's files — is recorded: who, what,
  when, target, reason, before/after values. The audit log is append-only and visible in the console.
- **Safety:** destructive or irreversible actions need a reason and a typed confirmation; the most dangerous ones are
  owner-only; "view as player" mode is read-only, shows a banner and is audited. Test-only tools (§25.4, Dev tools) are disabled
  in production by configuration.

## 25.3 Pages and what they do ✅

| Page | Shows | Admin can |
| --- | --- | --- |
| **Dashboard** | Live health and performance (§25.5), alerts, headline numbers (players online, active bots, running scripts) | Acknowledge alerts, pick a time range |
| **Players** | Search and filters; profile (status, verification, registration, last login, sessions, bases and bots, resources, activity timeline, notes) | Ban / unban (reason, duration), force logout, resend verification, trigger a password reset, change role (owner), delete account, add notes |
| **Inspector** | Any base or bot: modules and condition, energy, position, storage, drives and files, running executions and logs | Read; open files (permission + audit); kill an execution; reboot a bot |
| **World map** | The whole map without fog of war, entity search by id or coordinates, heatmaps (density, depletion, activity), live event tail | Jump to entities, open the inspector |
| **Supervision** | Quarantined players, paused executions, maintenance state | Quarantine a player (suspend all their executions), pause / resume the world, global script kill-switch, support actions (grant or remove resources, restore a module, compensate) — each with a reason and audited |
| **Security** | Failed password attempts and lockouts, suspicious scripts (top ops consumers, wall-clock kills, sandbox violations), API-key usage and rate-limit hits, login anomalies and same-IP accounts | Ban, quarantine, revoke an API key |
| **Economy and balance** | Resource totals in the world and in storage, depletion rates, crafting and blueprint statistics | Edit the balance configuration (recipes, spawn weights, limits) with validation, a diff and rollback; set the global feature and category switches (§15.1) |
| **Market and chat** | Wallets and the ledger, the money supply, the treasury, order books, auctions, trade volume, price anomalies, chat reports | Cancel a listing, freeze a wallet, refund, mute a player, delete messages |
| **Operations** | Engine status and uptime, restarts, job status (retention cleanup), backup status | Broadcast announcements and schedule maintenance banners (via notifications, §24), restart the script runtime |
| **Logs and audit** | Structured log search by request / user / bot, slow-tick traces, audit log | Filter and export |
| **Analytics** | DAU / MAU, retention, onboarding funnel (sign-up → verified → base deployed → first script → first resource → tutorial completed), achievement rates | Export CSV |
| **Dev tools** (non-production only) | Seed a world, advance the injected clock, spawn test bots, reset the database | Replaces the legacy debug endpoint |
| **Docs** | The admin console documentation: roles and permissions, every page and action, procedures (supervision, maintenance, moderation), alert thresholds | Search; open from the "?" link of any admin page |

## 25.4 What is supervised ✅

Everything a player can see, an admin can see with more detail — but through the console, never through the player
API — and every action is attributable.

## 25.5 Health, performance and load ✅

Metrics are collected through a metrics port (engine, API tier, database, sockets) and kept as a rolling time series
(defaults: 7 days at 10-second resolution, 30 days at 1 minute; tunable), with a Prometheus-compatible `/metrics`
endpoint for external tools. The dashboard shows status (green / yellow / red) and charts for:

| Area | Metrics (default alert thresholds, tunable) |
| --- | --- |
| **Engine** | Tick duration p50 / p95 / p99 (yellow: p95 > 80 % of the tick interval); tick overruns per minute (red: > 1 %); world-flush duration and lag (red: > 5 s); ticks skipped; engine memory; restarts and crash-loop kills |
| **Scripts** | Running, queued and suspended executions; ops used vs budget; scripts killed by the wall-clock slice; QuickJS contexts and memory; scheduler fairness (spread of wait times between players) |
| **World** | Online players, active bots, bots per player, live scan areas and watchers, live-view diffs per second, map-chunk cache hit rate, events per second, commands applied per tick, conflict rate (`BLOCKED`, `EMPTY`) |
| **API and sockets** | Request rate, latency p50 / p95 / p99, 4xx / 5xx rate (yellow: 5xx > 1 %), Socket.IO connections and reconnects, rate-limit hits |
| **Database** | Query latency, connection-pool use, slow queries, table sizes and growth, flush transaction time |
| **Market** | Trade volume, order-book depth, auctions active / settled, fees collected, treasury balance, credits minted per day, money supply and the ledger invariant (should be 0 drift), chat messages per minute |
| **Jobs and notifications** | Retention and cleanup jobs (last run, duration, failures), notification queue depth and delivery lag, email send failures |
| **Infrastructure** | CPU and memory of each process, disk usage, backup age |

Alerts appear in the console and by email to the owner; webhook channels (Slack, Telegram) are in the backlog.

## 25.6 Backlog

- Webhook alert channels and an on-call schedule.
- Player reports and a support inbox.
- Scripted admin automation through a separate admin API key type.
