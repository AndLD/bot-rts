[← Game design index](../GAME-DESIGN.md)

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
| **Corpse base** | A base whose owner has lost control (no working wireless adapter). It stays on the map and can be repaired (§6.3). |
| **Stale bot** | A bot whose base is a corpse base; it has no active owner, keeps running, and can be adopted by anyone with access (§6.3, §11.2.2). |
| **Adopt** | Re-assign a bot to the base the connection came from, after authenticating on it (§11.2.2). Bases cannot be adopted. |
| **Engine** | The single authoritative game process: tick loop, world state, QuickJS script contexts, and the only writer of world data (§12.2.2, §14.2). |
| **Result** | The `{ ok, data }` / `{ ok: false, code, msg }` object returned by every script API call (§10.3). |
| **Game event** | A typed fact emitted by the engine each tick (moved, shot, mined, …) that feeds animations, achievements and notifications (§24.1). |
| **Spawn seed** | A shareable code that lets several players deploy their bases near each other (§22.3). |
| **Achievement** | A recognition badge unlocked by in-game progress; no gameplay rewards (§23). |
