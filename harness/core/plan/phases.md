[← Development plan](./README.md)

# Phase files: structure and rules

How one phase of a development plan is written. This file is the **method** and is project-neutral. The project's values
(identifiers, symbols, scale, branch naming, how the specification is cited) are in the phase bindings (the project's `bindings.md` next to its phase files). The template
for a new phase is [`phase-index-template.md`](./phase-index-template.md), and for a task [`task-template.md`](./task-template.md).

A **phase** is a coherent stretch of work with a theme, a list of tasks, exit criteria, and a record of the changes that delivered
it. One phase is a **folder** in the plan's `phases/` folder, `phase-<n>-<slug>/` (a phase of the older layout is one file `phase-<n>-<slug>.md`; the
tools read both, so a finished phase need not be split, and `harness plan split <n>` splits one by choice).

---

## 1. Anatomy

A phase folder holds:

| File | Content |
| ---- | ------- |
| `README.md` | the **phase index**: the parts of the table below, with the task table generated from the task files |
| `<id>.md` | one **task**: its title (`# <id> — <title>`), a status line (`**Status:**`, `**Agent:**`, `**Size:**`, optional `**Needs:**` and `**Log:**`) and its description, from the [task template](./task-template.md) |
| `<id>.log.md` | the task's append-only log (the [task-log template](./task-log-template.md)), kept beside the task and separate from it, since a log is several times its task and most readers need only the task |
| `log.md` | the phase's work log, for what concerns the whole phase only (decisions, pauses, the close of the phase) |

A resuming agent reads the phase index and the file of the task it works on, never the other tasks. The phase index follows
the [phase index template](./phase-index-template.md):

| Part | Content |
| ---- | ------- |
| Back-link | Link to the plan index, first line |
| Title | `Phase <n> — <theme> (<size>)`; the size is the sum of its tasks |
| Status line | Status, branches (or a link to the implementation log), link to the phase's work log |
| Introduction | Optional: one paragraph on the goal and, if relevant, why this phase exists |
| Execution order | Optional: the order of tasks when it differs from their ids, with the reason |
| Task table | Generated from the task files (`harness plan summary`) between two markers: id (linking the task file), title, agent-complexity marker (where the plan uses them), size, status. In a phase of the older layout, one row per task with its whole description |
| Task legend | The status symbols, one line |
| Exit criteria | Observable conditions that make the phase done |
| Implementation log | A table of the changes (branch, tasks, pull request, status) that delivered the tasks |

## 2. Tasks

- **Id:** `<phase>.<number>`, optionally with a letter suffix for a subtask added later (`1.1a`). Ids are permanent: never renumber, never reuse. Other documents cite them.
- **Atomic:** a task is deliverable as one reviewable change, small enough to finish in a session. A larger item is split before it starts.
- **Complete:** a task's size includes its tests and documentation. A task is done only when the definition of done holds (cross-cutting document), not when the code exists.
- **Self-describing:** the description says what is delivered and how it is verified. It cites the specification sections it implements, in the form fixed by the bindings, so every requirement can be traced to a task and every task to a requirement.
- **Rated:** where the plan uses agent-complexity markers, every open task carries one in the `Agent` column (the plan method, section 7); a done task is exempt.
- **Ordered:** if a task depends on another, the dependency is named in the execution order or the description. A task never depends on a later phase.
- **Added by appending:** new work discovered during a phase gets the next free id. A task removed from scope is marked as dropped, with the reason, not deleted.

## 3. Status

- A task is `not started` until a change for it exists, `in progress` while its change is open, `done` when merged and verified.
- A phase is `not started` until its first task starts, `in progress` until its exit criteria hold, then `done`.
- The status of a phase is the same in the phase file and in the plan index; both change in the same change.
- Issues found in use are not a phase: they are the issue queue (the plan method, section 8), so that no phase has to stay open without a goal or an end.

## 4. Exit criteria

Write them so a person who did not do the work can check them: observable behavior, commands that pass, documents that exist.
Not "improve performance" but "the soak test sustains N users for M hours within the budget in <document>".

