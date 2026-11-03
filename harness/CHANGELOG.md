# Changelog

All notable changes to the framework are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - 2026-11-02

### Added

- `harness adopt` (design §6.4; task 1.1): the bootstrap for a repository that copied the first harness. The agent-runtime contract gains the optional role `hook-adoption` (`adoptConfiguration`), which the Claude Code preset fills: it adds the framework's hook entries and read exclusions to the project's own `.claude/settings.json` and names the hook commands that are the project's own.
- The framework is its own project (design §11): lock mode `self` with the profile role `paths.frameworkDir` (`.`), `harness init --self` and `harness bootstrap --self`, its own plan (Phases 1 to 3), CI and rules. The first tagged development version is `0.1.0-dev.1`.
- The skeleton of the framework: the folders of the layout, `framework.json` at `0.1.0-dev`, the MIT license, this changelog and the
  README. The core documents, the tools and the adapters follow in the build tasks of the design.
- Vendoring (design §1): `harness sync` (from a folder or a Git tag, with the selected adapters only), `sync --local`, `check vendored`,
  `diff`, `override` and `detach`, with `harness.lock.json` in the modes `pinned`, `detached` and `self`. Plain Node, no dependencies.
- The generic tools (design §3.4), merged from both copies that existed: `check all`, `check links` (anchors keep `_` as the host does),
  `check paths` (new), `check core`, `check plan` with `plan summary` and `plan log`, `check changelog` with `release` and `release notes`,
  `check product-knowledge` (its file names and exceptions in the profile's `productKnowledge`), and `ci changes` with
  `checks.documentationPaths`. The profile gains `checks`, `productKnowledge`, `release` and `paths.entryFile`.
- The two features of the second source (design §3.4): the link check's index rule (`checks.indexedFolders`: the README of an indexed folder
  links every file and subfolder that Git tracks in it) and the agent-complexity markers of the plan (`plan.complexity`: the scale and the
  model of each marker; every open task carries one in an `Agent` column before `SP`, done tasks are exempt, and the plan index shows each
  phase's range). Without `plan.complexity` the plan has no markers.
- The core documents (design §3.2): the engineering method (`core/method/`), the plan method with the index, phase and task-log templates,
  the definition of done and the guiding principles (`core/plan/`), the review methods with their report templates (`core/reviews/`) and
  the changelog-fragment format (`core/templates/`). Their links to project documents are role names, and none leaves `core/`.
- The entry file's rules as managed blocks: `core/rules/non-negotiables.md` and `core/rules/git.md`, rendered into the blocks
  `non-negotiables` and `git-rules` with the Role binding line from the profile (`plan.openEndedPhaseNumber`,
  `repository.protectionScript`), each rule with a stable id; the lock keeps one hash per block (`<path>#<block>`), and the layer map
  counts the blocks as CORE, so `layers.core` is empty for a project that uses the framework.
- `check generated`: every managed file and block rendered again and compared, in every mode.
- The plan method describes the agent-complexity markers as a standard, optional task property (its section 7): the `Agent` column of the
  phase template, the range column of the index template, the conformance rule and the exemption of done tasks.

- The adapter contracts (design §4): `core/contracts/{stack,runtime,host}.md`, their machine form `profile/manifest.schema.json` (`x-roles`),
  `harness check adapters` (a manifest filled to its contract), and the adapters' `terms` joined into the CORE scan. `adapters.stacks`
  entries may list the `packages` they own, and `check profile` fails when two stacks claim one folder or a project with several stacks
  leaves one without folders.
- The GitHub host adapter (`adapters/host/github/`): `protect.mjs` (`harness host protect`, the ruleset of the protected branches, now on
  Node, with the detection of whether the host can protect the repository and the new profile role `host.protection`, which must agree
  with it), `workflows.mjs` (the triggers and job names of the workflow files) and the workflow templates `ci.yml` and `release.yml`
  (the pull-request title check, change detection, the aggregator, coverage packages read from the profile).
- `harness check values` (replaces a project's profile test): the host's CI triggers equal the protected branches; every required check is a
  job; no branch, repository or plan path of the profile is spelled out in the files of `checks.roleOnlyPaths`, and no workflow names a
  protected branch outside its triggers or lists the coverage packages.
- `{{#unless …}}` blocks in the template engine.

- The node-ts stack preset (`adapters/stack/node-ts/`): `gate.mjs` (the plan of the local gate: typecheck, lint and format of the touched
  packages, the tests related to the changed files, the whole package for a change that cannot be followed, the changed-file coverage),
  `coverage.mjs` (the merge of Istanbul shards and the neutral coverage summary, without a dependency), `ci-jobs.mjs` (a static job and a
  coverage job per package for the host's workflow frame) and its manifest, with the stack role "ignore files".
- The gate driver `harness gate` (the local gate of a push): it routes each changed file to the stack that owns it, runs the documentation
  checks for a push that changes documentation, and adds the project's own steps (the profile role `gate`: `outside`, `isolated`, `needs`,
  `prepare`, `steps`). `harness coverage check-changed` and `harness coverage merge` apply the coverage gate to the neutral summary.
- `harness check scaffold`: the stack's ignore files exclude the vendored framework.

- The runtime hooks (`tools/runtime-hooks/`): `guard-shell` (the Git rules of the entry file, `--no-verify`, and the merge guard of a host
  without protection), `guard-edit` (environment files, and the vendored framework in pinned mode), `format-edited` (the formatter of the stack
  that owns the file, from the project's installation, never downloaded) and `session-start`, with `io.mjs`, which reads the event of Claude Code
  or Cursor (recognised by `cursor_version`; native and compat modes) and answers in its form. Recorded event samples of both runtimes are in
  `tests/fixtures/events/` (the Cursor ones are written from its documentation, not recorded in a live session).
- The Git hooks `tools/git-hooks/pre-commit` (no commit on a protected branch, except the root commit of a new repository) and `pre-push` (the
  vendored check, a protected or deleted remote ref, the project's setup script `hooks.prePushSetup`, then `harness gate`), and `harness guard`.
- The Claude Code preset (`adapters/runtime/claude-code/`): `CLAUDE.md` that imports the entry file, `.claude/settings.json` from the profile
  (`settings.mjs`: the hook entries and the `Read(...)` deny rules of the new profile role `access.denyRead`), and the scaffold invariants
  (`harness check scaffold` fails on a missing hook entry or deny rule).
- The merge guard of the GitHub host adapter (`gh pr merge` while a required check is not green), used when `host.protection` is false.
- The core rows of the rule-to-check map, generated from the `enforces` declarations of the adapters and the Git hooks, for both protection cases
  (a managed block in the rule-map document); the manifest gains `enforces`.

- The neutral procedures (B6): `core/procedures/` with `start-task`, `end-session`, `open-pull-request`, `finish-phase`, `release`, `harness-review` and
  `code-review` (frontmatter `name`, `description`, `invocation`; a body that names roles and commands as `{{commands.lint}}`). The Claude Code preset
  packages each as `.claude/skills/<name>/SKILL.md` (explicit ones with `disable-model-invocation`), generated by `harness sync` and held by
  `harness check generated`; the entry file's managed block `procedures` lists them for every agent: "when …, follow
  `harness/core/procedures/<name>.md`". `new-adapter` follows with the conformance suite.
- The bootstrap (design §6): `harness init` (interactive, or with flags and `--set`), `harness bootstrap`, `harness template <dir>` (the
  template repository, built by the engine) and `BOOTSTRAP.md`, all through one engine that completes the profile file from the answers,
  `profile/starter.json` and the new `defaults` of the adapters' manifests. The scaffold is the core templates of `core/templates/scaffold/`
  and the new optional `scaffold-files` role of each axis (node-ts: the Node version, the ignore file, a package manifest and an empty lock
  file; claude-code: `CLAUDE.md` and the settings; github: the CI and release workflows). The bootstrap commits the root commit of the
  integration branch, makes the production branch, installs the Git hooks and runs `check all`; `--detached` equals a pinned bootstrap
  followed by `detach`. `documents.harnessBindings` is optional.
- The conformance suite (design §5): `harness adapter test <path>` runs the checks of an adapter's axis (`tools/conformance/`), and the presets pass it in
  the framework's tests, with deliberately broken copies of them failing the check that names what is broken. Every adapter has a `conformance.json` of
  samples; the skeleton of each axis (`adapters/<axis>/_skeleton/`, vendored) starts red with `TODO` markers; the guide `core/contracts/new-adapter.md` and the
  procedure `new-adapter` (packaged as a skill) say how to write an adapter.
- the Cursor preset (`adapters/runtime/cursor/`; task 1.2), **unverified in a live session**: it is written from Cursor's documentation and passes the conformance suite, but has not run in a real Cursor session (the owner has no Cursor access yet, decision of 2026-11-02). The checklist for such a session is in the preset's README; a fix found there ships as `0.1.1`. Native mode (Cursor is the only runtime): `.cursor/hooks.json` for `sessionStart`, `beforeShellExecution`, `preToolUse` on `Write` and `afterFileEdit`, and the skills in `.cursor/skills/`. Compat mode (next to Claude Code, which Cursor already loads from `.claude/`): no hook file and no skills of its own, so nothing runs twice, and `harness check scaffold` fails on a framework hook in `.cursor/hooks.json`. Both modes keep the `access.denyRead` patterns in a block of `.cursorignore`. Cursor reads `AGENTS.md` itself, so the entry file must be `AGENTS.md`. The recorded-form samples of the Cursor events moved from `tests/fixtures/events/` into the adapter (`events/`), marked as written from the documentation.
- the optional runtime role `managed-blocks` (`managedBlocks(profile) → [{ path, block, content }]`) for blocks of a file of the project that the sync keeps up to date between `# harness:begin <block>` and `# harness:end <block>` lines, as an ignore file needs (an HTML comment would be a pattern). The sync adds the block at the end of the file when the file lacks it and makes the file when it is missing, so the project's own lines stay; `check generated` and the lock hold the block like any other. The packaging of a procedure may now return no path for a profile (`skillPath(procedure, profile)`). A project that wrote an adapter of its own needs no change.
- the Python stack preset (`adapters/stack/python/`; task 1.3), written by following the new-adapter procedure: uv workspaces, pytest with coverage.py (branch coverage; the raw report is merged and turned into the neutral summary by `coverage.mjs`), ruff for lint (E, F, I, B, UP, ANN, T20) and format, mypy in strict mode; the local gate plan (`gate.mjs`), the CI jobs, and a scaffold with a root `pyproject.toml`, `.python-version` and `.nvmrc`. A project selects it with `adapters.stacks`, alone or next to `node-ts`. The project creates `uv.lock` once with `uv lock` and commits it: CI installs with `uv sync --locked`.
- the examples (task 1.4). `examples/profile/` is a filled profile of a fictitious project, `examples/product/` its product specification, and `examples/plan/` a sample plan with one phase and two tasks with their logs; the framework's tests hold each to the check it exercises, and `examples/README.md` explains them. The bootstrap now writes the **product-knowledge skeleton** into a new project's `docs/product/` (an index, a glossary, a register of open questions and a backlog, from `core/templates/scaffold/product-*.md`), sets `productKnowledge` and the document roles `specification` and `glossary` in its profile file, and adds a row for the specification to the reading map of its entry file, so `harness check product-knowledge` runs on every new project. A project that bootstrapped before has no such files and no `productKnowledge`, and nothing changes for it.
- the proof of the design on a scratch project for every combination (task 1.5), repeatable with `tests/proof/proof.sh <directory>`: (A) node-ts with Claude Code, (B) python with Cursor in native mode, (C) node-ts and python together with both runtimes (Cursor in compat mode), (D) a detached project with a core rule edited, and (E) a repository that copied the first harness, adopted with `harness adopt`. On each, `harness check all` passes (run from the project's own copy of the tools), the stack's commands pass (`npm ci`, lint, tests and the documentation check; `uv lock`, `uv sync --locked`, ruff, mypy, pytest with coverage.py and `harness coverage summarize`), and the files of the runtime are as the design says (62 checks in all). A short targeted harness review (`tests/proof/review.mjs` gives the measurements) scores D1 layer integrity 5 (no stack or product term and no link out of CORE in 24,000 words of core), D3 injection 5 (no profile value written outside the profile) and D6 routing 4 (no orphan document; the always-loaded entry file is about 1,650 words, because it carries the rules every task needs). **The Cursor preset is unverified in a live session**: the proof runs its files and hooks against samples written from Cursor's documentation, not Cursor; the checklist in its README stays open, and a fix found there ships as `0.1.1`.

### Changed

- The total line of the plan summary starts at the plan's first phase (`Phase 1` for a plan of one phase), not at Phase 0.
- The protection rule of the entry file no longer names a script: the host enforces it with the ruleset `harness host protect` sets, and
  when `host.protection` is off the rule falls back to the hooks. The profile role `repository.protectionScript` is gone, and so is the
  clause from the Role binding line.
- Two rules of the non-negotiables are worded without a stack: "no new untyped public boundaries" (the stack's lint rule names them) and
  "no debug printing" (use the logger).
- The method's local-database step applies only where the profile has the database commands (`commands.dbUp`, `dbMigrate`, `dbSeed`), an
  optional role group; `documents.method` defaults to the vendored method.
- The host command line of the host adapter's logic roles is the seam `cli` (was `gh`), so one conformance check can pass a stand-in to any host. The
  claude-code event samples moved from `tests/fixtures/events/` into the adapter (`adapters/runtime/claude-code/events/`), where the suite replays them.
  A sync also vendors the three skeletons.
- the stack contract grew where the Python preset needed it, all additive for a stack that exists: `harness coverage summarize` writes the neutral summary from the raw report of one local run (for a tool that does not write it itself); `coverage-merge` gets `{ root, pkg }` as a second argument; an `ignore-files` entry may carry a `pattern` and an `example` for a tool that excludes paths with a setting; the release tool reads and writes the `version` of the `[project]` table of a TOML file; and `.nvmrc` is a file of lines in the node-ts preset, so that a project with two stacks bootstraps. A stack adapter of your own needs no change. The new-adapter guide has a section on what a stack learns the hard way.

### Fixed

- three defects the proof found. (1) A project with two stacks got a CI workflow with the same job ids twice (`static`, and each coverage package): each stack now names its static job after itself, runs its own commands, runs the documentation check only in the first, and keeps the coverage jobs of its own packages (`ciJobs(profile, context)` in the stack contract). (2) The document map of the profile document dropped a row when any role in it had no value, which hid the releases guide, the changelog and the plan method from every new project: each document has a row of its own now, and the starter profile names the changelog. (3) An orphan: the documents the map dropped were not reachable from the entry file; with the map fixed, a new project has none.
- `harness release` could not release from a development version such as `0.1.0-dev.1` (it did not parse it); a development version is now below its own release, so `0.1.0` and `patch` both give `0.1.0`. Found cutting `0.1.0`.

[Unreleased]: https://github.com/AndLD/harness-framework/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/AndLD/harness-framework/releases/tag/v0.1.0
