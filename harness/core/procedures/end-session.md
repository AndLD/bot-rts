---
name: end-session
description: Use when a session ends or pauses, and when a task finishes, to leave the state of the work in the repository.
invocation: auto
---

# End or pause a session

Sessions end at any time, so the repository, not the chat, carries the state ([session protocol]({{rel:documents.method}}#6-session-protocol-resuming-and-pausing-a-phase)).

1. Write an entry in the log of the task (`<id>.log.md` beside its task file, from the task-log template; a finished task writes only this log) or, for a phase-wide matter, in the work log of the phase (`log.md`): the tasks, the branch and its state, decisions and deviations from the plan, problems and findings, **the exact next step**, and the commands that verify the current state. Short: what the next session needs, not a narrative; what a step report cannot hold goes here, and the report links it.
2. If the task is finished: set it to ✅ in its task file, regenerate the plan summary (it also rewrites the task table of the phase index) (`{{commands.docsCheck}}` reports a stale one), and add a changelog fragment for any change a user can see.
3. Run the checks of the definition of done that the change needs (`{{commands.docsCheck}}`, `{{commands.lintQuiet}}`, `{{commands.testCoverageQuiet}}`).
4. Commit with the commit format of the profile and the `Plan: <task id>` line, and push the task branch. The log entry goes in the same pull request as the work.
5. Say in the last message, in a few lines, what is done, what is not, and what was not verified{{#if host.autoMerge}}, and list the pull requests that wait for the owner (the ones auto-merge was not enabled on, and why){{/if}}.
