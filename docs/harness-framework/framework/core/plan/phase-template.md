← Plan index: link to the plan index here (`[← Development plan index](../<plan index>)`).

# Phase <n> — <Theme> (<size>)

**Status:** ⬜ Not started · **Branches:** see the [implementation log](#implementation-log) · **Work log:** `phase-<n>-log` in `work-logs/`, and one fragment per task in `work-logs/phase-<n>/`

<Goal of the phase in one paragraph. Why it exists and what it unlocks.>

**Execution order:** <only if different from the ids, with the reason>

| #   | Task                                                          | Agent | SP  | Status |
| --- | ------------------------------------------------------------- | ----- | --- | ------ |
| n.1 | <What is delivered and how it is verified. Cites the specification section (profile, section 4).> | C2    | 3   | ⬜     |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done. Agent: the task's agent-complexity marker (plan method, section 7); a plan without markers leaves the column out.

**Exit criteria:** <observable conditions a reviewer can check>

## Implementation log

Printed from the merged pull requests: the plan-log command of the profile (every squash commit carries a `Plan: <task id>` line). Each task writes
its own log fragment in `work-logs/phase-<n>/`.
