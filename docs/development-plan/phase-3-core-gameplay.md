[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 3 — Core gameplay foundations (72 SP)

Establish the game-domain backbone the product notes describe (bases, bots, resources, map, storage).

| # | Task                                                                                                      | SP |
| --- | -------------------------------------------------------------------------------------------------------- | -- |
| 3.1 | Define resource & item model (`Resource`, `Item`) in `lib` (resource cells carry a finite `amount`, no regeneration); resource generation probabilities per the notes; six resources (gold, iron, oil, crystal, stone, wood) defined in a data-driven balance config with per-resource spawn weights and amount ranges | 3 |
| 3.2 | Map domain service refactor: extract map generation/reconciliation into a `MapService` with injected RNG/clock; add `MapPoint`/`Location` value objects | 8 |
| 3.3 | Add Mongo indexes (`bots.userId`, `map.location`, `map.contentId`, `map.userId`, `modules.botId`) and query helpers; map storage is sparse and unbounded (compound unique index on `{x, y}` for real points, negative coordinates supported) | 3 |
| 3.4 | Bot model + `BotRepository`/`BotService` (create from modules, spawn near base, list a base's bots). **Ownership model change:** ordinary bots carry `baseId`, only bases carry `userId`; `IBot`/`IPostBot` in `lib` updated and existing data migrated | 5 |
| 3.5 | Terminal **session persistence**: store every connection session + logs to Mongo (per `notes.txt`), with a `TerminalSession` model/repository | 5 |
| 3.6 | Bot filesystem: `File`/`Drive` model where each memory (`drive`) module is a drive with a byte quota and read/write delays; file CRUD (create/edit/rm with `*.js`/`*.ts`/`*.json`/`*.txt` validation); writes past the quota fail | 8 |
| 3.7 | Base terminal commands end-to-end: `ls`/`dir`, `cd`, `mkdir`, `cat`, `edit`, `rm`, `run`, `shell`, `top`, `kill`, `ping`, `help` (server command parser + socket events); MVP core subset first (`help`, `ls`, `cd`, `cat`, `edit`, `rm`, `run`, `shell`, `top`, `kill`, `connect`, `list`, `modules`, `clear`, `exit`) | 13 |
| 3.8 | "Deploy your base" UI button + base-deployment confirmation flow, including setting the mandatory base access password | 5 |
| 3.9 | Module registry & factory for instantiating module classes by type (replaces the static `initialUserBaseModules`; the base starter kit now also includes class-1 processor, memory and wireless adapter) | 5 |
| 3.10 | Base destruction lifecycle: destroyed base → **corpse base** (cell keeps owner name, owner loses control), allow redeploy of a new base, mark the old base's bots **stale** (their `baseId` points to a corpse base, so they have no active owner and are not in any registry; scripts keep running); relax the one-base rule to "one living base" | 5 |
| 3.11 | `SpawnService`: base placement on a free cell ≥ `minBaseDistance` (30) from all bases/corpses inside a growing ring, with retries and an occupancy check (replaces random `[0,10]²`); adjacent-free-cell spawn for assembled bots; **spawn seeds**: seed codes created/entered in the Deploy dialog, anchor from the first deploy, spawn within a 12-cell radius with the 30-cell exemption only among same-seed bases, max 8 players, 24 h expiry | 5 |
| 3.12 | `/api/v1` foundation: Nest URI versioning (`/api/v1`) for REST and a versioned Socket.IO namespace; OpenAPI via `@nestjs/swagger`, existing endpoints moved under `/api/v1`, official client switched to it (JWT session auth), OpenAPI spec generated from controller/DTO definitions in CI, and a typed API client for the web client generated from it (replacing hand-written RTK Query endpoints); rule: no private client endpoints | 7 |

**Exit criteria:** a user can deploy a base, open its terminal, manage files, and every command persists session logs
to Mongo — all covered by tests.
