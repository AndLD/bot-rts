[← Phase 5 — Script runtime, scheduler & sandbox](../phases/phase-5-script-runtime.md)

# RFC 5.1 — Execution model of the engine

Status: accepted (task 5.1). Source design: [§12.2–12.4](../../product-knowledge/game-design/12-real-time-execution-model.md),
[§13](../../product-knowledge/game-design/13-security-sandboxing.md), [§14.2](../../product-knowledge/game-design/14-concurrency-race-conditions.md).

## 1. Decisions

| Topic | Decision |
| --- | --- |
| Threads | The API process is the main thread. The **engine** runs in one `worker_threads` Worker (task 5.4a) and owns the tick loop, the world state and every QuickJS context. |
| Boundary | Messages between the threads are plain JSON `EngineCommand` / `EngineResult` / `EngineEvent` objects behind an `EnginePort` (api side) and an `EngineHost` (worker side). The same boundary lets the engine move to a process or a pool later. |
| Runtime | `quickjs-emscripten` (synchronous WASM build, one `QuickJSRuntime` + one `QuickJSContext` per execution) behind the `ScriptRuntime` interface (task 5.2). |
| Async scripts | `main` is `async`; every API call returns a promise that the engine settles at the **start of a later tick** after the command is applied. Pending jobs are run with `runtime.executePendingJobs()` inside the execution's time slice. |
| Tick | `tickIntervalMs` = 100 (config). Phases of one tick: (1) settle results of the previous tick's commands, (2) run executions under the fair scheduler, collecting commands, (3) apply commands in the deterministic order, (4) energy tick, (5) emit events, (6) every 10th tick flush the write-behind batch. |
| Time | Game time is `tick × tickIntervalMs`; the engine passes the tick clock to every domain rule (no `Date.now()` in game logic). The wall clock is used only for slice/overrun measurement. |
| Determinism | Per-tick order = stable shuffle seeded by `hash(worldSeed, tick)`; the RNG is the seeded RNG, re-seeded per tick, injected into the rules. |
| Limits per execution | memory 8 MiB, stack 256 KiB, wall-clock slice 5 ms per tick (interrupt handler), `opsPerTick` and `parallelExecutions` from the processor. All in config. |
| Tick cap | 80 % of `tickIntervalMs`. When reached the scheduler stops, remembers a round-robin resume point (player index, bot index) and continues from it next tick. |
| Persistence | World changes are collected as dirty entities and flushed every 10 ticks in one transaction through the `WorldStateStore` port; execution records are written immediately. |

## 2. Benchmark spike

`api/scripts/bench-runtime.ts` (`npx ts-node scripts/bench-runtime.ts <bots>`), Apple M-series laptop, Node 22,
quickjs-emscripten 0.32 (release sync build), one runtime + context per bot, each bot runs a 2,000-iteration loop per tick
under a 5 ms interrupt deadline:

| Active bots | Create time | RSS per context | Tick p50 | Tick p95 |
| --- | --- | --- | --- | --- |
| 100 | 22 ms | ~136 KiB | 10 ms | 11 ms |
| 500 | 71 ms | ~102 KiB | 50 ms | 52 ms |
| 1,000 | 134 ms | ~83 KiB | 101 ms | 104 ms |

- About **0.1 ms per active bot per tick** for a small step, so **~800 bots fit in the 80 ms cap**. This matches the design
  guard-rail (a few hundred to ~1,000 actively running bots). Idle bots cost memory only: **~100 KiB** per context, so
  10,000 contexts ≈ 1 GiB; contexts of idle (sleeping) executions can be kept (cheap) while *finished* ones are disposed.
- Creating a context takes ~0.13 ms, so a context per execution (instead of pooling) is affordable.
- **Continuous scanning:** a chunk index of 10,000 live areas (3×3 chunks each) handled 5,000 changed cells in **0.5 ms**
  per tick, so the subscription design of §4.4 is cheap; the cost lies in energy accounting and diff serialization, not in
  lookup.
- The cost of real scripts is dominated by the host bridge calls (marshalling into the VM); the scheduler's op budget
  (`opsPerTick`, default 2) bounds them far below the benchmark's synthetic loop.

## 3. Consequences for the plan

- 5.2 uses one runtime per execution with the limits above; `ScriptRuntime` hides it.
- 5.4 enforces the per-execution slice with the interrupt handler and the global cap by checking the clock between executions.
- 5.12 uses the chunk index (16×16 cells per chunk) measured above.
- A load test (5.7) re-measures with real scripts and the whole bridge; the numbers above are the baseline, and the tick
  overrun metric (5.4a) alerts when the cap is hit.

## 4. Findings of the runtime (task 5.2)

- **A slice overrun kills the execution** (`TIME_LIMIT`). QuickJS's interrupt raises an error the script cannot catch, so
  a running loop cannot be suspended and resumed; design §12.2.1 allows "suspends or kills", and kill is what is possible.
  Long computations must be split with `await sleep(0)`. A 5 ms slice is about 100,000 simple loop iterations.
- **Memory bombs are throttled by the slice.** Near the heap limit QuickJS spends its time in garbage collection (a
  growing 4 MiB bomb took ~2.5 s before the heap limit fired), and that is not interruptible. With the 5 ms slice the
  bomb is stopped in under 300 ms; task 5.7 measures this with a load test and the default `memoryBytes` is lowered if
  it still threatens the tick cap.
- Scripts have no `Date`; `Math.random` is the host's seeded RNG and `bot.time()` returns game time.
