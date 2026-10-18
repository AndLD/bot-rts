[← README](./README.md)

# Bindings for this repository

Values for the project-neutral method in [`README.md`](./README.md). Values shared with the rest of the harness are kept
once in the [project profile](../profile.md); the rows below link to it.

| Role in the method | Value here |
| ------------------ | ---------- |
| Index document | [`DEVELOPMENT-PLAN.md`](./DEVELOPMENT-PLAN.md) |
| Phase files | `phases/phase-<n>-<slug>.md`, rules in [`phases/README.md`](./phases/README.md) |
| Cross-cutting documents | [`guiding-principles`](./cross-cutting/guiding-principles.md), [`definition-of-done`](./cross-cutting/definition-of-done.md) (points to the [method §4](../engineering/method.md#4-definition-of-done)), [`risk-register`](./cross-cutting/risk-register.md), [`rfc-5.1-execution-model`](./cross-cutting/rfc-5.1-execution-model.md) (the design record required by task 5.1) |
| Work logs | `phases/work-logs/phase-<n>-log.md` |
| Phase and task status symbols | the status symbols of the [profile](../profile.md#4-plan) |
| Estimation scale | the estimation scale of the [profile](../profile.md#4-plan) |
| Product knowledge cited | `docs/product-knowledge/game-design/GAME-DESIGN.md` and `docs/product-knowledge/game-design/` (section ids written as `design §12.4`) |
| Quality bar and workflow cited | `AGENTS.md` (§7 Git and merge rules), the [method](../engineering/method.md) (§4 definition of done, §5 Git workflow, §6 session protocol) |
| Deployment gate | The tasks named in the "Deployment gate" section of the index |
| Resume request forms | the resume phrases of the [profile](../profile.md#4-plan); the request is the approval for the named phases' pull requests (`AGENTS.md` §7.5) |
| Guiding principles as applied | Principles 1–2 shaped Phases 0–1: the move from MongoDB to PostgreSQL came before the NestJS migration, and the safety-net tests of task 1.9 before the refactor. Scope: the game is an endless sandbox (design §1), so no match, round or scoring subsystem is planned |
| Out-of-order phases | Phase 11 is developed after Phase 7; the order is recorded in the index |
| Open-ended phase | Phase 12 (issues found in use); its size grows |
| Testing documentation | [`docs/testing/`](../testing/README.md) (current), [by phase](../testing/by-phase.md) (historical) |
