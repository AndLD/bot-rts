[← Probes](./README.md)

# S6 — Operations: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

## Deployment

### S6-001 — The deployment configuration is reviewed and reproducible

- **Dimension:** S6
- **Checks:** Is the production configuration repeatable, reviewed, and free of defaults meant for development?
- **Why:** A manual change or a development default reaches production and nobody can tell.
- **Evidence:** `file` (the deployment definitions); `judgment`
- **Severity:** 🟠.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A02 (verified 2026-11-08); WSTG CONF-02 (verified 2026-11-08); ASVS V13.4 (verified 2026-11-08)

### S6-002 — Only what must be exposed is exposed

- **Dimension:** S6
- **Checks:** Are only the intended ports and services reachable from outside, with databases and management interfaces closed to the public?
- **Why:** A database or an admin console listens on the public network.
- **Evidence:** `command` (list what answers from outside the test deployment); `file` (the network rules)
- **Severity:** 🔴 for an open database or console.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** WSTG CONF-01, CONF-05 (verified 2026-11-08); ASVS V15.2 (verified 2026-11-08)

### S6-003 — Transport is encrypted everywhere, and certificates are watched

- **Dimension:** S6
- **Checks:** Is external and service-to-service traffic encrypted, with strict transport on and certificates renewed before they expire?
- **Why:** An expired certificate teaches users to click through, or internal traffic is read on the network.
- **Evidence:** `command` (inspect the protocols, certificates and strict-transport header of the test deployment); `file`
- **Severity:** 🟠.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** WSTG CONF-07 (verified 2026-11-08); ASVS V12.1, V12.3 (verified 2026-11-08)

### S6-004 — Services authenticate each other with least privilege

- **Dimension:** S6
- **Checks:** Do the services of the product authenticate to each other and to the database with their own least-privileged accounts?
- **Why:** One compromised component reads everything, since all share an administrator's account.
- **Evidence:** `file` (the service accounts and their grants); `judgment`
- **Severity:** 🟠; 🔴 for a shared administrator account.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** ASVS V13.2 (verified 2026-11-08); OWASP-TOP10 A02 (verified 2026-11-08)

### S6-005 — Storage is not public by accident

- **Dimension:** S6
- **Checks:** Are file permissions and cloud storage restricted, with nothing publicly readable or writable unless intended?
- **Why:** A storage bucket of customer files is open to anyone with its address.
- **Evidence:** `command` (list the permissions, through a role of the deployment); `file`
- **Severity:** 🔴 for user data.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** WSTG CONF-09, CONF-11 (verified 2026-11-08)

### S6-006 — No dangling name can be taken over

- **Dimension:** S6
- **Checks:** Does every published domain name point to something the project still controls?
- **Why:** A name left pointing at a deleted service is claimed by someone else and serves their content on the project's domain.
- **Evidence:** `command` (resolve the published names and check each target)
- **Severity:** 🟠.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** WSTG CONF-10 (verified 2026-11-08)

### S6-007 — The platform underneath is kept patched

- **Dimension:** S6
- **Checks:** Are the operating system, the base images and the platform services updated on a stated schedule?
- **Why:** A known flaw in the layers below the code is exploited long after a fix existed.
- **Evidence:** `file` (the update process); `command` (the versions in use)
- **Severity:** 🟠; 🔴 for a known-exploited flaw on an exposed service.
- **Applies:** project: deploys
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A03 (verified 2026-11-08)

## Backups

### S6-008 — Backups exist, off-site and protected

- **Dimension:** S6
- **Checks:** Are backups taken at a frequency that fits the data's importance, kept apart from production, and protected, including from someone who controls production (that last part is this catalogue's own addition)?
- **Why:** A mistake or ransomware destroys production and the backups together.
- **Evidence:** `file` (the backup configuration); `judgment` (the frequency fits, and the copies are out of production's reach)
- **Severity:** 🔴 when user data has no independent copy.
- **Applies:** product: user-data
- **Decided by:** judged
- **Sources:** NIST-CP §3.4.1, §3.4.2, §5.1.2 (verified 2026-11-08)

### S6-009 — A restore has been tested

- **Dimension:** S6
- **Checks:** Has a backup actually been restored and validated within the last stated interval, and is the time it took recorded?
- **Why:** On the worst day the backups turn out to be unreadable, or the restore takes a week.
- **Evidence:** `scenario` (SC-OPS-03); `file` (the record of the drill)
- **Severity:** 🟠; 🔴 when no restore has ever been tried.
- **Applies:** product: user-data
- **Decided by:** manual
- **Sources:** NIST-CP §3.5.1, §4.3 (verified 2026-11-08)

## Incident response

### S6-010 — An incident has a plan and an owner

- **Dimension:** S6
- **Checks:** Is there a written plan that names who decides, who to contact, how to preserve evidence and how to tell the people affected?
- **Why:** During a breach people improvise, destroy evidence and miss their legal deadlines.
- **Evidence:** `file` (the plan and its contacts); `judgment` (it matches the team as it is now)
- **Severity:** 🟠.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** NIST-IR §2.2, §2.3, Table 3 (verified 2026-11-08)

### S6-011 — Incidents leave lessons

- **Dimension:** S6
- **Checks:** Is each incident, and each exercise, followed by a review whose actions are tracked?
- **Why:** The same weakness causes the next incident.
- **Evidence:** `file` (the reviews and the issues they opened)
- **Severity:** 🟡.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** NIST-IR §3.1, Table 2 (verified 2026-11-08)

## Logs

### S6-012 — Logs have a stated retention and disposal

- **Dimension:** S6
- **Checks:** Is it stated how long each kind of log is kept and how it is disposed of, in line with the project's obligations?
- **Why:** Logs are gone when an old breach is found, or are kept forever holding personal data.
- **Evidence:** `file` (the retention settings and the policy); `judgment`
- **Severity:** 🟡; 🟠 when an obligation applies.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** NIST-LOG TS-3, TS-5 (verified 2026-11-08); CS-LOG retention and disposal (verified 2026-11-08)

### S6-013 — Logs cannot be altered by the attacker they would catch

- **Dimension:** S6
- **Checks:** Are logs sent off the host or otherwise protected against change, with access restricted?
- **Why:** An intruder deletes the record of the intrusion.
- **Evidence:** `file` (the log pipeline and its permissions); `judgment`
- **Severity:** 🟠.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** CS-LOG protection (verified 2026-11-08); CS-LOG attacks on logs (verified 2026-11-08); ASVS V16.4 (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| ASVS | OWASP Application Security Verification Standard | 5.0.0, 30 May 2025 | https://asvs.owasp.org/ |
| CS-LOG | OWASP Logging Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html |
| NIST-CP | NIST SP 800-34, Contingency Planning Guide | revision 1, updated 2010-11-11 | https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final |
| NIST-IR | NIST SP 800-61, Incident Response Recommendations | revision 3, April 2025 | https://csrc.nist.gov/pubs/sp/800/61/r3/final |
| NIST-LOG | NIST SP 800-92, Cybersecurity Log Management Planning Guide | revision 1, initial public draft of 2023-10-11 (no final revision) | https://csrc.nist.gov/pubs/sp/800/92/r1/ipd |
| OWASP-TOP10 | OWASP Top 10 | 2025 | https://top10.owasp.org/2025 |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
