# Changelog

All notable changes to the framework are recorded here. The format follows [Keep a Changelog](https://keepachangelog.com/), and the
versions follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added

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

### Changed

- The protection rule of the entry file no longer names a script: the host enforces it with the ruleset `harness host protect` sets, and
  when `host.protection` is off the rule falls back to the hooks. The profile role `repository.protectionScript` is gone, and so is the
  clause from the Role binding line.
- Two rules of the non-negotiables are worded without a stack: "no new untyped public boundaries" (the stack's lint rule names them) and
  "no debug printing" (use the logger).
- The method's local-database step applies only where the profile has the database commands (`commands.dbUp`, `dbMigrate`, `dbSeed`), an
  optional role group; `documents.method` defaults to the vendored method.
