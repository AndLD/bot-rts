[← Scenarios](./README.md)

# Authentication and sessions: scenarios

First edition, a draft. Each playbook runs only under [the rules of engagement](../README.md#5-rules-of-engagement), against the project's own test environment, within the scope written in the bindings.

### SC-AUTHN-01 — Tell real accounts from unknown ones

- **Dimension:** S5
- **Goal:** Find out whether the product reveals which accounts exist.
- **Applies:** product: accounts
- **Preconditions:** Two test accounts, and an address that has no account, in the test mail domain of the scope.
- **Steps:** Log in, register and request a reset once for a test account and once for the unknown address; compare the text, the status and the time of the answers.
- **Safe behaviour:** The answers are the same in text and status, and the timing shows no usable difference.
- **Evidence:** The pairs of responses and their timings, with no real address.
- **Cleanup:** Remove the accounts the scenario made.
- **Severity:** 🟡; 🟠 when an account's existence is itself sensitive.
- **Probes:** S5-002
- **Sources:** WSTG IDNT-04 (verified 2026-11-08); CS-AUTHN error messages (verified 2026-11-08)

### SC-AUTHN-02 — Guess a password until something stops it

- **Dimension:** S5
- **Goal:** Find out what limits repeated failed logins.
- **Applies:** product: accounts, passwords
- **Preconditions:** A test account made for this, and a number of attempts within the scope's limit.
- **Steps:** Send wrong passwords to the test account up to the limit; then try one wrong password against several test accounts from one source.
- **Safe behaviour:** Attempts are slowed or refused before the limit, the owner of the account is not locked out indefinitely, and the attempts are logged.
- **Evidence:** The count at which the limit applied, and the log entries.
- **Cleanup:** Unlock the test account and delete it.
- **Severity:** 🟠; 🔴 with no limit at all on a public login.
- **Probes:** S5-004
- **Sources:** WSTG ATHN-03 (verified 2026-11-08); CS-AUTHN automated attacks (verified 2026-11-08)

### SC-AUTHN-03 — Use a reset token twice, late, and for another account

- **Dimension:** S5
- **Goal:** Find out whether a password-reset token can be misused.
- **Applies:** product: passwords
- **Preconditions:** Two test accounts, and access to the test mailbox.
- **Steps:** Request a reset; use the token; use it again; request another and wait past its stated life; try a token of the first account while acting on the second.
- **Safe behaviour:** The second use, the late use and the use on another account all fail, and a reset ends the account's other sessions or offers to.
- **Evidence:** The requests and responses, with token values removed.
- **Cleanup:** Delete the test accounts.
- **Severity:** 🔴 when takeover works; 🟠 for one missing property.
- **Probes:** S5-008
- **Sources:** WSTG ATHN-09 (verified 2026-11-08); CS-FORGOT methods (verified 2026-11-08)

### SC-AUTHN-04 — Point the reset link at another host

- **Dimension:** S5
- **Goal:** Find out whether a request can change where the reset link leads.
- **Applies:** product: passwords, web
- **Preconditions:** A test account, and a listener of the test environment named in the scope.
- **Steps:** Request a reset with a changed host header naming the listener; read the link in the test mailbox.
- **Safe behaviour:** The link uses only the configured address of the product, and the listener receives nothing.
- **Evidence:** The link as delivered, and the listener's log.
- **Cleanup:** Delete the test account and stop the listener.
- **Severity:** 🔴 when the link can be redirected.
- **Probes:** S5-008
- **Sources:** WSTG INPV-17 (verified 2026-11-08); CS-FORGOT forgot password service (verified 2026-11-08)

### SC-AUTHN-05 — Skip the second factor

- **Dimension:** S5
- **Goal:** Find out whether the second step can be avoided.
- **Applies:** product: mfa
- **Preconditions:** A test account with the second factor on.
- **Steps:** After the first step, request a page behind the login directly; repeat a wrong code up to the scope's limit; try the recovery path with only the first factor.
- **Safe behaviour:** Nothing behind the login answers before the second step, attempts are limited, and recovery asks for more than the first factor.
- **Evidence:** The requests and responses.
- **Cleanup:** Reset and delete the test account.
- **Severity:** 🔴 when it can be skipped.
- **Probes:** S5-010
- **Sources:** CS-MFA implementing MFA (verified 2026-11-08); CS-MFA attacks and mitigations (verified 2026-11-08)

### SC-AUTHN-06 — Plant a session before login

- **Dimension:** S5
- **Goal:** Find out whether the session identifier changes at login.
- **Applies:** product: accounts
- **Preconditions:** A test account.
- **Steps:** Note the identifier given before login; log in; compare; then request an authenticated page with the old one.
- **Safe behaviour:** The identifier changes at login, and the old one gives no access.
- **Evidence:** The identifiers, shortened so that they cannot be used, and the responses.
- **Cleanup:** Log out and delete the test account.
- **Severity:** 🔴 when fixation works.
- **Probes:** S5-013
- **Sources:** WSTG SESS-03 (verified 2026-11-08); CS-SESSION session id life cycle (verified 2026-11-08)

### SC-AUTHN-07 — Use a session after logout

- **Dimension:** S5
- **Goal:** Find out whether logout and timeout end the session on the server.
- **Applies:** product: accounts
- **Preconditions:** A test account, and a copy of its session identifier or token.
- **Steps:** Log out, then send the saved identifier; log in again and wait past the stated idle limit, then send it.
- **Safe behaviour:** The saved identifier is refused both times.
- **Evidence:** The responses.
- **Cleanup:** Delete the test account.
- **Severity:** 🟠.
- **Probes:** S5-015
- **Sources:** WSTG SESS-06, SESS-07 (verified 2026-11-08)

### SC-AUTHN-08 — Change a self-contained token

- **Dimension:** S5
- **Goal:** Find out whether the product accepts an altered or foreign token.
- **Applies:** product: accounts
- **Preconditions:** A test account and its token.
- **Steps:** Change a claim and keep the signature; declare no signature algorithm; send an expired token; send a token meant for another audience of the test environment.
- **Safe behaviour:** Each one is refused.
- **Evidence:** The requests and responses, with the valid token's signature removed.
- **Cleanup:** Revoke the token and delete the test account.
- **Severity:** 🔴 when an edited token is accepted.
- **Probes:** S5-016
- **Sources:** ASVS V9.1, V9.2 (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| ASVS | OWASP Application Security Verification Standard | 5.0.0, 30 May 2025 | https://asvs.owasp.org/ |
| CS-AUTHN | OWASP Authentication Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| CS-FORGOT | OWASP Forgot Password Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html |
| CS-MFA | OWASP Multifactor Authentication Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html |
| CS-SESSION | OWASP Session Management Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
