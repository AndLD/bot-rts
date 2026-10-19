[← README](../../README.md)

# From harness to reusable framework: the plan

The goal: turn this repository's docs and AI harness into a **project-neutral framework (a blueprint)** that can be published as
a separate repository and used to bootstrap the harness of any new project. This file is the plan, with the exact procedure,
prompts and exit criteria for each step. It is project-specific on purpose; the method documents it uses are the project-neutral
ones listed below.

| Step | What | Who decides | Model and effort (suggested) |
| ---- | ---- | ----------- | ---------------------------- |
| 1 | Run the harness quality review | the reviewer; you approve the report | Opus 5.5, high |
| 2 | Refactor and fix the docs and harness from the findings | you choose which findings; the agent fixes | Sonnet 5.5, medium (high for restructuring findings) |
| 3 | Extract the framework | you decide the design questions of 3.1; the agent builds | design: Opus 5.5, high; building: Sonnet 5.5, medium |

Documents used: the review method [`quality-reviews/harness/README.md`](../quality-reviews/harness/README.md), its
[`bindings.md`](../quality-reviews/harness/bindings.md) (this repository's values, with the start prompts), and the layer model
of section 2.1 of that method (CORE, DOMAIN, ADAPTER, PROFILE, STATE, ENTRY).

---

## How to run this plan

- **One prompt per step, not one prompt for the whole plan.** There are decisions only you can make between the steps (which findings to fix, how the framework is consumed, when to publish), a very long session loses detail when its context is compacted, and a usage limit hit halfway loses work. The prompts below are written so that each step is one self-contained run.
- **Every step is resumable.** Each prompt tells the agent to commit its progress to the branch and to keep a checkpoint file (section "Checkpoint file"). A new session continues from the last checkpoint. Step 2 uses the work log of Phase 15 instead.
- **Pull requests follow the repository rules** (`AGENTS.md` §7): a branch of type `docs/` or `chore/` from `develop`, a pull request opened by the agent, and merged only after you say so. Step 2 is the exception: it is Phase 15, so its task pull requests merge as in any phase you started (`AGENTS.md` §7.5), except a task that changes the meaning of a rule.
- **Order matters.** Step 2 needs the report of step 1; step 3 needs the blockers list of step 1 and the fixes of step 2.

### Checkpoint file

Each step keeps `docs/harness-framework/progress.md` on its branch (append-only; removed when the step's pull request merges, its
content moves into the report or the pull request description):

```markdown
### YYYY-MM-DD — step N, what was just finished
- **Done:** …
- **Next step:** the exact next action
- **Open decisions:** questions waiting for the owner
- **Verify with:** commands that show the state is healthy
```

---

## Step 1: run the harness quality review

**Input:** the merged method and bindings. **Output:** the dated report in `docs/quality-reviews/harness/`, with findings, scores,
percentages, complexity budgets (proposed), and the export dry run. **Exit criteria:** the report is merged; you have read the
scorecard, the top findings and the blockers list.

**Procedure:** exactly the method. The start prompt below defers to the full-review prompt in section 5 of the bindings, which holds the delegation details. Notes:

- Use Opus 5.5 at high effort for the orchestrating session; subagents on Sonnet 5.5 at medium effort.
- If your usage limit is tight, split it: first steps 1 to 4 for D1 to D10 with the probes, later D11 to D14.
- The report must include the **extraction blockers** list and the **export dry run**; step 3 builds on them.

**After the report:** you triage the findings (step 2 input), see below.

### Start prompt (step 1)

```text
Execute step 1 of docs/harness-framework/README.md: run the first full harness quality review.

Follow the "Full review prompt" in section 5 of docs/quality-reviews/harness/bindings.md exactly: you are the orchestrator, spawn the context subagents and the probes as it says (model "sonnet", effort "medium"), verify every finding yourself, and open the pull request without merging it. Keep docs/harness-framework/progress.md on the branch as in the plan, so a new session can resume if this one is interrupted. Finish with the summary the prompt asks for, plus the extraction blockers and the proposed complexity budgets.
```

---

## Step 2: refactor and fix the docs and harness

**Input:** the report. **Output:** a series of small pull requests, each fixing one group of findings. **Exit criteria:**
the extraction blockers of the report are closed, every 🔴 finding is closed, and a targeted re-review (below) shows D1, D3
and D7 at the target and no dimension at 1 or 2.

**The work is planned as [Phase 15 — Harness fixes](../development-plan/phases/phase-15-harness-fixes.md)** (owner decision
2026-10-18). It is a phase of the development plan, so it has task ids, sizes, statuses, an implementation log and a work log. It is
started like any phase ("Start Phase 15"). This section keeps the reasons, the rules and the exit criteria; the phase file holds the
tasks.

### 2.1 Triage (you)

Mark each finding in the report's follow-up table with one of: **fix now** (all 🔴, all export blockers), **fix in the framework**
(better done when extracting), **backlog**, **reject** (with a reason). The agent does not start before this is done. This is the
only manual part of the step.

_Done for the report of 2026-10-17 on 2026-10-18 (its section 13, merged in #213)._

### 2.2 Grouping and order

The "fix now" findings are grouped by root cause and layer, and the groups are ordered by dependency. The values come first: the
**PROFILE**, a single file that holds the injectable values (thresholds, branch names, tool names, paths, the documents' map), because
nothing else can be made neutral before the values have a home. Then, in order:
- separating CORE from ADAPTER;
- removing leaks;
- fixing truth;
- adding the missing enforcement;
- reducing accidental complexity (D13);
- removing blockers to parallel execution (D14);
- everything else.

Each group is a task of Phase 15 (15.1 to 15.13), and the targeted re-review is task 15.14. Its report of 2026-10-19 found the exit
criteria not met and added 15.15 to 15.17, with a second re-review as 15.18.

### 2.3 Doing the fixes

One pull request per group (a few related findings at most). Each pull request:
- cites the finding ids it closes;
- changes only what the finding requires;
- keeps `npm run docs:check` green;
- updates the plan, work logs and indexes when it moves or renames documents.

Moves use `git mv` plus a reference rewrite that resolves every link from the old location (as done in the earlier folder moves);
never leave a broken link.

No pull request changes the meaning of a product rule or of an `AGENTS.md` rule without your approval. Inside Phase 15, such a task
asks before merging; moves, splits and corrections that keep the meaning merge like any other task of the phase.

### 2.4 Verify

Task 15.14 (and, after the fixes it added, task 15.18) runs a **targeted** harness review (method, section 6) on the dimensions the fixes touched. It re-scores them, closes the
findings and reports the new blueprint readiness. Step 3 starts when the exit criteria hold.

### Start prompt (step 2)

```text
Start Phase 15.
```

The session protocol ([method §6](../engineering/method.md#6-session-protocol-resuming-and-pausing-a-phase)) and the phase file do the rest: the agent reads the phase file and its work log, works
through the tasks in order, opens a pull request per task, and merges it once the checks pass. A task that changes the meaning of a
rule waits for your approval.

---

## Step 3: extract the framework

**Input:** the fixed harness and the blockers list. **Output:** a project-neutral framework in a staging folder of this repository,
ready to be copied to its own GitHub repository, and a proof that it bootstraps a new project. **Exit criteria:** section 3.5.

### 3.1 Decisions (you, before building)

The design session (Opus) proposes an answer to each, with trade-offs; you choose:

| Decision | Options to weigh |
| -------- | ---------------- |
| How `bot-rts` uses the framework afterwards | **Consume** it (vendored copy with a sync script, or a git subtree), so CORE has one home and the method improves in one place; or **copy once**, which is simpler and drifts. Recommended: consume. |
| Bootstrap mechanism | A GitHub template repository (simple), a script that asks for the profile values and writes the files (flexible), or a Claude Code plugin or skill (agent-driven). They can be combined: template plus a bootstrap script. |
| Scope of the first release | Which parts: the engineering method, the plan and phase structure, the quality-review methods, the session protocol, the hooks, CI skeleton. Recommended: method, plan, reviews and session protocol first; adapters for one stack as an example. |
| Name, license, versioning | Repository name, license, semantic versioning of the framework, a changelog. |
| Stack adapters | Which adapters ship (for example a TypeScript and Node adapter, a Python adapter), and how an adapter is declared. |

### 3.2 Target layout

The staging folder is `docs/harness-framework/framework/` and mirrors the layers:

```
framework/
  README.md              what it is, how to bootstrap, how to upgrade
  core/                  the project-neutral method: principles, workflow, definition-of-done skeleton, session protocol,
                         plan and phase structure, quality-review methods (code, harness), document templates
  adapters/<stack>/      one folder per stack: tools, commands, hooks, CI skeleton, testing conventions, mapped to core roles
  profile/               profile.template.md: every value the core needs, with a default and a description
  bootstrap/             the script or instructions that create a new project's harness from core + adapter + profile
  examples/              a filled profile, a minimal product-knowledge skeleton, a sample plan
  CHANGELOG.md
```

### 3.3 Building (the agent)

1. **Classify** every harness file and section (the layer map of the review), using the report's dry run; list what goes to core, adapters, profile, examples, and what stays in `bot-rts` (DOMAIN and STATE).
2. **Extract by moving, not copying**: for each CORE document, write the neutral version in `framework/core/` (roles instead of values, no project terms) and replace the original in `bot-rts` with the neutral text plus a binding to its profile. The review's term lists (M1, M2) must return **zero** hits on `framework/core/`.
3. **Write the profile template** from the injectable values found in the review (M4, M10); every value in core is a `{{role}}` that the profile fills or a role name the adapter implements.
4. **Write one adapter** (the stack of `bot-rts`) from the stack documents, hooks and CI; it contains everything that names a tool.
5. **Write the bootstrap**: it takes a filled profile and an adapter name and produces the new project's `AGENTS.md`-style entry file, docs skeleton, plan, templates, hooks and CI skeleton.
6. **Make the review methods self-hosting**: the harness and code review methods in `core/` run on a bootstrapped project through its own bindings.

### 3.4 Prove it

In a scratch directory (not in this repository), bootstrap a dummy project from the framework with a filled example profile, run the
framework's own checks (link check, term-leak scan, structure check), then start the harness review method on it. Record the result in
the framework changelog. The next real proof is step 4 of your plan: the trading-bot project; every edit it needs in core is a defect of
the framework to be fixed there.

### 3.5 Exit criteria

- `framework/core/` has zero stack, tool and product terms (the review's M1 and M2 return nothing).
- Every injectable value is in the profile template; no value is duplicated in core.
- A project bootstraps from the framework in one command or one prompt, and its link check passes.
- The harness review method runs on the bootstrapped project.
- `bot-rts` consumes the framework as decided in 3.1, and its own harness review (targeted) shows no regression.
- You have copied `framework/` to its own GitHub repository (this is yours to do or to explicitly authorize; the agent does not create or push to other repositories on its own).

### Start prompts (step 3)

Design session:

```text
Execute step 3.1 of docs/harness-framework/README.md: the design of the framework extraction. Read the latest harness quality review report (export dry run and blockers), the method and bindings. Propose an answer with trade-offs for each decision in the 3.1 table, the exact target layout for this repository's content (a classification table: every harness file and section to core, adapter, profile, example, or stays), and the order of the build. Write it as docs/harness-framework/design.md on a docs/ branch, open a pull request, and stop for my decisions. Do not build anything yet.
```

Build session (after the decisions are recorded in `design.md`):

```text
Execute steps 3.3 to 3.5 of docs/harness-framework/README.md using the decisions recorded in docs/harness-framework/design.md. Build the framework in docs/harness-framework/framework/ by moving content out of this repository's harness, one pull request per build step (docs/ or chore/ branch from origin/develop), ask me before merging each. Keep docs/harness-framework/progress.md updated on the branch. Finish with the proof of 3.4 in a scratch directory and a summary against the exit criteria in 3.5. Do not create or push to any other repository.
```

---

## Risks and how the plan handles them

| Risk | Handling |
| ---- | -------- |
| Usage limit hit mid-step | One prompt per step, checkpoint file, commits after each unit of work, cheaper model for mechanical parts |
| The framework drifts from `bot-rts` | Consume it (3.1) instead of copying once |
| A fix changes a product rule by accident | Rule in step 2: no change to the meaning of a product rule without your approval; the targeted re-review checks D11 |
| Over-abstraction (a framework nobody can read) | Complexity (D13) is scored in the review; the framework's first release is deliberately small |
| Hidden project terms in the framework | Zero-hit term scan as an exit criterion; the dummy-project bootstrap |
