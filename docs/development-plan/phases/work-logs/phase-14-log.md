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

### 2026-10-16 — 14.1 admin read scopes implemented
- **Tasks:** 14.1
- **Branch:** `feature/14.1-admin-read-scopes` — WIP until its PR merges
- **Decisions / deviations from the plan:** admin scopes live in `lib/utils/admin-api-keys.ts` (`ADMIN_API_SCOPES`, outside `API_SCOPES`). Keys carry `is_admin_key`, `grant_reason` and `ip_allow_list` (migration `admin_api_keys`); the audit trail gets `api_key_id`. New permission `apikeys.admin` (owner, admin). `RequirePermission(permission, { adminKeyScope })` opts a route in; the public spec still says "session only" for it and the DTOs of the grant endpoints use plain strings, so no spec or client lists an `admin:` scope. `ApiKeyService.authenticate` rejects an admin key whose owner is no longer an admin, and `AdminAccessGuard` re-checks the permission and skips the second factor for keys. The audit list (`GET /admin/audit`) opts in now as the proof route; 14.2 opts in the rest. Config: `ADMIN_API_KEY_MAX_DAYS` (default 30, at most 365).
- **Problems / blockers / findings:** the plan PR was opened twice by mistake (200 and 201); 201 was closed as a duplicate.
- **Next step:** merge 14.1, then start 14.2 (opt in the log, trace, metrics, health, engine and audit routes; add `GET /admin/health-check`).
- **Verify with:** `npm run test:coverage -w api`, `node scripts/check-changed-coverage.mjs origin/develop api client`, `npm run lint -w api`, `npm run check:boundaries`

### 2026-10-16 — 14.2 operations API for the assistant
- **Tasks:** 14.2
- **Branch:** `feature/14.2-admin-ops-api` (stacked on `feature/14.1-admin-read-scopes`, PR #202) — WIP until its PR merges
- **Decisions / deviations from the plan:** scope map: logs (search, nodes, slow queries, slow ticks, traces) → `admin:logs:read`; monitoring series and nodes → `admin:metrics:read`; monitoring health and alerts, `supervision/state` (engine status) and the new `GET /admin/health-check` → `admin:health:read`; audit list → `admin:audit:read` (14.1). A global `AssistantOutputInterceptor` shapes every answer given to an admin key: `shapeForAssistant` redacts every string again with `lib` `redact`, cuts strings at 1000 characters and refuses answers over 200 000 bytes with 413. The summary is composed by `composeHealthCheck` from the last sample; "store status" is the status of the database area plus whether the log gateway answers. Rate limiting is the per-key limit of 14.1.
- **Problems / blockers / findings:** none.
- **Next step:** 14.3, the admin tools in `mcp/` (register them only when the key carries admin scopes; wrap results as untrusted data).
- **Verify with:** `npm run test:coverage -w api`, `node scripts/check-changed-coverage.mjs origin/feature/14.1-admin-read-scopes api client`
