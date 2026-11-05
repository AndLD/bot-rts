<!-- The managed block "git-rules" of the entry file (its section 7, up to the session protocol), rendered with the profile file by `harness sync`. Each rule carries a stable id in a comment; the Role binding line is the only line that names values. -->
**Role binding.** This repository fills the roles of §1 and §7 as follows, and this line is the only place in these two sections that names the values: the integration branch is `{{branches.integration}}`, the production branch is `{{branches.production}}`, the issue queue is the [open issues]({{rel:paths.issues}}/README.md), the repository host is {{repository.host}}; every other value is in the [profile]({{rel:paths.profileDocument}}).

### 7.1 Branches

Branch names, types and the merge strategy are in the [profile]({{rel:paths.profileDocument}}#3-branches-and-merging); how branches flow <!-- rule:git.branches -->
(one branch per task, finishing a release) is in [method §5]({{rel:documents.method}}#5-git-workflow).
**`<id>` is the task number from the development plan**, as in `feature/<id>-<slug>`.
Work that is not in the plan first becomes a task or an issue: a defect or an improvement found in use becomes an **issue** of the issue queue (`I-<n>`, a bugfix branch `bugfix/I-<n>-<slug>`), which is not a phase.
Documentation or tooling work that no task covers uses a branch slug only (the docs and chore branch types).

### 7.2 Merge strategy

Squash merge into the integration branch; a merge commit for release and hotfix branches ([profile]({{rel:paths.profileDocument}}#3-branches-and-merging)). <!-- rule:git.merge -->

### 7.3 Branch retention

- **Branches are never deleted from the repository host after merging; they are kept for history.** Turn off "automatically delete head <!-- rule:git.retention -->
  branches" in the repository settings, and never run `git push --delete` / `git push origin :branch` on a remote branch.
- Deleting a *local* branch is fine when it is already merged. <!-- rule:git.local-delete -->
- The production and the integration branch are protected: no direct pushes (for administrators <!-- rule:git.protection -->
  too), no force-push, no deletion, every change through a PR, and the **required checks** green. The required checks are listed with
  what each job runs in the [profile]({{rel:paths.profileDocument}}#2-quality-gates); that list is the only statement of the merge gates.
{{#if host.protection}}
  The host enforces this with the repository ruleset that `harness host protect` sets from the profile.
  An administrator may bypass the rules only when merging a PR, for example past a red check. That bypass is the owner's: an agent <!-- rule:git.admin-bypass -->
  never uses it unless the owner asks for that specific merge.
{{/if}}
{{#unless host.protection}}
  The host cannot enforce this for this repository (`host.protection` is off in the profile), so the Git hooks and the agent runtime's
  hooks hold it where they can, and an agent never merges a PR while a required check is not green.
{{/unless}}

### 7.4 Commit & PR rules

- Commit messages: the commit format of the [profile]({{rel:paths.profileDocument}}#3-branches-and-merging) (its type and optional scope, for <!-- rule:git.commit-format -->
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
  of the [profile]({{rel:paths.profileDocument}}#4-plan), for example "Start Phase N", "Work the issue queue" or "Fix I-<n>"), that request is the approval for **every task PR of the named phases and every PR of the named issues**.
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
  [profile]({{rel:paths.profileDocument}}#4-plan)); a task with an open pull request belongs to the session that opened it, and a session that
  resumes a phase continues it only as [method §6]({{rel:documents.method}}#6-session-protocol-resuming-and-pausing-a-phase) says (the log names it, or the owner does; otherwise ask).
  With several agents the orchestrator or the owner merges, and the CI events and review comments of a pull request go to the session
  that owns it ([method §7]({{rel:documents.method}}#7-several-agents)).
- **Opening a pull request is automatic.** Create the PR as soon as a branch is ready (any branch type, including <!-- rule:agent.open-pr -->
  release and hotfix branches into the production branch) without asking.
- **Ask the user before merging any other pull request:** documentation or chore PRs that are not related to the development plan of a named phase, anything <!-- rule:agent.ask-merge -->
  targeting the production branch, and release and hotfix branches. Approval for one merge does not carry over to another.
  The one exception is a **flow the owner started** (the procedure `run-flow`): its orchestrator approves the merges of a release or a hotfix itself when the
  flow's settings let it decide that cut: its level (by default a development version D1, a final release or a hotfix D3) is below the flow's `askAt`, or the flow is seamless. It merges them by merge commit once the
  required checks are green, never by the host's auto-merge and never by an administrator's bypass, tags the version, and logs the cut as a decision with its level
  (the procedure `release`). Otherwise, and for every other merge this rule names, it asks the owner like any agent.
- Never delete a remote branch, never force-push to the production or the integration branch, never rewrite published history. <!-- rule:agent.no-rewrite -->
{{#if host.autoMerge}}
- **Auto-merge merges a task's pull request; nothing waits for you to come back.** As the last step of a task, once its definition of done holds, <!-- rule:agent.auto-merge -->
  enable the host's auto-merge (squash) on exactly the pull requests this section lets you merge without asking: the task and plan-related
  pull requests of the named phases, into the integration branch. Never on a pull request into the production branch, on a release or a
  hotfix branch, or on one that needs the owner's approval; the shell guard refuses it there. When the checks are already green the host
  merges at once, which is expected. After you push to a pull request, check that auto-merge is still on, and merge a green pull request
  that is still open yourself. The final message lists the pull requests that wait for the owner.
- **A task that needs the previous one** branches from its branch (one level, no deeper) while that pull request is open; after the squash
  merge, retarget the pull request to the integration branch and run `harness branch update`, which brings it in and resolves the conflicts that only
  the squash causes; push after the retarget, because a retarget alone starts no checks. <!-- rule:agent.stack -->
{{/if}}
{{#unless host.autoMerge}}
- Never enable auto-merge unless the user asks. <!-- rule:agent.no-auto-merge -->
{{/unless}}
- **Automatic CI fixes are on for plan work.** After opening a PR for a named phase, attach it to the session and turn on the agent <!-- rule:agent.ci-fixes -->
  runtime's CI monitoring with automatic fixes (the tools are in [stack §6]({{rel:documents.stack}}#6-agent-runtime)) without
  asking; it wakes the session on CI failures, merge conflicts and review comments. Never wait by checking the pull request again and
  again; the runtime adapter says how a session waits (stack §6).
{{#if host.autoMerge}}
  When CI is green, the host merges the pull request (auto-merge); go on to the next task, so work flows across phases.
{{/if}}
{{#unless host.autoMerge}}
  When CI is green, merge per the rules above and go on to the next task, so work flows across phases.
{{/unless}}
