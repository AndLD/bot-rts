# Host adapter contract

A **host adapter** says how the repository host fills the roles of branch protection, required checks, pull requests and releases. A project selects one in
`adapters.host`. The machine form is the `manifest.json` of the adapter (`x-roles.host`); `harness check adapters` holds a manifest to it.

| Role | Kind | The adapter says |
| ---- | ---- | ---------------- |
| `repository-identity` | required | the roles `repository.slug`, `repository.url` and `repository.host` of the profile file |
| `protection-available` | logic | `detectProtection({ slug, cli }) → { available, reason }` (`cli(args, input) → { status, stdout, stderr }` is the host's command line, a seam that tests replace): whether the host can enforce the protection on this repository (its plan, its visibility); the owner sets `host.protection` in the profile file, and `harness host protect` fails when the two differ |
| `branch-protection` | logic | `protect({ profile, slug, cli }) → { messages, problems }`, idempotent: no deletion, no force-push, a pull request for every change, the required checks, and administrators may bypass only when merging a pull request; it also keeps merged branches |
| `required-checks` | required | the job names of `requiredChecks`, and a way for each to report on every change, including a change that is documentation only (the aggregator pattern: one job per required check that needs the parallel jobs) |
| `ci-workflow-frame` | required | the workflow that triggers on the protected branches, with concurrency and the change-detection job (`harness ci changes`) |
| `pull-request-title-check` | required | the job that checks the pull-request title against the commit format of the profile |
| `pull-requests` | required | how to open a draft, mark it ready, read the state of the checks, list the open ones (claims, session start) and merge by the strategy of the branch type |
| `merge-guard` | logic-optional (needed only when `host.protection` is false) | `isMerge(words)` recognises a merge command; `checkMerge({ words, cwd, requiredChecks, cli })` returns the message that refuses it, or null when the required checks of the pull request are green |
| `release` | required | the workflow on a version tag: check the version, build the release notes from the changelog (`harness release notes`), create the release |
| `ci-timings` | optional | a report of the durations of a CI run |
| `values-in-host-files` | logic | `readTriggers(root)` and `readJobNames(root)` for `harness check values`, and `isWorkflowFile(path)` (the manifest names `readTriggers`; the module exports the three) |
| `scaffold-files` | logic-optional | `scaffoldFiles(profile, { jobs }) → [{ path, content }]`: the CI and release workflows that the bootstrap writes once into a new project, with `jobs` the CI jobs of the selected stacks (`ci-job-layout`) |

**Defaults for a new project.** The manifest's `defaults` are values of the profile file that the adapter gives a project it bootstraps: the bootstrap writes them where the answers leave a role empty, and an answer always wins. The scaffolded files are the adapter's `scaffold-files` role.

**Without protection.** On a host that cannot protect the repository (`host.protection: false`) the host refuses nothing. The rules that cite "the host" then rest
on the Git hooks and the runtime's hooks, the merge guard turns on, and the rule map generated for the project says so.

The `terms` of the manifest are the host's own words, joined into the CORE scan.

A new adapter is written by [the new-adapter guide](./new-adapter.md), and passes the conformance suite (`harness adapter test`).
