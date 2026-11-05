[← Development plan index](./DEVELOPMENT-PLAN.md)

# Releases of Bot RTS

The order of the releases and of the tasks in each, which the tools read to choose the next task. A row names tasks and
issues, in order, or "Phase N" for the tasks of a phase in its own order; never a backlog item, which the owner promotes into a task first.

Status: ⬜ planned · 🟡 developing · 🏷 a development version cut · ✅ released.

| Release | Status | Tasks, in order | Consumers | Notes |
| --- | --- | --- | --- | --- |
| `0.1.1` | ✅ | taken by task 17.18 (migration note followed, core scan clean); Phase 17 is closed |  |  |
| `0.1.2` | ⬜ | skips it on purpose, so that `0.2.0` is the framework's first chained migration |  |  |
| `0.2.0` | ✅ | takes its development version before the final tag, then the release (12.7), and turns on upstream reporting at `ask`: the migration splits the phases into task files, also Phase 17 by the owner's choice; Phase 12 becomes a normal phase that keeps its ids and ends with 12.7, and 12.5 and 12.6 move to the new issue queue under their old ids too |  |  |
| `0.3.0` | ⬜ | takes it |  |  |
| the release of the framework's Phase 2 (security) | ⬜ | takes it |  |  |

## Not scheduled

- None.

## Notes

**Order of development.** The phases are numbered in plan order, but Phase 11 was added later (2026-10-13), after the first
hands-on run of Phases 0–7, and it is **developed right after Phase 7 and before Phases 8–10**. It got the next free number so that the task numbers of
Phases 8–10 (referenced from the design, the testing strategy and the deployment gate) did not change. The order actually followed is:

**0 → 1 → 2 → 3 → 4 → 5 → 6 → 7 → 11 → 8 → 9 → 13 → 14 → 15 → 16 → 17 → 10**

Phase 13 (observability) was added on 2026-10-15 and is **developed after Phase 9 and before Phase 10** (owner decision 2026-10-16): its tracing and
its logs of every node help to build and debug the market, the escrow and the ledger of Phase 10, and replacing the logger before Phase 10 adds its
code is cheaper than after. Phase 14 was developed right after Phase 13. Phase 15 (harness fixes) was added on 2026-10-18 and is **developed before Phase 10**
(owner decision 2026-10-18): it makes the rules true and enforced and lets several agents work at once, which Phase 10 can use.
Phase 16 (CI speed) was added on 2026-10-18 and is **developed after Phase 15 and before Phase 10**: a task pull request waits about
21 minutes for the required checks today, and Phase 10 has many tasks.
Phase 17 (harness framework extraction, step 3 of the [harness-framework plan](../archived/harness-framework/README.md)) was added on 2026-10-20 and is
**developed after Phase 16 and before Phase 10**; its design task 17.1 may run while Phase 16 is in progress.
Phase 12 is open-ended and its tasks are done whenever they are found; it has no fixed place in the order.

**From 2026-11-03 this project is the first consumer of the harness framework** (the owner's decision): the framework
([AndLD/harness-framework](https://github.com/AndLD/harness-framework)) is developed first, and this project takes its releases to prove them on a
real project. Product work waits until the owner resumes it: Phase 10, and the open tasks 12.5 and 12.6. Each release is taken by the framework's
procedure and migration notes; a defect found while taking one becomes a task of the framework, not of this plan: the session first searches that repository's issues for the same problem (and adds to an existing report rather than posting another), then reports it as an issue in [AndLD/harness-framework](https://github.com/AndLD/harness-framework/issues) (posting it needs the owner's approval, given in the prompt or asked), records the issue in the task's log, and stops or rolls back if the defect blocks the migration. A framework session reads those issues first. The order (the framework's plan
index holds what each release contains):
