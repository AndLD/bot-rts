# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Phase status legend:** ⬜ Not started · 🟡 In progress · ✅ Done. A phase's status is kept in the summary table below and
in the phase file, and is updated in the pull request that starts or finishes it. Each phase file also has an
**implementation log** listing the branches and pull requests that delivered its tasks (AGENTS.md §6.5).

**Task status** is tracked per task in the phase files (⬜ not started · 🟡 in progress · ✅ done), and each phase has an
append-only **work log** in `development-plan/work-logs/` so a phase can be resumed in a new session.

**Story points (SP):** Fibonacci scale, `1 SP ≈ 0.5 developer-day` (or one focused agent session). Estimates assume a
single engineer (or one agent working serially). Totals are additive per phase; they include implementation **and**
the required tests (unit + integration + e2e per the DoD in `AGENTS.md`).

**Summary**

| Phase | Theme                                | Story points | Status |
| ----- | ------------------------------------ | ------------ | ------ |
| 0     | Stabilize & CI foundation            | 24           | ✅ Done |
| 1     | Architecture refactor & NestJS migration | 100       | ✅ Done |
| 2     | Test infrastructure & coverage backfill | 43        | ✅ Done |
| 3     | Core gameplay foundations            | 76           | ✅ Done |
| 4     | Module system & crafting             | 70           | ✅ Done |
| 5     | Script runtime, scheduler & sandbox  | 104           | ✅ Done |
| 6     | Core game GUI & map animations       | 96           | ✅ Done |
| 7     | Presentation & engagement (landing, achievements, notifications, i18n, privacy policy, player documentation) | 66 | ✅ Done |
| 8     | Multiplayer, public API & hardening  | 71           | ✅ Done |
| 9     | Admin console (supervision, monitoring, moderation, operations) | 135          | ✅ Done |
| 10    | Market, currency, chat & transfers   | 115          | ⬜ Not started |
| 11    | Energy balance, day/night, connection resilience & play-feel polish (**developed after Phase 7**) | 47 | ✅ Done |
| 12    | Issues and stabilization (open-ended; issues found in use are added as tasks, so its points grow) | 5 (grows) | ⬜ Not started |
| 13    | Observability platform (OpenTelemetry logs and traces, a shared collector gateway, Elasticsearch, the admin log search and trace view on it; **approved 2026-10-15, developed after Phase 9**) | 35 | ⬜ Not started |
|        | **Total of Phases 0–13**             | **987** (Phase 12 grows as issues are added) | |

**Order of development.** The phases are numbered in plan order, but Phase 11 was added later (2026-10-13), after the first
hands-on run of Phases 0–7, and it is **developed right after Phase 7 and before Phases 8–10**. It got the next free number so that the task numbers of
Phases 8–10 (referenced from the design, the testing strategy and the deployment gate) did not change. The order actually followed is:

**0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 11 → 8 → 9 → 10**

---

## MVP definition

✅ **The MVP is the whole plan: every phase that exists, Phases 0–13 (987 SP).** Phase 12 collects issues found in use, so its share grows as issues are added; the MVP is reached when every phase is done and the user has closed Phase 12. There is no smaller intermediate release milestone. The phase
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
`develop` to `main` still needs your approval. The agent follows the session protocol in [`AGENTS.md` §7.6](../../AGENTS.md): it reads
the phase file and its work log, checks `git status`, the branch list and open pull requests, and continues from the last
"next step".

---

## Contents

- How this plan is structured and maintained: [README](./README.md) (method), [bindings](./bindings.md), [phase file rules](./phases/README.md)
- [Guiding principles](./cross-cutting/guiding-principles.md)
- [Phase 0 — Stabilize & CI foundation (24 SP)](./phases/phase-0-stabilize-ci.md)
- [Phase 1 — Architecture refactor, clean architecture & NestJS migration (100 SP)](./phases/phase-1-architecture-refactor.md)
- [Phase 2 — Test infrastructure & coverage backfill (43 SP)](./phases/phase-2-test-infrastructure.md)
- [Phase 3 — Core gameplay foundations (76 SP)](./phases/phase-3-core-gameplay.md)
- [Phase 4 — Module system & crafting (70 SP)](./phases/phase-4-modules-crafting.md)
- [Phase 5 — Script runtime, scheduler & sandbox (104 SP)](./phases/phase-5-script-runtime.md)
- [Phase 6 — Core game GUI & map animations (96 SP)](./phases/phase-6-gui.md)
- [Phase 7 — Presentation & engagement (66 SP)](./phases/phase-7-presentation-engagement.md)
- [Phase 8 — Multiplayer, public API & production hardening (71 SP)](./phases/phase-8-multiplayer-api-hardening.md)
- [Phase 9 — Admin console (135 SP)](./phases/phase-9-admin-console.md)
- [Phase 10 — Market, currency, chat & transfers (115 SP)](./phases/phase-10-market-chat.md)
- [Phase 11 — Energy balance, day/night, connection resilience & play-feel polish (47 SP)](./phases/phase-11-energy-time-ux.md)
- [Phase 12 — Issues and stabilization (5 SP, grows as issues are added)](./phases/phase-12-issues.md)
- [Phase 13 — Observability platform (35 SP)](./phases/phase-13-observability-platform.md)
- [Testing](../testing/README.md) (current documentation) and [testing work by phase](../testing/by-phase.md) (historical)
- [Risk register](./cross-cutting/risk-register.md)
- [Definition of Done](./cross-cutting/definition-of-done.md)
- Work logs: [phase 0](./work-logs/phase-0-log.md), [phase 1](./work-logs/phase-1-log.md), [phase 2](./work-logs/phase-2-log.md), [phase 3](./work-logs/phase-3-log.md), [phase 4](./work-logs/phase-4-log.md), [phase 5](./work-logs/phase-5-log.md), [phase 6](./work-logs/phase-6-log.md), [phase 7](./work-logs/phase-7-log.md), [phase 8](./work-logs/phase-8-log.md), [phase 9](./work-logs/phase-9-log.md), [phase 10](./work-logs/phase-10-log.md), [phase 11](./work-logs/phase-11-log.md), [phase 12](./work-logs/phase-12-log.md), [phase 13](./work-logs/phase-13-log.md)
