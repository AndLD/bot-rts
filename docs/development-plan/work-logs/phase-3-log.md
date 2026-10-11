[← Phase 3 — Core gameplay foundations](../phase-3-core-gameplay.md)

# Phase 3 — Core gameplay foundations — work log

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

### 2026-10-11 — task 3.1: resource and item model
- **Tasks:** 3.1
- **Branch:** `feature/3.1-resource-item-model` — done
- **Decisions:** the types and the default balance table live in `lib` (`interfaces/resources.ts`: `RESOURCE`, `IResourceBalance`, `DEFAULT_RESOURCE_BALANCE`, `IResourceStack`; `interfaces/items.ts`: `IItem`, which replaces the untyped `Item = unknown`). The logic is in the API (`map/domain/resource-balance.ts`: `pickResource`, `rollDepositAmount`, `validateResourceBalance`) because `lib` carries no logic that must be tested. `WorldConfig.resources` holds the table; `WORLD_RESOURCE_BALANCE_FILE` points to a JSON file that overrides any field of any resource, and an invalid file fails the start with a `ConfigError`. Generation uses the table from task 3.2.
- **Next step:** task 3.2 (`MapService` refactor, chunks, `MapPoint`/`Location` value objects; the deposit type and amount are stored on the map point).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

