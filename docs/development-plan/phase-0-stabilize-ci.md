[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 0 — Stabilize & CI foundation (20 SP)

Fix the build and establish a repeatable, gated pipeline. **Nothing else is safe to start before this.**

| # | Task                                                                                          | SP |
| --- | -------------------------------------------------------------------------------------------- | -- |
| 0.1 | Fix broken client imports (`client/src/utils/jwt.ts` → `@lib/utils/interfaces/users`, `client/src/utils/store.ts` → `@lib/utils/interfaces/auth`); fix the remaining `tsc` errors (unused `beautify`, `setDrives`, `replyAsync` in `Terminal.tsx`, unused `FileEditor` import in `Game.tsx`); make `npm run build --prefix client` green | 2 |
| 0.2 | Align JWT env keys with code (or vice versa), unify `JWT_REFRESH_EXPIRES_IN` / `REFRESH_JWT_EXPIRES_IN`, document `ADMIN_URL`, add `api/.env.example`, document all env vars in README; make SMTP configurable (`SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, user/pass) behind an `EmailSender` interface, Gmail only as a dev default | 3 |
| 0.3 | Add root scripts (`lint`, `typecheck`, `test`, `build`) by adopting **npm workspaces** for `api`/`client`/`lib` (single root install and lockfile, `lib` as a workspace package) | 3 |
| 0.4 | Add `api` ESLint + a shared Prettier check; wire `npm run lint`/`typecheck` into both packages | 2 |
| 0.5 | Set up CI (GitHub Actions): install → lint → typecheck → unit/integration → e2e → coverage gate | 3 |
| 0.6 | Create `develop` branch; define protected branches (`main`, `develop`), PR + Conventional Commits enforcement; turn off automatic deletion of merged branches (branches are kept for history) | 1 |
| 0.7 | **Safety-net tests** before any refactor: add Jest, `mongodb-memory-server` and `supertest` to `api`; coarse characterization tests of today's behavior (signup, login/refresh/logout, email verification, deploy base, scan, socket events `get-user-bases`/`get-user-bots`/`get-bot-modules`) | 6 |

**Exit criteria:** client and api build cleanly; env/config drift removed; CI runs and blocks non-green PRs;
`develop` exists; the safety-net tests pass and pin down current behavior so refactors can be verified.
