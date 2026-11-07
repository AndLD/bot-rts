[← Development plan]({{rel:paths.planIndex}})

# Off-plan record

Work that no task covers (documentation, tooling, CI, a change of the plan) merges with a record, as work of a task merges with its log. Each pull request that has no
`Plan: <task id>` line in its commit writes **one file here**, so that two pull requests never edit the same lines; a task, a phase or a flow keeps its own log and
writes no file here.

- **Name:** `<pull request number>-<slug>.md`, for example `158-record-flow-step.md`. Open the pull request first (as a draft), then add the file with its number.
- **Text:** a title line `# <what the pull request did>`, then three fields, each a line `**<label>:** <text>` that may go on over the next lines until a blank line:
  `**What changed:**`, `**Why and who asked:**`, `**What it leaves to do:**` (write "nothing" when it leaves nothing).
- **Print:** `harness plan log --off-plan` lists the records in the order of the pull requests.
- **Check:** `harness check off-plan` (part of `harness check all`) fails on a record that does not read, and lists the merged pull requests since this
  index was added that have neither a `Plan:` line nor a record here. It may be satisfied after the merge, by adding the record in a later pull request.
