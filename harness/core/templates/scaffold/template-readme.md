# A new project on harness-framework {{version}}

This repository was made from the template of harness-framework. Bootstrap it before any other work, in one of two ways:

- run `node harness/tools/harness.mjs init` and answer its questions; or
- ask your coding agent to follow `BOOTSTRAP.md`.

The bootstrap fills `harness-profile.json`, writes the project's files (the entry file, the profile document, the plan, the CI workflows),
commits them as the first commit of the integration branch, makes the production branch and installs the Git hooks. It replaces this README
and removes `BOOTSTRAP.md`.
