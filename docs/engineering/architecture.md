[← AGENTS.md](../../AGENTS.md) · stack: [stack.md](./stack.md) · values: [profile](../profile.md)

# Architecture

The architecture decisions of this product that code must follow: the single owner of world state, the identity-provider
abstraction and the persistence isolation. The layering of the code and the rules per layer are in
[stack §2](./stack.md#2-architecture-and-layering); the product rules these decisions serve are in the
[game design](../product-knowledge/game-design/GAME-DESIGN.md). Read this file before changing authentication, persistence
or the engine boundary.

---

## 1. Identity provider abstraction

Authentication sits behind ports so the implementation can change (the current custom auth today; Clerk or another
provider later) without touching game code.

- **`IdentityVerifier` (application port, always required):** turns a bearer token into an `Identity`
  (`{ provider, subject, email, emailVerified }`). It is used by the HTTP guard, the WebSocket guard and the MCP/API
  layers. Nothing outside the identity adapters reads provider-specific tokens or claims.
- **`CredentialAuthService` (application port, only for providers whose credentials we manage):** register, login,
  refresh, logout, verify email, resend verification, request/perform password reset, change password, change email,
  delete account. The custom adapter implements it and exposes the `/api/v1/auth/*`
  endpoints. A hosted provider such as Clerk does these steps in the browser, so its adapter does not implement this
  port and those endpoints are not mounted.
- **Own user model:** the domain `User` (internal `userId`, name, roles, `active`/ban state) is separate from login
  credentials. Provider links live in an `identities` mapping `(provider, subject) → userId`. Custom-auth secrets
  (password hash, verification tokens) live only in the custom adapter's own table. Roles and bans are always
  checked against our database, never taken from the token.
- **Provisioning:** on the first verified identity, a `UserProvisioner` creates the `User` and the identity link (lazy
  creation); webhooks, if a provider has them, are only a backup.
- **Selection:** `AUTH_PROVIDER` (`local` by default) chooses the adapter in the auth Nest module's provider factory.
- **API keys** (third-party clients, MCP) are a separate authenticator that also resolves to an internal `userId`; a
  composite guard accepts a session token or an API key.
- **Client side:** the web client talks to an `AuthClient` interface (sign in, sign up, current token, sign out) with a
  `localAuthClient` implementation over the `/api/v1/auth/*` endpoints; a hosted provider would add its own
  implementation. Components use hooks only, never the provider SDK directly.
- **Tests:** a `FakeIdentityVerifier` for Jest, and a shared contract test suite that every adapter must pass.

## 2. Persistence isolation (PostgreSQL + Prisma)

The database is an implementation detail that must stay replaceable (clean architecture / DDD):

- **Prisma stays in `infrastructure`.** The Prisma schema, migrations, `PrismaClient` and the generated types live only in
  the persistence part of the infrastructure layer. They are never imported by `domain`, `application`, `presentation`,
  `engine` or `lib`; the import-boundary check ([stack §2.1](./stack.md#21-dependency-direction-dip)) enforces it.
- **Repositories map, ports are persistence-agnostic.** A repository takes and returns **domain entities**; the mapping
  between Prisma rows and entities happens inside the adapter. Port methods express domain intent (`findByEmail`,
  `listBotsOfBase`), not SQL or Prisma query shapes.
- **Ids are domain-owned strings (UUIDs).** No database-generated ids or Prisma types leak into entities or DTOs.
- **Transactions through a port.** Use cases that need atomicity use a `UnitOfWork` port implemented with Prisma's
  `$transaction`.
- **The engine persists through a `WorldStateStore` port** (batched upserts, one database transaction per flush). The
  adapter may use `createMany` or raw SQL for performance; that stays inside the adapter.
- **Migrations are code:** `prisma migrate` files are committed, applied migrations are never edited, and destructive
  changes follow an expand/contract plan.
- Replacing the database must mean rewriting the infrastructure adapters only.

## 3. The engine as the single owner of world state

The scalability exception is by design: the **engine** is the single authoritative in-memory owner of world state (persisted
to PostgreSQL by write-behind) and is reached only through a port (see
`docs/product-knowledge/game-design/12-real-time-execution-model.md` §12.2.2 and §14.2). The product rule it serves is the
single writer of world state (`AGENTS.md` §9).

## 4. Implementation notes of the game design

How the code carries out rules of the game design (`docs/product-knowledge/game-design/`). The design states what the game does; these notes
state how the engine, the API and the client do it. Each subsection names the design section it belongs to.

### Design §4.3 Map rendering

- Sprites come from a **free/open-licence top-down tileset** (the licence is recorded in the repo), packed into **one
  sprite atlas** with a JSON index, so the art can be swapped later without code changes. The atlas lives in the client
  assets.
- Rendering uses the plain **Canvas 2D API** with a **32 px** tile size.

### Design §4.4 Live vision

- **How it stays cheap (engine design, §12.2.2):** the engine already knows every cell that changes each tick, so live
  vision is a **subscription**, not polling. An index of live areas by map chunk lets the engine hand each changed cell to
  the players watching it; a quiet world costs nothing. A live cell's `seenAt` is kept in memory and written to the database
  only when the cell's content changes or the cell leaves the live area. Clients and scripts receive **diffs**. When a
  scanner's bot moves, only the cells at the edge of its area are updated. The engine keeps the map in chunks with an LRU
  cache and loads cold chunks from the database on demand.

**Implementation (Plan 5.12):** `LiveVision` in the engine keeps an index of the live areas by chunk; the cells that change in
a tick (`World.drainChanged`) are handed to the areas that cover them, the player's knowledge of those cells is updated at once,
and each area sends its changes as one `vision` event every scanner `delay` (rounded up to ticks). A new area looks at all its
cells, a moved one only at the cells that entered; a cell that leaves the live area, or whose scanner stops, is written as a
snapshot stamped with that moment, and another area of the same player that still covers it keeps it live. A live cell's
`seenAt` is the moment of the view, and it is written to the database only when the content changes or when the cell leaves
(`known_points` are staged in the write-behind buffer). The scanner pays its refresh through the energy tick (§12.5). After a
restart the bots with `isLive` scanners resume their vision. The map is held in memory in chunks, at most `ENGINE_MAX_CHUNKS`;
the least recently used chunk without unwritten changes is dropped first.

### Design §6.1 Starting loadout

Deploying a base attaches the starter kit (`STARTER_KIT` in `api/src/modules/domain/module-catalog.ts`, built by the `ModuleFactory` from the module catalog).

### Design §7.3 Module instances and classes

Modules are instances of `Module` subclasses (`ScannerModule`, `WeaponModule`, …), one class per type, registered in the `ModuleRegistry`. Each class types its props and holds the pure rules of its type that answer with a `Result` (§10.3); the calls that touch the world are executed by the engine.
The base class validates that a `type` is present and assigns props. Modules are persisted in the database
(a `modules` table) and linked to a bot by `botId`.

### Design §8.4.1 Module damage

*Implemented: a broken processor/adapter is checked by `canRunScripts` / `canConnect` (`bots/domain/capabilities.ts`; a terminal cannot be opened on a bot without a working adapter, `NO_SIGNAL`), a broken drive hides its files (`DRIVE_BROKEN`), the other modules refuse their actions with `BROKEN_MODULE`. A bot whose last module is taken apart keeps its record with `lastPosition`, its map cell becomes empty.*

### Design §8.4.2 Repair module

*Implemented (`RepairModule`, `MaintenanceService`, `POST /api/v1/bots/:botId/maintenance/repair | disassemble`, terminal `repair` / `disassemble`).* One operation per call with a cooldown (`delay`); a repair costs

### Design §10.1.1 Languages and imports

- **Transpiler:** a type-stripping transpiler behind a `Transpiler` interface (sucrase preferred, esbuild-wasm as the
  alternative; final choice in Plan 5.8). No type-check; transpile happens in the engine, outside the QuickJS context.

**Implementation (Phase 5).** `ModuleLoader` (engine) reads the entry file and, depth first, every file its compiled code
imports from the bot's drives (`ScriptSource`), before the execution starts; a failure is a `SCRIPT_LOAD_FAILED` error that
names the file, so the execution is never recorded. An import is a relative path (`./` or `../`) that stays on the drive;
without an extension the loader tries `.js`, `.ts`, `.json` in this order. A `.json` file becomes a module whose default export
is the parsed value. TypeScript goes through the `Transpiler` port, implemented by `SucraseTranspiler` (types stripped, ES
modules kept; as in TypeScript, an import used only as a type is dropped), cached by the hash of path and content (the
oldest entry goes first). QuickJS serves modules from the loaded set only, so a dynamic `import()` of anything else fails.
Limits: `ENGINE_MODULE_MAX_FILE_BYTES`, `_MAX_FILES`, `_MAX_DEPTH`, `_CACHE_ENTRIES`. The editor typings are generated from
the function catalog (`scriptTypings()` in `lib`); the in-game code editor does not use them yet because it is still a plain
text area, so wiring them into CodeMirror 6 is left to the client work (Q10).

### Design §11.2.1 The radio network

**Implementation (Plan 5.13):** `RadioNetwork` in the engine computes, per player, which bots of the living base reach it
(widest path: the chain whose weakest link is strongest, then the fewest hops) from the bots in memory — adapter online
(`isConnected`) and working, battery not empty, position, range. It is recomputed only for players whose bots moved or changed
their adapter or whether they have energy, on the next tick. A bot out of reach has a `lostSince` time; manual control of it
(terminal `open`, and every world-changing API action that names it) fails with `NO_SIGNAL`, and `getLinkStatus()` returns
`{ isConnected, signal, hops, weakestLink?, lostSince? }`. The engine emits `radio` events with only the bots whose bars or
connection changed and the game events `LinkLost`, `LinkRestored` (with a summary `missed: { scans, events, byType }`) and
`LinkWeak`. While a bot is out of reach the cells its `scan()` returns are kept in a buffer (newest 1,000, per cell the newest
sighting) instead of the player's map, and the events about it in another (newest 200); on `LinkRestored` the cells reach the
map with their original `seenAt` if newer than what the player knows. The bar margins and buffer sizes are `ENGINE_RADIO_*`
settings.

### Design §12.2.2 Threading topology

**MVP:** two threads.

- **API thread** — the NestJS app (HTTP + Socket.IO) only; never runs game logic or scripts.
- **Engine thread** — runs the tick loop, owns the world state, runs all QuickJS contexts, applies commands, and is the
  only writer to the database (batched write-behind, not one query per command).

Scripts never touch the world directly: an API call such as `move()` spends ops and **queues a command**, and the engine
applies all commands for the tick in the deterministic order (§12.4); results resolve the script's pending promises at
the start of the next tick.

**Pool-ready boundary:** command/result messages and a `ScriptRuntime` interface separate "run scripts" from "apply
commands", so QuickJS execution can later move to a worker pool (sharded by `botId`) or other processes without
changing game logic.

**Scaling:** there is **one authoritative engine process** for the whole world. The API tier scales horizontally;
the engine scales vertically. **Implementation (Plan 8.1):** a process runs with `APP_ROLE` `all` (API and engine
thread together, the default), `api` (HTTP and sockets only) or `engine` (owns the engine thread and answers the API nodes).
`api` nodes send the engine's requests over Redis (the same request/reply protocol as between the two threads) and the
engine node pushes events to the players' sockets through the Socket.IO Redis adapter, so a player's room spans every node.
Sockets hold no state beyond the player identified at the handshake, and the client uses the WebSocket transport only, so no
sticky routing is needed. There must be exactly one `engine` node (see `docs/operations/DEPLOYMENT.md`). The map is addressed in **chunks** so that sharding the world by region across several
engines remains possible later (backlog, §21), but it is not built now. If the engine process dies, the game pauses
until it restarts and reloads the world from the database.

**Live vision and map cache:** continuous scanning (design §4.4) is implemented as a subscription index of live areas by
chunk with batched diffs, and the world map lives in chunks with an LRU cache over the database.

### Design §12.3.1 Engine restart and crash recovery

- **Implementation (Plan 5.4a):** the database stores an execution as `active`, `finished` or `killed` with a restart
  counter; the finer states of §12.3 live only in the engine. A deliberate stop (`stop` message, graceful shutdown) resets
  the counters, an unclean one increments them when the execution is relaunched, and an execution that ran
  `ENGINE_HEALTHY_TICKS` ticks since its relaunch forgets them.

**Watchdog (Phase 5).** The engine thread writes the id of the execution it is about to step into a shared buffer and clears it
afterwards. The thread that supervises it looks at the buffer every `ENGINE_WATCHDOG_POLL_MS`; a step that has not moved for
`ENGINE_WATCHDOG_STALL_MS` (default 2 s, against a 5 ms slice) means the sandbox is stuck inside a builtin it cannot interrupt. The supervisor ends
the engine thread, marks that execution `killed` with the reason `stalled the engine` (the record is written while no engine is
alive, so the single-writer rule holds), tells the player in the script's log, and starts the next engine, which relaunches
the other executions as after any crash (§12.3.1). Load tests (`engine-load.test.ts`) keep ticks within their budget and serve
150 bots about equally, also with 20 scripts that never stop among 60 honest ones.

### Design §12.5.2 Power-on hysteresis

`isUnpowered` is a property of the battery (like `isLowReported`), set by the energy tick when the stored energy is 0 (also when an operation emptied it and a generator refilled it within the same tick) and cleared when the stored energy reaches `resumeThreshold` (`EnergyBalance`, default 10, never above the capacity). While it is set, `EnergyModel.isDepleted` is true and `available` is 0, so `spend` (every operation, factory and maintenance order, the live scanner), the weapon's energy check and the radio adapter's node all refuse.

### Design §14.2 Mechanisms

- **Implementation (Plan 5.5):** the engine holds the cells, bots and items in use in memory (`World`), loaded in chunks on
  demand, and applies the commands of a tick one after the other, so a cell a bot moved into is occupied for the next command
  and the loser gets `BLOCKED` / `EMPTY` / `GONE`. The order of a tick's commands does not depend on how they were collected:
  the bots take turns in a shuffle of their sorted ids seeded by `worldSeed` and the tick, and the commands of one bot go in
  the order of their execution and call numbers. Use cases that work on the database (scan, the factory, repairs) are called
  between a flush of the memory and an eviction of it; the eviction forgets the cells and the bots of the player the call ran for, not the bots of other players (Plan 12.1: otherwise every scan made every player's radio network be read from the database again).
- **The single writer for API requests (Plan 5.5):** with the engine switched on, the use cases that change the world — deploy
  a base, scan, craft / research / learn, assemble, repair / disassemble and the writes of files — are not run in the API
  process: the services the controllers, gateways and terminal commands get send them to the engine (`EnginePort.act`), which
  runs them between its ticks, after writing its memory and before forgetting it. Reads stay in the API process. With the engine
  switched off (the unit and integration tests, a build without game logic) the same services run the use cases themselves.

### Design §15.6 Window and HUD behaviour

Implementation: the default control window is 640 px wide, its inputs are a grid that shares the free width with at least 7 em each (14 em for the column), and a control window saved narrower than the new default is widened once (the layouts carry a version, `windows-layout-version`).

Implementation: `useStickyScroll` remembers from the last scroll event whether the reader was within 4 px of the end; a command the player types always follows.

Implementation: the Socket.IO client keeps one `Socket` and reconnects with a 1-5 s growing pause (the server puts it back in its player room on every connection); `SocketProvider` tells `lost` / `reconnecting` / `restored` (shown 4 s) to `ConnectionBanner` and, once back, invalidates every RTK Query tag so what is on screen is read again; a read that never reached the server is retried up to three times (never a request that changes something), and a failed re-read of the bases does not take the game off the screen; the map reloads on `connect`; each terminal opens a new stored session on its bot (the server closes sessions with the connection) and says so; windows live in Redux, so none is duplicated; the toasts listen on the same `Socket`, so they are not registered twice.

Implementation: `useGameTime` derives the time from `GET /api/v1/time` and the server-synced clock; `GameClock` shows `HH:MM · phase` in the top-right corner; `NightFilter` is a layer inside `MapCanvas` (under the cell inspector) with `pointer-events: none`, an opacity per phase and a 20 s linear fade.

### Design §23.1 Model

**Implementation (Phase 7).** `AchievementService` is a game-event consumer (§24.1) in the API process. It counts what the player's own events add to per-player counters (`cellsScanned`, `unitsMined`, `shotsHit`, `scriptRuns`, `cellsTravelled`, and the world orders the engine now reports as events: `BaseDeployed`, `CraftOrdered`, `BotAssembled`, `ModuleRepaired`, `ModuleDisassembled`, `BotAdopted`), keeps them in memory and writes them in batches every two seconds, and unlocks every achievement whose counter reached its threshold. The definitions are data (`api/src/achievements/domain/achievement-definitions.ts`): a family with a counter and a list of thresholds, one achievement per level (`prospector.1`, …), optionally hidden; the texts are the translation keys of the family. It works for players who are not logged in, because it never looks at sockets; an unlock is pushed as `achievement-unlocked` to the sockets the player has now, and `GET /api/v1/achievements` lists everything with progress. Events of a bot that is out of reach of its base arrive only as the summary of §11.2.1 and are not counted.

### Design §24.1 Game event bus

**Implementation (Phase 5).** Publishers (movement, mining, combat, scans, executions, energy, the radio network) put events
into an `EventOutbox` during the tick. After the commands and the radio refresh, `GameEventBus.deliver()` picks the audience of
each event: its `parties` (the players and bots it concerns) while the bot is connected, otherwise the event goes into the
per-bot buffer of §11.2.1 and arrives as a summary on reconnection; link events are always delivered; players whose live area
contains the event's `location` get it too. The engine thread hands each delivery to the API thread as `{ type: 'game' }`,
where `GameEventDispatcher` fans it out to its consumers, and `RealtimeGateway` pushes it to the player's sockets (room
`user:<id>`) as `game-event`, next to `radio-changes`, `vision`, `execution` and `script-log`. Animations, achievements and
notifications are such consumers, outside the tick path.

_Audited (Phase 11, task 11.1):_ every event type above is classified. The contract tests
(`energy-events.contract.test.ts`, and the lasting-link test in `radio-network.test.ts`) run a bot through hundreds of ticks in
an unchanged bad state (no oil, low battery, a live scanner without energy, an empty battery, a weak or lost link) and fail if any
event type fires more than once. A flapping link caused by the energy edge is removed by the power-on hysteresis (§12.5, task 11.5).
