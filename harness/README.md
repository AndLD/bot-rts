# harness-framework

A framework for the **harness** of a software project: the rules, the method documents, the checks, the Git hooks and the agent-runtime
configuration that let any coding agent, and any person, work on the project under the same engineering rules. A new project bootstraps its
harness from this framework, whatever its stack and whatever agent it uses, and takes later improvements by a version upgrade.

**Status: `0.1.0-dev`.** The folders of the layout exist, the core documents (rules, method, plan and review methods and their templates)
are in `core/`, and the bootstrap, vendoring, profile, layer, check, plan, release and CI commands work; the rest follows. This file is the contract of what will stand
here; the design document in the docs folder of the framework's repository gives the reasons and the build order, and that repository's development plan
gives the steps. The commands below are the ones the build tasks added; one that the plan has not delivered yet is marked as planned.

## What it holds

| Folder or file | What it is |
| -------------- | ---------- |
| `core/` | the project-, stack-, runtime- and host-neutral part: rules, method documents, plan and review methods, procedures, adapter contracts and templates |
| `profile/` | the schema of `harness-profile.json`, the one file that holds every project value, and the description of each role |
| `adapters/` | what depends on a stack (`stack/`), a coding-agent runtime (`runtime/`) or a repository host (`host/`); each axis has a skeleton for a new adapter |
| `tools/` | the `harness` command line, its checks, the Git hooks and the runtime hooks, and the conformance suite that every adapter passes (`tools/conformance/`, run by `harness adapter test`); plain Node, with no dependencies |
| `tests/` | the framework's own tests that run the suite on the presets and on deliberately broken adapters (`tests/conformance/`), the proof of the design on five scratch projects (`tests/proof/`), and the recorded fixtures |
| `examples/` | a filled profile, a product-knowledge skeleton and a plan of a fictitious project |
| `framework.json` | the name, the version, the adapters and the paths that a sync copies |

## Assumptions of the method

The framework is opinionated, and these assumptions hold for every project that uses it:

- **Git Flow** with two long-lived branches, a production branch and an integration branch, and short work branches that start from the
  integration branch.
- **Every change goes through a pull request**, reviewed or approved before it is merged.
- **Squash merges into the integration branch**, so that one pull request is one commit. The plan log relies on this: each squash commit
  carries a `Plan:` line with its task id.
- **A plan of phases and tasks**, with task ids, sizes, acceptance checks and a log per task.

A trunk-based variant is not a profile switch. It would be a later phase of the framework's own plan.

## Starting a project

A new project starts in one of three ways, and all three give the same result, because they only fill `harness-profile.json` and then run
one engine (`tools/lib/bootstrap.mjs`):

| Front end | How |
| --------- | --- |
| The script | `node <framework>/tools/harness.mjs init` in the project's folder. It asks the questions (the project name, the repository, the adapters, the coverage gate, the branches), offering a default for each one that has it; with flags (`--name`, `--repository`, `--stack`, `--runtime`, `--host`, `--set <role>=<value>`, `--non-interactive`) it asks nothing, and a missing required answer fails before anything is written. |
| The template repository | `harness template <dir>` builds it from the framework: the whole framework in `harness/`, a profile file with the defaults and the required roles empty, `BOOTSTRAP.md`, and a README that says how to start. Make a repository from it, then run `node harness/tools/harness.mjs init`. |
| `BOOTSTRAP.md` | A prompt that any coding agent can follow: it asks the user the questions in one message, writes the answers into the profile file and runs `harness bootstrap`. |

`harness bootstrap` completes the profile file from the answers, `profile/starter.json` and the defaults of the selected adapters, writes the
scaffolded files once (it refuses to overwrite one the project has, unless `--force`), vendors the framework and generates the managed files,
commits the result as the root commit of the integration branch (or on a new integration branch from a commit the host made), makes the
production branch from the same commit, installs the Git hooks and runs `check all`. It prints what is left to the owner: the first push of
both branches, and `host protect`. `--detached` starts the project as its own copy; the result equals a pinned bootstrap followed by
`detach`.

## Using it

A project holds a copy of the framework in `harness/`, pinned by `harness.lock.json` at its root: the version, the source, the adapters it
selected in its profile file (`adapters`), and the SHA-256 of every copied file. The commands run with Node alone, as
`node harness/tools/harness.mjs <command>`:

