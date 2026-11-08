# Security notes of the host adapter: GitHub

For the security review ([the method](../../../core/reviews/security/README.md), [the catalogue](../../../core/reviews/security/probes/README.md)): what the source id `HOST-DOCS` of a probe stands for on this host, and the name of the feature for each probe. Read on 2026-11-08.

## The pages behind `HOST-DOCS`

| Cited as | Page | Address |
| -------- | ---- | ------- |
| secret scanning | About secret scanning | https://docs.github.com/en/code-security/secret-scanning/introduction/about-secret-scanning |
| push protection | About push protection | https://docs.github.com/en/code-security/secret-scanning/introduction/about-push-protection |
| removing sensitive data | Removing sensitive data from a repository | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository |
| hardening of CI | Security hardening for GitHub Actions | https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions |
| secure use of workflows | Secure use reference | https://docs.github.com/en/actions/reference/security/secure-use |
| approving runs from forks | Approving workflow runs from forks | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/approve-runs-from-forks |
| required checks | Troubleshooting required status checks | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/troubleshooting-required-status-checks |
| rulesets | About rulesets; Available rules for rulesets | https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets |
| immutable releases | Immutable releases | https://docs.github.com/en/code-security/concepts/supply-chain-security/immutable-releases |
| environments | Deployments and environments | https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments |
| tokens | Managing your personal access tokens | https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens |
| artifact attestations | Artifact attestations | https://docs.github.com/en/actions/concepts/security/artifact-attestations |

The addresses of "hardening of CI" and "secure use of workflows" led to one page on the date read. The defaults for the secrets of runs from forks and for the permission of the job token were not found in the pages read, so the probes inspect the setting and assume nothing.

## The feature for each probe

| Probe | The feature of this host |
| ----- | ---- |
| S1-004 | secret scanning over the history and all branches |
| S1-005 | removing sensitive data: rotate first |
| S1-006 | removing sensitive data: pull request references, forks and the support request |
| S1-007 | push protection |
| S1-008 | push protection bypass, delegated bypass, secret scanning alerts |
| S1-009 | custom patterns, generic patterns |
| S1-011 | masking limits of the logs of workflows |
| S1-019 | removing unused secrets |
| S1-021 | secret scanning alerts, validity checks |
| S2-004 | pinning actions to a full commit |
| S2-009 | dependency update and dependency review features |
| S2-019 | artifact attestations |
| S2-020 | attestations from an isolated shared workflow |
| S3-001 | the permissions key of a workflow |
| S3-002 | the setting of workflow permissions |
| S3-003 | allowing workflows to create and approve pull requests |
| S3-004 | the triggers pull_request_target and workflow_run |
| S3-005 | expression injection in workflows |
| S3-006 | approval for running workflows from forks |
| S3-007 | installed apps, webhooks, deploy keys |
| S3-008 | repository rulesets, branch protection rules, bypass lists |
| S3-009 | required status checks, their expected source, the up-to-date rule |
| S3-010 | pull request rules, approval of the most recent push, dismissal of stale approvals |
| S3-011 | the code owners file and its review rule |
| S3-012 | auto-merge, merge queue |
| S3-013 | tag rulesets, immutable releases |
| S3-014 | environments with required reviewers, deployment branch rules, prevention of self-review |
| S3-015 | workload identity for workflows, secrets by environment |
| S3-016 | fine-grained personal access tokens, apps, the policy on classic tokens |
| S3-017 | self-hosted runners, runner groups |
| S3-018 | the scope of the workflow cache by reference |
| S3-019 | the organisation's two-factor requirement, repository roles, deploy keys |
| S3-021 | audit log, security log |
| S3-022 | a scheduled scorecard run, code scanning |
