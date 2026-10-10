[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 3 — Core gameplay foundations (72 SP)

Establish the game-domain backbone the product notes describe (bases, bots, resources, map, storage).

| # | Task                                                                                                      | SP |
| --- | -------------------------------------------------------------------------------------------------------- | -- |
| 3.1 | Resource & item model (`Resource`, `Item`) in `lib` and the data-driven resource balance config, per design §9.1 | 3 |
| 3.2 | Map domain service refactor: extract map generation/reconciliation into a `MapService` with injected RNG/clock; add `MapPoint`/`Location` value objects | 8 |
| 3.3 | Add Mongo indexes (`bots.userId`, `map.location`, `map.contentId`, `map.userId`, `modules.botId`) and query helpers; map storage is sparse and unbounded (compound unique index on `{x, y}` for real points, negative coordinates supported) | 3 |
| 3.4 | Bot model + `BotRepository`/`BotService` (create from modules, list a base's bots) with the ownership change of design §8.1: ordinary bots carry `baseId`, only bases carry `userId`; update `IBot`/`IPostBot` in `lib` and migrate existing data | 5 |
| 3.5 | Terminal **session persistence**: store every connection session + logs to Mongo (per `notes.txt`), with a `TerminalSession` model/repository | 5 |
| 3.6 | Bot filesystem: `File`/`Drive` model and file CRUD with drive quotas and name validation, per design §11.4 | 8 |
| 3.7 | Base terminal commands end-to-end: server command parser + socket events for the command set in design §11.1, delivering its MVP core subset first (`help`, `ls`, `cd`, `cat`, `edit`, `rm`, `run`, `shell`, `top`, `kill`, `connect`, `list`, `modules`, `clear`, `exit`) | 13 |
| 3.8 | "Deploy your base" UI button + base-deployment confirmation flow, including setting the mandatory base access password | 5 |
| 3.9 | Module registry & factory for instantiating module classes by type (replaces the static `initialUserBaseModules`; the base starter kit now also includes class-1 processor, memory and wireless adapter) | 5 |
| 3.10 | Base destruction lifecycle per design §6.3: corpse base, redeploy of a new base ("one living base" rule), stale bots | 5 |
| 3.11 | `SpawnService`: base placement per design §4.1 (free cell, minimum distance, retries; replaces random `[0,10]²`), adjacent-cell spawn for assembled bots (§8.3), and spawn seeds per design §22.3 | 5 |
| 3.12 | `/api/v1` foundation per AGENTS.md §3.0 and design §22.1: Nest URI versioning for REST and a versioned Socket.IO namespace, existing endpoints moved under it, the official client switched to it, OpenAPI spec generated in CI, and a typed client generated from the spec (replacing hand-written RTK Query endpoints) | 7 |

**Exit criteria:** a user can deploy a base, open its terminal, manage files, and every command persists session logs
to Mongo — all covered by tests.
