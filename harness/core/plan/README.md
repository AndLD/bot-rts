# Development plan: structure and rules

How a development plan is organized and maintained. This file is the **method** and is project-neutral, so it can move to a
blueprint unchanged. What belongs to one project (file names, status symbols, estimation scale, gates, the resume phrase) is in
the plan bindings (the project's `bindings.md` next to the plan index). The plan itself is the index document named there.

---

## 1. Purpose

A plan turns the product knowledge and the quality bar into ordered, deliverable work, and carries the state of that work so
any session, human or agent, can stop and resume from the repository alone. It answers four questions:

1. What is being built, in what order, and why this order?
2. What is done, in progress and not started?
3. What must be true before work is released or deployed?
4. What do I read and update to continue?

## 2. Structure

```
<plan folder>/
  <index>.md        the plan: summary, order, scope, gates, how to resume, contents (the only entry point)
  bindings.md       this project's values for the method
  phases/           one folder per phase, and the phase bindings
    phase-<n>-<slug>/
      README.md     the phase index: goal, order, exit criteria, and the task table generated from the task files
      <id>.md       one task: its description, status, size, marker, dependencies and the link to its log
      <id>.log.md   the task's append-only log, used to resume a session
      log.md        what concerns the whole phase (decisions, pauses, the close)
  issues/           the issue queue: the defects and improvements found in use (section 8)
  cross-cutting/    documents that apply to every phase (section 4)
```

The method and its templates are the framework's (`core/plan/`): this file, the rules of a phase file ([`phases.md`](./phases.md)), the
templates of the index ([`index-template.md`](./index-template.md)), a phase index ([`phase-index-template.md`](./phase-index-template.md)), a task ([`task-template.md`](./task-template.md)) and a task log
([`task-log-template.md`](./task-log-template.md)), the definition of done ([`definition-of-done.md`](./definition-of-done.md)) and the guiding
principles ([`guiding-principles.md`](./guiding-principles.md)). The project's plan folder holds only its own files.

Rules of the structure:

- **One entry point.** Everything in the plan folder is reachable from the index. A document that is not linked from the index does not exist for an agent.
- **One owner per fact.** The index owns the summary (phase names, sizes, status, order); a phase index owns the goal, the order and the exit criteria, and a task file owns its task; a work log owns the session history; a cross-cutting document owns its rule. Other places link; they do not copy.
- **Add by adding.** A new phase is one new folder in `phases/` (its index and its work log), plus one row in the index summary and one line in its contents. Nothing else is edited by hand.
- **Specific content stays out.** The plan states *what and when*. How to build (tools, commands) lives in the stack documents; what the product is lives in the product knowledge. The plan cites them by link and section id.

## 3. The index document

Required sections, in this order (template: [`index-template.md`](./index-template.md)):

| Section | Content |
| ------- | ------- |
| Introduction | Goal of the plan and the sequencing principle, in a few sentences |
| Legends | Status symbols of phases and tasks, the estimation scale and what an estimate includes |
| Summary | One table: phase number, theme, size, the range of agent-complexity markers when the plan uses them (section 7), status, and a total row |
| Order of development | The actual order when it differs from the numbering, with the reason |
| Scope definition | What the finished product is for this plan (the minimum releasable scope), and what is excluded |
| Gates | Conditions that must hold before the product is deployed or released, naming the tasks that satisfy them |
| Resuming work | The request forms that start a session, what the session reads first, when it stops, who approves what |
| Contents | Links to every phase, cross-cutting document and work log |

Rules:

- The summary table is derived from the phase files. When a phase changes status or size, the index is updated in the **same change**. The plan-summary command of the profile writes it, and the contents list, between their marker comments (see the template).
- Numbers are identities, not order. Never renumber a phase or a task: other documents cite them. Record a different order in the "Order of development" section.
- A total counts only what the legend says it counts. The issue queue is shown apart from the phases' totals.
- A gate names task ids, not prose, so it can be checked mechanically.

## 4. Cross-cutting documents

Documents that apply to all phases live in `cross-cutting/`. A document belongs there only if it is referenced by more than one
phase and is not a rule of the product. Typical kinds:

| Kind | What it holds |
| ---- | ------------- |
| Guiding principles | The sequencing and delivery principles every phase follows; the framework's [`guiding-principles.md`](./guiding-principles.md) unless the project adds its own |
| Definition of done | A pointer to the single place where "done" is defined; it never restates the checklist (the framework's [`definition-of-done.md`](./definition-of-done.md)) |
| Risk register | Risks with likelihood, impact and mitigation, reviewed at each milestone |
| Decision records | A design record (RFC) that a phase task requires before implementation, kept with the decision and its date |

Each cross-cutting document has one owner and is linked from the index. A decision record is immutable after acceptance; a later
decision supersedes it with a new record and a link.

## 5. Work logs

One append-only log per task, `<id>.log.md` beside its task file, and `log.md` in the phase folder for what concerns the whole phase (a phase kept as one file, the older layout, has one log in `phases/work-logs/` and a fragment per task in `phases/work-logs/phase-<n>/`; the profile names them); newest entry at the bottom, written when a session ends, pauses or finishes a task. The entry
template lives inside each log. The log is the resume point: it states what is done, the exact next step and the commands that
verify the current state. The log is part of the change that it describes.

## 6. Maintaining the plan

| Event | Update |
| ----- | ------ |
| A phase starts | Phase file status, index summary |
| A task starts or finishes | Task status in the task file (the phase index table is regenerated by `harness plan summary`), the task's log (the implementation log is printed from the merged pull requests; the older phases keep their table) |
| A phase finishes | Exit criteria checked, phase file and index status, work log, risk review |
| The scope changes | Phase file tasks or a new phase, index summary and total, gates if affected, the product knowledge if a decision changed |
| A decision changes the order | The "Order of development" section, with the date and the reason |

Consistency checks (done in review, automated where possible): the index summary agrees with each phase file; every phase is in
the contents; every gate task exists; every task cited elsewhere exists; no document in the folder is unreachable; where the plan uses
agent-complexity markers, every open task carries one (section 7).

## 7. Agent-complexity markers (optional)

A plan may rate each task by the **reasoning** it needs, so that the owner or an orchestrator gives it a model and an effort that fit. A
marker rates the reasoning, not the size: a large mechanical task is light, a small decision with wide consequences is heavy. The scale and
the meaning of each marker are a profile role (section 4 of the profile), and so is the model map, the model and effort for each marker.
The framework's scale has three markers:

| Marker | Meaning |
| ------ | ------- |
| `C1` | routine: mechanical, fully specified, obvious to verify |
| `C2` | standard engineering: a component to a clear specification with tests, tools to work out |
| `C3` | judgment: research, correctness-critical design, synthesis |

Rules:

- **Where the plan uses markers**, the task table of a phase has an `Agent` column just before the size (in a phase folder, every task file has an `**Agent:**` field), and every **open** task (not
  started or in progress) carries one marker of the scale, written `C` and a number.
- **Done tasks are exempt.** A project that turns the markers on does not rate its history; a marker recorded on a done task stays.
- **The index shows the range.** The summary gives each phase the range of its markers, lightest to heaviest (`C1–C3`, one marker
  alone, or `—` when no task has one), written by the plan-summary command with the rest of the summary.
- **Conformance.** The documentation check names every open task without a marker, so a new task is rated when it is added.
- **Re-rating.** A marker changes when the scope of its task changes, in the change that changes the scope; a re-rating by the owner
  is recorded in the phase file or its work log with the date.
- **On or off.** The bootstrap turns the markers on. A project turns them off by removing the scale from the profile; the column and
  the range are then absent, and nothing is checked.

## 8. The issue queue

The defects and improvements found in use are not a phase: a phase has a goal, exit criteria and an end, and the work found in use has none, so keeping it
in a phase that never ends distorts the totals and mixes defects with design work that belongs to a phase. They are an **issue queue** next to the phases,
a folder named by the profile (`paths.issues`) in the layout of a phase folder:

| File | Content |
| ---- | ------- |
| `README.md` | the index of the **open and in-progress** issues only, generated by the plan-summary command: issue, title, area, marker, size, status, reports |
| `I-<n>.md` | one issue, from the [issue template](./issue-template.md): ids of its own (`I-<n>`, never reused), a status line (`Status`, `Agent`, `Size`, `Area`, `Reported`, optional `Formerly` and `Log`) and the description |
| `I-<n>.log.md` | the issue's append-only log, beside it |
| `archived/` | the finished issues, with their logs, and a generated `README.md` that lists them |

- **Branch and claim.** An issue is worked on a branch `bugfix/I-<n>-<slug>`; its claim and its commits carry `Plan: I-<n>`, as a task's do. "Work the issue queue" and
  "Fix I-<n>" approve the pull requests of the issues they name, as "Start Phase N" approves a phase's.
- **Area and reports.** Each issue records an `Area:` from the list of areas of the framework's migration notes (or `Unclassified`), and in `Reported:` every report on the
  host that points to it (several reports can be one problem). The index and the archive show the title and the area, so that a new report is matched against the
  indexes before any issue file is opened.
- **Archive.** When an issue is done (✅) the plan-summary command moves its file and its log into `archived/`, lists it in the archive's index and follows every link
  to them. An agent that works the queue reads the open index, never the archive; the archive is read to find out whether a report is a problem that was fixed already.
- **Size.** The plan index shows the open issues and their size on a line of their own, apart from the phases' totals.
- **A move never renames a planned task.** A planned task keeps its id wherever the plan goes, so that an order written by id survives. When a project turns an
  open-ended phase into a normal phase, only its tasks that have not started and that no order names (the defects) become issues, each naming its old id
  (`I-1, formerly 12.5`); a task in progress or done never moves. The check of the plan fails when an order of development or an execution order names an id
  that exists nowhere: in a phase, or in the queue or its archive under its old id.

