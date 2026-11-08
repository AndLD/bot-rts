[← Probes](./README.md)

# S1 — Secrets: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

### S1-001 — The tracked files hold no credential

- **Dimension:** S1
- **Checks:** Does the current tree of every tracked file hold no credential (password, key, token, private key, connection string with a password)?
- **Why:** Anyone who can read the repository, or a leaked copy of it, logs in as the service.
- **Evidence:** `command` (the secret scan of the tracked files, patterns and entropy); `file` (configuration, CI definitions, documents and tests are included)
- **Severity:** 🔴 for a live credential; 🟡 for a test value that looks real; lower when it is proven revoked.
- **Applies:** every project
- **Decided by:** scriptable
- **Sources:** CWE-798 Description, Detection (verified 2026-11-08); OWASP-SECRETS §1, §8 (verified 2026-11-08)

### S1-002 — Environment and key files are not tracked

- **Dimension:** S1
- **Checks:** Are real environment files and key files absent from the tracked files, and listed in the ignore file of the version control?
- **Why:** One careless "add everything" commits the file that holds the live keys.
- **Evidence:** `command` (list the tracked files whose names match environment and key files); `file` (the ignore file holds the same patterns)
- **Severity:** 🔴 when one is tracked and holds live values; 🟡 when it is only ignored incompletely.
- **Applies:** every project
- **Decided by:** scriptable
- **Sources:** OWASP-SECRETS §1 (verified 2026-11-08); CWE-798 Mitigations (verified 2026-11-08)

### S1-003 — The example environment file holds placeholders only

- **Dimension:** S1
- **Checks:** Does the repository carry only an example of its environment file, with obviously fake values, naming every variable the code needs?
- **Why:** A contributor copies a real value into the example, or invents the name and commits the real file.
- **Evidence:** `file` (the example file); `judgment` (each value is a placeholder, and none matches a known token format)
- **Severity:** 🟡; 🔴 when a real value is in it.
- **Applies:** project: environment-file
- **Decided by:** judged
- **Sources:** FRAMEWORK nn.secrets (verified 2026-11-08)

### S1-004 — The history has no secret that a past commit removed

- **Dimension:** S1
- **Checks:** Does a scan of the whole history (every branch and tag, not only the tip) find no live credential?
- **Why:** A key deleted by a later commit is still read from an old commit, a clone or a fork.
- **Evidence:** `command` (the secret scan of the history, over all references); `judgment` (is each hit live, and was it revoked?)
- **Severity:** 🔴 for a live credential; 🟠 when its state is unknown; 🔵 for a provably fake value.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** HOST-DOCS secret scanning (verified 2026-11-08); OWASP-SECRETS §8.1 (verified 2026-11-08)

### S1-005 — A leaked secret was revoked, not only deleted

- **Dimension:** S1
- **Checks:** Is every secret found in the history or elsewhere already revoked or rotated, with the date recorded?
- **Why:** The owner cleans the file, the key stays valid, and a copy taken earlier keeps working.
- **Evidence:** `file` (the record of the leak and of the rotation); `judgment` (each past finding has a revocation that comes before or replaces any rewrite of history)
- **Severity:** 🔴 when a leaked key is still valid; 🟡 when it was rotated and not recorded.
- **Applies:** project: past-secret-finding
- **Decided by:** judged
- **Sources:** HOST-DOCS removing sensitive data (verified 2026-11-08); OWASP-SECRETS §9.2 (verified 2026-11-08)

### S1-006 — A rewrite of history was complete

- **Dimension:** S1
- **Checks:** Where history was rewritten to remove a secret, were the forks, the old clones, the references of pull requests and the cached views dealt with, or accepted in writing?
- **Why:** The secret lives on in a fork or an old clone, and is pushed back by mistake.
- **Evidence:** `file` (the note of the incident); `judgment` (each copy is listed, with why it is safe; a rewrite with no rotation is a no)
- **Severity:** 🟠; 🔴 when the secret was not rotated.
- **Applies:** project: past-secret-finding
- **Decided by:** judged
- **Sources:** HOST-DOCS removing sensitive data (verified 2026-11-08); OWASP-SECRETS §9.2 (verified 2026-11-08)

