# Security notes of the runtime adapter: Claude Code

For the security review ([the method](../../../core/reviews/security/README.md), [the catalogue](../../../core/reviews/security/probes/README.md)): what the source id `RUNTIME-DOCS` of a probe stands for on this runtime, and the name of the feature for each probe. Read on 2026-11-08.

## The pages behind `RUNTIME-DOCS`

| Cited as | Page | Address | How much was read |
| -------- | ---- | ------- | ----------------- |
| security | Security | https://code.claude.com/docs/en/security | all |
| permissions | Configure permissions | https://code.claude.com/docs/en/permissions | most; one sentence on the limits of shell reads was cut off |
| hooks | Hooks reference | https://code.claude.com/docs/en/hooks | about a third, the parts on blocking, trust and security |
| sandboxing | Sandboxing | https://code.claude.com/docs/en/sandboxing | all but the end of the page |

## The feature for each probe

| Probe | The feature of this runtime |
| ----- | ---- |
| S1-015 | deny rules on the file tools, sandbox filesystem isolation; the limits of deny rules for the shell |
| S1-016 | the folder of session data under the configuration directory (from AGENT-TRANSCRIPTS; the page on security does not give it) |
| S1-017 | the project-scoped file of tool servers |
| S4-001 | permission modes, the default mode, the mode that skips the checks |
| S4-002 | allow rules for the shell and their patterns |
| S4-003 | the documented limits of deny rules |
| S4-004 | sandbox settings; what stays outside the sandbox (file tools, hooks, tool servers) |
| S4-006 | web tool rules, the sandbox's allowed domains |
| S4-009 | the blocking exit code; hooks proceed on failure unless set to fail closed; exec and shell forms |
| S4-010 | hook sources and trust; the setting that disables all hooks |
| S4-011 | added context from hooks, replayed on resume |
| S4-012 | workspace trust is not shown in headless runs; the flags that choose the sources of settings |
| S4-013 | the project's file of tool servers, approvals, managed configuration |
| S4-014 | local servers run outside the sandbox |
| S4-016 | a push is limited by the host's rules, and a rule that the connected access can bypass does not stop it |
| S4-020 | protected paths, the configuration-change hook, managed settings |
| S4-021 | subagent rules and tool lists |
| S4-022 | telemetry, the configuration-change hook, the hook after a tool runs |
| S4-023 | the audit of permissions, "don't ask again" entries, the local settings |
| S4-025 | managed settings, managed hooks and tool servers |
