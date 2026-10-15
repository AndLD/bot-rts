[← Phase 2 — Test infrastructure & coverage backfill](../phases/phase-2-test-infrastructure.md)

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


### 2026-10-11 — task 2.8: coverage gate in CI and a pre-push hook
- **Tasks:** 2.8
- **Branch:** `feature/2.8-coverage-ci-and-pre-push` — done
- **Decisions:** the `api` Jest config now carries the same 97 % thresholds as the client, so `npm run test:coverage` (already the CI step) fails below the gate in either package. CI reports both packages in the job summary and runs the changed-files check on `api` and `client`. `.githooks/pre-push` (installed by the root `prepare` script through `core.hooksPath`) starts the database, typechecks and runs `test:coverage`; it is skipped for pushes that change only Markdown, and `git push --no-verify` bypasses it once.
- **Next step:** audit tasks 2.3–2.5 against the API, then Cypress (2.1 rest, 2.7).
- **Verify with:** `npm run test:coverage` (both packages must pass their thresholds)

### 2026-10-11 — tasks 2.3–2.5 audit, Cypress (2.1) and the account-flow e2e (2.7)
- **Tasks:** 2.1 (Cypress), 2.3, 2.4, 2.5, 2.7
- **Branch:** `feature/2.7-cypress-e2e` — done
- **Audit of 2.3–2.5:** the API was already at 100 % (Phase 1 ported the legacy code with tests). Every route has an integration test of its happy path, validation errors and the role / permission matrix (`api.int.test.ts`: auth flows, authorization, bots over HTTP and Socket.IO; `rate-limit.int.test.ts`; `app.int.test.ts`; repository suites). The legacy modules named in 2.3 no longer exist. No new API tests were needed; the gate now enforces it.
- **E2E stack (`npm run e2e`, `scripts/e2e.mjs`):** drops and recreates the database `botrts_e2e`, migrates it, builds and starts the client, starts the API with `EMAIL_OUTBOX_DIR`, runs Cypress, stops everything. `--open` opens the runner, `--skip-build` reuses the client build. New API adapter `OutboxEmailSender` (config `EMAIL_OUTBOX_DIR`, takes priority over SMTP) writes each email as a JSON file so specs can follow the links; Cypress tasks read the outbox and change user status / expire links directly in the database.
- **Specs (29 tests):** `signup` (sign up → verify → inactive page → login; resend; duplicate email; weak password; expired and reused link), `session` (login, reload, logout, wrong password, token refresh, no refresh cookie, banned at login and mid-session, rate limit at the API, 429 shown to the player), `account` (forgot/reset, change password incl. wrong current one, change email, invalid link, delete account), `terminal` (no base, `list`, `modules`, unknown command, `clear`, shell, `exit`).
- **Decisions / deviations:** there is no login lockout in the API, only the per-address rate limit, so the "lockout" item is covered by the 429 behaviour. The browser's requests share one address; the API of the e2e run therefore allows 200 auth requests per window, and the rate-limit spec sends requests from an address of its own (`TRUST_PROXY=true`, `X-Forwarded-For`). Cypress 16 uses `Cypress.expose` instead of `Cypress.env`. CI has a separate `e2e` job; screenshots and server logs are kept when it fails.
- **Bug found by the e2e run and fixed:** the account endpoints used `responseHandler: 'text'`, so a failed request lost its error code and the player saw "Something went wrong" instead of e.g. "The current password is wrong"; they now use `'content-type'`.
- **Phase 2 exit criteria:** coverage ≥ 97 % per package (api 100 %, client 99.7 %); unit, integration and e2e run in CI and locally; `npm test` works.
- **Next step:** Phase 2 is complete; Phase 3 when requested. The `e2e` job should be added to the required checks of `develop` once it has run green on `develop`.
- **Verify with:** `npm run db:up && npm run test:coverage && npm run e2e`

### 2026-10-11 — Phase 2 complete
- All tasks are done and merged (#44, #45, #46); the exit criteria hold: coverage ≥ 97 % per package (api 100 %, client 99.7 %), unit, integration and e2e run in CI and locally, `npm test` is a first-class command.
- **Next step:** Phase 3 when requested; add the `e2e` job to the required checks of `develop`.
