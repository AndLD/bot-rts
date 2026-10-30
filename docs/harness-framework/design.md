[← Harness-to-framework plan](./README.md) · phase: [Phase 17](../development-plan/phases/phase-17-harness-framework.md)

# Framework design

**Status:** proposed by task 17.1 on 2026-10-21; accepted when its pull request is merged. **Scope:** how `harness-framework` is built
from this repository's harness and how `bot-rts` consumes it. Nothing is built by this document. The build order of section 10 becomes
tasks 17.2 onward of the phase file in the same pull request.

**Inputs.** The owner's decisions of 2026-10-20 ([Phase 17 work log](../development-plan/phases/work-logs/phase-17-log.md)), which this
design does not reopen. Step 3 of the [harness-framework plan](./README.md#step-3-extract-the-framework). The latest harness review,
[2026-10-19-3](../quality-reviews/harness/2026-10-19-3.md): its export dry run, blockers B6 and B7, and findings H-20261019-22 to -24. The
[review method](../quality-reviews/harness/README.md) and its [bindings](../quality-reviews/harness/bindings.md) (layer map and `core-files`
block). The [profile](../profile.md) and [`scripts/harness-profile.json`](../../scripts/harness-profile.json). The CI jobs and the pre-push hook
as Phase 16 left them on `develop` at `a53de8b`: `verify` and `e2e` are aggregator jobs over parallel jobs and shards, and
`.githooks/pre-push` runs `scripts/local-gate.mjs`, which checks only what the pushed files need. Task 16.7 was deferred, so there is no
stacked-branch rule for CI waits; method §5 keeps its older note on rebasing stacked pull requests.

**The decisions, in one line each.** `bot-rts` consumes the framework. The bootstrap is agent-neutral: a template repository, a script and a
`BOOTSTRAP.md` prompt over one engine. `AGENTS.md` stays the entry point. Guarantees live in Git hooks and CI; runtime hooks are optional and
call the same scripts. Skills are Markdown procedures that each runtime packages. The first release holds everything project-neutral,
tooling included. The name is `harness-framework`, under the MIT license, with semantic versioning and a changelog. Any stack works through a
contract, with presets for TypeScript/Node and Python. The tools run on Node. GitHub sits behind a host adapter. The runtime presets are
Claude Code and Cursor.

## Summary

| # | Item | Proposal |
| - | ---- | -------- |
| 1 | Consumption | A **vendored copy** at `harness/`, pinned by `harness.lock.json` (version, source and a hash per file). `harness sync` updates it and `harness check` fails on a local edit. Improvements go to the framework source and come back by a sync. Subtree, submodule and an npm package are rejected. A project may instead **detach**: it owns and edits its copy, takes no more updates, and keeps the checks; the lock records the fork point (section 1). |
| 2 | Layout | §3.2 is confirmed and adjusted: adapters on **three axes** (`stack/`, `runtime/`, `host/`), plus `tools/`, `BOOTSTRAP.md`, `core/procedures/`, `core/contracts/` and a conformance suite. The staging folder stays `docs/harness-framework/framework/` (section 2). |
| 3 | Classification | Every harness file and section is sorted into core, adapter, profile, example or "stays", with one table per area (section 3). |
| 4 | Contracts | Three role lists (stack, runtime, host) as machine-readable manifests, and a per-rule table of where each rule is caught (section 4). |
| 5 | New adapter | Copy the skeleton, fill the manifest, then run `harness adapter test`. That is the same suite the presets pass (section 5). |
| 6 | Bootstrap | One engine, whose input is a complete `harness-profile.json`. The script, the template repository and `BOOTSTRAP.md` only fill that file, so all three give the same result, and a test proves it (section 6). |
| 7 | Mechanisms | The CORE scan, the profile file and its reader, the hooks, the protection script and the profile tests become `harness` commands on Node. `profile.md` is generated from the profile file (section 7). |
| 8 | B6, B7 | Procedures are neutral Markdown, packaged per runtime into skills (B6). The layer map is generated from the lock and the profile file (B7). H-22 and H-23 are absorbed by these two changes; H-24 is not framework work (section 8). |
| 9 | Cursor | Checked on 2026-10-21. Cursor reads `AGENTS.md` natively. It has a native `.cursor/hooks.json` and native skills, and custom commands now go through skills. It also loads Claude Code's `.claude/` hooks and skills by default, and its CLI has no opt-out. So the Cursor preset is native when Cursor is the only runtime, and runs in compat mode next to Claude Code (section 9). |
| 10 | Build order | Nineteen pull requests, 17.2 to 17.20, 63 SP. They start with a targeted review of D3, D7, D8, D14 and D15, and end with a closing review by another session (section 10). |

---

## 1. How `bot-rts` consumes the framework

### 1.1 The mechanism: a vendored copy, pinned and hash-checked

- **Where.** The framework's selected parts are copied to a folder `harness/` at the repository root. The folder holds `core/`,
  `profile/` (the schema and the role descriptions), `tools/`, the adapters the project selected (for `bot-rts`: `stack/node-ts`,
  `runtime/claude-code`, `host/github`), `framework.json`, `README.md`, `CHANGELOG.md` and `LICENSE`. It does not hold the other presets,
  `examples/` or the conformance fixtures.
- **Pin.** `harness.lock.json` at the root records the framework version, the source (a local path while staging, later a Git URL and
  tag), the selected adapters, the SHA-256 of every vendored file and of every managed file it generates (section 6.3), and the hash of
  the profile file used for the generation.
- **Update.** `node harness/tools/harness.mjs sync [--to <version>] [--from <path or URL>]` replaces the vendored tree, regenerates
  the managed files and rewrites the lock. A sync is a chore pull request of its own, with the framework changelog of the versions it
  crosses in its body.
- **Guard.** `harness check vendored` is part of the documentation check and of CI. It fails when a vendored or managed file differs from
  its locked hash, or when the profile file changed since the last generation; then run `harness sync`. The runtime edit guard (section 7.3)
  refuses an agent's edit under `harness/` early, with a message that names the framework source.
- **Read-only, byte-identical.** Vendored files are copied as they are, not rendered with project values. The rules cite roles, and the
  profile holds the values, as Phase 15 built them (D3 scored 5 on exactly this). Only *generated* files carry values (section 6.3), and
  they are checked by regenerating them.
- **Links.** A core document links only inside `core/`. It names a project document by its role ("the profile", "the stack file", "the
  plan index"), and the profile's document map resolves the role to a path. The entry file's reading map links the profile, so an agent
  needs at most one more hop than today. The framework's link check refuses a core link that leaves `core/`.
- **No dependencies.** The tools are plain Node modules with no npm dependencies, so a fresh worktree, a Python project and CI can
  run them without installing anything but Node.

### 1.2 Why not the alternatives

| Option | Why not |
| ------ | ------- |
| Git subtree | `git subtree pull` merges the framework's history, and its later pulls find the last import from commit trailers. The integration branch takes squash merges only, and a squash keeps neither the merge nor reliably the trailers, so every pull after the first one is fragile. Sending a change back (`git subtree push`) needs write access to the framework repository from this one, which the agent must not have. |
| Git submodule | Every worktree and every CI checkout must initialise it, and agents often start in fresh worktrees. Relative links from the project into a submodule do not resolve on the repository host. The copy is invisible to search tools until it is checked out. |
| npm package | Documents in `node_modules` are not committed, so an agent that has not installed sees no method. A Python project would need npm for its rules. The version is pinned in a second place (the lock file of the package manager). It stays possible later for the tools alone, without changing the layout. |
| Copy once, without a lock | It drifts unseen, and the owner chose to consume for `bot-rts`. A project that wants its own copy detaches instead (section 1.5), which keeps the checks and the record of where it forked. |

### 1.3 How an improvement found here reaches the framework

1. **Never in place.** An agent does not edit `harness/`: the edit guard refuses it, and if the guard is absent, `harness check vendored` fails
   the push and CI.
2. **While staging (Phase 17):** the source is `docs/harness-framework/framework/` in this repository. Change the source, add a line to
   its `CHANGELOG.md` under "Unreleased", bump the version in `framework.json` by the rules of section 1.4, and run `harness sync`. The source and the
   vendored copy change in the same pull request, and the check proves them equal.
3. **After the owner has published the framework** (its own repository): a finding of kind "fix in the framework" from a harness review,
   or a defect found in daily work, becomes an issue or a pull request in the framework repository. The agent writes the patch with
   `harness diff`, which prints the change against the locked version, and hands it over; it does not push to another repository without
   the owner's explicit authorisation. When the framework releases the fix, `bot-rts` takes it with a sync pull request.
4. **Emergency override.** If `bot-rts` cannot wait for a release, the lock may list a file under `overrides` with a reason and the framework
   issue. `harness check vendored` then accepts that file's local hash and prints the override on every run. The next sync drops the entry,
   and a closing review counts the open overrides.

### 1.4 Versions

- The framework uses semantic versioning on its **roles and contracts**. A *major* version removes or renames a role, changes the meaning of a core
  rule, or changes an adapter contract so that an existing adapter fails the conformance suite. A *minor* version adds a role with a default, a
  preset, a procedure or a check. A *patch* changes wording or fixes a tool without changing its contract.
- **First release: `0.1.0`**, when the owner copies the staging folder to its own repository. While staging, the version reads `0.1.0-dev`.
  `1.0.0` comes after the second real project (the trading-bot project of the plan's step 4) has bootstrapped without a core edit.
- The changelog follows the Keep a Changelog headings. Its "Upgrade notes" list, per version, the changes to scaffolded files that a sync
  cannot make (section 6.3).

### 1.5 A standalone fork

A project may want the framework once and then own it: edit the core freely, never take another update. The lock supports this as a second
**mode**, so the project keeps the tools and the checks, and keeps the record of where it forked. `bot-rts` stays pinned (the owner's decision).

**The lock, in both modes.** The fields of section 1.1 plus two:

| Field | Pinned (default) | Detached |
| ----- | ---------------- | -------- |
| `mode` | `"pinned"` | `"detached"` |
| `source`, `version` | where the next sync comes from | `null`: there is no upstream |
| `base` | – | the fork point: the framework name, source, version and the hash of every vendored file at the moment of detaching |
| `files` | the hashes `check vendored` enforces | not enforced; the managed files keep their hashes, which `check generated` uses |
| `overrides` | allowed, temporary (section 1.3) | none: every file is the project's |

**What changes when a project detaches.**

| Mechanism | Pinned | Detached |
| --------- | ------ | -------- |
| Owner of `harness/` | the framework | **the project**: it is core, but core the project maintains |
| `harness check vendored` and the edit guard | refuse a local edit | off; the edit guard allows `harness/` |
| `harness check core` (the CORE scan) | runs upstream, on the framework source | runs **in the project** on `harness/core/`, with the project's term lists, because nobody upstream scans this copy any more |
| `harness check generated`, `scaffold`, `layers` and the rest | on | on: the managed files are generated from the project's own `harness/`, so an edit to a core rule reaches the entry file's blocks and the skills by the next `harness sync --local` |
| `harness sync` | takes a version from the source | refuses; `harness sync --local` only regenerates the managed files from `harness/` |
| `harness diff` | the change against the locked version | the change against `base`: what the fork has done since it left |
| The framework's changelog and version | the framework's | the project keeps `CHANGELOG.md` and `framework.json` as they were at the fork; its own changes go to its own changelog |

**How to detach.** `harness detach --reason "<why>"` in a pull request of its own: it moves the hashes to `base`, sets the mode, writes the
reason into the lock and prints the license reminder. The MIT license requires the copyright and permission notice to stay with the copy, so
`harness/LICENSE` stays, and `check scaffold` keeps checking that it does. A new project can start detached with `harness init --detached`;
the result equals a pinned bootstrap followed by `harness detach` (the sameness test of section 6.2 covers it).

**Coming back** is deliberately not in the first release. Because the lock keeps `base`, it can be added later as `harness reattach --to
<version>`: a three-way merge of each file from `base` to the project's copy and from `base` to the new version, with conflicts left in the
files for a person. Without `base`, a detached copy could never be compared or merged again, which is why detaching keeps the lock instead of
deleting it.

**A fork of the framework itself** is the other kind of standalone. An organisation that wants its own variant for several projects forks the
`harness-framework` repository, gives the fork its own `name` and versions in `framework.json` (with `upstream`: the name and version it
follows), and its projects stay **pinned** to the fork (`harness sync --from <fork URL>`). That needs no new mechanism: the source of the lock
is any Git URL and tag. The fork takes upstream changes by ordinary Git merges in its own repository. Choose detaching for one project that
wants to own its method, and a fork of the framework for a variant that several projects share.

---

## 2. Target layout

§3.2 of the plan is **confirmed** with these **adjustments**: adapters on three axes instead of one; a `tools/` folder, since the first release
includes the tooling; `BOOTSTRAP.md` at the top, as the prompt any agent can follow; neutral procedures and the adapter contracts inside `core/`;
and a conformance suite. The staging folder stays `docs/harness-framework/framework/`, and its content is the framework repository's tree.

```
framework/                      staging: docs/harness-framework/framework/; later the root of the harness-framework repository
  README.md                     what it is, how to bootstrap, how to sync, how to upgrade
  BOOTSTRAP.md                  the agent-neutral bootstrap prompt (section 6)
  CHANGELOG.md  LICENSE         MIT
  framework.json                name, version, the list of adapters and their axes
  core/                         project-, stack-, runtime- and host-neutral
    rules/                      non-negotiables and Git rules (the managed blocks of the entry file), with stable rule ids
    method/                     principles, SOLID checklist, testing, definition-of-done skeleton, Git workflow, session protocol, several agents
    plan/                       plan method, index and phase templates, task-log template, definition of done, guiding principles
    reviews/                    review index, code review and harness review methods with templates
    procedures/                 neutral procedures, packaged per runtime as skills (B6)
    contracts/                  stack.md, runtime.md, host.md: the role lists of section 4, and new-adapter.md (section 5)
    templates/                  entry file, rule-to-check map, profile document, bindings, plan index, phase file, work log, changelog fragments
  profile/
    harness-profile.schema.json the machine-readable profile: every role, with type, default and description
    roles.md                    the human description of every role (the source of the generated profile document)
  adapters/
    stack/node-ts/  stack/python/        manifest.json, gate.mjs, coverage.mjs, ci/ templates, stack-file template, terms
    stack/_skeleton/
    runtime/claude-code/  runtime/cursor/  manifest.json, the entry-file pointer, hook config templates, skill packaging
    runtime/_skeleton/
    host/github/                         manifest.json, protect.mjs, workflow templates (pull-request title, change detection, aggregators, release)
    host/_skeleton/
  tools/
    harness.mjs                 the command line: init, bootstrap, sync, diff, check, profile, layers, plan, release, host, adapter, status
    lib/                        the engine and the checks, pure functions with node --test tests
    git-hooks/                  pre-commit, pre-push (thin shell files that call harness.mjs)
    runtime-hooks/              guard-shell, guard-edit, format-edited, session-start, and io.mjs (input and output per runtime)
  tests/conformance/            the suite that every adapter passes (section 5), with fixture projects
  examples/
    profile/                    a filled harness-profile.json of a fictitious project
    product/                    a product-knowledge skeleton: specification index, glossary, open-questions register, backlog
    plan/                       a plan index and one phase with two tasks and their logs
```

The three axes are independent: a project selects one stack adapter, one or more runtime adapters and one host adapter in the profile
file (`adapters.stack`, `adapters.runtimes`, `adapters.host`). A project with no runtime adapter is valid. It gets `AGENTS.md`, the
procedures linked from its reading map, the Git hooks and CI, which is the agent-neutral minimum the owner asked for.

In a consuming project:

| Path | Owner | Kind |
| ---- | ----- | ---- |
| `harness/` | the framework (pinned) or the project (detached, section 1.5) | vendored, hash-locked while pinned |
| `harness.lock.json` | the tools | written by `sync` and `bootstrap` |
| `harness-profile.json` | the project | the only place for values (moved from `scripts/` in `bot-rts`) |
| `docs/profile.md`, the layer-map block, the entry file's managed blocks, packaged skills | the tools | **managed**: generated, checked by regenerating |
| `AGENTS.md` outside its blocks, `README.md`, `docs/` skeleton, CI workflows, runtime config files | the project | **scaffolded**: written once by the bootstrap, then the project's; their invariants are checked |

---

## 3. Classification

Target: **core** (`framework/core`, `tools`), **stack**, **runtime** or **host adapter**, **profile template** (`framework/profile` or
`core/templates`), **example**, or **stays** in `bot-rts` (DOMAIN, STATE or project-specific ADAPTER). "Split" names the parts. The basis is
the `core-files` block of the [harness bindings](../quality-reviews/harness/bindings.md) and the export dry run of the
[2026-10-19-3 report](../quality-reviews/harness/2026-10-19-3.md); P5's finding that three DOMAIN checks hard-code product file names is
resolved by parameterising them.

### 3.1 Entry files and the profile

| File and section | Target | Note |
| ---------------- | ------ | ---- |
| `AGENTS.md` head and reading map | split: **template** (`core/templates/entry.md`) + **stays** (its rows) | The template gives the head and the rows for the core tasks. The project adds rows. |
| `AGENTS.md` §1 non-negotiables | **core** (`core/rules/non-negotiables.md`), managed block | Two wordings name a stack and become roles, with the same meaning. "No new `any`-typed public API boundaries" becomes "no untyped public boundaries". "No `console.log`" becomes "no debug printing (use the logger)". The stack adapter names the lint rule (`no-explicit-any`, `no-console`; Python: `ANN401`, `T201`). Accepting this design accepts these two wordings. |
| `AGENTS.md` §2–§6, §7.6, §8 pointer stubs | **stays** | They exist for this repository's old anchors; the template has none. |
| `AGENTS.md` §7 Role binding line | **generated** from the profile file | It stays the only line that names values. |
| `AGENTS.md` §7.1–§7.5 | **core** (`core/rules/git.md`), managed block | §7.5's "CI monitoring with automatic fixes" stays a role. The runtime adapter fills it (section 4.2). |
| `AGENTS.md` §9 project rules | **stays**; the "Harness quality" bullet → **template** | The rest is DOMAIN and project ADAPTER. It could become an example later. |
| `CLAUDE.md` | **runtime adapter** (claude-code), scaffolded | It holds only `@AGENTS.md`. |
| `README.md` | **stays**; a minimal README → **template** | |
| `docs/profile.md` §1–§8, §10 | **profile**: generated from `harness-profile.json` and `profile/roles.md` | The values move into the profile file (section 7.2). §5 (API) and §6 (user-facing languages) become optional role groups. |
| `docs/profile.md` §9 term lists, bounded contexts | **profile** (`review.terms`, `review.contexts`) | Lists in JSON instead of fenced blocks that a regular expression parses. |
| `scripts/harness-profile.json` | **profile**, moved to `harness-profile.json` at the root | The schema is in `profile/`. |
| `scripts/coverage-threshold.json` | **profile**: folded into `harness-profile.json` (`quality.coverageGate`) | The three `jest.config.ts` files and the coverage tools read the profile file. |
| `.env.example`, `.gitignore` | **stays**; minimal versions → **template** | |

### 3.2 Method documents (the current `core-files` block)

| File | Target |
| ---- | ------ |
| `docs/engineering/method.md` | **core** (`core/method/method.md`). Its links to the profile, the stack file and `AGENTS.md` become role names (section 1.1). |
| `docs/development-plan/README.md`, `_template.md` | **core** (`core/plan/`) |
| `docs/development-plan/phases/README.md`, `phases/_template.md`, `work-logs/_task-template.md` | **core** (`core/plan/`) |
| `docs/development-plan/cross-cutting/definition-of-done.md`, `guiding-principles.md` | **core** (`core/plan/`) |
| `docs/quality-reviews/README.md`, `code/README.md`, `code/_template.md`, `harness/README.md`, `harness/_template.md` | **core** (`core/reviews/`) |
| `docs/product-knowledge/changelog.d/README.md` | **core template** (`core/templates/changelog-fragments.md`). It names the fragment format, and the release tool reads it. |

After the move, the old paths in `bot-rts` are gone. Links into them are rewritten to `harness/core/…`, as the earlier moves did. The plan and
review folders keep their project files (the bindings, the index, the phase files, the reports) and link the vendored methods.

### 3.3 Other harness documents

| File and section | Target |
| ---------------- | ------ |
| `docs/engineering/stack.md` §1–§3 (stack, layering, conventions) | **stays** |
| `docs/engineering/stack.md` §4 test tooling | split: the shape → **stack adapter** template (node-ts); the values (Jest, Cypress, the database per worker) → **stays** |
| `docs/engineering/stack.md` §5 stack items of the definition of done | split: lint, typecheck, format, boundaries → **stack adapter** (node-ts); the generated API files, catalogues, migrations → **stays** |
| `docs/engineering/stack.md` §6 agent runtime | split: the role table and the waiting advice → **runtime adapter** (claude-code); the `gh pr checks` and re-run advice → **host adapter** (github); the lint-output note → **stack adapter** |
| `docs/engineering/architecture.md` | **stays** |
| `docs/engineering/rule-checks.md` | split: the shape and the rows of the core rules → **generated** from the adapters' declarations (section 4.4); the project rows → **stays** |
| `docs/development-plan/bindings.md`, `phases/bindings.md`, `quality-reviews/code/bindings.md`, `quality-reviews/harness/bindings.md` | split: the shape → **template** (`core/templates/bindings-*.md`); the values → **stays**. The values cite roles and use placeholders such as `origin/<integration>` (H-22). The layer map of the harness bindings becomes a generated block (B7). |
| `docs/development-plan/DEVELOPMENT-PLAN.md` | **stays**; a skeleton with the summary and contents markers → **template** |
| `phases/phase-*.md`, `work-logs/*`, `cross-cutting/risk-register.md`, `rfc-5.1-execution-model.md` | **stays** (STATE) |
| `docs/quality-reviews/*/<date>.md` reports | **stays** (STATE) |
| `docs/harness-framework/README.md`, `design.md` | **stays** (STATE: the plan of this extraction) |
| `docs/testing/README.md` | split: "CI jobs" (aggregator required checks, a Markdown-only change reports green), "local gate", "Coverage" → **host** and **stack adapter** documents; the rest → **stays** |
| `docs/testing/e2e-matrix.md`, `known-issues.md`, `clock-consumers.md`, `load-testing.md`, `by-phase.md`, `reports/` | **stays** |
| `docs/operations/RELEASING.md` | split: the release and hotfix procedure → **core procedure** `release`; the tag and release-notes steps → **host adapter**; the version file → **stack adapter**; deployment → **stays** |
| `docs/operations/DEPLOYMENT.md` | **stays** |
| `docs/product-knowledge/**` (except `changelog.d/README.md`), `CHANGELOG.md` | **stays** (DOMAIN, STATE); the shape of a specification index, glossary, open-questions register and backlog → **example** |

### 3.4 Mechanisms

| File | Target |
| ---- | ------ |
| `.githooks/pre-push` | split: the hook → **core** (`tools/git-hooks/pre-push`); the database setup (`.env`, `DATABASE_URL`) → **stays**, as the setup script the profile names (`hooks.prePushSetup`) |
| (new) `pre-commit` | **core** (`tools/git-hooks/pre-commit`): refuses a commit on a protected branch, so that this guarantee no longer needs a runtime hook (section 4.4) |
| `.github/workflows/ci.yml` `pr-title`, `changes`, `verify` and `e2e` aggregators | **host adapter** templates (github) |
| `.github/workflows/ci.yml` `static`, `api`, `client`, `mcp` jobs | split: the job shapes (install, cache, lint, typecheck, tests in shards, coverage artifacts) → **stack adapter** templates (node-ts); the PostgreSQL service, the generated-file and migration steps → **stays** |
| `.github/workflows/ci.yml` `docker`, `e2e-shard`, `lighthouse` | **stays** |
| `.github/workflows/release.yml` | split: the release-notes step → **host adapter**; the image publication → **stays** |
| `.github/actions/install/action.yml` | **stack adapter** (node-ts) |
| `.claude/settings.json` | **runtime adapter** (claude-code), scaffolded with checked invariants |
| `.claude/launch.json` | **stays** |
| `.nvmrc`, `.prettierrc.json`, `.prettierignore` | **stack adapter** (node-ts) templates; `bot-rts` keeps its own files |
| `package.json` scripts `docs:check`, `plan:*`, `test:scripts`, `prepare` | split: the commands → **stack adapter** wiring (`npm run harness -- …`, the hooks path); the rest → **stays** |
| `scripts/harness-profile.mjs` | **core** (`tools/lib/profile.mjs`, `harness profile get`) |
| `scripts/check-markdown-links.mjs` | **core** (`harness check links`) |
| `scripts/check-core-leaks.mjs`, `core-leaks-lib.mjs` | **core** (`harness check core`) |
| `scripts/plan-summary*.mjs`, `plan-log*.mjs` | **core** (`harness plan summary`, `harness plan log`) |
| `scripts/check-changelog-fragments.mjs`, `release*.mjs` | **core** (`harness check changelog`, `harness release`). The version file is a stack role (`package.json`, `pyproject.toml`). |
| `scripts/check-glossary.mjs`, `check-open-items.mjs`, `check-product-knowledge.mjs` and their libraries | **core**, parameterised: the file names (`02-glossary.md`, `20-open-questions.md`, the backlog section) and the allowed terms move into the profile file (`productKnowledge.*`). The concepts (one glossary, a register of open items, no stack terms in the product knowledge) are the method's DOMAIN rules, which the review's D2, D11 and D12 rely on. |
| `scripts/hook-guard-bash.mjs`, `hook-guard-edit.mjs`, `hook-format-edited.mjs`, `hook-session-start.mjs` | **core** (`tools/runtime-hooks/`), with the input and output of each runtime in `io.mjs`. The format hook asks the stack adapter for the formatter and its file types. |
| `scripts/protect-branches.sh` | **host adapter** (github), rewritten on Node (`protect.mjs`, `harness host protect`) |
| `scripts/local-gate*.mjs` | split: the driver (read the pushed refs, list the files, skip a documentation-only push, run the plan) → **core**; the plan (packages, related tests, changed-file coverage) → **stack adapter** (`gate.mjs`) |
| `scripts/check-changed-coverage.mjs`, `merge-coverage*.mjs` | split: the gate on a neutral coverage summary → **core**; reading and merging Istanbul output → **stack adapter** (node-ts) |
| `scripts/ci-timings*.mjs`, `fixtures/verify-log-excerpt.txt` | split: run and job timings → **host adapter** (github, optional tool); the slow-test parser → **stack adapter** |
| `scripts/harness-profile.test.mjs` | **core** checks (`harness check values`, section 7.5) and the framework's own tests |
| `scripts/check-i18n.mjs`, `e2e*.mjs`, `e2e-durations.json`, `load-test.mjs`, `mcp-smoke.mjs`, `build-atlas.mjs` | **stays** |
| other `*.test.mjs` | move with the script they test |
| user memory (outside the repository) | out of scope; reviewed only for duplication |

---

## 4. Adapter contracts

Each contract is a role list in `core/contracts/<axis>.md`, and its machine form is the `manifest.json` that every adapter of that axis
provides. The schema is in `profile/`. A role is **required**, **optional** (the contract states the fallback when it is empty) or **logic** (a
Node module of the adapter with a fixed function signature). The conformance suite (section 5) tests every role.

### 4.1 Stack adapter

| Role | Kind | Fills | node-ts preset | python preset |
| ---- | ---- | ----- | -------------- | ------------- |
| Package manager | required | the install command, the lock file, how packages are listed (`packages`) | npm workspaces, `npm ci` | uv, `uv sync` |
| Packages with a coverage gate | required | the default for `quality.coveragePackages` | the workspaces | the source packages |
| Unit and integration test runner | required | the commands `test`, `test:coverage`, per package | Jest | pytest |
| End-to-end runner | optional (none: the e2e rules of the method are marked "not applicable" in the generated rule map) | `e2e` | Cypress | none in the preset |
| Coverage tool | required | the commands that write the **neutral coverage summary** (`coverage/coverage-summary.json` per package, Istanbul's json-summary shape), the metrics it measures (`statements`, `branches`, `functions`, `lines`, or a subset) | Istanbul via Jest | coverage.py, converted by `coverage.mjs`; lines and branches |
| Coverage merge | logic, optional (needed only for shards) | `merge(summaries) → summary` | Istanbul `coverageMap.merge` | `coverage combine` |
| Linter | required | `lint`, and the rules that hold the non-negotiables (untyped boundaries, debug printing) | ESLint | ruff |
| Formatter | required | `format`, `format:check`, the file types it formats (for the format hook) | Prettier | ruff format |
| Typecheck | optional (none: the gate skips it, and the definition of done marks it "not applicable") | `typecheck` | `tsc --noEmit` | mypy |
| Import boundaries | optional | `check:boundaries` | dependency-cruiser | import-linter |
| Generated files | optional | the commands that regenerate them and the paths `git diff --exit-code` checks | none in the preset (`bot-rts` adds its own) | none |
| Version file | required | where the release tool reads and writes the version | `package.json` | `pyproject.toml` |
| Local gate plan | logic | `plan(files, profile) → steps`: the checks that a push of these files needs | `gate.mjs` from `local-gate-lib.mjs` (Jest `--findRelatedTests`) | `gate.mjs`: ruff on the changed files, mypy and pytest of the changed packages |
| CI job layout | required | job templates: setup and cache, static checks, tests per package (shards optional), coverage artifacts for the aggregator | `.github` templates per host | same |
| Commands of the profile | required | the defaults of the `commands.*` roles, which the profile document and the packaged skills print | `npm run …` | `uv run …`, `node harness/tools/harness.mjs …` |
| Stack terms | required | the words that must not appear in core, which the framework's CORE scan joins from every adapter | `jest`, `npm`, `typescript`, … | `pytest`, `pip`, `uv`, `ruff`, … |
| Ignored directories | required | what the hooks and checks skip | `node_modules`, `coverage`, `dist` | `.venv`, `__pycache__`, `htmlcov` |

### 4.2 Agent-runtime adapter

| Role | Kind | Claude Code preset | Cursor preset |
| ---- | ---- | ------------------ | ------------- |
| Entry file | required: how the runtime loads `AGENTS.md` | `CLAUDE.md` with `@AGENTS.md` | none needed: Cursor reads `AGENTS.md` natively, nested files too |
| Always-loaded rules | required | the entry file only | the entry file only; no `.cursor/rules` file, so the text is not loaded twice |
| On-demand rules | required: how a document is read when the task needs it | the reading map of the entry file | the same |
| Hook configuration | optional (none: section 4.4, column "no runtime hooks") | `.claude/settings.json` (`SessionStart`, `PreToolUse` on `Bash` and on `Edit|Write|NotebookEdit`, `PostToolUse` on `Edit|Write`) | native: `.cursor/hooks.json` (`version: 1`; `sessionStart`, `beforeShellExecution`, `preToolUse` with matcher `Write`, `afterFileEdit`); compat: none (section 9) |
| Hook input and output | logic: `io.mjs` reads the event and writes the answer | stdin JSON with `tool_name` and `tool_input`; block with exit code 2 and the reason on stderr; session context on stdout | stdin JSON with `hook_event_name`, `command` or `file_path`; answer JSON `permission: "deny"` with `agent_message`; session context as `additional_context` |
| Project directory | required | `CLAUDE_PROJECT_DIR` | `CURSOR_PROJECT_DIR` (and the alias `CLAUDE_PROJECT_DIR`) |
| Procedure packaging | required | `.claude/skills/<name>/SKILL.md` with `name` and `description`; `disable-model-invocation: true` for the explicit ones | native: `.cursor/skills/<name>/SKILL.md`, same fields and `paths`; compat: none |
| Pull-request tools | optional (none: the agent checks the required checks with the host's command before it merges, and the rule "CI monitoring with automatic fixes" is "not applicable") | attach a pull request: `bind_pr`; CI monitoring with fixes: `set_monitor` with `auto_fix` (the Claude desktop app) | none known; the fallback applies |
| Waiting advice | optional | the notes of today's stack §6 (done-files, stale events) | none |
| Runtime terms | required | `CLAUDE.md`, `.claude/`, `bind_pr`, … (joined into the CORE scan) | `.cursor/`, `.mdc`, … |

### 4.3 Host adapter

| Role | Kind | GitHub preset |
| ---- | ---- | ------------- |
| Repository identity | required | `repository.slug`, `repository.url` |
| Branch protection | logic: `protect(profile)`, idempotent | `protect.mjs`, which writes one repository ruleset over the production and the integration branch: no deletion, no force-push, a pull request for every change, the required checks, administrators may bypass only when merging a pull request. It also turns off the automatic deletion of head branches. |
| Required checks | required: the job names of the profile file, and a way for each to report on every change | the aggregator pattern: one job per required check that needs the parallel jobs, and reports green when a change is documentation only |
| CI workflow frame | required | `.github/workflows/ci.yml` (triggers on the protected branches, concurrency, a `changes` job) |
| Pull-request title check | required | the `pr-title` job (the commit format of the profile) |
| Pull requests | required: open a draft, mark ready, read the state of the checks, list the open ones (claims, session start), merge by strategy | `gh pr create --draft`, `gh pr ready`, `gh pr checks`, `gh pr list`, `gh pr merge --squash` or `--merge` |
| Release | required: tag, release notes from the changelog | `release.yml` template, `gh release create` |
| CI timings | optional | `ci-timings.mjs` (`gh run view`) |
| Values in host files | logic: `readTriggers()`, `readJobNames()` for `harness check values` | parses `.github/workflows/*.yml` |
| Host terms | required | `github`, `gh`, `ruleset`, … |

### 4.4 Where each core rule is caught

Rule ids are given to the core rules in task 17.8. Each adapter's manifest declares the rules it enforces and at which event. The core part
of the rule-to-check map is generated from those declarations, so a project with other adapters gets a true map. "Early" is the agent
runtime, before the action happens; "local" is a Git hook; "remote" is CI or the host.

| Rule | Claude Code (early) | Cursor (early) | No runtime hooks: local and remote |
| ---- | ------------------- | -------------- | ---------------------------------- |
| No commit on a protected branch | `PreToolUse` on `Bash` refuses it | `beforeShellExecution` refuses it | **new** `pre-commit` refuses it; the host refuses the push |
| No push to a protected branch | the same hook | the same hook | **new** in `pre-push`: refuses a push whose remote ref is protected; the host's ruleset |
| No deletion of a remote branch | the same hook refuses `push --delete`, `push :branch` and the API call | the same hook | **new** in `pre-push`: refuses a deleted ref (an all-zero local object); the host refuses it for the protected branches only, so for a work branch only the Git hook and judgment hold |
| No force-push or deletion of a protected branch | the hook | the hook | the host's ruleset |
| Never edit an environment file | `PreToolUse` on `Edit|Write` refuses it | `preToolUse` (`Write`) refuses it | nothing refuses the edit; `.gitignore` keeps the file out of commits |
| Never edit the vendored framework (pinned mode only) | the same hook | the same hook | `harness check vendored` in `pre-push` and CI |
| Formatting | `PostToolUse` formats the file | `afterFileEdit` formats the file | the format check of the changed files in `pre-push`; CI |
| Session start: branch, phase in progress, next step, open claims | `SessionStart` prints it | `sessionStart` `additional_context` (not in Cursor's cloud agents) | the reading map tells the agent to run `harness status` |
| Coverage gate, changed-file coverage, lint, typecheck, generated files | not a runtime hook | not a runtime hook | `pre-push` for the changed files; CI for everything |
| Pull-request title, required checks green | – | – | CI and the host |
| Claim before work, ask before merging, no auto-merge, rule changes need the owner | judgment | judgment | judgment; `harness status` lists the open pull requests |

---

## 5. Writing an adapter for a stack without a preset

The procedure is `core/contracts/new-adapter.md`. It is also packaged as the procedure `new-adapter`, so any agent can follow it. It works the
same for the runtime and host axes.

1. **Copy** `adapters/<axis>/_skeleton/` to `adapters/<axis>/<name>/` in the framework source. A project that cannot wait for a release
   copies it to `harness-adapters/<axis>/<name>/` in its own repository, and the profile file names it as `local:harness-adapters/<axis>/<name>`.
2. **Fill the manifest**, one role at a time, from the contract. Leave an optional role empty only with the fallback its row names.
   Write the logic modules (`gate.mjs`, `coverage.mjs`) as pure functions with `node --test` tests next to them, like the presets.
3. **Write the adapter's documents** from the skeleton: the stack-file section, the commands and the stack terms.
4. **Run `node harness/tools/harness.mjs adapter test <path>`**. It runs the conformance suite of the axis, the same one the presets pass in
   the framework's CI:
   - the manifest matches the schema, and every required role is filled;
   - every command of the manifest exists (`--version` or `--help` exits 0);
   - a fixture project bootstrapped with the adapter and the example profile passes `harness check all`;
   - the local gate plan: a push of only Markdown runs no code check; a push of a source file with a failing test fails; a push that leaves a
     changed file below the coverage gate fails; a push of one package's file checks only that package;
   - the neutral coverage summary of the fixture has the declared metrics;
   - the format hook formats an edited file of each declared type and leaves other files alone;
   - the generated CI workflow has a job for every required check and triggers on both protected branches;
   - runtime adapters: each hook refuses the fixture's forbidden commands and edits, through `io.mjs`, from that runtime's recorded
     event samples; host adapters: `protect` sends the expected ruleset to a stand-in command line.
5. **Record it.** The adapter is listed in `framework.json`, its changelog line is added, and a preset gets an entry in the framework README.
   A local adapter is offered upstream as in section 1.3.

The python preset of the build (task 17.16) is written by following this procedure, so the procedure is tested before release.

---

## 6. Bootstrap

### 6.1 One engine

`tools/lib/bootstrap.mjs` is a pure function from **a complete profile file** and **a framework tree** to **a file plan**: a list of
paths, contents and kinds (vendored, managed, scaffolded). `harness bootstrap` validates the profile against the schema, runs the
engine, writes the plan (it refuses to overwrite an existing scaffolded file unless `--force`), writes the lock, installs the Git hooks
(`core.hooksPath`) and runs `harness check all`. `harness sync` is the same engine restricted to vendored and managed files. A bootstrapped
project and `bot-rts` therefore stay current by the same command.

### 6.2 Three front ends, one result

All three front ends only produce the complete `harness-profile.json`; the engine does the rest.

| Front end | How it fills the profile file |
| --------- | ----------------------------- |
| Script | `node <framework>/tools/harness.mjs init`. **Interactive**: it asks every required role that has no default, in the order of `profile/roles.md`, and shows the default of the others. **With flags**: `--name`, `--repository`, `--stack node-ts`, `--runtime claude-code,cursor`, `--host github`, `--set key=value` for any role, `--detached` (section 1.5), `--non-interactive` (it fails and lists the missing roles). Then it runs `bootstrap`. |
| Template repository | The framework's release workflow builds it from the framework tree: `harness/`, a `harness-profile.json` with the defaults and empty required roles, `BOOTSTRAP.md` and a README that says "run `node harness/tools/harness.mjs init`, or ask your agent to follow `BOOTSTRAP.md`". "Use this template" on the host, then one of the two. Creating it on the host is the owner's step. |
| `BOOTSTRAP.md` | A prompt for any coding agent. Read `profile/roles.md`; ask the user for each required role in one message, offering the defaults; write the answers into `harness-profile.json`; run `harness bootstrap --non-interactive`; run `harness check all`; report what was written and what the user must do by hand (protect the branches with `harness host protect`, turn on the runtime's settings). It uses only reading, writing and running commands, which every agent can do. |

**Proof of sameness:** a framework test runs the engine three ways for the same answers: with the flags, with the answers file that the
interactive run writes (stdin from a fixture), and on the template repository's profile filled with the same values. It compares the three
trees byte for byte, apart from the lock's timestamp. The template repository is generated by the engine itself, so it cannot drift. A fourth run with `--detached` must equal a pinned bootstrap followed by `harness detach`.

### 6.3 What the bootstrap writes

- **Vendored**: `harness/` (section 1.1).
- **Managed** (regenerated by every sync; `harness check generated` re-renders and compares them):
  - the entry file's blocks between `<!-- harness:begin <id> -->` and `<!-- harness:end <id> -->`: the non-negotiables, the Git rules and the
    Role binding line;
  - `docs/profile.md`;
  - the layer-map block of the harness bindings (section 8.2);
  - the core rows of the rule-to-check map;
  - the packaged skills of the core procedures. These carry values: a skill prints the command of the profile, not its role.
- **Scaffolded** (written once, then the project's): the rest of the entry file; the runtime pointer (`CLAUDE.md`); the runtime config files
  (`.claude/settings.json`, `.cursor/hooks.json`); the CI workflows; `README.md`; the `docs/` skeleton (plan index, the first phase, the
  product-knowledge skeleton from `examples/product/`, the four bindings files from their templates); `.gitignore` and `.env.example`;
  the stack's config files (`.nvmrc`, the formatter's config). `harness check scaffold` checks only their invariants:
  - the framework's hook entries are present and call the vendored scripts;
  - every required check is a job of the CI workflows, and the triggers name both protected branches;
  - the entry file has every managed block;
  - the plan index has its generated markers.

---

## 7. Existing mechanisms as framework parts (all on Node)

### 7.1 The command line

`node harness/tools/harness.mjs <command>`, wrapped by the stack (`npm run harness -- …`, or a `make` target in the python preset).
`harness check all` is what `npm run docs:check` runs today, minus the project's own checks:
`vendored`, `generated`, `scaffold`, `profile`, `values`, `links`, `core` (in the framework source only), `layers`, `plan`, `changelog` and
`product-knowledge`.

### 7.2 The profile file and its reader

- `harness-profile.json` at the root holds **every** value. That includes what is only in `profile.md` today: the commands, the versions, the
  languages, the plan conventions, the term lists and the bounded contexts.
- `profile/harness-profile.schema.json` types it and gives defaults; the stack adapter adds its defaults.
- `harness profile get <dotted.path>` keeps today's interface, and the shell files use it.
- `docs/profile.md` is **generated** from the file and from the role descriptions of `profile/roles.md`. So "change a value in the file and in
  the table together" disappears, and with it the test that compares the required checks with the table and the copies that H-22 found.
- The CORE scan reads the term lists from the file, no longer from fenced blocks in Markdown.

### 7.3 The hooks

- **Git hooks** in `harness/tools/git-hooks/`, installed through `core.hooksPath` (by `prepare` in node-ts, by `bootstrap` and `harness status`
  otherwise):
  - `pre-commit` guards the protected branches (new);
  - `pre-push` refuses a protected or a deleted remote ref (new), checks the vendored tree, sources the project's setup script, then runs the
    gate driver with the stack's plan.
- **Runtime hooks** in `harness/tools/runtime-hooks/`: `guard-shell` (today's `hook-guard-bash`, including its shell parser), `guard-edit` (adds the
  vendored folder), `format-edited` (asks the stack's formatter) and `session-start` (adds the open pull requests from the host, which the
  claim rule needs). `io.mjs` reads either runtime's input, recognising Cursor by its `cursor_version` field, and answers in that runtime's
  form. So one script serves both runtimes and both of Cursor's modes.

### 7.4 The protection script

`adapters/host/github/protect.mjs` (`harness host protect`) replaces `protect-branches.sh` with the same ruleset. It calls `gh api`. Its
test runs it against a stand-in `gh` and compares the request with the profile file, as today's script test does.

### 7.5 The profile tests

`harness-profile.test.mjs` becomes these checks:

- **`harness check values`.**
  - The host's CI triggers equal the protected branches.
  - Every required check is a job.
  - No profile value is spelled out in the folders that must name roles: `checks.roleOnlyPaths` in the profile file (today the engineering,
    operations and testing documents and the workflows), outside fenced blocks and trigger lists.
- **`harness check profile`.** The file matches the schema, and every role that core cites exists.
- **The framework's own tests.** They cover the protection request, the CORE patterns and the placeholder exceptions, as
  `core-leaks-lib.test.mjs` does today.

---

## 8. Blockers B6 and B7; findings H-22 to H-24

### 8.1 B6: skills as neutral procedures, packaged per runtime

- **Source.** `core/procedures/<name>.md`. Frontmatter: `name`, `description` (the trigger: when to use it), `invocation` (`auto` or
  `explicit`), and optional `paths`. The body names roles, and commands as `{{commands.lint}}`. No runtime words.
- **Packaging** is done by the runtime adapter at sync:
  - Claude Code: `.claude/skills/<name>/SKILL.md`, rendered, with `disable-model-invocation: true` for `explicit`.
  - Cursor (native): `.cursor/skills/<name>/SKILL.md`, the same fields plus `paths`.
  - No runtime: a row in the entry file's reading map, "to <trigger>, follow `harness/core/procedures/<name>.md`".
- **First set**, from the skill candidates of the harness bindings (M33), keeping the neutral ones:
  - `start-task`: resume a phase, claim, branch from the remote integration branch;
  - `end-session`: the log entry, commit and push;
  - `open-pull-request`: title, body, draft or ready, the runtime's CI monitoring or the fallback;
  - `finish-phase`: exit criteria, status, the local database step, the summary;
  - `release`;
  - `harness-review` and `code-review`, the start prompts of the bindings as procedures;
  - `new-adapter` (section 5).
- **Project procedures.** `bot-rts`'s own procedures (add an endpoint, add a migration, add a catalogue key) use the same format in
  `docs/procedures/` (the profile's `paths.procedures`), and the same tool packages them.
- **Two owners avoided.** The entry file states each rule once and links the procedure. The procedure holds the steps, not the rule.

### 8.2 B7: the layer map from one source

- **CORE layer.** It is the vendored tree plus the managed blocks, known from the lock, so it needs no list. The `core-files` block of the
  harness bindings goes away.
- **Other layers.** DOMAIN, ADAPTER, PROFILE, STATE and ENTRY are globs in the profile file (`layers.*`).
  - `harness layers` prints the map, and the generator writes it into the bindings as a managed block.
  - `harness check layers` fails on a tracked Markdown or harness file that matches no layer, or more than one. A new harness file is
    therefore classified when it is added, and not discovered by a later review.
- **Framework-known paths** (`harness-profile.json`, `harness.lock.json`, `docs/profile.md`, the bindings files) are put in PROFILE by the
  generator. This closes **H-20261019-23** for good: the profile file can no longer be missing from the map.

### 8.3 Where the findings are absorbed

| Finding | Absorbed by |
| ------- | ----------- |
| H-20261019-22 (the bindings copy branch values; the branch rows are not compared with the file) | 17.5: `profile.md` is generated from the file, so there is nothing to compare. 17.6: the bindings use role names and `origin/<integration>`, and `harness check values` covers the bindings folders (`checks.roleOnlyPaths`). |
| H-20261019-23 (the layer map lacks the profile file) | 17.6: the generated layer map (section 8.2) |
| H-20261019-24 (CI flake in `engine.int.test.ts`) | **Not framework work.** It is a product test. It stays in its triage, a Phase 12 task with H-14. |

---

## 9. Cursor: rules, hooks and commands (checked 2026-10-21)

Read on 2026-10-21 from Cursor's documentation. The pages carry no date or version of their own, except "Cursor 2.4+" for the migration
skill. Sources:
- [rules](https://cursor.com/docs/context/rules);
- [hooks](https://cursor.com/docs/agent/hooks);
- [third-party hooks](https://cursor.com/docs/reference/third-party-hooks);
- [skills](https://cursor.com/docs/skills);
- [commands](https://cursor.com/docs/context/commands);
- two forum threads: [Claude hooks don't work](https://forum.cursor.com/t/claude-hooks-dont-work/153614) and
  [no opt-out of third-party config loading](https://forum.cursor.com/t/no-way-to-opt-out-of-third-party-claude-code-codex-config-loading-the-flag-is-hardcoded/166558).

| Topic | What the documentation says | Consequence for the preset |
| ----- | --------------------------- | -------------------------- |
| `AGENTS.md` | A plain Markdown file in the project root, also supported in subdirectories; nested files combine, and the more specific wins. | `AGENTS.md` is the entry file with no pointer file; nested files stay possible. |
| Project rules | `.cursor/rules/*.mdc` (a plain `.md` there is ignored), with frontmatter `description`, `globs` and `alwaysApply`. Four modes: always, intelligently (by description), specific files (globs), manually (@-mention). The same in the editor, the CLI and cloud agents. Team rules, then project rules, then user rules. | The preset writes **no** rule file. An always-applied `.mdc` would load the rules a second time; the reading map does the on-demand part. |
| Hooks | `.cursor/hooks.json` (project; user and enterprise levels too), `"version": 1`, events mapped to lists of `{ command, matcher, timeout, failClosed, … }`. The events used: `sessionStart` (`additional_context`; fire and forget; not in cloud agents), `beforeShellExecution` (`command`, `cwd`; can deny), `preToolUse` (`tool_name`, `tool_input`; matcher values such as `Shell`, `Read`, `Write`; can deny), `afterFileEdit` (`file_path`, `edits`). Exit code 2 blocks; another failure lets the action proceed unless `failClosed` is set. Environment: `CURSOR_PROJECT_DIR`, with `CLAUDE_PROJECT_DIR` as an alias. | Native mode uses these four events. The guards answer in JSON (`permission: "deny"` with `agent_message`) and also exit 2. |
| Claude Code compatibility | Cursor loads hooks from `.claude/settings.local.json`, `.claude/settings.json` and `~/.claude/settings.json`. It maps `SessionStart`, `PreToolUse`, `PostToolUse`, `Stop`, … and the tools `Bash` → `Shell`, `Edit` → `Write`. The setting "Include Third-Party Plugins, Skills, and Other Configs" is **on by default**. Skills are loaded from `.claude/skills/` and `.codex/skills/` as well. The forum, as of 2026: a parsing bug in Claude hook configs was reported (Cursor 2.6.11, March 2026) and announced fixed (April 2026); the **CLI has no opt-out**, and it also loads `CLAUDE.md` (feature request acknowledged July 2026). | Both runtimes in one project would load the hooks and skills twice. With Claude Code present, the Cursor preset runs in **compat mode**: no `.cursor/hooks.json`, no `.cursor/skills/`, and Cursor uses the `.claude/` files. `io.mjs` reads both input forms, so the scripts serve either mode. As the only runtime, the preset is **native**. |
| Commands | The commands page no longer documents `.cursor/commands`. It describes `/migrate-to-skills` (Cursor 2.4+), which turns user and workspace slash commands into skills with `disable-model-invocation: true`. | The preset ships **no commands**. An explicit procedure is a skill with `disable-model-invocation: true`, invoked as `/<name>`. |
| Skills | `SKILL.md` in a folder named after the skill, in `.cursor/skills/` or `.agents/skills/` (also `~/`). Frontmatter: `name` (equals the folder), `description`, optional `paths`, `disable-model-invocation`, `metadata`. Invoked as `/<name>` or chosen by the agent from the description. | The packaging of section 8.1. |

What only a real session can confirm, so it is on the owner's checklist for the Cursor proof (task 17.18):
- the field names of `tool_input` for `Write`;
- whether stderr on exit code 2 reaches the agent (the JSON answer is sent anyway);
- that compat mode runs each hook once;
- that a `sessionStart` context appears in the IDE.

---

## 10. Build order

Each task is one pull request into the integration branch. Each keeps this repository green: the documentation check, lint, the script tests and
the coverage gate. The sizes follow the plan's scale (1 SP is about one focused session). Model: Sonnet 5.5 at medium effort for the build, as in
the plan's table, and high effort for 17.8 and 17.13, which restructure. Most tasks are serial; 17.15 and 17.16 may run in parallel after
17.14, and 17.17 after 17.13.

| # | Task | Acceptance check | SP |
| - | ---- | ---------------- | -- |
| 17.2 | Targeted harness review of the dimensions Phase 16 touched (D3, D7, D8, D14, D15), so the build starts from a fresh baseline. Others carried. | A new report in `docs/quality-reviews/harness/`, its follow-up table triaged. A finding that the framework absorbs names its build task. | 3 |
| 17.3 | Framework skeleton | `docs/harness-framework/framework/` per section 2, with `README.md`, `LICENSE` (MIT), `CHANGELOG.md` and `framework.json` (`0.1.0-dev`). `docs:check` covers it: links, and the CORE scan on `framework/core/` with the profile's term lists (from 17.9 also the adapters' terms), which returns 0. | 2 |
| 17.4 | Vendoring: `sync`, the lock, `check vendored`, `diff`, and the detached mode | `harness/` and `harness.lock.json` exist, synced from the staging folder. Tests: an edit to a vendored file fails `docs:check` and the pre-push hook; a sync restores it; an override is accepted and reported; after `harness detach` on a fixture, the same edit passes, `sync` refuses, `sync --local` regenerates, `diff` shows the edit against `base`, and a removed `LICENSE` fails. | 5 |
| 17.5 | The profile file holds every value | `harness-profile.json` at the root, with schema, defaults, term lists and the coverage gate folded in. `profile.md` generated. `harness check profile`. The Jest configs, hooks and scripts read the new path. H-22, first half. | 5 |
| 17.6 | The layer map from the profile and the lock (B7) | `harness layers`, generated into the harness bindings; `harness check layers` fails on an unclassified file (test). The bindings name roles (H-22, second half). H-23 closed. | 2 |
| 17.7 | Generic tools into the framework | Links, CORE scan, plan summary and log, changelog fragments and release, and the three product-knowledge checks (parameterised) are `harness` commands in the framework, vendored. The old scripts are removed. `npm run docs:check` gives the same result as before on the same tree. | 5 |
| 17.8 | Core documents into the framework | The method documents of section 3.2 are in `framework/core/` and vendored. Links are rewritten and none leaves `core/`. The entry file's managed blocks are generated, with rule ids. The two neutral wordings of section 3.1 are applied. The CORE scan returns 0 on the source. | 5 |
| 17.9 | Contracts and the GitHub host adapter | `core/contracts/{stack,runtime,host}.md` and the manifest schema. `protect.mjs` on Node with its stand-in test. The workflow templates. `harness check values` replaces `harness-profile.test.mjs`. | 3 |
| 17.10 | Stack preset node-ts, consumed by this repository | The gate driver and `gate.mjs`, the neutral coverage summary, and the coverage merge. The pre-push hook and CI of `bot-rts` call them. Gate tests: a Markdown-only push, a failing test, a coverage drop, one package. | 5 |
| 17.11 | Runtime hooks, Git guards, Claude Code preset | `tools/runtime-hooks` with `io.mjs`; the new `pre-commit` and `pre-push` guards; `.claude/settings.json` and `CLAUDE.md` from the preset. Tests from recorded event samples of both runtimes. The generated rule map rows of section 4.4. | 3 |
| 17.12 | Procedures and their packaging (B6) | The first set of section 8.1 in `core/procedures/`, packaged as `.claude/skills/`. The reading-map fallback. `harness check generated` covers them. | 3 |
| 17.13 | Bootstrap engine and its three front ends | `harness init` (interactive and with flags), `harness bootstrap`, `BOOTSTRAP.md`, the template-repository build, `--detached`. The sameness test of section 6.2, including the detached case. | 5 |
| 17.14 | Conformance suite and the new-adapter procedure | `tests/conformance/` per axis; `harness adapter test`; `core/contracts/new-adapter.md`. node-ts, claude-code and github pass. | 3 |
| 17.15 | Cursor preset | Native and compat modes (section 9); recorded Cursor event samples; it passes the suite. The owner's checklist for a real session is written into its README. | 2 |
| 17.16 | Python preset, written by following the new-adapter procedure | uv, pytest with coverage.py, ruff, mypy; `gate.mjs` and `coverage.mjs`; CI templates; it passes the suite. Deviations from the procedure are fixed in the procedure. | 3 |
| 17.17 | Examples | A filled profile of a fictitious project, the product-knowledge skeleton, a sample plan; the bootstrap writes them into a new project's `docs/`. | 2 |
| 17.18 | The proof of §3.4 | In a scratch directory outside the repository: bootstrap node-ts with Claude Code, python with Cursor, node-ts with both runtimes (compat mode), and one detached project with a core rule edited. On each, `harness check all` and the stack's checks pass, and the harness review method runs (a short targeted review of D1, D3, D6). Recorded in the framework changelog and the work log. **The owner** then runs the Cursor preset in a real Cursor session, with the checklist of 17.15. | 2 |
| 17.19 | Switch to the published framework | After **the owner** has copied the staging folder to the `harness-framework` repository and tagged `v0.1.0`: the lock's source becomes that tag, the staging folder is removed, and the plan and this design point to the repository. | 2 |
| 17.20 | Closing targeted harness review, by a session that did not do the build | D1, D3, D4, D5, D6, D7, D8, D13 and D15, the export dry run on `framework/`, probes P1, P2 and P5 on `bot-rts` and P1 on the dummy project. The exit criteria of §3.5 and of the phase are checked one by one. | 3 |

Total of the build: 63 SP, so Phase 17 is 66 SP with 17.1.

**Risks of this design.**

| Risk | How the design handles it |
| ---- | ------------------------- |
| One more hop to the profile from a core document (D6) | The reading map links the profile, and the session-start text prints the key values. The closing review runs P1 and P2 and compares the words read. |
| Cursor loads the rules or hooks twice in a dual-runtime project | Compat mode; the hooks are idempotent; the owner's session checks it. |
| The tool surface grows (D13) | One command line; checks are pure functions with tests; the budgets of the harness bindings apply to the framework too, and the closing review measures them. |
| The vendored copy and the staging source coexist until 17.19 | The vendored check proves them equal on every push. The review method counts the vendored tree once (as CORE) and the staging folder as the framework source. |
| A wording of a core rule changes its meaning by accident while moving | Moves are byte-for-byte except the changes named in section 3.1. A change of meaning beyond them asks the owner before merging (phase file). |
