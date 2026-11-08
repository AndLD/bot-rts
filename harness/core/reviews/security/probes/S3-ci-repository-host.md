[← Probes](./README.md)

# S3 — CI and the repository host: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

### S3-001 — Every workflow declares minimal token permissions

- **Dimension:** S3
- **Checks:** Does every CI definition declare its token's permissions, read-only at the top, with write granted only to the job that uses it?
- **Why:** A compromised step or dependency uses a broadly privileged job token to push code, alter releases or edit workflows.
- **Evidence:** `file` (each CI definition); `command` (a linter of CI definitions)
- **Severity:** 🟠; 🔴 for a write scope at the top of a workflow that runs untrusted code; 🟡 when only read scopes are broader than needed.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); SCORECARD Token-Permissions (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-5 (verified 2026-11-08)

### S3-002 — The default permission of a job token is read-only

- **Dimension:** S3
- **Checks:** Is the repository's (and the organisation's) default for the job token set to read-only?
- **Why:** A new or forgotten workflow with no declaration inherits write access, and one injected command abuses it.
- **Evidence:** `command` (the setting, through the host adapter; the default is inspected and never assumed)
- **Severity:** 🟡; 🟠 when workflows lack their own declaration, so the default is the only guard.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); HOST-DOCS secure use of workflows (verified 2026-11-08)

### S3-003 — The CI cannot approve its own pull requests

- **Dimension:** S3
- **Checks:** Is the setting that lets workflows create or approve pull requests off, unless a workflow truly needs it and says so?
- **Why:** A compromised workflow opens and approves its own pull request, defeating the review.
- **Evidence:** `command` (the setting, through the host adapter)
- **Severity:** 🟠; 🔵 when the branch rules also require a human approval.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); SCORECARD Code-Review (verified 2026-11-08)

### S3-004 — No privileged run touches code from a fork

- **Dimension:** S3
- **Checks:** Is there no workflow that runs with the base repository's secrets or write token, on a pull request from a fork, and also checks out, builds or runs the fork's code or artifacts?
- **Why:** An outsider opens a pull request whose code runs in the privileged context and sends out the secrets or pushes to the repository.
- **Evidence:** `file` (the triggers that run in the base context, then any checkout of the head or use of its artifacts); `command` (a scanner of CI definitions)
- **Severity:** 🔴; 🔵 when the privileged trigger exists and never touches the fork's content.
- **Applies:** project: ci
- **Decided by:** judged
- **Sources:** HOST-DOCS secure use of workflows (verified 2026-11-08); SCORECARD Dangerous-Workflow (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-4 (verified 2026-11-08)

### S3-005 — Untrusted text is never spliced into a script

- **Dimension:** S3
- **Checks:** Is text an outsider controls (titles, branch names, comment bodies, commit messages) kept out of the body of shell and script steps, and passed through a variable or an input?
- **Why:** A crafted pull request title becomes shell commands inside a job that holds secrets.
- **Evidence:** `file` (the script steps, for expressions over event fields); `command` (a scanner of CI definitions)
- **Severity:** 🔴 when the job has secrets or a write token; 🟠 otherwise.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); HOST-DOCS secure use of workflows (verified 2026-11-08); SCORECARD Dangerous-Workflow (verified 2026-11-08)

### S3-006 — Runs from outside contributors wait for a maintainer

