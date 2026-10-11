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

### 2026-10-11 — task 3.7: base terminal commands end to end
- **Tasks:** 3.7
- **Branch:** `feature/3.7-terminal-commands` — done
- **Decisions:** the commands run on the server. `TerminalShell` (application) parses a typed line, finds the command in a registry and runs it; each command is a small class implementing `TerminalCommand` (`help`, `ls`/`dir`, `cd`, `mkdir`, `cat`, `edit`, `rm`, `list`, `modules`, `clear`, `exit`), and a new command is a new class added in `createTerminalShell` (open/closed). The place of a session (drive and directory) lives with the socket in the gateway, not in the database; `cd` follows relative and absolute paths, `..`, drive names and the old `../drive` form, and a vanished drive sends the session back to the top. The answer is typed data (`output`, `help`, `clear`, `exit`, `edit`, `error` with an error code) in `lib`, and the client translates it; `shell` and the shell mode stay on the client until the runtime (5.6). Every typed line and its output or error are stored in the session (3.5). New socket events: `terminal-command`, `save-terminal-file`. `edit` opens a plain textarea editor in the terminal; the CodeMirror editor window arrives with the GUI (phase 6). The client opens a stored session for the base on connect.
- **Gaps for later tasks:** the starter kit has no memory module until 3.9, so the file commands cannot be run from a freshly deployed base yet; the Cypress specs for `ls`, `cd`, `mkdir`, `cat`, `edit`, `rm` are written in task 3.13, after 3.9 adds the drive.
- **Next step:** task 3.8 (the Deploy button and the base password), which needs the password to be stored: see the design §11.2.2.
- **Verify with:** `npm run db:up && npm run test:coverage && npm run i18n:check`

### 2026-10-11 — task 3.8: deploy your base
- **Tasks:** 3.8
- **Branch:** `feature/3.8-deploy-base-ui` — done
- **Decisions:** `POST /api/v1/bots/base` now requires `{ password }` (6-64 characters, `isValidBotPassword` in `lib`); the base keeps only a bcrypt hash (`bots.password_hash`, migration `bot_access_password`; a CHECK, `NOT VALID` so it spares rows from before, requires one for every base). The hash never reaches a DTO. `AuthModule` exports the `PASSWORD_HASHER` port that `BotsService` uses. The seed field of the deploy dialog arrives with the spawn seeds (3.11). Client: `GamePage` loads the player's bases (`gameApi`, the token is the cache key); a player with none sees `DeployBase` (password, repetition, a confirmation dialog), then the terminal. The `gameApi` endpoints are hand-written for now and are replaced by the generated client in task 3.12. The terminal shows its prompt only once the server has stored the session (found by the e2e run: typing right after the welcome text raced the session).
- **E2E:** new `deploy.cy.ts` (validation, confirm and deploy, cancel); the terminal spec deploys through the API with the password. The old "cannot connect before a base" case is gone (the player now meets the deploy screen).
- **Next step:** task 3.9 (module registry and factory; starter kit with processor, memory and wireless adapter).
- **Verify with:** `npm run db:up && npm run test:coverage && npm run i18n:check && npm run e2e`

### 2026-10-11 — task 3.9: module registry and factory
- **Tasks:** 3.9
- **Branch:** `feature/3.9-module-registry` — done
- **Decisions:** a stored module record stays plain data; `GameModule` is the class that gives it meaning, with one subclass per type (`ScannerModule`, `DriveModule`, `ProcessorModule`, `WirelessAdapterModule`, `WeaponModule`, `BatteryModule`, `StorageModule`, …; types without behaviour yet share `PlainModule`) and typed readers for the type-specific properties (a missing or unusable number falls back to a default). `ModuleRegistry` maps a type to its class (`createModuleRegistry` registers all 14 types; a test proves none is missing), and `instancesOf(records, Class)` is how a use case asks for, say, the drives of a bot; `ScanService` and `FilesService` use it instead of reading `props` themselves. The module catalog (`module-catalog.ts`, data) replaces `initial-base-modules.ts` and `ModuleFactory` creates modules from it by name (`starterKit` for a base). The starter kit now has the class-1 processor (2 ops per tick, 1 parallel), memory (64 KiB, read/write delay) and wireless adapter (range 20), ten modules in all.
- **Consequences:** a deployed base now has a drive, so the file commands work from the first session; tests that need a small or broken drive change the kit's drive (`tests/fakes/drives.ts`).
- **Lesson:** `jest | grep Tests:` hides a suite that fails to compile (a failed suite counts no tests); read the `Test Suites:` line too.
- **Next step:** task 3.10 (base destruction lifecycle).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

