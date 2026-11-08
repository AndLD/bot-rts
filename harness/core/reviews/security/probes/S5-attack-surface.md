[← Probes](./README.md)

# S5 — The product's attack surface: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

The categories of the OWASP Top 10 (2025), and where each is covered:

| Category | Covered by |
| -------- | ---------- |
| A01 Broken Access Control | the section Authorization |
| A02 Security Misconfiguration | the section Configuration and headers, and the section Deployment of S6 |
| A03 Software Supply Chain Failures | the file of S2 |
| A04 Cryptographic Failures | the section Cryptography and integrity |
| A05 Injection | the section Input and output |
| A06 Insecure Design | the section Design |
| A07 Authentication Failures | the sections Authentication, and Sessions and tokens |
| A08 Software or Data Integrity Failures | the section Cryptography and integrity |
| A09 Security Logging and Alerting Failures | the last probe of the section Exposure, and the section Logs of S6 |
| A10 Mishandling of Exceptional Conditions | the section Exposure |

## Design

### S5-001 — The product has a threat model, and it is current

- **Dimension:** S5
- **Checks:** Do the bindings hold a threat model of the product (assets, trust boundaries, entry points, attackers) that matches what is built now?
- **Why:** Defences are built for imagined risks, and the real path to the most valuable asset is never looked at.
- **Evidence:** `file` (the threat model of the bindings); `judgment` (a change since the last review is in it)
- **Severity:** 🟠 when none exists for a product with users; 🟡 when it is stale.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A06 (verified 2026-11-08); CS-THREAT addressing each question (verified 2026-11-08); SHOSTACK (verified 2026-11-08)

## Authentication

### S5-002 — Login, registration and reset do not reveal who has an account

- **Dimension:** S5
- **Checks:** Do login, registration and password reset answer alike, in text and in time, for an account that exists and one that does not?
- **Why:** An attacker builds a list of real accounts, then guesses or phishes them.
- **Evidence:** `scenario` (SC-AUTHN-01)
- **Severity:** 🟡; 🟠 when an account's existence is itself sensitive.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG IDNT-04 (verified 2026-11-08); CS-AUTHN error messages (verified 2026-11-08)

### S5-003 — Registration cannot be automated or claim someone else's identity

- **Dimension:** S5
- **Checks:** Does registration verify the identifier it is given and resist automation?
- **Why:** Bots create accounts in bulk, or someone registers another person's address and acts in their name.
- **Evidence:** `file` (the registration flow); `judgment` (the identifier is proven before it is trusted, and automated sign-up is limited)
- **Severity:** 🟡; 🟠 when an account gains anything of value at once.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG IDNT-02 (verified 2026-11-08); ASVS V2.4 (verified 2026-11-08)

### S5-004 — Guessing a password is slowed down

- **Dimension:** S5
- **Checks:** Are login attempts limited per account and per source, in a way that does not let an attacker lock out a victim at will?
- **Why:** An attacker tries a list of leaked passwords against many accounts, unnoticed.
- **Evidence:** `scenario` (SC-AUTHN-02)
- **Severity:** 🟠; 🔴 when there is no limit at all on a public login.
- **Applies:** product: accounts, passwords
- **Decided by:** judged
- **Sources:** WSTG ATHN-03 (verified 2026-11-08); CS-AUTHN automated attacks (verified 2026-11-08); ASVS V6.3 (verified 2026-11-08)

### S5-005 — Passwords are stored with a slow salted hash and checked against a sound policy

- **Dimension:** S5
- **Checks:** Are passwords stored with an adaptive, salted hash, compared safely, and held to a policy on length and known-breached values?
- **Why:** A leaked table of passwords is cracked in hours and reused on other services.
- **Evidence:** `file` (the hashing code and its parameters, the policy); `judgment`
- **Severity:** 🔴 for plain, reversible or fast hashes; 🟠 for weak parameters.
- **Applies:** product: passwords
- **Decided by:** judged
- **Sources:** ASVS V6.2, V11.4 (verified 2026-11-08); CS-AUTHN password storage (verified 2026-11-08); WSTG ATHN-07 (verified 2026-11-08)

### S5-006 — No default or test credential exists in a deployment

