[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 2 — Test infrastructure & coverage backfill (43 SP)

**Status:** ✅ Done · **Branches:** see (see the [implementation log](#implementation-log)) · **Work log:** [phase-2-log](./work-logs/phase-2-log.md)

Stand up the mandated tooling and bring the *existing* code to the coverage gate before building more features.

| # | Task                                                                                                   | SP | Status |
| --- | ----------------------------------------------------------------------------------------------------- | -- | --- |
| 2.1 | Jest for the client (api Jest came with Phase 0, the PostgreSQL test database with Phase 1): (`next/jest` with `jsdom`, `moduleNameMapper` for the `@lib` alias and style files, `NEXT_PUBLIC_*` env), `@testing-library/react`, Cypress; add `test`/`test:coverage` scripts. Cypress is `client/cypress`, run by `npm run e2e` | 2 | ✅ |
| 2.2 | Configure Jest coverage thresholds ≥ 97 % (statements/branches/functions/lines) **per package** (`api`, `client`); configure `collectCoverageFrom` with the single justified exclusion list (entry/bootstrap, config, type-only, generated) | 1 | ✅ |
| 2.3 | Unit tests — `api` utils (`keywords`, `jwt`, `decorators`, `utils`, `api`), middlewares, validation schemas, `Module` base + `ScannerModule` (with injected repo fakes) | 8 | ✅ |
| 2.4 | Integration tests — use cases and services against PostgreSQL in Docker (`users`, `bots`, `map`, `modules`); the repositories themselves are tested with task 1.1a | 8 | ✅ |
| 2.5 | Integration tests — remaining controller slices beyond the golden flows of task 1.9 (users list, validation and error paths, role and permission checks) | 8 | ✅ |
| 2.6 | Client unit/component tests — the terminal command interpreter and `useTerminal` (split out in task 1.8), the i18n helpers `detectLocale` / `withFallback` (1.17), the route access rules `resolveRedirect` (1.18a), store slices, RTK Query `baseQueryWithRefresh`, auth hooks, validation rules, `AppRoutes` | 5 | ✅ |
| 2.7 | E2E (Cypress) — account flows: sign up → verify email → inactive page → verified; login, logout and token refresh; banned and forbidden users; deploy base → terminal; `list` / `modules` (matrix: testing-strategy.md); also duplicate email, weak password, expired or reused verification link, login rate limiting and lockout, a banned user cut off mid-session, forgot / reset / change password, change email, delete account | 9 | ✅ |
| 2.8 | Wire coverage reporting into CI; add pre-push hook enforcing the gate locally | 2 | ✅ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** coverage ≥ 97 % per package on all existing code; unit + integration + e2e all run in CI and locally;
`npm test` is a first-class command.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/2.1-client-jest-and-thresholds` | 2.1 (Jest part), 2.2, 2.6 | [#44](https://github.com/AndLD/bot-rts/pull/44) | merged |
| `feature/2.8-coverage-ci-and-pre-push` | 2.8 | [#45](https://github.com/AndLD/bot-rts/pull/45) | merged |
| `feature/2.7-cypress-e2e` | 2.1 (Cypress), 2.3–2.5 (audit), 2.7 | [#46](https://github.com/AndLD/bot-rts/pull/46) | merged |
