[← Scenarios](./README.md)

# Input and output: scenarios

First edition, a draft. Each playbook runs only under [the rules of engagement](../README.md#5-rules-of-engagement), against the project's own test environment, within the scope written in the bindings.

### SC-INPUT-01 — Change a query with a harmless marker

- **Dimension:** S5
- **Goal:** Find out whether input can change the meaning of a query or command.
- **Applies:** product: service
- **Preconditions:** A test account; a list of inputs from the entry points of the threat model.
- **Steps:** Send values that would alter a query or a command only in a way that can be read (a true or false condition, a marker in the output); no value that writes, deletes or delays the system beyond the scope.
- **Safe behaviour:** The values are treated as data: the results do not change, and nothing is executed.
- **Evidence:** The inputs and the differences in the responses.
- **Cleanup:** Remove any test row the requests made.
- **Severity:** 🔴.
- **Probes:** S5-023
- **Sources:** WSTG INPV-05, INPV-12 (verified 2026-11-08); ASVS V1.2 (verified 2026-11-08)

### SC-INPUT-02 — Store a harmless script marker

- **Dimension:** S5
- **Goal:** Find out whether user content can run in another user's browser.
- **Applies:** product: web
- **Preconditions:** Two test users; a marker that only writes to the page's own console.
- **Steps:** As the first user, store the marker in each text field; as the second, view each place it appears.
- **Safe behaviour:** The marker is shown as text, and it does not run.
- **Evidence:** The stored value and how it was rendered.
- **Cleanup:** Delete the test content and users.
- **Severity:** 🔴 when stored and reaching other users; 🟠 for reflected.
- **Probes:** S5-024
- **Sources:** WSTG INPV-01, INPV-02 (verified 2026-11-08); CS-XSS output encoding (verified 2026-11-08)

### SC-INPUT-03 — Send a state change from another origin

- **Dimension:** S5
- **Goal:** Find out whether a state change can be forged.
- **Applies:** product: web, accounts
- **Preconditions:** A test user logged in; a page on a test origin named in the scope.
- **Steps:** From that page, submit a state-changing request to the product, with no token and with a token of another session.
- **Safe behaviour:** The request is refused, and the state is unchanged.
- **Evidence:** The requests and the state before and after.
- **Cleanup:** Remove the page and the test user.
- **Severity:** 🟠; 🔴 for money or account changes.
- **Probes:** S5-025
- **Sources:** WSTG SESS-05 (verified 2026-11-08); CS-CSRF token-based mitigation (verified 2026-11-08)

### SC-INPUT-04 — Make the server fetch an internal address

- **Dimension:** S5
- **Goal:** Find out whether a fetch by the server can reach what it should not.
- **Applies:** product: fetches-urls
- **Preconditions:** A listener of the test environment named in the scope, as the internal target.
- **Steps:** Give the listener's address to each feature that fetches an address, in the direct form, in forms redirected through the listener only, and in alternately encoded forms. Use the metadata address of the platform only if the scope allows; a response that holds a credential is not kept or used, and the scenario stops there.
- **Safe behaviour:** Disallowed targets are refused, and the listener receives nothing.
- **Evidence:** The inputs, the status of each response and the listener's log, with no credential.
- **Cleanup:** Stop the listener.
- **Severity:** 🔴 when internal addresses are reachable.
- **Probes:** S5-026
- **Sources:** WSTG INPV-19 (verified 2026-11-08); CS-SSRF case 1 (verified 2026-11-08); CS-SSRF case 2 (verified 2026-11-08); OWASP-API API7 (verified 2026-11-08)

### SC-INPUT-05 — Upload a disguised file

- **Dimension:** S5
- **Goal:** Find out whether an upload can become active content.
- **Applies:** product: file-handling
- **Preconditions:** A test user; harmless test files: a text file named like an executable, an image whose content does not match, a file just over the size limit and within the scope's maximum, a name with path characters aimed at an empty canary folder of the test environment, never at an existing file.
- **Steps:** Upload each; fetch each back.
- **Safe behaviour:** Each is refused or stored inert, under a name the server chose, and served as a download or a safe type.
- **Evidence:** The responses and the headers of each fetch.
- **Cleanup:** Delete the uploaded files, anything written to the canary folder, and the test user.
- **Severity:** 🔴 when an upload can execute; 🟠 otherwise.
- **Probes:** S5-027
- **Sources:** CS-UPLOAD protection (verified 2026-11-08); WSTG BUSL-08, BUSL-09 (verified 2026-11-08)

### SC-INPUT-06 — Read a planted file by a crafted path

- **Dimension:** S5
- **Goal:** Find out whether a path from the user can leave its folder.
- **Applies:** product: service
- **Preconditions:** A canary file placed outside the intended folder of the test environment; no system file is targeted.
- **Steps:** Send relative paths and encoded forms toward the canary, through each feature that takes a name or path.
- **Safe behaviour:** The canary is never returned.
- **Evidence:** The inputs and the responses.
- **Cleanup:** Remove the canary.
- **Severity:** 🔴.
- **Probes:** S5-022
- **Sources:** WSTG ATHZ-01 (verified 2026-11-08); ASVS V5.3 (verified 2026-11-08)

### SC-INPUT-07 — Redirect to another site

- **Dimension:** S5
- **Goal:** Find out whether a redirect can be pointed outside.
- **Applies:** product: web
- **Preconditions:** An address of the test environment named in the scope as the outside target.
- **Steps:** Give that address, plain and in look-alike forms, to each redirect parameter.
- **Safe behaviour:** The redirect stays within the allowed places.
- **Evidence:** The inputs and the location of each response.
- **Cleanup:** None.
- **Severity:** 🟡; 🟠 when a token travels with it.
- **Probes:** S5-029
- **Sources:** WSTG CLNT-04 (verified 2026-11-08); CS-REDIRECT preventing (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| ASVS | OWASP Application Security Verification Standard | 5.0.0, 30 May 2025 | https://asvs.owasp.org/ |
| CS-CSRF | OWASP Cross-Site Request Forgery Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html |
| CS-REDIRECT | OWASP Unvalidated Redirects and Forwards Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html |
| CS-SSRF | OWASP Server Side Request Forgery Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html |
| CS-UPLOAD | OWASP File Upload Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
| CS-XSS | OWASP Cross Site Scripting Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| OWASP-API | OWASP API Security Top 10 | 2023 | https://api-security.owasp.org/editions/2023/en/0x11-t10 |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
