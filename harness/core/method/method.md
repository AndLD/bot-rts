# Engineering method

The project-neutral workflow of this repository: principles, the design checklist, the testing rules, the definition of done,
the Git workflow and the session protocol. It names **roles** ("the coverage gate", "the integration branch", "the plan
index"); their values are in the project profile, and the tools that implement them are in the
stack file. The rules every task needs are in the entry file, which is always loaded; this file is
read on demand through its reading map.

---

## 1. Principles

The project is developed to align with:

- **SOLID** — single responsibility, open/closed, Liskov substitution, interface segregation, dependency inversion (section 2).
- **High scalability** — a stateless, horizontally scalable request tier and indexed data access. A deliberate exception (for
  example a single in-memory owner of some state) is recorded in the architecture documents with its reason.
- **High testability** — dependency injection, pure domain logic, no hidden I/O.
- **High maintainability** — small cohesive units, no dead code, self-documenting names, up-to-date docs.
- **Low coupling** — layers talk through interfaces, not concrete singletons or transport objects.
- **Git Flow** — the production and integration branches and the branch types of the profile (section 5).
- **Tests for every feature**, held to the coverage gate (section 3).

If a rule conflicts with existing legacy code, the rule wins for **new and modified** code: refactor the touched area to comply
rather than perpetuating the anti-pattern.

## 2. SOLID checklist (apply per file)

- **S — Single responsibility:** one class or function, one reason to change. If a function validates, transforms, persists and
  formats a response, split it.
- **O — Open/closed:** extend behavior by adding classes (a new subclass or strategy), not by editing a central `switch`.
  Variant behaviors are polymorphic.
- **L — Liskov:** a subclass honors the contract of the interface it implements; callers never check the concrete type.
- **I — Interface segregation:** keep shared interfaces narrow, one per capability; don't force clients to depend on methods they
  don't use.
- **D — Dependency inversion:** depend on abstractions; inject dependencies (data access, clock, random generator, logger,
  registries), never import global mutable state.

## 3. Testing

### 3.1 Coverage gate

- The **coverage gate** of the profile applies to statements, branches, functions and lines, **separately per package**, so a
  well-tested package cannot hide an untested one, and to every source file a pull request changes.
- Scope: all source code is counted. Only entry and bootstrap files, config files, type-only files and generated code are
  excluded, and every exclusion is listed with its reason in the package's coverage configuration.
- The gate is enforced in CI and before a push (the local gate of the profile). A pull request below it is blocked.
- Any other exclusion is a targeted ignore comment that explains why, justified in the pull request.

### 3.2 Unit tests

- Pure functions, domain models, utilities, guards and validation.
- Use injected fakes (mocks or small hand-written fakes of a port), never real I/O and never a database, in-memory or
  otherwise. Anything that needs a database is an integration test (3.3).
- Test edge cases: empty inputs, boundary values, error paths.

### 3.3 Integration tests

- Repositories, use cases, and full slices from the transport layer through the use case to the repository.
- They run against a **real database of the same product and version as production**, started locally in a container, never a shared or
  production database and never an in-memory or embedded substitute. Each test worker uses its own database or schema; tests
  are isolated (transaction rollback or truncation).
- Authentication runs with real token signing where it matters, or with the fake identity verifier.

### 3.4 End-to-end tests

- **Every core user flow has an end-to-end spec.** The list of flows and the plan task that owns each spec is the end-to-end
  coverage matrix (document map of the profile). A pull request that adds or changes a user-visible flow adds or updates its
  spec and the matrix.
- Use a seeded test backend with deterministic data (seeded random generator and injected clock); never depend on a
  production database.
- The full suite runs in CI on every pull request into the integration branch; shard it when it grows slow.

## 4. Definition of done

A task is done only when **all** of these hold. The stack items (generated files, migrations, catalogues) are in
the stack file.

- [ ] Business logic implemented behind interfaces; no untyped public boundary.
- [ ] Unit tests cover the new code's happy path and error paths.
- [ ] Integration tests exercise the new data access and use cases against the real database.
- [ ] An end-to-end spec is added for any new user-visible flow.
- [ ] The coverage gate holds (CI green).
- [ ] The lint, typecheck and import-boundary commands of the profile pass in every package.
- [ ] The stack items of the stack file hold.
- [ ] No dead code, no commented-out blocks, no debug output.
- [ ] The task is marked ✅ in its task file (its row in the phase file of the older layout) and its log has an entry for it (section 6). Work that no task covers has its off-plan fragment instead (section 6).
- [ ] The plan's status is updated (a phase becomes 🟡 when its first task starts and ✅ when its exit criteria are met, in the
      summary table and in the phase index), and the branch and pull request of the task are added to the phase's
      implementation log.
