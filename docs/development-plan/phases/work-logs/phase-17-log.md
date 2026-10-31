[← Phase 17 — Harness framework extraction](../phase-17-harness-framework.md)

# Phase 17 — Harness framework extraction — work log

Append-only log of the phase-wide matters of Phase 17 (method, section 6): decisions that concern the whole phase and pauses. Each task
writes its own log fragment in `work-logs/phase-17/<task id>.md` (template: [`_task-template.md`](./_task-template.md)). Newest entry at the bottom.

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
  [harness-framework plan](../../../harness-framework/README.md#31-decisions-you-before-building) before the start, so the design session
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
