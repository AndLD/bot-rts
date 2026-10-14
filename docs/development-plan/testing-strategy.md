[← Development plan index](../DEVELOPMENT-PLAN.md)

# Testing strategy

The rules live in [`AGENTS.md` §6](../../AGENTS.md); this page shows how they play out phase by phase.

## Test types

| Type | Tooling | What it covers | Database |
| --- | --- | --- | --- |
| **Unit** | Jest, mocks and small fakes of the ports | Pure functions, domain rules, use cases, the engine, scheduler, combat and energy rules (clock and RNG are injected, so results are deterministic) | none, ever |
| **Integration** | Jest + `supertest`, Nest testing module | Prisma repositories, use cases with real data, HTTP and socket slices | real PostgreSQL in Docker, one database per Jest worker |
| **End-to-end** | Cypress against a seeded backend | **Every core user and game flow** (see the matrix below) | real PostgreSQL in Docker |
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

## End-to-end coverage matrix

Every core user and game flow has a Cypress spec. A pull request that adds or changes a user-visible flow adds or
updates its spec and this matrix. The full suite runs in CI on every PR into `develop` (from Phase 2); if it grows past
about 15 minutes it is sharded and run in parallel.

| Flow | Spec owned by |
| --- | --- |
| Sign up → verify email → inactive page → verified | 2.7 (`signup.cy.ts`) |
| Login, logout, token refresh; banned and forbidden users | 2.7 |
| Deploy a base (password, spawn seed); redeploy after a corpse base | 3.8 and 3.13 (`deploy.cy.ts`, `redeploy.cy.ts`) |
| Terminal: `list`, `modules` | 2.7 |
| Terminal: filesystem (`ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`), `help`, stored session lines | 3.13 (`terminal-files.cy.ts`) |
| Craft, assemble, research, `learn`; repair, disassemble; battery exhaustion | 4.7 (`factory.cy.ts`) |
| Restore a corpse base by repairing its wireless adapter | 4.7 (HTTP integration test `api.int.test.ts`: driving a repairer to a lost base from the UI needs the movement of phase 5) |
| Script lifecycle: edit, run, log, `top`, `kill`, shell mode, failing script | 5.11 (`scripts.cy.ts`); restart relaunch with the "rebooted" note: `engine.int.test.ts` (an e2e stack cannot kill the engine thread) |
| Map: fog of war, pan/zoom, cell inspection, opening a bot; animation smoke test | 6.6 (`map.cy.ts`) |
| Storage GUI; factory GUI; windows | 6.6 (`storage-factory.cy.ts`, `windows.cy.ts`) |
| `connect` (range, relay, password, lockout, "Connection interrupted"); `adopt` a bot of another player | 6.6 (`connect.cy.ts`); adopting a stale bot of a lost base: unit tests of `BotAccessService` (the stale bots themselves are Phase 8) |
| Manual control panel and the global / personal category switches | 6.6 (`control.cy.ts`) |
| Tutorial: complete, skip, reopen | 6.9 (`tutorial.cy.ts`) |
| Core gameplay: mining loop, combat to a broken module, energy exhaustion, corpse-base restoration | 6.12 (`gameplay.cy.ts`) |
| Landing page, language switch, auth page scene | 7.9 |
| Privacy policy page, footer and sign-up links, acceptance required at sign-up | 7.9 |
| Achievements (including offline), notifications, notification center, offline summary | 7.9 |
| Player docs: `/docs` navigation and search, language switch, landing link, in-game Help window and contextual "?" links | 7.13 |
| API key lifecycle in the account page (create, shown once, use within scopes, revoke); two-player interaction (contested cell `BLOCKED`, private fog of war, an attack seen by the defender) | 8.13 (`api-keys.cy.ts`, `multiplayer.cy.ts`) |
| Account management: forgot / reset password, change password, change email, delete account | 2.7 |
| Signup validation, expired or reused verification link, login lockout, banned user mid-session | 2.7 |
| Spawn seeds: same code spawns nearby, full seed, expired seed | 3.13 (`spawn-seeds.cy.ts`) |
| Weight / speed / capacity, assembly rejections, broken-module effects, disassembly permissions | 4.7 (unit: `movement`, `assembly`, `capabilities`, `repair-module`; integration: `api.int.test.ts`, `energy.service.int.test.ts`; terminal: `factory.cy.ts`) |
| Script arguments, imports, TypeScript, limits, queued executions, sandbox denial, offline play | 5.11 (`scripts.cy.ts`); the ops budget: `engine-core.test.ts`, `scheduler.test.ts` |
| Relay chains, messages, world consistency, reload / reconnect / token expiry, two tabs, manual-action budget, admin category switches | 6.6 (`connect.cy.ts`, `map.cy.ts`, `resilience.cy.ts`, `control.cy.ts`); `sendMessage` / `ping` do not exist yet; the socket reconnect and two tabs are covered by `realtime.gateway.test.ts` and the socket tests of `api.int.test.ts` (Cypress cannot cut a WebSocket); the one-action-at-a-time rule of manual actions: `engine-core.test.ts` |
| Deposit depletion and contest, combat details, items and blueprint items | 6.12 (`gameplay.cy.ts`, `storage-factory.cy.ts`); ammunition, armour and artillery numbers: the unit tests of the combat handler and the weapon module |
| Notification coalescing, translated terminal responses | 7.9 |
| Read-only API key, MCP smoke test (scan, move), corpse base and stale bots seen by other players, adopting a stale bot | 8.13 (`api-keys.cy.ts`, `mcp.cy.ts`, `multiplayer.cy.ts`) |
| Admin console: role-based access, two-factor sign-in, dashboard, ban, inspector, supervision actions, maintenance mode, balance edit, announcements | 9.13 |
| Resource exchange, auctions, script editions, inbox, wallet and fees | 10.14 |
| Chat (channels, private messages, block, report) and transfers (credits, items, accept / decline / expiry), new-account limits | 10.14 |
| Admin moderation of listings, wallets and chat messages | 10.14 |
| The in-game clock and the day phase, the night filter that does not block map clicks | 11.10 (`daynight.cy.ts`) |
| The starter base runs on a solar panel and burns no oil; energy low is told once however long it lasts; a bot out of energy stays off the radio until the resume threshold | 11.10 (`energy.cy.ts`); the balance of the panel against the generator over game days and the hysteresis edge cases: `energy-balance.test.ts`, `energy-model.test.ts`, `energy-events.contract.test.ts` |
| Automatic reconnection after the API restarts | 11.7 (`reconnection.cy.ts`) |
| Control window layout (also a layout saved narrow), terminal follows new output only when at the bottom | 11.10 (`interface.cy.ts`) |
| Scan snapshots ageing, a script recovering from a stale scan, continuous scanning (live area, diffs, switching off) | 6.12 (`gameplay.cy.ts`: live area and ageing snapshot; the stale-scan recovery by the handler and script-api unit tests) |
| Radio link loss and recovery: out of range, relay destroyed / repaired, tower out of fuel, hatched bots, buffered scans, missed-event summary | 6.6 (`connect.cy.ts`, `radio.cy.ts`: out of range, relay chain, terminal interrupted and resumed, signal bars); relay towers do not exist (relays are the player's own bots); buffered scans and the summary of missed events: `radio-network.test.ts`, `radio-buffers.test.ts`, `useTerminal.test.tsx` |

## Quality sweep of Phase 8 (task 8.8)

- **Coverage at the end of the phase** (statements / branches / functions / lines): `api` 99.98 / 99.72 / 100 / 99.98 %, `client` 99.96 / 99.88 / 100 /
  100 %, `mcp` 100 %. The gate stays at 97 % per package, and CI also checks that every changed file reaches it.
- **Flaky tests.** The suites that measure real time or run the Ant Design components in jsdom failed now and then when the whole suite
  ran in parallel with coverage (the pre-push hook and CI). Their bounds are now set for a busy machine: the real-time tick bound of
  `engine-load.test.ts` and the time a memory bomb may take in `quickjs-sandbox.test.ts` only catch a runaway; React Testing Library waits
  up to 5 s (`client/jest.setup.ts`); the follow-the-end behaviour of the terminal no longer depends on the order of a scroll event; the
  Cypress notification spec waits for the script's finished notification before it marks everything read. What a tick really costs is
  measured by the load harness (`docs/LOAD-TESTING.md`), not by a unit test.
- **The `Aborted(Assertion failed: list_empty(&rt->gc_obj_list)` line** in the test output comes from the sandbox attack tests: a sandbox
  that ran out of memory or stack cannot always be taken apart cleanly, so the engine drops its module and makes a new one (`dispose()` of
  `quickjs-script-runtime.ts`). It is expected there; it must not appear in the output of any other suite.
- No `console.log`, commented-out code or untyped `any` boundaries remain in the packages; the lint, type, import-boundary, i18n and link
  checks are part of CI.

