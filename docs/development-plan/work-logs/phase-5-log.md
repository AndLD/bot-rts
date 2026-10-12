[← Phase 5 — Script runtime, scheduler & sandbox](../phase-5-script-runtime.md)

# Phase 5 — Script runtime, scheduler & sandbox — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-12 — task 5.1: execution model RFC and benchmark spike
- **Tasks:** 5.1
- **Branch:** `feature/5.1-execution-model-rfc` — done
- **Decisions / deviations from the plan:** the RFC is `docs/development-plan/rfc-5.1-execution-model.md` (one QuickJS runtime + context per execution, tick phases, limits, write-behind every 10 ticks). Measured with `api/scripts/bench-runtime.ts`: ~100 KiB per context, ~0.1 ms per active bot per tick (~800 bots inside the 80 ms cap), 10,000 live areas cost 0.5 ms per tick to look up. `quickjs-emscripten` 0.32 added to `api`.
- **Next step:** task 5.2 (`ScriptRuntime` over QuickJS in `api/src/engine`).
- **Verify with:** `npm run docs:check && npx ts-node api/scripts/bench-runtime.ts 300`

### 2026-10-12 — task 5.2: QuickJS script runtime
- **Tasks:** 5.2
- **Branch:** `feature/5.2-quickjs-script-runtime` — done
- **Decisions / deviations from the plan:** new `api/src/engine` feature (domain / application / infrastructure). `ScriptRuntime` / `ScriptExecution` (application port) is a step-wise model: `step(sliceMs)` runs `main` and the ready continuations until the script waits, finishes or fails; game-API calls are recorded (`takeCalls`) and settled by the engine (`resolveCall` / `rejectCall`), so promises resolve at the next step as design §12.2.2 says. `QuickJsScriptRuntime` runs one QuickJS runtime + context per execution with a memory limit, stack limit and a wall-clock interrupt handler. A prelude builds the frozen `bot` object (identity + the whitelisted functions only, also as globals), seeds `Math.random` from the host, removes `Date` and keeps the bridge in a closure. Failures are typed (`ScriptFailureCode`: `SCRIPT_ERROR`, `SYNTAX_ERROR`, `NO_MAIN`, `TIME_LIMIT`, `MEMORY_LIMIT`). The stock QuickJS variant loads its WASM glue with a dynamic `import()` that Jest refuses, so the variant is rebuilt with a plain `require`. Which functions a bot gets (module gating) is task 5.3.
- **Problems / findings:** an interrupted script's error object must be read with the handler removed, otherwise reading it trips the deadline again and leaks objects (the runtime then aborts on dispose). A slice overrun kills the execution and memory bombs are throttled by GC, see RFC §4.
- **Next step:** task 5.3 (the predefined-function API layer over the module services with `Result<T>`).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.3: script API layer
- **Tasks:** 5.3
- **Branch:** `feature/5.3-script-api-layer` — done
- **Decisions / deviations from the plan:** the catalog of script functions is data in `lib/utils/script-api.ts` (name, granting modules as any-of, argument kinds, ops, `isScheduled` for `sleep`), shared by the engine and, in 5.8, the editor typings; `validateScriptArgs` checks calls. `ScriptApi` (`engine/application/script-api.ts`) is the router: unknown function / no granting module / invalid arguments throw `ScriptMisuseError` (the script's execution ends), everything else is a `Result`. It refuses to start unless every catalog function has a handler or is scheduled, so a task that adds catalog entries must add their handlers. Handlers are one class per module family over the existing use cases (`ScannerHandler`, `GpsHandler`, `FactoryHandler`, `MaintenanceHandler`, `DriveHandler`); errors that carry a result code become failure values, with a small map for `DRIVE_FULL`, `DRIVE_BROKEN`, `NO_FREE_LOCATION`, `ALREADY_EXISTS`, `BASE_LOST`. Authorization is the use cases' own: they act for the owner of the calling bot. The catalog currently holds only the functions that already have use cases; `move`, `dig`, `shoot`, … arrive with 5.5, live vision with 5.12, radio with 5.13, `execute` with 5.6, `connect` with 5.9. The service-backed handlers read and write the database; how that coexists with the engine's in-memory state (flush before, evict after) is decided in 5.4a.
- **Next step:** task 5.4a (engine thread: `worker_threads`, tick loop, command/result protocol, write-behind, overrun guard, durable execution records).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.4a: engine thread
- **Tasks:** 5.4a
- **Branch:** `feature/5.4a-engine-thread` — done
- **Decisions / deviations from the plan:** `EngineCore` (`engine/application`) is the engine: an inbox for requests (`start`, `kill`, `list`) served at the start of each tick, then per tick: settle the answers of the previous tick, run the executions in the order the `Scheduler` gives (stopping at `tickCapRatio × tickIntervalMs`), apply the collected game calls through `ScriptApi`, flush the write-behind buffer every `flushEveryTicks` ticks, record metrics (`overrunTicks`, `cutTicks`, p95 tick time; memory of the sandboxes on request). `LiveExecution` keeps the calls a script awaits apart from its sleeps. `Scheduler` has only `ArrivalOrderScheduler` for now; the fair scheduler is 5.4. Execution records are durable (`executions` table, enum `active | finished | killed`, restart counter); `recover()` relaunches active ones with a "rebooted" log line, kills those at `maxRestarts`, a deliberate `shutdown()` resets the counters, a healthy run forgets them. The engine runs in a `worker_threads` Worker with its own Nest application context (`EngineWorkerModule`, same use cases, own database connections); the link is JSON messages (`engine-protocol.ts`), the API side is `ENGINE_PORT` (`ChannelEnginePort`, `DisabledEnginePort`), and `EngineProcess` starts, stops and restarts the thread. `ENGINE_ENABLED` defaults to on, off in `NODE_ENV=test` (the engine integration test turns it on); all numbers are `ENGINE_*` env settings. The write-behind buffer (`WriteBehind`) is in place but nothing stages into it until the in-memory world arrives (5.5, 5.12); the service-backed handlers of 5.3 still write the database directly. No HTTP/socket/terminal entry points yet: `run`, `top`, `kill` are 5.6.
- **Problems / findings:** the first CI run of 5.2 showed that lint and the changed-file coverage gate matter per PR: a file with only a DI token and no tests counts as 0 %; tokens are added together with the module that uses them. A flaky Cypress run of the factory spec (a part was not shown in 4 s) passed on re-run.
- **Next step:** task 5.4 (the fair scheduler: per-bot op budget, seeded player shuffle, global cap with round-robin resume, parallelism and `queued`).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api` (the engine integration test needs the Docker PostgreSQL)

### 2026-10-12 — task 5.4: fair scheduler
- **Tasks:** 5.4
- **Branch:** `feature/5.4-fair-scheduler` — done
- **Decisions / deviations from the plan:** `FairScheduler` implements the `Scheduler` port: it admits the first `parallelExecutions` executions of each bot (the rest stay `queued`), shuffles the players with the generator for `seed ^ tick` and interleaves one execution per player per round (a deliberate departure from "player by player", which would let the first players use the whole cap); the executions left over by the tick cap are `deferred` and go first next tick. `capacityOf` (domain) sums the working processors (`opsPerTick`, `parallelExecutions`); `BotCapacities` holds it per bot, learned whenever the engine reads a bot's modules (launch and every applied call). The op budget is enforced where calls are applied: a FIFO backlog across ticks, a bot's calls pass up to `opsPerTick`, a call dearer than the budget takes a whole tick, budget 0 lets nothing through; the apply phase also stops at the cap and keeps the rest for the next tick. The `ArrivalOrderScheduler` of 5.4a is gone.
- **Next step:** task 5.5 (race-condition prevention: in-memory world, collect-then-apply with deterministic order, reservations, determinism tests).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.5, first half: in-memory world and deterministic apply
- **Tasks:** 5.5 (first of two branches; the single-writer routing of API requests is the second)
- **Branch:** `feature/5.5a-world-commands` — done
- **Decisions / deviations from the plan:** `World` (`engine/application/world`) is the engine's authoritative copy of what is in use: bots (modules, place, heading, carried items), cells in chunks (rolled on first touch with the world generator) and items, loaded through a `WorldSource` port (`RepositoryWorldSource` over the repositories) and changed in memory by one command at a time; changes are staged in the `WriteBehind` buffer, which now also carries items, item removals, bot headings and the amount of a deposit (`WorldStateBatch`, `PrismaWorldStateStore`). Bots got a `heading` (column, `CHECK 0..3`). New script functions (catalog in `lib`): `move`, `turn`, `dig`, `mine`, `pick`, `take`, `drop`, `aim`, `shoot`, `reload`, `enable`, `disable`, with the handlers `MovementHandler`, `MiningHandler`, `ManipulatorHandler`, `CombatHandler`, `PowerHandler` and a world-based `GpsHandler`; an action that takes game time answers after `delayTicks` (a move: cells × `ticksPerCell`) and keeps the bot busy meanwhile. `store` of the design table is dropped: mined resources go straight to a storage module and carried items need no box. Movement and combat numbers are `ENGINE_*` settings. The apply phase of `EngineCore` is now deterministic: bots take turns in a seeded shuffle of their **sorted** ids (the determinism test found that shuffling in collection order made the result depend on it), the calls of a bot go in (execution, call) order, every handler runs to the end before the next starts. The use cases that work on the database (`scan`, factory, repairs) run inside `SyncedHandler`: the memory is flushed first and evicted afterwards. The idle drain and generators of the bots in memory run every tick (`World.tickEnergy`); bots not in memory do not drain (lazy catch-up is an open point).
- **Tests:** determinism and conflict tests (`engine-determinism.test.ts`): four bots into one cell, two bots on one deposit, the same result for the same seed whatever the collection and start order, the winner varies with the seed; handler tests for every rule; the engine integration test now also moves a bot and reads the new place and heading from PostgreSQL.
- **Next step:** the second half of 5.5: route the world-changing API requests (deploy base, craft, research, learn, assemble, repair, disassemble, scan, file writes) through the engine as commands.
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.5, second half: the engine as the single writer
- **Tasks:** 5.5 (done with this branch)
- **Branch:** `feature/5.5b-single-writer` — done
- **Decisions / deviations from the plan:** instead of rewriting every controller, gateway and terminal command, the services they already get are wrapped: `routedThroughEngine(service, port, isEnabled, { method: 'service.method' })` returns an object that inherits the real service and replaces the world-changing methods by calls of `EnginePort.act(name, args)` (the services are stateless, so inheriting from the instance is safe). The wrapped methods are `BotsService.deployUserBase`, `ScanService.scan`, `FactoryService.craft` / `research` / `learn`, `AssemblyService.assemble`, `MaintenanceService.repair` / `disassemble` and `FilesService.write` / `makeDirectory` / `remove`; the list of action names (`WorldActions`, `WORLD_ACTION_NAMES`) is typed so a missing one does not compile. In the engine thread `EngineCore.act` queues the call like any request, then flushes the world, runs it through `WorldActionExecutor` (the table name → real use case) and evicts the world; a failure travels back as the same `AppError`. With `ENGINE_ENABLED=false` the services are returned unwrapped, so the unit and integration tests are unchanged. The engine thread's own context imports `EngineModule` (engine off there) so that it gets the real services. Latency of those requests is now up to one tick.
- **Known gap:** deleting an account removes its bases from the API process.
- **Next step:** task 5.12 (live vision), then 5.13 (radio), 5.10 (events), 5.6, 5.8, 5.9, 5.11, 5.7.
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.12: live vision
- **Tasks:** 5.12
- **Branch:** `feature/5.12-live-vision` — done
- **Decisions / deviations from the plan:** `LiveVision` (`engine/application/live-vision.ts`, rules in design §4.4 and in `docs/game-design/04-…`) is a subscription, not polling: `World` records the cells that changed in a tick (`drainChanged`), the index of live areas by chunk hands each one to the areas that cover it. The player's knowledge of a cell is kept in memory per player (loaded per chunk from `known_points`); a change is staged in the write-behind buffer at once, an unchanged live cell writes nothing, a cell that leaves the area or whose scanner stops is written stamped with that tick's time, and a cell still covered by another area of the same player stays live. Batches go out as `vision` engine events every scanner `delay`; `audienceAt(location)` is the lookup the event bus (5.10) will use. `enable(moduleId)` / `disable(moduleId)` now also switch scanners, `view(since?)` reads the live view (`NOT_LIVE` when the scanner is not live). Scripts can name modules: `bot.modules` lists `{ id, type, name }`. After the world is evicted (a database-backed use case ran) the knowledge cache is dropped and the live areas are looked at again on the next tick. `World` keeps at most `ENGINE_MAX_CHUNKS` chunks (LRU), never dropping one with unwritten changes. The bots with a live scanner are found again after a restart (`ModuleRepository.listBotIdsWithLiveScanner`).
- **Open points:** the per-tick refresh cost of an area is the cost of the energy tick (design §12.5: every tick), which drains a battery fast; tuning is a playtest topic. Pushing `vision` events to the client's socket comes with 5.6 / 5.10.
- **Next step:** task 5.13 (radio network).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.13: radio network
- **Tasks:** 5.13
- **Branch:** `feature/5.13-radio-network` — done
- **Decisions / deviations from the plan:** pure rules in `engine/domain/radio.ts` (link margin at the smaller range, bars by margin, connectivity as a widest-path search from the base); `RadioNetwork` (engine/application) keeps one network per player with bots in memory and recomputes only the dirty ones: `World.onBotChange` fires when a bot is loaded, moves, or its adapter / has-energy state flips (not on every battery drain). Control: `EngineCore.act` calls `ensureControl` for every action that names a bot (`controlledBotOf`), and the terminal's `open` asks the engine through a `LinkGate` (`EngineLinkGate`, `OpenLinkGate` without an engine). Scripts: `getLinkStatus()`. Scanning while out of reach: `MapService.observe` / `ScanService.scan` got `remember: false`, the sightings go into `RadioBuffers` and are applied by `LiveVision.learn` when the link returns. `GameEvent` (`LinkLost`, `LinkRestored`, `LinkWeak`) is the first piece of the typed event bus (5.10), emitted as engine events `{ type: 'game' }`; the bar changes are `{ type: 'radio' }` diffs. A flush that fails `ENGINE_FLUSH_MAX_FAILURES` times in a row is given up on and the world is reloaded, so one bad row (a bot deleted behind the engine) cannot block every later write. The terminal gateway now runs a socket's lines one after the other: world-changing commands wait for the engine's tick and the next line must see them (found by the e2e of 5.5).
- **Open points:** the buffer of events is filled by the event bus (5.10); a bot's `connect` / `sendMessage` / `ping` come with 5.9; the signal of the whole fleet is not yet pushed to sockets (5.6).
- **Next step:** task 5.10 (game event bus).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.10: game event bus
- **Tasks:** 5.10
- **Branch:** `feature/5.10-event-bus` — done
- **Decisions / deviations from the plan:** `GameEvent` (engine/domain) is a union of typed events with `parties` and an optional `location`; publishers write to the tick's `EventOutbox`, `GameEventBus.deliver()` runs after the commands and the radio refresh and chooses the audience (parties while connected, otherwise the per-bot buffer of 5.13; link events always; watchers of a live area through `LiveVision.audienceAt`). Events emitted so far: `BotMoved`, `ResourceMined`, `DepositDepleted`, `ShotFired`, `ShotHit`, `ModuleDamaged`, `ModuleBroken`, `ScanCompleted`, `ExecutionFinished`, `ExecutionFailed`, the energy events and the link events. The other events of design §24.1 are emitted by their own features (trade, adoption, passwords: 5.9 and later phases). On the API side `GameEventDispatcher` gives each event to registered consumers, and `RealtimeGateway` (rooms `user:<id>`) pushes `game-event`, `radio-changes`, `vision`, `execution` and `script-log` to the owner's sockets only; an integration test connects two players and checks the stranger hears nothing.
- **Findings:** the e2e `factory` spec could no longer write a battery value straight into the database: the engine keeps a player's bots loaded for the radio network and its next flush overwrites the row. The "not enough energy" case is left to `factory.service.test.ts`.
- **Next step:** task 5.6 (`run`, `shell`, `top`, `kill` in the terminal through the engine).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.6: scripts from the terminal
- **Tasks:** 5.6
- **Branch:** `feature/5.6-terminal-scripts` — done
- **Decisions / deviations from the plan:** the terminal owns a `ScriptRunner` port (`run`, `evaluate`, `list`, `kill`, in terms of `IExecution` from `lib`), implemented by `EngineScriptRunner` over `EnginePort`; the same adapter is the `ScriptOutputFeed` (the engine's `log` events). New commands: `run <file> [args…]` (arguments become numbers/booleans when they look like them), a file name typed alone (a `ScriptFileCommand` fallback of the shell; "unknown command" when no such file), `eval <code>`, `top`, `kill <id>` (a unique prefix of at least the 8 characters shown is enough). Shell mode is client-side: every line is sent as `eval <line>`. In the engine a line is an execution of the pseudo file `<shell>` whose first argument is the line, so a relaunch after a restart can rebuild it; `shellSource` wraps an expression in `return (…)` and a line that starts with a statement keyword as statements, and the value is logged as output. A line is an execution of its own, so variables do not persist between lines (a persistent shell context is a later improvement). Output reaches the client live over the `script-log` / `execution` socket events of 5.10; `ScriptLogRecorder` stores every line as `[<id8>] <text>` in the terminal log of the bot (the newest session of the bot, or a closed one of its own), also while no terminal is open, which is the offline play of the plan. `CommandContext` gained `name` and `rest` (the line as typed, which `eval` needs).
- **Open points:** `top` lists all running scripts of the player, not only those of the current bot; the client does not yet show a list of executions in a window of its own.
- **Next step:** task 5.8 (TypeScript and local imports).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.8: TypeScript and local imports
- **Tasks:** 5.8
- **Branch:** `feature/5.8-languages-imports` — done
- **Decisions / deviations from the plan:** sucrase was chosen as the transpiler (design §10.1.1): types are stripped, ES modules stay (QuickJS runs them natively), there is no type check. `ModuleLoader` resolves the whole graph before the execution starts (so a missing file or a limit breach fails `run` at once with `SCRIPT_LOAD_FAILED`, and nothing is recorded), with the limits as `ENGINE_MODULE_*` settings; imports are found by a scan of the compiled code for `import` / `export … from` statements (a statement-looking text inside a string would also be followed, which can only cause a load error, never an extra permission). The runtime gets the loaded set as `modules` and serves nothing else, so `import()` of an unloaded file fails inside the script. A script that is relaunched after an engine restart is loaded again, so edits to its libraries apply. Shell lines (`<shell>`) have no imports. The editor typings are generated from the function catalog instead of being written by hand (`scriptTypings()`), a test keeps them valid.
- **Open points:** the in-game editor is a plain text area, so the typings are not wired in yet (CodeMirror 6 is on the client list); `esbuild-wasm` was not needed.
- **Next step:** task 5.9 (bot security).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.9: bot security
- **Tasks:** 5.9
- **Branch:** `feature/5.9-bot-security` — done
- **Decisions / deviations from the plan:** the rules live in `BotAccessService` (terminal slice) over ports: `BotAccessRepository` (new table `bot_access`: failures in a row and `lockedUntil` per bot), `SecurityLog` (a line of kind `security` in the newest session of the bot, written by `SessionLogWriter`, which also serves the script output of 5.6), and the existing bot, module, map and energy repositories. `connect` and `adopt` are routed through the engine as world actions because they pay energy and change ownership; the wait of a try (`BOT_ATTEMPT_DELAY_MS`) happens in the API thread after the action, so it never blocks the engine's inbox. After an adoption the engine kills the executions the previous owner had on the bot. `TerminalSession` got `fromBotId` (the bot the connection came from; `adopt` needs it), and a new result type `connected` makes the client work in the new session until `exit` goes back (a stack of terminals). The wiring that both the API and the engine thread need moved into `TerminalCoreModule`. The `BotAdopted` game event and separate draggable terminal windows are not done.
- **Findings:** the factory e2e flake of the PR before was real: a battery written straight into the database is overwritten by the engine (see 5.10); the access rules therefore never write energy outside the engine.
- **Next step:** task 5.11 (Cypress e2e for the script lifecycle), then 5.7.
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 5.11: end-to-end tests of the script lifecycle
- **Tasks:** 5.11
- **Branch:** `feature/5.11-script-e2e` — done
- **Decisions / deviations from the plan:** `scripts.cy.ts` has ten tests: run with arguments and the live log, a file name typed alone, `top` / `kill` (by the short id), a second script queued behind the first (the starter processor runs one execution at a time), a failing script, shell mode, TypeScript with imports of a library and JSON, an import cycle and a missing import (the terminal shows the server's own words for `SCRIPT_LOAD_FAILED`), a closed sandbox (`process`, `require`, `Date`, `fetch` are not there), and a script that writes its output while the player is away from the game page (the stored log has it). Two cases of the plan are covered below the browser: the relaunch after an engine restart (`engine.int.test.ts` kills the engine thread; an e2e stack cannot) and the ops budget (unit tests of the scheduler and the engine core). The spec found two bugs: an import without an extension tried the bare path first, which the drives refuse as an invalid name (now only the names with `.js` / `.ts` / `.json` are tried, and a refused name counts as a missing file), and the typed file name `nothing` was reported as a validation error instead of an unknown command.
- **Next step:** task 5.7 (security and load tests), then the exit criteria of Phase 5.
- **Verify with:** `npm run e2e` (or `node scripts/e2e.mjs -- --spec cypress/e2e/scripts.cy.ts`)

### 2026-10-12 — task 5.7: security and load tests
- **Tasks:** 5.7
- **Branch:** `feature/5.7-security-load-tests` — done
- **Findings (the tests found five real problems, all fixed here):**
  1. **The sandbox's clock is polled too rarely.** QuickJS asks the interrupt handler only every ~10,000 interpreter operations, so a loop whose every iteration is a heavy builtin kept the engine thread busy far beyond the 5 ms slice: sorting a 20,000-element array in a loop took 14 s, `"x".repeat(200000).split("")` in a loop 36 s, `join` 4.6 s (a memory bomb of `new Array(1e4).fill(1)` takes 250 ms, the stall measured earlier). The slice cannot be enforced from inside the thread, so a **watchdog** was added: the engine writes the id of the execution it steps into a shared buffer (`StepWatch`), the supervisor ends a thread that stays in one step for `ENGINE_WATCHDOG_STALL_MS` (2 s), kills the script that held it, and starts the next engine (an integration test measures 4 s from the first stall to a serving engine).
  2. **A deeply nested value crashed the sandbox.** `JSON.stringify`, `String`, `join`, `flat` and `JSON.parse` on a structure about 10,000 levels deep overflowed the host's native stack inside the WASM module before QuickJS's own stack check tripped (`RangeError` out of `step`, then an abort on dispose that would have broken every execution of the module). The stack limit default went from 256 KiB to 64 KiB (the check then trips first on any thread; recursion about 370 calls deep is still possible), the engine thread gets an 8 MiB native stack, and a fault that still gets through ends only its execution (`SANDBOX_FAULT`) and replaces the WASM module.
  3. **Host parsing of what a script passes out.** The host `JSON.parse` of a log line or call argument could throw on a deeply nested value inside the host callback; it is now contained and the script gets an error.
  4. **Log spam.** A loop of `bot.log` produced thousands of lines a tick toward the player and the database; the log is cut per tick and per line (`ENGINE_LOG_MAX_*`).
  5. `SharedArrayBuffer` and `Atomics` existed in the sandbox; they are removed.
- **Tests:** `quickjs-sandbox.test.ts` (14 attack cases), `engine-load.test.ts` (150 bots on the real clock; 60 honest scripts with 20 that never stop), `step-watch.test.ts`, the watchdog cases of `engine-process.test.ts`, the log caps and the watch in `engine-core.test.ts`, and the watchdog end to end in `engine.int.test.ts`.
- **Open points:** the 2 s a stalled script costs every player (a tick budget of 100 ms is gone for 20 ticks) is the price of detection by polling; a smaller `ENGINE_WATCHDOG_STALL_MS` is possible once real playtest data shows the longest honest step. Replacing QuickJS by a build with a smaller interrupt counter (QuickJS-NG) is an alternative to evaluate with the same tests.
- **Next step:** the exit criteria of Phase 5.
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`
