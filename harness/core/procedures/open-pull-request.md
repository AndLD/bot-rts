---
name: open-pull-request
description: Use when a branch is ready and a pull request has to be opened, or a claim pull request marked ready.
invocation: auto
---

# Open a pull request

1. The checks of the definition of done pass locally: `{{commands.docsCheck}}`, `{{commands.lint}}` and `{{commands.testCoverage}}` for what the change touched. The push gate runs the ones its files need.
2. The title follows the commit format of the profile (it becomes the squash commit's message). The body says what changed and why, what was verified, what was not, and has the line `Plan: <task id>`. Do not leave a placeholder.
3. Open it as a draft first if the task is not finished; mark it ready when it is. Opening a pull request is automatic and needs no confirmation.
4. Watch the required checks with the tools of the agent runtime when it has them (attach the pull request and turn on CI monitoring with automatic fixes); without them, read the checks with the host's command before you merge. Do not poll them in a loop.
{{#if host.autoMerge}}
5. Once the definition of done holds, enable the host's auto-merge (squash) on a pull request the rules let you merge without asking (a task or plan-related pull request into the integration branch); the host merges it when the required checks pass, and you merge it yourself if it is green and still open. Never on a pull request into the production branch, a release or hotfix branch, or one that needs the owner's approval: it waits for the owner. After a push, check that auto-merge is still on. Never use the administrator bypass, never delete the branch.
{{/if}}
{{#unless host.autoMerge}}
5. Merge only as the rules allow: a pull request of a phase the owner named is merged by squash once the required checks are green; any other pull request waits for the owner. Never use the administrator bypass, never enable auto-merge unasked, never delete the branch.
{{/unless}}
