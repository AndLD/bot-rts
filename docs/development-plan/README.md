# Development plan: structure and rules

How a development plan is organized and maintained. This file is the **method** and is project-neutral, so it can move to a
blueprint unchanged. What belongs to one project (file names, status symbols, estimation scale, gates, the resume phrase) is in
[`bindings.md`](./bindings.md). The plan itself is the index document named there.

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
development-plan/
  <index>.md        the plan: summary, order, scope, gates, how to resume, contents (the only entry point)
  README.md         this method
  bindings.md       this project's values for the method
  _template.md      template of the index
  phases/           one file per phase (README, bindings, template inside)
    work-logs/      one append-only log per phase, next to the phase files, used to resume a session
  cross-cutting/    documents that apply to every phase (section 4)
```

Rules of the structure:

- **One entry point.** Everything in the plan folder is reachable from the index. A document that is not linked from the index does not exist for an agent.
- **One owner per fact.** The index owns the summary (phase names, sizes, status, order); a phase file owns its tasks and exit criteria; a work log owns the session history; a cross-cutting document owns its rule. Other places link; they do not copy.
- **Add by adding.** A new phase is one new file in `phases/` and one new work log, plus one row in the index summary and one line in its contents. Nothing else is edited by hand.
- **Specific content stays out.** The plan states *what and when*. How to build (tools, commands) lives in the stack documents; what the product is lives in the product knowledge. The plan cites them by link and section id.

## 3. The index document

Required sections, in this order (template: [`_template.md`](./_template.md)):

| Section | Content |
| ------- | ------- |
| Introduction | Goal of the plan and the sequencing principle, in a few sentences |
| Legends | Status symbols of phases and tasks, the estimation scale and what an estimate includes |
| Summary | One table: phase number, theme, size, status, and a total row |
| Order of development | The actual order when it differs from the numbering, with the reason |
| Scope definition | What the finished product is for this plan (the minimum releasable scope), and what is excluded |
| Gates | Conditions that must hold before the product is deployed or released, naming the tasks that satisfy them |
| Resuming work | The request forms that start a session, what the session reads first, when it stops, who approves what |
| Contents | Links to every phase, cross-cutting document and work log |

Rules:

- The summary table is derived from the phase files. When a phase changes status or size, the index is updated in the **same change**.
- Numbers are identities, not order. Never renumber a phase or a task: other documents cite them. Record a different order in the "Order of development" section.
- A total counts only what the legend says it counts; an open-ended phase is marked as growing.
- A gate names task ids, not prose, so it can be checked mechanically.

## 4. Cross-cutting documents

Documents that apply to all phases live in `cross-cutting/`. A document belongs there only if it is referenced by more than one
phase and is not a rule of the product. Typical kinds:

| Kind | What it holds |
| ---- | ------------- |
| Guiding principles | The sequencing and delivery principles every phase follows |
| Definition of done | A pointer to the single place where "done" is defined; it never restates the checklist |
| Risk register | Risks with likelihood, impact and mitigation, reviewed at each milestone |
| Decision records | A design record (RFC) that a phase task requires before implementation, kept with the decision and its date |

Each cross-cutting document has one owner and is linked from the index. A decision record is immutable after acceptance; a later
decision supersedes it with a new record and a link.

## 5. Work logs

One append-only log per phase, kept in `phases/work-logs/` next to the phase files (from Phase 10 on, plus one fragment per task in `phases/work-logs/phase-<n>/`, see the phases README); newest entry at the bottom, written when a session ends, pauses or finishes a task. The entry
template lives inside each log. The log is the resume point: it states what is done, the exact next step and the commands that
verify the current state. The log is part of the change that it describes.

## 6. Maintaining the plan

| Event | Update |
| ----- | ------ |
| A phase starts | Phase file status, index summary |
| A task starts or finishes | Task status in the phase file, the task's log fragment (the implementation log is printed from the merged pull requests; the older phases keep their table) |
| A phase finishes | Exit criteria checked, phase file and index status, work log, risk review |
| The scope changes | Phase file tasks or a new phase, index summary and total, gates if affected, the product knowledge if a decision changed |
| A decision changes the order | The "Order of development" section, with the date and the reason |

Consistency checks (done in review, automated where possible): the index summary agrees with each phase file; every phase is in
the contents; every gate task exists; every task cited elsewhere exists; no document in the folder is unreachable.
