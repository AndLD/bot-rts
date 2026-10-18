[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 15 — Harness fixes (54 SP)

**Status:** ⬜ Not started · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-15-log](./work-logs/phase-15-log.md)

Fixes the findings of the first harness quality review ([report of 2026-10-17](../../quality-reviews/harness/2026-10-17.md)) that
the owner triaged as **fix now** (its follow-up table, section 13). This phase is step 2 of the
[harness-framework plan](../../harness-framework/README.md#step-2-refactor-and-fix-the-docs-and-harness): that plan gives the
reasons, the rules for doing the fixes (its §2.3) and the exit criteria; this file holds the tasks. The phase makes the harness
true, enforced and ready for several agents before Phase 10. It also prepares the extraction of the framework (step 3 of that plan):
the profile, the split of `AGENTS.md`, and closing the export blockers.

**Rule changes.** Starting the phase approves its task pull requests (`AGENTS.md` §7.5), with one exception. A task that changes
what a product rule or an `AGENTS.md` rule **means** asks the owner before merging. Moves, splits and corrections that keep the
meaning merge like any other task.

**Execution order:** the ids, which follow the order of groups in the harness-framework plan (§2.2): the values first (15.1), then the
split of `AGENTS.md` (15.2, 15.3), and only then everything that edits the moved text. The product-knowledge tasks 15.4 to 15.8 touch
only `docs/product-knowledge/`, so they can run in parallel with 15.1 to 15.3. The re-review 15.14 comes last.

| #   | Task | SP  | Status |
| --- | ---- | --- | ------ |
| 15.1 | **Project profile** (findings H-20261017-08, export blockers B1 and B5): a single profile file (for example `docs/profile.md`) that holds every injectable value of the harness, each named by its role. Examples: the coverage gate and its scope, the integration and production branches, branch types and merge strategy, the task-id format and the resume phrases, the story-point scale, the API prefix and versioning policy, the document languages, the commands, the term lists of the reviews, the bounded contexts. The profile also holds the map of the documents. One coverage threshold constant read by the three `jest.config.ts` files, `scripts/check-changed-coverage.mjs`, the CI step names and the pre-push hook. The rules of `AGENTS.md`, the definition of done and the guiding principles cite roles ("the coverage gate") instead of repeating values. The corrected layer map of the review (its section 2) goes into `docs/quality-reviews/harness/bindings.md`. Verified by a search of the old values (M4) that finds each one only in the profile or the constant, and by `npm run test:coverage` still enforcing the gate | 5 | ⬜ |
| 15.2 | **Method and stack split of `AGENTS.md`** (H-20261017-09, B2, B3): the project-neutral workflow moves into a method file, citing roles from 15.1. The workflow covers mission and non-negotiables, the SOLID checklist, branch types and merge rules as roles, the session protocol, and the definition-of-done skeleton. The stack moves into a stack file: tools, commands, test tooling, and the agent-runtime tool names of §7.5 (`bind_pr`, `set_monitor`, Auto-fix). `AGENTS.md` becomes a short routing file. It keeps the non-negotiables and a reading map per task type ("to start a phase read …, to add an endpoint read …"). Meaning-preserving moves with links left behind (`git mv` where a whole file moves), `npm run docs:check` green. Verified by the leak scan of the review (M1 and M2) returning no stack or product term in the method file, and by the always-loaded words (M6) | 5 | ⬜ |
| 15.3 | **Architecture out of the rule file, duplicates removed** (H-20261017-09, B4; complexity hotspots of the review's section 9): `AGENTS.md` §3.3 (identity providers) and §3.4 (persistence) move to an architecture document under `docs/`. §8 (do's and don'ts, a restatement of §1 to §7) is deleted or reduced to links. `cross-cutting/definition-of-done.md` and `guiding-principles.md` lose their project values (they cite the profile). The merge gates are stated once, with the check that sets them (`scripts/protect-branches.sh`). Verified by the budgets of `docs/quality-reviews/harness/bindings.md` (normative words, hops to "which checks gate a merge?") | 3 | ⬜ |
| 15.4 | **Product knowledge without stack, plan and history** (H-20261017-10): the 41 stack-term hits and the 15 outside the term list in `docs/product-knowledge/` move to `docs/operations`, `docs/testing` or the architecture document of 15.3. So do the code paths (for example `06-the-base.md` §6.1 naming `module-catalog.ts`) and the implementation paragraphs (`12-…` threads and the Redis adapter, `10-…` transpiler classes). History moves to `archived-docs/` or the work logs (`25-admin-console.md` §25.1 "no admin UI today", the prototype findings). Plan task ids are replaced by status markers. Binding constraints stay, stated without the product that satisfies them. Verified by the M1 scan of the review returning zero hits in `docs/product-knowledge/` (only allowed exceptions listed in the harness bindings) | 5 | ⬜ |
| 15.5 | **Contradictions in core product rules and scenarios** (H-20261017-02, -03, -04, -05, -06, -16):
  - the empty-battery rule is kept once, in design §12.5.2;
  - a module at condition 0 is broken and repairable, and the corpse-base recovery is consistent with the repair threshold (§7.1, §8.4);
  - the sandbox row of §13 allows local imports through the engine loader (§10.1);
  - the admin-route rule for API keys is stated once, with the `admin:*:read` exception, in `integrations/API.md`, and linked from §22.1 and §25.2;
  - world generation in §4.2 names the seeded RNG and `WORLD_RESOURCE_CHANCE`;
  - the five scenarios of §17 that contradict the rules are corrected, with each step linked to its rule.

  Where the right answer is not the implemented behaviour, ask the owner. Verified by re-opening every cited line of the findings | 3 | ⬜ |
| 15.6 | **Script API gaps** (H-20261017-17): the seeded random function promised by design §12.4 is added to §10.2 (or the claim removed), and `connect` gets a password parameter for foreign bots. Both are owner decisions, asked first. The error-code list of §10.3 points to `lib/utils/error-codes.ts` as the closed set. The example scripts of §18 use the real `MapCell` fields (`lib/utils/interfaces/map.ts`) and are run by a test, so they cannot drift again | 3 | ⬜ |
| 15.7 | **Glossary** (H-20261017-24): one row per concept with its code name and an alias column. Includes "Base" created at Deploy, one name for the control block or wireless adapter, one row for memory and drive, and two distinct terms for deploying a base and spawning a bot. The about 15 domain terms that are used in two or more design files and are not yet defined are added (#212 added eight). A check (in `npm run docs:check` or the review scripts) lists capitalised domain terms that are missing from the glossary. Verified by the budget "0 undefined terms" of the harness bindings | 2 | ⬜ |
| 15.8 | **Status markers and the open-items register** (H-20261017-11, -12): a section's decision status is kept apart from its build status. Either two markers are used, or the build status is derived from the plan and removed from the design. The about 12 features with two different statuses get one. Every hidden open item of the review's section 8 (O13 to O35, the ones not decided in #212) is registered in design §20 with its section, the task it blocks and its owner, or is closed. A marker-word scan (`TODO`, `TBD`, "to be decided", "not yet", "for now", "to be revisited") in `npm run docs:check` flags new unregistered items. Verified by the scan and by the budget "features with two statuses: 0" | 5 | ⬜ |
| 15.9 | **Enforcement: lint rules and hooks** (H-20261017-20, the hook part of H-20261017-19, D7):
  - ESLint `no-console`, and `no-restricted-properties` for `Date.now` and `Math.random` in the game logic (with overrides for the clock and RNG adapters).
  - Agent-runtime hooks in `.claude/settings.json`, each a thin call to a script under `scripts/`:
    - block a commit or push on `main` or `develop`;
    - block a remote-branch deletion;
    - block edits of `.env` files;
    - format an edited file with Prettier;
    - print the branch, the phase in progress and the last "Next step" of its work log at session start.
  - The pre-push hook also runs the changed-file coverage and the generated-file check.
  - A rule-to-check map document lists every normative rule with its mechanism, or marks it as judgment.

  Verified by a test of each hook script and by the map covering the 27 rules of the review's sample (M5) | 5 | ⬜ |
| 15.10 | **Accidental complexity** (review section 9, H-20261017-23 remainder): the summary table of `DEVELOPMENT-PLAN.md` (phase sizes, statuses, total) is generated from the phase files by a script and checked in CI. Energy, power and the day cycle (§12.5) leave the hub §12 for a section of their own, with references kept by anchor. Every lifecycle with four or more states gets a state table: execution, module, map cell, order, auction, transfer offer, API key. Verified by the budgets of the harness bindings (largest design file, inbound references, lifecycles with tables) | 5 | ⬜ |
| 15.11 | **Coordination for several agents** (H-20261017-21; review section 10):
  - one work-log fragment per task instead of one appended file per phase (old logs kept);
  - changelog fragments instead of one "Unreleased" list;
  - an implementation log written from the merged pull requests;
  - a claim convention: a draft pull request, or the 🟡 status pushed before any other work;
  - rules in `AGENTS.md` (or the method file of 15.2) for several agents: who integrates, how review comments and CI Auto-fix are routed, how hotspot files are owned;
  - the execution order of Phase 10 rewritten as the dependency list and the waves of the review.

  Verified by the write-set probe P7 of the review, run again on two independent tasks: only accepted hotspots overlap | 5 | ⬜ |
| 15.12 | **Isolated working copies** (H-20261017-22):
  - `scripts/e2e.mjs` defaults to ports other than the development servers and never stops a process it did not start;
  - the database and Redis host ports and the compose project name can differ per worktree (`POSTGRES_PORT`, `REDIS_PORT`), and `docs/testing/README.md` says how to run two checkouts at once;
  - new worktrees and sessions start from `origin/develop` (one line in the rules).

  Verified by running the unit tests in one worktree while the development servers run in another, without a collision | 3 | ⬜ |
| 15.13 | **Remaining rules and knowledge** (H-20261017-26, -27, -30):
  - unplanned work becomes a Phase 12 task first, and documentation or tooling work without a task uses a branch slug only (`AGENTS.md` §7.1);
  - a change to a non-negotiable needs the owner's explicit confirmation of that change, recorded in the pull request;
  - the operational notes kept only in user memory move to the repository: the e2e ports next to running development servers, the rebase of stacked pull requests after a squash merge, the changed-file coverage before a push.

  Verified by the cold-start probes P1 and P4 of the review, run again | 2 | ⬜ |
| 15.14 | **Targeted harness re-review** (harness review method §6; harness-framework plan §2.4): a targeted review of the dimensions this phase touched (D1, D2, D3, D4, D5, D6, D7, D8, D9, D11, D12, D13, D14). It adds a dated report to `docs/quality-reviews/harness/`, closes the fixed findings in the follow-up table of the 2026-10-17 report, re-scores the dimensions, and reports the new blueprint readiness and the budgets | 3 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the exit criteria of step 2 of the harness-framework plan hold, as shown by the report of 15.14:
- every 🔴 finding of the 2026-10-17 report is closed;
- the export blockers that step 2 owns (B1 to B5 and B8) are closed;
- D1, D3 and D7 score 5, and no dimension scores 1 or 2;
- `npm run docs:check`, `npm run lint` and the coverage gate pass.

Findings triaged otherwise are not part of this phase:
- H-18 is in task 10.11;
- H-15 is task 12.3;
- the skills of H-19 and H-28 belong to step 3 of the harness-framework plan;
- H-25, H-29 and H-31 are in the backlog.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
`AGENTS.md` §7.1).

| Branch | Tasks | PR | Status |
| ------ | ----- | -- | ------ |
