[← Development plan index](../../DEVELOPMENT-PLAN.md)

# Phase 12 — Issues and stabilization (16 SP)

**Status:** 🟡 In progress · **Branches:** `bugfix/12.2-button-styling` (see the [implementation log](#implementation-log)) · **Work log:** [log](./log.md), and a log beside each task (`<id>.log.md`)

A running collection of **issues found while using and testing the finished phases**: defects, performance problems and
rough edges that are not part of any earlier phase's scope. It is open-ended: new issues are added as tasks (`12.N`) when
they are found, each with a reproduction, and the phase is closed when the user says so. It needs nothing from Phases 9 and 10
and can be developed at any time; its points count in the total of the plan index and grow as issues are added.

**How an issue becomes a task.** Add a row to the table with the symptom and how to reproduce it, the expected result, and a
story-point estimate; fix it on its own branch (`bugfix/12.N-slug`) with a test that reproduces it first (method §4, `harness/core/method/method.md`), and
update this file, the work log and the plan index in the same PR. If the cause turns out to be a design problem, record the
decision in the matching `docs/product-knowledge/game-design/` file.

<!-- phase-tasks:start -->
| # | Task | Agent | SP | Status |
| - | ---- | ----- | -- | ------ |
| [12.1](./12.1.md) | A single runaway script keeps the tick time high when few players are online. | — | 5 | ✅ |
| [12.2](./12.2.md) | Buttons across the client have inconsistent padding and unreadable disabled states. | — | 3 | ✅ |
| [12.3](./12.3.md) | A new base cannot craft anything: its storage starts with oil only. | — | 3 | ✅ |
| [12.4](./12.4.md) | The pre-push gate cannot start its database in a worktree, so sessions bypass it. | C2 | 3 | ✅ |
| [12.7](./12.7.md) | An agent that resumes a phase reads the whole phase file, and a finished task is logged twice. | C1 | 2 | 🟡 |
<!-- phase-tasks:end -->

## Exit criteria

Every issue listed above is fixed with a test that failed before the fix, or is closed with a recorded reason; the coverage
gate stays green. The phase is closed by the user, not by the list running out.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `bugfix/12.2-button-styling` | 12.2 | [#206](https://github.com/AndLD/bot-rts/pull/206) | merged |
| `bugfix/12.1-runaway-script-tick` | 12.1 | [#207](https://github.com/AndLD/bot-rts/pull/207) | merged |
| `bugfix/12.3-starter-resources` | 12.3 | [#258](https://github.com/AndLD/bot-rts/pull/258) | merged |
| `bugfix/12.4-prepush-database` | 12.4 | [#273](https://github.com/AndLD/bot-rts/pull/273) | open |
