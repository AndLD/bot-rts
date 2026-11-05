---
name: change-plan
description: Use when adding a task or a phase to the development plan, recording a defect or an improvement found in use, or splitting a phase.
invocation: auto
---

# Change the development plan

**Read first, write after.** Read the rules and the template of what you add before you create a file{{#if documents.planMethod}}: the [plan method]({{rel:documents.planMethod}}) (structure, maintaining the plan, the issue queue), the rules of a phase file (`phases.md`) and the templates (`phase-index-template.md`, `task-template.md`, `task-log-template.md`, `issue-template.md`), all in the folder of the plan method{{/if}}. **Never copy an old phase, task or issue as the start of a new one**: it carries what has drifted since the template. A generated block (the task table of a phase index, the summary and contents of the plan index, the index of the issue queue) is written by the plan-summary command (`harness plan summary`), never by hand.

Ids are permanent: never renumber, never reuse. A task keeps its id wherever the plan moves it.

## Add a task to a phase

1. Read the phase index (`{{paths.phases}}/phase-<n>-<slug>/README.md`) and the task template, not the other tasks.
2. The id is the next free number of that phase (the highest id in the folder, letter suffixes included, plus one); a subtask added after the phase started takes a letter (`<id>a`).
3. Create `<id>.md` from the task template: the back-link, the title (the whole task in one line: it is its row in the index), `Status` ⬜, the `Agent` marker of the plan's scale, the `Size` in the plan's estimation scale, `Needs` when another task comes first, and a description of what is delivered and how it is verified.
4. Change the size in the title of the phase index to the new sum of its tasks, then run the plan-summary command, which rewrites the task table and the plan index; add the task to the `Execution order` line when the order differs from the ids.

## Add a phase

1. The number is the next free number of `{{paths.phases}}` (never reuse one).
2. Create the folder `{{paths.phases}}/phase-<n>-<slug>/` with `README.md` from the phase-index template (every part of it, in its order: the exit criteria as the line `**Exit criteria:**`), and `log.md` for what concerns the whole phase (a link back to the index on the first line, the entry template inside). Add its tasks as above.
3. Run the plan-summary command: the row of the summary and the line of the contents are written for you. Record in the release order (the releases file, else the order of development of the plan index) which release the phase belongs to, when the plan keeps one.

## Record a defect or an improvement found in use

It is an issue of the queue, not a task and not a phase.

1. Read the open index of the queue ([`{{paths.issues}}/README.md`]({{rel:paths.issues}}/README.md)) for the same or a close problem first; if there is one, add the new report or fact to it.
2. The id is `I-<n>`: the next free number, counted over the open index and the names of the files in `archived/` (list the folder; do not read the archive's files).
3. Create `I-<n>.md` from the issue template (an area of the migration notes or `Unclassified`, `Reported:` for the reports that point to it), and run the plan-summary command.
{{#if paths.backlog}}

## Record a feature request

A request for something that is not there is an item of the backlog, not an issue and not a task: a proposal the owner has not approved. Read the open index ([`{{paths.backlog}}/README.md`]({{rel:paths.backlog}}/README.md)) for the same request first, and add the report to its `Source:` if there is one. The id is `B-<n>`: the next free number over the open index, the names in `archived/`, and the `Formerly:` ids of the items that came from the issue queue. Create `B-<n>.md` from the backlog template (`Status: Proposed`; `Source:` is `report` with the link of each report, `owner` or `agent`), and run the plan-summary command. **Never start an item**: it has no branch and no claim, and no order of the plan may name it. When the owner decides to do it, `harness plan promote <B-n> --phase <n> --approved` turns it into a task of a phase; work that task.
{{/if}}

## Split or merge phases

Split a phase when its theme has two exit criteria that can be reached independently: the new phase takes the next free number and its tasks keep their ids, or the old ids are recorded in its notes. Never merge phases: finished history is not rewritten. A phase kept as one file (the older layout) is split into a folder by `harness plan split <n>`, which rewrites every link into it. A changed order of development is recorded in the release order (the releases file, else the plan index), not by renumbering.

## Check

Run `{{commands.docsCheck}}`: `harness check plan` holds the parts and the order of the phase index, the back-links, the sizes, the markers, the logs and the ids that the plan names. What it cannot hold is yours to judge: that the goal is clear, that a task is atomic and says how it is verified, and that the exit criteria can be observed.
