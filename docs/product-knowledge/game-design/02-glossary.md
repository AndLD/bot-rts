[← Game design index](./GAME-DESIGN.md)

# 2. Glossary

| Term | Definition |
| --- | --- |
| **Base** | The player's home robot: immobile, heavily armored, with a factory, a simple gun, and a simple scanner. It stores resources, crafts modules, assembles bots, and hosts the root terminal. Created once per player at signup. |
| **Bot** | Any robot entity, including the Base. A mobile bot is assembled from modules. Ordinary bots belong to a **base** (`baseId`); only bases belong to a user (`userId`). |
| **Module** | A physical component (scanner, gun, engine, …) attached to a bot. Each module grants script functions and has physical stats. |
| **Control block** (remote-control block / wireless adapter) | The module that gives a bot an operating system, an identity, and the ability to be connected to remotely. A bot's **id is its control block id** and it is registered in the base. |
| **Processor** | Module that governs how much script throughput a bot gets (functions per tick, parallel executions). |
| **Memory** | The module that stores scripts and data; in the code it is the `drive` module. Each memory module is one drive with a byte quota (§11.4). |
| **Drive** | A storage volume (one memory module) presented in the terminal (`cd`, `ls`, `cat`, `edit`). |
| **Blueprint** | A recipe required to craft a given module. |
| **Tick** | The global simulation step. All scripts get a fair slice of each tick. |
| **Operation** | One call to a script API function (e.g. `move()`, `scan()`). Operations are the currency of the processor budget. |
| **Fog of war** | The per-player record of what that player knows about the map. Unexplored cells are black. |
| **Real map point** | The authoritative, shared map cell stored without a `userId`. |
| **User map point** | A per-player cached copy of a real point, used for fog of war. |
| **Terminal session** | One connection session between a player and a bot terminal, including all logs. Persisted to the database. |
| **BotOS** | The bot's operating system; provides the terminal and script runtime. |
| **Corpse base** | A base whose owner has lost control (no working wireless adapter). It stays on the map and cannot be restored: its wireless adapter is broken, and a broken module can only be disassembled (§6.3, §8.4.1). |
| **Stale bot** | A bot whose base is a corpse base; it has no active owner, keeps running, and can be adopted by anyone with access (§6.3, §11.2.2). |
| **Adopt** | Re-assign a bot to the base the connection came from, after authenticating on it (§11.2.2). Bases cannot be adopted. |
| **Power source** | A module that makes energy: the oil **generator** (burns oil, strong, manual) or the **solar panel** (no fuel, weak, follows the sun). §7.2.1. |
| **Sunlight factor** | The share of its peak output a solar panel makes at a time of day (night 0.1, morning and evening 0.6, day 1.0). §12.5.1. |
| **Game time** | The shared in-game clock: one in-game hour is one real minute, a day is 24 real minutes by default (an admin can change the day length and the time of day, or sync it to a real-world time zone). §12.5.1. |
| **Unpowered** | The state of a bot whose battery reached 0: it cannot spend energy and its link is down until the stored energy grows to the resume threshold (10). §12.5.2. |
| **Engine** | The single authoritative game process: tick loop, world state, QuickJS script contexts, and the only writer of world data (§12.2.2, §14.2). |
| **Result** | The `{ ok, data }` / `{ ok: false, code, msg }` object returned by every script API call (§10.3). |
| **Game event** | A typed fact emitted by the engine each tick (moved, shot, mined, …) that feeds animations, achievements and notifications (§24.1). |
| **Spawn seed** | A shareable code that lets several players deploy their bases near each other (§22.3). |
| **Credits** | The in-game currency, held in a per-player wallet (§26.1). |
| **Wallet** | An account of credits: one per player, plus the treasury and the custom wallets of the admins (§26.1). |
| **Treasury** | The game's own credits, in two parts: **main** (receives final fees, pays the system buyer and compensation refunds) and **pending trades** (fees of unfinished trades, the only source of fee refunds) (§26.1). |
| **System account** | An account of the game rather than of a player (`system: true`, no email or password), created and managed only in the admin console: the treasury, the pending-trades wallet, the system sink (§26.1). |
| **System sink** | The goods account that receives what the system buyer buys and from which the system seller sells, so goods are conserved (§26.1). |
| **Escrow** | Credits or goods locked by an open order, bid, listing or transfer offer until it settles or is cancelled (§26.7, §27.2). |
| **Inbox** | Per-player list of bought or received items awaiting withdrawal into a storage or a drive (§26.7, §27.3). |
| **Ledger** | The append-only double-entry record of every move of credits and traded goods (§26.1). |
| **Edition** | A script listed for sale as N copies; the seller keeps the original (§26.6). |
| **System trader** | The system buyer and the system seller, and the admin-edited rules and campaigns that decide what they trade, when, at which price and how much (§26.10). |
| **Market terminal** | The single-class module that gives remote access to the market (§26.2). |
| **Inbox** | A player's holding area for market purchases and accepted transfers (§26.7, §27.3). |
| **Achievement** | A recognition badge unlocked by in-game progress; no gameplay rewards (§23). |
