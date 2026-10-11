[← Phase 1 — Architecture refactor, clean architecture & NestJS migration](../phase-1-architecture-refactor.md)

# Phase 1 — Architecture refactor, clean architecture & NestJS migration — work log

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

### 2026-10-11 — task 1.0: TypeScript 5 / Node 20 baseline, blocking changed-files coverage
- **Tasks:** 1.0
- **Branch:** `feature/1.0-typescript-node-baseline` — done
- **Decisions / deviations from the plan:** the upgrade itself happened in Phase 0 (task 0.3): `api`, `client` and `lib` all resolve TypeScript 5.9.3 from one root install. This task adds `.nvmrc` (20, also used by CI through `node-version-file`) and makes the changed-files coverage check (≥ 97 % on files touched by a PR) blocking, as planned for Phase 1.
- **Problems / blockers / findings:** none.
- **Next step:** task 1.7 (`ID` becomes `string`), then 1.1.
- **Verify with:** `npm ls typescript && npm run typecheck`
