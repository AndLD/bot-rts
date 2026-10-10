# Development Plan

This plan turns the current prototype into a SOLID, well-tested, scalable codebase and then builds the core game.
It is sequenced so that **stabilization and testing infrastructure come before new features** — adding features on top
of the current base would compound the existing coupling and zero-test debt.

**Story points (SP):** Fibonacci scale, `1 SP ≈ 0.5 developer-day` (or one focused agent session). Estimates assume a
single engineer (or one agent working serially). Totals are additive per phase; they include implementation **and**
the required tests (unit + integration + e2e per the DoD in `AGENTS.md`).

**Summary**

| Phase | Theme                                | Story points |
| ----- | ------------------------------------ | ------------ |
| 0     | Stabilize, CI & safety-net tests     | 23           |
| 1     | Architecture refactor & NestJS migration | 86       |
| 2     | Test infrastructure & coverage backfill | 39        |
| 3     | Core gameplay foundations            | 72           |
| 4     | Module system & crafting             | 59           |
| 5     | Script runtime, scheduler & sandbox  | 83           |
| 6     | Core game GUI & map animations       | 72           |
| 7     | Presentation & engagement (landing, achievements, notifications, i18n) | 40 |
| 8     | Multiplayer, public API & hardening  | 64           |
|        | **Total**                            | **538**      |

---

## MVP definition

✅ **The MVP is the whole plan: Phases 0–8 (538 SP).** There is no smaller intermediate release milestone. The phase
order stays as written (stabilize → refactor → tests → gameplay foundations → modules and crafting → script runtime →
GUI → multiplayer, public API and hardening), and each phase still ships green (see [Guiding principles](./development-plan/guiding-principles.md)).

---

## Contents

- [Guiding principles](./development-plan/guiding-principles.md)
- [Phase 0 — Stabilize & CI foundation (23 SP)](./development-plan/phase-0-stabilize-ci.md)
- [Phase 1 — Architecture refactor, clean architecture & NestJS migration (86 SP)](./development-plan/phase-1-architecture-refactor.md)
- [Phase 2 — Test infrastructure & coverage backfill (39 SP)](./development-plan/phase-2-test-infrastructure.md)
- [Phase 3 — Core gameplay foundations (72 SP)](./development-plan/phase-3-core-gameplay.md)
- [Phase 4 — Module system & crafting (59 SP)](./development-plan/phase-4-modules-crafting.md)
- [Phase 5 — Script runtime, scheduler & sandbox (83 SP)](./development-plan/phase-5-script-runtime.md)
- [Phase 6 — Core game GUI & map animations (72 SP)](./development-plan/phase-6-gui.md)
- [Phase 7 — Presentation & engagement (40 SP)](./development-plan/phase-7-presentation-engagement.md)
- [Phase 8 — Multiplayer, public API & production hardening (64 SP)](./development-plan/phase-8-multiplayer-api-hardening.md)
- [Risk register](./development-plan/risk-register.md)
- [Definition of Done](./development-plan/definition-of-done.md)
