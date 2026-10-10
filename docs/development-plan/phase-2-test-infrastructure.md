[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 2 — Test infrastructure & coverage backfill (39 SP)

Stand up the mandated tooling and bring the *existing* code to the coverage gate before building more features.

| # | Task                                                                                                   | SP |
| --- | ----------------------------------------------------------------------------------------------------- | -- |
| 2.1 | Jest for the client (api Jest and `mongodb-memory-server` came with Phase 0): (`next/jest` with `jsdom`, `moduleNameMapper` for the `@lib` alias and style files, `NEXT_PUBLIC_*` env), `@testing-library/react`, Cypress; add `test`/`test:coverage` scripts | 2 |
| 2.2 | Configure Jest coverage thresholds ≥ 97 % (statements/branches/functions/lines) **per package** (`api`, `client`); configure `collectCoverageFrom` with the single justified exclusion list (entry/bootstrap, config, type-only, generated) | 1 |
| 2.3 | Unit tests — `api` utils (`keywords`, `jwt`, `decorators`, `utils`, `api`), middlewares, validation schemas, `Module` base + `ScannerModule` (with injected repo fakes) | 8 |
| 2.4 | Integration tests — repositories and services against in-memory Mongo (`users`, `bots`, `map`, `modules`) | 8 |
| 2.5 | Integration tests — controllers/routers via `supertest` (auth login/refresh/logout, signup, verify email, deploy base, scan, users list) | 8 |
| 2.6 | Client unit/component tests — store slices, RTK Query `baseQueryWithRefresh`, auth hooks, validation rules, `AppRoutes` | 5 |
| 2.7 | E2E (Cypress) — signup→verify→deploy base→terminal; login→terminal `list`/`modules` | 5 |
| 2.8 | Wire coverage reporting into CI; add pre-push hook enforcing the gate locally | 2 |

**Exit criteria:** global coverage ≥ 97 % on all existing code; unit + integration + e2e all run in CI and locally;
`npm test` is a first-class command.
