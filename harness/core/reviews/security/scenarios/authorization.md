[← Scenarios](./README.md)

# Authorization: scenarios

First edition, a draft. Each playbook runs only under [the rules of engagement](../README.md#5-rules-of-engagement), against the project's own test environment, within the scope written in the bindings.

### SC-AUTHZ-01 — Reach another user's object by its identifier

- **Dimension:** S5
- **Goal:** Walk the permission matrix object by object.
- **Applies:** product: multi-user
- **Preconditions:** Two test users of the same role, each with their own test object.
- **Steps:** As the first user, read, change and delete the second user's object by its identifier, in each endpoint that takes one.
- **Safe behaviour:** Every attempt is refused, and the object is unchanged.
- **Evidence:** The requests and responses per endpoint, and the state of the object before and after.
- **Cleanup:** Delete the test users and objects.
- **Severity:** 🔴.
- **Probes:** S5-019
- **Sources:** OWASP-API API1 (verified 2026-11-08); WSTG ATHZ-04 (verified 2026-11-08); CS-IDOR verifying access controls (verified 2026-11-08)

### SC-AUTHZ-02 — Call a function of a higher role

- **Dimension:** S5
- **Goal:** Walk the permission matrix role by role.
- **Applies:** product: multi-user
- **Preconditions:** One test user for each role.
- **Steps:** For each role, call each function that the matrix denies it, directly and not through the interface, on test objects of the scope only. A function with a global effect (deleting users, changing settings, purging) is tried with a request that cannot complete, or left out and recorded.
- **Safe behaviour:** Every call is refused on the server.
- **Evidence:** A table of role, function and response.
- **Cleanup:** Undo what a call changed on the test objects, and delete the test users.
- **Severity:** 🔴.
- **Probes:** S5-020
- **Sources:** OWASP-API API5 (verified 2026-11-08); WSTG ATHZ-02, ATHZ-03 (verified 2026-11-08); CS-AUTHZ deny by default (verified 2026-11-08)

### SC-AUTHZ-03 — Set a field that the caller may not set

- **Dimension:** S5
- **Goal:** Find out whether a request can write protected fields.
- **Applies:** product: multi-user, http-api
- **Preconditions:** A test user, and the list of fields of its object; the only values used are the roles and test accounts of the scope.
- **Steps:** Add the fields for role, owner and status, with those values, to an update and to a creation request; then read the object.
- **Safe behaviour:** The fields are ignored or the request is refused, and the object's privileges are unchanged.
- **Evidence:** The requests, and the object before and after.
- **Cleanup:** Delete the test user and the objects it created.
- **Severity:** 🔴 when a privilege can be set.
- **Probes:** S5-021
- **Sources:** OWASP-API API3 (verified 2026-11-08)

### SC-AUTHZ-04 — Cross a tenant's boundary

- **Dimension:** S5
- **Goal:** Find out whether one tenant can see another's data through lists and searches.
- **Applies:** product: multi-user
- **Preconditions:** Two test tenants with marked test data.
- **Steps:** As the first tenant, use each list, search, export and report, with and without filters, and look for the mark of the second.
- **Safe behaviour:** The second tenant's mark never appears.
- **Evidence:** The queries and the absence or presence of the mark.
- **Cleanup:** Delete the test tenants.
- **Severity:** 🔴.
- **Probes:** S5-019
- **Sources:** OWASP-TOP10 A01 (verified 2026-11-08); CS-AUTHZ check every request (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| CS-AUTHZ | OWASP Authorization Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html |
| CS-IDOR | OWASP Insecure Direct Object Reference Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html |
| OWASP-API | OWASP API Security Top 10 | 2023 | https://api-security.owasp.org/editions/2023/en/0x11-t10 |
| OWASP-TOP10 | OWASP Top 10 | 2025 | https://top10.owasp.org/2025 |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
