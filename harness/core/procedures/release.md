---
name: release
description: Use when cutting a release or a hotfix.
invocation: explicit
---

# Cut a release or a hotfix

The steps and the checks of a release are in the [releasing guide]({{rel:documents.releasing}}). In short:

1. Branch the release or the hotfix from the branch the profile names (branches section), and prepare it with `harness release` (`--dry-run` first): the versions and the changelog from the fragments.
2. The release branch takes fixes only. Run `{{commands.docsCheck}}`, `{{commands.lint}}` and `{{commands.testCoverage}}`.
3. A release and a hotfix merge into the production branch and the integration branch by merge commit, each by a pull request, **after the owner's approval of each merge**. Tag the release on the production branch with the version.
