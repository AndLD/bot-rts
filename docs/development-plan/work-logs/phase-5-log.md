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
