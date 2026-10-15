[← Testing](./README.md)

# Testing work by phase

> **Historical page.** It records which testing work each phase scheduled; the current state is in the [testing README](./README.md).
> The [development plan](../development-plan/DEVELOPMENT-PLAN.md) has the phases themselves.

## By phase

| Phase | Testing work |
| --- | --- |
| **0** Stabilize | API Jest setup + `supertest` (0.3); CI with a PostgreSQL service container, coverage reporting and the changed-files check (0.5); Docker PostgreSQL (0.7) |
| **1** Refactor and migration | Integration tests of every Prisma repository and a migration check in CI (1.1a); safety-net HTTP tests of the golden flows (1.9); auth adapter contract tests with a fake token verifier (1.11); import-boundary check (1.10) |
| **2** Backfill | Client Jest + Cypress setup (2.1), thresholds (2.2), unit tests (2.3), use-case integration tests (2.4), controller slices (2.5), client tests (2.6), account-flow e2e (2.7), full gate in CI and pre-push (2.8) |
| **3** Gameplay foundations | Per-task unit and integration tests; OpenAPI drift check (3.12); Cypress flows for deploy base, terminal filesystem commands and corpse-base redeploy (3.13) |
| **4** Modules and crafting | Per-task tests with seeded RNG for combat, energy and weight rules; e2e for crafting, assembly, research, repair/disassembly and energy (4.7) |
| **5** Runtime | Determinism tests (5.5): same seed and commands give an identical tick result, independent of arrival order; sandbox escape, infinite-loop, memory and many-bot fairness tests (5.7); benchmark spike (5.1); e2e of the script lifecycle (5.11) |
| **6** GUI | e2e for every Phase 6 screen (6.6); tutorial spec (6.9); core gameplay journeys (6.12) |
| **7** Presentation | Lighthouse CI gate for the landing page (7.3); missing-translation check (7.8); e2e for landing, language, achievements and notifications (7.9); stale generated-docs check (7.11), docs link checker, example-script execution and docs e2e (7.13) |
| **8** Hardening | Load and soak tests (8.6); API contract tests proving the official client and API-key clients behave identically (8.10); MCP tests against a seeded backend (8.11); e2e of API keys and two-player interaction (8.13); final coverage sweep (8.8) |
| **9** Admin console | Authorization matrix tests, every admin endpoint × every role, plus audit completeness (9.14); e2e of the admin flows (9.13) |
| **10** Market and chat | Money and goods conservation property tests, matching determinism (10.13); e2e of exchange, auctions, inbox, chat and transfers (10.14) |
| **11** Energy, day/night, resilience (developed after Phase 7) | Event-spam contract test: no event fires twice in an unchanged state (11.1); balance simulation over a game day for the solar panel, the oil generator and heavy work (11.4); power-on hysteresis and restart cases (11.5); e2e of the day/night filter, reconnection, control window and terminal scrolling (11.10) |

