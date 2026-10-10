# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Phase status legend:** ⬜ Not started · 🟡 In progress · ✅ Done. A phase's status is kept in the summary table below and
in the phase file, and is updated in the pull request that starts or finishes it. Each phase file also has an
**implementation log** listing the branches and pull requests that delivered its tasks (AGENTS.md §6.5).

**Task status** is tracked per task in the phase files (⬜ not started · 🟡 in progress · ✅ done), and each phase has an
append-only **work log** in `development-plan/logs/` so a phase can be resumed in a new session.

**Story points (SP):** Fibonacci scale, `1 SP ≈ 0.5 developer-day` (or one focused agent session). Estimates assume a
single engineer (or one agent working serially). Totals are additive per phase; they include implementation **and**
the required tests (unit + integration + e2e per the DoD in `AGENTS.md`).

**Summary**

| Phase | Theme                                | Story points | Status |
| ----- | ------------------------------------ | ------------ | ------ |
| 0     | Stabilize & CI foundation            | 18           | ⬜ Not started |
| 1     | Architecture refactor & NestJS migration | 93       | ⬜ Not started |
| 2     | Test infrastructure & coverage backfill | 39        | ⬜ Not started |
| 3     | Core gameplay foundations            | 70           | ⬜ Not started |
| 4     | Module system & crafting             | 61           | ⬜ Not started |
| 5     | Script runtime, scheduler & sandbox  | 81           | ⬜ Not started |
| 6     | Core game GUI & map animations       | 72           | ⬜ Not started |
| 7     | Presentation & engagement (landing, achievements, notifications, i18n) | 40 | ⬜ Not started |
| 8     | Multiplayer, public API & hardening  | 64           | ⬜ Not started |
|        | **Total**                            | **538**      | |

---

## MVP definition

✅ **The MVP is the whole plan: Phases 0–8 (538 SP).** There is no smaller intermediate release milestone. The phase
order stays as written (stabilize → refactor → tests → gameplay foundations → modules and crafting → script runtime →
GUI → multiplayer, public API and hardening), and each phase still ships green (see [Guiding principles](./development-plan/guiding-principles.md)).

---

## Resuming work in a new session

Start the session with: *"Continue Phase N"*. The agent follows the session protocol in [`AGENTS.md` §7.6](../AGENTS.md): it reads
the phase file and its work log, checks `git status`, the branch list and open pull requests, and continues from the last
"next step".

---

## Contents

- [Guiding principles](./development-plan/guiding-principles.md)
- [Phase 0 — Stabilize & CI foundation (18 SP)](./development-plan/phase-0-stabilize-ci.md)
- [Phase 1 — Architecture refactor, clean architecture & NestJS migration (93 SP)](./development-plan/phase-1-architecture-refactor.md)
- [Phase 2 — Test infrastructure & coverage backfill (39 SP)](./development-plan/phase-2-test-infrastructure.md)
- [Phase 3 — Core gameplay foundations (70 SP)](./development-plan/phase-3-core-gameplay.md)
- [Phase 4 — Module system & crafting (61 SP)](./development-plan/phase-4-modules-crafting.md)
- [Phase 5 — Script runtime, scheduler & sandbox (81 SP)](./development-plan/phase-5-script-runtime.md)
- [Phase 6 — Core game GUI & map animations (72 SP)](./development-plan/phase-6-gui.md)
- [Phase 7 — Presentation & engagement (40 SP)](./development-plan/phase-7-presentation-engagement.md)
- [Phase 8 — Multiplayer, public API & production hardening (64 SP)](./development-plan/phase-8-multiplayer-api-hardening.md)
- [Risk register](./development-plan/risk-register.md)
- [Definition of Done](./development-plan/definition-of-done.md)
- Work logs: [phase 0](./development-plan/logs/phase-0-log.md), [phase 1](./development-plan/logs/phase-1-log.md), [phase 2](./development-plan/logs/phase-2-log.md), [phase 3](./development-plan/logs/phase-3-log.md), [phase 4](./development-plan/logs/phase-4-log.md), [phase 5](./development-plan/logs/phase-5-log.md), [phase 6](./development-plan/logs/phase-6-log.md), [phase 7](./development-plan/logs/phase-7-log.md), [phase 8](./development-plan/logs/phase-8-log.md)
