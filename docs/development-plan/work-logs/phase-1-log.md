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

### 2026-10-11 — tasks 1.1 and 1.1a: ports, domain entities and PostgreSQL/Prisma adapters
- **Tasks:** 1.1, 1.1a
- **Branch:** `feature/1.1-ports-and-prisma-adapters` — done (the legacy Express code still runs on MongoDB; it is switched over in the next branch, tasks 1.7/1.2/1.3/1.4)
- **Decisions / deviations from the plan:**
  - New code lives in `api/src/<feature>/{domain,application,infrastructure}` (features: `users`, `bots`, `modules`, `files`, `map`, `persistence`, `shared`); file names follow `<name>.<role>.ts`. Ports have `Symbol` DI tokens next to the interface.
  - Prisma 6 (`prisma` + `@prisma/client` ^6; Prisma 7 changes the config model). Schema in `api/prisma/schema.prisma`, one `init` migration with a hand-added `bots_ownership_check` CHECK constraint (base ⇒ `user_id`, no `base_id`; any other bot ⇒ `base_id`, no `user_id`; design §8.1). `BOT_TYPE` gained `WORKER` (an ordinary bot) so the ownership model is expressible.
  - Modules keep common columns plus a `props` JSONB for type-specific fields. Map: `map_points` (real layer, unique `x,y,z`) and `known_points` (per player, `seen_at` tick as `bigint`). `z` is stored as 0 when absent.
  - `WorldStateStore.flush` writes map and known points through `INSERT … ON CONFLICT` from one JSON document (typed arrays with NULLs were not inferred by the driver) and upserts modules, all in one transaction.
  - Test harness: Jest projects `unit` and `integration` (`*.int.test.ts`). Global setup creates `botrts_template` by running `prisma migrate deploy` on an empty database (this is the "migrations apply cleanly" check); every test file clones its own database from the template and drops it afterwards. `npm test` therefore needs `npm run db:up`; `npx jest --selectProjects unit` does not.
  - CI generates the client and runs `prisma migrate diff` against a shadow database to catch schema/migration drift.
  - `prisma/seed.ts` creates the root user (`owner`) from `ROOT_USER_EMAIL`/`ROOT_USER_PASSWORD`.
- **Problems / blockers / findings:** none open.
- **Next step:** branch `feature/1.7-switch-to-postgres`: `ID` becomes `string` (1.7), a composition root builds a `PrismaClient` (1.2), legacy services/controllers move onto use cases and repositories (1.3, 1.4), `mongodb` is removed.
- **Verify with:** `npm run db:up && npm test`
