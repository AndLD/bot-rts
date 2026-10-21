[← Game design index](./GAME-DESIGN.md)

# 6. The Base

The base is a `BOT_TYPE.BASE` bot with an immobile, defensive, industrial loadout — *"non-movement highly armored
factory bot with a simple gun to defend itself with a simple scanner to track nearest locations."*

## 6.1 Starting loadout

Deploying a base attaches the starter kit.

| Module | Type | Key stats | Role |
| --- | --- | --- | --- |
| `gun-class1` | weapon | dmg 50, accuracy 0.5, range 5, cooldown 2000 ms, caliber 25 | Self-defense |
| `scanner-class1` | scanner | radius 1, delay 250 ms | Track nearest cells |
| `factory-class1` | factory | operationCost 40 | Craft modules and assemble bots |
| `armor-class1` | armor | material iron, weight 45 | Survive attacks |
| `battery-class1` | battery | 12 V, capacity 3000, value 3000 | Energy buffer |
| `solar-panel-class1` | solarPanel | 2 energy per 250 ms cycle at full sun (8 per second at its peak), burns nothing (§7.2.1) | Keep the base alive on the sun |
| `storage-class1` | storage | capacity 200, holds items; starts with the starter resources below (195 of 200) | Store mined resources and generator fuel |
| `processor-class1` | processor | 2 ops/tick, 1 parallel execution (§12.2.1) | Run the base's scripts |
| `memory-class1` | drive (memory) | 64 KB quota, one drive | Store the base's scripts and data |
| `wireless-adapter-class1` | wirelessAdapter | range 20 cells (§11.2.1) | Identity (the base id) and terminal link |

The starter kit has `solar-panel-class1` (§7.2.1) **instead of** `generator-class1`, so a fresh
base keeps itself alive under a light duty: with the oil generator only, the idle drain (about 2.6 energy per second for the
starter modules) would use up the 50 oil of the starter storage within minutes and the base would go dark. The oil generator
stays craftable (§9) as the strong but manual option.

The starter kit **includes a class-1 processor, memory and wireless adapter**, so the base follows the same rules as
every other bot (no special-cased "root OS"). Players upgrade or craft better ones later. The `circute` module from the
notes remains undefined (Q7). 
### Starter resources

A new base cannot mine (the starter kit has no drill, and only a drill extracts resources), so its storage is filled when the
base is deployed. The deposit is part of the engine's deploy-base command (§14.2), never written by the API directly. It covers
the tutorial path of §16.1, **the first craft and the first assembly**, and a small margin; the amounts are the balance
configuration `DEFAULT_STARTER_RESOURCES` (`lib/utils/interfaces/crafting.ts`), next to the recipes of §9.3:

| Resource | Amount | What it is for |
| --- | --- | --- |
| iron | 50 | the first craft, wheels (25) or an engine (30), and the battery (20) of the first bot; 5 spare |
| crystal | 60 | the processor (25), the wireless adapter (15) and the battery (15) of the first bot; 5 spare |
| gold | 35 | the processor (10) and the wireless adapter (20) of the first bot; 5 spare |
| oil | 50 | generator fuel, and the 10 oil of an engine (§9.3) |

A legal bot needs a processor, a wireless adapter and a battery (§8.2), so the first assembly costs 20 iron, 55 crystal and
30 gold at the recipes of §9.3. The deposit takes 195 of the 200 places of the starter storage, so the capacity stays as it is.
Only the storage of a deployed base is filled: a storage module crafted later starts empty. The amounts are tuned together with
the recipes (Q1).

## 6.2 Base capabilities

- **Crafting** — with the factory module and the right blueprint, turn resources into modules.
- **Assembly** — combine modules into a new bot.
- **Bot registry** — the base's bots are the bots whose `baseId` is this base (§8.1); the player sees them as a list. Stale
  bots (§6.3) are in no registry.
- **Root terminal** — the base's own terminal, from which the player `connect`s to any bot whose control block is
  reachable.
- **Defense** — the base's gun engages threats automatically per its script/AI.
- **Storage** — the base's storage module is the primary depot for mined resources.

## 6.3 Base destruction: corpse base

A **corpse base** is a base **the owner has lost control over**. It is a derived state, not a hit-point threshold:
the owner has control only while the base has a working **wireless adapter** (the link used to `connect`). When that
adapter is broken or missing (or the base has no modules left) the base is a corpse for its owner. A corpse base is never restored: a broken adapter is below the repair threshold, so it can only be disassembled (§8.4.1). A broken processor alone makes the base *crippled*
(no scripts) but not a corpse. A corpse base is **not removed** from the map; its cell shows it as a corpse base:

- The corpse keeps the **owner's name** (it stays visible to everyone who has scanned it).
- The owner **can no longer manage it**: no terminal, no factory, no storage access, no crafting.
- The owner's only option is to **deploy a new base** (a fresh starter kit at a new location; the Deploy button reappears).
- **Bots of the old base become stale**: their `baseId` still points to the corpse base, which no longer counts as a living
  owner, so a stale bot has **no active owner** and is *not* automatically affiliated with the player's new base.
- **Stale bots keep running** their scripts (energy limits stop them naturally when the battery empties); they are in no
  base registry, so they do not appear in `list`. There is no time-based decay.
- **Re-adopting stale bots:** *anyone* — including the former owner — who gets access to a stale bot (reaching it with
  a wireless link and bypassing or knowing its password, §11.2.2) can run `adopt` and assign it to **their own base**.
- **A corpse is not restored.** The wireless adapter of a corpse base is broken (condition 0), and a module below the repair
  threshold can only be disassembled (§8.4.1, §8.4.2). Only a base whose adapter still works is the owner's, so the one-living-base
  rule (§5) never meets a second, restored base. What is left of a corpse is its loot: any bot with a repair module may take
  its broken modules apart, and the former owner may take all of it apart (§8.4.2).
