# Agent-runtime adapter contract

An **agent-runtime adapter** says how a coding agent loads the rules and procedures, and which of the rules it can block before the action happens. A project
selects zero or more in `adapters.runtimes`; a project with none is valid and gets the entry file, the procedures linked from its reading map, the Git hooks and CI,
which is the agent-neutral minimum. The machine form is the `manifest.json` of the adapter (`x-roles.runtime`); `harness check adapters` holds a manifest to it.

| Role | Kind | The adapter says |
| ---- | ---- | ---------------- |
| `entry-file` | required | how the runtime loads the entry file (a pointer file, or nothing when it reads the entry file itself) |
| `always-loaded-rules` | required | what is loaded in every session; the entry file only, so that no text is loaded twice |
| `on-demand-rules` | required | how a document is read when a task needs it; the reading map of the entry file |
| `hook-configuration` | optional (none: every rule that needs a hook falls back to the Git hooks and CI) | the file that registers the hooks, and their events |
| `hook-io` | optional (needed with hooks) | how the runtime's event is read and its answer written (block, message, session context); the form of each supported runtime is in the framework's `tools/runtime-hooks/io.mjs`, which a new runtime extends |
| `project-directory` | required | the environment variable that holds the project directory |
| `read-exclusions` | required | how the runtime keeps the agent from reading the paths of `access.denyRead`, and what that does not cover |
| `procedure-packaging` | required | where the neutral procedures of `core/procedures/` are written for the runtime, and in what form |
| `pull-request-tools` | optional (none: the agent checks the required checks with the host's command before it merges, and the rule on CI monitoring with automatic fixes is "not applicable") | attaching a pull request and monitoring its CI |
| `waiting-advice` | optional | notes on waiting for long-running commands |
| `model-map` | optional | the default of `plan.complexity.models` |
| `hook-adoption` | logic-optional (needed for `harness adopt` on a project that has the runtime's configuration already) | `adoptConfiguration({ root, profile }) → { files: [{ path, content }], notes }`: the runtime's configuration of the project with the framework's hook entries and read exclusions added, and a note for each hook command that is the project's own; it deletes nothing |
| `managed-blocks` | logic-optional | `managedBlocks(profile) → [{ path, block, content }]`: blocks of files of the project that the sync keeps up to date, between `# harness:begin <block>` and `# harness:end <block>` lines (an ignore file, where an HTML comment would be a pattern); the sync adds the block at the end of the file when it lacks it, and the project's own lines stay as they are |
| `scaffold-files` | logic-optional | `scaffoldFiles(profile) → [{ path, content }]`: the entry-file pointer and the hook configuration that the bootstrap writes once into a new project |

**Defaults for a new project.** The manifest's `defaults` are values of the profile file that the adapter gives a project it bootstraps: the bootstrap writes them where the answers leave a role empty, and an answer always wins. The scaffolded files are the adapter's `scaffold-files` role.

**Where a rule is caught.** Each adapter's manifest declares the rules it enforces and at which moment: *early* (the runtime, before the action), *local* (a Git hook)
or *remote* (CI or the host). The core part of the rule-to-check map is generated from those declarations, so a project with other adapters gets a true map. A rule
the runtime cannot block early falls to the Git hooks and CI, and a rule nothing can check is judgment, said so in the map.

The `terms` of the manifest are the runtime's own words (its tool names and folders), joined into the CORE scan.

A new adapter is written by [the new-adapter guide](./new-adapter.md), and passes the conformance suite (`harness adapter test`).
