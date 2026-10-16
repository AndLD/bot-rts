[← Testing](./README.md)

# Which clock a piece of code reads

The game has **two clocks** (design [§12.4](../product-knowledge/game-design/12-real-time-execution-model.md), [§25.3](../product-knowledge/game-design/25-admin-console.md)):

- **`CLOCK`** is the real clock. It stamps what must not depend on the game: sessions, access tokens, rate limits, bans and lockouts,
  the audit trail, database timestamps, retention, the schedules of the background jobs.
- **`GAME_CLOCK`** is the clock of the rules of the game: the real clock plus an offset (in production the offset is always 0). It
  drives the timers of crafting, research and the factory, the energy of the bots and the day cycle, the radio links, the combat and
  power rules, the times on the map, and the due times of notifications. An admin can change the game's day, the time of day and (on
  a test server) move this clock forward, and none of it can expire a login.

The day cycle is read from `GAME_TIME` (the settings in force), never from a constant.

## Classification

The modules that read the game clock (everything in them that is a rule of the game):

| Module | What reads `GAME_CLOCK` |
| --- | --- |
| `crafting` | `FactorySettler`: when a craft or a research job is done |
| `bots` | `BotsService` (when a point was first seen), `FactoryService` (queueing, learning), `MaintenanceService` (repair and disassembly), `ScanService` (what a scan sees and when) |
| `map` | `MapService`: when cells were seen |
| `mapview` | `MapViewService` and `MapStreamer`: how old what the player sees is |
| `modules` | `EnergyModel`: the sun at an instant, from the day cycle in force |
| `engine` | the event outbox, the radio network, the combat and power handlers, and the energy of the bots in a tick (`EngineCore.gameClock`) |
| `player-notifications` | `NotificationService`: which notifications are due |
| `time` | `GameTimeService`: the instant clients derive the in-game time from |

The files that read the real clock, and why (`api/src/shared/clock-usage.test.ts` checks this list and fails when a file that is not on it
reads `CLOCK`, so a new rule of the game cannot slip onto the real clock by accident):

| File | Why it is real time |
| --- | --- |
| `achievements/achievements.module.ts`, `tutorial/tutorial.module.ts`, `settings/settings.module.ts`, `users/users.module.ts` | when a player's own record was updated |
| `admin/admin.module.ts`, `players/players.module.ts`, `players/presentation/players.controller.ts`, `supervision/supervision.module.ts`, `viewas/viewas.module.ts`, `devtools/devtools.module.ts`, `operations/operations.module.ts`, `balance/balance.module.ts`, `security/security.module.ts`, `analytics/analytics.module.ts` | the audit trail, bans, sessions, the console |
| `apikeys/apikeys.module.ts`, `apikeys/presentation/api-access.guard.ts`, `ratelimit/ratelimit.module.ts`, `auth/auth.module.ts` | keys, rate limits, logins and tokens |
| `featureswitches/featureswitches.module.ts`, `retention/retention.module.ts`, `lifecycle/lifecycle.module.ts` | caches and schedules of the settings and of the cleanup |
| `logs/logs.module.ts` | the time range of a log search is real time |
| `monitoring/monitoring.module.ts` | the dashboard's samples are real time |
| `terminal/terminal.module.ts`, `terminal/terminal-core.module.ts` | the lines and sessions of the terminal, and the lockout of a bot's password (security) |
| `engine/engine-worker.module.ts` | the records of executions and of the control state, and the tick loop |
| `player-notifications/player-notifications.module.ts` | when a notification was made and read (its due times use the game clock) |
| `spawn/spawn.module.ts` | the lifetime of a spawn seed |
| `time/game-time-core.module.ts`, `shared/shared.module.ts`, `shared/application/clock.ts`, `shared/application/game-clock.ts` | the game clock is built on the real one |