### S1-007 — A secret is stopped before it leaves, and again in CI

- **Dimension:** S1
- **Checks:** Does a secret scan run before the secret leaves the machine (a local hook or the host's blocking of pushes) and again in CI on every pull request, with CI failing on a finding?
- **Why:** Without an early gate a leak is found days later, already cloned and cached.
- **Evidence:** `file` (the hook configuration and the CI definition); `command` (the host's setting for blocking pushes, through the host adapter)
- **Severity:** 🟠; 🔵 when the project is private and solo and its history scan is clean.
- **Applies:** every project
- **Decided by:** scriptable
- **Sources:** OWASP-SECRETS §8.1 (verified 2026-11-08); OWASP-CICD secrets management and scanning (verified 2026-11-08); HOST-DOCS push protection (verified 2026-11-08)

### S1-008 — Bypasses of the host's blocking are limited and reviewed

- **Dimension:** S1
- **Checks:** Where the host blocks pushes that hold secrets, is the bypass limited, is each one reviewed, and is no alert left open?
- **Why:** Anyone with write access bypasses the block with a reason such as "fix later", and the secret lands.
- **Evidence:** `command` (the open alerts and the bypass settings, through the host adapter); `judgment` (open alerts are zero or tracked, and each bypass is audited)
- **Severity:** 🟡; 🟠 when an open alert holds a live key.
- **Applies:** project: host-push-protection
- **Decided by:** judged
- **Sources:** HOST-DOCS push protection (verified 2026-11-08); HOST-DOCS secret scanning (verified 2026-11-08)

### S1-009 — The scanner finds more than the formats of known providers

- **Dimension:** S1
- **Checks:** Does the scanner cover generic keys, private keys, connection strings and the project's own token formats, and is it tested on a planted fake secret?
- **Why:** The scan passes because it knows a few formats, so a custom token ships unnoticed.
- **Evidence:** `file` (the rules of the scanner); `command` (run the scanner on a planted fake)
- **Severity:** 🟡.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** OWASP-SECRETS §8.1 (verified 2026-11-08); HOST-DOCS secret scanning (verified 2026-11-08)

### S1-010 — The CI definitions hold references, not secrets

- **Dimension:** S1
- **Checks:** Do the CI definitions hold no literal secret, with every value taken from the CI's secret store or a vault?
- **Why:** Anyone who can read the repository reads the pipeline's key.
- **Evidence:** `command` (the secret scan over the CI definitions, and a search for assignments to names like password or token); `file` (the CI definitions)
- **Severity:** 🔴 for a literal value; 🟡 for a risky pattern.
- **Applies:** project: ci
- **Decided by:** scriptable
- **Sources:** OWASP-CICD secrets management (verified 2026-11-08); OWASP-SECRETS §3.2 (verified 2026-11-08)

### S1-011 — The CI's logs stay free of secrets

- **Dimension:** S1
- **Checks:** Do the CI's logs hold no secret, including transformed values (encoded, signed) and structured ones, with debug and trace modes off in shared runs?
- **Why:** Masking matches exact values only, so an encoded secret appears in a log that many people can read.
- **Evidence:** `file` (the CI definitions: printed variables, debug flags, structured secrets); `command` (the secret scan of stored logs); `judgment` (derived forms are masked)
- **Severity:** 🟠; 🔴 for a live key in a public log.
- **Applies:** project: ci
- **Decided by:** judged
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08); OWASP-CICD logging (verified 2026-11-08); CWE-532 Mitigations (verified 2026-11-08)

### S1-012 — The logs of the application and its tools hold no secret

- **Dimension:** S1
- **Checks:** Does logging avoid secrets, tokens, full request headers and objects with credential fields, with debug logging off or filtered in production?
- **Why:** A shipped or widely readable log gives credentials to anyone who reads it.
- **Evidence:** `command` (search for logging of headers, configuration objects and the environment); `file` (the logging configuration); `judgment` (a redaction layer exists, and a test feeds it a fake secret)
- **Severity:** 🟠; 🟡 when the log is private and short-lived.
- **Applies:** every project
- **Decided by:** judged
- **Sources:** CWE-532 Mitigations, Detection (verified 2026-11-08); OWASP-SECRETS §8.3 (verified 2026-11-08)

### S1-013 — Build output and images hold no secret

- **Dimension:** S1
- **Checks:** Do the build output and the container images hold no secret (no value in image layers or metadata, no copied environment or key file), with credentials for the build passed through a mechanism that leaves no trace?
- **Why:** Anyone who can pull the image reads its layers and metadata and gets the key.
- **Evidence:** `file` (the image definitions, the build scripts, the ignore file of the build); `command` (the secret scan of the built image, its layers and history, and of the release archives)
- **Severity:** 🔴 for a public image; 🟠 for a private registry.
- **Applies:** project: builds-artifacts
- **Decided by:** scriptable
- **Sources:** OWASP-SECRETS §5.1 (verified 2026-11-08); OWASP-CICD build artifacts (verified 2026-11-08)

### S1-014 — Secrets arrive at run time from the platform

- **Dimension:** S1
- **Checks:** Are secrets delivered at run time by the platform (mounted files, a secret manager), and absent from images, committed deployment manifests and infrastructure state in plain text?
- **Why:** A manifest in the repository holds an encoded secret that is trivial to decode.
- **Evidence:** `file` (deployment manifests, infrastructure variables and state); `command` (the secret scan over them, and a check that state files are not tracked); `judgment` (a claim of encryption is real)
- **Severity:** 🔴 for plain values; 🟡 for values that are truly encrypted but held in the repository.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** OWASP-SECRETS §5.1, §5.3, §3.6 (verified 2026-11-08)

### S1-015 — The agent cannot read the secret files

- **Dimension:** S1
- **Checks:** Do the settings of the agent runtime stop it reading the environment files, key files and credential folders, by its file tools and through its shell?
- **Why:** The agent reads an environment file for an unrelated task, and the key enters its transcript and the model provider's data flow.
- **Evidence:** `file` (the read exclusions, `access.denyRead` of the profile and the settings the runtime adapter writes); `judgment` (the exclusions cover the project's secret paths at any depth, and a sandbox or a hook covers the shell; rules that match file tools alone are a partial yes)
- **Severity:** 🟠; 🔴 when production keys sit in the working directory; 🔵 when no secret file is within the agent's reach.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS permissions (verified 2026-11-08); RUNTIME-DOCS security (verified 2026-11-08); AGENT-TRANSCRIPTS (verified 2026-11-08)

### S1-016 — The agent's transcripts are treated as holding secrets

- **Dimension:** S1
- **Checks:** Are the agent's session transcripts scanned for secrets, kept out of commits and of backups the project has not decided on, and, where a secret appears, is it revoked before the transcript is deleted?
- **Why:** A secret the agent printed stays in the transcript, and a later tool, plugin or backup reads it.
- **Evidence:** `command` (the secret scan over the agent's session folder); `file` (a procedure says what to do); `judgment` (the scan was done, the scope of backups is decided)
- **Severity:** 🟠; 🟡 when the scan is clean and the owner is the only reader. A single vendor's research backs this probe: its confidence is lower than the others'.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** AGENT-TRANSCRIPTS (verified 2026-11-08); OWASP-LLM LLM02 (verified 2026-11-08)

### S1-017 — The agent's configuration holds no credential

- **Dimension:** S1
- **Checks:** Are the agent files of the repository (definitions of tool servers, skills, hooks, settings, instruction files, prompts) free of embedded credentials, with servers given references to the environment or a secret store?
- **Why:** A connection string with a password in a shared file for a tool server is committed, and every clone has it.
- **Evidence:** `command` (the secret scan over those paths); `file` (the definitions of tool servers)
- **Severity:** 🟠; 🔴 for a production key.
- **Applies:** project: agent-runtime
- **Decided by:** scriptable
- **Sources:** RUNTIME-DOCS security (verified 2026-11-08); AGENT-TRANSCRIPTS (verified 2026-11-08); OWASP-LLM LLM02, LLM07 (verified 2026-11-08)

### S1-018 — The agent works with test credentials

- **Dimension:** S1
- **Checks:** Does the agent process hold only scoped, revocable test credentials, and nothing inherited from the owner's shell profile?
- **Why:** A prompt or a tool's output puts a powerful key in the model's context, from where an injected instruction or a log leaks it.
- **Evidence:** `file` (how credentials reach the agent, and the environment of its process); `judgment` (each credential is scoped to the task and can be revoked)
- **Severity:** 🟠; 🔴 for production or write-everything tokens; 🟡 when all are scoped and revocable.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-LLM LLM02 (verified 2026-11-08); OWASP-SECRETS §2.3 (verified 2026-11-08); OWASP-AGENT-CS data protection (verified 2026-11-08)

### S1-019 — Each secret has an owner and a rotation plan

- **Dimension:** S1
- **Checks:** Does each secret have a recorded purpose, owner, consumers, rotation method and expiry, with a tested way to replace it in an emergency?
- **Why:** At the moment of a leak nobody knows what the key opens or how to replace it, so it stays valid for days.
- **Evidence:** `file` (the inventory of secrets or the runbook); `judgment` (each entry is complete, and the emergency path was tried)
- **Severity:** 🟠; 🟡 for a tiny project with one or two secrets documented in prose.
- **Applies:** project: holds-secrets
- **Decided by:** judged
- **Sources:** OWASP-SECRETS §2.7, §2.11, §8.4, §9.1, §9.2 (verified 2026-11-08); HOST-DOCS hardening of CI (verified 2026-11-08)

### S1-020 — Secrets are separated by environment and by consumer

- **Dimension:** S1
- **Checks:** Is each secret least-privilege and held by one consumer, with no production secret in development, CI or tests?
- **Why:** A leaked test key opens production, and a shared key hides the source of a compromise.
- **Evidence:** `file` (the scoping of CI environments, the policies of the secret manager); `judgment` (each secret has one consumer and one scope)
- **Severity:** 🟠; 🔴 for a production administrator key in development tooling.
- **Applies:** project: holds-secrets
- **Decided by:** judged
- **Sources:** OWASP-SECRETS §1, §2.3, §6.3 (verified 2026-11-08); OWASP-CICD secrets management (verified 2026-11-08)

### S1-021 — The use of secrets is watched

- **Dimension:** S1
- **Checks:** Are accesses to secrets, and uses of leaked or revoked ones, monitored, with alerts that reach a named person?
- **Why:** A leak is exploited for weeks because no one sees the odd use.
- **Evidence:** `command` (the host's alerts and the secret store's audit settings); `judgment` (open alerts reach a named person, and the audit log is on)
- **Severity:** 🟡; 🟠 for a project that handles other people's data.
- **Applies:** project: holds-secrets
- **Decided by:** judged
- **Sources:** OWASP-SECRETS §2.6, §6.4, §8.3 (verified 2026-11-08); HOST-DOCS secret scanning (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| AGENT-TRANSCRIPTS | Backslash Security, secrets in AI agent session history | vendor research: indicative, not independent | https://www.backslash.security/blog/secrets-in-ai-agent-session-history |
| CWE-532 | MITRE CWE-532, Insertion of Sensitive Information into Log File | CWE 5.0, page of 2026-10-28 | https://cwe.mitre.org/data/definitions/532.html |
| CWE-798 | MITRE CWE-798, Use of Hard-coded Credentials | CWE 5.0, page of 2026-10-28 | https://cwe.mitre.org/data/definitions/798.html |
| FRAMEWORK | The rules of this framework | the version the project has taken | the rule on secrets of the entry file; no outside source was found for this probe |
| HOST-DOCS | The security documentation of the project's repository host | as listed by the adapter | `security.md` in the folder of the project's host adapter |
| OWASP-AGENT-CS | OWASP AI Agent Security Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html |
| OWASP-CICD | OWASP CI/CD Security Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/CI_CD_Security_Cheat_Sheet.html |
| OWASP-LLM | OWASP Top 10 for LLM Applications | 2025 | https://genai.owasp.org/llm-top-10/ |
| OWASP-SECRETS | OWASP Secrets Management Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html |
| RUNTIME-DOCS | The security documentation of the project's agent runtime | as listed by the adapter | `security.md` in the folder of the project's agent-runtime adapter |
