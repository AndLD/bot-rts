[← Probes](./README.md)

# S2 — Dependencies and supply chain: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

### S2-001 — Every package manager has a committed lock file

- **Dimension:** S2
- **Checks:** Is a lock file (or an equivalent list of exact versions) tracked for every manifest of the project?
- **Why:** Without one, each install resolves afresh, and a newly published malicious or broken release flows in unreviewed.
- **Evidence:** `file` (a lock file beside each manifest); `command` (compare the manifests with the tracked lock files)
- **Severity:** 🟠; 🟡 for a library whose lock file its users do not consume; 🔴 when the project ships a deployable or a command-line tool.
- **Applies:** project: dependencies
- **Decided by:** scriptable
- **Sources:** SCORECARD Pinned-Dependencies (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08)

### S2-002 — CI installs strictly from the lock file

- **Dimension:** S2
- **Checks:** Do CI and release builds install from the lock file alone, and fail when the manifest and the lock file disagree?
- **Why:** A loose install rewrites the lock file during the build and pulls unreviewed versions.
- **Evidence:** `file` (the install commands of the CI definitions and of the stack adapter's roles); `judgment` (the command is the frozen form of the stack's installer)
- **Severity:** 🟠; lower when the project has no install step in CI.
- **Applies:** project: dependencies, ci
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); SCORECARD Pinned-Dependencies (verified 2026-11-08)

### S2-003 — Versions in the manifests are exact or tightly bounded

- **Dimension:** S2
- **Checks:** Are the versions in the manifests exact or tightly bounded, with no open range and no "latest"?
- **Why:** An open range lets a hijacked maintainer's new release be picked up by the next fresh resolve.
- **Evidence:** `command` (parse the manifests for wildcards, "latest" and unbounded specifiers)
- **Severity:** 🟡; 🟠 for the run-time dependencies of a published package.
- **Applies:** project: dependencies
- **Decided by:** scriptable
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); SCORECARD Pinned-Dependencies (verified 2026-11-08)

### S2-004 — CI actions and base images are pinned to an immutable reference

- **Dimension:** S2
- **Checks:** Are the CI's third-party actions, shared workflows and container base images pinned to a full commit or digest, taken from the original publisher?
- **Why:** A hijacked publisher moves a tag, and the next run executes attacker code with the pipeline's secrets.
- **Evidence:** `file` (each external reference of the CI definitions and image definitions); `command` (list the references that are not a full hash)
- **Severity:** 🟠; 🔴 where the job holds release or deploy credentials; 🔵 for actions of the host itself.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** SCORECARD Pinned-Dependencies (verified 2026-11-08); HOST-DOCS hardening of CI (verified 2026-11-08); OWASP-CICD dependency management (verified 2026-11-08)

### S2-005 — Nothing is downloaded and run unverified

- **Dimension:** S2
- **Checks:** Is every script or binary that the build, a hook or a run fetches from the network checked against a pinned hash or a signature before it runs?
- **Why:** The remote file changes, or its host is taken over, and the next run executes attacker code.
- **Evidence:** `command` (search scripts, CI definitions, hooks and image definitions for download-and-run patterns); `judgment` (each one is verified, or none exists)
- **Severity:** 🔴 when it runs in CI with secrets or on users' machines; 🟠 otherwise.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-9 (verified 2026-11-08); SCORECARD Pinned-Dependencies (verified 2026-11-08)

### S2-006 — Tools fetched at run time have a fixed version and a checksum

- **Dimension:** S2
- **Checks:** Are the tools the project downloads at run time (linters, runtimes, helper commands, agent plugins) fixed to a version with a recorded checksum that is verified?
- **Why:** A tool is silently replaced by a new or trojaned version between two runs.
- **Evidence:** `file` (the code that fetches the tools, and their configuration); `judgment` (the version and digest are recorded and compared on fetch)
- **Severity:** 🟠; 🟡 for development-only tools with no secret in reach.
- **Applies:** project: fetches-tools
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-9 (verified 2026-11-08); SLSA Verifying artifacts (verified 2026-11-08); NIST-SSDF PO.3.2 (verified 2026-11-08)

