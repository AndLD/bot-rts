[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 17 — Harness framework extraction (66 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-17-log](./work-logs/phase-17-log.md), and one fragment per task in `work-logs/phase-17/`

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
that did not do the build (harness review method §6). The phase grows by those tasks. 17.1 wrote the [design](../../harness-framework/design.md)
and proposed 17.2 to 17.20 in the same pull request, so merging it accepted both; the reasons, contracts and acceptance details of each task are
in section 10 of the design.

**Execution order:** 17.2 → 17.3 → … → 17.20 in the order of the table, after Phase 16 (done). 17.15 and 17.16 may run in parallel after 17.14,
and 17.17 after 17.13. Two tasks wait for the owner: the real Cursor session closes 17.18, and 17.19 starts after the owner has copied the
staging folder to the `harness-framework` repository. Model: Sonnet 5.5 at medium effort; high effort for 17.8 and 17.13.

| #   | Task | SP  | Status |
| --- | ---- | --- | ------ |
| 17.1 | **Framework design** (harness-framework plan §3.1 and §3.2): `docs/harness-framework/design.md`, within the owner's decisions of the work log, with (1) the mechanism by which `bot-rts` consumes the framework (a vendored copy pinned to a version with a sync script, or an alternative with its trade-offs) and how an improvement found here reaches the framework; (2) the target layout of §3.2 confirmed or adjusted for the decisions, including the adapter axes stack, agent runtime and repository host; (3) a classification table: every harness file and top-level section to core, a stack, runtime or host adapter, the profile template, an example, or stays in this repository, starting from the `core-files` block of the harness bindings and the export dry run of the latest harness review; (4) three adapter contracts, each the list of roles an adapter must fill: stack (test runner, coverage-gate tool, linter, formatter, typecheck, package manager, CI job layout, the commands of the profile), agent runtime (entry file, rules, hooks, skills or procedures, and for each rule whether the runtime blocks it early or only Git hooks and CI catch it), and host (branch protection, required checks, pull requests); (5) the "new adapter" procedure, agent-neutral, by which an agent writes an adapter for a stack without a preset and checks it against the tests the presets pass; (6) the bootstrap: one engine behind the template repository, the script (interactive and with flags) and `BOOTSTRAP.md`, all producing the same result; (7) how the existing mechanisms become framework parts: the CORE scan and the term lists of profile section 9, `harness-profile.json` and its reader, the hooks, the protection script and the profile tests, all on Node; (8) the plan for export blockers B6 (skills as agent-neutral Markdown procedures, packaged per runtime) and B7 (the layer map generated or checked from the `core-files` block), and where findings H-20261019-22 and -23 are absorbed; (9) Cursor's current support for rules, hooks and commands, checked against its documentation of the day; (10) the build order as small pull requests, each with its acceptance check and size, the proof of §3.4 for both stack presets and both runtime presets (a real Cursor session on the dummy project is the owner's step), and the closing review. Verified by the owner's acceptance of the pull request, which stops for it; the build tasks are then added to this file | 3 | ✅ |
| 17.2 | **Targeted harness review after Phase 16**: a targeted review (harness review method §6) of the dimensions Phase 16 touched, D3, D7, D8, D14 and D15, others carried, so the build starts from a fresh baseline; a finding that the framework absorbs names its build task. Verified by the new report in `docs/quality-reviews/harness/` with its follow-up table triaged | 3 | ⬜ |
| 17.3 | **Framework skeleton** (design §2): `docs/harness-framework/framework/` with `README.md`, `LICENSE` (MIT), `CHANGELOG.md`, `framework.json` (`0.1.0-dev`) and the folders of the layout. Verified by `npm run docs:check` covering the folder: its links, and the CORE scan on `framework/core/` with the profile's term lists returning 0 | 2 | ⬜ |
| 17.4 | **Vendoring and the detached mode** (design §1): `harness sync`, `harness.lock.json`, `harness check vendored`, `harness diff`, overrides, `harness detach` and `sync --local`; `harness/` synced from the staging folder. Verified by tests: an edit to a vendored file fails `docs:check` and the pre-push hook, a sync restores it, an override is accepted and reported; after `harness detach` on a fixture the same edit passes, `sync` refuses, `sync --local` regenerates, `diff` shows the edit against the fork point, and a removed `LICENSE` fails | 5 | ⬜ |
| 17.5 | **The profile file holds every value** (design §7.2): `harness-profile.json` at the root with schema and defaults, the term lists and the coverage gate folded in; `docs/profile.md` generated from it; `harness check profile`; the Jest configs, hooks and scripts read the new path (H-20261019-22, first half). Verified by `npm run docs:check`, the script tests and the coverage gate passing, and a test that a changed value regenerates `profile.md` | 5 | ⬜ |
| 17.6 | **Layer map from one source** (B7, design §8.2): `harness layers` generated into the harness bindings, `harness check layers`; the bindings name roles and use `origin/<integration>` (H-20261019-22, second half; H-20261019-23). Verified by a test in which an unclassified file fails the check, and by `docs:check` | 2 | ⬜ |
| 17.7 | **Generic tools into the framework** (design §3.4): links, CORE scan, plan summary and log, changelog fragments and release, and the three product-knowledge checks with their file names in the profile, as `harness` commands, vendored; the old scripts removed. Verified by `npm run docs:check` giving the same result as before on the same tree, and by the moved tests passing in the framework | 5 | ⬜ |
| 17.8 | **Core documents into the framework** (design §3.2): the method, plan and review methods and their templates in `framework/core/`, vendored, links rewritten and none leaving `core/`; the entry file's managed blocks generated with rule ids; the two neutral wordings of design §3.1. Verified by the CORE scan returning 0 on the source, `harness check generated` and `docs:check` | 5 | ⬜ |
| 17.9 | **Contracts and the GitHub host adapter** (design §4): `core/contracts/{stack,runtime,host}.md` and the manifest schema; `protect.mjs` on Node; the workflow templates; `harness check values` replaces `scripts/harness-profile.test.mjs`. Verified by the stand-in `gh` test of the protection request and by the checks failing on a changed trigger or a missing required-check job | 3 | ⬜ |
| 17.10 | **Stack preset node-ts, consumed here** (design §4.1): the gate driver and `gate.mjs`, the neutral coverage summary and the coverage merge; this repository's pre-push hook and CI call them. Verified by gate tests (a Markdown-only push, a failing test, a coverage drop, one package) and a green CI run | 5 | ⬜ |
| 17.11 | **Runtime hooks, Git guards, Claude Code preset** (design §4.2, §4.4, §7.3): `tools/runtime-hooks` with `io.mjs`; the new `pre-commit` and `pre-push` branch guards; `.claude/settings.json` and `CLAUDE.md` from the preset; the generated core rows of the rule map. Verified by tests on recorded event samples of both runtimes and on a commit and a push to a protected branch | 3 | ⬜ |
| 17.12 | **Procedures and their packaging** (B6, design §8.1): the first set in `core/procedures/`, packaged as `.claude/skills/`, and the reading-map fallback. Verified by `harness check generated` failing on a stale skill and passing after a sync | 3 | ⬜ |
| 17.13 | **Bootstrap engine and front ends** (design §6): `harness init` (interactive and with flags), `harness bootstrap`, `BOOTSTRAP.md`, the template-repository build, `--detached`. Verified by the sameness test: the same answers through the three front ends give byte-identical trees, and `init --detached` equals a pinned bootstrap followed by `harness detach` | 5 | ⬜ |
| 17.14 | **Conformance suite and the new-adapter procedure** (design §5): `tests/conformance/` per axis, `harness adapter test`, `core/contracts/new-adapter.md`. Verified by node-ts, claude-code and github passing the suite, and a deliberately broken fixture adapter failing it | 3 | ⬜ |
| 17.15 | **Cursor preset** (design §9): native and compat modes, recorded Cursor event samples, the owner's checklist for a real session in its README. Verified by the preset passing the conformance suite in both modes | 2 | ⬜ |
| 17.16 | **Python preset**, written by following the new-adapter procedure: uv, pytest with coverage.py, ruff, mypy, `gate.mjs`, `coverage.mjs`, CI templates. Verified by the preset passing the conformance suite; a step of the procedure that did not work is fixed in the procedure | 3 | ⬜ |
| 17.17 | **Examples**: a filled profile of a fictitious project, the product-knowledge skeleton and a sample plan, written by the bootstrap into a new project's `docs/`. Verified by a bootstrapped fixture passing `harness check all` with them | 2 | ⬜ |
| 17.18 | **Proof of §3.4**: in a scratch directory outside the repository, bootstrap node-ts with Claude Code, python with Cursor, node-ts with both runtimes, and one detached project with a core rule edited; run `harness check all`, the stack's checks and a short harness review (D1, D3, D6) on each; record the result in the framework changelog and the work log. Verified by the recorded runs; the owner then runs the Cursor preset in a real Cursor session with the checklist of 17.15, recorded in the work log | 2 | ⬜ |
| 17.19 | **Switch to the published framework**, after the owner has copied the staging folder to the `harness-framework` repository and tagged `v0.1.0`: the lock's source becomes that tag, the staging folder is removed, the plan and the design point to the repository. Verified by `harness sync --to 0.1.0` producing no diff and `docs:check` passing | 2 | ⬜ |
| 17.20 | **Closing targeted harness review**, by a session that did not do the build: D1, D3, D4, D5, D6, D7, D8, D13 and D15, the export dry run on the framework, probes P1, P2 and P5 on this repository and P1 on the dummy project. Verified by the report checking each exit criterion of §3.5 and of this phase | 3 | ⬜ |

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
