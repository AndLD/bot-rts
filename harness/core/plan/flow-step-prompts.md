[← Plan method](./README.md)

# Step prompts of a flow

The standard wording that `harness flow prompt <n> <step>` renders for the worker of a step: the header, the text of the step's kind, the Git wording, where to stop and
the step report, each written once here. The tool reads this file by the headings of its sections (`header`, `tasks`, `cut`, `consumer-take`, `triage-fix`,
`decision`, `external`, `git`, `stop`, `report`) and fills the words in braces from the flow, the step and the profile; a line whose word has no value is left out. A `custom` step
has no section of its own: its prompt is the section `## Step <#>` of the flow file, and it still gets the sections `stop` and `report`. Change the wording here, in one
place, and every flow takes it.

## header

You are the worker of step {step} of flow {flow}, "{title}" (the plan's flows folder, file {file}).
Kind: {kind}
Repository: {repo} ({repoPath})
Model: {model}
Scope: {scope}
Read {entryFile} first: its rules bind you.
You do this step and no other, and you start no phase, task or issue that the scope does not name.

## external

This step runs in the repository "{repo}" ({remote}), which is not the flow's home repository. Read that repository's own entry file first: its rules and its approvals bind you here, and
what it keeps for its owner stays the owner's. The orchestrator of the flow edits nothing there and decides nothing for that repository. Name the work in your report by what it did ("took
the version"), the pull requests it opened and their state, never by the task ids of that repository's plan, and write nothing of the home repository's plan into it.

## tasks

Build these tasks and issues, in this order. Do the first one that is not done; a done one is only a prerequisite.
{idList}
Follow the procedure `start-task` for each, and finish each by its definition of done.

## cut

Prepare the cut of the version {version} by the procedure `release`: the release branch, the versions and the changelog, and the migration note of the version, complete (a note
that says TODO stops the release). Open the release pull request into the production branch.
Do not merge a release pull request into the production branch and do not tag: the orchestrator of the flow does that at its level, or the owner (the procedure `release`, "When a flow cuts").
In your report, list what the version changes for a project, from the changelog fragments, so that the orchestrator can check the note against it.

## consumer-take

Take the version {version} in the repository of this step (the one in the header, the home repository when there is none): the procedure `update-framework`, from the lock's version to {version}. Read the migration notes of every
version in between, do the required actions of each and prove each with its check, run the repository's checks and its gate, and open the pull request.
In your report, list what the notes missed.

## triage-fix

Triage the open reports of users by the procedure `triage-reports`, at most the number that the profile allows for a session, and then fix the issues of this step's scope.
{idList}
Creating, answering or closing a report on the host is not yours unless the flow's settings gave it to its orchestrator; ask in your report.

## decision

This step is a decision, not a build. Change no file. Write the options for the question in the scope, what each costs and what it changes for a project, and the level you
suggest for the decision (D0 to D4 of the procedure `run-flow`). Put your recommendation last, under the heading "Recommendations", so that the orchestrator can write its own pick before it reads yours.

## git

Git rules for this step, from {entryFile}:
- Claim each task before you work on it: push its branch from the integration branch ({integration}) as it is on the remote, with an empty commit, and open a draft pull request for it.
- A task that needs the previous one branches from its branch (one level, no deeper) while that pull request is open; after its squash merge, retarget the pull request to {integration} and run `harness branch update`.
- When a task's definition of done holds, enable the host's auto-merge (squash) on its pull request, check after every push that it is still on, and merge a green pull request that is still open yourself.
- Never touch {production} except through a release pull request, never force-push, never delete a remote branch, never use an administrator's bypass.

## stop

Stop when this step is done, or earlier if you are blocked or a decision is needed that the plan and the rules do not settle: say so in your report and do not guess. Do not start the next step.

## report

End with a step report, in this order:
- Status: done, partial or blocked.
- The pull requests merged, and the ids done.
- Open decisions, each with its options and the level you suggest (D0 to D4).
- Deviations from the scope, and reports filed.
- The next step.
- Recommendations, last and under a heading of their own, each with why: the orchestrator reads them after it has made its own pick.
