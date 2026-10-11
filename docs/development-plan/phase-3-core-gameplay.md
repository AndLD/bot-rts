[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 3 — Core gameplay foundations (76 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-3-log](./work-logs/phase-3-log.md)

Establish the game-domain backbone the product notes describe (bases, bots, resources, map, storage).

**Note on the engine:** the engine arrives in Phase 5. Until then, world-mutating use cases (deploy base, file edits, craft, assemble) run in the API process behind the same command-handler interface that the engine will later implement, so moving them behind the engine (task 5.5) changes no use-case code.

| # | Task                                                                                                      | SP | Status |
| --- | -------------------------------------------------------------------------------------------------------- | -- | --- |
| 3.1 | Resource & item model (`Resource`, `Item`) in `lib` and the data-driven resource balance config, per design §9.1 | 3 | ⬜ |
| 3.2 | Map domain service refactor: extract map generation/reconciliation into a `MapService` with injected RNG/clock; add `MapPoint`/`Location` value objects; the map is addressed in chunks (tunable size) in the domain model and the repository, keeping region sharding possible later (design §12.2.2) | 8 | ⬜ |
| 3.3 | Indexes and constraints in the Prisma schema (e.g. `bots.baseId`, map `(x, y)` unique for real points, per-user known points `(userId, x, y)`, `modules.botId`) and query helpers; map storage is sparse and unbounded (negative coordinates supported) | 3 | ⬜ |
| 3.4 | Bot model + `BotRepository`/`BotService` (create from modules, list a base's bots) on the ownership model of design §8.1 (the schema and `lib` types already carry `baseId` / `userId` since 1.1a) | 5 | ⬜ |
| 3.5 | Terminal **session persistence**: store every connection session + logs to the database (per `notes.txt`), with a `TerminalSession` model/repository | 5 | ⬜ |
| 3.6 | Bot filesystem: `File`/`Drive` model and file CRUD with drive quotas and name validation, per design §11.4 | 8 | ⬜ |
| 3.7 | Base terminal commands end-to-end: server command parser + socket events for the filesystem and info commands of design §11.1 (`help`, `ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`, `list`, `modules`, `clear`, `exit`). `run` / `shell` / `top` / `kill` arrive with the runtime (5.6), `connect` with 6.5, `craft` / `assemble` / `research` / `learn` with 4.6, `passwd` / `adopt` with 5.9 | 13 | ⬜ |
| 3.8 | "Deploy your base" UI button + base-deployment confirmation flow, including setting the mandatory base access password | 5 | ⬜ |
| 3.9 | Module registry & factory for instantiating module classes by type (replaces the static `initialUserBaseModules`; the base starter kit now also includes class-1 processor, memory and wireless adapter) | 5 | ⬜ |
| 3.10 | Base destruction lifecycle per design §6.3: corpse base, redeploy of a new base ("one living base" rule), stale bots | 5 | ⬜ |
| 3.11 | `SpawnService`: base placement per design §4.1 (free cell, minimum distance, retries; replaces random `[0,10]²`), adjacent-cell spawn for assembled bots (§8.3), and spawn seeds per design §22.3 | 5 | ⬜ |
| 3.12 | `/api/v1` documentation and client generation per AGENTS.md §3.0 and design §22.1 (the versioned routes themselves exist since 1.10 / 1.12): OpenAPI spec generated in CI from controller/DTO definitions (CI fails when the committed spec differs from the generated one), and a typed client for the web client generated from it (replacing hand-written RTK Query endpoints) | 6 | ⬜ |
| 3.13 | Cypress e2e for the Phase 3 flows: deploy a base (with password and spawn seed), terminal filesystem commands (`ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`), redeploy after a corpse base; also spawn seeds: players with the same code spawn near each other, a full seed and an expired seed (injected clock) are refused | 5 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** a user can deploy a base, open its terminal, manage files, and every command persists session logs
to the database — all covered by tests.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