- **Dimension:** S5
- **Checks:** Is every deployment free of default, sample and test accounts?
- **Why:** A documented default login opens the administrator's account.
- **Evidence:** `command` (try the documented defaults against the test environment); `file` (seed data, installers)
- **Severity:** 🔴.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG ATHN-02 (verified 2026-11-08); ASVS V6.3 (verified 2026-11-08)

### S5-007 — Credentials travel only over an encrypted channel

- **Dimension:** S5
- **Checks:** Are credentials and session identifiers sent only over an encrypted channel, with no fallback?
- **Why:** Someone on the network reads the password or the session as it passes.
- **Evidence:** `command` (request the login over plain transport against the test environment)
- **Severity:** 🔴.
- **Applies:** product: accounts
- **Decided by:** scriptable
- **Sources:** WSTG ATHN-01 (verified 2026-11-08); ASVS V12.1 (verified 2026-11-08)

### S5-008 — Password reset cannot be used to take over an account

- **Dimension:** S5
- **Checks:** Is a reset token random, single-use, short-lived, bound to the account, delivered only to the verified address, and does a reset end the other sessions or offer to end them?
- **Why:** An attacker predicts, reuses or redirects a reset token and takes the account.
- **Evidence:** `scenario` (SC-AUTHN-03, SC-AUTHN-04); `file` (the flow)
- **Severity:** 🔴 when takeover works; 🟠 for one missing property.
- **Applies:** product: passwords
- **Decided by:** judged
- **Sources:** WSTG ATHN-09 (verified 2026-11-08); CS-FORGOT forgot password service (verified 2026-11-08); CS-FORGOT methods (verified 2026-11-08); ASVS V6.4, V7.4 (verified 2026-11-08)

### S5-009 — Sensitive changes ask for the user again

- **Dimension:** S5
- **Checks:** Do changes of password, address, second factor and other sensitive actions require fresh authentication?
- **Why:** A borrowed or stolen session changes the address and locks the owner out.
- **Evidence:** `file` (the flows of those changes); `judgment`
- **Severity:** 🟠.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** CS-AUTHN reauthentication (verified 2026-11-08); ASVS V7.5 (verified 2026-11-08)

### S5-010 — The second factor cannot be skipped or worn down

- **Dimension:** S5
- **Checks:** Is the second factor enforced on the server at each step, limited in attempts, safe in recovery and change, and resistant to approval fatigue and downgrade?
- **Why:** An attacker with the password goes straight to the page after the second step, or spams approvals until one is accepted.
- **Evidence:** `scenario` (SC-AUTHN-05); `file` (recovery and change of factors)
- **Severity:** 🔴 when it can be skipped; 🟠 for weak recovery.
- **Applies:** product: mfa
- **Decided by:** judged
- **Sources:** CS-MFA implementing MFA (verified 2026-11-08); CS-MFA attacks and mitigations (verified 2026-11-08); ASVS V6.5 (verified 2026-11-08)

### S5-011 — Other channels are not a weaker way in

- **Dimension:** S5
- **Checks:** Do the mobile, API and other channels demand the same strength of authentication as the main one?
- **Why:** The attacker ignores the protected login and uses an older endpoint with no limit and no second factor.
- **Evidence:** `file` (the list of entry points); `judgment`
- **Severity:** 🟠.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG ATHN-10 (verified 2026-11-08); OWASP-API API2 (verified 2026-11-08)

### S5-012 — Single sign-on validates what it is given

- **Dimension:** S5
- **Checks:** Does the product check the state, nonce, audience, issuer and exact redirect address of each federated login?
- **Why:** A crafted response logs the attacker in as someone else, or a code is sent to the attacker's address.
- **Evidence:** `file` (the configuration and the callback code); `judgment`
- **Severity:** 🔴 when a login can be forged.
- **Applies:** product: sso
- **Decided by:** judged
- **Sources:** ASVS V10.1, V10.2, V6.8 (verified 2026-11-08); CS-AUTHN protocols without password (verified 2026-11-08)

## Sessions and tokens

### S5-013 — A session identifier is random and changes at login

