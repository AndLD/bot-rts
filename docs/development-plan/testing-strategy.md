[← Development plan index](../DEVELOPMENT-PLAN.md)

# Testing strategy

The rules live in [`AGENTS.md` §6](../../AGENTS.md); this page shows how they play out phase by phase.

## Test types

| Type | Tooling | What it covers | Database |
| --- | --- | --- | --- |
| **Unit** | Jest, mocks and small fakes of the ports | Pure functions, domain rules, use cases, the engine, scheduler, combat and energy rules (clock and RNG are injected, so results are deterministic) | none, ever |
| **Integration** | Jest + `supertest`, Nest testing module | Prisma repositories, use cases with real data, HTTP and socket slices | real PostgreSQL in Docker, one database per Jest worker |
| **End-to-end** | Cypress against a seeded backend | Critical user journeys only | real PostgreSQL in Docker |
| **Quality gates in CI** | Lighthouse CI, import-boundary check, migration check, OpenAPI drift check, missing-translation check | Landing-page SEO/performance, layering rules, migrations apply to an empty database, committed OpenAPI spec equals the generated one, translation keys complete | — |

## Coverage

- Target: **≥ 97 %** statements, branches, functions and lines, separately for `api` and `client`.
- From task 0.5: coverage is reported on every PR (non-blocking) and a **changed-files check (≥ 97 % on files touched by
  the PR) is blocking from Phase 1 on**.
- From tasks 2.2 and 2.8: the full per-package gate is blocking in CI and in the pre-push hook.
- Every task ships its own tests (definition of done); the story points include them.

## By phase

| Phase | Testing work |
| --- | --- |
| **0** Stabilize | API Jest setup + `supertest` (0.3); CI with a PostgreSQL service container, coverage reporting and the changed-files check (0.5); Docker PostgreSQL (0.7) |
| **1** Refactor and migration | Integration tests of every Prisma repository and a migration check in CI (1.1a); safety-net HTTP tests of the golden flows (1.9); auth adapter contract tests with a fake token verifier (1.11); import-boundary check (1.10) |
| **2** Backfill | Client Jest + Cypress setup (2.1), thresholds (2.2), unit tests (2.3), use-case integration tests (2.4), controller slices (2.5), client tests (2.6), e2e journeys (2.7), full gate in CI and pre-push (2.8) |
| **3** Gameplay foundations | Per-task unit and integration tests; OpenAPI drift check (3.12); Cypress flows for deploy base, terminal filesystem commands and corpse-base redeploy (3.13) |
| **4** Modules and crafting | Per-task tests with seeded RNG for combat, energy and weight rules; e2e for crafting, assembly, research and repair/disassembly (4.7) |
| **5** Runtime | Determinism tests (5.5): same seed and commands give an identical tick result, independent of arrival order; sandbox escape, infinite-loop, memory and many-bot fairness tests (5.7); benchmark spike (5.1) |
| **6** GUI | e2e for all new GUIs (6.6); tutorial spec (6.9) |
| **7** Presentation | Lighthouse CI gate for the landing page (7.3); missing-translation check (7.8); achievements and notification rules unit-tested against the event bus |
| **8** Hardening | Load and soak tests (8.6); API contract tests proving the official client and API-key clients behave identically (8.10); MCP tests against a seeded backend (8.11); final coverage sweep (8.8) |
