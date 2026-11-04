---
name: release
description: Use when cutting a release or a hotfix.
invocation: explicit
---

# Cut a release or a hotfix

The steps and the checks of a release are in the [releasing guide]({{rel:documents.releasing}}). In short:

1. Branch the release or the hotfix from the branch the profile names (branches section).
2. The release branch takes fixes only. Run `{{commands.docsCheck}}`, `{{commands.lint}}` and `{{commands.testCoverage}}`.
3. **Tag a development version first**, with its migration note. `harness release --dev` sets the next version `<x.y.z>-dev.<n>` (the versions only; the changelog and its fragments stay); commit it and tag the commit `<x.y.z>-dev.<n>`, with no `v` (a tag that starts with `v` is a release and publishes one). A project that uses the framework syncs that tag and runs its checks, the scan of the core with its own terms included, before the final tag exists. A fix goes on the release branch and gets the next development version. Then prepare the final version with `harness release` (`--dry-run` first): the versions and the changelog from the fragments.
4. A release and a hotfix merge into the production branch and the integration branch by merge commit, each by a pull request, **after the owner's approval of each merge**. Tag the release on the production branch with the version.

{{#if release.migrations}}
**The migration note.** Every version has one, a development version included: before each cut (step 3 for a development version, and the final cut) write `{{release.migrations}}/<version>.md` for the version about to be cut. The agent that prepares the release writes it, and the owner reviews it with the cut. It says what changed for a project that takes the version from the previous one, the required actions (each with the check that proves it is done), the optional actions, how to verify. A development note (`<x.y.z>-dev.<n>`) is written against the previous development version of the same `x.y.z`, or the previous final version for the first, and is frozen once the version ships; the final note is the complete story from the previous final version. A version that needs nothing says so; a change a tool can make is a migration script (named for the final version), not an instruction. `harness release`, with or without `--dev`, refuses a version without its note and writes a stub with the changelog fragments and the areas when it is missing; a `TODO` left in the required actions stops the release. It writes the areas the version touched into the note, and links a final note from the changelog.
{{/if}}
