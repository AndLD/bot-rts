[← README](../../../harness/core/plan/phases.md)

# Bindings for this repository

Values for the project-neutral method in [`harness/core/plan/phases.md`](../../../harness/core/plan/phases.md). Values shared with the rest of the harness are kept
once in the [project profile](../../profile.md); the rows below link to it.

| Role in the method | Value here |
| ------------------ | ---------- |
| File name | `phase-<n>-<slug>.md` |
| Plan index | [`../DEVELOPMENT-PLAN.md`](../DEVELOPMENT-PLAN.md) |
| Work log | `work-logs/phase-<n>-log.md` |
| Task id | the task-id format of the [profile](../../profile.md#4-plan) |
| Status symbols | the status symbols of the [profile](../../profile.md#4-plan) |
| Size unit | the estimation scale of the [profile](../../profile.md#4-plan) |
| Specification citation | `design §<section>` for the game design (for example `design §12.4`), `AGENTS.md §<section>` for the always-loaded rules, `method §<section>` for the [method](../../../harness/core/method/method.md) and `stack §<section>` for the [stack file](../../engineering/stack.md) |
| Definition of done | [`harness/core/plan/definition-of-done.md`](../../../harness/core/plan/definition-of-done.md), which points to the [method §4](../../../harness/core/method/method.md#4-definition-of-done) |
| Branch name | the branch types of the [profile](../../profile.md#3-branches-and-merging); rules in `AGENTS.md` §7.1 |
| Merge | the merge strategy and branch retention of the [profile](../../profile.md#3-branches-and-merging) (`AGENTS.md` §7.2–7.3) |
| Implementation log columns | Branch · Tasks · PR · Status (`✅ merged`, `🟡`) |
| Open-ended phase | Phase 12; its size is written `5 (grows)` |
| Out-of-order development | Phase 11 is developed after Phase 7; the plan index records the order |
| Dependencies on tooling | A phase may name the stack tools it needs; the stack is defined in [stack §1](../../engineering/stack.md#1-tech-stack-and-test-tooling-do-not-substitute) |
