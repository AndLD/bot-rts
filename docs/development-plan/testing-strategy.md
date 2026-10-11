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
| **7** Presentation | Lighthouse CI gate for the landing page (7.3); missing-translation check (7.8); e2e for landing, language, achievements and notifications (7.9) |
| **8** Hardening | Load and soak tests (8.6); API contract tests proving the official client and API-key clients behave identically (8.10); MCP tests against a seeded backend (8.11); e2e of API keys and two-player interaction (8.13); final coverage sweep (8.8) |
| **9** Admin console | Authorization matrix tests, every admin endpoint × every role, plus audit completeness (9.14); e2e of the admin flows (9.13) |
| **10** Market and chat | Money and goods conservation property tests, matching determinism (10.13); e2e of exchange, auctions, inbox, chat and transfers (10.14) |

## End-to-end coverage matrix

Every core user and game flow has a Cypress spec. A pull request that adds or changes a user-visible flow adds or
updates its spec and this matrix. The full suite runs in CI on every PR into `develop` (from Phase 2); if it grows past
about 15 minutes it is sharded and run in parallel.

| Flow | Spec owned by |
| --- | --- |
| Sign up → verify email → inactive page → verified | 2.7 |
| Login, logout, token refresh; banned and forbidden users | 2.7 |
| Deploy a base (password, spawn seed); redeploy after a corpse base | 3.13 |
| Terminal: `list`, `modules` | 2.7 |
| Terminal: filesystem (`ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`) | 3.13 |
| Craft, assemble, research, `learn`; repair, disassemble; restore a corpse base; battery exhaustion | 4.7 |
| Script lifecycle: edit, run, log, `top`, `kill`, shell mode, failing script, restart relaunch | 5.11 |
| Map: fog of war, pan/zoom, cell inspection, opening a bot; animation smoke test | 6.6 |
| Storage GUI; factory GUI; windows | 6.6 |
| `connect` (range, relay, password, lockout, "Connection interrupted"); `adopt` a stale bot | 6.6 |
| Manual control panel and the global / personal category switches | 6.6 |
| Tutorial: complete, skip, reopen | 6.9 |
| Core gameplay: mining loop, combat to a broken module, energy exhaustion, corpse-base restoration | 6.12 |
| Landing page, language switch, auth page scene | 7.9 |
| Achievements (including offline), notifications, notification center, offline summary | 7.9 |
| API key lifecycle; two-player interaction (contest, fog privacy, attack, adopt) | 8.13 |
| Account management: forgot / reset password, change password, change email, delete account | 2.7 |
| Signup validation, expired or reused verification link, login lockout, banned user mid-session | 2.7 |
| Spawn seeds: same code spawns nearby, full seed, expired seed | 3.13 |
| Weight / speed / capacity, assembly rejections, broken-module effects, disassembly permissions | 4.7 |
| Script arguments, imports, TypeScript, limits, queued executions and ops budget, sandbox denial, offline play | 5.11 |
| Relay chains, messages, world consistency, reload / reconnect / token expiry, two tabs, manual-action budget, admin category switches | 6.6 |
| Deposit depletion and contest, combat details, items and blueprint items | 6.12 |
| Notification coalescing, translated terminal responses | 7.9 |
| Read-only API key, MCP smoke test, corpse base and stale bots seen by other players | 8.13 |
| Admin console: role-based access, two-factor sign-in, dashboard, ban, inspector, supervision actions, maintenance mode, balance edit, announcements | 9.13 |
| Resource exchange, auctions, script editions, inbox, wallet and fees | 10.14 |
| Chat (channels, private messages, block, report) and transfers (credits, items, accept / decline / expiry), new-account limits | 10.14 |
| Admin moderation of listings, wallets and chat messages | 10.14 |
| Scan snapshots ageing, a script recovering from a stale scan, continuous scanning (live area, diffs, switching off) | 6.12 |
| Radio link loss and recovery: out of range, relay destroyed / repaired, tower out of fuel, hatched bots, buffered scans, missed-event summary | 6.6 |
