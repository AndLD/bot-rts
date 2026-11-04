[← Development plan](../DEVELOPMENT-PLAN.md)

# Issue queue

The defects and improvements found in use. They are not a phase: they have no goal, no exit criteria and no end, and their size is not in the totals of the
plan. Each issue is a file of its own here (`I-<n>.md`, from the framework's issue template) with its log beside it (`I-<n>.log.md`), and a branch
`bugfix/I-<n>-<slug>`. This index lists the open and in-progress issues only; an issue that is done moves to the [archive](./archived/README.md)
when `harness plan summary` runs, so an agent that works the queue reads this file and never the archive.

Before adding an issue, look for the same or a close problem in this index and the archive (title and area first, then the files); the same problem is added to
the `Reported:` line of the issue that holds it.

<!-- issue-queue:start -->
| Issue | Title | Area | Agent | SP | Status | Reported |
| ----- | ----- | ---- | ----- | -- | ------ | -------- |
| [I-1](./I-1.md) | Recurring test flakes are answered by re-runs but not recorded or fixed. | Unclassified | C2 | 3 | ⬜ | — |
| [I-2](./I-2.md) | The client runs a Next.js version with known critical vulnerabilities. | Unclassified | C1 | 1 | ⬜ | — |
<!-- issue-queue:end -->
