[← Development plan]({{rel:paths.planIndex}})

# Design records (RFCs)

A design record, or RFC (request for comments), is the reasoning behind one decision that a task needs **before** it is implemented: the problem, the
options, the choice and what follows from it. It is written when a decision is costly to reverse, when several tasks depend on it, or when people
disagree; a decision that is small and local is made in the task and noted in its log.

## Rules

- **One file per record**, in this folder, named `<number>-<slug>.md` (`0001-event-store.md`). The number is permanent: never renumber, never reuse it.
- **Written before the task, cited by it.** A task that needs a record names it in its description, and it is `accepted` before the task starts.
- **Immutable after acceptance.** A later decision supersedes a record with a new one: the new record says `supersedes 0001`, the old one gets the status `superseded by 0007` and nothing else changes in it.
- **A decision that changes what the product is or does** also goes to the product knowledge, in the same change. The record keeps the reasoning; the specification keeps the result.
{{#if documents.riskRegister}}
- **A risk the decision avoids or accepts** links its row in the [risk register]({{rel:documents.riskRegister}}).
{{/if}}

## Records

| Number | Title | Status | Date |
| ------ | ----- | ------ | ---- |

## Template

Copy this into a new file, fill it in, and add a row to the table above.

```markdown
[← Design records](./README.md)

# <number> — <title>

**Status:** proposed | accepted | rejected | superseded by <number> · **Date:** YYYY-MM-DD · **Deciders:** <names>

## Context

What problem needs a decision, what is known, and what limits the choice (requirements, deadlines, the state of the code).

## Options

1. **<option>** — what it is; what it costs; what it risks.
2. **<option>** — …

## Decision

The option chosen, and why it wins over the others in this context.

## Consequences

What becomes easier, what becomes harder, what must now be done (the tasks that carry it out), and the risks it leaves.

## Cited by

The tasks and documents that rely on this record.
```
