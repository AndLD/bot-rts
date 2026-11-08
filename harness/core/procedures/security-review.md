---
name: security-review
description: Use when asked to review the security of the project (not the diff of one change).
invocation: explicit
when: documents.securityReviews
---

# Run a security review

1. Read the [security review method]({{rel:documents.securityReviews}}) in full, then the bindings of this project ({{link:documents.securityBindings}}): what applies, the threat model, the scope of active tests, its own probes.
2. Review only what the request names (a full review, or a targeted one of some dimensions); carry the others from the last report, and say which.
3. Run an active test or an attack scenario only under the rules of engagement of the method: the project's own system, a development or test environment, the scope written in the bindings first, nothing destructive, test data only. An agent that would leave the scope stops and asks.
4. Write one dated report from the report template, within what the method allows a report to say. A review adds the report and its row in the review log of the bindings, with any change to the threat model there, and changes nothing else; fixes follow in separate pull requests, as issues of the queue.
5. Sort each finding as the method's loop says (a fix, a probe to add or change, a candidate for a security rule of core). A generic finding goes upstream by the procedure `report-upstream`, and an exploitable one that is not fixed needs the owner's approval first, whatever `reports.upstream` allows.
6. Report the scores and the findings to the owner, and what each recommended fix costs.
