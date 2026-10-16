[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 14 — Admin MCP: AI-assisted investigation (19 SP)

**Status:** ⬜ Not started · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-14-log](./work-logs/phase-14-log.md)

**Proposed and decided with the owner 2026-10-16.** Lets an AI assistant investigate the running project through the MCP server (`mcp/`): search the logs,
follow traces, read the health and the metrics, check the audit trail and run a health check. It adds no new data access: it exposes
the read-only admin endpoints of Phases 9 and 13 to a tool-calling client.

**Design decision (owner, 2026-10-16): no separate credential type.** An **API key can carry admin read scopes** (`admin:logs:read`, `admin:metrics:read`,
`admin:audit:read`, `admin:health:read`). Such scopes are granted **only from the admin console** (after two-factor authentication), never by the
public key-creation endpoint. The rule "admin routes are never reachable with API keys" (AGENTS.md §9, design §25.2, API reference) becomes: admin
routes are closed to API keys **except routes that opt in with an `admin:*:read` scope**. Rules for these keys:

1. The owner of the key must still hold an admin role and not be banned **on every call** (roles come from the database, never from the credential), so demoting
   the admin neutralises their keys at once.
2. Read-only scopes only (no write scope in this phase), a **mandatory expiry** (days, not forever; the maximum is a setting) and an optional IP allowlist.
3. Every call is written to the audit trail with the key id and its owner.
4. Such keys are listed and revoked only from the admin console, not in the player's own key list. **Players never see admin scopes anywhere:** the admin scopes live in a separate admin-only set (not in the player scope list of `lib` that the key form, the generated client and the player documentation are built from), the player scope endpoint and the key-creation form list player scopes only, and the public OpenAPI spec and the player docs omit them; the admin set is visible only in the admin console and the admin documentation.
5. Per-call two-factor authentication is not possible for a key; this is accepted and recorded in the design.

**Safeguards for AI use.** Log and script-output text is written by players, so every tool result is **untrusted data**: tools mark it as data, player-controlled
fields are truncated, personal data is redacted by the API (not by the MCP server), results are size-capped and rate-limited. Write actions (ban, kill a
script, restart) are out of scope; adding them later needs a separate scope and a human confirmation step.

**Depends on:** Phase 9 (admin console, 2FA, audit), Phase 13 (log search, traces, metrics history), 8.x (API keys, scopes, the MCP server).
**Order:** after Phase 13; independent of Phase 10 and can be moved by the owner.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 14.1 | **Admin read scopes on API keys.** The scope set above; the key-creation endpoint rejects any `admin:*` scope; a console-only grant endpoint (admin role, two-factor, a reason) with a mandatory expiry and an optional IP allowlist; the composite guard checks the owner\'s admin role and ban state on every call; per-route opt-in so every other `/admin/*` route stays closed to keys; admin keys excluded from the player's key list; the admin scopes kept in a separate admin-only set so the player key form, the generated client, the public OpenAPI spec and the player documentation list player scopes only (a test over each surface proves no `admin:` scope appears); audit entries carry the key id. A test proves that a player cannot obtain or escalate to an admin scope by any route, and that demoting the owner stops the key at once. AGENTS.md §9, design §25.2, `integrations/API.md` and the README are amended in the same PR | 6 | ⬜ |
| 14.2 | **Read-only operations API for the assistant.** The endpoints of the log search, trace, metrics history, health, engine status and audit viewer opt in with their scopes; one new `GET /api/v1/admin/health-check` composes the current alerts, tick and overrun figures, the script-kill count, the flush time and the store status into one summary; size caps, truncation of player-controlled fields, redaction check over a corpus, OpenAPI and the generated client updated | 4 | ⬜ |
| 14.3 | **Admin tools in the MCP server.** `search_logs`, `get_trace`, `slowest_traces`, `get_health`, `get_metrics`, `list_audit_events`, `get_engine_status`, `run_health_check`; registered only when the key carries admin scopes; every result is wrapped as untrusted data; tests with a fake API, including an injection corpus in log text; the tool list in the MCP documentation (English and Russian) | 6 | ⬜ |
| 14.4 | **Console page for admin keys, documentation and e2e.** A page in the console to create, list and revoke admin keys (reason, expiry, IP allowlist, two-factor step), English and Russian strings, an admin documentation page and a runbook section ("investigate with an AI assistant"), a Cypress spec in the e2e matrix, a `CHANGELOG.md` line | 3 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** an admin creates a read-only admin key in the console and an MCP client using it can search the logs, open a trace, read the health and the
metrics, list the audit trail and run the health check; a player key cannot reach any of it; demoting or banning the owner stops the key at once; every call is audited with the key id;
tool results are marked as untrusted data; the coverage gate (≥ 97 %) stays green.

## Implementation log

Branches and pull requests that implemented this phase\'s tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
