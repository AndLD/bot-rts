[← Design of the framework](../design.md)

# harness-framework

A framework for the **harness** of a software project: the rules, the method documents, the checks, the Git hooks and the agent-runtime
configuration that let any coding agent, and any person, work on the project under the same engineering rules. A new project bootstraps its
harness from this framework, whatever its stack and whatever agent it uses, and takes later improvements by a version upgrade.

**Status: `0.1.0-dev`.** The folders of the layout exist, and the vendoring commands work (`sync`, `check vendored`, `diff`, `override`,
`detach`); the rest follows. This file is the contract of what will stand
here; the [design](../design.md) gives the reasons and the build order, and the [plan of the extraction](../README.md) gives the steps. The
commands below are the ones the build tasks add; until a task lands, a command named here does not exist.

## What it holds

| Folder or file | What it is |
| -------------- | ---------- |
| `core/` | the project-, stack-, runtime- and host-neutral part: rules, method documents, plan and review methods, procedures, adapter contracts and templates |
| `profile/` | the schema of `harness-profile.json`, the one file that holds every project value, and the description of each role |
| `adapters/` | what depends on a stack (`stack/`), a coding-agent runtime (`runtime/`) or a repository host (`host/`); each axis has a skeleton for a new adapter |
| `tools/` | the `harness` command line, its checks, the Git hooks and the runtime hooks; plain Node, with no dependencies |
| `tests/conformance/` | the suite that every adapter passes |
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

## Using it

A project holds a copy of the framework in `harness/`, pinned by `harness.lock.json` at its root: the version, the source, the adapters it
selected in its profile file (`adapters`), and the SHA-256 of every copied file. The commands run with Node alone, as
`node harness/tools/harness.mjs <command>`:

| Command | What it does |
| ------- | ------------ |
| `sync --from <folder or Git URL> [--to <version>]` | Copies the paths that `framework.json` lists as distributable, and of `adapters/` only the selected ones, into `harness/`, byte for byte, and rewrites the lock. A Git source needs the version; its tag is `<version>` or `v<version>`, and a tag that once pointed to another commit is refused. Without `--from`, it takes the locked source again. Overrides are dropped. |
| `sync --local` | Regenerates the files the tools manage in the project from `harness/` and the profile file, and fetches nothing. |
| `check vendored` | Fails when a file in `harness/` was edited, removed or added, when a managed file differs, or when the profile file changed since the managed files were generated. With a folder as the source, it also fails when the source changed without a sync, so the two change together. |
| `diff` | Prints what the project changed in `harness/`, against the locked version, or against the fork point after `detach`. |
| `override <path> --reason <why> --issue <link>` | Accepts one edited file until the next sync, for a fix that cannot wait for a release. Every check prints it. |
| `detach --reason <why>` | The project takes the copy over: no more versions, `harness/` is its own, and the lock keeps the fork point for `diff`. `harness/LICENSE` must stay. |

Never edit `harness/` by hand. Change the framework, then sync: while the framework is built inside a project, its source is a folder of
that project, and the copy changes in the same pull request.

Planned for `0.1.0`, in the order of the build tasks:

- **Bootstrap a project** with `harness init` (interactive or with flags), with `harness bootstrap`, or by following `BOOTSTRAP.md`. All
  three produce the same result.
- **Add a stack, a runtime or a host** by following `core/contracts/new-adapter.md` and passing the conformance suite.

## License

MIT, see [`LICENSE`](./LICENSE). Changes are recorded in [`CHANGELOG.md`](./CHANGELOG.md).
