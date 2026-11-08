# Stack adapter contract

A **stack adapter** tells the framework how a language and its tools fill the roles below. A project selects one or more in `adapters.stacks` of its profile file. The
machine form of this list is the `manifest.json` of the adapter (`profile/manifest.schema.json`, `x-roles.stack`); `harness check adapters` holds a manifest to it,
and the conformance suite tests each role. A role is **required**, **optional** (the fallback is stated), or **logic** (a Node module of the adapter with a fixed
function signature; "logic-optional" when the role is needed only in some projects).

**Several stacks.** `adapters.stacks` is a list. Each entry is an adapter name, or `{ "adapter": <name>, "packages": [<folder>, …] }` with the folders it owns. A
project with several stacks gives every entry its folders, and two stacks must not claim the same folder (`harness check profile`). A file belongs to the stack
whose folders contain it; a file no stack owns (root configuration, documents) is checked by the core checks only. The push gate and the format hook route each
changed file to its stack and run that stack's plan; CI gets the jobs of every stack. The coverage gate and the commands of the profile are per stack where they differ.

| Role | Kind | The adapter says |
| ---- | ---- | ---------------- |
| `package-manager` | required | the install command, the lock file, and how the packages are listed |
| `coverage-packages` | required | the default of `coveragePackages` in the profile file |
| `test-runner` | required | the commands `test` and `testCoverage`, per package |
| `e2e-runner` | optional (none: the end-to-end rules of the method are "not applicable" in the generated rule map) | the command `e2e` |
| `coverage-tool` | required | the commands that write the **neutral coverage summary** (`coverage/coverage-summary.json` per package, the shape of the common JSON summary) and the measures it reports (statements, branches, functions, lines, or a subset). A tool that writes only its own report fills `coverage-merge` as well, and the test step of the local gate ends with `harness coverage summarize <package>`, which turns the report of the run into the summary |
| `coverage-merge` | logic-optional (needed for shards, and for a tool that does not write the summary) | `merge(shards, { root, pkg }) → { artifacts, summary }`: the parsed raw coverage files of the shards of one package become the merged raw files (`artifacts`, by file name) and the neutral summary, whose entries are keyed by absolute path; `root` is the project root and `pkg` the package folder, for a tool whose report names files relative to where it ran. The module also exports `SHARD_FILE`, the name of the raw file of a shard |
| `linter` | required | `lint`, and the rules that hold the non-negotiables (untyped public boundaries, debug printing) |
| `formatter` | required | `format` and `format:check`, the default file types it formats (the profile may narrow them); it runs only from the project's own installation, never downloaded on demand |
| `typecheck` | optional (none: the gate skips it and the definition of done marks it "not applicable") | the command `typecheck` |
| `import-boundaries` | optional | the command `boundaries` |
| `generated-files` | optional | the commands that regenerate generated files and the paths whose difference the gate checks |
| `version-file` | required | where the release tool reads and writes the version: a JSON file with a `version`, or the `[project]` table of a TOML file |
| `local-gate-plan` | logic | `plan(files, profile) → steps`: the checks that a push of these files needs |
| `ci-job-layout` | required | `ciJobs(profile, context) → { ids, yaml }`: the job templates for the host: setup and cache, static checks, tests per package (shards optional), the coverage artifacts that the aggregator merges. In a project with several stacks `context` is `{ stacks, first, name, packages, commands }` (how many stacks, whether this is the first, its name, the folders it owns, its own default commands): each stack names its static job after itself, runs its own commands, the documentation check only when it is the first, and keeps the coverage jobs of its own packages, so that no job id is written twice |
| `commands` | required | the defaults of the `commands.*` roles that the profile document and the packaged procedures print |
| `quiet-commands` | optional (a minor addition to contract 2: an adapter without it still conforms) | the quiet variants of the commands it defaults, in `defaults.commands` as `lintQuiet`, `typecheckQuiet`, `formatQuiet`, `testQuiet` and `testCoverageQuiet`: the same check with the output reduced to the failures and a summary. A step of the local gate's plan may carry `quiet: { args }`, which the gate runs in place of the step's arguments unless `--verbose` is given. A procedure cites the quiet variant by its role; a project with none gets the plain command |
| `dependency-audit` | logic-optional (a minor addition to contract 2: an adapter without it still conforms, and the dependency checks of `harness check security` skip its stack) | `dependencyAudit(profile) → { command, manifests, versionProblems }`: `command` audits the lock files against an advisory database (it needs the network, so `harness check security` runs it only with `--audit`; the profile's `commands.audit` overrides it); `manifests` lists `{ glob, locks, members? }` for each file that lists dependencies (`locks` are the lock files, one of which must be tracked beside it, or beside an ancestor manifest whose `members(text) → string[]` (optional; globs of folders, `!` excludes) lists the folder of the file, as the workspaces of a package manager; none for a file that is its own record); `versionProblems(file, text) → string[]` names the versions in a manifest that are not exact or bounded above (probes S2-001, S2-003 and S2-010) |
| `ignored-directories` | required | the directories the hooks and the checks skip |
| `ignore-files` | required | the files in which the formatter and the linters exclude paths, so that the vendored framework is excluded from them; the scaffold check fails when they do not. A file is held to a line `harness/`, or, where the tool excludes paths with a setting (a TOML file), to the `pattern` of its entry in the manifest (a regular expression with `<folder>`) and the `example` line the check prints |
| `scaffold-files` | logic-optional | `scaffoldFiles(profile) → [{ path, content }]`: the stack's configuration files that the bootstrap writes once into a new project (the runtime version file, the ignore files, the package manifest); a file named by several adapters is a list of lines (the Git ignore file, and the Node version file `.nvmrc`, which every stack needs because the harness tools run on Node), and the lines are joined |

**Defaults for a new project.** The manifest's `defaults` are values of the profile file that the adapter gives a project it bootstraps: the bootstrap writes them where the answers leave a role empty, and an answer always wins. The scaffolded files are the adapter's `scaffold-files` role.

The `terms` of the manifest are the stack's own words (tool and language names). The CORE scan joins them with the term lists of the profile file, so core text never
names a tool.

A new adapter is written by [the new-adapter guide](./new-adapter.md), and passes the conformance suite (`harness adapter test`).