### S2-007 — Install-time scripts of dependencies cannot reach a secret

- **Dimension:** S2
- **Checks:** Do the lifecycle scripts of dependencies (those that run at install) run only in a context that holds no secret, on developers' machines as in CI?
- **Why:** A malicious version runs code on the developer's or the CI's machine at install and steals tokens, as package-registry worms have done.
- **Evidence:** `file` (the configuration of the package manager and the flags of the CI's install); `judgment` (the context of the install holds no secret; turning scripts off, with named exceptions, is one way to reach that)
- **Severity:** 🟠; 🔴 when the install runs on a machine that holds publish tokens.
- **Applies:** project: dependencies
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); OWASP-TOP10 A03 (verified 2026-11-08)

### S2-008 — Install and build steps see no publish or deploy secret

- **Dimension:** S2
- **Checks:** Do install and build steps run without access to publish or deploy secrets?
- **Why:** Code from a dependency finds a token in the environment and uses it or sends it out.
- **Evidence:** `file` (which steps of the CI definitions get secrets); `judgment` (secrets reach only the step that needs them, after the install)
- **Severity:** 🔴 for publish tokens; 🟠 otherwise.
- **Applies:** project: ci
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); SCORECARD Token-Permissions (verified 2026-11-08)

### S2-009 — Dependency updates are proposed and handled

- **Dimension:** S2
- **Checks:** Is an update tool configured for every ecosystem, CI actions included, and are its pull requests reviewed and not left to pile up?
- **Why:** Pins rot and known-vulnerable versions stay for months, or updates arrive as one risky jump.
- **Evidence:** `file` (the configuration of the update tool); `command` (the open update pull requests and their age, through the host adapter)
- **Severity:** 🟡; 🟠 when an open advisory is among the stale ones. A check that the tool is enabled does not show that its pull requests are merged.
- **Applies:** project: dependencies
- **Decided by:** judged
- **Sources:** SCORECARD Dependency-Update-Tool (verified 2026-11-08); OWASP-TOP10 A03 (verified 2026-11-08); HOST-DOCS hardening of CI (verified 2026-11-08)

### S2-010 — Known vulnerabilities are audited

- **Dimension:** S2
- **Checks:** Does an audit of the lock files against an advisory database run in CI and on a schedule, clean or with documented exceptions?
- **Why:** A known-exploited flaw in a transitive dependency stays in the shipped product.
- **Evidence:** `command` (the stack's dependency audit role); `file` (the CI step, and the exceptions with an id and a reason)
- **Severity:** 🟠; 🔴 for a known-exploited flaw reachable at run time; 🟡 for development-only dependencies.
- **Applies:** project: dependencies
- **Decided by:** scriptable
- **Sources:** SCORECARD Vulnerabilities (verified 2026-11-08); OWASP-TOP10 A03 (verified 2026-11-08); NIST-SSDF RV.1.1 (verified 2026-11-08)

### S2-011 — The full set of dependencies can be listed

- **Dimension:** S2
- **Checks:** Can a complete list of the dependencies, transitive ones included, be produced on demand, as a software bill of materials or an equivalent?
- **Why:** When a compromise is announced, nobody can tell within hours whether the project is affected.
- **Evidence:** `command` (a bill of materials, or a listing of the lock files)
- **Severity:** 🟡; 🟠 for a project distributed to others.
- **Applies:** project: dependencies
- **Decided by:** scriptable
- **Sources:** OWASP-TOP10 A03 (verified 2026-11-08); NIST-SSDF PS.3.2 (verified 2026-11-08)

### S2-012 — Unused and unmaintained dependencies are removed

- **Dimension:** S2
- **Checks:** Are unused dependencies, and those that look abandoned, removed or flagged?
- **Why:** Dead packages enlarge the attack surface, and are the likeliest to be taken over or never patched.
- **Evidence:** `command` (a detector of unused dependencies, and the registry's date of last release); `judgment` (what counts as abandoned)
- **Severity:** 🟡.
- **Applies:** project: dependencies
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A03 (verified 2026-11-08); NIST-SSDF PW.4.4 (verified 2026-11-08)

### S2-013 — Internal package names cannot be confused with public ones

- **Dimension:** S2
- **Checks:** Are private package names bound to a scope and to the private registry, so that a public package of the same name cannot replace them?
- **Why:** An attacker publishes a public package with an internal name and a higher version, and the client fetches it.
- **Evidence:** `file` (the registry configuration, and the manifests with internal names); `judgment` (each internal name is scoped and bound)
- **Severity:** 🔴.
- **Applies:** project: private-packages
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08)

### S2-014 — The package manager's configuration is committed

- **Dimension:** S2
- **Checks:** Is the configuration of the package manager tracked, so that a developer's local defaults cannot change the registry or the policy on scripts?
- **Why:** A local setting points installs at an unvetted registry, or turns off integrity checks.
- **Evidence:** `file` (the tracked configuration fixes the registry and the policy on scripts)
- **Severity:** 🟡.
- **Applies:** project: dependencies
- **Decided by:** scriptable
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08)