- [ ] Docs are updated if the change alters public behavior or configuration; if it changes a design decision, the matching
      product-knowledge or plan document is updated in the same pull request.
- [ ] New or changed endpoints are under the API prefix and appear in the API description; user-facing strings exist in every
      user-facing language.
- [ ] The pull request body, the commit message and the final message are short (section 8): what changed, what was verified and what was not; long text is in a file of the plan, linked.
- [ ] A task branch (named per section 5), a descriptive pull request, reviewed, merged by the merge strategy; the branch is
      kept.

## 5. Git workflow

- Branch types, their names, origins, targets and merge strategy are in the profile. Work branches from the integration branch
  and merges back through a pull request; releases go to the production branch.
- A branch may cover one task or a few closely related ones; name it after the first task (its plan task id) and list all of
  them in the phase's implementation log.
- A release is finished by merging the release (or hotfix) branch into the production branch, tagging it with the version, and
  **merging the same branch back into the integration branch** so fixes are not lost.
- A new branch, working copy or session starts from the integration branch as it is on the remote: fetch first, and never start from the
  production branch or from a stale local copy.
- **Stacked pull requests** (each branch built on the previous one) conflict after every squash merge of the one below, because the
  later branches carry the same changes as separate commits. After a merge, move the next branch onto the integration branch with
  `git rebase --onto origin/<integration> <old tip of the merged branch> <next branch>`, rebase the rest the same way, and push them all
  with one `git push --force-with-lease origin <b1> <b2> …` (a pre-push hook then runs once). Keep the records that every task edits (the
  phase file, the work log) in as few branches as possible, and prefer fewer, larger pull requests over a deep stack when the tasks
  touch the same documents.
- Commits, pull requests, branch protection and merge approvals are CORE rules. They are stated once, by role, in the entry file (§7.3–7.5), which the agent runtime loads; one line there binds the roles to this repository's values, and the CORE scan of the documentation check keeps every other value out of them.

## 6. Session protocol (resuming and pausing a phase)

Sessions can end at any time, so the repository, not the chat, carries the state of the work.

- **Pacing:** the phases named in the owner's request are worked straight through in the plan's order, across phase
  boundaries; the pause points are a blocker, a decision that only the owner can make, and the end of the last named phase. A
  finished phase is recorded (status, work log) and the next named phase starts.
- **At the start of a session** that continues a phase: read the phase index and the file of the task you work on (not the other
  tasks), the newest "next step" of the phase's logs (the session-start hook prints it, with the open tasks) and the log of that
  task (paths in the profile; a phase kept as one file has its phase file, its work log and the fragments of the tasks in progress),
  then check `git status`, `git branch -a` and the open pull requests, and continue
  from the latest "next step" (a claimed task is continued only as the claim rule below says). The implementation log is printed from the merged pull requests, not read from the phase file
  (profile, section 4).
- **Claim before work:** a task is claimed by a draft pull request opened before any other work on it (profile, section 4). A claim
  belongs to its session while that session works, and no other agent starts the task. A session that resumes a phase **continues a
  claimed task** when the log of the task or the work log of the phase records a pause, or a "next step" that names it, or when the
  owner says so; otherwise it asks, and starts nothing. The same state is therefore read one way: a claim that the log of a paused
  session names is continued, any other open claim is another agent's.
