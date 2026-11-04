[← Development plan]({{rel:paths.planIndex}})

# Backlog

The feature requests: things that are not there and that someone asked for, which are not defects. This is the place for what the owner has **not approved yet**: an
item is a proposal, not a phase and not the issue queue, with no release and no phase of its own. **An item is never started as it is.** When the owner decides to
do it, the item is promoted into a task of a phase (`harness plan promote <B-n> --phase <n> --approved`), and only that task is claimed, branched, built and logged.
Each item is a file of its own here (`B-<n>.md`, from the framework's backlog template). Its `Source:` says where it came from: `report` with the link of each
report, `owner`, or `agent`. This index lists the proposed items only; a promoted item moves to the [archive]({{rel:paths.backlog}}archived/README.md) when
`harness plan summary` runs, and names its task.

Before adding an item, look for the same or a close request in this index and the archive (title and area first, then the files); the same request is added to
the `Source:` line of the item that holds it. A defect found in use is an issue of the [issue queue]({{rel:paths.issues}}/README.md), not an item.

<!-- backlog:start -->
| Item | Title | Area | SP | Status | Source |
| ---- | ----- | ---- | -- | ------ | ------ |
<!-- backlog:end -->
