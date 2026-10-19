[← Game design index](./GAME-DESIGN.md)

# 8. Bots

## 8.1 Anatomy

A bot is a set of attached modules plus an identity:

| Aspect | Source |
| --- | --- |
| **id** | the id of its activated **control block** (wireless adapter); what the id becomes when the adapter is replaced is open (Q12) |
| **label** | human-readable name, e.g. `"Alice base"` |
| **type** | `base` today; other bot roles later |
| **base (owner link)** | `baseId` — an ordinary bot belongs to a **base**, not to a user. Only **bases** carry a `userId`, so a bot's player is the owner of its (living) base. A base has no `baseId`. |
| **modules** | all attached module instances |
| **location** | derived from its map point (`contentId` = bot id) |

## 8.2 Assembly requirements

**Hard assembly rules:**

| Requirement | Modules | Applies to |
| --- | --- | --- |
| Run scripts | **processor** | every bot |
| Identity + remote link | **control block** (wireless adapter) | every bot |
| Power | **battery** | every bot |
| Mobility | **engine + chassis** (wheels/tracks) | only bots that must move; a bot without them is a legal stationary bot |

Optional: memory (drive), storage, weapon, drill, manipulator, scanner, armor, generator or solar panel (a power source, §7.2.1), GPS. A bot without memory
cannot store scripts but can still be driven remotely.

Assembly validates these rules and rejects physically impossible builds (including `totalWeight > chassis.loadCapacity`
for a mobile bot, §8.5; an engine without a chassis, or the reverse, is rejected too). Assembly happens at a working **factory** of the base, from the module **parts** the base holds; the parts are used up.

> **Future (backlog, §21):** a physical **port module** that lets a bot connect by "wire" to another bot or to the base
> without a wireless adapter. Until then the wireless adapter is mandatory.

## 8.3 Spawning

- On assembly, the bot spawns on a **free cell adjacent to the base** (the notes say "Бот спавнится рядом с базой");
  if no adjacent cell is free the assembly fails with an error.
- Its map point (`MapPointType.BOT`, `contentId = botId`) is written to the real layer.
- Its control-block id is registered in the base's bot registry.

## 8.4 Bot list

The player sees a base's bots as a simple **list** in the base UI (id, label, type), and can connect to any of them.
The terminal already exposes a `list` command backed by a socket event.

## 8.4.1 Module damage, disassembly and bot lifecycle

*Implemented: a broken processor/adapter is checked by `canRunScripts` / `canConnect` (`bots/domain/capabilities.ts`; a terminal cannot be opened on a bot without a working adapter, `NO_SIGNAL`), a broken drive hides its files (`DRIVE_BROKEN`), the other modules refuse their actions with `BROKEN_MODULE`. A bot whose last module is taken apart keeps its record with `lastPosition`, its map cell becomes empty.*

**A bot is never "dead".** Damage affects individual modules; the bot record persists.

- **Module at `condition` 0 is broken, not deleted.** It stays attached but stops working. Effects by type:
  - **processor** broken → the bot can no longer launch or run scripts;
  - **memory (drive)** broken → every script and file on it becomes inaccessible ("soft-deleted", not wiped). A broken drive is never repaired (below), so its files stay unreadable until the module is **disassembled, which deletes its files for good**;
  - **wireless adapter** broken → the bot can no longer accept or send connections;
  - other modules lose their own function (a broken weapon cannot shoot, a broken engine cannot move, …).
- **Repair:** a damaged module can be repaired by **another bot's repair ("fixing") module** only while its `condition` is at
  or above the **repair threshold** (default 20 % of `maxCondition`, tunable). Below the threshold, **condition 0 (broken)
  included**, it can no longer be repaired and can only be disassembled. So a broken module is lost, and a broken wireless
  adapter makes a base a corpse for good (§6.3). The modules of a living base at or above the threshold stay repairable.
- **Disassembly:** a module can be **disassembled** (by another bot's repair module, §8.4.2) into scrap metal /
  resources, if it is broken or belongs to the actor's own user. A disassembled module **disappears from the database**.
- **Bot without modules:** if all of a bot's modules are disassembled, the bot record is **kept** in the database, but
  it has only a **`lastPosition`** instead of an actual position, and its map cell no longer references the bot
  (the cell becomes empty).
- A base becomes a [corpse base](./06-the-base.md#63-base-destruction-corpse-base) when its owner loses control of it; loot is obtained by
  disassembly (mechanics: §8.4.2).

## 8.4.2 Repair module: repair and disassembly

*Implemented (`RepairModule`, `MaintenanceService`, `POST /api/v1/bots/:botId/maintenance/repair | disassemble`, terminal `repair` / `disassemble`).* One operation per call with a cooldown (`delay`); a repair costs a share (`repairCostFactor`, default 50 % for a complete repair) of the module's recipe resources from the repairer's storage plus the repair module's energy; disassembly yields a random 30–50 % of the recipe resources into the repairer's storage and is refused (`NO_SPACE`) when they do not fit.


One **repair ("fixing") module** provides both `repair(...)` and `disassemble(...)`. Both act on a module of a bot on an
**adjacent cell** (a bot cannot work on itself) and cost energy and time (ticks).

- **Repair** restores `repairPerOp` condition per operation and consumes scrap/resources from the repairer's storage.
  It works only while the target module's `condition` is at least `repairThreshold` (default 20 % of `maxCondition`,
  tunable); below that, a broken module (condition 0) included, the module can only be disassembled. A broken **memory**
  module stays unreadable, and disassembling it deletes its files (§8.4.1).
- **Disassembly** removes the module from the database and puts **30–50 % of its recipe resources** (tunable) into the
  repairer's storage as scrap. By default a module may be disassembled only if it is **broken (condition 0)** or it
  belongs to a bot of the actor's own user, so attackers cannot strip healthy modules from a bot that still works.
- Loot of **blueprints** from disassembled modules, bases and wrecks follows the blueprint rules in §9.3 (10 % chance per disassembled module; corpse bases drop none).
- Working on a module of a foreign bot does not require authentication (it is a physical action); repairing a foreign
  module is allowed.

## 8.5 Weight, speed and energy

**Movement:**

- `totalWeight` = sum of the `weight` of all attached modules.
- A bot can move only if it has an engine **and** a chassis (wheels/tracks) and `totalWeight <= chassis.loadCapacity`;
  otherwise `move()` fails with an error value.
- Moving one cell takes `ticksPerCell = clamp(ceil(totalWeight / engine.speed), 1, maxTicksPerCell)` ticks — a stronger
  engine or a lighter bot is faster. `maxTicksPerCell` and the exact curve are tunable config.
- Terrain has no effect on movement for now (terrain types are in the backlog, §21).

**Energy:** see §12.5 (idle drain per tick, operation drain per action, generator refill). A bot that runs out of
energy is unpowered; what that means, and when it resumes, is stated in §12.5.2.
