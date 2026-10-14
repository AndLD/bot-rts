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

### 2026-10-15 — task 9.2 metrics history and alerting
- **Tasks:** 9.2
- **Branch:** `feature/9.2-metrics-history-alerting` — done
- **Decisions / deviations from the plan:** a new `monitoring` feature module. `MetricsPort` (`RuntimeMetricsPort`) samples the engine through the engine port (so any node can), the HTTP counters of `HttpMetrics` (new `totals()`), and the process; rates and the latency percentile are computed between two samples. `MetricHistory` is a ring buffer per tier (10 s for 7 days, one-minute averages for 30 days, both tunable), in the memory of the process: each node keeps its own history and the console shows the node that answers (a database-backed store is the follow-up if that is not enough). The alert rules and default thresholds of design §25.5 that have a metric today are in `monitoring/domain/metric-catalog.ts` (engine up, tick p95 > 80 % of the interval, overrun rate > 1 %, 5xx share, latency, scheduler wait); the database, market, jobs and infrastructure (disk, backup) metrics of §25.5 are not sampled yet because their sources do not exist, and join by adding catalog entries. Thresholds can be overridden with `ADMIN_ALERT_THRESHOLDS`. A red alert is emailed to `ADMIN_ALERT_EMAILS` (the owner is not looked up; empty means no email). The Prometheus endpoint already existed (8.3); it gains `botrts_alerts_open`.
- **Problems / blockers / findings:** the CI gate also checks coverage per changed file (97 %), not only the package totals; check it with `node scripts/check-changed-coverage.mjs origin/develop api client` before pushing.
- **Next step:** 9.3, the dashboard page.
- **Verify with:** `npx jest --selectProjects integration --testPathPattern monitoring.int` and `npx jest src/monitoring` from `api`

