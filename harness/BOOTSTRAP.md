# Bootstrap a project with harness-framework

A prompt for any coding agent. Follow it in the root of the project's repository, in which the framework is at `harness/` (a template
repository) or at a folder or a Git URL that the user gives you. It uses only reading files, writing a file and running commands.

1. **Read the roles.** Read `harness/profile/roles.md` (the profile document's template: what each role means) and the questions of
   `harness/tools/lib/bootstrap.mjs` (`QUESTIONS`: the roles the bootstrap asks, in order, and which are required). The adapters the framework
   has are the folders of `harness/adapters/<axis>/` that hold a `manifest.json`; each manifest's `description` says what it is for.
   When the framework is elsewhere, read the same paths there.
2. **Ask the user once.** In one message, ask for every question: the required ones (the project name, the repository on its host as
   `owner/name`, the stack adapters) and the others with their defaults, so the user can accept them all at once. Ask also whether the project
   wants to own its copy of the framework (detached) instead of taking new versions (pinned, the default).
3. **Write the answers** into `harness-profile.json` at the root: the roles at their dotted paths (`project.name`, `repository.slug`,
   `adapters.stacks` as a list, `adapters.runtimes` as a list, `adapters.host`, `branches.production`, `branches.integration`, and the coverage
   gate as `coverageGate` with the same number for `statements`, `branches`, `functions` and `lines`). Leave out what the user did not answer;
   the bootstrap fills the defaults. Write nothing else.
4. **Run the bootstrap:** `node harness/tools/harness.mjs bootstrap --non-interactive`, adding `--detached` if the user chose it, and
   `--from <folder or Git URL>` (with `--to <version>` for a Git URL) when the framework is not at `harness/`. If it fails and lists missing
   roles or invalid values, ask the user for those only, correct the file and run it again.
5. **Check:** `node harness/tools/harness.mjs check all` must pass; the bootstrap ran it once already, so this confirms the state.
6. **Report** what was written (the bootstrap prints it: the profile, the scaffolded files, the vendored framework, the commits and branches,
   the Git hooks) and the steps that are the user's, which the bootstrap prints last: the first push of both branches, the protection of the
   branches on the host (`node harness/tools/harness.mjs host protect`), and turning on the settings of the agent runtime. Do not push, and do
   not protect the branches yourself.
