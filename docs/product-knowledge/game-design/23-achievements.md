[← Game design index](./GAME-DESIGN.md)

# 23. Achievements

## 23.1 Model

- **Achievements are data-driven**: each one is a record in a config file with an id, a localized title and
  description (§15.4), the game event(s) that advance it (§24), a threshold, an optional tier (for example 1 / 100 /
  1,000 cells explored), and an optional `hidden` flag (shown only once unlocked).
- An **achievement service** consumes the engine's game events (§24.1) **outside the tick path**, so it can never slow
  or alter the simulation. It keeps per-player progress counters and the unlock time in the database.
- Progress is stored **per user** (not per base), so it survives base loss and redeploys.
- Achievements earned **while the player is offline** (scripts run 24/7, §1) are unlocked normally, and the player
  gets the notification the next time they log in (§24.3).
- **No gameplay rewards.** Achievements are recognition only (a badge shown on the profile), so they cannot unbalance
  the game. Cosmetic rewards are in the backlog (§21).
- An unlock raises a realtime notification (§24) and appears in the player's achievements page with progress bars for
  locked ones.

**Implementation (Phase 7).** `AchievementService` is a game-event consumer (§24.1) in the API process. It counts what the player's own events add to per-player counters (`cellsScanned`, `unitsMined`, `shotsHit`, `scriptRuns`, `cellsTravelled`, and the world orders the engine now reports as events: `BaseDeployed`, `CraftOrdered`, `BotAssembled`, `ModuleRepaired`, `ModuleDisassembled`, `BotAdopted`), keeps them in memory and writes them in batches every two seconds, and unlocks every achievement whose counter reached its threshold. The definitions are data (`api/src/achievements/domain/achievement-definitions.ts`): a family with a counter and a list of thresholds, one achievement per level (`prospector.1`, …), optionally hidden; the texts are the translation keys of the family. It works for players who are not logged in, because it never looks at sockets; an unlock is pushed as `achievement-unlocked` to the sockets the player has now, and `GET /api/v1/achievements` lists everything with progress. Events of a bot that is out of reach of its base arrive only as the summary of §11.2.1 and are not counted.

## 23.2 Initial set (illustrative; final list is content work)

| Achievement | Trigger |
| --- | --- |
| First steps | Deploy a base |
| Hello, world | Run a first script |
| Prospector | Scan N cells (tiers) |
| Mine! | Mine N units of any resource (tiers) |
| Fabricator | Craft a first module; assemble a first bot |
| Automator | Have N scripts running at once |
| Fixer | Repair N modules |
| Scavenger | Disassemble N modules; adopt a stale bot |
| Marksman | Hit N shots; destroy a first module of another player's bot |
| Cartographer | Know N cells of the map |
| Connected | Open a relay chain of N hops |
| Veteran | Keep a bot running for N days |
| Graduate | Complete the tutorial |
| First deal | Make a first sale or purchase on the market |
| Merchant | Complete N market sales or purchases (tiers); win an auction; sell an edition out |
| Generous | Send a first transfer that the recipient accepts |

Achievements are also readable through the public API (§22.1, scope `read`).