- **Dimension:** S5
- **Checks:** Is the session identifier issued by the server, unpredictable, and replaced when the privilege changes?
- **Why:** An attacker plants a known identifier before the victim logs in, then shares the session.
- **Evidence:** `scenario` (SC-AUTHN-06)
- **Severity:** 🔴 when fixation works.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG SESS-01, SESS-03 (verified 2026-11-08); CS-SESSION session id properties (verified 2026-11-08); CS-SESSION session id life cycle (verified 2026-11-08); ASVS V7.2 (verified 2026-11-08)

### S5-014 — Session cookies have their protective attributes

- **Dimension:** S5
- **Checks:** Are session cookies marked secure and inaccessible to scripts, with a same-site policy and a narrow scope?
- **Why:** A script or a plain request exposes the cookie.
- **Evidence:** `command` (read the attributes on the test environment's responses)
- **Severity:** 🟠.
- **Applies:** product: web, accounts
- **Decided by:** scriptable
- **Sources:** WSTG SESS-02 (verified 2026-11-08); ASVS V3.3 (verified 2026-11-08); CS-SESSION cookies (verified 2026-11-08)

### S5-015 — Logout and timeout really end the session

- **Dimension:** S5
- **Checks:** Does logout end the session on the server, and do idle and absolute limits apply?
- **Why:** An old token keeps working after logout, on a shared computer or from a stolen copy.
- **Evidence:** `scenario` (SC-AUTHN-07)
- **Severity:** 🟠.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** WSTG SESS-06, SESS-07 (verified 2026-11-08); ASVS V7.3, V7.4 (verified 2026-11-08)

### S5-016 — Self-contained tokens are verified in full

- **Dimension:** S5
- **Checks:** Is the signature of each self-contained token checked with a fixed algorithm and key, and are its expiry, audience and issuer enforced?
- **Why:** An edited token, or one meant for another service, is accepted.
- **Evidence:** `scenario` (SC-AUTHN-08); `file` (the verification code)
- **Severity:** 🔴 when an edited token is accepted.
- **Applies:** product: accounts
- **Decided by:** judged
- **Sources:** ASVS V9.1, V9.2 (verified 2026-11-08)

### S5-017 — Tokens are not exposed in addresses or browser storage

- **Dimension:** S5
- **Checks:** Are session identifiers and tokens kept out of addresses, logs and browser storage that scripts can read?
- **Why:** A token in an address reaches logs and other sites; one in browser storage is taken by any injected script.
- **Evidence:** `file` (how the client stores tokens); `command` (inspect requests on the test environment)
- **Severity:** 🟠.
- **Applies:** product: web, accounts
- **Decided by:** judged
- **Sources:** WSTG SESS-04, CLNT-12 (verified 2026-11-08); CS-SESSION html5 web storage (verified 2026-11-08); ASVS V14.3 (verified 2026-11-08)

## Authorization

### S5-018 — The permission matrix is written and tested

- **Dimension:** S5
- **Checks:** Is there a written matrix of roles against actions and objects, and do tests walk it, denied cases included?
- **Why:** A new endpoint ships with no rule because no one can say what the rule should be.
- **Evidence:** `file` (the matrix and the tests); `judgment` (the denied cases are tested)
- **Severity:** 🟠.
- **Applies:** product: multi-user
- **Decided by:** judged
- **Sources:** ASVS V8.1 (verified 2026-11-08); CS-AUTHZ test authorization logic (verified 2026-11-08); WSTG IDNT-01 (verified 2026-11-08)

### S5-019 — Each access to an object checks that it belongs to the caller

- **Dimension:** S5
- **Checks:** Does each read and write of an object check on the server that the caller may reach that object, whichever identifier is sent?
- **Why:** A user changes an identifier in a request and reads another customer's data.
- **Evidence:** `scenario` (SC-AUTHZ-01, SC-AUTHZ-04)
- **Severity:** 🔴.
- **Applies:** product: multi-user
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A01 (verified 2026-11-08); OWASP-API API1 (verified 2026-11-08); WSTG ATHZ-04 (verified 2026-11-08); CS-IDOR verifying access controls (verified 2026-11-08); ASVS V8.2 (verified 2026-11-08)

### S5-020 — Each function checks the role on the server, and denies by default

- **Dimension:** S5
- **Checks:** Is each function, administrative ones included, checked on the server, with access denied unless a rule allows it?
- **Why:** A regular user calls an administrator's endpoint directly, since only the menu hid it.
- **Evidence:** `scenario` (SC-AUTHZ-02)
- **Severity:** 🔴.
- **Applies:** product: multi-user
- **Decided by:** judged
- **Sources:** OWASP-API API5 (verified 2026-11-08); WSTG ATHZ-02, ATHZ-03 (verified 2026-11-08); CS-AUTHZ deny by default (verified 2026-11-08); CS-AUTHZ server side (verified 2026-11-08); ASVS V8.3 (verified 2026-11-08)

### S5-021 — A caller can read and set only the fields it is allowed

- **Dimension:** S5
- **Checks:** Are the fields of an object that a caller may read or set limited explicitly on the server?
- **Why:** A request adds a field such as the role, and the server stores it; or a response returns private fields.
- **Evidence:** `scenario` (SC-AUTHZ-03)
- **Severity:** 🔴 when a privilege can be set; 🟠 for excess exposure.
- **Applies:** product: multi-user, http-api
- **Decided by:** judged
- **Sources:** OWASP-API API3 (verified 2026-11-08)

### S5-022 — A path from the user cannot leave its folder

- **Dimension:** S5
- **Checks:** Is a path built from user input confined to the intended folder?
- **Why:** A crafted name reads a configuration file or a key.
- **Evidence:** `scenario` (SC-INPUT-06)
- **Severity:** 🔴.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** WSTG ATHZ-01 (verified 2026-11-08); ASVS V5.3 (verified 2026-11-08)

## Input and output

### S5-023 — Queries and commands keep data apart from instructions

- **Dimension:** S5
- **Checks:** Do database queries, shell commands and every other interpreter of the stack receive user data through a mechanism that keeps it apart from the instructions?
- **Why:** A crafted input changes the query and returns or alters others' data.
- **Evidence:** `command` (static analysis, through a role of the stack); `scenario` (SC-INPUT-01)
- **Severity:** 🔴.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A05 (verified 2026-11-08); WSTG INPV-05, INPV-12 (verified 2026-11-08); ASVS V1.2 (verified 2026-11-08)

### S5-024 — Output is encoded for its context

- **Dimension:** S5
- **Checks:** Is user data encoded for the context it lands in, with unsafe sinks avoided and rich text sanitized?
- **Why:** A stored comment runs a script in every reader's session.
- **Evidence:** `scenario` (SC-INPUT-02); `file` (templates and unsafe sinks)
- **Severity:** 🔴 when stored and reaching other users; 🟠 for reflected.
- **Applies:** product: web
- **Decided by:** judged
- **Sources:** WSTG INPV-01, INPV-02, CLNT-01 (verified 2026-11-08); CS-XSS output encoding (verified 2026-11-08); ASVS V1.3, V3.2 (verified 2026-11-08)

### S5-025 — A state change cannot be forged from another site

- **Dimension:** S5
- **Checks:** Do state-changing requests carry a defence against forgery that a cross-site request cannot supply?
- **Why:** A page the victim visits makes the browser perform an action in their name.
- **Evidence:** `scenario` (SC-INPUT-03)
- **Severity:** 🟠; 🔴 for money or account changes.
- **Applies:** product: web, accounts
- **Decided by:** judged
- **Sources:** WSTG SESS-05 (verified 2026-11-08); CS-CSRF token-based mitigation (verified 2026-11-08); ASVS V3.5 (verified 2026-11-08)

### S5-026 — The server fetches only allowed addresses

- **Dimension:** S5
- **Checks:** Where the server fetches an address derived from input, is it held to an allowlist, with internal ranges and metadata services unreachable?
- **Why:** The server is made to read its cloud metadata or an internal service for the attacker.
- **Evidence:** `scenario` (SC-INPUT-04); `file` (the fetching code)
- **Severity:** 🔴 when internal addresses are reachable.
- **Applies:** product: fetches-urls
- **Decided by:** judged
- **Sources:** OWASP-API API7 (verified 2026-11-08); WSTG INPV-19 (verified 2026-11-08); CS-SSRF case 1 (verified 2026-11-08); CS-SSRF case 2 (verified 2026-11-08)

### S5-027 — Uploaded files are validated and stored safely

- **Dimension:** S5
- **Checks:** Are uploads limited by type, content, name and size, and stored away from anything that could execute or serve them as active content?
- **Why:** An uploaded script is served and runs, or fills the disk.
- **Evidence:** `scenario` (SC-INPUT-05); `file` (the upload path and storage)
- **Severity:** 🔴 when an upload can execute; 🟠 otherwise.
- **Applies:** product: file-handling
- **Decided by:** judged
- **Sources:** CS-UPLOAD protection (verified 2026-11-08); WSTG BUSL-08, BUSL-09 (verified 2026-11-08); ASVS V5.2, V5.3 (verified 2026-11-08)

### S5-028 — Untrusted data is not deserialized into objects

- **Dimension:** S5
- **Checks:** Is data from outside parsed into plain formats, or verified as signed, before any native object is built from it?
- **Why:** A crafted payload runs code during deserialization.
- **Evidence:** `command` (search for the stack's unsafe deserializers); `file`
- **Severity:** 🔴.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** CS-DESER alternative data formats (verified 2026-11-08); CS-DESER only deserialize signed data (verified 2026-11-08); ASVS V1.5 (verified 2026-11-08)

### S5-029 — Redirects go only to allowed places

- **Dimension:** S5
- **Checks:** Is a redirect or a forward derived from input validated against an allowlist?
- **Why:** A link on the real domain sends the user to a phishing page.
- **Evidence:** `scenario` (SC-INPUT-07)
- **Severity:** 🟡; 🟠 when a token travels with it.
- **Applies:** product: web
- **Decided by:** judged
- **Sources:** CS-REDIRECT preventing (verified 2026-11-08); WSTG CLNT-04 (verified 2026-11-08)

### S5-030 — Business rules hold under a changed order of steps

- **Dimension:** S5
- **Checks:** Do the product's workflows enforce their order, limits and values on the server?
- **Why:** A step is skipped or a value forged, so an order is paid at the wrong price.
- **Evidence:** `file` (the flows); `judgment` (each step checks the previous one on the server)
- **Severity:** 🟠; 🔴 where money or rights change.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** WSTG BUSL-01, BUSL-06 (verified 2026-11-08); ASVS V2.3 (verified 2026-11-08)

## Cryptography and integrity

### S5-031 — Sensitive data is protected with sound cryptography

- **Dimension:** S5
- **Checks:** Is sensitive data classified and protected in transit and at rest, with current algorithms and managed keys?
- **Why:** A copied database or a captured stream exposes what was thought safe.
- **Evidence:** `file` (the inventory of data and of cryptography); `judgment`
- **Severity:** 🔴 for sensitive data in clear; 🟠 for weak algorithms.
- **Applies:** product: user-data
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A04 (verified 2026-11-08); ASVS V11.1, V11.3, V14.2 (verified 2026-11-08)

### S5-032 — What the product trusts is checked for tampering

- **Dimension:** S5
- **Checks:** Are updates, plugins and data the product trusts from outside checked for integrity before use?
- **Why:** A changed update or client-side value is accepted as genuine.
- **Evidence:** `file` (the update path and any client-held state); `judgment`
- **Severity:** 🟠.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A08 (verified 2026-11-08); CS-DESER only deserialize signed data (verified 2026-11-08)

## Configuration and headers

### S5-033 — Debug modes, samples and administrative pages are off or restricted

- **Dimension:** S5
- **Checks:** Are debug modes, sample pages, unneeded features and administrative interfaces off, or reachable only by those who need them?
- **Why:** A debug page or a default console gives an attacker the internals.
- **Evidence:** `command` (request the known paths on the test environment); `file` (production settings)
- **Severity:** 🔴 for an open administrative interface; 🟠 otherwise.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A02 (verified 2026-11-08); WSTG CONF-05 (verified 2026-11-08); ASVS V13.4 (verified 2026-11-08)

### S5-034 — The browser's security headers are set

- **Dimension:** S5
- **Checks:** Do responses set a content-security policy, framing policy, content-type protection and strict transport, with revealing headers removed?
- **Why:** A missing header turns a small injection or a framing trick into a real attack.
- **Evidence:** `command` (read the headers on the test environment)
- **Severity:** 🟡.
- **Applies:** product: web
- **Decided by:** scriptable
- **Sources:** CS-HEADERS security headers (verified 2026-11-08); ASVS V3.4 (verified 2026-11-08); WSTG CLNT-09 (verified 2026-11-08)

### S5-035 — Cross-origin access is narrow

- **Dimension:** S5
- **Checks:** Does the cross-origin policy list named origins, never reflect the caller's, and allow credentials only where needed?
- **Why:** Any site reads a logged-in user's data through the browser.
- **Evidence:** `command` (send requests with a foreign origin to the test environment)
- **Severity:** 🟠; 🔴 with credentials allowed.
- **Applies:** product: web, http-api
- **Decided by:** judged
- **Sources:** WSTG CLNT-07 (verified 2026-11-08); ASVS V3.4 (verified 2026-11-08)

## Isolation and abuse

### S5-036 — Untrusted code runs in a confined place

- **Dimension:** S5
- **Checks:** Does code or content from users or models (plugins, scripts, generated code) run confined, with no reach to secrets, the network or other tenants?
- **Why:** A submitted plugin reads the service's credentials or another tenant's data.
- **Evidence:** `scenario` (SC-OPS-05); `file` (the design of the isolation)
- **Severity:** 🔴.
- **Applies:** product: untrusted-code
- **Decided by:** judged
- **Sources:** ASVS V15.2 (verified 2026-11-08); OWASP-TOP10 A06 (verified 2026-11-08)

### S5-037 — User content is served so that it cannot act as the site

- **Dimension:** S5
- **Checks:** Is user-supplied content served so that the browser cannot treat it as the site's own active content (a separate origin, a safe type)?
- **Why:** A viewed file runs in the site's origin.
- **Evidence:** `command` (fetch uploaded content from the test environment and read its type and headers); `file`
- **Severity:** 🟠.
- **Applies:** product: web, file-handling
- **Decided by:** judged
- **Sources:** ASVS V3.2 (verified 2026-11-08); CS-UPLOAD threats (verified 2026-11-08)

### S5-038 — Resources have limits

- **Dimension:** S5
- **Checks:** Are request rate, size, depth, time, and paid calls limited for each caller?
- **Why:** One client exhausts the service, or runs up a bill with a paid third party.
- **Evidence:** `scenario` (SC-OPS-01); `file` (the limits)
- **Severity:** 🟠; 🔴 when one request can take the service down.
- **Applies:** product: http-api
- **Decided by:** judged
- **Sources:** OWASP-API API4 (verified 2026-11-08); CS-RATE application attacks (verified 2026-11-08); WSTG BUSL-05 (verified 2026-11-08)

### S5-039 — Sensitive flows resist automation

- **Dimension:** S5
- **Checks:** Are flows such as sign-up, purchase and sending messages protected against use at scale?
- **Why:** Bots buy all the stock, or the product is used to send spam.
- **Evidence:** `file` (the flows and their limits); `judgment`
- **Severity:** 🟡; 🟠 when abuse costs money or reputation.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-API API6 (verified 2026-11-08); ASVS V2.4 (verified 2026-11-08); WSTG BUSL-07 (verified 2026-11-08)

## Exposure

### S5-040 — The client holds no secret

- **Dimension:** S5
- **Checks:** Are the client's code and storage free of keys and of any secret meant for the server?
- **Why:** Anyone opens the page source or unpacks the application and takes the key.
- **Evidence:** `command` (the secret scan over the built client); `file`
- **Severity:** 🔴 for a key that works.
- **Applies:** product: web
- **Decided by:** scriptable
- **Sources:** ASVS V13.3, V14.3 (verified 2026-11-08); WSTG CLNT-12 (verified 2026-11-08)

### S5-041 — The API surface is known

- **Dimension:** S5
- **Checks:** Is there a current inventory of the API, with old versions and debug endpoints retired, and its documentation exposed only as intended?
- **Why:** A forgotten older version with no protections stays open.
- **Evidence:** `command` (compare the inventory with the routes the test environment answers); `file`
- **Severity:** 🟠.
- **Applies:** product: http-api
- **Decided by:** judged
- **Sources:** OWASP-API API9 (verified 2026-11-08); ASVS V4.1, V13.4 (verified 2026-11-08)

### S5-042 — Data from third-party services is validated

- **Dimension:** S5
- **Checks:** Is data received from third-party services validated like user input, with redirects and timeouts controlled?
- **Why:** A compromised partner sends data that is trusted and injected into the product.
- **Evidence:** `file` (the integrations); `judgment`
- **Severity:** 🟠.
- **Applies:** product: consumes-apis
- **Decided by:** judged
- **Sources:** OWASP-API API10 (verified 2026-11-08)

### S5-043 — Errors fail safe and reveal nothing

- **Dimension:** S5
- **Checks:** Does an error leave the system in a safe state, return a generic message, and keep the details on the server?
- **Why:** A stack trace reveals the internals, or a failed check ends in access granted.
- **Evidence:** `scenario` (SC-OPS-02); `file` (the global handler)
- **Severity:** 🟡; 🔴 when an error grants access.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A10 (verified 2026-11-08); WSTG ERRH-01, ERRH-02 (verified 2026-11-08); CS-ERROR proposition (verified 2026-11-08); ASVS V16.5 (verified 2026-11-08)

### S5-044 — Attacks are logged and someone is told

- **Dimension:** S5
- **Checks:** Are security events (failed logins, denied access, input rejected) logged with enough context and no secrets, and do alerts reach a person?
- **Why:** An attack runs for weeks because nothing was recorded or nobody was told.
- **Evidence:** `scenario` (SC-OPS-04); `file` (the events and the alert rules)
- **Severity:** 🟠.
- **Applies:** product: service
- **Decided by:** judged
- **Sources:** OWASP-TOP10 A09 (verified 2026-11-08); CS-LOG events to record (verified 2026-11-08); CS-LOGVOCAB (verified 2026-11-08); ASVS V16.2, V16.3 (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| ASVS | OWASP Application Security Verification Standard | 5.0.0, 30 May 2025 | https://asvs.owasp.org/ |
| CS-AUTHN | OWASP Authentication Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html |
| CS-AUTHZ | OWASP Authorization Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Authorization_Cheat_Sheet.html |
| CS-CSRF | OWASP Cross-Site Request Forgery Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html |
| CS-DESER | OWASP Deserialization Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Deserialization_Cheat_Sheet.html |
| CS-ERROR | OWASP Error Handling Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Error_Handling_Cheat_Sheet.html |
| CS-FORGOT | OWASP Forgot Password Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html |
| CS-HEADERS | OWASP HTTP Headers Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/HTTP_Headers_Cheat_Sheet.html |
| CS-IDOR | OWASP Insecure Direct Object Reference Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Insecure_Direct_Object_Reference_Prevention_Cheat_Sheet.html |
| CS-LOG | OWASP Logging Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html |
| CS-LOGVOCAB | OWASP Logging Vocabulary Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Logging_Vocabulary_Cheat_Sheet.html |
| CS-MFA | OWASP Multifactor Authentication Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html |
| CS-RATE | OWASP Denial of Service Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Denial_of_Service_Cheat_Sheet.html |
| CS-REDIRECT | OWASP Unvalidated Redirects and Forwards Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html |
| CS-SESSION | OWASP Session Management Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html |
| CS-SSRF | OWASP Server Side Request Forgery Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html |
| CS-THREAT | OWASP Threat Modeling Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Threat_Modeling_Cheat_Sheet.html |
| CS-UPLOAD | OWASP File Upload Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html |
| CS-XSS | OWASP Cross Site Scripting Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html |
| OWASP-API | OWASP API Security Top 10 | 2023 | https://api-security.owasp.org/editions/2023/en/0x11-t10 |
| OWASP-TOP10 | OWASP Top 10 | 2025 | https://top10.owasp.org/2025 |
| SHOSTACK | Threat Modeling Manifesto, the four questions | the page has no version | https://threatmodelingmanifesto.org/ |
| WSTG | OWASP Web Security Testing Guide | stable version 4.2 | https://wstg.owasp.org/v4.2/ |
