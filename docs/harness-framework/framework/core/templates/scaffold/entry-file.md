# {{project.title}} — rules for agents

This file is the entry point for **any agent or human contributor** working on this repository, and is loaded into every agent session. It
holds the rules every task needs (the non-negotiables and the Git rules) and a reading map; the rest is read on demand. Every value the rules
cite by its role (the branches, the coverage gate, the commands) is in the [project profile]({{rel:paths.profileDocument}}).

## Reading map

| To … | Read first |
| ---- | ---------- |
| start or continue a phase, or end a session | [method §6]({{rel:documents.method}}#6-session-protocol-resuming-and-pausing-a-phase), then the phase file and its work log ([plan index]({{rel:paths.planIndex}})) |
| write or change code | the [stack file]({{rel:documents.stack}}) and [method §2–§3]({{rel:documents.method}}#2-solid-checklist-apply-per-file) (SOLID, testing) |
| see which tool holds a rule | the [rule-to-check map]({{rel:documents.ruleChecks}}) |
| finish a task | [method §4]({{rel:documents.method}}#4-definition-of-done) (definition of done) |
| find a value or a command | the [project profile]({{rel:paths.profileDocument}}) |

**Procedures** (steps for recurring work, also available as skills of the agent runtime):

<!-- harness:begin procedures -->
<!-- harness:end procedures -->

---

## 1. Mission & non-negotiables

<!-- harness:begin non-negotiables -->
<!-- harness:end non-negotiables -->

---

## 7. Git Flow

<!-- harness:begin git-rules -->
<!-- harness:end git-rules -->

---

## 9. Project-specific rules

The rules of this project (its architecture, its product rules) go here, each with the document that holds the details.
