[← Development plan index](../../DEVELOPMENT-PLAN.md)

# Phase 17 — Harness framework extraction (71 SP)

**Status:** ✅ Done · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [log](./log.md), and a log beside each task (`<id>.log.md`)

Extracts the project-neutral part of this repository's harness into a framework, `harness-framework`, from which a new project with
any stack and any coding agent bootstraps its harness, and which `bot-rts` then consumes. This phase is step 3 of the
[harness-framework plan](../../../archived/harness-framework/README.md#step-3-extract-the-framework). That plan gives the reasons, the target
layout (its §3.2), the building steps (§3.3), the proof (§3.4) and the exit criteria (§3.5); this file holds the tasks. Step 2 (Phase 15)
ended on 2026-10-19 with D1, D3 and D7 at 5 and blueprint readiness at 100 %
([third re-review](../../../quality-reviews/harness/2026-10-19-3.md#1-scorecard)).

**Decisions before the start.** The owner made every decision of §3.1 of that plan on 2026-10-20. They are recorded in the
[work log](./log.md), entry of 2026-10-20, and the tasks follow them: consume the framework; an agent-neutral bootstrap
that combines a template repository, a script and a `BOOTSTRAP.md` prompt; everything project-neutral in the first release; the name
`harness-framework`, the MIT license, semantic versioning and a changelog; any stack through an adapter contract, with presets for
TypeScript/Node and Python; Node as the tools' runtime; GitHub behind a host adapter; agent-runtime presets for Claude Code and Cursor.
Starting the phase approves its task pull requests (`AGENTS.md` §7.5). A change of a rule's meaning that these decisions do not cover asks
the owner before merging.

**Two stages.** The build tasks depend on the design, so the phase starts with one task. 17.1 writes the design. When the owner accepts it,
its build order becomes tasks 17.2 onward: the build steps of §3.3, the proof of §3.4 and a closing targeted harness review in a session
that did not do the build (harness review method §6). The phase grows by those tasks. 17.1 wrote the [design](../../../archived/harness-framework/design.md)
and proposed 17.2 to 17.17 in the same pull request, so merging it accepted both; the reasons, contracts and acceptance details of each task are
in section 10 of the design. The framework-only tasks (adopt, the Cursor and Python presets, examples and the proof of §3.4) are not in this
file: 17.15 publishes the framework to its own repository, where it bootstraps itself and runs them as Phase 1 of **its own development plan**
(design §10, §11).

**Execution order:** 17.2 → 17.3 → … → 17.18 in the order of the table, after Phase 16 (done). Between 17.15 and 17.16, Phase 1 of the
framework's own plan runs in the framework repository. Owner steps: create the `harness-framework` repository and copy the staging folder into
it, or authorise the agent to push it (17.15); open sessions there, or authorise pushes there, for the framework's Phase 1. Model per task: the `Agent` column of the task table holds each open task's agent-complexity marker (design §3.4; 17.3, 17.4 and 17.7 re-rated by the owner on 2026-10-30); the model of each marker is in the [profile](../../../profile.md#4-plan), and `npm run docs:check` fails on an open task without one; done tasks need none.

<!-- phase-tasks:start -->
| # | Task | Agent | SP | Status |
| - | ---- | ----- | -- | ------ |
| [17.1](./17.1.md) | Framework design | — | 3 | ✅ |
| [17.2](./17.2.md) | Targeted harness review after Phase 16 | C3 | 3 | ✅ |
| [17.3](./17.3.md) | Framework skeleton | C2 | 2 | ✅ |
| [17.4](./17.4.md) | Vendoring and the detached mode | C3 | 5 | ✅ |
| [17.5](./17.5.md) | The profile file holds every value | C2 | 5 | ✅ |
| [17.6](./17.6.md) | Layer map from one source | C2 | 2 | ✅ |
| [17.7](./17.7.md) | Generic tools into the framework | C3 | 5 | ✅ |
| [17.7a](./17.7a.md) | The two features of the second source | C2 | 3 | ✅ |
| [17.8](./17.8.md) | Core documents into the framework | C3 | 5 | ✅ |
| [17.9](./17.9.md) | Contracts and the GitHub host adapter | C2 | 5 | ✅ |
| [17.10](./17.10.md) | Stack preset node-ts, consumed here | C2 | 5 | ✅ |
| [17.11](./17.11.md) | Runtime hooks, Git guards, Claude Code preset | C2 | 5 | ✅ |
| [17.12](./17.12.md) | Procedures and their packaging | C2 | 3 | ✅ |
| [17.13](./17.13.md) | Bootstrap engine and front ends | C3 | 5 | ✅ |
| [17.14](./17.14.md) | Conformance suite and the new-adapter procedure | C2 | 3 | ✅ |
| [17.15](./17.15.md) | Publish and self-host the framework | C2 | 5 | ✅ |
| [17.16](./17.16.md) | Sync to `0.1.0` | C1 | 2 | ✅ |
| [17.17](./17.17.md) | Closing targeted harness review | C3 | 3 | ✅ |
| [17.18](./17.18.md) | Sync to `0.1.1` | C1 | 2 | ✅ |
<!-- phase-tasks:end -->

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the exit criteria of [§3.5 of the harness-framework plan](../../../archived/harness-framework/README.md#35-exit-criteria) hold, as shown by
the closing review, and:
- Phase 1 of the framework's own plan is done: its dummy-project proof of §3.4 bootstraps both stack presets (TypeScript/Node and Python) and
  the Claude Code runtime preset, and the framework's own checks pass on each, as its task logs record;
- the owner has copied the staging folder to the `harness-framework` repository (17.15), the owner's step, recorded in the work logs;
- this repository is synced to the framework's `0.1.0` (17.16);
- `npm run docs:check`, `npm run lint` and the coverage gate pass in this repository.

**Cursor is deferred (the owner's decision of 2026-11-03).** Supporting Cursor is put off for an unspecified term, so no exit criterion of this
phase concerns it. The Cursor preset stays in the framework as `0.1.0` shipped it, unverified in a live Cursor session. The real-session checklist
(the framework's task 1.2) waits until the owner takes Cursor up again; see the [work log](./log.md).

## Implementation log

Printed from the merged pull requests: `npm run plan:log -- 17` (every squash commit carries a `Plan: <task id>` line). Each task writes its own
log fragment in `work-logs/phase-17/`.
