[← Development plan]({{rel:paths.planIndex}})

# Issue queue

The defects and improvements found in use. They are not a phase: they have no goal, no exit criteria and no end, and their size is not in the totals of the
plan. Each issue is a file of its own here (`I-<n>.md`, from the framework's issue template) with its log beside it (`I-<n>.log.md`), and a branch
`bugfix/I-<n>-<slug>`. This index lists the open and in-progress issues only; an issue that is done moves to the [archive]({{rel:paths.issues}}archived/README.md)
when `harness plan summary` runs, so an agent that works the queue reads this file and never the archive.

Before adding an issue, look for the same or a close problem in this index and the archive (title and area first, then the files); the same problem is added to
the `Reported:` line of the issue that holds it.
{{#if paths.backlog}}
A request for something new, which is not a defect, is an item of the [backlog]({{rel:paths.backlog}}/README.md), not an issue.
{{/if}}

<!-- issue-queue:start -->
{{#if plan.complexity.scale}}
| Issue | Title | Area | Agent | SP | Status | Reported |
| ----- | ----- | ---- | ----- | -- | ------ | -------- |
{{/if}}
{{#unless plan.complexity.scale}}
| Issue | Title | Area | SP | Status | Reported |
| ----- | ----- | ---- | -- | ------ | -------- |
{{/unless}}
<!-- issue-queue:end -->
