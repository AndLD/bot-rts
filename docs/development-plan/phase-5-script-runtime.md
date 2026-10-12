[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 5 — Script runtime, scheduler & sandbox (104 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-5-log](./work-logs/phase-5-log.md)

The heart of the game. The execution model and the sandbox are specified in design §10, §12 and §13; this must be
implemented and measured carefully.

**Execution order:** 5.1 → 5.2 → 5.3 → 5.4a (engine thread) → 5.4 (scheduler) → 5.5 → 5.12 → 5.13 → 5.10 → 5.6 → 5.8 → 5.9 → 5.11 → 5.7.

| # | Task                                                                                                      | SP | Status |
| --- | -------------------------------------------------------------------------------------------------------- | -- | --- |
| 5.1 | Design RFC for the execution model (design §12.2–12.2.2: processor ops/parallelism, tick budget, deterministic ordering, `tickIntervalMs`, MVP threading) with a benchmark spike measuring active bots per tick and QuickJS context memory; the spike also measures continuous scanning (many live areas) — [RFC](./rfc-5.1-execution-model.md) | 5 | ✅ |
| 5.2 | Sandboxed runtime: QuickJS (WASM) behind a `ScriptRuntime` interface with memory/stack limits and interrupt-handler deadlines, exposing only the whitelisted functions of design §10.2 (security model: §13) | 13 | ✅ |
| 5.3 | Predefined-function API layer per design §10.2–10.3: routes script calls to the module services with per-player/per-bot authorization and energy checks, returning the `Result<T>` types introduced in 4.1 | 6 | ✅ |
| 5.4a | Engine thread per design §12.2.2 and §12.3.1: `worker_threads` engine owning the tick loop, world state and QuickJS contexts; command/result protocol; batched write-behind; tick-overrun guard and metrics; durable execution records and relaunch after restart | 8 | ✅ |
| 5.4 | **Fair scheduler** per design §12.2: per-bot op budget, seeded player shuffle, global tick cap with round-robin resume, parallelism and `queued` state, time-slice enforcement; offline players' executions run too | 13 | ✅ |
| 5.5 | **Race-condition prevention** per design §14.2: deterministic collect-then-apply, in-memory reservations, no clock or `Math.random` in scripts, and the single-writer rule (all world-mutating API requests go through engine commands); determinism tests: the same seed and commands give an identical tick result, independent of command arrival order | 9 | ✅ |
| 5.6 | `run <file>` / `shell` execution wired through the scheduler; `top`/`kill` manage running scripts; results streamed over sockets | 5 | ✅ |
| 5.7 | Security & load tests: sandbox escape attempts, infinite loops, heavy allocations, many-bot fairness | 3 | ⬜ |
| 5.8 | Script languages and imports per design §10.1.1: TypeScript transpile behind a `Transpiler` interface, engine-side module loader with limits and cache, editor typings for the `bot` API via a `.d.ts` in `lib` | 10 | ⬜ |
| 5.9 | Bot security per design §11.2.2: `passwd`, foreign `connect` authentication, brute-force cost and lockout, failed-attempt logs, and `adopt` (not for bases) | 5 | ⬜ |
| 5.10 | Game event bus per design §24.1: typed engine events after each tick's commands, audience filter (a player receives events about their own entities, the direct results of their own actions, and everything inside their live areas, design §24.1), delivery to animations, achievements and notifications outside the tick path; events about a player's own bots reach them only while the bot is connected, with a summary on reconnection (5.13) | 5 | ✅ |
| 5.11 | E2E (Cypress) for the script lifecycle: write a script with `edit`, `run` it, watch its log, `top` and `kill`, shell mode, a failing script, engine restart relaunching a running script with the "rebooted" note; also script arguments, `<file>` shorthand, imports across files, a TypeScript script, import cycle and size limits, queued executions and the ops budget, sandbox denial (`process`, `require`, network), and offline play (log out, scripts keep running, log in and see results) | 8 | ⬜ |
| 5.12 | Live vision (design §4.4): chunk index of live scan areas, batched diff delivery per scanner `delay`, edge updates when a scanning bot moves, in-memory `seenAt` for live cells with lazy persistence, event-audience lookup for the live areas, map chunks with an LRU cache over the database | 8 | ✅ |
| 5.13 | Radio network (design §11.2.1): connectivity graph from each base (links at the smaller of two ranges, relays, powered adapters), incremental recompute around changes, `LinkLost` / `LinkRestored` events, `NO_SIGNAL` for control of disconnected bots, `getLinkStatus()`, per-bot buffers of scans and events delivered on reconnection with original `seenAt`; signal strength (0–4 bars from the weakest link on the path, `LinkWeak` event, bar changes as diffs) | 6 | ✅ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** a script like the gold-scan example in `notes.txt` runs deterministically across many bots/players,
is fairly scheduled, cannot reach server internals, and cannot corrupt shared map state — with unit/integration/load
tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/5.1-execution-model-rfc` | 5.1 | #72 | merged |
| `feature/5.2-quickjs-script-runtime` | 5.2 | #73 | merged |
| `feature/5.3-script-api-layer` | 5.3 | #74 | merged |
| `feature/5.4a-engine-thread` | 5.4a | #75 | merged |
| `feature/5.4-fair-scheduler` | 5.4 | #76 | merged |
| `feature/5.5a-world-commands` | 5.5 (in-memory world, world functions, deterministic apply) | #77 | merged |
| `feature/5.5b-single-writer` | 5.5 (single-writer routing of API requests) | #78 | merged |
| `feature/5.12-live-vision` | 5.12 | #79 | merged |
| `feature/5.13-radio-network` | 5.13 | #80 | merged |
| `feature/5.10-event-bus` | 5.10 | #81 | merged |
| `feature/5.6-terminal-scripts` | 5.6 | #82 | merged |
