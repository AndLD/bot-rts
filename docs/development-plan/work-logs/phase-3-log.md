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

### 2026-10-11 — task 3.2: map service, chunks and deposits
- **Tasks:** 3.2
- **Branch:** `feature/3.2-map-service-chunks` — done
- **Decisions:** `MapService` already existed (Phase 1); it now takes an injected `MapGenerator` (RNG + resource balance) and a chunk size, and works a range chunk by chunk (`splitByChunk`) so a step never needs more than one chunk; results are returned in x-major order. `domain/location.ts` holds the location helpers (`chunkOf` with floor division so negative cells have negative chunks, `splitByChunk`, `cellsOf`, `compareLocations`, `locationKey`). The chunk is a domain concept only: it is not a stored column (a stored chunk id would break when the tunable `WORLD_CHUNK_SIZE`, default 16, changes), the repository still answers range queries on the `(x, y, z)` unique index. A resource cell now stores its deposit (`MapPoint.resource: { resource, amount }`; columns `resource`, `amount` on `map_points` and `known_points`, migration `map_point_deposits`) and rolls three RNG values (cell, kind, amount).
- **Next step:** task 3.3 (indexes and constraints; query helpers).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

