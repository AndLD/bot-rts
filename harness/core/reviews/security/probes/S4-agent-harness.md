[← Probes](./README.md)

# S4 — Agent harness: probes

First edition, a draft: see [the index](./README.md). The format is section 3 of [the method](../README.md).

### S4-001 — No committed setting turns the permission checks off

- **Dimension:** S4
- **Checks:** Is the agent run in a mode that asks or classifies before acting, with no committed setting, launch script or CI job that turns the checks off?
- **Why:** An injected or confused agent runs destructive or outward-facing commands with nobody in the loop.
- **Evidence:** `file` (the runtime's settings, launch scripts, and CI jobs that start an agent)
- **Severity:** 🔴 where the agent reads untrusted text or can push; 🟠 otherwise; 🔵 inside a throwaway sandbox with no credentials.
- **Applies:** project: agent-runtime
- **Decided by:** scriptable
- **Sources:** RUNTIME-DOCS security (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-LLM LLM06 (verified 2026-11-08)

### S4-002 — No allow rule permits an open-ended command

- **Dimension:** S4
- **Checks:** Is every allow rule for the shell a narrow command, with none that permits a bare wildcard, an interpreter, a package runner or a network fetcher?
- **Why:** Injected text makes the agent use one allowed "harmless" prefix that in fact runs any code or fetches and runs remote content.
- **Evidence:** `file` (the committed and shared allow lists); `judgment` (each rule names a narrow, purpose-built command)
- **Severity:** 🟠; 🔴 with network egress and secrets in the environment; 🟡 for read-only tools.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-LLM LLM06 (verified 2026-11-08); OWASP-AGENT-CS tool security and least privilege (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-AGENTIC-TM T2 (verified 2026-11-08); OWASP-ASI ASI02 (verified 2026-11-08)

### S4-003 — A hard rule does not rest on matching the text of a command

- **Dimension:** S4
- **Checks:** Where a rule must hold (no reading of secrets, no network tool, no push), is it enforced by something that does not depend on matching the command's text?
- **Why:** A deny rule on a program is bypassed by calling it by path, in a nested shell, or through a script that opens the file itself.
- **Evidence:** `file` (deny rules, and the sandbox or egress settings); `judgment` (each hard restriction has a second layer: an operating-system sandbox, a network allowlist, or a credential that lacks the right)
- **Severity:** 🟠; 🟡 when the restricted thing has no sensitive effect.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-AGENT-CS do's and don'ts (verified 2026-11-08)

### S4-004 — The agent's commands are confined by the operating system

- **Dimension:** S4
- **Checks:** Is the agent's shell confined by an operating-system sandbox (limited writes, network through an allowlist), and is the way out of it closed or narrowly listed?
- **Why:** Code the agent runs reads the home directory's credentials or posts data to an attacker's host, because nothing below the agent stops it.
- **Evidence:** `file` (the sandbox settings: on, cannot silently fall back, excluded commands, allowed domains, denied reads); `judgment` (the allowlist is short)
- **Severity:** 🟠 when the agent runs unattended or reads untrusted text; 🟡 for attended local sessions; 🔵 in a disposable machine.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS sandboxing (verified 2026-11-08); MCP-SEC local server compromise (verified 2026-11-08); OWASP-AGENTIC-TM T11 (verified 2026-11-08); OWASP-ASI ASI05 (verified 2026-11-08)

### S4-005 — No session has private data, untrusted text and a way out together

- **Dimension:** S4
- **Checks:** Is there no session type that can at once read private data, read text an attacker controls, and send data out; or is one of the three cut by design or gated by a person?
- **Why:** A comment in an issue tells the agent to collect private data and post it to an attacker's address, and the agent has all it needs.
- **Evidence:** `judgment` (per session type: the private data, the untrusted text, and the channels out; at least one is removed or gated)
- **Severity:** 🔴 when all three are open in an unattended session; 🟠 in an attended one.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** LETHAL-TRIFECTA (verified 2026-11-08); OWASP-PI agents and tools (verified 2026-11-08); NIST-AI-600-1 §2.9 (verified 2026-11-08); OWASP-AGENT-CS key risks (verified 2026-11-08)

### S4-006 — Every channel out is denied, listed or approved

- **Dimension:** S4
- **Checks:** Is each way the agent can send data out (network commands, a web tool, a rendered image or link, a write tool of a connected service) denied, limited to named hosts, or subject to approval?
- **Why:** Data is smuggled out in an address, an image, a public comment or an issue body without any prompt.
- **Evidence:** `file` (allowed domains, rules of the web tool, write tools of connected services); `judgment` (the list of channels is complete)
- **Severity:** 🟠; 🔴 together with readable secrets; 🟡 when only documentation hosts are reachable.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-PI exfiltration channels (verified 2026-11-08); LETHAL-TRIFECTA (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); RUNTIME-DOCS sandboxing (verified 2026-11-08)

### S4-007 — Outside text cannot give orders, in writing and in fact

- **Dimension:** S4
- **Checks:** Is text from outside the team (issues, pull request bodies, comments, pages, tool output, file names, invisible characters) treated in the instructions as data, and do the sessions that read it lack the authority to act on it without a person?
- **Why:** An issue with a hidden instruction makes the agent edit workflows, push, or disclose content.
- **Evidence:** `file` (the agent's instruction files, and the procedures that read such text); `judgment` (the boundary is stated, and authority is really absent in those sessions)
- **Severity:** 🟠; 🔴 on a public repository where anyone can file issues and an agent holds merge rights.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-LLM LLM01 (verified 2026-11-08); OWASP-PI indirect injection (verified 2026-11-08); OWASP-AGENT-CS input validation and prompt injection defense (verified 2026-11-08); NIST-AI-600-1 §2.9 (verified 2026-11-08); OWASP-AGENTIC-TM T6 (verified 2026-11-08); OWASP-ASI ASI01 (verified 2026-11-08)

### S4-008 — The boundary has been tested through a real channel

- **Dimension:** S4
- **Checks:** Has a planted payload been tried through a real outside channel (an issue, a page, a tool's result), repeated after the last change to prompts, tools or the runtime?
- **Why:** The rule exists on paper, and nobody knows whether the agent follows it when the text arrives through an issue.
- **Evidence:** `file` (the notes of the test, dated, with an instrumented destination); `judgment` (the test ran against the project's own systems, under the rules of engagement of the method)
- **Severity:** 🟡; 🟠 for a public repository with merge authority.
- **Applies:** project: agent-runtime
- **Decided by:** manual
- **Sources:** OWASP-PI smoke-testing your defenses (verified 2026-11-08); OWASP-AGENT-CS secure agent testing (verified 2026-11-08)

### S4-009 — Policy hooks are safe and fail closed

- **Dimension:** S4
- **Checks:** Do the hooks the project ships pass tool input without shell interpolation, block on failure or timeout where they are a policy gate, and exit with the code that really blocks?
- **Why:** A guard hook crashes or times out and the tool call proceeds, or tool-input text is interpolated into a shell string and runs.
- **Evidence:** `file` (the hook scripts and their configuration); `command` (run each with malformed, empty and hostile input, and read the exit code); `judgment` (no injection)
- **Severity:** 🟠; 🔴 when the hook is the only barrier to a protected branch.
- **Applies:** project: hooks
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS hooks (verified 2026-11-08); OWASP-AGENT-CS tool authorization middleware (verified 2026-11-08)

### S4-010 — No hard rule rests on a hook alone

- **Dimension:** S4
- **Checks:** Is each "never" rule also held by something outside the agent's machine or process, given that hooks may be disabled or absent in some session types?
- **Why:** A setting or a flag of the run switches hooks off, or a kind of hook does not run until a folder is trusted, and the rule does not apply.
- **Evidence:** `file` (the rules and their layers: the rule-to-check map); `judgment` (each "never" rule has a layer outside the agent)
- **Severity:** 🟠; 🟡 for conventions that are not about security.
- **Applies:** project: hooks
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS hooks (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-AGENT-CS tool authorization middleware (verified 2026-11-08)

### S4-011 — A hook does not put untrusted text into the agent's context

- **Dimension:** S4
- **Checks:** Is the context a hook adds factual, from trusted sources and bounded in size, with no text from outside?
- **Why:** A hook copies an issue title into the added context, giving attacker text the authority of instructions, kept in the saved transcript.
- **Evidence:** `file` (the hooks that emit context); `judgment`
- **Severity:** 🟡; 🟠 when the source is outside text.
- **Applies:** project: hooks
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS hooks (verified 2026-11-08); OWASP-AGENT-CS memory and context security (verified 2026-11-08)

### S4-012 — Unattended runs do not load settings from untrusted code

- **Dimension:** S4
- **Checks:** Does a headless run on code the team did not write avoid loading that code's settings (hooks, environment, allow rules, tool servers)?
- **Why:** A pull request adds a hook or a tool server, and a headless run in CI executes it before any person is asked.
- **Evidence:** `file` (the CI jobs that run an agent: which checkout, which sources of settings); `judgment` (untrusted contributions run with user or managed settings only)
- **Severity:** 🔴 when the job holds secrets or write tokens; 🟠 otherwise.
- **Applies:** project: unattended-agent
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS permissions (verified 2026-11-08); HOST-DOCS hardening of CI (verified 2026-11-08)

### S4-013 — Connected tool servers are listed, pinned and approved

- **Dimension:** S4
- **Checks:** Is each connected tool server listed, pinned to a source or version, approved by name, and from a known provider, with the list of what a session really loads equal to the list reviewed?
- **Why:** A server added through shared settings or a plugin runs local commands with the user's rights, or its tool descriptions steer the agent.
- **Evidence:** `file` (the files of servers, plugins and connectors at every scope); `command` (list the servers a session loads); `judgment` (trust)
- **Severity:** 🟠; 🔴 when a server has write scopes to production data.
- **Applies:** project: tool-servers
- **Decided by:** judged
- **Sources:** MCP-SEC local server compromise (verified 2026-11-08); RUNTIME-DOCS security (verified 2026-11-08); OWASP-LLM LLM03 (verified 2026-11-08); OWASP-AGENTIC-TM T16, T17 (verified 2026-11-08); OWASP-ASI ASI04 (verified 2026-11-08)

### S4-014 — Local tool servers are confined

- **Dimension:** S4
- **Checks:** Are the start commands of local tool servers shown in full, pinned and run with least privilege, using a local process or a protected socket and not an open local web port?
- **Why:** A malicious start command sends out a key file, or a web page reaches an open local server through DNS rebinding.
- **Evidence:** `file` (the configuration of each server: command, transport, bound address); `judgment`
- **Severity:** 🟠.
- **Applies:** project: tool-servers
- **Decided by:** judged
- **Sources:** MCP-SEC local server compromise (verified 2026-11-08); RUNTIME-DOCS sandboxing (verified 2026-11-08)

### S4-015 — Scopes of servers and tokens are minimal and split by risk

- **Dimension:** S4
- **Checks:** Are the permissions of each tool server and token minimal and split by risk (read apart from write, no wildcard scope, tokens meant for that server only, no passing a user's token through)?
- **Why:** A stolen broad token lets the attacker do everything the user can, across unrelated services.
- **Evidence:** `file` (scopes requested); `command` (the scopes of tokens where the service has a way to list them); `judgment`
- **Severity:** 🟠; 🔴 for administrator or organisation-wide scopes.
- **Applies:** project: tool-servers
- **Decided by:** judged
- **Sources:** MCP-SEC scope minimization (verified 2026-11-08); MCP-SEC token passthrough (verified 2026-11-08); OWASP-LLM LLM06 (verified 2026-11-08); OWASP-AGENT-CS tool security and least privilege (verified 2026-11-08)

### S4-016 — The host stops the agent at the protected branches

- **Dimension:** S4
- **Checks:** Does the agent's credential lack the power to push to protected branches or bypass their rules, with the host enforcing it and not only a text file?
- **Why:** An injected or mistaken agent pushes straight to the production branch, force-pushes, or merges a red change.
- **Evidence:** `command` (the rules and who may bypass them, and the type and scope of the agent's token, through the host adapter)
- **Severity:** 🔴 when the agent's credential can bypass; 🟠 when the bypass list includes the owner's token that the agent uses.
- **Applies:** project: agent-runtime
- **Decided by:** scriptable
- **Sources:** RUNTIME-DOCS security (verified 2026-11-08); OWASP-LLM LLM06 (verified 2026-11-08); OWASP-AGENT-CS human-in-the-loop controls (verified 2026-11-08)

### S4-017 — An agent's authority to merge is bounded

- **Dimension:** S4
- **Checks:** Is an agent's authority to merge bounded by named conditions, and is every consequential action (a merge to production, a release, a deletion, a publication) approved by a person or provably out of its reach?
- **Why:** A standing "merge without asking" combined with a manipulated issue ships an attacker's change.
- **Evidence:** `file` (the rules that grant merge authority, and the auto-merge settings); `command` (what the agent's identity can merge); `judgment` (the approval is tied to the exact action and lists what it covers)
- **Severity:** 🟠; 🔴 for merges to production with no person.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-AGENT-CS human-in-the-loop controls (verified 2026-11-08); OWASP-PI agents and tools (verified 2026-11-08); NIST-AI-600-1 §2.7 (verified 2026-11-08)

### S4-018 — Automation that starts an agent from CI is hardened

- **Dimension:** S4
- **Checks:** Do CI jobs that start an agent on issues, comments or pull requests declare minimal permissions, pass outside text as data, avoid checking out untrusted code under a privileged trigger, and pin their actions?
- **Why:** An attacker's issue title is spliced into a script, or a privileged workflow checks out a fork, and code runs with write tokens.
- **Evidence:** `file` (those CI definitions); `command` (a scanner of CI definitions)
- **Severity:** 🔴 for privileged triggers on untrusted input; 🟠 otherwise.
- **Applies:** project: unattended-agent
- **Decided by:** scriptable
- **Sources:** HOST-DOCS hardening of CI (verified 2026-11-08)

### S4-019 — An agent's claim does not alone release a consequential step

- **Dimension:** S4
- **Checks:** Before a consequential step (a merge, a release, an edit of many files), is an agent's report of success checked by something other than that agent: a test, a check of the state, another reviewer?
- **Why:** A plausible but false report ("the tests pass") drives the next action, and the error spreads through later steps or agents.
- **Evidence:** `file` (the procedures that act on an agent's report); `judgment` (each consequential step reads the state and not only the report)
- **Severity:** 🟡; 🟠 where several agents chain with no person.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-AGENTIC-TM T5 (verified 2026-11-08); OWASP-ASI ASI08 (verified 2026-11-08)

### S4-020 — Persistent instructions are reviewed like code

- **Dimension:** S4
- **Checks:** Are the instruction files, skills, saved notes and settings an agent loads reviewed like code and protected from being rewritten by the agent itself?
- **Why:** An injected agent writes a rule into its own instructions or memory, and it persists into every later session.
- **Evidence:** `file` (who can change these files, protected paths, the review rule); `judgment` (the agent cannot silently edit its own permissions)
- **Severity:** 🟠; 🔴 when the agent can write its own allow rules or hooks and nothing reviews them.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-AGENT-CS memory and context security (verified 2026-11-08); RUNTIME-DOCS security (verified 2026-11-08); RUNTIME-DOCS sandboxing (verified 2026-11-08); OWASP-AGENTIC-TM T1 (verified 2026-11-08); OWASP-ASI ASI06 (verified 2026-11-08)

### S4-021 — Delegation does not widen authority

- **Dimension:** S4
- **Checks:** When an agent delegates to subagents or other sessions, is the authority no greater than the delegator's, are their messages treated as untrusted, and are loops and fan-out bounded?
- **Why:** A subagent that read a hostile page returns instructions that the parent obeys, or inherits wider tools than the task needs.
- **Evidence:** `file` (definitions of subagents: tools, modes; the orchestrator's procedures; limits on depth, count and cost); `judgment`
- **Severity:** 🟠; 🟡 when all delegates are read-only.
- **Applies:** project: multi-agent
- **Decided by:** judged
- **Sources:** OWASP-AGENT-CS multi-agent security (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-AGENTIC-TM T3, T12, T14 (verified 2026-11-08); OWASP-ASI ASI03, ASI07 (verified 2026-11-08)

### S4-022 — The agent's actions can be reconstructed

- **Dimension:** S4
- **Checks:** Are tool calls, approvals and changes of settings recorded where the agent cannot write them, with secrets redacted and a stated retention?
- **Why:** After an incident nobody can tell which action came from an injected session, or whether a rule was overridden.
- **Evidence:** `file` (the logging settings, a sample of retained logs, the alert rules); `judgment`
- **Severity:** 🟡; 🟠 for projects with production authority.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-AGENT-CS monitoring and observability (verified 2026-11-08); RUNTIME-DOCS security (verified 2026-11-08); OWASP-LLM LLM06 (verified 2026-11-08); OWASP-AGENTIC-TM T8 (verified 2026-11-08)

### S4-023 — Approval prompts stay meaningful

- **Dimension:** S4
- **Checks:** Is the allow list short enough to be read, with no blanket "always allow" accumulated over time, and reviewed at a stated interval?
- **Why:** Prompt fatigue leads people to approve everything, or old entries silently widen authority.
- **Evidence:** `file` (the shared and the local allow lists, and their history); `judgment` (no stale or very broad entry)
- **Severity:** 🟡; 🟠 when broad entries cover write or network.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** OWASP-PI agents and tools (verified 2026-11-08); RUNTIME-DOCS security (verified 2026-11-08); RUNTIME-DOCS permissions (verified 2026-11-08); OWASP-AGENTIC-TM T10 (verified 2026-11-08); OWASP-ASI ASI09 (verified 2026-11-08)

### S4-024 — The agent set-up has abuse tests, and its instructions hold no secret

- **Dimension:** S4
- **Checks:** Do the project's tests include abuse cases for its agents (override through outside text, tool misuse, escalation, poisoned memory, exfiltration, runaway loops, bypassed approval), run after changes to prompts, tools, hooks or policies, and are the instruction files free of secrets?
- **Why:** A change to hooks or instructions weakens a control and nothing notices; or a leaked instruction file exposes a credential.
- **Evidence:** `file` (the abuse cases and the release gate); `command` (the secret scan of the instruction and prompt files); `judgment`
- **Severity:** 🟡; 🟠 where instruction files hold tokens or internal addresses.
- **Applies:** project: agent-runtime
- **Decided by:** manual
- **Sources:** OWASP-AGENT-CS secure agent testing (verified 2026-11-08); OWASP-LLM LLM07 (verified 2026-11-08)

### S4-025 — Policy cannot be changed by a session, and unattended runs have limits

- **Dimension:** S4
- **Checks:** Are the non-negotiable guards set at a level a session cannot change (managed or server side), and do unattended runs have a limit on cost and iterations?
- **Why:** A repository setting or a session flag removes a guard, or a runaway loop spends money or hammers a service.
- **Evidence:** `file` (managed settings, the limits of automation); `judgment` (for a solo project the managed level may not apply; the limits still do)
- **Severity:** 🟡; 🟠 with many contributors or unattended jobs.
- **Applies:** project: agent-runtime
- **Decided by:** judged
- **Sources:** RUNTIME-DOCS security (verified 2026-11-08); RUNTIME-DOCS hooks (verified 2026-11-08); OWASP-AGENT-CS do's and don'ts (verified 2026-11-08); OWASP-LLM LLM10 (verified 2026-11-08); OWASP-AGENTIC-TM T4 (verified 2026-11-08)

### S4-026 — The context a hook adds is counts and identifiers, read by a script

- **Dimension:** S4
- **Checks:** Does the output of each hook that adds context hold only counts, numbers, names of files and identifiers, and none of the text of an issue, a report, a pull request, a commit message or a comment from outside?
- **Why:** The scriptable half of S4-011: a script that runs the hooks against a sample and lists the lines that carry free text finds the copy of an outsider's title that a reading of the code can miss.
- **Evidence:** `command` (the hook run on a sample of the session start; the lines of its output that are not counts, numbers or identifiers)
- **Severity:** 🟡; 🟠 when a line carries outside text.
- **Applies:** project: hooks
- **Decided by:** scriptable
- **Sources:** RUNTIME-DOCS hooks (verified 2026-11-08); OWASP-AGENT-CS memory and context security (verified 2026-11-08)

## Sources

| Id | Name | Edition | Address |
| -- | ---- | ------- | ------- |
| HOST-DOCS | The security documentation of the project's repository host | as listed by the adapter | `security.md` in the folder of the project's host adapter |
| LETHAL-TRIFECTA | Simon Willison, The lethal trifecta for AI agents | 2025-06-16 | https://simonwillison.net/2025/Jun/16/the-lethal-trifecta/ |
| MCP-SEC | Model Context Protocol, Security Best Practices | for the specification of 2026-07-28 | https://modelcontextprotocol.io/docs/tutorials/security/security_best_practices |
| NIST-AI-600-1 | NIST AI 600-1, Generative AI Profile | July 2024 | https://nvlpubs.nist.gov/nistpubs/ai/NIST.AI.600-1.pdf |
| OWASP-AGENT-CS | OWASP AI Agent Security Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/AI_Agent_Security_Cheat_Sheet.html |
| OWASP-AGENTIC-TM | OWASP Agentic AI, Threats and Mitigations | version 1.1, December 2025 | https://genai.owasp.org/resource/agentic-ai-threats-and-mitigations/ |
| OWASP-ASI | OWASP Top 10 for Agentic Applications | 2026 (December 2025); the description of each entry was read | https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/ |
| OWASP-LLM | OWASP Top 10 for LLM Applications | 2025 | https://genai.owasp.org/llm-top-10/ |
| OWASP-PI | OWASP LLM Prompt Injection Prevention Cheat Sheet | the page has no edition; read as published on the date of verification | https://cheatsheetseries.owasp.org/cheatsheets/LLM_Prompt_Injection_Prevention_Cheat_Sheet.html |
| RUNTIME-DOCS | The security documentation of the project's agent runtime | as listed by the adapter | `security.md` in the folder of the project's agent-runtime adapter |
