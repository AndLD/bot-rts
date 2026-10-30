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
- **Next step:** the owner reviews this pull request; after the merge, 17.2 in a fresh session ("Continue Phase 17").
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)
