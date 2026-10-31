# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Phase status legend:** ⬜ Not started · 🟡 In progress · ✅ Done. A phase's status is kept in the summary table below and
in the phase file, and is updated in the pull request that starts or finishes it. Each phase file also has an
**implementation log** listing the branches and pull requests that delivered its tasks ([method §4](../engineering/method.md#4-definition-of-done)).

**Task status** is tracked per task in the phase files (⬜ not started · 🟡 in progress · ✅ done), and each phase has an
append-only **work log** in `development-plan/phases/work-logs/` so a phase can be resumed in a new session.

**Story points (SP):** Fibonacci scale, `1 SP ≈ 0.5 developer-day` (or one focused agent session). Estimates assume a
single engineer (or one agent working serially). Totals are additive per phase; they include implementation **and**
the required tests (unit + integration + e2e per the DoD in `AGENTS.md`).

**Summary** (written from the phase files by `npm run plan:summary`, checked by `npm run docs:check`; edit a phase file, not this table)

<!-- plan-summary:start -->
| Phase | Theme | Story points | Agent complexity | Status |
| ----- | ----- | ------------ | ---------------- | ------ |
| 0 | Stabilize & CI foundation | 24 | — | ✅ Done |
| 1 | Architecture refactor, clean architecture & NestJS migration | 100 | — | ✅ Done |
| 2 | Test infrastructure & coverage backfill | 43 | — | ✅ Done |
| 3 | Core gameplay foundations | 76 | — | ✅ Done |
| 4 | Module system & crafting | 70 | — | ✅ Done |
| 5 | Script runtime, scheduler & sandbox | 104 | — | ✅ Done |
| 6 | Core game GUI & map animations | 96 | — | ✅ Done |
| 7 | Presentation & engagement: landing, auth scene, achievements, notifications, Russian, privacy policy, player documentation | 66 | — | ✅ Done |
| 8 | Multiplayer, public API & production hardening | 71 | — | ✅ Done |
| 9 | Admin console | 135 | — | ✅ Done |
| 10 | Market, currency, chat & transfers | 154 | C2–C3 | ⬜ Not started |
| 11 | Energy balance, day/night, connection resilience & play-feel polish | 47 | — | ✅ Done |
| 12 | Issues and stabilization | 16 (grows) | C2 | 🟡 In progress |
| 13 | Observability platform | 48 | — | ✅ Done |
| 14 | Admin MCP: AI-assisted investigation | 19 | — | ✅ Done |
| 15 | Harness fixes | 77 | — | ✅ Done |
| 16 | CI speed and agent throughput | 23 | — | ✅ Done |
| 17 | Harness framework extraction | 69 | C1–C3 | 🟡 In progress |
|  | **Total of Phases 0–17** | **1238** (Phase 12 grows as issues are added) | | |
<!-- plan-summary:end -->

**Order of development.** The phases are numbered in plan order, but Phase 11 was added later (2026-10-13), after the first
hands-on run of Phases 0–7, and it is **developed right after Phase 7 and before Phases 8–10**. It got the next free number so that the task numbers of
Phases 8–10 (referenced from the design, the testing strategy and the deployment gate) did not change. The order actually followed is:

**0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 11 → 8 → 9 → 13 → 14 → 15 → 16 → 17 → 10**

Phase 13 (observability) was added on 2026-10-15 and is **developed after Phase 9 and before Phase 10** (owner decision 2026-10-16): its tracing and
its logs of every node help to build and debug the market, the escrow and the ledger of Phase 10, and replacing the logger before Phase 10 adds its
code is cheaper than after. Phase 14 was developed right after Phase 13. Phase 15 (harness fixes) was added on 2026-10-18 and is **developed before Phase 10**
(owner decision 2026-10-18): it makes the rules true and enforced and lets several agents work at once, which Phase 10 can use.
Phase 16 (CI speed) was added on 2026-10-18 and is **developed after Phase 15 and before Phase 10**: a task pull request waits about
21 minutes for the required checks today, and Phase 10 has many tasks.
Phase 17 (harness framework extraction, step 3 of the [harness-framework plan](../harness-framework/README.md)) was added on 2026-10-20 and is
**developed after Phase 16 and before Phase 10**; its design task 17.1 may run while Phase 16 is in progress.
Phase 12 is open-ended and its tasks are done whenever they are found; it has no fixed place in the order.

---

## MVP definition

✅ **The MVP is the whole plan: every phase of the summary table above, and its size is that table's total.** The harness phases 15 to 17 are part of it (owner decision 2026-10-30). Phase 12 collects issues found in use, so its share grows as issues are added; the MVP is reached when every phase is done and the user has closed Phase 12. There is no smaller intermediate release milestone. The phase
order stays as written (stabilize → refactor → tests → gameplay foundations → modules and crafting → script runtime →
GUI → multiplayer, public API and hardening), and each phase still ships green (see [Guiding principles](./cross-cutting/guiding-principles.md)).

---

## Deployment gate

The prototype has known security holes (design §25.1) and must **not be deployed anywhere reachable** until these tasks
are ✅: **0.8** (security hotfix), **1.9** and **1.11** (authorization tests, revocable sessions and database-checked roles),
**8.2** (rate limiting, timeouts, headers), and **9.14** (authorization matrix) if the admin console is deployed. Secrets must
come from the environment (task 0.2), never from the hardcoded development fallbacks.

---

## Resuming work in a new session

Ask for one phase or a range: *"Start Phase 0"*, *"Start Phases 0-3"*, *"Continue Phase 2"*. The agent works through the named
phases' tasks in the documented order, creating and squash-merging every task's pull request into `develop` by itself (the
request is the approval), **without pausing between tasks or between the named phases**. It stops with a summary after the
last named phase, or earlier when it is blocked or needs a decision; phases you did not name are not started. Promoting
`develop` to `main` still needs your approval. The agent follows the session protocol in [method §6](../engineering/method.md#6-session-protocol-resuming-and-pausing-a-phase): it reads
the phase file and its work log, checks `git status`, the branch list and open pull requests, and continues from the last
"next step".

---

## Contents

- How this plan is structured and maintained: [README](./README.md) (method), [bindings](./bindings.md), [phase file rules](./phases/README.md)
- [Guiding principles](./cross-cutting/guiding-principles.md)
<!-- plan-contents:start -->
- [Phase 0 — Stabilize & CI foundation (24 SP)](./phases/phase-0-stabilize-ci.md)
- [Phase 1 — Architecture refactor, clean architecture & NestJS migration (100 SP)](./phases/phase-1-architecture-refactor.md)
- [Phase 2 — Test infrastructure & coverage backfill (43 SP)](./phases/phase-2-test-infrastructure.md)
- [Phase 3 — Core gameplay foundations (76 SP)](./phases/phase-3-core-gameplay.md)
- [Phase 4 — Module system & crafting (70 SP)](./phases/phase-4-modules-crafting.md)
- [Phase 5 — Script runtime, scheduler & sandbox (104 SP)](./phases/phase-5-script-runtime.md)
- [Phase 6 — Core game GUI & map animations (96 SP)](./phases/phase-6-gui.md)
- [Phase 7 — Presentation & engagement: landing, auth scene, achievements, notifications, Russian, privacy policy, player documentation (66 SP)](./phases/phase-7-presentation-engagement.md)
- [Phase 8 — Multiplayer, public API & production hardening (71 SP)](./phases/phase-8-multiplayer-api-hardening.md)
- [Phase 9 — Admin console (135 SP)](./phases/phase-9-admin-console.md)
- [Phase 10 — Market, currency, chat & transfers (154 SP)](./phases/phase-10-market-chat.md)
- [Phase 11 — Energy balance, day/night, connection resilience & play-feel polish (47 SP)](./phases/phase-11-energy-time-ux.md)
- [Phase 12 — Issues and stabilization (16 SP, grows as issues are added)](./phases/phase-12-issues.md)
- [Phase 13 — Observability platform (48 SP)](./phases/phase-13-observability-platform.md)
- [Phase 14 — Admin MCP: AI-assisted investigation (19 SP)](./phases/phase-14-admin-mcp.md)
- [Phase 15 — Harness fixes (77 SP)](./phases/phase-15-harness-fixes.md)
- [Phase 16 — CI speed and agent throughput (23 SP)](./phases/phase-16-ci-speed.md)
- [Phase 17 — Harness framework extraction (69 SP)](./phases/phase-17-harness-framework.md)
<!-- plan-contents:end -->
- [Testing](../testing/README.md) (current documentation) and [testing work by phase](../testing/by-phase.md) (historical)
- [Risk register](./cross-cutting/risk-register.md)
- [Definition of Done](./cross-cutting/definition-of-done.md)
- Work logs: [phase 0](./phases/work-logs/phase-0-log.md), [phase 1](./phases/work-logs/phase-1-log.md), [phase 2](./phases/work-logs/phase-2-log.md), [phase 3](./phases/work-logs/phase-3-log.md), [phase 4](./phases/work-logs/phase-4-log.md), [phase 5](./phases/work-logs/phase-5-log.md), [phase 6](./phases/work-logs/phase-6-log.md), [phase 7](./phases/work-logs/phase-7-log.md), [phase 8](./phases/work-logs/phase-8-log.md), [phase 9](./phases/work-logs/phase-9-log.md), [phase 10](./phases/work-logs/phase-10-log.md), [phase 11](./phases/work-logs/phase-11-log.md), [phase 12](./phases/work-logs/phase-12-log.md), [phase 13](./phases/work-logs/phase-13-log.md), [phase 14](./phases/work-logs/phase-14-log.md), [phase 15](./phases/work-logs/phase-15-log.md), [phase 16](./phases/work-logs/phase-16-log.md), [phase 17](./phases/work-logs/phase-17-log.md)
