[← Flow <n> — <title>](<relative link to the flow file>)

# Flow <n> — <title> — log

Append-only log of this flow, written by its orchestrator (the procedure `run-flow`); newest entry at the bottom. It is the record of the flow: a
session that continues the flow reads the flow file, the tail of this log and the current step report, nothing older.

## Entry templates

```markdown
### YYYY-MM-DD HH:MM — running
- **Orchestrator:** <the session that runs the flow (the claim: one orchestrator per flow)> · **Mode:** <brainstorm | seamless> · **Steps:** <from> to <last>
- **Usage:** <5-hour and weekly window, in %, with their reset times, or "not read"; `harness flow sample <n> flow-start` prints the line>

### YYYY-MM-DD HH:MM — step <#> started
- **Executor:** <session | cli | subagent | manual> <, reused from step <#>> <, the fallback of <the planned executor>: <why>, when it is not the step's own> · **Worker:** <the worker's id, which continues it> · **Account:** <the account it runs on, or —> · **Model:** <model and effort> · **Permissions:** <the permission mode it starts in, the mode of the flow's `permissions` setting; left out when the flow sets none> · **Estimate:** <SP, % of the weekly window>
- **Usage before:** <the line `harness flow sample <n> step-start <#>` prints: each window's percent and reset time>

### YYYY-MM-DD HH:MM — step <#> ended: <done | partial | blocked>
- **Usage after:** <the line `harness flow sample <n> step-end <#>` prints> · **Measured:** <what the step used, against its estimate> · **Pull requests merged:** <links> · **Ids done:** <ids>
- **Report:** <the worker's step report, in short: deviations, reports filed, the next step>

### YYYY-MM-DD HH:MM — decision <D0–D4>: <the question>
- **Options:** <a, b, c>
- **Own analysis** (written before the worker's recommendation was read): <the pick and why, from the plan and the design>
- **Worker's recommendation:** <the pick and its argument>
- **Choice:** <the option> · **Decided by:** <orchestrator | owner> <; when the picks differ: why the worker's argument does or does not hold>

### YYYY-MM-DD HH:MM — handoff: <why: the context limit, or a restart between flows>
- **State:** <the steps done and the one running, as `harness flow status <n>` shows them> · **Decisions:** <those of this session, each with a link to its entry, or none>
- **Next step:** <the exact next step: its number and the command that starts it> · **Waiting for:** <what the session waited for (a worker, the owner, a usage reset), or nothing>
- **Context:** <the orchestrator's context in percent of its window, or "not read"> · **Continued by:** <the new orchestrator session, by the executor of the order that started it>

### YYYY-MM-DD HH:MM — stop: <waits for the owner | finished | usage | escalation>
- **Digest:** done <…>; decided alone <the D2–D4 decisions, each with a link to its entry>; usage <…>; next <the exact next step>
```

## Entries