| Command | What it does |
| ------- | ------------ |
| `sync --from <folder or Git URL> [--to <version>]` | Copies the paths that `framework.json` lists as distributable, and of `adapters/` only the selected ones, into `harness/`, byte for byte, and rewrites the lock. A Git source needs the version; its tag is `<version>` or `v<version>`, and a tag that once pointed to another commit is refused. Without `--from`, it takes the locked source again. Overrides are dropped. |
| `sync --local` | Regenerates the files the tools manage in the project from `harness/` and the profile file, and fetches nothing. |
| `check generated` | Renders every managed file and block again (the profile document, the layer map, the entry file's rule blocks) and fails when the project's text differs, in every mode, detached too. |
| `check vendored` | Fails when a file in `harness/` was edited, removed or added, when a managed file differs, or when the profile file changed since the managed files were generated. With a folder as the source, it also fails when the source changed without a sync, so the two change together. |
| `diff` | Prints what the project changed in `harness/`, against the locked version, or against the fork point after `detach`. |
| `override <path> --reason <why> --issue <link>` | Accepts one edited file until the next sync, for a fix that cannot wait for a release. Every check prints it. |
| `detach --reason <why>` | The project takes the copy over: no more versions, `harness/` is its own, and the lock keeps the fork point for `diff`. `harness/LICENSE` must stay. |

**The entry file's rules are managed blocks.** Its non-negotiables and its Git rules are `core/rules/non-negotiables.md` and `core/rules/git.md`,
rendered with the profile between `<!-- harness:begin non-negotiables -->` and `<!-- harness:begin git-rules -->` and their end markers. Each rule
carries a stable id (`<!-- rule:<id> -->`) that the rule-to-check map cites; the Role binding line is the only line of the blocks that names
the project's values. A role the blocks need and the profile lacks fails the sync rather than dropping a line of a rule.

Never edit `harness/` by hand. Change the framework, then sync: while the framework is built inside a project, its source is a folder of
that project, and the copy changes in the same pull request.

The checks and the project tools read every value from the profile file:

| Command | What it does |
| ------- | ------------ |
| `check all` | Every check below in this order, then the project's own checks (`checks.project`: commands). It is the one command a project's documentation check runs. |
| `check vendored`, `check generated`, `check profile`, `check layers` | The copy against the lock, the managed files rendered again, the profile file against its schema (and two stacks never claiming one folder), and the layer map over the tracked files. |
| `check adapters` | The manifest of every adapter is filled to the contract of its axis (`core/contracts/`). |
| `check values` | The host's CI triggers equal the protected branches, every required check is a job, and the files of `checks.roleOnlyPaths` name branches, the repository, plan paths and the coverage packages by role. |
| `guard pre-commit`, `guard pre-push` | The Git guards that the hooks `tools/git-hooks/pre-commit` and `pre-push` run: no commit on a protected branch (the root commit of a new repository passes), no push to a protected branch, no deletion of a remote branch. |
| `gate [--dry-run]` | The local gate of a push, run by the pre-push hook with the refs on standard input: the documentation checks when documentation changed, the plan of each stack for the files it owns, the project's own steps (`gate`). |
| `coverage check-changed [--skip-missing] <base> [<package>...]` | Every file added or changed since `<base>` meets the coverage gate in the neutral summary of its package. |
| `coverage merge <artifacts> [--out <dir>] [<package>...]` | Merges the shards that CI uploaded (`coverage-<package>-<i>-of-<n>`) with the stack's merge and holds each total to the gate. |
| `coverage summarize [--skip-missing] [<package>...]` | Writes the neutral summary of the last local run of a package from its raw coverage, with the stack's merge and without the gate: for a tool that does not write the summary itself (coverage.py). |
| `check scaffold` | The ignore files of the stacks exclude the vendored framework, and the configuration of each agent runtime holds the framework's hook entries and read exclusions. |
| `host protect [--repo <owner/name>]` | Sets the protection of the production and the integration branch on the host through the host adapter; it fails when `host.protection` of the profile differs from what the host can do. |
| `adopt [--non-interactive] [--from <folder or Git URL> [--to <version>]]` (and the flags of `init`) | The bootstrap for a repository that copied the first harness (a profile file under `scripts/`, Git hooks, link and plan scripts, a project check). It moves the profile file to the root and completes it (asking for the required roles, as `init`), writes `harness/`, the lock and the managed files, adds the managed blocks to the entry file (below the project's own text), points `core.hooksPath` and the runtime's hook entries at the framework, lists the scripts and hooks the framework now replaces (by name, or by what they export) and the project's own checks (`checks.project`). It deletes and commits nothing; the project removes the replaced scripts in its own pull request. |
| `adapter test <path> [--only <pattern>]` | Runs the conformance suite of its axis on the adapter folder at `<path>` (a preset, or a new adapter written by [the new-adapter guide](core/contracts/new-adapter.md)); `--only` narrows the checks by name. It exits 1 when a check fails. |
| `check links` | Every relative link of the tracked Markdown files resolves, and an `#anchor` matches a heading as the host renders it. |
| `check paths` | A repository path in backticks in a document outside STATE exists: a path that starts with a dot and a slash (the current or the parent folder), or whose first folder is a top-level entry, and that names a file by its extension or a folder by a final `/`. A path the repository ignores is accepted. |
| `check core` | The project's own CORE documents (`layers.core`, none for a project that uses the framework) and the `core/` folder that the project owns hold no stack term, product term or project value (`terms`). |
| `check plan` | The summary and the contents of the plan index agree with the phase files (`plan summary` writes them). |
| `check changelog` | Every changelog fragment starts with a Keep a Changelog kind. |
| `check product-knowledge` | The register of open items, the glossary, and no stack term, plan reference or code path in the product knowledge (`productKnowledge`). |
| `plan log <phase> [ref]` | The implementation log of a phase, from the `Plan:` lines of the squash commits. |
| `release [--dry-run]`, `release notes <version>` | On a `release/<x.y.z>` or `hotfix/<x.y.z>` branch, the versions of `release.versionFiles` and the changelog section; the notes of one version for the host's release. |
| `ci changes <base> <head>` | Whether a change needs the code checks: not when every changed path is documentation (`checks.documentationPaths`, every Markdown file by default). In doubt it says it does. CI and the push gate use the same rule. |

Planned for `0.1.0`, in the order of the build tasks:

- **Add a stack, a runtime or a host** by following `core/contracts/new-adapter.md` and passing the conformance suite.

## License

MIT, see [`LICENSE`](./LICENSE). Changes are recorded in [`CHANGELOG.md`](./CHANGELOG.md).
