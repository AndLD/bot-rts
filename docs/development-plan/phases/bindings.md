[← README](./README.md)

# Bindings for this repository

Values for the project-neutral method in [`README.md`](./README.md).

| Role in the method | Value here |
| ------------------ | ---------- |
| File name | `phase-<n>-<slug>.md` |
| Plan index | [`../DEVELOPMENT-PLAN.md`](../DEVELOPMENT-PLAN.md) |
| Work log | `work-logs/phase-<n>-log.md` |
| Task id | `<phase>.<number>` with an optional letter suffix (`1.1a`) |
| Status symbols | ⬜ not started · 🟡 in progress · ✅ done |
| Size unit | Story points (SP), Fibonacci scale; 1 SP is about half a developer-day or one focused agent session |
| Specification citation | `design §<section>` for the game design (for example `design §12.4`), `AGENTS.md §<section>` for the engineering rules |
| Definition of done | [`../cross-cutting/definition-of-done.md`](../cross-cutting/definition-of-done.md), which points to `AGENTS.md` §6.5 |
| Branch name | `feature/<task-id>-<slug>` (`bugfix/`, `docs/`, `chore/` by type); rules in `AGENTS.md` §7.1 |
| Merge | Squash merge into `develop`; branches are kept after merging (`AGENTS.md` §7.2–7.3) |
| Implementation log columns | Branch · Tasks · PR · Status (`✅ merged`, `🟡`) |
| Open-ended phase | Phase 12; its size is written `5 (grows)` |
| Out-of-order development | Phase 11 is developed after Phase 7; the plan index records the order |
| Dependencies on tooling | A phase may name the stack tools it needs; the stack is defined in `AGENTS.md` §2 |