## 5. Implementation log

The log is the audit trail from the plan to the history of the repository: the pull request that delivered each task, with its
task ids. **In the phases that use per-task records (profile, section 4) it is not written by hand**: every squash commit carries a `Plan: <task id>` line, and
the plan-log command of the profile prints the table from the merged pull requests, so two tasks never edit the same table. A phase file
of that kind has no implementation-log table and says so under this heading. The other phases keep the table they have; append a row
when a change is merged: its branch, the task ids, the pull request link, and its status.

## 6. Where other content goes

A phase file holds the plan and its outcome, nothing else. There is no free-form notes section; each kind of content has one owner:

| Content | Goes to |
| ------- | ------- |
| Decisions and deviations made while working, problems, findings | The phase's work log |
| A decision that changes what the product is or does | The product knowledge, in the same change |
| A decision that changes how work is done or the order of phases | A cross-cutting document or the plan index |
| A design record required before a task | A decision record in the cross-cutting folder, cited by the task |
| Risks | The risk register |
| Open questions | The register of open items of the product knowledge |

## 7. Work log

Each phase has an append-only `log.md` in its folder (older layout: a log in `work-logs/` next to the phase files), with the entry template inside it. The phase index links
to it from the status line; the log links back to the phase index. The log records sessions, the exact next step and the commands
that verify the state; the phase file records only the plan and its outcome.

**A task writes its own log** `<task id>.log.md` beside its task file (start from the framework's [`task-log-template.md`](./task-log-template.md); older layout: a fragment in `work-logs/phase-<n>/<task id>.md`), so
that tasks worked on in parallel never edit the same file. The phase's own log keeps only what concerns the whole phase (decisions before
the start, pauses, the hand-over between waves). The log starts with a `**Status:**` line (🟡 while the task is in progress, ✅ when
it is done). **A finished task writes only its own log**, and its "next step" names what follows; the session-start hook prints the newest "next step" across the
phase log and the task logs, by the date of the entry, and the open tasks of the phase. The logs of a phase kept as one file stay as they are.

## 8. Splitting and merging phases

- Split a phase when it exceeds what can be reviewed as one unit or when its theme has two exit criteria that can be reached independently. The new phase takes the next free number; tasks keep their ids when possible, otherwise the old ids are recorded in the notes.
- Never merge phases: finished history is not rewritten.
- Record a changed development order in the plan index, not by renumbering.

## 9. Checks

`harness check plan` (part of the documentation check) holds this, for the phases kept as folders; a phase of the older layout (one file) is held to the sizes, the markers and the summary only, since the tools do not rewrite its history, and `harness plan split <n>` moves it to the folder layout.

**Checked**, each with a test that plants the defect:

- **The phase index** has the parts that apply, in the order of section 1: title, status line, optional execution order, the task table between its markers, the task legend (`Task status: …`), the exit criteria and the implementation-log heading. The exit criteria are the line `**Exit criteria:** …` of the template, not a heading of their own. A missing part, a part out of place and a heading in its stead are named.
- **Back-links.** The first line of the phase index links to the plan index, that of a task file to the phase index, that of the phase's `log.md` to the phase index, and that of a task log to its task file; each link must resolve to that document.
- **The work log.** A link in the status line resolves, and a phase that has a `log.md` links it. A task log starts with its `**Status:**` line.
- **Tasks.** A task has an id, a size and a status in its file (in a folder), the title size equals the sum of the task sizes, and every open task carries an agent-complexity marker where the plan uses them. The task table and the summary agree with the files.
- **Records.** A done task has the log of its own (`<id>.log.md`), or, in a phase that keeps a table in its implementation log, a row there (section 5).
- **Tasks cited elsewhere exist.** The tasks that a release order (the releases file, or the order of development of the index) or an execution order names, and those that a task `Needs`, exist in a phase or in the issue queue (under its old id as well), and a task never needs one of a later phase.

**Judgment**, which no tool reads: that the goal is clear, that a task is atomic and says how it is verified, that the exit criteria are observable (section 4), and that a decision is in the document that owns it (section 6).