### 2026-10-11 — task 3.10: base destruction lifecycle
- **Tasks:** 3.10
- **Branch:** `feature/3.10-base-lifecycle` — done
- **Decisions:** a corpse base is derived, never stored (`isCorpse` in the domain: no working wireless adapter, or no module at all), so repairing the adapter brings the base back. `BaseLifecycle` (application) answers which bases of a player live, whether the owner still controls a bot (a base while it lives, any other bot while its base lives; the bots of a corpse base are stale and have no active owner), and shows the corpse bases on the real map (`MapPointType.CORPSE_BASE`, migrations `corpse_base_type` and `corpse_base_constraint`, two files because PostgreSQL cannot use a new enum value in the transaction that adds it). `BotsService.getControlledBot` is `getOwnedBot` plus that control check and fails with `BASE_LOST` (403); the terminal, files, scan, `createBot` and `listBaseBots` use it, while reading the modules or the session history needs ownership only. `listUserBots` (and so `list`, `GET /bots?type=base` and the client's deploy screen) hides corpse bases and stale bots, which is what brings the Deploy button back. The deploy rule is now "one living base": a corpse does not count, and the redeploy marks the old bases' map points as corpse bases. Stale bots keep their `baseId` and are not adopted by the new base (adoption is 5.9).
- **Left to the engine (5.x):** noticing in the tick that a base became a corpse and updating its map point at that moment (today the point is updated when the player redeploys); repair of a corpse; the loot of a corpse base.
- **Known race:** two simultaneous deploys of one player could both pass the living-base check; the requests of one player are serial in practice, and the engine's single writer removes it later.
- **Next step:** task 3.11 (`SpawnService`).
- **Verify with:** `npm run db:up && npm run test:coverage -w api`

### 2026-10-11 — task 3.11: SpawnService
- **Tasks:** 3.11
- **Branch:** `feature/3.11-spawn-service` — done
- **Decisions:** new `spawn` module. `SpawnService.chooseBaseLocation` draws random cells in a square around the origin whose half-width is `radius + radiusPerBase × bases` (a base count from `MapRepository.countBases`) and takes the first that is free (no point or an empty one: not occupied, not a deposit, no item) and at least `minBaseDistance` (Chebyshev distance, default 30) from every base, living or corpse (`findBasePointsInRange`, served by a partial index on `type IN ('base', 'corpse_base')`); after `attempts` tries it fails with `NO_FREE_LOCATION`. All numbers are the new `SpawnConfig` (env `WORLD_MIN_BASE_DISTANCE`, `WORLD_SPAWN_*`, `SPAWN_SEED_*`); `spawnMaxDistance` and the old `[0,10]²` rule are gone. Spawn seeds (design §22.3): code of 3-24 letters, digits or dashes, case-insensitive; the first deploy with a code sets the anchor (tables `spawn_seeds`, `spawn_seed_members`, one row per player); later players start within `seedRadius` (12) of the anchor and are exempt from the distance rule only against the bases of that seed; a seed takes `seedMaxPlayers` (8) players (a member who starts again is not counted twice) and closes `seedTtlHours` (24) after the anchor was set (`SPAWN_SEED_FULL`, `SPAWN_SEED_CLOSED`, both 409). `findAdjacentCell` gives a free neighbour of the base at random for an assembled bot (design §8.3); `BotsService.createBot` now uses it, writes the bot's map point and the owner's snapshot of it, and fails (and rolls the bot back) when no cell is free or the base is not on the map. The deploy API takes an optional `spawnSeed`, and the deploy dialog has the field. `NoFreeLocationError` moved to the spawn module.
- **Note:** the fakes' unit of work does not roll back, so the "no bot is created when no cell is free" guarantee rests on the real transaction (`PrismaUnitOfWork`) and is not asserted in a unit test.
- **Next step:** task 3.12 (OpenAPI spec generated in CI, typed client).
- **Verify with:** `npm run db:up && npm run test:coverage && npm run i18n:check`

