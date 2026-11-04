[← Development plan index](../../DEVELOPMENT-PLAN.md)

# Phase 12 — Issues and stabilization (16 SP)

**Status:** 🟡 In progress · **Branches:** `bugfix/12.2-button-styling` (see the [implementation log](#implementation-log)) · **Work log:** [log](./log.md), and a log beside each task (`<id>.log.md`)

The issues found while using and testing the finished phases (12.1 to 12.4), and the task 12.7 that moves the plan to the framework's `0.2.0` layout. Phase 12 was
open-ended until the framework's `0.2.0`; it is a normal phase now and ends with 12.7. Its two defects that had not started, 12.5 and 12.6, moved to the
[issue queue](../../issues/README.md) as I-1 and I-2 (their old ids stay in their files as `Formerly`), and a defect or improvement found in use from now on
is recorded there, not here.

**Execution order:** 12.1 → 12.2 → 12.3 → 12.4 → 12.7 (the ids; 12.5 and 12.6 are in the queue).

<!-- phase-tasks:start -->
| # | Task | Agent | SP | Status |
| - | ---- | ----- | -- | ------ |
| [12.1](./12.1.md) | A single runaway script keeps the tick time high when few players are online. | — | 5 | ✅ |
| [12.2](./12.2.md) | Buttons across the client have inconsistent padding and unreadable disabled states. | — | 3 | ✅ |
| [12.3](./12.3.md) | A new base cannot craft anything: its storage starts with oil only. | — | 3 | ✅ |
| [12.4](./12.4.md) | The pre-push gate cannot start its database in a worktree, so sessions bypass it. | C2 | 3 | ✅ |
| [12.7](./12.7.md) | An agent that resumes a phase reads the whole phase file, and a finished task is logged twice. | C1 | 2 | 🟡 |
<!-- phase-tasks:end -->

Task status: ⬜ not started · 🟡 in progress (branch noted in the task's log) · ✅ done. Agent: the task's agent-complexity marker (plan method, section 7); a plan without markers leaves the column out.

**Exit criteria:** every task listed above is done with a test that failed before the fix, or is closed with a recorded reason; the coverage gate stays green; the project follows the framework's migration notes up to `0.2.0` (12.7).

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `bugfix/12.2-button-styling` | 12.2 | [#206](https://github.com/AndLD/bot-rts/pull/206) | merged |
| `bugfix/12.1-runaway-script-tick` | 12.1 | [#207](https://github.com/AndLD/bot-rts/pull/207) | merged |
| `bugfix/12.3-starter-resources` | 12.3 | [#258](https://github.com/AndLD/bot-rts/pull/258) | merged |
| `bugfix/12.4-prepush-database` | 12.4 | [#273](https://github.com/AndLD/bot-rts/pull/273) | open |
