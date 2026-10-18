[← Development plan index](../DEVELOPMENT-PLAN.md)

# Guiding principles

The sequencing and delivery principles every phase follows. Where this plan applied them to a particular phase, the plan's
[bindings](../bindings.md) record it.

1. **Stabilize before feature work.** Fix a broken build, configuration drift and tooling first.
2. **Move the data store first, pin behavior, then refactor, then backfill tests.** A storage change happens before any work
   that would be thrown away on the old store; coarse safety-net tests then come before a framework migration so refactors
   can be verified; the code is made testable (services free of transport objects and global singletons) before the full
   coverage backfill.
3. **Every phase ships green.** No phase is "done" without lint, typecheck, unit and integration tests (and end-to-end tests
   where a user flow changed) and the coverage gate of the [profile](../../profile.md#2-quality-gates) on the touched code.
4. **Behavior-preserving refactors first**, then behavioral changes, in separate pull requests.
5. **Feature work is incremental and behind interfaces**, so the core subsystems can be evolved without rewriting the
   transport or the user interface.
