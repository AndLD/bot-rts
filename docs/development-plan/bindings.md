[← README](./README.md)

# Bindings for this repository

Values for the project-neutral method in [`README.md`](./README.md).

| Role in the method | Value here |
| ------------------ | ---------- |
| Index document | [`DEVELOPMENT-PLAN.md`](./DEVELOPMENT-PLAN.md) |
| Phase files | `phases/phase-<n>-<slug>.md`, rules in [`phases/README.md`](./phases/README.md) |
| Cross-cutting documents | [`guiding-principles`](./cross-cutting/guiding-principles.md), [`definition-of-done`](./cross-cutting/definition-of-done.md) (points to `AGENTS.md` §6.5), [`risk-register`](./cross-cutting/risk-register.md), [`rfc-5.1-execution-model`](./cross-cutting/rfc-5.1-execution-model.md) (the design record required by task 5.1) |
| Work logs | `work-logs/phase-<n>-log.md` |
| Phase and task status symbols | ⬜ not started · 🟡 in progress · ✅ done |
| Estimation scale | Story points (SP), Fibonacci; 1 SP is about half a developer-day or one focused agent session; estimates include implementation and the tests the definition of done requires |
| Product knowledge cited | `docs/GAME-DESIGN.md` and `docs/game-design/` (section ids written as `design §12.4`) |
| Quality bar and workflow cited | `AGENTS.md` (§6.5 definition of done, §7 Git Flow and session protocol) |
| Deployment gate | The tasks named in the "Deployment gate" section of the index |
| Resume request forms | "Start Phase N", "Start Phases N-M", "Continue Phase N"; the request is the approval for the named phases' pull requests (`AGENTS.md` §7.5) |
| Out-of-order phases | Phase 11 is developed after Phase 7; the order is recorded in the index |
| Open-ended phase | Phase 12 (issues found in use); its size grows |
| Testing documentation | [`docs/testing/`](../testing/README.md) (current), [by phase](../testing/by-phase.md) (historical) |
