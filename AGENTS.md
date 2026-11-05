# AGENTS.md — Engineering rules for agents

This file is the source of truth for **any agent or human contributor** working on this repository and is loaded into every
agent session. It holds the rules every task needs: the non-negotiables, the Git and merge rules and the product rules, plus a
reading map. The rest is read on demand:

- the [project profile](./docs/profile.md): every value the rules cite by role (the coverage gate, branch names and types, merge
  strategy, the API prefix, the user-facing languages, versions, commands) and the map of the documents;
- the [engineering method](./harness/core/method/method.md): principles, SOLID checklist, testing rules, definition of done, Git
  workflow, session protocol;
- the [stack file](./docs/engineering/stack.md): tools, layering, conventions, test tooling, the stack items of the definition of
  done, the agent-runtime tools;
- the [architecture](./docs/engineering/architecture.md): identity providers, persistence, the engine as the single owner of
  world state.

## Reading map

| To … | Read first |
| ---- | ---------- |
| start or continue a phase, or end a session | [method §6](./harness/core/method/method.md#6-session-protocol-resuming-and-pausing-a-phase) (session protocol), then the phase file and its work log ([plan index](./docs/development-plan/DEVELOPMENT-PLAN.md)) |
| write or change code in any package | [stack.md](./docs/engineering/stack.md) (stack, layering, conventions) and [method §2–§3](./harness/core/method/method.md#2-solid-checklist-apply-per-file) (SOLID, testing) |
| add or change an endpoint | [stack §2.0](./docs/engineering/stack.md#20-one-api-for-every-client), [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items) (generated files), [`API.md`](./docs/product-knowledge/integrations/API.md) |
| change the database schema or authentication | [architecture](./docs/engineering/architecture.md) (persistence and migrations §2, identity providers §1) |
| add or change a user-visible flow | [method §3.4](./harness/core/method/method.md#34-end-to-end-tests) and the [e2e matrix](./docs/testing/e2e-matrix.md) |
| change a game rule or add a game feature | [`GAME-DESIGN.md`](./docs/product-knowledge/game-design/GAME-DESIGN.md) and the [glossary](./docs/product-knowledge/game-design/02-glossary.md), then section 9 below |
| see which tool holds a rule | the [rule-to-check map](./docs/engineering/rule-checks.md) |
| finish a task | [method §4](./harness/core/method/method.md#4-definition-of-done) and [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items) (definition of done) |
| cut a release or a hotfix | [`RELEASING.md`](./docs/operations/RELEASING.md) |
| run tests, find a command | [`docs/testing/`](./docs/testing/README.md), [profile §8](./docs/profile.md#8-commands) |
| find any other document | [profile §10](./docs/profile.md#10-document-map) (document map) |

**Procedures** (steps for recurring work, also available as skills of the agent runtime):

<!-- harness:begin procedures -->
| When | Follow the procedure |
| ---- | -------------------- |
| adding a task or a phase to the development plan, recording a defect or an improvement found in use, or splitting a phase | [`harness/core/procedures/change-plan.md`](./harness/core/procedures/change-plan.md) |
| asked to review the quality of the code (not the diff of one change) | [`harness/core/procedures/code-review.md`](./harness/core/procedures/code-review.md) |
| a session ends or pauses, and when a task finishes, to leave the state of the work in the repository | [`harness/core/procedures/end-session.md`](./harness/core/procedures/end-session.md) |
| the last task of a phase is merged, to close the phase and report it | [`harness/core/procedures/finish-phase.md`](./harness/core/procedures/finish-phase.md) |
| asked to review the quality of the harness (the documents, rules, hooks and checks that steer agents) | [`harness/core/procedures/harness-review.md`](./harness/core/procedures/harness-review.md) |
| a project needs an adapter the framework has no preset for (a language and its tools, a coding agent, or a repository host) | [`harness/core/procedures/new-adapter.md`](./harness/core/procedures/new-adapter.md) |
| a branch is ready and a pull request has to be opened, or a claim pull request marked ready | [`harness/core/procedures/open-pull-request.md`](./harness/core/procedures/open-pull-request.md) |
| cutting a release or a hotfix | [`harness/core/procedures/release.md`](./harness/core/procedures/release.md) |
| a defect of the harness framework is suspected while working, to report it upstream | [`harness/core/procedures/report-upstream.md`](./harness/core/procedures/report-upstream.md) |
| the owner asks to run or continue a flow of the plan ("Run flow N", "Run flows N–M", "Continue flow N"), to orchestrate its steps | [`harness/core/procedures/run-flow.md`](./harness/core/procedures/run-flow.md) |
| starting or resuming a phase or a task of the development plan, before any other work on it | [`harness/core/procedures/start-task.md`](./harness/core/procedures/start-task.md) |
| the project takes a new version of the framework, adopts it from the copy of a first harness, or has found a defect in the framework | [`harness/core/procedures/update-framework.md`](./harness/core/procedures/update-framework.md) |
<!-- harness:end procedures -->

---

## 1. Mission & non-negotiables

<!-- harness:begin non-negotiables -->
The principles (SOLID, scalability, testability, maintainability, low coupling, Git Flow, tests for every feature) are in
[method §1](./harness/core/method/method.md#1-principles). If a rule conflicts with existing legacy code, the rule wins for **new
and modified** code — refactor the touched area to comply rather than perpetuating the anti-pattern.

Non-negotiables (a PR that violates these is rejected). **Changing one needs the owner's explicit confirmation of that change**, recorded
in the pull request; a mention in passing ("the gate is annoying") is not a confirmation, so ask. <!-- rule:nn.change -->

1. Every feature ships with **unit + integration tests**, and user-visible flows get **e2e** tests. <!-- rule:nn.tests -->
2. Coverage must stay at or above the coverage gate ([profile](./docs/profile.md#2-quality-gates)); CI fails below it. <!-- rule:nn.coverage -->
3. No new untyped public boundaries (the stack's lint rule names them). No new magic string logic without a typed constant. <!-- rule:nn.typed -->
4. No dead code, no commented-out blocks, no debug printing left in committed code (use the logger). <!-- rule:nn.clean -->
5. No secrets in the repo; add values only to `.env.example`, never `.env`. <!-- rule:nn.secrets -->
<!-- harness:end non-negotiables -->

## 2.–6. Moved sections

The former sections keep their numbers here so that older references resolve:

- §2 Tech stack & test tooling → [stack §1](./docs/engineering/stack.md#1-tech-stack-and-test-tooling-do-not-substitute).
- §3 Architecture & layering: §3.0–§3.2 → [stack §2](./docs/engineering/stack.md#2-architecture-and-layering) (§2.0–§2.2); §3.3 identity providers → [architecture §1](./docs/engineering/architecture.md#1-identity-provider-abstraction); §3.4 persistence → [architecture §2](./docs/engineering/architecture.md#2-persistence-isolation-postgresql--prisma).
- §4 SOLID checklist → [method §2](./harness/core/method/method.md#2-solid-checklist-apply-per-file) (its application to this code: [stack §3.4](./docs/engineering/stack.md#34-solid-in-this-code-base)).
- §5 Conventions → [stack §3](./docs/engineering/stack.md#3-conventions).
- §6.1–§6.4 Testing → [method §3](./harness/core/method/method.md#3-testing) (rules) and [stack §4](./docs/engineering/stack.md#4-test-tooling) (tools).
- §6.5 Definition of done → [method §4](./harness/core/method/method.md#4-definition-of-done) and [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items).

---

## 7. Git Flow

<!-- harness:begin git-rules -->
**Role binding.** This repository fills the roles of §1 and §7 as follows, and this line is the only place in these two sections that names the values: the integration branch is `develop`, the production branch is `main`, the issue queue is the [open issues](./docs/development-plan/issues/README.md), the repository host is GitHub; every other value is in the [profile](./docs/profile.md).

### 7.1 Branches

Branch names, types and the merge strategy are in the [profile](./docs/profile.md#3-branches-and-merging); how branches flow <!-- rule:git.branches -->
(one branch per task, finishing a release) is in [method §5](./harness/core/method/method.md#5-git-workflow).
**`<id>` is the task number from the development plan**, as in `feature/<id>-<slug>`.
Work that is not in the plan first becomes a task or an issue: a defect or an improvement found in use becomes an **issue** of the issue queue (`I-<n>`, a bugfix branch `bugfix/I-<n>-<slug>`), which is not a phase.
Documentation or tooling work that no task covers uses a branch slug only (the docs and chore branch types).

### 7.2 Merge strategy

Squash merge into the integration branch; a merge commit for release and hotfix branches ([profile](./docs/profile.md#3-branches-and-merging)). <!-- rule:git.merge -->

### 7.3 Branch retention

- **Branches are never deleted from the repository host after merging; they are kept for history.** Turn off "automatically delete head <!-- rule:git.retention -->
  branches" in the repository settings, and never run `git push --delete` / `git push origin :branch` on a remote branch.
- Deleting a *local* branch is fine when it is already merged. <!-- rule:git.local-delete -->
- The production and the integration branch are protected: no direct pushes (for administrators <!-- rule:git.protection -->
  too), no force-push, no deletion, every change through a PR, and the **required checks** green. The required checks are listed with
  what each job runs in the [profile](./docs/profile.md#2-quality-gates); that list is the only statement of the merge gates.
  The host enforces this with the repository ruleset that `harness host protect` sets from the profile.
  An administrator may bypass the rules only when merging a PR, for example past a red check. That bypass is the owner's: an agent <!-- rule:git.admin-bypass -->
  never uses it unless the owner asks for that specific merge.

### 7.4 Commit & PR rules

- Commit messages: the commit format of the [profile](./docs/profile.md#3-branches-and-merging) (its type and optional scope, for <!-- rule:git.commit-format -->
  example `feat(<scope>): …`), with the plan task id in the body (the plan-reference line of the profile).
- One logical change per commit; PRs should be small and single-purpose. <!-- rule:git.small-prs -->
- No direct commits to the production or the integration branch; merge via PR with at least one review (while the project is solo, the owner's <!-- rule:git.no-direct-commit -->
  approval to merge counts as the review).
- The required checks (§7.3) must be green before merge. <!-- rule:git.green-checks -->

### 7.5 Rules for agents

- If the current branch is the production or the integration branch, **create the right branch first** (names per §7.1) before changing files. Start every new branch, worktree and session from the integration branch as it is on the remote (fetch first). <!-- rule:agent.branch-first -->
- Committing and pushing to a feature/bugfix/docs/chore branch is routine and **needs no confirmation**. Never commit or <!-- rule:agent.routine-push -->
  push directly to the production or the integration branch.
- **Plan work (approval given by the request):** when the user asks to start or continue one or more phases, to work the issue queue or to fix issues (the resume phrases <!-- rule:agent.plan-approval -->
  of the [profile](./docs/profile.md#4-plan), for example "Start Phase N", "Work the issue queue" or "Fix I-<n>"), that request is the approval for **every task PR of the named phases and every PR of the named issues**.
  A request to run or continue a flow of the plan ("Run flow N") names the phases and issues of its steps, and approves only what the flow's settings let its orchestrator decide (the procedure `run-flow`); it never approves a merge or an answer that this section keeps for the owner. Create each
  task's pull request into the integration branch and squash-merge it **without asking**, once the required checks pass (before CI
  exists: once lint, typecheck and tests pass locally). Do not pause between tasks, and when a named phase's exit criteria are
  met, record it and start the next named phase. Stop after the last named phase (or flow) with a summary, and earlier only when
  blocked or when a decision is needed that only the user can make. The approval does not extend to phases that were not named.
- **Plan-related PRs merge the same way.** Every PR that belongs to a named phase, issue or flow is covered by the same approval: its task <!-- rule:agent.plan-related -->
  PRs, and also the documentation and chore PRs that exist because of the plan (the phase's implementation log, task and
  status updates in the phase file and the development plan, the work log, a flow's state and log, the matching specification updates, and
  the fixes of tooling or tests that block a task). Merge them without asking once the required checks pass. A PR counts as
  plan-related only when it serves a named phase; anything else follows the next rule.
- **Claim a task before working on it.** Push its branch and open a **draft** pull request for it first (title and body as in the claim row of the <!-- rule:agent.claim -->
  [profile](./docs/profile.md#4-plan)); a task with an open pull request belongs to the session that opened it, and a session that
  resumes a phase continues it only as [method §6](./harness/core/method/method.md#6-session-protocol-resuming-and-pausing-a-phase) says (the log names it, or the owner does; otherwise ask).
  With several agents the orchestrator or the owner merges, and the CI events and review comments of a pull request go to the session
  that owns it ([method §7](./harness/core/method/method.md#7-several-agents)).
- **Opening a pull request is automatic.** Create the PR as soon as a branch is ready (any branch type, including <!-- rule:agent.open-pr -->
  release and hotfix branches into the production branch) without asking.
- **Ask the user before merging any other pull request:** documentation or chore PRs that are not related to the development plan of a named phase, anything <!-- rule:agent.ask-merge -->
  targeting the production branch, and release and hotfix branches. Approval for one merge does not carry over to another.
  The one exception is a **flow the owner started** (the procedure `run-flow`): its orchestrator approves the merges of a release or a hotfix itself when the
  flow's settings let it decide that cut: its level (by default a development version D1, a final release or a hotfix D3) is below the flow's `askAt`, or the flow is seamless. It merges them by merge commit once the
  required checks are green, never by the host's auto-merge and never by an administrator's bypass, tags the version, and logs the cut as a decision with its level
  (the procedure `release`). Otherwise, and for every other merge this rule names, it asks the owner like any agent.
- Never delete a remote branch, never force-push to the production or the integration branch, never rewrite published history. <!-- rule:agent.no-rewrite -->
- **Auto-merge merges a task's pull request; nothing waits for you to come back.** As the last step of a task, once its definition of done holds, <!-- rule:agent.auto-merge -->
  enable the host's auto-merge (squash) on exactly the pull requests this section lets you merge without asking: the task and plan-related
  pull requests of the named phases, into the integration branch. Never on a pull request into the production branch, on a release or a
  hotfix branch, or on one that needs the owner's approval; the shell guard refuses it there. When the checks are already green the host
  merges at once, which is expected. After you push to a pull request, check that auto-merge is still on, and merge a green pull request
  that is still open yourself. The final message lists the pull requests that wait for the owner.
- **A task that needs the previous one** branches from its branch (one level, no deeper) while that pull request is open; after the squash
  merge, retarget the pull request to the integration branch and run `harness branch update`, which brings it in and resolves the conflicts that only
  the squash causes; push after the retarget, because a retarget alone starts no checks. <!-- rule:agent.stack -->
- **Automatic CI fixes are on for plan work.** After opening a PR for a named phase, attach it to the session and turn on the agent <!-- rule:agent.ci-fixes -->
  runtime's CI monitoring with automatic fixes (the tools are in [stack §6](./docs/engineering/stack.md#6-agent-runtime)) without
  asking; it wakes the session on CI failures, merge conflicts and review comments. Never wait by checking the pull request again and
  again; the runtime adapter says how a session waits (stack §6).
  When CI is green, the host merges the pull request (auto-merge); go on to the next task, so work flows across phases.
- A defect of the framework that you suspect while working is reported upstream by the procedure `report-upstream` of the reading map (`reports.upstream` of the
  [profile](./docs/profile.md)), after looking for the same problem among the framework's reports. Nothing is posted that the profile does not allow.
<!-- harness:end git-rules -->

### 7.6 Session protocol

Moved to [method §6](./harness/core/method/method.md#6-session-protocol-resuming-and-pausing-a-phase).

---

## 8. Do's & Don'ts

Removed: it restated §1–§7 and the method. The rules are in §1, §7, §9, the [method](./harness/core/method/method.md) and the
[stack file](./docs/engineering/stack.md).

---

## 9. Project-specific rules (details in `docs/`)

- **Docs are the source of truth** for game rules and plan: [`docs/product-knowledge/game-design/GAME-DESIGN.md`](./docs/product-knowledge/game-design/GAME-DESIGN.md) and
  [`docs/development-plan/DEVELOPMENT-PLAN.md`](./docs/development-plan/DEVELOPMENT-PLAN.md). Check them before implementing a feature and keep them in sync.
- **Harness quality:** the docs and this harness are reviewed by [`harness/core/reviews/harness/README.md`](./harness/core/reviews/harness/README.md)
  (layers, scoring, procedure; this repository's values in [`docs/quality-reviews/harness/bindings.md`](./docs/quality-reviews/harness/bindings.md)). A review adds one dated report and changes nothing else;
  fixes follow in separate pull requests.
- **Vendored framework:** `harness/` is a copy of the framework `AndLD/harness-framework`, pinned to a tag by `harness.lock.json`. Never
  edit it: change the framework in its repository (a pull request there, then a tag), and take the version with
  `npm run harness -- sync --from https://github.com/AndLD/harness-framework.git --to <version>` in a pull request here (`harness check vendored` fails otherwise).
- **Single writer for world state:** every change to the game world goes through the engine as a command — scripts,
  terminal, manual GUI control and API requests alike. Never write world tables from the API tier directly
  (design §14.2). The engine (`api/src/engine`) is the only writer: use cases send it commands through the engine port, and it
  runs in a worker thread of the API process or, when scaled, on its own node (`APP_ROLE`, `docs/operations/DEPLOYMENT.md`).
- **Determinism:** game logic must not call `Date.now()` or `Math.random()`; use the injected clock and the seeded RNG
  (design §12.4).
- **Tunable balance:** gameplay numbers (costs, ranges, tick rate, limits) live in config, not in code.
- **Script API results:** every script API call returns `Result<T>`; expected failures are values, not exceptions
  (design §10.3).
- **Game events:** the engine emits typed events after applying a tick's commands; animations, achievements and
  notifications consume them outside the tick path (design §24).
- **Events are edges, not levels:** an event is raised when something happens or a state begins, never on every tick or cycle a
  state lasts; keep such a state in persisted data (module properties, not engine memory) so a restart does not repeat the
  event, and cover it with a test that runs many ticks in the unchanged state (design §24.1).
- **Public API stability:** the versioning policy of the [profile](./docs/profile.md#5-public-api) holds: changes inside a
  version stay compatible, and a deprecated route is marked and announced per `docs/product-knowledge/integrations/API.md`. New player-facing endpoints declare their API-key scope,
  and the MCP server (`mcp/`) only calls the public API.
- **Player-facing text:** every UI string, error code and documentation page exists in every user-facing language
  (`client/messages`, `npm run i18n:check`); player documentation is generated from `lib` and the balance config where possible.
- **Operations:** processes, scaling and releases follow `docs/operations/` (`DEPLOYMENT.md`, `RELEASING.md`); a pull request that changes behaviour adds a changelog fragment in `docs/product-knowledge/changelog.d/`.
- **Admin endpoints** (Phase 9, delivered in tasks 9.1–9.15 and extended by the open tasks; `/api/v1/admin/*`, design §25) are guarded by role-based permissions and two-factor authentication,
  every call is written to the audit log, and they are closed to API keys **except routes that opt in with an `admin:*:read` scope** (Phase 14: read-only keys
  granted from the console only; the owner must still hold the admin role on every call; such keys never appear in a player-facing list, spec or documentation).
- **Money and goods** (planned, Phase 10): credits and traded items move only through engine commands that write double-entry **ledger**
  entries (design §26.1); nothing updates a wallet, escrow or inbox directly, and a reconciliation test must prove that the
  money supply and item counts are conserved.
- **Auto-merge (the owner's standing request of 2026-11-03).** On every task pull request and plan-related pull request into the integration branch
  that the rules of section 7 let an agent merge without asking, the agent enables the host's auto-merge (squash) once the task's definition of done
  holds, and merges the pull request itself if it is green but still open. Never on a pull request into the production branch, a release or hotfix
  branch, or one that needs the owner's approval. This is the owner asking, as the auto-merge rule of section 7 requires; the framework's task 3.18
  makes it a core rule.
