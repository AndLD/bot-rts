[← Development plan index](<relative link to the plan index>)

# Releases of <project>

The order of the releases and of the tasks in each. The tools read it to choose the next task and to check the plan; the plan index links to it and shows the
current release in a block that `harness plan summary` writes. A project that ships no versions has no such file.

**Status:** ⬜ planned · 🟡 developing · 🏷 a development version cut (`dev.N`) · ✅ released.

| Release | Status | Tasks, in order | Consumers | Notes |
| ------- | ------ | --------------- | --------- | ----- |
| `<version>` | ⬜ | <task ids, in order; "Phase N" for the tasks of a phase in its own order> | <who takes the release, and what it does with it> | <why this order, with the date> |

## Not scheduled

- <task or issue ids that no release holds yet, one per line, each with a reason>

Rules:

- The tools read the column "Tasks, in order" only; the other columns are for people. A column is found by its name, so a project may add its own.
- A row names **tasks and issues** (`<phase>.<n>`, `I-<n>`), or "Phase N". It never names a backlog item (`B-<n>`): the owner promotes the item into a task of a
  phase first. The check of the plan fails on an id that exists nowhere and on a backlog item.
- Numbers are identities, not order: the order of the rows and of the ids inside a row is the order of development. A task that no row names follows, phase by
  phase, in the phase's own order.
- A decision that changes the order changes this file, with the date and the reason in the notes; the plan index is not edited for it.
