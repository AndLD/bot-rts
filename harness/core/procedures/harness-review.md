---
name: harness-review
description: Use when asked to review the quality of the harness (the documents, rules, hooks and checks that steer agents).
invocation: explicit
---

# Run a harness review

1. Read the [harness review method]({{rel:documents.harnessReviews}}) in full, then the bindings of this project ({{link:documents.harnessBindings}}): its layers, commands and start prompts.
2. Review only what the request names (a full review, or a targeted one of some dimensions); carry the others from the last report, and say which.
3. Write one dated report from the report template, with the follow-up table triaged. A review adds the report and changes nothing else; fixes follow in separate pull requests, as tasks.
4. Report the scores and the findings to the owner, and what each recommended fix costs.
