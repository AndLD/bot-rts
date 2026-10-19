[← AGENTS.md](../../AGENTS.md) · values: [profile](../profile.md) · stack: [stack.md](./stack.md)

# Engineering method

The project-neutral workflow of this repository: principles, the design checklist, the testing rules, the definition of done,
the Git workflow and the session protocol. It names **roles** ("the coverage gate", "the integration branch", "the plan
index"); their values are in the [project profile](../profile.md), and the tools that implement them are in the
[stack file](./stack.md). The rules every task needs are in [`AGENTS.md`](../../AGENTS.md), which is always loaded; this file is
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
[stack.md §5](./stack.md#5-definition-of-done-stack-items).

- [ ] Business logic implemented behind interfaces; no untyped public boundary.
- [ ] Unit tests cover the new code's happy path and error paths.
- [ ] Integration tests exercise the new data access and use cases against the real database.
- [ ] An end-to-end spec is added for any new user-visible flow.
- [ ] The coverage gate holds (CI green).
- [ ] The lint, typecheck and import-boundary commands of the profile pass in every package.
- [ ] The stack items of [stack.md §5](./stack.md#5-definition-of-done-stack-items) hold.
- [ ] No dead code, no commented-out blocks, no debug output.
- [ ] The task is marked ✅ in its phase file and the work log has an entry for it (section 6).
- [ ] The plan's status is updated (a phase becomes 🟡 when its first task starts and ✅ when its exit criteria are met, in the
      summary table and in the phase file), and the branch and pull request of the task are added to the phase's
      implementation log.
- [ ] Docs are updated if the change alters public behavior or configuration; if it changes a design decision, the matching
      product-knowledge or plan document is updated in the same pull request.
- [ ] New or changed endpoints are under the API prefix and appear in the API description; user-facing strings exist in every
      user-facing language.
- [ ] A task branch (named per section 5), a descriptive pull request, reviewed, merged by the merge strategy; the branch is
      kept.

## 5. Git workflow

- Branch types, their names, origins, targets and merge strategy are in the profile. Work branches from the integration branch
  and merges back through a pull request; releases go to the production branch.
- A branch may cover one task or a few closely related ones; name it after the first task (its plan task id) and list all of
  them in the phase's implementation log.
- A release is finished by merging the release (or hotfix) branch into the production branch, tagging it with the version, and
  **merging the same branch back into the integration branch** so fixes are not lost.
- Commits, pull requests, branch protection and merge approvals are rules of [`AGENTS.md`](../../AGENTS.md) §7.3–7.5.

## 6. Session protocol (resuming and pausing a phase)

Sessions can end at any time, so the repository, not the chat, carries the state of the work.

- **Pacing:** the phases named in the owner's request are worked straight through in the plan's order, across phase
  boundaries; the pause points are a blocker, a decision that only the owner can make, and the end of the last named phase. A
  finished phase is recorded (status, work log) and the next named phase starts.
- **At the start of a session** that continues a phase: read the phase file (task statuses), its work log and the log fragments of
  the tasks in progress (paths in the profile), then check `git status`, `git branch -a` and the open pull requests, and continue
  from the latest "next step". The implementation log is printed from the merged pull requests, not read from the phase file
  (profile, section 4).
- **Claim before work:** a task is claimed by a draft pull request opened before any other work on it (profile, section 4); a task
  that has an open pull request belongs to the session that opened it, and nobody else starts it.
- **While working:** set a task to 🟡 in the phase file when you start it and to ✅ when its definition of done holds. Commit
  often and push the task branch, so unfinished work is in git and not only in a working tree.
- **When a session ends or pauses, and when a task finishes:** write an entry in the log of the task (its own fragment file, so
  that two tasks never edit the same file) or, for a phase-wide matter, in the phase's work log (template inside the file): tasks,
  branch and its state, decisions and deviations from the plan, problems and findings, the exact next step, and the commands
  that verify the current state. Commit and push it on the task branch, in the same pull request as the work.
- **Changelog:** a change that a user of the product can see adds a changelog fragment (a file of its own, so that two changes
  never edit the same lines); the release collects the fragments (profile, section 7).
- **Local database after a phase:** when a phase's exit criteria are met (and the task pull requests are merged into the
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
  that has an open pull request, and never edits another agent's branch.
- **Integration.** The orchestrator or the owner merges the pull requests, one at a time, in the order of the dependency list; an
  agent does not merge its own pull request while others work. After each merge the next branch is rebased on the integration
  branch, and its checks run again.
- **Routing.** The CI events, merge conflicts and review comments of a pull request go to the session that owns it; the orchestrator
  forwards a comment that was made elsewhere. An agent does not act on events of a pull request it does not own.
- **Hotspots.** A file that several tasks of a wave write (the database migrations, the shared configuration, the registry of components)
  has one owner per wave, named in the phase file; the others rebase on that owner's change. Generated files are regenerated after a
  rebase and never merged by hand.
- **Records.** Each task writes its own log fragment and its own changelog fragment. The task table of the phase file and the plan
  index are updated by whoever merges, and the implementation log is printed from the merged pull requests (profile, section 4).
- **Environment.** Two working copies must not share ports, databases or running servers; the testing guide says how to separate them.
