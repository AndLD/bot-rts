[← Design of the framework](../design.md)

# harness-framework

A framework for the **harness** of a software project: the rules, the method documents, the checks, the Git hooks and the agent-runtime
configuration that let any coding agent, and any person, work on the project under the same engineering rules. A new project bootstraps its
harness from this framework, whatever its stack and whatever agent it uses, and takes later improvements by a version upgrade.

**Status: `0.1.0-dev`, the skeleton.** The folders of the layout exist and nothing else yet. This file is the contract of what will stand
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

Planned for `0.1.0`, in the order of the build tasks:

- **Bootstrap a project** with `harness init` (interactive or with flags), with `harness bootstrap`, or by following `BOOTSTRAP.md`. All
  three produce the same result.
- **Take an upgrade** with `harness sync`, which replaces the vendored copy in `harness/` and rewrites `harness.lock.json`; a local edit to a
  vendored file fails `harness check vendored`.
- **Own the copy** with `harness detach`, for a project that wants to edit the framework and take no more updates.
- **Add a stack, a runtime or a host** by following `core/contracts/new-adapter.md` and passing the conformance suite.

## License

MIT, see [`LICENSE`](./LICENSE). Changes are recorded in [`CHANGELOG.md`](./CHANGELOG.md).
