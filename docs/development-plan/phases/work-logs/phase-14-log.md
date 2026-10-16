[← Phase 14 — Admin MCP](../phase-14-admin-mcp.md)

# Phase 14 — Admin MCP — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 14.x, 14.y
- **Branch:** `feature/14.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-16 — phase proposed
- **Tasks:** none started; 14.1 to 14.4 are proposed
- **Branch:** `docs/12-button-styling-issue` — the plan only
- **Decisions / deviations from the plan:** the owner wants an MCP for the admin console so that an AI can investigate logs, audits, health and performance. Three ways were weighed:
  a separate MCP package with its own operator token, an MCP straight on Elasticsearch (rejected: bypasses the privacy and access rules of 13.5 and the rule that MCP only calls the public API),
  and an MCP using an admin session (rejected: brittle, blurs the audit). The owner chose the first, then simplified it: no new token type; an API key with admin read scopes, granted only from the console.
  The rule "admin routes are never reachable with API keys" is amended by task 14.1, not before.
- **Problems / blockers / findings:** none.
- **Next step:** start 14.1 when the owner asks; first write the test that a player cannot obtain an `admin:*` scope.
- **Verify with:** `npm run docs:check`
