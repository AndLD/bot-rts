[← Scenarios](./README.md)

# Abuse, isolation and operations: scenarios

First edition, a draft. Each playbook runs only under [the rules of engagement](../README.md#5-rules-of-engagement), against the project's own test environment, within the scope written in the bindings.

### SC-OPS-01 — Find the limit of a request

- **Dimension:** S5
- **Goal:** Find out whether the limits exist, without stressing the service.
- **Applies:** product: http-api
- **Preconditions:** The scope's maximum for requests per second, its maximum number of requests, its sizes for a large body, a deep structure and a large page, and a test account.
- **Steps:** Within those maximums, repeat one request until a limit answers or the number is reached; send one body, one structure and one page size of the scope's sizes, once each, and stop if the service slows.
- **Safe behaviour:** The limit answers before the scope's number, and the large requests are refused quickly.
- **Evidence:** The count at the limit and the responses.
- **Cleanup:** None: stop at the first refusal, or at the scope's number.
- **Severity:** 🟠; 🔴 when one request can take the service down.
- **Probes:** S5-038
- **Sources:** OWASP-API API4 (verified 2026-11-08); CS-RATE application attacks (verified 2026-11-08)

### SC-OPS-02 — Provoke an error and read what it says

- **Dimension:** S5
- **Goal:** Find out what an error reveals.
- **Applies:** product: service
- **Preconditions:** A test account.
- **Steps:** Send malformed input, an unsupported method and a missing identifier to each kind of endpoint; read the answers.
- **Safe behaviour:** A generic message and a reference; no stack trace, path, version or query; the access decision stays a refusal.
- **Evidence:** The responses, and the matching server log entry.
- **Cleanup:** None.
- **Severity:** 🟡; 🔴 when an error grants access.
- **Probes:** S5-043
- **Sources:** WSTG ERRH-01, ERRH-02 (verified 2026-11-08); CS-ERROR proposition (verified 2026-11-08)

### SC-OPS-03 — Restore a backup into the test environment

- **Dimension:** S6
- **Goal:** Find out whether the backups really restore, and how long it takes.
- **Applies:** product: user-data
- **Preconditions:** An isolated test environment, and a backup that holds only test data. A drill on a backup of real data is an operation of the project, outside this scenario.
- **Steps:** Restore; start the service; run the checks that validate the data; record the time.
- **Safe behaviour:** The service runs on the restored data, and the time is within the stated objective.
- **Evidence:** The record of the drill, with times.
- **Cleanup:** Destroy the restored copy.
- **Severity:** 🟠; 🔴 when no restore has ever been tried.
- **Probes:** S6-009
- **Sources:** NIST-CP §3.5.1, §4.3 (verified 2026-11-08)

### SC-OPS-04 — See whether an attack is noticed

- **Dimension:** S5
- **Goal:** Find out whether simulated attacks are recorded and reach a person.
- **Applies:** product: service
- **Preconditions:** A test account; the agreement of whoever receives the alerts.
- **Steps:** Run the steps of SC-AUTHN-02 and SC-AUTHZ-02 at a low rate; look for the events and for the alert.
- **Safe behaviour:** The events are logged with their context and no secret, and the alert reaches the named person.
- **Evidence:** The log entries and the alert, with its time.
- **Cleanup:** Tell the receiver that the test is over, and delete the test account.
- **Severity:** 🟠.
- **Probes:** S5-044
- **Sources:** CS-LOG events to record (verified 2026-11-08); CS-LOGVOCAB (verified 2026-11-08); OWASP-TOP10 A09 (verified 2026-11-08)

### SC-OPS-05 — Try to leave the sandbox of untrusted code

- **Dimension:** S5
- **Goal:** Find out whether code that the product runs for users is confined.
- **Applies:** product: untrusted-code
- **Preconditions:** A test tenant; a harmless test program; a canary file and a listener of the test environment named in the scope.
- **Steps:** From the sandbox, try to read the canary, reach the listener, list the names (never the values) of the environment's variables, and reach the other test tenant's data.
- **Safe behaviour:** Each attempt fails, and the attempts are logged.
- **Evidence:** The program's output, with no value of a secret, and the listener's log.
- **Cleanup:** Remove the program, the canary and the test tenant.
- **Severity:** 🔴.
- **Probes:** S5-036
- **Sources:** ASVS V15.2 (verified 2026-11-08); OWASP-TOP10 A06 (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| ASVS | OWASP Application Security Verification Standard | 5.0.0, 30 May 2025 | https://asvs.owasp.org/ |
| CS-ERROR | OWASP Error Handling Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html |
| CS-LOG | OWASP Logging Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html |
| CS-LOGVOCAB | OWASP Logging Vocabulary Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html |
| CS-RATE | OWASP Denial of Service Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html |
| NIST-CP | NIST SP 800-34, Contingency Planning Guide | revision 1, updated 2010-11-11 | https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final |
| OWASP-API | OWASP API Security Top 10 | 2023 | https://api-security.owasp.org/editions/2023/en/0x11-t10 |
| OWASP-TOP10 | OWASP Top 10 | 2025 | https://top10.owasp.org/2025 |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
