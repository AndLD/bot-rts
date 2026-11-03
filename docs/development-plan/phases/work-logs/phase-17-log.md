[← Phase 17 — Harness framework extraction](../phase-17-harness-framework.md)

# Phase 17 — Harness framework extraction — work log

Append-only log of the phase-wide matters of Phase 17 (method, section 6): decisions that concern the whole phase and pauses. Each task
writes its own log fragment in `work-logs/phase-17/<task id>.md` (template: [`task-log-template.md`](../../../../harness/core/plan/task-log-template.md)). Newest entry at the bottom.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `docs/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-20 — phase added; decisions before the start
- **Tasks:** 17.1 added (⬜, 3 SP); the build tasks follow from its design
- **Branch:** `docs/phase-17-harness-framework` — the plan only
- **Decisions / deviations from the plan:** the owner decided every point of §3.1 of the
  [harness-framework plan](../../../archived/harness-framework/README.md#31-decisions-you-before-building) before the start, so the design session
  proposes only how to realize them:
  - **How `bot-rts` uses the framework:** it **consumes** it, so the method has one home. The mechanism (a vendored copy pinned to a version
    with a sync script was suggested; a git subtree is the alternative) is confirmed by 17.1.
  - **Bootstrap:** **combined**, and **agent-neutral**: it must work with any coding agent, not only Claude Code. One engine behind a template
    repository, a script and a `BOOTSTRAP.md` prompt that any agent can follow. `AGENTS.md` stays the entry point; agent-specific files point
    to it. Guarantees live in Git hooks and CI; agent-runtime hooks are optional and call the same scripts; skills are Markdown procedures
    that each runtime packages in its own form.
  - **Scope of the first release:** **everything that is project-neutral**, the tooling included.
  - **Name, license, versioning:** the repository is named **`harness-framework`**; the license is **MIT**; semantic versioning and a changelog.
  - **Stack adapters:** **any stack on demand**, through an adapter contract and a "new adapter" procedure; **presets for TypeScript/Node** (as
    `bot-rts`) **and Python**.
  - **Tool runtime:** the framework's tools run on **Node** in every project, for now.
  - **Repository host:** **GitHub**, behind a **host adapter** that is the extension point for other hosts.
  - **Agent-runtime presets in the first release:** **Claude Code and Cursor**, with the neutral core and `BOOTSTRAP.md`. The agent cannot run
    Cursor, so a real Cursor session on the dummy project of the proof is the owner's step.
  - Order (proposed with the phase, for the owner to confirm when merging): 17.1 may run while Phase 16 is in progress; the build tasks start
    after Phase 16; the phase comes before Phase 10 in the order of development.
- **Problems / blockers / findings:** none.
- **Next step:** 17.1 (the framework design), in a fresh session (Opus 5.5, high effort); it may start now, alongside Phase 16.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-10-30 — second source for the build; the framework repository exists
- **Tasks:** 17.7, 17.8, 17.11 and 17.15 amended; 17.7a added (⬜, 2 SP); Phase 17 is 68 SP
- **Branch:** `docs/17-framework-second-source` — a plan change after the 17.1 pull request (#256) was merged
- **Decisions / deviations from the plan:**
  - The owner's second project copied 17 of this repository's scripts and improved 9.
  - The owner decided on 2026-10-30 that the build merges each tool from both copies, and that two of the second project's features join the
    framework: the link check's index rule, and the optional agent-complexity markers of the plan summary.
  - The owner created `AndLD/harness-framework` (private, one commit on `main`). GitHub offers no rulesets for it, so 17.15 sets
    `host.protection: false` there; the bootstrap branches the integration branch from the existing commit.
- **Problems / blockers / findings:**
  - The owner had moved some scripts out of `scripts/` by accident while copying them, and put them back. The check of 2026-10-30 found all
    58 entries present, unchanged and with their executable bits, and no committed deletion under `scripts/` in the last 60 days.
  - Every script is in the design's classification.
- **Also decided (2026-10-30):** the second project's off-plan log becomes task 2.5 of the framework's own plan (Phase 2, after `0.1.0`;
  3 SP), as one fragment per pull request instead of a shared file. Phase 2 of the framework's plan is 17 SP. Phase 17 here is unchanged.
- **Also decided (2026-10-30), agent-complexity markers:** they become a standard part of the framework's plan method, as in the second project.
  - Task property and template column; every open task carries one, done tasks are exempt; the bootstrap turns them on.
  - A model map as a profile role, with the Claude Code preset's default: `C1` Sonnet 5.5 medium, `C2` Sonnet 5.5 high, `C3` Opus 5.5 high.
  - The session-start hook prints the next task's marker and model.
  - The framework's own Phases 1 and 2 are rated in design §10.
  - This repository turns them on in 17.7a (2 → 3 SP) and rates the 34 open tasks of Phases 10 and 17. Phase 17 is rated now in design §10:
    `C3` 17.2, 17.8, 17.13, 17.17; `C1` 17.3, 17.16; `C2` the rest.
  - This raises 17.8 and 17.13 from Sonnet at high effort to Opus, and the `C2` build tasks from medium to high effort.
  - Phase 17 is 69 SP.
- **Next step:** the owner reviews this pull request; after the merge, 17.2 in a fresh session ("Continue Phase 17").
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-10-30 — 17.2 done: the baseline review, its triage waits for the owner
- **Tasks:** 17.2 ✅ (its log: [`phase-17/17.2.md`](./phase-17/17.2.md))
- **Branch:** `docs/17.2-targeted-harness-review` — done, PR #260
- **Decisions / deviations from the plan:** none. The report [`2026-10-30.md`](../../../quality-reviews/harness/2026-10-30.md) is the build's
  baseline: D3 and D7 are at 4, D8 and D14 at 4, D15 at 3, and the gate passes.
- **Problems / blockers / findings:** H-20261030-01 (🟠): the staging folder is outside every code check, so 17.3 should wire it in before
  the first tool moves. The other findings are triaged to 17.4, 17.7, 17.9, 17.10, 17.11 and Phase 12 (report section 13).
- **Next step:** the owner approves the triage. A plan pull request then adds the findings to the named build tasks and to Phase 12. After
  that, 17.3 in a fresh session ("Continue Phase 17").
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-10-30 — the MVP includes Phases 15 to 17 (H-20261030-06)
- **Tasks:** none; a plan change that closes H-20261030-06 of the 17.2 review
- **Branch:** `docs/mvp-includes-phases-15-17`
- **Decisions / deviations from the plan:** the owner decided on 2026-10-30 that the harness phases 15 to 17 are part of the MVP. The MVP line of
  the plan index no longer carries its own phase range or total, which went stale ("Phases 0–16 (1148 SP)"). It cites the generated summary
  table, which `npm run plan:summary` keeps true.
- **Problems / blockers / findings:** none.
- **Next step:** 17.3 in a fresh session ("Continue Phase 17"). The owner approved the triage of the 17.2 report on 2026-10-30, and PR #262
  carries it into the build tasks (17.3 now includes H-20261030-01) and into Phase 12 (12.4, 12.5).
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-10-30 — 17.3, 17.4 and 17.7 re-rated
- **Tasks:** agent-complexity markers changed for 17.3 (`C1` → `C2`), 17.4 (`C2` → `C3`) and 17.7 (`C2` → `C3`); SP unchanged
- **Branch:** `docs/17-complexity-ratings` — the plan only
- **Decisions / deviations from the plan:** the owner accepted on 2026-10-30 three new ratings that the reviewing session proposed.
  - 17.3 now also wires the staging folder into CI and the push gate (H-20261030-01), which is more than creating files.
  - 17.4 is the base of the build: the hash-checked lock, the refusal of a moved tag, detach and `sync --local`, and the gate's handling of the
    vendored tree (H-20261030-04).
  - 17.7 merges each tool from two copies, which needs judgment about which behaviour wins.
  - At the owner's request, the markers moved the same day from design §10 into an `Agent` column of the phase file's task table, before `SP`,
    so each task row shows its marker and design §10 no longer repeats them. Done tasks carry one only where it was recorded (17.2); 17.1 has
    `–`. The plan summary reads the size and status from the last two columns, so it is unaffected.
  - The phase template gets the column with 17.8, and 17.7a adds the check that every open task has a marker. Until then this table is the
    only one with the column.
- **Problems / blockers / findings:** none.
- **Next step:** unchanged: 17.3 in a fresh session ("Continue Phase 17"), now on Sonnet 5.5 at high effort; 17.4 and 17.7 on Opus 5.5 at high.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-10-30 — 17.3 done: the skeleton, and the staging folder inside the code checks
- **Tasks:** 17.3 ✅ (its log: [`phase-17/17.3.md`](./phase-17/17.3.md))
- **Branch:** `chore/17.3-framework-skeleton` — done, PR #265
- **Decisions / deviations from the plan:** none. H-20261030-01 is closed: the staging folder's tests run in CI and in the push gate,
  Prettier checks its code, and `docs:check` scans `framework/core/`.
- **Problems / blockers / findings:** none.
- **Next step:** 17.4 in a fresh session ("Continue Phase 17"), `C3`: Opus 5.5 at high effort.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff); `npm run test:framework`

### 2026-10-30 — 17.4 done: the vendored framework in `harness/`
- **Tasks:** 17.4 ✅ (its log: [`phase-17/17.4.md`](./phase-17/17.4.md))
- **Branch:** `chore/17.4-vendoring` — done, PR #266
- **Decisions / deviations from the plan:** one addition, `harness override`, so that an override needs no hash computed by hand. H-20261030-04
  is closed: the local gate treats `harness/` and the lock as tooling, and method §7 names them among the files regenerated after a rebase.
- **Problems / blockers / findings:** none.
- **Next step:** 17.5 in a fresh session ("Continue Phase 17"), `C2`: Sonnet 5.5 at high effort.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-10-30 — 17.5 done: the profile file holds every value
- **Tasks:** 17.5 ✅ (its log: [`phase-17/17.5.md`](./phase-17/17.5.md))
- **Branch:** `chore/17.5-profile-file` — done, PR #267
- **Decisions / deviations from the plan:** the coverage gate is the top-level `coverageGate` of the profile file, not `quality.coverageGate`
  (design §8.3 and the classification table are corrected). `docs/profile.md` is generated from `profile/roles.md`.
- **Problems / blockers / findings:** none.
- **Next step:** 17.6 (the layer map from one source), `C2`.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff); `npm run test:framework`

### 2026-10-30 — 17.6 done: the layer map from one source
- **Tasks:** 17.6 ✅ (its log: [`phase-17/17.6.md`](./phase-17/17.6.md))
- **Branch:** `chore/17.6-layer-map` — done, PR #268
- **Decisions / deviations from the plan:** the `core-files` block is gone, but the project's CORE documents stay a list (`layers.core` in the
  profile file) until 17.8 moves them into the framework; design §8.2 says so. The map is a managed block inside the harness bindings.
- **Problems / blockers / findings:** none. H-20261019-21, -22 (second half) and -23 are closed.
- **Next step:** 17.7 (generic tools into the framework), `C3`: Opus 5.5 at high effort, in a fresh session ("Continue Phase 17").
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff); `npm run test:framework`

### 2026-10-31 — 17.7 done: the generic tools are `harness` commands
- **Tasks:** 17.7 ✅ (its log: [`phase-17/17.7.md`](./phase-17/17.7.md))
- **Branch:** `chore/17.7-generic-tools` — done, PR #269
- **Decisions / deviations from the plan:** `npm run docs:check` is `harness check all`. The product-knowledge file names, the release
  version files and the documentation patterns are profile roles. H-20261030-05 is closed for the "documentation only" rule; the package
  list of CI is 17.9's.
- **Problems / blockers / findings:** the claim was opened late, after the work and with no other session holding the task (task log).
- **Next step:** 17.7a in a fresh session ("Continue Phase 17"), `C2`: Sonnet 5.5 at high effort.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-10-31 — 17.7a done: the index rule and the complexity markers
- **Tasks:** 17.7a ✅ (its log: [`phase-17/17.7a.md`](./phase-17/17.7a.md))
- **Branch:** `chore/17.7a-second-source-features` — done, PR #270
- **Decisions / deviations from the plan:** the markers are the profile role `plan.complexity` (scale and models); without it a plan has none. The
  check fails on an open task without a marker. This repository rated the open tasks of Phase 10 and also of Phase 12 (two), which the
  work log of 2026-10-30 did not count. The ratings of Phase 10 are the session's proposal; the owner may change any of them.
- **Problems / blockers / findings:** none.
- **Next step:** 17.8 (core documents into the framework), `C3`: Opus 5.5 at high effort, in a fresh session ("Continue Phase 17").
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff); `npm run test:framework`

### 2026-11-02 — 17.9 done: the contracts, the GitHub host adapter and `check values`
- **Tasks:** 17.9 ✅ (its log: [`phase-17/17.9.md`](./phase-17/17.9.md))
- **Branch:** `chore/17.9-contracts-github-host` — done, PR #274
- **Decisions / deviations from the plan:** the role `repository.protectionScript` is gone (the protection is the command `harness host
  protect`), and the protection rule has a text for `host.protection: false`. The merge guard is an optional host role. The CORE scan joins
  the adapters' terms.
- **Problems / blockers / findings:** none. H-20261030-05 is closed (the package list of CI comes from the profile, and `check values`
  fails on a literal one).
- **Next step:** 17.10 (stack preset node-ts, consumed here), `C2`.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-11-02 — 17.10 done: the gate driver, the node-ts preset and the neutral coverage
- **Tasks:** 17.10 ✅ (its log: [`phase-17/17.10.md`](./phase-17/17.10.md))
- **Branch:** `chore/17.10-stack-node-ts` — done, PR #275
- **Decisions / deviations from the plan:** a new profile role `gate` holds what stayed project-specific in the old local gate. The coverage
  summary is computed without a dependency, so CI's `verify` installs nothing. H-20261030-03 and -09 are closed.
- **Problems / blockers / findings:** none.
- **Next step:** 17.11 (runtime hooks, Git guards, Claude Code preset), `C2`.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)


### 2026-11-02 — 17.11 done: runtime hooks, Git guards and the Claude Code preset
- **Tasks:** 17.11 ✅ (its log: [`phase-17/17.11.md`](./phase-17/17.11.md))
- **Branch:** `chore/17.11-runtime-hooks` — done, PR #276
- **Decisions / deviations from the plan:** `io.mjs` holds both runtimes' forms (`hook-io` is an optional role). The `Read(...)` deny rules and the
  Cursor event samples are not verified in a live session (task log). H-20261019-19 and -20261030-02, -03 (rows 32, 93) are closed.
- **Problems / blockers / findings:** none.
- **Next step:** 17.12 (procedures and their packaging), `C2`.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-11-02 — 17.12 done: the procedures and their packaging
- **Tasks:** 17.12 ✅ (its log: [`phase-17/17.12.md`](./phase-17/17.12.md))
- **Branch:** `chore/17.12-procedures` — done, PR #277
- **Decisions / deviations from the plan:** seven procedures; `new-adapter` comes with 17.14. The skills are generated per selected runtime, and the
  entry file's `procedures` block is the fallback for every agent.
- **Problems / blockers / findings:** none. B6 is closed.
- **Next step:** 17.13 (bootstrap engine and front ends), `C3`: Opus 5.5 at high effort, in a fresh session. The owner asked this session to stop
  after 17.12.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-11-02 — 17.13 done: the bootstrap engine and its three front ends
- **Tasks:** 17.13 ✅ (its log: [`phase-17/17.13.md`](./phase-17/17.13.md))
- **Branch:** `chore/17.13-bootstrap` — done, PR #278
- **Decisions / deviations from the plan:** the defaults of a new project are in `profile/starter.json` and the adapters' new `defaults`, not in
  the schema, which keeps its required roles strict. Each axis has an optional `scaffold-files` role. The managed files come from the sync engine.
  The first push of the two branches is the owner's (`--no-verify`).
- **Problems / blockers / findings:** the scaffolded workflows have not run on a real host; the framework's proof (its task 1.5) runs them.
- **Next step:** 17.14 (conformance suite and the new-adapter procedure), `C2`: Sonnet 5.5 at high effort, in a fresh session. The owner asked
  this session to stop after 17.13.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-11-02 — 17.14 done: the conformance suite and the new-adapter guide
- **Tasks:** 17.14 ✅ (its log: [`phase-17/17.14.md`](./phase-17/17.14.md))
- **Branch:** `chore/17.14-conformance` — done, PR #279
- **Decisions / deviations from the plan:** the suite is `tools/conformance/` (vendored, so `harness adapter test` runs in a project), its tests are in
  `tests/conformance/`. The checks run the adapter's logic through the framework's gate driver, coverage gate and hooks and a bootstrapped fixture project; they never
  run a stack's tools. The host adapter's command-line seam is `cli` (was `gh`). The skeletons are real and vendored. The claude-code event samples moved into the adapter.
- **Problems / blockers / findings:** the suite found that `harness.mjs` and the runtime hooks do nothing, silently, when started through a symbolic link (task log); it is
  not fixed here, and needs a task. `local:` adapters of a project are not built.
- **Next step:** 17.15 (publish and self-host the framework), `C2`, in a fresh session; it begins with the owner's step. The owner asked this session to stop after 17.14.
- **Verify with:** `npm run docs:check`; `npm run test:framework`; `npm run plan:summary` (no diff)

### 2026-11-02 — 17.15 done: the framework is published, self-hosted and consumed from its tag
- **Tasks:** 17.15 ✅ (its log: [`phase-17/17.15.md`](./phase-17/17.15.md))
- **Branch:** `chore/17.15-publish-framework` — done, PR #280; in `AndLD/harness-framework`: the bootstrap commit on `develop` (pushed by the owner) and PR 1, tag `0.1.0-dev.1`
- **Decisions / deviations from the plan:** lock mode `self` was only a name, so 17.15 built it (`paths.frameworkDir`, `--self`); the first tag is `0.1.0-dev.1`; this repository's lock source is that tag and
  the staging folder is removed. The sync differed from the staging copy only by the version.
- **Problems / blockers / findings:** two CI failures on the first run of the scaffolded workflows, both defects of the tools, fixed in the tag (task log). The repository's branches are unprotected (private, free plan).
- **Next step:** Phase 1 of the framework's own plan (in its repository), then 17.16. 17.15 was the last task that changes this repository's tools; the `Agent` of 17.16 is `C1`.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — 17.16 done: synced to the framework's `0.1.0`
- **Tasks:** 17.16 ✅ (its log: [`phase-17/17.16.md`](./phase-17/17.16.md))
- **Branch:** `chore/17.16-sync-0.1.0` — done, PR #281
- **Decisions / deviations from the plan:** none; the framework's Phase 1 (PRs 1 to 10 of its repository) is linked from the task log. The lock is at `v0.1.0`. Nothing in this repository had to change except generated files.
- **Problems / blockers / findings:** the Cursor exit criterion of the phase stays open (the preset is unverified in a live session; the owner's decision of 2026-11-02).
- **Next step:** 17.17 (closing targeted harness review, `C3`), in a different session than the build's, on the owner's "go on".
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)


### 2026-11-03 — 17.17 done: the closing review; the phase stays open on two criteria
- **Tasks:** 17.17 ✅ (its log: [`phase-17/17.17.md`](./phase-17/17.17.md); the report: [`2026-11-03.md`](../../../quality-reviews/harness/2026-11-03.md))
- **Branch:** `docs/17.17-closing-harness-review` — done, PR #283
- **Decisions / deviations from the plan:** the probes ran as read-only subagents (the command line's login had expired); the report says what that changes.
- **Problems / blockers / findings:** the review's gate passes, and a project bootstraps from `v0.1.0` in one command. The phase's exit criteria hold except two:
  the owner's Cursor session (open by the owner's decision of 2026-11-02), and "no regression" (§3.5), which fails on D1. Since the pin, nothing automated scans the
  framework's core with this project's terms (H-20261103-01; the core is clean by hand).
- **Next step:** the owner approves the triage of the report's section 14. Then H-01 is fixed in the framework and synced here, or accepted; then `finish-phase`.
  No task of Phase 17 is left.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — Cursor deferred; its exit criterion removed
- **Tasks:** none (a plan change)
- **Branch:** `docs/17-defer-cursor`
- **Decisions / deviations from the plan:** the owner deferred Cursor support for an unspecified term ("now is not the right time to continue supporting
  Cursor for this framework"). By the owner's explicit request, Cursor is removed from the exit criteria of this phase:
  - the owner's real Cursor session;
  - Cursor in the framework's Phase 1 proof (that proof did bootstrap the Cursor preset, task 1.5; it is no longer required).

  The preset stays in the framework as `0.1.0` shipped it, unverified in a live session. The checklist of the framework's task 1.2 waits for the
  owner. This replaces the decision of 2026-11-02, which kept the criterion open. The closing review (17.17) is a dated record and is not changed.
- **Problems / blockers / findings:** the only exit criterion left open is "no regression" of §3.5. It fails on D1 (H-20261103-01): fix it in the
  framework and sync, or the owner accepts it.
- **Next step:** the owner decides on H-20261103-01; then `finish-phase`.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — H-20261103-01: the owner chose fixes A and B, planned in the framework
- **Tasks:** none here (a decision)
- **Branch:** `docs/17-core-scan-decision`
- **Decisions / deviations from the plan:** for the D1 regression of the closing review (nothing automated scans the framework's core with this project's
  terms), the owner chose two fixes.
  - **B:** a broader tool-name list in the framework's own scan.
  - **A:** a pinned project scans its vendored `core/` with its own terms. A was extended so that it works when other people use the framework:
    - the framework's own vocabulary is never reported;
    - a hit says what to do;
    - a recorded exception tied to one framework version keeps a consumer unblocked;
    - a confirmed leak reaches the framework through an issue template and is fixed in a patch release;
    - a development version comes before each final tag.

  They are tasks 3.6 to 3.8 of the framework's open-ended phase ([AndLD/harness-framework#12](https://github.com/AndLD/harness-framework/pull/12)).
- **Problems / blockers / findings:** none.
- **Next step:**
  - The framework builds 3.6 to 3.8 and releases `0.1.1`.
  - Then a sync task here takes it. That task is added when `0.1.1` exists.
  - After the sync, `docs:check` scans `harness/core` with this project's terms, and "no regression" of §3.5 holds.
  - Then `finish-phase` closes Phase 17.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — H-20261103-04 fixed: four stale statements
- **Tasks:** none here (a finding of the closing review, 17.17)
- **Branch:** `docs/h-20261103-04-stale-statements`
- **Decisions / deviations from the plan:** the owner chose to fix H-04 now, in its own pull request, not with the sync to `0.1.1`.
  - Rule-map row 97 is _enforced_: the `guard-shell` hook refuses `--no-verify` for an agent; the owner's terminal and the log record stay the owner's.
  - The notes of the review bindings no longer describe a staging folder. They say that the CORE scan checks 0 files here while the copy is
    pinned, until framework task 3.7 is synced; the sync rewrites that note.
  - The review prompt names the probes P1 to P9.
- **Problems / blockers / findings:** none. H-20261103-05 (budgets) waits for the owner's decision.
- **Next step:** unchanged: the framework builds 3.6 to 3.8 and releases `0.1.1`; then the sync task here, then `finish-phase`.
- **Verify with:** `npm run docs:check`

### 2026-11-03 — H-20261103-05, first part: the fan-out budget, the archive folders
- **Tasks:** none here (a finding of the closing review, 17.17)
- **Branch:** `docs/h-20261103-05-budgets-and-archive`, stacked on `docs/h-20261103-04-stale-statements` (both edit the layer notes of the review bindings)
- **Decisions / deviations from the plan:** the owner's decisions on H-05:
  - The fan-out budget of the plan index scales with the plan: ≤ 12 + 2 per phase, because its contents are generated. Other documents keep ≤ 40.
  - The extraction plan is archived: `docs/harness-framework/` moved to `docs/archived/harness-framework/`, and its README sends a reader who starts a
    new project to the framework's `README.md` and `BOOTSTRAP.md` (the P5 probe read the whole plan).
  - `docs/product-knowledge/archived-docs/` is renamed `docs/product-knowledge/archived/`. Links, the profile file and the generated files follow.
- **Problems / blockers / findings:** none.
- **Next step:** the rest of H-05 waits for the owner: the P2 budget (after the discussion of the phase log and the task logs), and budgets for P8 and P9.

### 2026-11-03 — H-20261103-05, second part: the probe budgets
- **Tasks:** none here (a finding of the closing review, 17.17)
- **Branch:** `docs/h-20261103-05-budgets-and-archive`
- **Decisions / deviations from the plan:** the owner's decisions:
  - P2 keeps the routine budget (6,000 words). Its excess is recorded as known until the framework's task 3.10: a file per task, a generated phase
    index, and a finished task logged only in its own log, so a resuming agent reads only what it needs.
  - P8 and P9 are routine probes, budget 6,000 words. Their excess is recorded as known until the framework's tasks 4.2 (the plan checks hold
    a phase file's structure) and 4.3 (the procedure `change-plan`, which adds a phase and a task).
  - Task 3.10 is planned in the framework ([AndLD/harness-framework#13](https://github.com/AndLD/harness-framework/pull/13)).
- **Problems / blockers / findings:** none. H-20261103-05 is resolved: every exceeded budget has a recorded reason.
- **Next step:** unchanged: the framework builds 3.6 to 3.8 and releases `0.1.1`; then the sync task here, then `finish-phase`.
- **Verify with:** `npm run docs:check`
