# Development plan

The plan of {{project.title}}: phases of tasks, each task one pull request. The method is the [plan method]({{rel:documents.planMethod}}).

**Phase status legend:** ⬜ not started · 🟡 in progress · ✅ done. A phase's status is kept in the summary table and in the phase file, and
is updated in the change that starts or finishes it.

**Task status** is tracked per task in the task files of each phase folder. Each phase and each task has an append-only **log** so it can be resumed in a new session. The defects and improvements found in use are not a phase: they are the [issue queue]({{rel:paths.issues}}/README.md).

**Estimation scale:** {{plan.estimationScale}}.

**Summary** (written from the phase files by `harness plan summary`; edit a phase file, not this table)

<!-- plan-summary:start -->
<!-- plan-summary:end -->

<!-- plan-issues:start -->
<!-- plan-issues:end -->
{{#if paths.backlog}}

<!-- plan-backlog:start -->
<!-- plan-backlog:end -->
{{/if}}

---

## Resuming work in a new session

{{plan.resumePhrases}}. The session reads the phase index and the file of its task first (the session protocol of the method); to work the issue queue it reads the [open issues]({{rel:paths.issues}}/README.md) and the file of the issue.

---

## Contents

<!-- plan-contents:start -->
<!-- plan-contents:end -->
