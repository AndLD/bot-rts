[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 0 — Stabilize & CI foundation (24 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-0-log](./work-logs/phase-0-log.md)

Fix the build and establish a repeatable, gated pipeline. **Nothing else is safe to start before this.**

**Execution order:** 0.1 → 0.2 → 0.3 → **0.8 (security hotfix)** → 0.7 (local PostgreSQL, needed before Phase 1 starts moving off MongoDB) → 0.4 → 0.5 → 0.6. The prototype is not deployed anywhere, so 0.8 is a normal `feature/` branch; if the code were ever deployed before it lands, it would ship as a `hotfix/` branch from `main`.

| # | Task                                                                                          | SP | Status |
| --- | -------------------------------------------------------------------------------------------- | -- | --- |
| 0.1 | Fix broken client imports (`client/src/utils/jwt.ts` → `@lib/utils/interfaces/users`, `client/src/utils/store.ts` → `@lib/utils/interfaces/auth`); fix the remaining `tsc` errors (unused `beautify`, `setDrives`, `replyAsync` in `Terminal.tsx`, unused `FileEditor` import in `Game.tsx`); make `npm run build --prefix client` green | 2 | ✅ |
| 0.2 | Align JWT env keys with code (or vice versa), unify `JWT_REFRESH_EXPIRES_IN` / `REFRESH_JWT_EXPIRES_IN`, document `ADMIN_URL`, add `api/.env.example`, document all env vars in README; make SMTP configurable (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, user/pass) behind an `EmailSender` interface, Gmail only as a dev default | 3 | ✅ |
| 0.3 | Add root scripts (`lint`, `typecheck`, `test`, `build`) by adopting **npm workspaces** for `api`/`client`/`lib`, including the `api` Jest setup (`ts-jest`, `supertest`) (single root install and lockfile, `lib` as a workspace package) | 4 | ✅ |
| 0.4 | Add `api` ESLint + a shared Prettier check; wire `npm run lint`/`typecheck` into both packages | 2 | ✅ |
| 0.5 | Set up CI (GitHub Actions, with a PostgreSQL service container for integration tests): install → lint → typecheck → markdown link check (including a check that no linked file is git-ignored) → unit/integration; coverage is reported from day one (non-blocking) and a changed-files coverage check (≥ 97 % on files touched by the PR) is blocking from Phase 1 on; the e2e stage and the full per-package gate are switched on in Phase 2 (tasks 2.2, 2.7, 2.8) | 4 | ⬜ |
| 0.6 | Protect `main` and `develop` (`develop` already exists), enforce PR + Conventional Commits; turn off automatic deletion of merged branches (branches are kept for history) | 1 | ⬜ |
| 0.7 | **Local PostgreSQL in Docker**: `docker-compose.yml` with a pinned PostgreSQL image, named volume and healthcheck; `db:up` / `db:down` / `db:reset` scripts; `DATABASE_URL` in `.env.example`; README setup section | 3 | ✅ |
| 0.8 | **Security hotfix for the legacy API** (findings in design §25.1): (a) `GET /api/private/users` and `PUT /api/private/users/:id` become admin-only, the update accepts a whitelist of fields (`status`, `password` and `active` only by an owner), and the client-supplied JSON filter is replaced by typed filters; (b) the admin check reads the user's *current* role from the database instead of trusting the token, and banned or unverified users are rejected on every private route and at login / refresh (the existing `isActive` / `hasUserStatus` guards are not used anywhere); (c) `DELETE /api/private/debug/collections` is disabled outside development; (d) the Socket.IO handshake rejects expired or invalid tokens (today it lets them through and the handlers crash on a missing user), event payloads are validated (an invalid `botId` currently throws), and handlers cannot crash the process; (e) the JWT payload shape is validated; (f) a basic rate limit on signup, login and refresh (hardened in 8.2); regression tests at unit level with mocked repositories (the HTTP authorization tests join task 1.9) | 5 | ✅ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** client and api build cleanly; env/config drift removed; CI runs and blocks non-green PRs;
`develop` exists; a local PostgreSQL runs in Docker.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/0.1-fix-client-build` | 0.1 | [#22](https://github.com/AndLD/bot-rts/pull/22) | ✅ |
| `feature/0.2-env-config-email-sender` | 0.2 | [#23](https://github.com/AndLD/bot-rts/pull/23) | ✅ |
| `feature/0.3-npm-workspaces` | 0.3 | [#24](https://github.com/AndLD/bot-rts/pull/24) | ✅ |
| `feature/0.8-security-hotfix` | 0.8 | [#25](https://github.com/AndLD/bot-rts/pull/25) | ✅ |
| `feature/0.7-local-postgres` | 0.7 | [#26](https://github.com/AndLD/bot-rts/pull/26) | ✅ |
| `feature/0.4-eslint-prettier` | 0.4 | [#27](https://github.com/AndLD/bot-rts/pull/27) | ✅ |
