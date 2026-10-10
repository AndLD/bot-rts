[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 0 — Stabilize & CI foundation (18 SP)

**Status:** ⬜ Not started · **Branches:** none yet (see the [implementation log](#implementation-log)) · **Work log:** [phase-0-log](./logs/phase-0-log.md)

Fix the build and establish a repeatable, gated pipeline. **Nothing else is safe to start before this.**

**Execution order:** 0.1 → 0.2 → 0.3 → 0.7 (local PostgreSQL, needed before Phase 1 starts moving off MongoDB) → 0.4 → 0.5 → 0.6.

| # | Task                                                                                          | SP | Status |
| --- | -------------------------------------------------------------------------------------------- | -- | --- |
| 0.1 | Fix broken client imports (`client/src/utils/jwt.ts` → `@lib/utils/interfaces/users`, `client/src/utils/store.ts` → `@lib/utils/interfaces/auth`); fix the remaining `tsc` errors (unused `beautify`, `setDrives`, `replyAsync` in `Terminal.tsx`, unused `FileEditor` import in `Game.tsx`); make `npm run build --prefix client` green | 2 | ⬜ |
| 0.2 | Align JWT env keys with code (or vice versa), unify `JWT_REFRESH_EXPIRES_IN` / `REFRESH_JWT_EXPIRES_IN`, document `ADMIN_URL`, add `api/.env.example`, document all env vars in README; make SMTP configurable (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, user/pass) behind an `EmailSender` interface, Gmail only as a dev default | 3 | ⬜ |
| 0.3 | Add root scripts (`lint`, `typecheck`, `test`, `build`) by adopting **npm workspaces** for `api`/`client`/`lib`, including the `api` Jest setup (`ts-jest`, `supertest`) (single root install and lockfile, `lib` as a workspace package) | 4 | ⬜ |
| 0.4 | Add `api` ESLint + a shared Prettier check; wire `npm run lint`/`typecheck` into both packages | 2 | ⬜ |
| 0.5 | Set up CI (GitHub Actions, with a PostgreSQL service container for integration tests): install → lint → typecheck → unit/integration; the e2e stage and the coverage gate are switched on as they come online in Phase 2 (tasks 2.2, 2.7, 2.8) | 3 | ⬜ |
| 0.6 | Protect `main` and `develop` (`develop` already exists), enforce PR + Conventional Commits; turn off automatic deletion of merged branches (branches are kept for history) | 1 | ⬜ |
| 0.7 | **Local PostgreSQL in Docker**: `docker-compose.yml` with a pinned PostgreSQL image, named volume and healthcheck; `db:up` / `db:down` / `db:reset` scripts; `DATABASE_URL` in `.env.example`; README setup section | 3 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** client and api build cleanly; env/config drift removed; CI runs and blocks non-green PRs;
`develop` exists; a local PostgreSQL runs in Docker.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| _none yet_ | | | |
