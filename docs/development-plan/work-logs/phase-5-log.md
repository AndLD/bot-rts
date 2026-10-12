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
