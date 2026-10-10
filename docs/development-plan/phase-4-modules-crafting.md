[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 4 — Module system & crafting (59 SP)

Flesh out the module ecosystem and the crafting/factory loop.

| # | Task                                                                                                | SP |
| --- | -------------------------------------------------------------------------------------------------- | -- |
| 4.1 | Implement module behavior classes behind `IModule*` interfaces: `EngineModule`, `MiningModule` (drill), `DriveModule` (wheels/tracks), `BatteryModule`, `StorageModule`, `GeneratorModule`, `ProcessorModule`, `MemoryModule`, `WirelessAdapterModule`, `GpsModule`, `FactoryModule`, `ArmorModule` | 13 |
| 4.2 | `WeaponModule.shoot`/`aim`/`reload` per the combat model (design §12.6) and `ScannerModule` polish (range, delay, energy cost) | 5 |
| 4.3 | Energy accounting per design §12.5 (idle and operation drain, battery clamp, generator refill, suspend on empty battery) | 5 |
| 4.4 | Blueprint + crafting model per design §9.3: data-driven recipes config validated at startup, per-player known blueprints, blueprints as lootable items | 5 |
| 4.5 | Bot assembly per design §8.2 (required-module validation) and the movement rule of §8.5 | 5 |
| 4.6 | Crafting API + sockets (`craft-module`, `assemble-bot`, `research-module`, `learn-blueprint`) with authorization checks; matching terminal commands and script-API functions (design §9.3, §10.2, §11.1), all routed through engine commands | 8 |
| 4.7 | Unit + integration + e2e tests for crafting/assembly | 3 |
| 4.8 | Repair ("fixing") module and corpse-base restoration by the owner's bots (adjacent-cell `repair`/`disassemble`, repair threshold, scrap yield, storage consumption/credit); stale-bot adoption is in 5.9 | 5 |
| 4.9 | Blueprint acquisition per design §9.3: factory research, blueprint items in the world, loot from disassembly, `learn` | 5 |
| 4.10 | Module damage lifecycle per design §8.4.1: broken-module effects, repair threshold, disassembly, module-less bots keep their record with `lastPosition` | 5 |

**Exit criteria:** modules are behavior-complete behind interfaces; a player can craft modules and assemble a bot,
with full test coverage.
