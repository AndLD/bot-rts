---
name: report-upstream
description: Use when a defect of the harness framework is suspected while working, to report it upstream.
invocation: explicit
when: reports.upstream
---

# Report a defect of the framework upstream

`harness …` below is the harness command line of the project, started the way its command `{{commands.harnessSyncLocal}}` shows (the same line with `reports …` after `harness`).

The framework is a vendored copy, so a defect found in it is fixed upstream and taken with a sync. What happens to the suspicion is decided by `reports.upstream` (`harness reports status`): with `off` nothing is drafted; with `ask` a report is drafted and posted after the owner's approval; with `post` it is posted without asking.

1. Note the suspicion in the log of the task you work on (what you saw, the file, the version in `harness.lock.json`), and tell the owner, whatever the switch says.
2. Search the framework's reports for the same problem first: `harness reports search --upstream <words>`. If one matches, add what you know to it only with the owner's approval (`reports comment <n> --upstream --body <text> --approved`), and stop.
3. Draft a new report with these parts: **what happened** (the command or the check and its output), **expected**, **where** (the file, the line and the word, for a word found in `core/`), **the framework version** (`Version: x.y.z`, from the lock), and **what you tried**. A word found in `core/` that is an ordinary word is answered with `terms.productGeneric`, not reported.
4. Show the draft to the owner. With `ask`, create it only after a clear yes: `reports create --upstream --title <title> --body <draft> --approved`. With `post`, create it, and tell the owner what was posted.
5. Record the address of the report in the log of the task and, while the project waits for the fix, keep working from the current version (`override` is for a fix that cannot wait).
