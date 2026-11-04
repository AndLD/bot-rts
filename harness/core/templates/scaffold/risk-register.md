[← Development plan]({{rel:paths.planIndex}})

# Risk register

What could go wrong with {{project.title}} and what is done about it. A risk is a thing that may happen and would cost something; a thing that has
already happened is not a risk: it is a task of a phase or an issue of the [queue]({{rel:paths.issues}}/README.md), and its row here is closed with a link to it.

## Rules

- **One row per risk**, numbered `R<n>` in the order they are found. The number is permanent: never renumber, never reuse it. Other documents cite it.
- **Likelihood and impact** are `low`, `medium` or `high`. A risk that is `high` in both has a mitigation that a task carries out, and the row names the task.
- **Mitigation** is what lowers the likelihood or the impact (not "be careful"); a risk that is accepted says so, with the reason.
- **Owner** is the person who watches the risk.
- **Status** is `open`, `mitigated` (the mitigation is done and the risk is low) or `closed` (it can no longer happen, or it happened and became a task). A closed row stays, so the history is not lost.
- **Reviewed** is the date of the last review. Every row is reviewed when a phase finishes, and a new risk is added in the change that finds it.
{{#if documents.rfcs}}
- A decision that was made to avoid a risk is a design record ([the decision records]({{rel:documents.rfcs}})) that the row links.
{{/if}}

## Register

| ID | Risk | Likelihood | Impact | Mitigation | Owner | Status | Reviewed |
| -- | ---- | ---------- | ------ | ---------- | ----- | ------ | -------- |
