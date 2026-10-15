[← Game design index](./GAME-DESIGN.md)

# 9. Resources, items & crafting

## 9.1 Resources

- **Resources** are naturally occurring cells (`MapPointType.RESOURCE`). Gold is the canonical example
  (`RESOURCE.GOLD`); iron is referenced by the armor module's `material`.
- ✅ **Deposits are finite and do not regenerate.** Each resource cell holds a fixed amount (set at generation); mining
  decrements it atomically and the cell becomes empty when it reaches zero. Amount ranges per resource are part of the
  resource balance config described below.
- **Items** are discrete objects (`MapPointType.ITEM`) that can be picked up, carried, dropped, stored in storage
  modules, or loaded as ammunition.
- ✅ **Resource set:** **gold**, **iron**, **oil/fuel**, **crystal**, **stone**, **wood**. Each has its own spawn
  weight, deposit amount range, mining hardness and crafting uses. The values live in a data-driven balance config
  (not hardcoded), so they can be tuned without code changes (`DEFAULT_RESOURCE_BALANCE` in `lib`, overridable per field through the JSON file named in `WORLD_RESOURCE_BALANCE_FILE`). Initial defaults (relative weight among resource cells):

  | Resource | Rarity | Initial spawn weight |
  | --- | --- | --- |
  | iron | common | 30 |
  | stone | common | 25 |
  | wood | common | 20 |
  | oil | uncommon | 12 |
  | crystal | uncommon | 9 |
  | gold | rare | 4 |

  The overall chance that a newly generated cell is a resource cell stays a single configurable value (currently 20 %).
- ✅ **Oil is also the generator fuel** (§12.5; the starter base runs on a solar panel instead, §7.2.1, so oil becomes a deliberate upgrade): bots burn it from their storage to make energy, so moving oil to where bots
  work is part of logistics.

## 9.2 Extraction

| Action | Module | Description |
| --- | --- | --- |
| `dig()` / `mine()` | drill (`mining`) | Extract `materialPerOperation` resources from the cell into cargo |
| `pick()` / `take()` | manipulator | Pick up an item |
| `drop()` | manipulator | Drop a carried item onto the current/adjacent cell |

## 9.3 Crafting

Crafting happens at the **factory** and requires:
1. a **blueprint** for the target module,
2. the **resources** the recipe demands,
3. sufficient **energy/time** for the factory operation.

Craft flow: `Factory GUI → Craft table → Assemble` (from the notes). ✅ Recipes are **data-driven**: they are `DEFAULT_RECIPES` in `lib`, overridable per module (and the research/loot numbers) through the JSON file named in `CRAFTING_RECIPES_FILE`, and validated at startup (every catalog module has exactly one recipe, a class above 1 has the class below it); a bad file stops the start. Known blueprints are stored per player (`blueprints`: the base set is class 1 and needs no row); blueprint items are rows of `items`, carried by a bot or lying on the map. They are not in game logic, so costs and craft times can be tuned without code changes. The table below
is the set of **initial defaults — balance TBD**, to be tuned after playtesting once energy, mining and processor rules
are settled:

| Module | Blueprint | Resources | Craft time |
| --- | --- | --- | --- |
| Scanner class 1 | ✅ base set | e.g. 20 iron, 5 crystal | 10 s |
| Weapon class 1 | default | 50 iron | 20 s |
| Engine class 1 | default | 30 iron, 10 oil | 15 s |
| Wheels/Tracks class 1 | default | 25 iron | 10 s |
| Drill class 1 | default | 40 iron, 10 crystal | 20 s |
| Battery class 1 | default | 20 iron, 15 crystal | 15 s |
| Storage class 1 | default | 30 iron | 10 s |
| Memory class 1 | default | 10 crystal | 10 s |
| Processor class 1 | default | 25 crystal, 10 gold | 25 s |
| Remote-control block | default | 15 crystal, 20 gold | 20 s |
| Market terminal | default | 40 iron, 20 crystal, 15 gold | 20 s |

- ✅ Blueprints are acquired from **three sources** (mixed model):
  1. **Base set** — class-1 blueprints are known from the start.
  2. **Research** — the factory can research higher classes by spending resources and time.
  3. **Found / looted** — blueprints exist as rare **items** in the world and can also drop as **loot** from destroyed
     bots and bases (corpse bases included), which makes PvP raiding rewarding.

  ✅ **Details** (all numbers tunable config):
  - **Research:** at the factory, costs **5× the target recipe's resources** and **10× its craft time**; the result is
    permanently known by the player.
  - **World blueprints:** blueprint **items** spawn on about **1 %** of newly generated empty cells, with a random module
    type and class.
  - **Loot:** disassembling a module (§8.4.2) has a **10 %** chance to also yield a blueprint item for that module's
    class (reverse engineering). Corpse bases drop none.
  - **Learning:** a blueprint item is **consumed** when used (`learn`) and the knowledge is then permanent. Until used it
    is an ordinary item: it can be carried, stored, dropped and traded between players.
  ✅ Implemented: `MapGenerator` puts a blueprint item (a map point of type item) on `worldBlueprintChance` of new empty cells, for a random module of class 2 or above (class 1 is the base set); `MaintenanceService.disassemble` gives the blueprint of the module with `lootBlueprintChance`, never from a corpse base, into the inventory of the bot that took it apart; `learn` takes a blueprint item carried by the base or by one of its bots (until bots can bring items home with the manipulator, phase 5).
- Crafting, assembly and research are exposed to the Factory GUI, to terminal commands (`craft`, `assemble`, `research`) and to scripts (`craft()`, `assemble()`, `research()`). 🔴
