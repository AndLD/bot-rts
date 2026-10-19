[← Game design index](./GAME-DESIGN.md)

# 2. Glossary

One row per concept: the **term** is the name the design uses, the **code name** is how the code names it (`–` where the concept has no code name), and the **aliases** are other names a reader may meet; the design uses the term. A name belongs to one concept only (the documentation check fails on a repeated name).

| Term | Code name | Aliases | Definition |
| --- | --- | --- | --- |
| **Base** | `base` (bot type) | home base | The player's home robot: immobile, heavily armored, with a factory, a simple gun, and a simple scanner. It stores resources, crafts modules, assembles bots, and hosts the root terminal. Created by **Deploy**, once per player at a time (§5, §6.3). |
| **Bot** | `bot` | – | Any robot entity, including the Base. A mobile bot is assembled from modules. Ordinary bots belong to a **base** (`baseId`); only bases belong to a user (`userId`). |
| **Module** | `module` | – | A physical component (scanner, gun, engine, …) attached to a bot. Each module grants script functions and has physical stats. |
| **Wireless adapter** | `wirelessAdapter` | control block, remote-control block | The module that gives a bot an operating system, an identity, and the ability to be connected to remotely. A bot's **id is the id of its wireless adapter** and it is registered in the base. |
| **Processor** | `processor` | – | Module that governs how much script throughput a bot gets (functions per tick, parallel executions). |
| **Drive** | `drive` | memory, memory module | A storage volume that holds scripts and data: one `drive` module, with a byte quota (§11.4). The terminal presents it for `cd`, `ls`, `cat` and `edit`. |
| **Blueprint** | `blueprint` | – | A recipe required to craft a given module. |
| **Tick** | `tick` | – | The global simulation step. All scripts get a fair slice of each tick. |
| **Operation** | `ops` | op | One call to a script API function (e.g. `move()`, `scan()`). Operations are the currency of the processor budget. |
| **Fog of war** | `knownPoint` (the player's layer) | – | The per-player record of what that player knows about the map. Unexplored cells are black. |
| **Real map point** | `mapPoint` | – | The authoritative, shared map cell stored without a `userId`. |
| **User map point** | `knownPoint` | – | A per-player cached copy of a real point, used for fog of war. |
| **Terminal session** | `terminalSession` | session | One connection session between a player and a bot terminal, including all logs. Persisted to the database. |
| **BotOS** | – | – | The bot's operating system; provides the terminal and script runtime. |
| **Corpse base** | `corpse_base` (map point type) | – | A base whose owner has lost control (no working wireless adapter). It stays on the map and cannot be restored: its wireless adapter is broken, and a broken module can only be disassembled (§6.3, §8.4.1). |
| **Stale bot** | – | – | A bot whose base is a corpse base; it has no active owner, keeps running, and can be adopted by anyone with access (§6.3, §11.2.2). |
| **Adopt** | `adopt` (command) | – | Re-assign a bot to the base the connection came from, after authenticating on it (§11.2.2). Bases cannot be adopted. |
| **Power source** | `PowerSourceModule` | – | A module that makes energy: the oil **generator** (burns oil, strong, manual) or the **solar panel** (no fuel, weak, follows the sun). §7.2.1. |
| **Sunlight factor** | – | – | The share of its peak output a solar panel makes at a time of day (night 0.1, morning and evening 0.6, day 1.0). §12.5.1. |
| **Game time** | `GAME_CLOCK` | – | The shared in-game clock: one in-game hour is one real minute, a day is 24 real minutes by default (an admin can change the day length and the time of day, or sync it to a real-world time zone). §12.5.1. |
| **Unpowered** | `isUnpowered` | – | The state of a bot whose battery reached 0: it cannot spend energy and its link is down until the stored energy grows to the resume threshold (10). §12.5.2. |
| **Engine** | `engine` (process) | game engine | The single authoritative game process: tick loop, world state, script contexts, and the only writer of world data (§12.2.2, §14.2). |
| **Result** | `Result<T>` | – | The `{ ok, data }` / `{ ok: false, code, msg }` object returned by every script API call (§10.3). |
| **Game event** | `GameEvent` | event | A typed fact emitted by the engine each tick (moved, shot, mined, …) that feeds animations, achievements and notifications (§24.1). |
| **Spawn seed** | `spawnSeed` | – | A shareable code that lets several players deploy their bases near each other (§22.3). |
| **Credits** | – | – | The in-game currency, held in a per-player wallet (§26.1). |
| **Wallet** | – | – | An account of credits: one per player, plus the treasury and the custom wallets of the admins (§26.1). |
| **Treasury** | – | – | The game's own credits, in two parts: **main** (receives final fees, pays the system buyer and compensation refunds) and **pending trades** (fees of unfinished trades, the only source of fee refunds) (§26.1). |
| **System account** | `system: true` | – | An account of the game rather than of a player (`system: true`, no email or password), created and managed only in the admin console: the treasury, the pending-trades wallet, the system sink (§26.1). |
| **System sink** | – | – | The goods account that receives what the system buyer buys and from which the system seller sells, so goods are conserved (§26.1). |
| **Escrow** | – | – | Credits or goods locked by an open order, bid, listing or transfer offer until it settles or is cancelled (§26.7, §27.2). |
| **Inbox** | – | – | A player's holding area for market purchases and accepted transfers; items wait there for withdrawal into a storage or a drive (§26.7, §27.3). |
| **Ledger** | – | – | The append-only double-entry record of every move of credits and traded goods (§26.1). |
| **Edition** | – | – | A script listed for sale as N copies; the seller keeps the original (§26.6). |
| **System trader** | – | – | The system buyer and the system seller, and the admin-edited rules and campaigns that decide what they trade, when, at which price and how much (§26.10). |
| **Market terminal** | `marketTerminal` | – | The single-class module that gives remote access to the market (§26.2). |
| **Achievement** | – | badge | A recognition badge unlocked by in-game progress; no gameplay rewards (§23). |
| **Deploy** | `bots.deployUserBase` (action) | deploy a base | The player's act of creating their base: a base bot with its starter kit on a free cell (§5, §6.1). Only a base is deployed; a bot is **assembled**. |
| **Assemble** | `assemble` | – | Combine module parts into a new bot at the factory of the base; the bot appears on a free cell next to the base (§8.3). A bot is assembled, never deployed. |
| **Spawn** | – | – | Where a new entity first appears: a base on the cell chosen by the base-spawn rule (§4.1), an assembled bot next to its base (§8.3). Not a verb for the player: the player deploys or assembles. |
| **Starter kit** | `STARTER_KIT` | starting loadout | The class-1 modules a base is deployed with (§6.1). |
| **Factory** | `factory` | – | The module that crafts modules from resources and a blueprint, researches higher classes and assembles bots (§9.3, §8.3). Present on the base. |
| **Battery** | `battery` | – | The module that stores a bot's energy up to its capacity; every module pays from it (§12.5). |
| **Class** | `-class1`, `-class2`… (module name) | module class | The tier of a module: class 1 is the base set that needs no blueprint, a higher class needs a blueprint and research (§9.3). |
| **Cell** | `IMapCell` | map cell | One square of the grid: coordinates, an optional entity or resource, and when the player last saw it (§4.1, §4.3). |
| **Chunk** | `chunk` | – | A square block of `chunkSize` cells in which the map is stored, cached and indexed (§4.1, §12.2.2). |
| **Monitor** | – | map view | The canvas map screen of the player: sprites, fog of war, pan and zoom (§15). |
| **Radio range** | `range` (wireless adapter) | link range | The distance in cells within which two wireless adapters can link; two adapters link at the smaller of their ranges (§11.2.1). |
| **Link** | – | radio link | A connection between two working wireless adapters in range; a chain of links from the base makes a bot connected (§11.2.1). |
| **Live area** | – | – | The union of the squares kept up to date by the player's scanners in live mode; cells inside it show their current state (§4.4). |
| **Adjacent cell** | – | – | A cell next to a bot in the eight-neighbourhood; repairing, disassembling and mining act on adjacent cells (§8.4.2, §9.2). |
| **Seeded RNG** | `Rng` | seeded random function | The deterministic random generator of the engine; world generation, hit rolls and a script's `Math.random()` draw from it (§12.4, §10.2). |
| **Notification center** | – | – | The list of a player's notifications with unread count, preferences and mark-as-read (§24.2). |
| **Landing page** | – | – | The public marketing page of the game (§15.3). |
| **Blueprint item** | `item` of type blueprint | – | A blueprint lying on the map or carried by a bot; learning it makes its blueprint known to the player for good (§9.3). |
| **Repair threshold** | `repairThreshold` | – | The share of its maximum condition (20 % by default) below which a module can no longer be repaired and can only be disassembled; a broken module (condition 0) is below it (§8.4.1). |
| **Storage** | `storage` | storage module | The module that holds resources and items, with a capacity; mined resources go to the first one with room (§7.2, §9.2). |
| **Resource** | `RESOURCE` | – | A natural material of the world: gold, iron, oil, crystal, stone or wood. A deposit holds a finite amount; mining moves it into a storage (§9.1). |
| **Item** | `item` | – | A discrete object that can be picked up, carried, dropped or stored: a blueprint, ammunition, a module part (§9.1). |
| **Script** | `.js` / `.ts` file | – | A program of the player stored on a drive; running it starts an **execution** (§10.1). |
| **Execution** | `execution` | script run | One run of a script on a bot: queued, running, suspended, awaiting, finished or killed (§12.3). |
| **Trade** | – | – | Any exchange through the market: an order on the exchange, an auction, a bought script copy, a transfer offer (§26, §27.2). |
