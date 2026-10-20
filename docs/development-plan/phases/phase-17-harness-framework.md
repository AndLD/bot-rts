[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 17 — Harness framework extraction (3 SP, grows when the design is accepted)

**Status:** ⬜ Not started · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-17-log](./work-logs/phase-17-log.md), and one fragment per task in `work-logs/phase-17/`

Extracts the project-neutral part of this repository's harness into a framework, `harness-framework`, from which a new project with
any stack and any coding agent bootstraps its harness, and which `bot-rts` then consumes. This phase is step 3 of the
[harness-framework plan](../../harness-framework/README.md#step-3-extract-the-framework). That plan gives the reasons, the target
layout (its §3.2), the building steps (§3.3), the proof (§3.4) and the exit criteria (§3.5); this file holds the tasks. Step 2 (Phase 15)
ended on 2026-10-19 with D1, D3 and D7 at 5 and blueprint readiness at 100 %
([third re-review](../../quality-reviews/harness/2026-10-19-3.md#1-scorecard)).

**Decisions before the start.** The owner made every decision of §3.1 of that plan on 2026-10-20. They are recorded in the
[work log](./work-logs/phase-17-log.md), entry of 2026-10-20, and the tasks follow them: consume the framework; an agent-neutral bootstrap
that combines a template repository, a script and a `BOOTSTRAP.md` prompt; everything project-neutral in the first release; the name
`harness-framework`, the MIT license, semantic versioning and a changelog; any stack through an adapter contract, with presets for
TypeScript/Node and Python; Node as the tools' runtime; GitHub behind a host adapter; agent-runtime presets for Claude Code and Cursor.
Starting the phase approves its task pull requests (`AGENTS.md` §7.5). A change of a rule's meaning that these decisions do not cover asks
the owner before merging.

**Two stages.** The build tasks depend on the design, so the phase starts with one task. 17.1 writes the design. When the owner accepts it,
its build order becomes tasks 17.2 onward: the build steps of §3.3, the proof of §3.4 and a closing targeted harness review in a session
that did not do the build (harness review method §6). The phase grows by those tasks.

**Execution order:** 17.1 may run while Phase 16 is in progress: it writes only `docs/harness-framework/design.md`. The build tasks start
after Phase 16, because 16.3, 16.6, 16.7 and 16.9 change the CI jobs, the pre-push hook and a rule of `AGENTS.md` §7.5 that the build moves
into the framework.

| #   | Task | SP  | Status |
| --- | ---- | --- | ------ |
| 17.1 | **Framework design** (harness-framework plan §3.1 and §3.2): `docs/harness-framework/design.md`, within the owner's decisions of the work log, with (1) the mechanism by which `bot-rts` consumes the framework (a vendored copy pinned to a version with a sync script, or an alternative with its trade-offs) and how an improvement found here reaches the framework; (2) the target layout of §3.2 confirmed or adjusted for the decisions, including the adapter axes stack, agent runtime and repository host; (3) a classification table: every harness file and top-level section to core, a stack, runtime or host adapter, the profile template, an example, or stays in this repository, starting from the `core-files` block of the harness bindings and the export dry run of the latest harness review; (4) three adapter contracts, each the list of roles an adapter must fill: stack (test runner, coverage-gate tool, linter, formatter, typecheck, package manager, CI job layout, the commands of the profile), agent runtime (entry file, rules, hooks, skills or procedures, and for each rule whether the runtime blocks it early or only Git hooks and CI catch it), and host (branch protection, required checks, pull requests); (5) the "new adapter" procedure, agent-neutral, by which an agent writes an adapter for a stack without a preset and checks it against the tests the presets pass; (6) the bootstrap: one engine behind the template repository, the script (interactive and with flags) and `BOOTSTRAP.md`, all producing the same result; (7) how the existing mechanisms become framework parts: the CORE scan and the term lists of profile section 9, `harness-profile.json` and its reader, the hooks, the protection script and the profile tests, all on Node; (8) the plan for export blockers B6 (skills as agent-neutral Markdown procedures, packaged per runtime) and B7 (the layer map generated or checked from the `core-files` block), and where findings H-20261019-22 and -23 are absorbed; (9) Cursor's current support for rules, hooks and commands, checked against its documentation of the day; (10) the build order as small pull requests, each with its acceptance check and size, the proof of §3.4 for both stack presets and both runtime presets (a real Cursor session on the dummy project is the owner's step), and the closing review. Verified by the owner's acceptance of the pull request, which stops for it; the build tasks are then added to this file | 3 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the exit criteria of [§3.5 of the harness-framework plan](../../harness-framework/README.md#35-exit-criteria) hold, as shown by
the closing review, and:
- the dummy-project proof of §3.4 bootstraps both stack presets (TypeScript/Node and Python) and both agent-runtime presets (Claude Code and Cursor),
  and the framework's own checks pass on each;
- the owner has run the Cursor preset in a real Cursor session and has copied `framework/` to the `harness-framework` repository; both are the
  owner's steps, recorded in the work log;
- `npm run docs:check`, `npm run lint` and the coverage gate pass in this repository.

## Implementation log

Printed from the merged pull requests: `npm run plan:log -- 17` (every squash commit carries a `Plan: <task id>` line). Each task writes its own
log fragment in `work-logs/phase-17/`.
