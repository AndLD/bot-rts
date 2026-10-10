[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 4 — Module system & crafting (62 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-4-log](./logs/phase-4-log.md)

Flesh out the module ecosystem and the crafting/factory loop.

| # | Task                                                                                                | SP | Status |
| --- | -------------------------------------------------------------------------------------------------- | -- | --- |
| 4.1 | Module behavior classes behind `IModule*` interfaces with `Promise<Result<T>>` signatures (the `Result` / `ErrorCode` types live in `lib`, design §10.3; the callback-style interfaces are replaced): `EngineModule`, `MiningModule` (drill), `MovementModule` (wheels/tracks), `DriveModule` (memory/disk), `BatteryModule`, `StorageModule`, `GeneratorModule`, `ProcessorModule`, `WirelessAdapterModule`, `GpsModule`, `FactoryModule`, `ArmorModule` | 15 | ⬜ |
| 4.2 | `WeaponModule.shoot`/`aim`/`reload` per the combat model (design §12.6) and `ScannerModule` polish (range, delay, energy cost) | 5 | ⬜ |
| 4.3 | Energy accounting per design §12.5 (idle and operation drain, battery clamp, generator refill, out-of-energy state; running executions suspend on it once the runtime exists, 5.4) | 5 | ⬜ |
| 4.4 | Blueprint + crafting model per design §9.3: data-driven recipes config validated at startup, per-player known blueprints, blueprints as lootable items | 5 | ⬜ |
| 4.5 | Bot assembly per design §8.2 (required-module validation) and the movement rule of §8.5 | 5 | ⬜ |
| 4.6 | Crafting API + sockets (`craft-module`, `assemble-bot`, `research-module`, `learn-blueprint`) with authorization checks; matching terminal commands and script-API functions (design §9.3, §10.2, §11.1), all going through the command-handler interface (moved behind the engine in 5.5) | 8 | ⬜ |
| 4.7 | Unit + integration + e2e tests for crafting, assembly, research and repair/disassembly | 4 | ⬜ |
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
| _none yet_ | | | |
