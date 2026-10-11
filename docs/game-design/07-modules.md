[← Game design index](../GAME-DESIGN.md)

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
> your battery faster. ✅

## 7.2 Module catalog

Types defined in the shared interfaces: `engine`, `movement`, `weapon`, `mining`, `manipulator`, `drive` (disk), `processor`,
`wirelessAdapter`, `battery`, `storage`, `armor`, `scanner`, `generator`, `factory`, `gps`. The notes additionally
mention `memory` and `circute`.

| Module | Type key | Status | Grants | Notes |
| --- | --- | --- | --- | --- |
| **Scanner** | `scanner` | ✅ | `scan()` | Radius in cells, `delay` (cooldown) between scans (ms). Each scan costs ops and energy and returns a **snapshot** stamped with `seenAt` (§4.2); it can also run in **live (continuous) mode** (`enable()` / `disable()`), keeping its radius live for energy only (§4.4). The two modes are mutually exclusive per module: `scan()` is refused with `BUSY` while the scanner is live. |
| **Weapon** | `weapon` | ✅ | `shoot()`, `aim()`, `reload()` | `damage`, `caliber`, `distance`, `accuracy`, `cooldown`, optional `batchSize`/`batchCooldown`, `isArtillery`. The rules (`aim`, `shoot`, `reload`, hit chance, damage vs armor) are implemented as pure `Result`-returning domain rules; the shot itself is applied by the engine. |
| **Engine** | `engine` | 🔴 | `move()`, `turn()` | `engineType` (fuel/steam/electric), `speed`. |
| **Wheels / Tracks** | `movement`* | 🟡 | movement support | `loadCapacity`; chosen chassis affects speed and terrain. |
| **Drill** | `mining` | 🔴 | `dig()` / `mine()` | `materialPerOperation`. |
| **Manipulator** | `manipulator` | 🔴 | `pick()` / `take()`, `drop()` | `loadCapacity`; grabs loose items/cells. |
| **Battery** | `battery` | 🟡 | power storage | `capacity`, `voltage`, `value`, `isConnected`; drains via `idleCost`/`operationCost`. |
| **Generator** | `generator` | 🟡 | `enable()`, `disable()` | `energyPerOperation`, `delay`. |
| **Storage** | `storage` | 🟡 | `store()` + take/drop actions | Box for ammo, mined resources, or any items. `capacity`, `items[]`. |
| **Memory (drive)** | `drive` | 🟡 | `read()`, `write()` | ✅ The code's `drive` module *is* the memory module: a disk with a byte quota and `readDelay`/`writeDelay`. Holds scripts and data (§11.4). |
| **Processor** | `processor` | 🔴 | `runCode()` / `execute()` | Defines `opsPerTick` and `parallelExecutions` (§12.2.1). The performance gate for scripts. |
| **Wireless adapter / control block** | `wirelessAdapter` | 🟡 | `connect()`, `disconnect()`, `sendMessage()` | Radio + OS. Required for remote connection to a bot. Its id *is* the bot's id. |
| **Armor** | `armor` | 🟡 | damage resistance | `material`. |
| **Factory** | `factory` | 🟡 | crafting | Present on the base and in the kit. |
| **GPS** | `gps` | 🔴 | `getLocation()` | Absolute position readout. |
| **Market terminal** | `marketTerminal` | 🔴 | `market.*` | ✅ Single class, no upgrades; remote access to the market from anywhere (§26.2). |
| **Repair ("fixing") module** | `repair` | 🔴 | `repair(target)`, `disassemble(target)` | ✅ Used on a module of a bot on an **adjacent cell**; see §8.4.2. Required to restore a corpse base. |

\* The codebase models the chassis as `IMovementModuleProps`; the notes call this "колёса/гусеницы". (`drive` in the
code is the **disk**, not the chassis.)

## 7.3 Module instances & classes

Modules are instances of `Module` subclasses (`ScannerModule`, `WeaponModule`, …), one class per type, registered in the `ModuleRegistry`. ✅ Each class types its props and holds the pure rules of its type that answer with a `Result` (§10.3); the calls that touch the world are executed by the engine. ✅
The base class validates that a `type` is present and assigns props. Modules are persisted in the database
(a `modules` table) and linked to a bot by `botId`. ✅
