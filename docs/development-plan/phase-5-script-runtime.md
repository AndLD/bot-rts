[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 5 — Script runtime, scheduler & sandbox (83 SP)

The heart of the game and the central unanswered question in `notes.txt`. This must be designed carefully.

| # | Task                                                                                                      | SP |
| --- | -------------------------------------------------------------------------------------------------------- | -- |
| 5.1 | Design doc: fair, real-time, multi-player execution model; processor module → `opsPerTick` + `parallelExecutions` (per-API-call op cost, default 1); tick budget; deterministic ordering (RFC + review); `tickIntervalMs` config, default 100 ms (10 ticks/s); threading: API thread + one engine thread for the MVP with a pool-ready command/result boundary; includes a benchmark spike measuring active bots per tick and QuickJS context memory | 5 |
| 5.2 | Sandboxed JS runtime: **QuickJS (WASM)** behind a `ScriptRuntime` interface (memory/stack limits, interrupt-handler deadlines), with a frozen API surface; whitelist only predefined functions (`scan`, `move`, `turn`, `shoot`, `aim`, `dig`, `pick`, `drop`, `connect`, `execute`, `log`, `getLocation`, `sendMessage`, `sleep`) | 13 |
| 5.3 | Predefined-function API layer that routes to module services with per-player/per-bot authorization and energy checks; `Result<T>` / typed `ErrorCode` set in `lib`; migrate callback-style module interfaces to `Promise<Result<T>>` | 8 |
| 5.4a | Engine thread: separate `worker_threads` engine owning the tick loop, world state, QuickJS contexts and batched DB write-behind; command/result message protocol between scripts and the engine; tick-overrun guard; tick-duration / active-execution / memory metrics; durable execution records, 1 s world flush, automatic relaunch of running executions after restart with a crash-loop guard | 8 |
| 5.4 | **Fair scheduler**: round-robin/tick queue across all players' bots (online **and offline** — executions never depend on a connected socket); per-bot op budget (`opsPerTick`, no carry-over); per-tick seeded player shuffle; global tick time cap with round-robin resume point; per-processor parallelism (`parallelExecutions`, excess executions `queued`); time-slice enforcement (kill runaway scripts) | 13 |
| 5.5 | **Race-condition prevention** (one solid entity per cell; losers of a contested cell get `BLOCKED`): deterministic collect-then-apply with seeded shuffle and RNG, in-memory cell reservations, no scripts clock/`Math.random`; **single-writer rule** — all world-mutating API requests (deploy base, file edit, craft, assemble) are routed through engine commands, never direct DB writes from the API thread | 8 |
| 5.6 | `run <file>` / `shell` execution wired through the scheduler; `top`/`kill` manage running scripts; results streamed over sockets | 5 |
| 5.7 | Security & load tests: sandbox escape attempts, infinite loops, heavy allocations, many-bot fairness | 3 |
| 5.8 | Script languages and imports: TypeScript transpile (no type-check gate), engine-side module loader for local `.js`/`.ts`/`.json` imports from the bot's drives (graph resolved at start, depth/size limits, cycle rejection), transpile of untrusted input outside the QuickJS context behind a `Transpiler` interface (sucrase preferred) with content-hash cache, same-drive imports only, limits 32 KB/file, 20 files, depth 5; editor typings/autocomplete for the `bot` API via a `.d.ts` in `lib` | 10 |
| 5.9 | Bot security: per-bot access password (`passwd`), foreign `connect` authentication, `adopt` rejected for bases, brute-force attempts costing ops/energy, failed-attempt logs on the target, lockout, and `adopt` (re-assign a bot to the base the connection came from; also stale bots, anyone who gets access) | 5 |
| 5.10 | Game event bus: typed events emitted by the engine after each tick's commands (moved, shot, hit, mined, repaired, broken, crafted, link lost, failed password attempt, …), fog-of-war visibility filter per player, delivery to consumers (animations, achievements, notifications) outside the tick path | 5 |

**Exit criteria:** a script like the gold-scan example in `notes.txt` runs deterministically across many bots/players,
is fairly scheduled, cannot reach server internals, and cannot corrupt shared map state — with unit/integration/load
tests.
