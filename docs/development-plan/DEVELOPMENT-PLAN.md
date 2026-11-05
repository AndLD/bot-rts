# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Phase status legend:** ⬜ Not started · 🟡 In progress · ✅ Done. A phase's status is kept in the summary table below and
in the phase file, and is updated in the pull request that starts or finishes it. Each phase file also has an
**implementation log** listing the branches and pull requests that delivered its tasks ([method §4](../../harness/core/method/method.md#4-definition-of-done)).

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
| 12 | Issues and stabilization | 16 | C1–C2 | 🟡 In progress |
| 13 | Observability platform | 48 | — | ✅ Done |
| 14 | Admin MCP: AI-assisted investigation | 19 | — | ✅ Done |
| 15 | Harness fixes | 77 | — | ✅ Done |
| 16 | CI speed and agent throughput | 23 | — | ✅ Done |
| 17 | Harness framework extraction | 71 | C1–C3 | ✅ Done |
|  | **Total of Phases 0–17** | **1240** | | |
<!-- plan-summary:end -->

<!-- plan-issues:start -->
**Issue queue** (not a phase; its size is not in the totals above): [2 open](./issues/README.md), 4 SP; 0 archived.
<!-- plan-issues:end -->

**Releases** (the order of the releases and of their tasks is the file [releases](./releases.md), not a section of this index; the line below is written by `harness plan summary`)

<!-- plan-releases:start -->
No release is being developed. Next: `0.3.0` (⬜ planned). The order of the releases and of their tasks: [releases](./releases.md).
<!-- plan-releases:end -->

---

## MVP definition

✅ **The MVP is the whole plan: every phase of the summary table above, and its size is that table's total.** The harness phases 15 to 17 are part of it (owner decision 2026-10-30). Phase 12 collects issues found in use, so its share grows as issues are added; the MVP is reached when every phase is done and the user has closed Phase 12. There is no smaller intermediate release milestone. The phase
order stays as written (stabilize → refactor → tests → gameplay foundations → modules and crafting → script runtime →
GUI → multiplayer, public API and hardening), and each phase still ships green (see [Guiding principles](../../harness/core/plan/guiding-principles.md)).

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
`develop` to `main` still needs your approval. The agent follows the session protocol in [method §6](../../harness/core/method/method.md#6-session-protocol-resuming-and-pausing-a-phase): it reads
the phase file and its work log, checks `git status`, the branch list and open pull requests, and continues from the last
"next step".

---

## Contents

- How this plan is structured and maintained: the framework's [plan method](../../harness/core/plan/README.md), [bindings](./bindings.md), [phase file rules](../../harness/core/plan/phases.md)
- [Guiding principles](../../harness/core/plan/guiding-principles.md)
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
- [Phase 10 — Market, currency, chat & transfers (154 SP)](./phases/phase-10-market-chat/README.md)
- [Phase 11 — Energy balance, day/night, connection resilience & play-feel polish (47 SP)](./phases/phase-11-energy-time-ux.md)
- [Phase 12 — Issues and stabilization (16 SP)](./phases/phase-12-issues/README.md)
- [Phase 13 — Observability platform (48 SP)](./phases/phase-13-observability-platform.md)
- [Phase 14 — Admin MCP: AI-assisted investigation (19 SP)](./phases/phase-14-admin-mcp.md)
- [Phase 15 — Harness fixes (77 SP)](./phases/phase-15-harness-fixes.md)
- [Phase 16 — CI speed and agent throughput (23 SP)](./phases/phase-16-ci-speed.md)
- [Phase 17 — Harness framework extraction (71 SP)](./phases/phase-17-harness-framework/README.md)
<!-- plan-contents:end -->
- [Testing](../testing/README.md) (current documentation) and [testing work by phase](../testing/by-phase.md) (historical)
- [Risk register](./cross-cutting/risk-register.md)
- [Definition of Done](../../harness/core/plan/definition-of-done.md)
- Work logs: [phase 0](./phases/work-logs/phase-0-log.md), [phase 1](./phases/work-logs/phase-1-log.md), [phase 2](./phases/work-logs/phase-2-log.md), [phase 3](./phases/work-logs/phase-3-log.md), [phase 4](./phases/work-logs/phase-4-log.md), [phase 5](./phases/work-logs/phase-5-log.md), [phase 6](./phases/work-logs/phase-6-log.md), [phase 7](./phases/work-logs/phase-7-log.md), [phase 8](./phases/work-logs/phase-8-log.md), [phase 9](./phases/work-logs/phase-9-log.md), [phase 10](./phases/phase-10-market-chat/log.md), [phase 11](./phases/work-logs/phase-11-log.md), [phase 12](./phases/phase-12-issues/log.md), [phase 13](./phases/work-logs/phase-13-log.md), [phase 14](./phases/work-logs/phase-14-log.md), [phase 15](./phases/work-logs/phase-15-log.md), [phase 16](./phases/work-logs/phase-16-log.md), [phase 17](./phases/phase-17-harness-framework/log.md)
