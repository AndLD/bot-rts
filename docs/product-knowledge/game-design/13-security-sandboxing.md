[← Game design index](./GAME-DESIGN.md)

# 13. Security & sandboxing

Player scripts are untrusted code. The runtime must ensure:

| Threat | Mitigation |
| --- | --- |
| Reading server memory / globals | Run scripts in **QuickJS compiled to WASM** (e.g. `quickjs-emscripten`), a memory-safe sandbox with no host bindings, behind a `ScriptRuntime` interface so the engine can be swapped. Node's `vm` is **not** used (not a security boundary). |
| Importing Node modules / `require` | Disable `require`/`import`; expose only the whitelisted API. |
| Direct DB access | Scripts can never see the DB. Only API functions may query game state, through the game services. |
| Infinite loops | Tick budget + wall-clock slice per execution, enforced through QuickJS's interrupt handler; over-budget runs are preempted/suspended. The handler is polled only every ~10,000 interpreter operations, so a loop whose every step is a heavy builtin (sorting a large array, joining, splitting) can overrun the slice by many seconds (measured: 4–36 s for a 5 ms slice). A **watchdog** in the supervising thread ends such an engine thread, kills the script that held it (`stalled the engine`) and lets the next engine start without it (§12.3.1). |
| Memory bombs / large allocations | Per-execution heap limit (`ENGINE_SCRIPT_MEMORY_BYTES`, 4 MiB) and a small stack limit (`ENGINE_SCRIPT_STACK_BYTES`, 64 KiB: a builtin such as `JSON.stringify` on a 10,000-deep array would otherwise overflow the host's native stack before the sandbox's own check trips; the engine thread also gets an 8 MiB native stack); kill on exceed. A fault of the sandbox itself ends only that execution (`SANDBOX_FAULT`) and the WASM module is replaced. |
| Log and output spam | A script's log is cut to `ENGINE_LOG_MAX_LINES_PER_TICK` lines per tick and `ENGINE_LOG_MAX_CHARS` characters per line before it reaches the player or the database. |
| Environment/secret leakage | No `process`, `env`, filesystem, or network access in the sandbox. |
| Cross-player data access | Every API call is authorized against the acting bot's owner (the user of the bot's living base); a script may only act as its own bot. |
| Resource abuse (spam) | Operations are budgeted and energy-costed; `sendMessage` is rate-limited. |
| Sandbox escape | Independent execution context, allowlisted bridge, escape attempts covered by tests (`quickjs-sandbox.test.ts`: host globals, dynamic imports, constructor chains, a frozen `bot`, prototype pollution across executions, hostile values). `SharedArrayBuffer` and `Atomics` are removed. |

**Principle:** *predefined functions are the only door out of the sandbox*, and they validate arguments, check
ownership, and charge the bot's energy and processor budget.
