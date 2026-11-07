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
production branch from the same commit, installs the Git hooks and runs `check all`. Before it writes the files it asks the host what it offers
for the repository (`--no-host-setup` skips this): where the host can protect the repository and you administer it, it sets `host.protection: true`,
applies the ruleset, turns on "allow auto-merge" and writes the workflow that keeps the pull requests waiting on auto-merge up to date (an interactive
run says what it will set and asks once); where you have no admin rights it writes the files and names the one command for the owner; where the host
cannot protect the repository (a private repository on a free plan) it sets `host.protection: false`, which turns auto-merge off, and says what going
public or a paid plan adds. It prints what is left to the owner: the first push of both branches, and `host protect` where the bootstrap did not do it. `--detached` starts the project as its own copy; the result equals a pinned bootstrap followed by
`detach`.

## Using it

A project holds a copy of the framework in `harness/`, pinned by `harness.lock.json` at its root: the version, the source, the adapters it
selected in its profile file (`adapters`), and the SHA-256 of every copied file. The commands run with Node alone, as
`node harness/tools/harness.mjs <command>`:

| Command | What it does |
| ------- | ------------ |
| `sync --from <folder or Git URL> [--to <version>]` | Copies the paths that `framework.json` lists as distributable (without the files whose names end as its `excluded` says: the framework's tests, which prove the framework against its own repository), and of `adapters/` only the selected ones, into `harness/`, byte for byte, and rewrites the lock. A Git source needs the version; its tag is `<version>` or `v<version>`, and a tag that once pointed to another commit is refused. Without `--from`, it takes the locked source again. Overrides are dropped. It only places the files and updates the lock, then starts `migrate` of the new version in a new process. It refuses to start on the production or the integration branch, or with uncommitted changes, and records the commit and version it starts from in the lock (`migrations.start`). |
| `migrate` | Brings the project to the vendored version with that version's own tools: runs the migration scripts of every version after the project's own, up to the target, that the lock does not record as applied, in version order; regenerates the managed files; prints the migration notes of the versions after the project's own up to the target, in order (a development version has a note of its own; the development notes of an `x.y.z` are left out when its final note is among them). `sync` starts it; a project whose `sync` is older than `0.2.0` runs it itself after the sync. A lock without the record counts as `0.1.0` with nothing applied. It commits its changes (the sync's too) as one commit, `chore(framework): migrate to <version>`; the agent's changes follow as separate commits. After the `sync` of an older version it takes that sync's uncommitted files into the commit, and refuses any other uncommitted change. |
| `reports status\|list\|show\|search\|candidates\|plan\|comment\|close\|create` | The reports of users on the repository host, through the host adapter's `reports` role (the procedures `triage-reports` and `report-upstream` use it). `reports.intake` (`off`, `notify`, `auto`), `reports.triageLimit` and `reports.upstream` (`off`, `ask`, `post`) in the profile file say what an agent does; a local, ignored `harness-profile.local.json` overrides the three at once. Answering, closing and creating on the host need the owner's approval (`--approved`). |
| `probes <from> <to>` | The cold-start probes of the project to run again for the versions taken (those whose areas meet the areas that the migration notes of the versions list; each probe in the project's harness-review bindings names its areas), and the framework's starting probe for each area no probe covers. `check probes` holds that the probes name areas that exist. |
| `rollback` | Undoes the last migration through Git: puts every file the migration's commit changed back to its content at the starting commit the lock records, and removes the files it added, and touches nothing else. It leaves the result uncommitted, and refuses with uncommitted changes. No migration step is written to run backwards. |
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
| `check all` | Every check below in this order, then the project's own checks (`checks.project`: commands). It is the one command a project's documentation check runs. It is quiet: the problems and one line (`N checks passed`); `--verbose` prints what every check says, and the output of a project check that fails goes to a file whose path and failing lines (at most `output.maxLines`) are printed. The pre-push gate (`harness gate`) is quiet the same way. |
| `check vendored`, `check generated`, `check profile`, `check layers` | The copy against the lock, the managed files rendered again, the profile file against its schema (and two stacks never claiming one folder), and the layer map over the tracked files. |
| `check adapters` | The manifest of every adapter is filled to the contract of its axis (`core/contracts/`). |
| `check values` | The host's CI triggers equal the protected branches, every required check is a job, and the files of `checks.roleOnlyPaths` name branches, the repository, plan paths and the coverage packages by role. |
| `guard pre-commit`, `guard pre-push` | The Git guards that the hooks `tools/git-hooks/pre-commit` and `pre-push` run: no commit on a protected branch (the root commit of a new repository passes), no push to a protected branch, no deletion of a remote branch. |
| `gate [--dry-run]` | The local gate of a push, run by the pre-push hook with the refs on standard input: the documentation checks when documentation changed, the plan of each stack for the files it owns, the project's own steps (`gate`). |
| `coverage check-changed [--skip-missing] <base> [<package>...]` | Every file added or changed since `<base>` meets the coverage gate in the neutral summary of its package. |
| `coverage merge <artifacts> [--out <dir>] [<package>...]` | Merges the shards that CI uploaded (`coverage-<package>-<i>-of-<n>`) with the stack's merge and holds each total to the gate. |
| `coverage summarize [--skip-missing] [<package>...]` | Writes the neutral summary of the last local run of a package from its raw coverage, with the stack's merge and without the gate: for a tool that does not write the summary itself (coverage.py). |
| `check scaffold` | The ignore files of the stacks exclude the vendored framework, and the configuration of each agent runtime holds the framework's hook entries and read exclusions. |
| `host protect [--repo <owner/name>]` | Sets the protection of the production and the integration branch on the host through the host adapter, and turns the host's auto-merge on or off by `host.autoMerge` (on where the host protects, off where it cannot); it fails when `host.protection` of the profile differs from what the host can do. |
| `branch update [--previous <branch>]` | In the branch of a task stacked on the branch of the previous one, after the previous pull request was squash-merged: first takes the previous branch's tip into this branch if this branch was made from an older commit of it, then merges the integration branch and resolves the conflicts that only the squash causes (a file whose content on the integration branch is what the previous branch has at its tip), in favour of this branch; any other conflict is left for you, with the merge in progress. |
| `adopt [--non-interactive] [--from <folder or Git URL> [--to <version>]]` (and the flags of `init`) | The bootstrap for a repository that copied the first harness (a profile file under `scripts/`, Git hooks, link and plan scripts, a project check). It moves the profile file to the root and completes it (asking for the required roles, as `init`), writes `harness/`, the lock and the managed files, adds the managed blocks to the entry file (below the project's own text), points `core.hooksPath` and the runtime's hook entries at the framework, lists the scripts and hooks the framework now replaces (by name, or by what they export) and the project's own checks (`checks.project`). It deletes and commits nothing; the project removes the replaced scripts in its own pull request. |
| `adapter test <path> [--only <pattern>]` | Runs the conformance suite of its axis on the adapter folder at `<path>` (a preset, or a new adapter written by [the new-adapter guide](core/contracts/new-adapter.md)); `--only` narrows the checks by name. It exits 1 when a check fails. |
| `check links` | Every relative link of the tracked Markdown files resolves, and an `#anchor` matches a heading as the host renders it. |
| `check paths` | A repository path in backticks in a document outside STATE exists: a path that starts with a dot and a slash (the current or the parent folder), or whose first folder is a top-level entry, and that names a file by its extension or a folder by a final `/`. A path the repository ignores is accepted. |
| `check core` | The project's own CORE documents (`layers.core`, none for a project that uses the framework) and the `core/` folder hold no stack term, product term or project value (`terms`): the folder the project owns, and in a pinned project its vendored copy, scanned with the project's own terms. The words in `core/vocabulary.json` (the ones the core uses on purpose) are never reported. |
| `check plan` | The summary and the contents of the plan index agree with the phase files (`plan summary` writes them). |
| `check flows`, `flow check` | The flows of the plan (the plan method, section 10): the parts of each flow file and of its log, unique step ids (an inserted step with a suffix), the ids a step names exist (never a backlog item), versions are rows of the releases file that the flow declares, the `Needs` of steps and of flows resolve and point backwards, and the flows index agrees with the files. |
| `flow status <n>` | Recomputes the state of each step of a flow from the repository (ids done and their pull requests merged, the tag of a cut, the lock of a consumer), compares it with the State column and the newest log entries, and prints the mismatches, a step left open by an orchestrator that stopped, and the next step. |
| `flow next <n>`, `flow prompt <n> <step>` | The next step of a flow with its prompt, or the prompt of a step: the standard wording of `core/plan/flow-step-prompts.md` filled for the step's kind and scope, or the text of a `custom` step. |
| `flow dispatch <n> <step> [--context <percent>] [--account <id>] [--brief]` | How to hand a step to a worker: its executor (the runtime adapter's role `executors`, the manual one when the runtime offers none), whether the previous step's worker continues it (`reuse: auto`) with every reason, and the means to start or continue it (with a fresh start to fall back on), fetch its full report and read its context. |
| `flow estimate <n>`, `flow gate <n> <step> [--five-hour <pct>[@<reset>]] [--weekly …] [--cost <usd>]`, `flow sample <n> <event> [<step>] …` | The usage of a flow (the runtime adapter's role `usage`): the estimate of each step and of the flow by the subscription's table of coefficients; whether a step may start given the use the account reports (GO, WAIT until a reset, STOP, or ASK for the use); and a measurement appended to the flows' `usage.jsonl`, with the line the log carries. |
| `flow audit <n> [--orchestrator <id>[,<id>]] [--top <n>] [--json]` | Reports where the tokens of a flow went, from the runtime adapter's transcripts (the role `transcripts`; a runtime without it cannot be audited): by tool, by shell command, by step and by session, the largest results, what entered the context apart from the peak context of a session. It reads the workers from the flow's log and the orchestrator from `--orchestrator`; it writes nothing. |
| `flow calibrate [--min <n>] [--subscription <id>]` | Proposes new usage coefficients from the flows' `usage.jsonl`: the median use per SP of each subscription, model and step kind (tokens converted to percent where the runtime reports them; a window that a reset cut is dropped), the cold against the warm starts, and whole flows against their steps. It writes nothing. |
| `check changelog` | Every changelog fragment starts with a Keep a Changelog kind. |
| `check product-knowledge` | The register of open items, the glossary, and no stack term, plan reference or code path in the product knowledge (`productKnowledge`). |
| `plan log <phase> [ref]` | The implementation log of a phase, from the `Plan:` lines of the squash commits. |
| `release [--dev] [--dry-run]`, `release notes <version>` | On a `release/<x.y.z>` or `hotfix/<x.y.z>` branch, the versions of `release.versionFiles` and the changelog section; with `--dev` only the next development version `<x.y.z>-dev.<n>` (the changelog stays), which is tagged before the final tag so that a project can sync it and run its checks; the notes of one version for the host's release. With `release.migrations` in the profile file, a release, a development version included, is refused without the migration note of its version (a stub is written when it is missing), which the command fills with the areas the version touched and, for a final version, links from the changelog. |
| `ci changes <base> <head>` | Whether a change needs the code checks: not when every changed path is documentation (`checks.documentationPaths`, every Markdown file by default). In doubt it says it does. CI and the push gate use the same rule. |

## Taking a version

A project takes a version with `sync --from <source> --to <version>`, then runs `node harness/tools/harness.mjs migrate` where the `sync` of its old version did not start it (every version before `0.2.0`), as the note says. Every version from `0.1.1` on, development versions included, has a **migration note**, [`migrations/<version>.md`](./migrations/README.md), that says what a project must do when it takes that version from the previous one, with the check that proves each action done. A project that skips versions (`0.1.1` straight to `0.3.0`) reads the notes of every version after its own up to the target, in order (the final note of a version stands for its development notes), and does the required actions of each; the changelog says what changed, the notes say what to do. The areas a note lists tell which of the project's own files and probes the version touched. A version that needs nothing says so. The procedure `update-framework` is these steps for an agent: the branch, `sync`, `migrate`, the notes in order with the check of every required action, `check all` and the project's gate, the probes that `harness probes <from> <to>` selects, and `harness rollback` when it fails.

## A word found in `core/`

The framework's `core/` is neutral: it names no stack, tool, runtime, host or project. `harness check core` of a project that uses the framework scans its vendored `core/` with the project's own `terms`, and a hit names the file, the line and the word.

- **An ordinary word** (the project's term list is too broad): answer it in the project, with `terms.productGeneric`. If the core uses the word on purpose, it belongs in `core/vocabulary.json`, which the scan never reports. The framework does not rename its own words.
- **A product, tool or project word that reached `core/`** is a leak, and a defect of the framework: report it with the issue template "A word found in core". A confirmed leak becomes a task of the open-ended phase of the plan, and is fixed in a patch release. Until then the project is not blocked: it records the hit in `terms.exceptions` of its profile file (the file, the word, the link to the report, and the framework version it holds for), which `check core` accepts while the lock is at that version. After a sync to another version the exception fails the check, so it cannot outlive the fix.
- **Before the final tag** of a release the framework tags a development version (`<x.y.z>-dev.<n>`, see the [releasing guide](./docs/operations/releasing.md)), so that a project can sync it and run the scan first.

Planned for `0.1.0`, in the order of the build tasks:

- **Add a stack, a runtime or a host** by following `core/contracts/new-adapter.md` and passing the conformance suite.

## License

MIT, see [`LICENSE`](./LICENSE). Changes are recorded in [`CHANGELOG.md`](./CHANGELOG.md).
