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

### 2026-10-11 — task 3.3: indexes and constraints
- **Tasks:** 3.3
- **Branch:** `feature/3.3-indexes-constraints` — done
- **Findings:** most of the task was already in the schema from Phase 1 (`bots.baseId`, `(x, y, z)` unique on `map_points`, `(userId, x, y, z)` unique on `known_points`, `modules.botId`); `z` is reserved (design §4.1), so uniqueness stays on `(x, y, z)`, which is `(x, y)` while `z` is 0. Negative coordinates are covered by an integration test.
- **Added (migration `indexes_and_map_constraints`):** `bots (user_id, type)` and `modules (bot_id, type)` indexes (finding a player's bases and a bot's scanner/drive), a partial index `map_points (x, y) WHERE type = 'base'` for the spawn distance rule (3.11), and CHECK constraints: a deposit is a resource cell with a positive amount (real and known layers) and bot/base/item cells carry content and others do not.
- **Gotcha:** a CHECK that evaluates to NULL passes in PostgreSQL, so the constraints are NULL-safe (`IS NOT DISTINCT FROM`, `COALESCE`); the integration tests prove they reject.
- **Next step:** task 3.4 (bot model, `BotRepository`/`BotService`).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

### 2026-10-11 — task 3.4: bot service
- **Tasks:** 3.4
- **Branch:** `feature/3.4-bot-service` — done
- **Decisions:** the bot model and `BotRepository` (`findById`, `add`, `listOfUser`, `listOfBase`) were already in place from Phase 1; this task adds `BotsService.createBot` (a worker of one of the player's bases from module templates, in one transaction; it is not placed on the map, that is the assembly's step with `SpawnService`, task 3.11 and 4.x) and `BotsService.listBaseBots`, exposed as `GET /api/v1/bots/:id/bots`. Assembly rule validation (design §8.2) arrives with the assembly (4.6).
- **Next step:** task 3.5 (terminal session persistence).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

### 2026-10-11 — task 3.5: terminal session persistence
- **Tasks:** 3.5
- **Branch:** `feature/3.5-terminal-sessions` — done
- **Decisions:** new `terminal` Nest module (domain / application / infrastructure / presentation). Tables `terminal_sessions` and `terminal_logs` (kinds `input`, `output`, `error`, `security`; indexes `(bot_id, at)` and `(at)`; cascade with the bot and the user). `TerminalService` opens a session only on a bot the player owns, records lines into an open session, closes it, and serves the history. Retention (design §11.2.3) is enforced without a scheduler: the 5,000-line cap per bot is applied after each recorded line (security events are not counted), and lines older than 30 days (security events 90 days) are dropped when a session opens; all three numbers are config (`TERMINAL_LOG_RETENTION_DAYS`, `TERMINAL_LOG_MAX_LINES`, `TERMINAL_SECURITY_RETENTION_DAYS`). Socket events: `open-terminal`, `close-terminal`, `get-terminal-history`; a session ends when its socket disconnects. The handshake authentication moved from `BotsGateway` into its own `SocketAuthGateway` (`auth` module) so that every gateway shares it exactly once.
- **Not yet used:** the web client opens a session and `record`s commands in task 3.7, together with the server-side command parser.
- **Next step:** task 3.6 (bot filesystem: drives, files, quotas).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

### 2026-10-11 — task 3.6: bot filesystem
- **Tasks:** 3.6
- **Branch:** `feature/3.6-bot-filesystem` — done
- **Decisions:** a drive is a `drive` module; a file is identified by its slash-separated `path` on the drive (the `files.name` column became `path`, plus `kind` file/directory, `content`, `size`; migration `bot_filesystem`, with a CHECK that a directory holds nothing). Rules in the domain: names `[A-Za-z0-9._-]` (not starting with a dot), at most 64 characters per segment and 8 levels, a file ends in `.js` / `.ts` / `.json` / `.txt`, parents must exist (`mkdir` is one level), `rm` removes a file or an empty directory. Quota = the module's `quota` property in bytes (fallback 64 KiB, the class-1 size) counted in UTF-8 bytes; a write that does not fit fails with `DRIVE_FULL` (413), a module with no condition left makes the drive inaccessible (`DRIVE_BROKEN`, design §8.4.1). `cd <drive>` takes the module name, numbered (`name-2`) when a bot has several of the same name. Use cases (`FilesService`) check ownership through `BotsService` and run in one transaction. REST surface under `/api/v1/bots/:botId/drives` (list drives, list/read/write/delete files, create a directory) for the web client, scripts' tooling and third parties. `FilesModule` now imports `BotsModule` (the reverse import was unused and was removed).
- **Not yet done:** `readDelay` / `writeDelay` are engine timing (Phase 5); the starter kit gets its memory module with task 3.9, so a freshly deployed base has no drive until then (tests create one).
- **Next step:** task 3.7 (server-side command parser and the terminal socket events).
- **Verify with:** `npm run db:up && npm run test:coverage -w api && npm run i18n:check`

