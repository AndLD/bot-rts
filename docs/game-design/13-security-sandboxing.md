[← Game design index](../GAME-DESIGN.md)

# 13. Security & sandboxing

Player scripts are untrusted code. The runtime must ensure:

| Threat | Mitigation |
| --- | --- |
| Reading server memory / globals | ✅ Run scripts in **QuickJS compiled to WASM** (e.g. `quickjs-emscripten`), a memory-safe sandbox with no host bindings, behind a `ScriptRuntime` interface so the engine can be swapped. Node's `vm` is **not** used (not a security boundary). |
| Importing Node modules / `require` | Disable `require`/`import`; expose only the whitelisted API. |
| Direct DB access | Scripts can never see the DB. Only API functions may query game state, through the game services. |
| Infinite loops | Tick budget + wall-clock slice per execution, enforced through QuickJS's interrupt handler; over-budget runs are preempted/suspended. |
| Memory bombs / large allocations | Per-execution heap/stack limits; kill on exceed. |
| Environment/secret leakage | No `process`, `env`, filesystem, or network access in the sandbox. |
| Cross-player data access | Every API call is authorized against the acting bot's owner (the user of the bot's living base); a script may only act as its own bot. |
| Resource abuse (spam) | Operations are budgeted and energy-costed; `sendMessage` is rate-limited. |
| Sandbox escape | Independent execution context, allowlisted bridge, escape attempts covered by tests. |

**Principle:** *predefined functions are the only door out of the sandbox*, and they validate arguments, check
ownership, and charge the bot's energy and processor budget.
