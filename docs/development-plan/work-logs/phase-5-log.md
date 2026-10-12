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
