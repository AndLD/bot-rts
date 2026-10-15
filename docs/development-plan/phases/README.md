[← Development plan](../README.md)

# Phase files: structure and rules

How one phase of a development plan is written. This file is the **method** and is project-neutral. The project's values
(identifiers, symbols, scale, branch naming, how the specification is cited) are in [`bindings.md`](./bindings.md). The template
for a new phase is [`_template.md`](./_template.md).

A **phase** is a coherent stretch of work with a theme, a list of tasks, exit criteria, and a record of the changes that delivered
it. One phase is one file in this folder.

---

## 1. Anatomy

| Part | Content |
| ---- | ------- |
| Back-link | Link to the plan index, first line |
| Title | `Phase <n> — <theme> (<size>)`; the size is the sum of its tasks |
| Status line | Status, branches (or a link to the implementation log), link to the work log |
| Introduction | Optional: one paragraph on the goal and, if relevant, why this phase exists |
| Execution order | Optional: the order of tasks when it differs from their ids, with the reason |
| Task table | One row per task: id, description, size, status |
| Task legend | The status symbols, one line |
| Exit criteria | Observable conditions that make the phase done |
| Implementation log | A table of the changes (branch, tasks, pull request, status) that delivered the tasks |
| Notes | Optional: decisions, design records, risks specific to this phase |

## 2. Tasks

- **Id:** `<phase>.<number>`, optionally with a letter suffix for a subtask added later (`1.1a`). Ids are permanent: never renumber, never reuse. Other documents cite them.
- **Atomic:** a task is deliverable as one reviewable change, small enough to finish in a session. A larger item is split before it starts.
- **Complete:** a task's size includes its tests and documentation. A task is done only when the definition of done holds (cross-cutting document), not when the code exists.
- **Self-describing:** the description says what is delivered and how it is verified. It cites the specification sections it implements, in the form fixed by the bindings, so every requirement can be traced to a task and every task to a requirement.
- **Ordered:** if a task depends on another, the dependency is named in the execution order or the description. A task never depends on a later phase.
- **Added by appending:** new work discovered during a phase gets the next free id. A task removed from scope is marked as dropped, with the reason, not deleted.

## 3. Status

- A task is `not started` until a change for it exists, `in progress` while its change is open, `done` when merged and verified.
- A phase is `not started` until its first task starts, `in progress` until its exit criteria hold, then `done`.
- The status of a phase is the same in the phase file and in the plan index; both change in the same change.
- An open-ended phase (issues found in use, stabilization) declares it at the top; its size is stated as growing.

## 4. Exit criteria

Write them so a person who did not do the work can check them: observable behavior, commands that pass, documents that exist.
Not "improve performance" but "the soak test sustains N players for M hours within the budget in <document>".

## 5. Implementation log

Append a row when a change is merged: its branch, the task ids, the pull request link, and its status. A branch may cover several
closely related tasks. The log is the audit trail from the plan to the history of the repository; keep it accurate, it is
cheap to write at merge time and expensive to reconstruct.

## 6. Splitting and merging phases

- Split a phase when it exceeds what can be reviewed as one unit or when its theme has two exit criteria that can be reached independently. The new phase takes the next free number; tasks keep their ids when possible, otherwise the old ids are recorded in the notes.
- Never merge phases: finished history is not rewritten.
- Record a changed development order in the plan index, not by renumbering.

## 7. Checks

A phase file is conformant when: the anatomy parts that apply are present and in order; every task has an id, a size and a status;
the title size equals the sum of the task sizes; the status agrees with the index; the work-log link resolves; every task cited
elsewhere exists here; every done task has a row in the implementation log.
