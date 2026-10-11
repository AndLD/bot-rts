[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 4 — Module system & crafting (70 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-4-log](./work-logs/phase-4-log.md)

Flesh out the module ecosystem and the crafting/factory loop.

| # | Task                                                                                                | SP | Status |
| --- | -------------------------------------------------------------------------------------------------- | -- | --- |
| 4.1 | Module behavior classes behind `IModule*` interfaces with `Promise<Result<T>>` signatures (the `Result` / `ErrorCode` types live in `lib`, design §10.3; the callback-style interfaces are replaced): `EngineModule`, `MiningModule` (drill), `MovementModule` (wheels/tracks), `DriveModule` (memory/disk), `BatteryModule`, `StorageModule`, `GeneratorModule`, `ProcessorModule`, `WirelessAdapterModule`, `GpsModule`, `FactoryModule`, `ArmorModule` | 15 | ✅ |
| 4.2 | `WeaponModule.shoot`/`aim`/`reload` per the combat model (design §12.6) and `ScannerModule` polish (range, delay, energy cost); scans are snapshots stamped with `seenAt`, with cooldown, ops and energy costs, and action results refresh the touched cell (design §4.2); the scanner's live (continuous) mode next to the one-time scan, mutually exclusive per module (`enable()` / `disable()`, `scan()` returns `BUSY` while live, area-scaled energy cost, `view()`; the live-area machinery is task 5.12) | 7 | ✅ |
| 4.3 | Energy accounting per design §12.5 (idle and operation drain, battery clamp, generator refill, out-of-energy state; running executions suspend on it once the runtime exists, 5.4); generators burn oil from the bot's storage and stop without fuel; a live scanner that cannot pay for a refresh switches itself off (`LiveScanStopped`); the base starts with 50 oil | 6 | ⬜ |
| 4.4 | Blueprint + crafting model per design §9.3: data-driven recipes config validated at startup, per-player known blueprints, blueprints as lootable items | 5 | ⬜ |
| 4.5 | Bot assembly per design §8.2 (required-module validation) and the movement rule of §8.5 | 5 | ⬜ |
| 4.6 | Crafting API + sockets (`craft-module`, `assemble-bot`, `research-module`, `learn-blueprint`) with authorization checks; matching terminal commands and script-API functions (design §9.3, §10.2, §11.1), all going through the command-handler interface (moved behind the engine in 5.5) | 8 | ⬜ |
| 4.7 | Unit + integration + e2e tests for fabrication and maintenance through the terminal commands: craft, assemble (bot spawns adjacent), research and `learn`, repair and disassemble, restoring a corpse base, battery exhaustion; also weight / speed / capacity limits, assembly rejections (missing processor, adapter or battery, no free adjacent cell), broken-module effects (processor, memory, adapter), disassembly permissions; also generator out of fuel and a live scanner switching off when the battery runs dry | 9 | ⬜ |
| 4.8 | Repair ("fixing") module and corpse-base restoration by the owner's bots (adjacent-cell `repair`/`disassemble`, repair threshold, scrap yield, storage consumption/credit); stale-bot adoption is in 5.9 | 5 | ⬜ |
| 4.9 | Blueprint acquisition per design §9.3: factory research, blueprint items in the world, loot from disassembly, `learn` | 5 | ⬜ |
| 4.10 | Module condition lifecycle per design §8.4.1: broken-module effects per type, soft-deleted memory, module-less bots keep their record with `lastPosition` (the repair and disassembly operations are 4.8) | 5 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** modules are behavior-complete behind interfaces; a player can craft modules and assemble a bot,
with full test coverage.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/4.1-module-behaviours` | 4.1 | #61 | merged |
| `feature/4.2-weapon-scanner` | 4.2 | #62 | merged |
