---
name: release
description: Use when cutting a release or a hotfix.
invocation: explicit
---

# Cut a release or a hotfix

The steps and the checks of a release are in the [releasing guide]({{rel:documents.releasing}}). In short:

1. Branch the release or the hotfix from the branch the profile names (branches section).
2. The release branch takes fixes only. Run `{{commands.docsCheck}}`, `{{commands.lint}}` and `{{commands.testCoverage}}`.
3. **Tag a development version first.** `harness release --dev` sets the next version `<x.y.z>-dev.<n>` (the versions only; the changelog and its fragments stay); commit it and tag the commit `<x.y.z>-dev.<n>`, with no `v` (a tag that starts with `v` is a release and publishes one). A project that uses the framework syncs that tag and runs its checks, the scan of the core with its own terms included, before the final tag exists. A fix goes on the release branch and gets the next development version. Then prepare the final version with `harness release` (`--dry-run` first): the versions and the changelog from the fragments.
4. A release and a hotfix merge into the production branch and the integration branch by merge commit, each by a pull request, **after the owner's approval of each merge**. Tag the release on the production branch with the version.

{{#if release.migrations}}
**The migration note.** Before step 3 write `{{release.migrations}}/<x.y.z>.md` for the version: what changed for a project that takes it from the previous one, the required actions (each with the check that proves it is done), the optional actions, how to verify. A version that needs nothing says so; a change a tool can make is a migration script, not an instruction. `harness release` refuses the final version without the note, writes the areas the version touched into it, and links it from the changelog.
{{/if}}