### S2-015 — A new dependency is reviewed when it is added

- **Dimension:** S2
- **Checks:** Is each new dependency checked before it enters the lock file (spelling against the intended package, owner, age, install scripts), including a name an agent suggested?
- **Why:** A typosquatted package is added by mistake, or an agent proposes a plausible name that an attacker has registered (the case of the agent is this catalogue's own addition).
- **Evidence:** `command` (list the packages a change adds, with their registry data); `judgment` (a stated rule exists, and recent additions followed it)
- **Severity:** 🟠.
- **Applies:** project: dependencies
- **Decided by:** judged
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); OWASP-TOP10 A03 (verified 2026-11-08); NIST-SSDF PW.4.1 (verified 2026-11-08)

### S2-016 — The repository has no opaque executables, and vendored code has a recorded origin

- **Dimension:** S2
- **Checks:** Is the repository free of checked-in generated binaries, and is any vendored third-party code recorded with its origin and a hash?
- **Why:** A reviewer cannot read a binary, so a swapped file ships a backdoor; a vendored copy drifts with no way to tell.
- **Evidence:** `command` (scan the tracked files for binaries); `file` (the record of each vendored tree, with its address and hash)
- **Severity:** 🟠; 🔴 when the build runs it.
- **Applies:** every project
- **Decided by:** scriptable
- **Sources:** SCORECARD Binary-Artifacts (verified 2026-11-08); SCORECARD Pinned-Dependencies (verified 2026-11-08); NIST-SSDF PW.4.1 (verified 2026-11-08)

### S2-017 — A vendored framework is verified against its recorded hashes

