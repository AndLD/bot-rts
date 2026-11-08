[← Security review method](../README.md)

# Attack scenarios

**First edition (2026-11-08), and a draft**, on the same terms as [the catalogue of probes](../probes/README.md): researched by agents, and a draft until a person with security expertise has reviewed it.

These playbooks are for a project's agent or team to run against its **own** test environment, as a penetration test does. **Every one runs only under [the rules of engagement](../README.md#5-rules-of-engagement):** the project's own system, a development or test environment, the scope written in the bindings first, nothing destructive, test data only, and an agent that would leave the scope stops and asks. A playbook names no target: an address, an account or a listener comes from the scope. A scenario with no scope is recorded as not run. A value that a step needs (a size, a number of requests, an address of a test mailbox) comes from the scope as well.

| Area | File |
| ---- | ---- |
| Authentication and sessions | [authentication.md](./authentication.md) |
| Authorization | [authorization.md](./authorization.md) |
| Input and output | [input.md](./input.md) |
| Abuse, isolation and operations | [operations.md](./operations.md) |

## The format

A playbook has a heading `### SC-<area>-<nn> — title`, an id that is stable, and these fields as a list, in this order, so that a tool can read them:

| Field | Content |
| ----- | ------- |
| Dimension | S5 or S6 |
| Goal | What the scenario finds out |
| Applies | As in a probe (section 3 of the method) |
| Preconditions | What must exist in the test environment, all from the scope |
| Steps | What to do, the smallest step that proves the weakness |
| Safe behaviour | What the system does when it is safe: anything else is *unsafe* |
| Evidence | What to keep, with no secret and within section 7 of the method |
| Cleanup | What to remove afterwards |
| Severity | Guidance for an unsafe result |
| Probes | The probes that this scenario gives evidence for |
| Sources | The id of each source, with the date it was last verified |

A project's own playbooks are in its bindings, in the same format, with ids `P-SC-<area>-<nn>`.
