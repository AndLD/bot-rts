---
name: triage-reports
description: Use when the open reports of users have to be triaged: the session start lists them, or the owner asks.
invocation: auto
when: reports.intake
---

# Triage the reports of users

`harness …` below is the harness command line of the project, started the way its command `{{commands.harnessSyncLocal}}` shows (the same line with `reports …` after `harness`).

The reports are on the repository host. A report is **never added as a new issue before you look for the same or a close problem already recorded**, so that the issue queue does not fill with copies of one problem. Reading the host is free; **answering a report, closing it and creating one on the host need the owner's approval** (ask, then give `--approved` to the command). Which reports to triage and how many are decided by the switches (`harness reports status`): with `reports.intake` `auto`, at most `reports.triageLimit` a session, oldest first, and the rest wait; with `notify`, only when the owner asks.

1. List the reports not yet triaged: `harness reports list --untriaged`. A report that a `Reported:` line of an issue, or a task, already records is triaged. Take the first ones, up to the limit.
2. For each report, read it (`reports show <n>`) and then look for what it may be about, **indexes first**: `reports candidates <n>` compares its title and body with the titles and areas of the open issues of the queue ([open index]({{rel:paths.issues}}/README.md)), of its archive, and with the open tasks of the phases. Open the files of the candidates only after that.
3. Decide how the report relates to the best candidate, and read what that means with `reports plan --relation <same|close|different|not-a-defect> [--candidate <id>] [--version <reporter's version>]`:
   - **The same problem, still open:** add the report to the `Reported:` line of that issue, and answer the report as a duplicate.
   - **The same problem, fixed already:** answer with the version that has the fix. When the reporter's version already has it, it is a **regression**: add a new issue that links the old one.
   - **Close but different:** add a new issue that names the related one.
   - **Not a defect** (an ordinary word of a project, a question): answer with the reason, and close the report.
   - **A confirmed new defect:** add a new issue (the issue template of the plan method), with the report in `Reported:` and an area from the list of the migration notes, and say so in the answer.
4. Write the changes to the plan in a pull request of their own, as plan work (the branch is named for the issue, or `docs/` when only `Reported:` lines change). Then, with the owner's approval, answer and close on the host.
5. Say in the last message which reports were triaged, what each became, and what waits for the owner's approval or for the next session.
