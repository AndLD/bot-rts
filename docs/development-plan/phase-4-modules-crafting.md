[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 4 — Module system & crafting (59 SP)

Flesh out the module ecosystem and the crafting/factory loop.

| # | Task                                                                                                | SP |
| --- | -------------------------------------------------------------------------------------------------- | -- |
| 4.1 | Implement module behavior classes behind `IModule*` interfaces: `EngineModule`, `MiningModule` (drill), `DriveModule` (wheels/tracks), `BatteryModule`, `StorageModule`, `GeneratorModule`, `ProcessorModule`, `MemoryModule`, `WirelessAdapterModule`, `GpsModule`, `FactoryModule`, `ArmorModule` | 13 |
| 4.2 | Implement `WeaponModule.shoot`/`aim`/`reload` per the combat model (range/cooldown/ammo checks, seeded hit roll with accuracy falloff, armor-reduced damage to a random module, artillery splash) and `ScannerModule` polish (range, delay, energy cost) | 5 |
| 4.3 | Energy accounting: per-tick `idleCost` drain for every module + `operationCost` per action, battery clamped to `[0, capacity]`, generator refill per `delay` capped at capacity, suspend executions on empty battery | 5 |
| 4.4 | Blueprint + crafting model (recipes loaded from a data-driven recipes config with the initial default costs/times, validated at startup; `Blueprint` as a known-set per player and as a lootable item; craft module from resources; class-1 blueprints known by default) | 5 |
| 4.5 | Bot assembly: combine arbitrary modules → bot; validate required modules (processor, remote-control, power, movement); movement rule: `totalWeight <= chassis.loadCapacity`, `ticksPerCell = clamp(ceil(totalWeight / engine.speed), 1, max)` | 5 |
| 4.6 | Crafting API + sockets (`craft-module`, `assemble-bot`, `research-module`, `learn-blueprint`) with authorization checks; terminal commands `craft`/`assemble`/`research`/`learn` and matching script-API functions, all routed through engine commands | 8 |
| 4.7 | Unit + integration + e2e tests for crafting/assembly | 3 |
| 4.8 | Repair ("fixing") module and corpse-base restoration by the owner's bots (adjacent-cell `repair`/`disassemble`, repair threshold, scrap yield, storage consumption/credit); stale-bot adoption is in 5.9 | 5 |
| 4.9 | Blueprint acquisition: factory **research** of higher classes (cost/time), blueprint items placed in the world, and **loot** from disassembly (research 5× cost / 10× time, ~1 % world blueprint items, 10 % chance per disassembled module, `learn` consumes the item) | 5 |
| 4.10 | Module damage lifecycle: broken-module effects per type (processor → no scripts, memory → files soft-deleted/inaccessible, wireless adapter → no connections), repair above a threshold, disassembly into scrap (module removed from DB), module-less bots keep the record with `lastPosition` and no map reference (mechanics in GD §8.4.2) | 5 |

**Exit criteria:** modules are behavior-complete behind interfaces; a player can craft modules and assemble a bot,
with full test coverage.
