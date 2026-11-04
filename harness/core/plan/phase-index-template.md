← Development plan: link to the plan index here (`[← Development plan](../../<plan index>)`), first line of `phases/phase-<n>-<slug>/README.md`.

# Phase <n> — <Theme> (<size> SP)

**Status:** ⬜ Not started · **Work log:** `log.md`, and a log beside each task (`<id>.log.md`); write the first as a link, `[log](./log.md)`

<Goal of the phase in one paragraph. Why it exists and what it unlocks.>

**Execution order:** <only if different from the ids, with the reason>

<!-- phase-tasks:start -->
| # | Task | Agent | SP | Status |
| - | ---- | ----- | -- | ------ |
<!-- phase-tasks:end -->

Task status: ⬜ not started · 🟡 in progress (branch noted in the task's log) · ✅ done. Agent: the task's agent-complexity marker (plan method, section 7); a plan without markers leaves the column out.

**Exit criteria:** <observable conditions a reviewer can check>

## Implementation log

Printed from the merged pull requests: the plan-log command of the profile (every squash commit carries a `Plan: <task id>` line). Each task writes
its own log, `<id>.log.md`, beside its task file.

<!-- The block between the task markers is generated from the task files by `harness plan summary`; edit a task file, not the table. -->