- **Dimension:** S3
- **Checks:** Do runs from first-time or outside contributors need a maintainer's approval before CI starts, and are they kept away from secrets?
- **Why:** A drive-by pull request edits the CI definition or a test, and the pipeline runs it unreviewed.
- **Evidence:** `command` (the setting, through the host adapter; the default is inspected and never assumed); `judgment` (secrets are not exposed to such runs, confirmed by a test)
- **Severity:** 🟠; 🟡 for a private repository with trusted members.
- **Applies:** project: outside-contributions
- **Decided by:** manual
- **Sources:** HOST-DOCS approving runs from forks (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-4 (verified 2026-11-08); OWASP-CICD pipeline and execution environment (verified 2026-11-08)

### S3-007 — Integrations of the host are inventoried and justified

- **Dimension:** S3
- **Checks:** Is there a reviewed list of the third-party actions, installed apps, tokens, webhooks and deploy keys, with what each may do and why it exists?
- **Why:** An unvetted integration holds broad access and is compromised, or a forgotten one is never removed.
- **Evidence:** `command` (the host's lists, through the host adapter); `judgment` (each entry has a reason and an owner)
- **Severity:** 🟠; 🟡 for read-only integrations.
- **Applies:** every project
- **Decided by:** manual
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-8 (verified 2026-11-08); OWASP-CICD plug-in and integration management (verified 2026-11-08)

### S3-008 — The default and release branches reject direct change

- **Dimension:** S3
- **Checks:** Do the default and release branches reject direct pushes, force-pushes and deletion for everyone, with any bypass named and justified?
- **Why:** A stolen maintainer credential rewrites the history or pushes straight to the release branch.
- **Evidence:** `command` (the rules of each protected reference, through the host adapter)
- **Severity:** 🔴 for a default or release branch with no protection; 🟠 for a bypass with no need.
- **Applies:** every project
- **Decided by:** scriptable
- **Sources:** HOST-DOCS rulesets (verified 2026-11-08); SCORECARD Branch-Protection (verified 2026-11-08); SLSA Source requirements (verified 2026-11-08); OWASP-CICD secure SCM configuration (verified 2026-11-08); NIST-SSDF PS.1.1 (verified 2026-11-08)

### S3-009 — The required checks are real and cannot be skipped

- **Dimension:** S3
- **Checks:** Is merging gated by required checks that each come from a job that reports on every pull request, with no required job that a filter or a condition can skip?
- **Why:** A change merges with a check that never really ran: a job skipped by a condition reports success, and a skipped workflow leaves the gate stuck until someone loosens it.
- **Evidence:** `command` (compare the host's list of required checks with the jobs that run on every pull request); `file` (triggers and path filters)
- **Severity:** 🟠; 🟡 when a review also stands behind it.
- **Applies:** project: ci
- **Decided by:** judged
- **Sources:** HOST-DOCS rulesets (verified 2026-11-08); HOST-DOCS required checks (verified 2026-11-08); SCORECARD Branch-Protection (verified 2026-11-08)

### S3-010 — Each change needs someone other than its author

- **Dimension:** S3
- **Checks:** Does every change to a protected branch need an approval by someone other than its author and last pusher, with stale approvals dismissed; or, for a solo project, is the exception written down with what compensates for it?
- **Why:** One compromised or careless account lands malicious code alone, or an approved pull request is changed after approval.
- **Evidence:** `command` (the review rules, through the host adapter); `judgment` (the solo exception and its compensating control; an approval by a bot or an agent is not a second person)
- **Severity:** 🟠; 🔵 for a solo maintainer with a written exception; 🔴 for a project others depend on, with no second person and no compensating control.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** HOST-DOCS rulesets (verified 2026-11-08); SLSA Source requirements (verified 2026-11-08); SCORECARD Code-Review (verified 2026-11-08); OWASP-CICD secure SCM configuration (verified 2026-11-08)

### S3-011 — The CI definitions and review rules have named owners

- **Dimension:** S3
- **Checks:** Are changes to the CI definitions, release scripts and review rules, and to the scripts the CI calls, owned by named people whose review is required?
- **Why:** A contributor with write access edits a workflow, or a script that it calls, in a pull request that a reviewer skims, and gains the pipeline.
- **Evidence:** `file` (the ownership file covers those paths); `command` (the rule that requires the owners' review)
- **Severity:** 🟠; 🟡 for a solo project.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-4 (verified 2026-11-08); OWASP-CICD pipeline and execution environment (verified 2026-11-08)

### S3-012 — Auto-merge is narrow

- **Dimension:** S3
- **Checks:** Is auto-merge, a merge queue or a merging bot limited to the same required checks and reviews, and unable to reach the production branch without the human decision the project documents?
- **Why:** An auto-merge rule accepts a pull request that skipped review, because of a label, an author or a weak condition.
- **Evidence:** `file` (the definitions of auto-merge and of bots); `command` (the setting, and who may enable it); `judgment` (the scope is minimal)
- **Severity:** 🟠; 🟡 when limited to automated dependency updates with checks.
- **Applies:** project: auto-merge
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-1 (verified 2026-11-08); OWASP-CICD secure SCM configuration (verified 2026-11-08)

### S3-013 — Release tags and assets cannot be changed after publication

- **Dimension:** S3
- **Checks:** Are release tags and published assets protected against being moved, deleted or replaced?
- **Why:** A version tag is re-pointed or a release file swapped, so users pull different code under the same version.
- **Evidence:** `command` (the tag rules and the setting for immutable releases, through the host adapter)
- **Severity:** 🟠; 🟡 when consumers pin by hash and verify.
- **Applies:** project: releases
- **Decided by:** scriptable
- **Sources:** HOST-DOCS immutable releases (verified 2026-11-08); HOST-DOCS rulesets (verified 2026-11-08); SLSA Source requirements (verified 2026-11-08)

### S3-014 — A release needs an authorised person and a protected reference

- **Dimension:** S3
- **Checks:** Is the publish or deploy job bound to a gate that restricts who may approve it and from which references it may run?
- **Why:** Anyone with write access, or a compromised branch, runs the publish job with the release credentials.
- **Evidence:** `command` (the gated environments, through the host adapter); `file` (the release definition uses the gate); `judgment` (who counts as authorised)
- **Severity:** 🟠; 🔴 when the release credentials are secrets reachable from any branch.
- **Applies:** project: releases
- **Decided by:** judged
- **Sources:** HOST-DOCS environments (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-1 (verified 2026-11-08); OWASP-CICD pipeline and execution environment (verified 2026-11-08)

### S3-015 — The CI's credentials are short-lived

- **Dimension:** S3
- **Checks:** Are the credentials that the CI uses to publish or deploy short-lived and identity-based, and any stored secret scoped to one pipeline, rotated and owned?
- **Why:** A leaked static publish token works forever and from anywhere.
- **Evidence:** `file` (the identity exchange or the stored key in the release definition); `command` (the list of secrets with their ages and scopes); `judgment` (each long-lived secret is justified)
- **Severity:** 🟠; 🔴 for a long-lived token that writes to the production registry.
- **Applies:** project: ci
- **Decided by:** judged
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-6 (verified 2026-11-08); OWASP-CICD secrets management (verified 2026-11-08); OWASP-SECRETS §2.4, §3.5 (verified 2026-11-08)

### S3-016 — Tokens of people and machines are narrow and expire

- **Dimension:** S3
- **Checks:** Are the tokens used by the CI and by maintainers limited to the repository, minimal in permission and expiring, with automation using an application identity or the job token rather than a person's token?
- **Why:** A leaked broad token gives an attacker every repository its owner can reach, and works after the owner leaves.
- **Evidence:** `command` (the scopes and the expiry of the token in use, read through the host adapter: run it first and quote it; and the tokens and keys that can be listed); `judgment` (no broad or non-expiring token backs automation, or each is justified and owned)
- **Severity:** 🟠; 🔴 when an administrator's token is stored in the CI.
- **Applies:** every project
- **Decided by:** manual
- **Sources:** HOST-DOCS tokens (verified 2026-11-08); OWASP-CICD identity lifecycle management (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-6 (verified 2026-11-08)

### S3-017 — Self-hosted runners are not reachable by untrusted runs

- **Dimension:** S3
- **Checks:** Do untrusted triggers reach only single-use, isolated runners, with no self-hosted runner that holds standing data or cloud access serving them?
- **Why:** A pull request runs code on a persistent runner, plants a backdoor and reads the secrets of later jobs.
- **Evidence:** `command` (the list of runners and groups, through the host adapter); `file` (the runner labels of the CI definitions); `judgment` (isolation)
- **Severity:** 🔴 for a self-hosted runner serving untrusted pull requests; 🟡 otherwise.
- **Applies:** project: self-hosted-runners
- **Decided by:** judged
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); SLSA Build requirements (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-5 (verified 2026-11-08)

### S3-018 — A release cannot restore a poisoned cache

- **Dimension:** S3
- **Checks:** Do release builds run from a clean environment, using no cache that a run from an untrusted trigger could have written?
- **Why:** A pull request job writes a bad dependency cache that the release job restores and ships.
- **Evidence:** `file` (cache keys and scopes in the CI definitions); `judgment` (release builds use no shared cache, or only caches from protected references)
- **Severity:** 🟠; 🟡 when a hash-verified install follows the restore.
- **Applies:** project: ci, releases
- **Decided by:** judged
- **Sources:** SLSA Build requirements (verified 2026-11-08); HOST-DOCS secure use of workflows (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-5 (verified 2026-11-08)

### S3-019 — Accounts with write access are few, strong and reviewed

- **Dimension:** S3
- **Checks:** Does each identity with write access or more have an owner and strong authentication, with access reviewed at a stated interval and unused accounts and deploy keys removed?
- **Why:** An old collaborator's account or a forgotten deploy key is hijacked and writes to the repository.
- **Evidence:** `command` (collaborators, roles and deploy keys, through the host adapter); `judgment` (the last review is recorded)
- **Severity:** 🟠; 🔴 when administrator access is held by unknown or shared accounts.
- **Applies:** every project
- **Decided by:** manual
- **Sources:** OWASP-CICD secure SCM configuration (verified 2026-11-08); OWASP-CICD identity lifecycle management (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-1 (verified 2026-11-08); SLSA Source requirements (verified 2026-11-08); NIST-SSDF PO.5.1 (verified 2026-11-08)

### S3-020 — The project says where to report a vulnerability

- **Dimension:** S3
- **Checks:** Is there a place, easy to find, that says how to report a vulnerability privately, with who answers it and how a report is handled?
- **Why:** A researcher who finds a hole has nowhere private to send it, and opens a public issue or says nothing.
- **Evidence:** `file` (the security policy of the repository); `judgment` (it names a private channel, and someone reads it)
- **Severity:** 🟡; 🟠 for a project others depend on.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** NIST-SSDF RV.1.3 (verified 2026-11-08); SCORECARD Security-Policy (verified 2026-11-08)

### S3-021 — Changes to rules, secrets and tokens leave a trail

- **Dimension:** S3
- **Checks:** Are the audit logs of the host and the CI kept for a defined period, and are changes to secrets, rules, runners, workflows and tokens watched?
- **Why:** A rule is loosened or a secret read, and nobody can tell afterwards who did it or when.
- **Evidence:** `judgment` (who can read the audit log, what is watched, and the limits of the host's plan are stated)
- **Severity:** 🟡; 🟠 for a project whose releases others consume.
- **Applies:** every project
- **Decided by:** manual
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); OWASP-CICD visibility and monitoring (verified 2026-11-08)

### S3-022 — Drift of the host's configuration is noticed

- **Dimension:** S3
- **Checks:** Does a scan of the repository's host and CI configuration run on a schedule, with its findings tracked until fixed or accepted?
- **Why:** A rule or setting grows weaker over time and no one notices.
- **Evidence:** `file` (the scheduled scan or its service); `judgment` (the findings have owners)
- **Severity:** 🔵.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** SCORECARD (verified 2026-11-08); OWASP-CICD secure SCM configuration (verified 2026-11-08); HOST-DOCS hardening of CI (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| HOST-DOCS | The security documentation of the project's repository host | as listed by the adapter | `security.md` in the folder of the project's host adapter |
| NIST-SSDF | NIST SP 800-218, Secure Software Development Framework | version 1.1, February 2022 (final); revision 1 (version 1.2) is an initial public draft of 2025-12-17, and its changes to the practices cited were read | https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf |
| OWASP-CICD | OWASP CI/CD Security Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html |
| OWASP-CICD-TOP10 | OWASP Top 10 CI/CD Security Risks | the 2022 list; the risks CICD-SEC-1, 3, 4, 5, 6, 8 and 9 were read | https://owasp.org/www-project-top-10-ci-cd-security-risks/ |
| OWASP-SECRETS | OWASP Secrets Management Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html |
| SCORECARD | OpenSSF Scorecard checks | the checks as published on the date of verification | https://scorecard.dev/ |
| SLSA | SLSA specification | version 1.2 (build requirements, source requirements, verifying artifacts) | https://slsa.dev/spec/v1.2/ |
