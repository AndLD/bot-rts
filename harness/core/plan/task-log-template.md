← Task <id>: link to its task file here (`[← <id> — <title>](./<id>.md)`), first line of `phases/phase-<n>-<slug>/<id>.log.md`.

# <task id> — <task name> — work log

**Status:** 🟡 in progress · **Branch:** `<branch>` · **Claim:** draft pull request #<number>

Append-only log of this task, used to resume it in a new session (method, section 6). Write an entry whenever a session ends or pauses, or
the task finishes; commit it in the same pull request as the work. Decisions that concern the whole phase go to the phase's work log (`log.md`). A finished task writes only this log: its "next step" names what follows.

## Entries

### YYYY-MM-DD — short summary
- **Branch:** `<branch>` — done | WIP (what remains, what is uncommitted or unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
