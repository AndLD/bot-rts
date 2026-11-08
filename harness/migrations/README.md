[← README](../README.md)

# Migration notes

One note for every version of the framework from `0.1.1` on, **a development version included**: `migrations/<version>.md` (`0.2.0.md`, `0.2.0-dev.1.md`) says what a project that takes the version **from the previous one** must do. A project that skips versions reads the notes from its own version to the target, in order ([taking a version](../README.md#taking-a-version)).

## Development versions

A development version (`<x.y.z>-dev.<n>`, tagged before the final version) has a note of its own, written against the **previous development version of the same `x.y.z`**, or against the previous final version for the first, so a project that follows the development versions does each step once. A development note is **frozen once the version ships**: a project that followed it never finds it changed; what the next development version adds goes into the next development note. The **final note** `<x.y.z>.md` stays the complete story from the previous final version, so it restates what the development notes said. The scripts stay named for the final version (below).

`harness migrate` prints the notes of the versions after the project's own up to the target, except that the development notes of an `x.y.z` are left out when its final note is among them (the final one covers them). So `0.1.2` to `0.2.0-dev.1` reads `0.2.0-dev.1`; then `dev.1` to `dev.2` reads `dev.2`; then `dev.2` to `0.2.0` reads `0.2.0`; and a jump from `0.1.2` to `0.2.0` reads `0.2.0` only. When the target is a development version and the tree holds the final note of its `x.y.z`, `migrate` prints that note last as well, marked as not yet taken. `harness probes` selects the areas the same way.

**Who writes it, and when.** The agent that prepares a release writes the note of the version before the owner cuts it, from the changelog fragments and the diff since the previous release; the owner reviews it with the cut. `harness release` (with or without `--dev`) refuses a version without its note. When it is missing, the command writes a **stub** (the changelog fragments added since the previous release as the raw material of "What changed for a project", the areas, and a `TODO` in the required actions) and stops; the author completes it and commits it. A `TODO` left in the required actions stops the release.

A note holds what needs judgment (a project file that restates a changed rule, a choice the project makes). A change a tool can make is not written as an instruction: it is a migration script that the tool runs.

## Shape

Every note has the same title and sections, in this order (`harness release` checks them):

| Section | Holds |
| ------- | ----- |
| `# Migration to <version> from <previous version>` | the title |
| What changed for a project | the changes a project can feel, in a few lines each |
| Areas touched | written by `harness release`, between two markers, from the list below; never by hand |
| Required actions | what the project must do, each with the check that proves it is done |
| Optional actions | what it may do |
| How to verify | the commands that show the project is healthy on the new version |

A version that needs nothing from a project says so in its required actions.

**What a note says about checks and about the release table** (the gaps found in use, I-16):

- A check of a development note names the lock of the version the note is the target of (`migrations.version` is `<x.y.z>-dev.<n>`) and says it is a check of that take only: after the next development version, or the final one, the same jump leaves a different value.
- A development note that sends its reader to the final note says so by name; `harness migrate` prints the final note too when the target is a development version and the tree holds it, so a project reads it before it takes the final version.
- A note that moves the order of the releases says: a status `🏷` (a development version tagged upstream) and `⏭` are set by hand, never by a script; a release whose old cell held words and no id the tools can read gets its ids and its status by hand (the migration names it); an order of phases written as arrows that no release of the table holds stays as text in "Notes" and needs nothing more; and when a take settles the table in the same pull request as the take of a release, that release is 🟡 until the pull request merges, and ✅ once its tag is published and the pull request is merged.
- A note that deletes or moves files a project may cite says that the project's own documents that list them (the framework's copied tests among its checks, for one) must follow.

## Scripts

A version may also ship `migrations/<version>.mjs`: the mechanical changes of the version (a moved file, a renamed profile key, a split phase) as code. `harness migrate` runs, with the tools of the target version, the scripts of every version after the project's own up to the target (a development target reaches its final version's script) that the lock (`migrations.applied`) does not record, in version order, so a jump from `0.1.0` to `0.3.0` runs the scripts of every version in between. A lock without the record counts as `0.1.0` with nothing applied.

A script is `export default ({ root, profile }) => lines`, which may be async and returns the lines to print. It **checks its starting state** and does nothing when its work is done, because it can run twice (a run that stopped resumes, a lost record repeats it, and a development version runs the script of its final version, which the final version runs again). The script of a development version's final version is not recorded as applied until the final version itself. Run in the framework's own repository (mode `self`) or in a detached project, `migrate` only regenerates the managed files.

The **migration test** (`tests/migration/`) bootstraps a project from every released tag with the tools of that tag, takes the current tree with the project's own `sync`, runs `migrate` and requires `harness check all` to pass; a script that breaks a project of any earlier version fails it.

## Undoing a migration

A migration changes files across the project (the vendored copy, the entry file, the skills, the profile file, the lock, the documents), so a copy of a few folders cannot undo it; Git does. `harness sync` refuses to start on the production or the integration branch and with uncommitted changes, and records the commit and version it starts from in the lock (`migrations.start`). The migration, sync's changes included, is committed as **one commit** (`chore(framework): migrate to <version>`); what the agent changes after it is committed apart. `harness rollback` restores every file that commit changed to its content at the starting commit, and removes every file it added, and nothing else; the result stays uncommitted for review. The migration test migrates a project from each released tag, rolls back, and requires an empty diff against the starting commit.

## Areas

`areas.json` is the fixed list of areas (entry rules, Git rules, plan format, procedures, review method, adapter contract, and the others) with the globs that belong to each. `harness release` lists in a note the areas whose files changed in `core/`, `tools/`, `adapters/` and `profile/` since the tag of the previous release (for a development note: since the tag of the previous development version, or of the previous final version). A changed file that belongs to no area stops the release until the list is extended, so the list stays complete. The probes of a project are matched to the areas: each probe in its harness-review bindings names the areas it exercises, and `harness probes <from> <to>` lists the probes to run again for the versions taken, and the starting probe (`core/reviews/harness/starting-probes.md`) of each area that no probe covers.

## The notes

- [0.1.1](./0.1.1.md)
- [0.1.2](./0.1.2.md)
- [0.2.0-dev.1](./0.2.0-dev.1.md)
- [0.2.0-dev.2](./0.2.0-dev.2.md)
- [0.2.0-dev.3](./0.2.0-dev.3.md)
- [0.2.0](./0.2.0.md)
- [0.3.0-dev.1](./0.3.0-dev.1.md)
- [0.3.0-dev.2](./0.3.0-dev.2.md)
- [0.3.0-dev.3](./0.3.0-dev.3.md)
- [0.3.0](./0.3.0.md)
- [0.4.0-dev.1](./0.4.0-dev.1.md)
- [0.4.0](./0.4.0.md)
- [0.5.0-dev.1](./0.5.0-dev.1.md)
- [0.5.0](./0.5.0.md)
- [0.6.0-dev.1](./0.6.0-dev.1.md)
