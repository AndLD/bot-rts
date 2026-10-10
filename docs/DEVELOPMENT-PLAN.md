# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Phase status legend:** ⬜ Not started · 🟡 In progress · ✅ Done. A phase's status is kept in the summary table below and
in the phase file, and is updated in the pull request that starts or finishes it (AGENTS.md §6.5).

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
