[← Phase 2 — Test infrastructure & coverage backfill](../phase-2-test-infrastructure.md)

# Phase 2 — Test infrastructure & coverage backfill — work log

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

### 2026-10-11 — client Jest, coverage gate and client tests
- **Tasks:** 2.1 (Jest part), 2.2, 2.6
- **Branch:** `feature/2.1-client-jest-and-thresholds` — done
- **Findings at the start:** the `api` package already stood at 100 % (statements, branches, functions, lines) with 255 tests, because Phase 1 ported the legacy code and ships tests with every task; the legacy modules named in task 2.3 (`keywords`, `jwt`, `decorators`, `utils`, `api`, middlewares) no longer exist. Tasks 2.3–2.5 therefore reduce to an audit (next).
- **Decisions:** the client uses `next/jest` + `jsdom`; the config wraps `next/jest` to also transform `next-intl` / `use-intl` / `@formatjs` (ES modules only). The threshold (97 % x4) is in `client/jest.config.ts` and applies with `npm run test:coverage`. Exclusions, each with its reason in the config: `src/app/**/page.tsx` (route files that re-export a tested component) and `src/app/layout.tsx` (renders `<html>`). Network is stubbed at the `baseQueryWithRefresh` seam (jsdom has no `fetch`), so the real RTK Query endpoints and `createLocalAuthClient` are exercised. Result: 192 tests, 99.7 % statements / 99.3 % branches / 100 % functions / 99.8 % lines.
- **Bug found by the tests and fixed:** `LinkResultPage` never confirmed (it spun forever) when the emailed link had no `token`, because its once-only guard started as `null`; `ResetPasswordPage`'s form is now a child that receives a non-null token.
- **Next step:** audit tasks 2.3–2.5 against the API (add the missing controller error/permission paths), then 2.8 (CI and pre-push hook), then Cypress (2.1 rest and 2.7).
- **Verify with:** `npm run typecheck && npm run lint && npm run test:coverage -w client`

