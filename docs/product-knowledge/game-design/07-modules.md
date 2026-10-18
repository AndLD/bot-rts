[← Game design index](./GAME-DESIGN.md)

# 7. Modules

A module is a component you attach to a bot. It provides:
- **physical stats** — `condition`/`maxCondition` (HP), `weight`, `idleCost`, `operationCost`;
- **capabilities** — the script functions the bot may call.

## 7.1 Common module fields

Every module has these fields (`IModuleProps`):

| Field | Meaning |
| --- | --- |
| `_id` | module instance id |
| `botId` | owning bot |
| `type` | module type (see catalog) |
| `name` | blueprint name, e.g. `scanner-class1` |
| `condition` / `maxCondition` | current / maximum HP. At 0 the module is destroyed |
| `weight` | mass in kg — contributes to movement/chassis load |
| `operationCost` | energy/fuel consumed per operation |
| `idleCost` | energy/fuel consumed per tick while idle |

> **Hardware constrains software:** `operationCost` and the processor budget mean a heavier script literally drains
> your battery faster.

## 7.2 Module catalog

Types defined in the shared interfaces: `engine`, `movement`, `weapon`, `mining`, `manipulator`, `drive` (disk), `processor`,
`wirelessAdapter`, `battery`, `storage`, `armor`, `scanner`, `generator`, `factory`, `gps` `solarPanel`. The notes additionally
mention `memory` and `circute`.

| Module | Type key | Grants | Notes |
| --- | --- | --- | --- |
| **Scanner** | `scanner` | `scan()` | Radius in cells, `delay` (cooldown) between scans (ms). Each scan costs ops and energy and returns a **snapshot** stamped with `seenAt` (§4.2); it can also run in **live (continuous) mode** (`enable()` / `disable()`), keeping its radius live for energy only (§4.4). The two modes are mutually exclusive per module: `scan()` is refused with `BUSY` while the scanner is live. |
| **Weapon** | `weapon` | `shoot()`, `aim()`, `reload()` | `damage`, `caliber`, `distance`, `accuracy`, `cooldown`, optional `batchSize`/`batchCooldown`, `isArtillery`. The rules (`aim`, `shoot`, `reload`, hit chance, damage vs armor) are implemented as pure `Result`-returning domain rules; the shot itself is applied by the engine. |
| **Engine** | `engine` | `move()`, `turn()` | `engineType` (fuel/steam/electric), `speed`. |
| **Wheels / Tracks** | `movement`* | movement support | `loadCapacity`; chosen chassis affects speed and terrain. |
| **Drill** | `mining` | `dig()` / `mine()` | `materialPerOperation`. |
| **Manipulator** | `manipulator` | `pick()` / `take()`, `drop()` | `loadCapacity`; grabs loose items/cells. |
| **Battery** | `battery` | power storage | `capacity`, `voltage`, `value`, `isConnected`; drains via `idleCost`/`operationCost`. |
| **Generator** | `generator` | `enable()`, `disable()` | `energyPerCycle`, `fuelPerCycle`, `delay`; burns oil from the bot's storage (§12.5). A power source (§7.2.1). |
| **Solar panel** | `solarPanel` | `enable()`, `disable()` | `energyPerCycle`, `delay`; burns nothing, its output follows the sunlight of the time of day (§12.5.1). A power source (§7.2.1). Phase 11. |
| **Storage** | `storage` | `store()` + take/drop actions | Box for ammo, mined resources, or any items. `capacity`, `items[]`. |
| **Memory (drive)** | `drive` | `read()`, `write()` | The code's `drive` module *is* the memory module: a disk with a byte quota and `readDelay`/`writeDelay`. Holds scripts and data (§11.4). |
| **Processor** | `processor` | `runCode()` / `execute()` | Defines `opsPerTick` and `parallelExecutions` (§12.2.1). The performance gate for scripts. |
| **Wireless adapter / control block** | `wirelessAdapter` | `connect()`, `disconnect()`, `sendMessage()` | Radio + OS. Required for remote connection to a bot. Its id *is* the bot's id. |
| **Armor** | `armor` | damage resistance | `material`. |
| **Factory** | `factory` | crafting | Present on the base and in the kit. |
| **GPS** | `gps` | `getLocation()` | Absolute position readout. |
| **Market terminal** | `marketTerminal` | `market.*` | Single class, no upgrades; remote access to the market from anywhere (§26.2). |
| **Repair ("fixing") module** | `repair` | `repair(target)`, `disassemble(target)` | Used on a module of a bot on an **adjacent cell**; see §8.4.2. Required to restore a corpse base. |

\* The codebase models the chassis as `IMovementModuleProps`; the notes call this "колёса/гусеницы". (`drive` in the
code is the **disk**, not the chassis.)

### 7.2.1 Power sources

_The abstraction and both kinds (task 11.3);_ _the balance numbers and the starter kit (task 11.4)._ The modules that make energy are **power sources**: a `PowerSourceModule`
abstraction (cycle `delay`, `isEnabled`, `lastCycleAt`, `energyPerCycle`, `enable()` / `disable()`) with two kinds, so a new
kind can be added without touching the others.

| | Oil generator (`generator`) | Solar panel (`solarPanel`) |
| --- | --- | --- |
| Fuel | oil from the bot's storage, delivered by hand or by a logistics bot | none |
| Output | constant, **much stronger** (class 1: at least 5× the panel's peak) | scaled by the sunlight factor of the time of day (§12.5.1), weak |
| Running it | needs oil to be brought and a storage next to it: infrastructure or manual work | automatic and renewable |
| Role | the strategic upgrade of a growing base | the starter source that keeps a fresh base alive |

Balance rules (tunable numbers in the module catalogue, checked by a simulation test over a game day): the class-1 solar panel
alone sustains the idle drain of the starter base plus a basic duty (scanning, a few crafts and assemblies) over a full game
day, while continuous heavy work (mining, moving, shooting, live scanning) drains the battery faster than the panel renews it.

## 7.3 Module instances & classes

Modules are instances of `Module` subclasses (`ScannerModule`, `WeaponModule`, …), one class per type, registered in the `ModuleRegistry`. Each class types its props and holds the pure rules of its type that answer with a `Result` (§10.3); the calls that touch the world are executed by the engine.
The base class validates that a `type` is present and assigns props. Modules are persisted in the database
(a `modules` table) and linked to a bot by `botId`.
