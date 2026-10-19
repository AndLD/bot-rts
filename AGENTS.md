# AGENTS.md — Engineering rules for agents

This file is the source of truth for **any agent or human contributor** working on this repository and is loaded into every
agent session. It holds the rules every task needs: the non-negotiables, the Git and merge rules and the product rules, plus a
reading map. The rest is read on demand:

- the [project profile](./docs/profile.md): every value the rules cite by role (the coverage gate, branch names and types, merge
  strategy, the API prefix, the user-facing languages, versions, commands) and the map of the documents;
- the [engineering method](./docs/engineering/method.md): principles, SOLID checklist, testing rules, definition of done, Git
  workflow, session protocol;
- the [stack file](./docs/engineering/stack.md): tools, layering, conventions, test tooling, the stack items of the definition of
  done, the agent-runtime tools;
- the [architecture](./docs/engineering/architecture.md): identity providers, persistence, the engine as the single owner of
  world state.

## Reading map

| To … | Read first |
| ---- | ---------- |
| start or continue a phase, or end a session | [method §6](./docs/engineering/method.md#6-session-protocol-resuming-and-pausing-a-phase) (session protocol), then the phase file and its work log ([plan index](./docs/development-plan/DEVELOPMENT-PLAN.md)) |
| write or change code in any package | [stack.md](./docs/engineering/stack.md) (stack, layering, conventions) and [method §2–§3](./docs/engineering/method.md#2-solid-checklist-apply-per-file) (SOLID, testing) |
| add or change an endpoint | [stack §2.0](./docs/engineering/stack.md#20-one-api-for-every-client), [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items) (generated files), [`API.md`](./docs/product-knowledge/integrations/API.md) |
| change the database schema or authentication | [architecture](./docs/engineering/architecture.md) (persistence and migrations §2, identity providers §1) |
| add or change a user-visible flow | [method §3.4](./docs/engineering/method.md#34-end-to-end-tests) and the [e2e matrix](./docs/testing/e2e-matrix.md) |
| change a game rule or add a game feature | [`GAME-DESIGN.md`](./docs/product-knowledge/game-design/GAME-DESIGN.md) and the [glossary](./docs/product-knowledge/game-design/02-glossary.md), then section 9 below |
| see which tool holds a rule | the [rule-to-check map](./docs/engineering/rule-checks.md) |
| finish a task | [method §4](./docs/engineering/method.md#4-definition-of-done) and [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items) (definition of done) |
| cut a release or a hotfix | [`RELEASING.md`](./docs/operations/RELEASING.md) |
| run tests, find a command | [`docs/testing/`](./docs/testing/README.md), [profile §8](./docs/profile.md#8-commands) |
| find any other document | [profile §10](./docs/profile.md#10-document-map) (document map) |

---

## 1. Mission & non-negotiables

The principles (SOLID, scalability, testability, maintainability, low coupling, Git Flow, tests for every feature) are in
[method §1](./docs/engineering/method.md#1-principles). If a rule conflicts with existing legacy code, the rule wins for **new
and modified** code — refactor the touched area to comply rather than perpetuating the anti-pattern.

Non-negotiables (a PR that violates these is rejected). **Changing one needs the owner's explicit confirmation of that change**, recorded
in the pull request; a mention in passing ("the gate is annoying") is not a confirmation, so ask.

1. Every feature ships with **unit + integration tests**, and user-visible flows get **e2e** tests.
2. Coverage must stay at or above the coverage gate ([profile](./docs/profile.md#2-quality-gates)); CI fails below it.
3. No new `any`-typed public API boundaries. No new magic string logic without a typed constant.
4. No dead code, no commented-out blocks, no `console.log` left in committed code (use the logger).
5. No secrets in the repo; add values only to `.env.example`, never `.env`.

## 2.–6. Moved sections

The former sections keep their numbers here so that older references resolve:

- §2 Tech stack & test tooling → [stack §1](./docs/engineering/stack.md#1-tech-stack-and-test-tooling-do-not-substitute).
- §3 Architecture & layering: §3.0–§3.2 → [stack §2](./docs/engineering/stack.md#2-architecture-and-layering) (§2.0–§2.2); §3.3 identity providers → [architecture §1](./docs/engineering/architecture.md#1-identity-provider-abstraction); §3.4 persistence → [architecture §2](./docs/engineering/architecture.md#2-persistence-isolation-postgresql--prisma).
- §4 SOLID checklist → [method §2](./docs/engineering/method.md#2-solid-checklist-apply-per-file) (its application to this code: [stack §3.4](./docs/engineering/stack.md#34-solid-in-this-code-base)).
- §5 Conventions → [stack §3](./docs/engineering/stack.md#3-conventions).
- §6.1–§6.4 Testing → [method §3](./docs/engineering/method.md#3-testing) (rules) and [stack §4](./docs/engineering/stack.md#4-test-tooling) (tools).
- §6.5 Definition of done → [method §4](./docs/engineering/method.md#4-definition-of-done) and [stack §5](./docs/engineering/stack.md#5-definition-of-done-stack-items).

---

## 7. Git Flow

### 7.1 Branches

Branch names, types and the merge strategy are in the [profile](./docs/profile.md#3-branches-and-merging); how branches flow
(one branch per task, finishing a release) is in [method §5](./docs/engineering/method.md#5-git-workflow).
**`<id>` is the task number from the development plan**, for example `feature/3.12-api-v1-foundation`.
Work that is not in the plan first becomes a task: a defect or an improvement found in use becomes a Phase 12 task (`bugfix/12.<n>-slug`).
Documentation or tooling work that no task covers uses a branch slug only (`docs/<slug>`, `chore/<slug>`).

### 7.2 Merge strategy

Squash merge into the integration branch; a merge commit for release and hotfix branches ([profile](./docs/profile.md#3-branches-and-merging)).

### 7.3 Branch retention

- **Branches are never deleted from GitHub after merging; they are kept for history.** Turn off "automatically delete head
  branches" in the repository settings, and never run `git push --delete` / `git push origin :branch` on a remote branch.
- Deleting a *local* branch is fine when it is already merged.
- `main` and `develop` are protected by the repository ruleset of `scripts/protect-branches.sh`: no direct pushes (for administrators
  too), no force-push, no deletion, every change through a PR, and the **required checks** green. The required checks are the
  status contexts that script sets, listed with what each job runs in the [profile](./docs/profile.md#2-quality-gates); that
  list is the only statement of the merge gates.
  An administrator may bypass the rules only when merging a PR, for example past a red check. That bypass is the owner's: an agent
  never uses it unless the owner asks for that specific merge.

### 7.4 Commit & PR rules

- Commit messages: the commit format of the [profile](./docs/profile.md#3-branches-and-merging) (Conventional Commits, for
  example `feat(engine): …`), with the plan task id in the body (`Plan: 3.12`).
- One logical change per commit; PRs should be small and single-purpose.
- No direct commits to `main` or `develop`; merge via PR with at least one review (while the project is solo, the owner's
  approval to merge counts as the review).
- The required checks (§7.3) must be green before merge.

### 7.5 Rules for agents

- If the current branch is `main` or `develop`, **create the right branch first** (names per §7.1) before changing files. Start every new branch, worktree and session from `origin/develop` (fetch first).
- Committing and pushing to a feature/bugfix/docs/chore branch is routine and **needs no confirmation**. Never commit or
  push directly to `main` or `develop`.
- **Plan work (approval given by the request):** when the user asks to start or continue one or more phases (the resume phrases
  of the [profile](./docs/profile.md#4-plan), for example "Start Phase 0"), that request is the approval for **every task PR of the named phases**. Create each
  task's pull request into `develop` and squash-merge it **without asking**, once the required checks pass (before CI
  exists: once lint, typecheck and tests pass locally). Do not pause between tasks, and when a named phase's exit criteria are
  met, record it and start the next named phase. Stop after the last named phase with a summary, and earlier only when
  blocked or when a decision is needed that only the user can make. The approval does not extend to phases that were not named.
- **Plan-related PRs merge the same way.** Every PR that belongs to a named phase is covered by the same approval: its task
  PRs, and also the documentation and chore PRs that exist because of the plan (the phase's implementation log, task and
  status updates in the phase file and the development plan, the work log, the matching `docs/product-knowledge/game-design/` updates, and
  the fixes of tooling or tests that block a task). Merge them without asking once the required checks pass. A PR counts as
  plan-related only when it serves a named phase; anything else follows the next rule.
- **Claim a task before working on it.** Push its branch and open a **draft** pull request for it first (title
  `chore(plan): claim task <id>`, `Plan: <id>` in the body); a task with an open pull request belongs to the session that opened it.
  With several agents the orchestrator or the owner merges, and the CI events and review comments of a pull request go to the session
  that owns it ([method §7](./docs/engineering/method.md#7-several-agents)).
- **Opening a pull request is automatic.** Create the PR as soon as a branch is ready (any branch type, including
  `release/*` and `hotfix/*` into `main`) without asking.
- **Ask the user before merging any other pull request:** documentation or chore PRs that are not related to the development plan of a named phase, anything
  targeting `main`, and `release/*` / `hotfix/*` branches. Approval for one merge does not carry over to another.
- Never delete a remote branch, never force-push to `main` or `develop`, never rewrite published history.
- Never enable auto-merge unless the user asks.
- **CI Auto-fix is on for plan work.** After opening a PR for a named phase, attach it to the session and turn on the agent
  runtime's CI monitoring with automatic fixes (the tools are in [stack §6](./docs/engineering/stack.md#6-agent-runtime)) without
  asking; it wakes the session on CI failures, merge conflicts and review comments. Do not poll CI yourself. When CI is green,
  merge per the rules above and go on to the next task, so work flows across phases.

### 7.6 Session protocol

Moved to [method §6](./docs/engineering/method.md#6-session-protocol-resuming-and-pausing-a-phase).

---

## 8. Do's & Don'ts

Removed: it restated §1–§7 and the method. The rules are in §1, §7, §9, the [method](./docs/engineering/method.md) and the
[stack file](./docs/engineering/stack.md).

---

## 9. Project-specific rules (details in `docs/`)

- **Docs are the source of truth** for game rules and plan: [`docs/product-knowledge/game-design/GAME-DESIGN.md`](./docs/product-knowledge/game-design/GAME-DESIGN.md) and
  [`docs/development-plan/DEVELOPMENT-PLAN.md`](./docs/development-plan/DEVELOPMENT-PLAN.md). Check them before implementing a feature and keep them in sync.
- **Harness quality:** the docs and this harness are reviewed by [`docs/quality-reviews/harness/README.md`](./docs/quality-reviews/harness/README.md)
  (layers, scoring, procedure; this repository's values in `bindings.md` there). A review adds one dated report and changes nothing else;
  fixes follow in separate pull requests.
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
