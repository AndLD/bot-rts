# Writing a new adapter

An adapter fills one contract ([stack](./stack.md), [runtime](./runtime.md) or [host](./host.md)) for a tool the framework has no preset for: a language and its tools, a
coding agent, a repository host. Any agent can follow these steps; they are the same for the three axes. The conformance suite is the judge: an adapter is done
when `harness adapter test` passes on it, which is the same suite the presets pass in the framework's tests.

## Steps

1. **Copy the skeleton** `adapters/<axis>/_skeleton/` to `adapters/<axis>/<name>/`, where `<name>` is lower case words joined by hyphens, and set `name` in the
   manifest to it (the folder and the manifest must agree). Every file carries `TODO` markers; the suite fails until each one is replaced.
2. **Fill the manifest**, one role at a time, from the contract of the axis. A role of kind *required* or *logic* must be filled; an *optional* one may be left out
   only with the fallback its row names; a *logic-optional* one is a module that is needed only in some projects. A logic role names a `module` of the adapter and an
   `export`, a function with the signature the contract gives. List the rules the adapter holds and at which moment in `enforces` (*early*, *local* or *remote*): the
   core rows of the rule-to-check map are generated from them.
3. **Write the logic modules** as pure functions with `node --test` tests next to them, like the presets. A module that talks to a tool takes the tool as a seam
   (`cli` for a host's command line) so that a test, and the suite, can pass a stand-in.
4. **Write the samples** in `conformance.json` (below) and, for a runtime, record the event samples.
5. **Write the adapter's documents** from the skeleton's README: the section of the stack file, the commands and the terms. `terms` are the adapter's own words
   (tool and language names, a pattern of regular expression); the CORE scan joins them with the term lists of the profile file, so core text never names them.
6. **Run the suite**:

   ```sh
   node harness/tools/harness.mjs adapter test adapters/<axis>/<name>
   ```

   (`--only <pattern>` runs the checks whose name matches.) It prints one line per check and exits 1 if any fails.
7. **Record it.** List the adapter in `framework.json` (`adapters`), add a changelog line, add the preset to the framework README, and add the suite run on it to
   `tests/conformance/`. A preset must pass the suite in the framework's tests.

The tools load the adapters that the framework tree holds. A project that cannot wait for a release can develop the adapter in a checkout of the framework and
offer it upstream; selecting an adapter that lives in the project's own repository is not built yet.

## What the suite checks

Every adapter:

- the manifest matches the schema and the contract of its axis, every file and module a role names exists, and the folder carries the adapter's name;
- every logic role exports the function its manifest names;
- every program in the manifest's `defaults.commands` exists on this machine (`<program> --version` or `--help` exits 0);
- `conformance.json` is there;
- **a fixture project bootstrapped with the adapter** (the other axes filled by the presets) **passes `harness check all`**: its scaffolded files, its profile file,
  its generated rule map and its CI workflow agree with the checks.

A **stack** adapter, judged through the framework's gate driver and coverage gate:

- a push of only Markdown plans no code check;
- a push of a source file plans the tests of its package and holds the changed file to the coverage gate (`harness coverage check-changed`);
- a push of one package's file plans nothing for another package;
- with a second stack in the project, each file goes to the plan of the stack that owns it;
- the formatter formats each declared file type and returns null for the others, and its command runs from the project's installation: a command that may
  download a formatter (`npx` without `--no-install`, `dlx`, `uvx`, `pipx`, `bunx`) fails;
- `coverage-merge`: shards of raw coverage become a neutral summary (`total` and one entry per file, keyed by absolute path, with a subset of `statements`,
  `branches`, `functions`, `lines`, each `{ total, covered, pct }`) that the gate reads;
- the CI jobs are keys of the workflow's jobs, each needs `changes`, and each coverage package keeps its coverage as the artifact `coverage-<package>-1-of-1`;
- the scaffolded files are paths inside the project outside `harness/`, and the ignore files exclude the vendored framework (a line `harness/`, or the line the manifest's `pattern` for that file describes).

A **runtime** adapter, with the framework's hooks fed the recorded samples through `io.mjs`:

- the six samples exist; `guard-shell` refuses the push to the production branch (exit 2 with a reason) and lets `ls` through; `guard-edit` refuses the write of an
  environment file and lets a source file through; `session-start` and `format-edited` exit 0;
- the hook configuration for the profile is JSON; the packaging of a procedure carries its name, trigger and steps, ends with a newline, and is the same on every run;
- the scaffolded files are paths inside the project.

A **host** adapter, with a stand-in command line:

- `protect` sends the production and integration branch and every required check, accepts a second run, and when `host.protection` and the host disagree it only
  asks the host and changes nothing; `detectProtection` answers `{ available, reason }`;
- the scaffolded workflows trigger on both protected branches and have a job named as each required check (read back by the adapter's own readers);
- `isMerge` recognises the merge command and not another.

What the suite does not do: it never runs the stack's tools (a test runner, a formatter), never calls the host, and never starts the runtime. It checks the
adapter's logic and its files. A stack's tools are exercised by the first real run of the project's CI, and the event samples of a runtime should be recorded in a real session of it.

## What a stack learns the hard way

The second stack preset (a language whose test tool writes no coverage summary of the common shape) was written by following these steps; where the steps did not say enough, this is what they now say.

- **The tool writes no neutral summary.** Some test tools write the summary themselves; others write only their own report. Such a stack names the report file as `SHARD_FILE`, fills `coverage-merge`, and ends
  the test step of its gate plan with `harness coverage summarize --skip-missing <package>`, which turns the report of the run into the summary with the same `merge`. CI uploads the report as the shard, and
  the aggregator merges it. `merge` gets `{ root, pkg }` as its second argument, because a report that names files relative to where the tool ran needs both to give the absolute paths.
- **A package's tests may not be followable from a changed file.** Then the plan runs the whole suite of each touched package and holds only the changed files to the gate (the gate of the package is CI's).
- **The harness tools run on Node, whatever the stack.** The host's workflow sets Node up from `.nvmrc`, so every stack's `scaffold-files` names `.nvmrc` **as a list of lines** (`lines: ['22']`); a file
  that two stacks write as text would fail the bootstrap of a project that uses both. The stack's CI jobs set Node up too, because the project's documentation check is a Node command.
- **The tool excludes paths with a setting, not a pattern per line** (a key in a TOML file). Give the `ignore-files` entry a `pattern` (a regular expression with `<folder>`) and an `example` line; the scaffold
  check and the suite use them in place of the line `harness/`. Keep the setting on one line, as the pattern reads lines.
- **The version is not in a JSON file.** The release tool reads and writes the `version` of the `[project]` table of a TOML file; a stack whose lock file records the version names `release.lockCommand` in its
  `defaults`.
- **A lock file cannot be written by hand.** If the tools of the development group need a resolver, the scaffold writes no lock and says to create it once: the manifest's `firstSteps` (a list of sentences)
  are printed in the next steps of the bootstrap and written into the stack file; the CI install command is the locked one, so the first pull request of a new project must commit it.
- **A new project must be green, apart from what `firstSteps` names.** The scaffold writes a first typed module and its test in each package (at the root when the project has none), because a type checker that
  finds no source file fails, and the lock needs the project file of every workspace member.
- **The commands of the defaults must exist on the machine.** The suite runs `<program> --version` for every command of `defaults.commands`, so the framework's own CI sets up the programs of every preset.

## `conformance.json`

The samples that the suite cannot derive. Its fields per axis:

| Axis | Field | The sample |
| ---- | ----- | ---------- |
| stack | `sourceFile` | a source file of a package, relative to the package (`src/main.ts`) |
| stack | `format.handled`, `format.ignored` | files the formatter formats, and files it leaves alone |
| stack | `coverage.shards` | for `coverage-merge`: the raw coverage of two or more shards of one package, relative to the adapter |
| runtime | `events` | the folder of the recorded samples, relative to the adapter (`events`) |
| runtime | `samples` | the file of each event: `sessionStart`, `shellRefused` (a push to the production branch), `shellAllowed` (`ls -la`), `editRefused` (a write of `.env`), `editAllowed` (an edit of a source file), `editAfter` (the event after an edit) |
| host | `mergeCommand`, `otherCommand` | the words of a command that merges a pull request, and of one that does not |

A runtime whose event form `io.mjs` does not know needs `io.mjs` extended in the framework source, with a test; offer that upstream too.
