---
name: finish-phase
description: Use when the last task of a phase is merged, to close the phase and report it.
invocation: auto
---

# Finish a phase

1. Check the exit criteria of the phase index (`README.md` of its folder) one by one; a criterion that does not hold is a task or a decision for the owner, not a footnote.
2. Set the phase status in its index, regenerate the plan summary, and record the result in the phase's work log (`log.md`; the template is in the plan method).
{{#if commands.dbUp}}
3. Bring the local database up to date from the updated integration branch: `{{commands.dbUp}}`, `{{commands.dbMigrate}}`, and `{{commands.dbSeed}}` when the phase changed the seed data. Never against a shared or production database. Record the result in the work log and tell the owner; if the database is not reachable, say so and give the commands.
{{/if}}
4. Start the next phase only if the request named it. Otherwise stop with a summary: what each task delivered, what was deferred, and any decision that waits for the owner.