- **Which task is next:** the order the plan says, not the order of the table: the phase's execution order (the line of its file),
  and the release order when the phase points there (the releases file of the profile, else the plan index's order of development); the table's order only when neither exists.
- **While working:** set a task to 🟡 in its task file (the phase file of the older layout) when you start it and to ✅ when its definition of done holds; `harness plan summary` regenerates the task table of the phase index. Commit
  often and push the task branch, so unfinished work is in git and not only in a working tree.
- **When a session ends or pauses, and when a task finishes:** write an entry in the log of the task (its own file beside the task
  file, so that two tasks never edit the same file; a finished task writes only that log, and its "next step" names what follows)
  or, for a phase-wide matter, in the phase's work log (template inside the file): tasks,
  branch and its state, decisions and deviations from the plan, problems and findings, the exact next step, and the commands
  that verify the current state. Commit and push it on the task branch, in the same pull request as the work.
- **Nothing merges without a record:** the work of a task is recorded in the log of the task, a phase-wide matter in the log of the phase, and work that no task covers
  (documentation, tooling, CI, a change of the plan) in an off-plan fragment, a file of its own for the pull request (the off-plan record of the profile, section 4, where the
  project has the role); the commit of a pull request that has a task has its `Plan: <task id>` line instead. `harness check off-plan` lists the merged pull requests with neither.
- **Changelog:** a change that a user of the product can see adds a changelog fragment (a file of its own, so that two changes
  never edit the same lines); the release collects the fragments (profile, section 7).
- **Local database after a phase** (only where the profile has the database commands, an optional role group; a project without
  them has no such step): when a phase's exit criteria are met (and the task pull requests are merged into the
  integration branch), bring the developer's local database up to date before reporting the phase as done, with the database
  commands of the profile (start, migrate, and seed when the phase changed the seed data). Run them from the updated
  integration branch, never against a shared or production database. Record the result in the phase's work log and tell the
  owner in the final summary; if the database is not reachable, say so and give the commands instead of skipping the step.
- Decisions that change the design or the plan go into the matching document in the same pull request, not only into the log.

## 7. Several agents

One agent works through the plan serially (section 6). When several agents work on a phase at the same time, these rules keep them
from overwriting each other; they cost nothing for a single agent.

- **Roles.** The *owner* decides what the product is. An *orchestrator* (the owner or one session) splits the phase into waves from the
  dependency list of the phase file, writes the contracts that two tasks share before the wave that needs them, and assigns each task
  to a lane. A *lane agent* takes the tasks of its lane one at a time.
- **Working copy.** Each agent works in its own working copy, started from the integration branch (never from the production branch),
  on its own branch.
- **Claim.** A task is claimed by a draft pull request opened before any other work on it (section 6). An agent never starts a task
  that has an open pull request, unless the claim is its own to continue (section 6), and never edits another agent's branch.
- **Integration.** The orchestrator or the owner merges the pull requests, one at a time, in the order of the dependency list; an
  agent does not merge its own pull request while others work. After each merge the next branch is rebased on the integration
  branch, and its checks run again.
- **Routing.** The CI events, merge conflicts and review comments of a pull request go to the session that owns it; the orchestrator
  forwards a comment that was made elsewhere. An agent does not act on events of a pull request it does not own.
- **Hotspots.** A file that several tasks of a wave write (the database migrations, the shared configuration, the registry of components)
  has one owner per wave, named in the phase file; the others rebase on that owner's change. Generated files, the vendored copy of the
  framework and its lock among them, are regenerated after a rebase (a sync) and never merged by hand.
- **Records.** Each task writes its own log and its own changelog fragment, and sets its own status in its task file. The task table of the phase index and the plan
  index are regenerated by whoever merges (`harness plan summary`), and the implementation log is printed from the merged pull requests (profile, section 4).
- **Environment.** Two working copies must not share ports, databases or running servers; the testing guide says how to separate them.
- **Flows.** Where the plan has flows (plan method, section 10), the orchestrator of a flow is one session that runs its steps one after another with the procedure
  `run-flow`, hands each to a worker, and logs every decision with its level; it claims the flow by a "running" entry in the flow's log.

## 8. Output budgets and short reports

Everything an agent puts into its context is read again on every later turn, so the output of its commands and its own words are a budget, not a habit. The commands and
hooks print little by default (the quiet variants of the profile); these rules say what an agent adds.

- **Read with a filter.** Use the fields or the filter of a command (the host's command line has them), `--stat` and a path for a diff, the tail of a log, an offset and a limit for a file;
  read a whole file only where a procedure says so (the migration note before a cut is the one such place). Run a command that may print a lot in its quiet variant, or cap its output.
- **Short closing text.** A pull request body, a commit message, a log entry and the final message of a session say what changed, what was verified and what was not, in a few lines.
  Long text goes into a file of the plan (the task's log), and the message links it.
- **The step report of a flow's worker** has a schema and a hard cap on its length (lines and characters), so that the orchestrator reads it whole: a status, the pull requests merged and the ids done, the
  open decisions with their options and level, the deviations and reports filed, the next step, and the recommendations last. What does not fit goes into the task's log, and the report links it. The wording
  is in the [step prompts](../plan/flow-step-prompts.md), the cap in the tool, and `harness flow report-check <file>` checks a report against both.
