[← Phase 9 — Admin console](../phase-9-admin-console.md)

# Phase 9 — Admin console — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-14 — task 9.1 admin foundations
- **Tasks:** 9.1
- **Branch:** `feature/9.1-admin-foundations` — done
- **Decisions / deviations from the plan:** roles are the `UserStatus` values (`owner`, `admin`, plus the new `moderator` and `analyst`); the permission catalogue and the role sets are in `lib/utils/admin.ts` (shared with the client, and the source for the generated tables of 9.15). The second factor is TOTP (RFC 6238, own implementation over `crypto`, no new dependency) with a secret encrypted at rest (AES-256-GCM, key from `ADMIN_SECRET`, falling back to `JWT_ACCESS_SECRET`) and eight single-use recovery codes. A session is verified per session id (`admin_session_verifications`, valid for `ADMIN_2FA_TTL`, default 8 h), a code step cannot be replayed. `AdminAccessGuard` (after authentication) checks the address allow-list (`ADMIN_IP_ALLOWLIST`), the role's permission and the verification; `@RequirePermission` marks a route and also marks it session-only (API keys never reach it). `AuditInterceptor` writes the entry before the response leaves, for every non-GET admin call and every read marked `@Audited`; refusals are audited by the guard. The table `admin_audit_log` is append-only by trigger (update, delete, truncate), with no foreign key to users so the trail outlives accounts. The legacy `GET /api/v1/admin/statistics` is removed (and the dead `countByStatus`); no debug endpoint existed any more (removed by 0.8), 9.12 adds the new dev tools. The client has the `(admin)` route group (not indexed), the shell with the menu filtered by permission, and the enroll and verify screens. `users` list and update endpoints still use `RequireRole`; 9.4 replaces them with permissions.
- **Problems / blockers / findings:** none.
- **Next step:** 9.2, metrics history and alerting (`MetricsPort` over the 8.3 metrics).
- **Verify with:** `npx jest --selectProjects integration --testPathPattern admin.int` and `npx jest src/admin` from `api`; `npm test -w client -- admin`