- **Dimension:** S2
- **Checks:** Is a vendored or synced copy of a framework verified against recorded hashes on each sync, and does CI fail on drift or a local edit?
- **Why:** Someone edits the vendored tree, or a sync pulls a tampered upstream, and the change passes as the framework.
- **Evidence:** `command` (the framework's check of its lock file); `file` (the lock file with its hashes)
- **Severity:** 🟠.
- **Applies:** project: vendored
- **Decided by:** scriptable
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-9 (verified 2026-11-08); SLSA Verifying artifacts (verified 2026-11-08)

### S2-018 — Releases are built by CI from a clean checkout

- **Dimension:** S2
- **Checks:** Are official release artifacts built and published by CI from a clean checkout of a tagged commit, never from a maintainer's workstation?
- **Why:** A compromised laptop or a stray local file ends up in the release, with no record of how it was built.
- **Evidence:** `file` (the release definition); `judgment` (publishing happens only in a hosted job on a tagged commit)
- **Severity:** 🟠.
- **Applies:** project: releases
- **Decided by:** judged
- **Sources:** SLSA Build requirements (verified 2026-11-08)

### S2-019 — Releases carry a signature or provenance that users can check

- **Dimension:** S2
- **Checks:** Does each release carry a signature or a verifiable build provenance (the artifact's digest, the source revision and the build), and are users told how to check it?
- **Why:** A tampered download or a compromised registry cannot be told from a genuine release.
- **Evidence:** `file` (the signature or provenance files of the release, and the instructions to users); `command` (run a verification against the latest release)
- **Severity:** 🟠; 🟡 for internal artifacts. The presence of a signature file does not show that it verifies.
- **Applies:** project: releases
- **Decided by:** judged
- **Sources:** SCORECARD Signed-Releases (verified 2026-11-08); SLSA Build requirements (verified 2026-11-08); OWASP-CICD-TOP10 CICD-SEC-9 (verified 2026-11-08); HOST-DOCS artifact attestations (verified 2026-11-08); NIST-SSDF PS.2.1 (verified 2026-11-08)

### S2-020 — Provenance comes from the build platform, and its level is stated honestly

- **Dimension:** S2
- **Checks:** (Only for a project that builds an artifact: a tag and notes have nothing to attest.) Is provenance produced by the build platform rather than by steps a change can edit, with signing identities out of reach of those steps, and is the build level actually reached stated?
- **Why:** A tampered build step forges its own provenance, so the attestation says nothing about integrity.
- **Evidence:** `file` (where signing and attestation happen); `judgment` (the level by the rules of the source, and the gap to the next)
- **Severity:** 🔵 for a gap between low levels in a small project; 🟠 when a level is claimed that can be forged.
- **Applies:** project: builds-artifacts
- **Decided by:** judged
- **Sources:** SLSA Build requirements (verified 2026-11-08); HOST-DOCS artifact attestations (verified 2026-11-08)

### S2-021 — What is fetched is verified against stated expectations

- **Dimension:** S2
- **Checks:** Do the project's CI and its consumers check the digest, the signature, the builder and the source repository of what they fetch, and refuse an unknown build?
- **Why:** A correctly signed artifact from the wrong builder or a fork is accepted, because only "is it signed" was checked.
- **Evidence:** `file` (the verification step and its expectations); `judgment` (builder, source and build type are stated and compared)
- **Severity:** 🟡; 🟠 for high-value deployments downstream.
- **Applies:** project: consumes-provenance
- **Decided by:** judged
- **Sources:** SLSA Verifying artifacts (verified 2026-11-08)

### S2-022 — Publishing accounts cannot be hijacked by one stolen token

- **Dimension:** S2
- **Checks:** Are the registry and publishing accounts protected by strong multi-factor authentication and short-lived or trusted-publishing credentials, with no long-lived publish token stored?
- **Why:** A stolen long-lived token publishes a malicious version that downstream users install within minutes.
- **Evidence:** `judgment` (the settings of the registry and of the host, and no stored publish token in the CI's secrets)
- **Severity:** 🔴 for a published package with users; 🔵 otherwise.
- **Applies:** project: releases
- **Decided by:** manual
- **Sources:** OWASP-CICD-TOP10 CICD-SEC-3 (verified 2026-11-08); OWASP-TOP10 A03 (verified 2026-11-08); NIST-SSDF PO.5.1 (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| HOST-DOCS | The security documentation of the project's repository host | as listed by the adapter | `security.md` in the folder of the project's host adapter |
| NIST-SSDF | NIST SP 800-218, Secure Software Development Framework | version 1.1, February 2022 (final); revision 1 (version 1.2) is an initial public draft of 2025-12-17, and its changes to the practices cited were read | https://nvlpubs.nist.gov/nistpubs/SpecialPublications/NIST.SP.800-218.pdf |
| OWASP-CICD | OWASP CI/CD Security Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html |
| OWASP-CICD-TOP10 | OWASP Top 10 CI/CD Security Risks | the 2022 list; the risks CICD-SEC-1, 3, 4, 5, 6, 8 and 9 were read | https://owasp.org/www-project-top-10-ci-cd-security-risks/ |
| OWASP-TOP10 | OWASP Top 10, A03 Software Supply Chain Failures | 2025 | https://top10.owasp.org/2025/A03_2025-Software_Supply_Chain_Failures/ |
| SCORECARD | OpenSSF Scorecard checks | the checks as published on the date of verification | https://scorecard.dev/ |
| SLSA | SLSA specification | version 1.2 (build requirements, source requirements, verifying artifacts) | https://slsa.dev/spec/v1.2/ |
