[← Phase 0 — Stabilize & CI foundation](../phase-0-stabilize-ci.md)

# Phase 0 — Stabilize & CI foundation — work log

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

### 2026-10-11 — task 0.1: client build is green
- **Tasks:** 0.1
- **Branch:** `feature/0.1-fix-client-build` — done
- **Decisions / deviations from the plan:** the unused `beautify` import, `replyAsync` function and `setDrives` setter were removed rather than silenced; the commented-out `<FileEditor />` in `Game.tsx` was removed with its import (no commented-out code, AGENTS.md §1).
- **Problems / blockers / findings:** none.
- **Next step:** task 0.2 (env/config drift, `EmailSender` interface).
- **Verify with:** `cd client && npx tsc --noEmit && npm run build`


### 2026-10-11 — task 0.2: env/config aligned, SMTP behind `EmailSender`
- **Tasks:** 0.2
- **Branch:** `feature/0.2-env-config-email-sender` — done
- **Decisions / deviations from the plan:** the code's names win (`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `JWT_EMAIL_VERIFICATION_SECRET`); the cookie max age now reads the same `JWT_REFRESH_EXPIRES_IN` as the token (default `24h`, was `30d`). Email variables are renamed `EMAIL_SMTP_USER/PASS` → `SMTP_USER/PASS`, with `SMTP_HOST` (Gmail default only outside production), `SMTP_PORT`, `SMTP_SECURE`. `.gitignore` re-includes `*.env.example`; a `client/.env.example` was added too.
- **Problems / blockers / findings:** the developer's local ignored `api/.env.*` files still use the old `*_TOKEN_SECRET` and `EMAIL_SMTP_*` names and need to be recreated from `api/.env.example`. Jest warns about a haste-map collision with `api/ts-built` (handled in 0.3).
- **Next step:** task 0.3 (npm workspaces, root scripts, api Jest setup).
- **Verify with:** `cd api && npx jest services/email && npx tsc --noEmit`

### 2026-10-11 — task 0.3: npm workspaces and root scripts
- **Tasks:** 0.3
- **Branch:** `feature/0.3-npm-workspaces` — done
- **Decisions / deviations from the plan:** workspaces are `lib`, `api`, `client` (packages `@bot-rts/*`, private); per-package lockfiles removed. `api` moved to TypeScript ^5.4 (AGENTS.md §2); `jsonwebtoken` `expiresIn` is cast through a small `toExpiresIn` helper because the newer typings require a branded duration type. `lib/tsconfig.json` is now a plain `noEmit` type-check project and the TS project references to it were dropped (consumers import its sources through the `@lib` alias). `api` Jest config moved to the non-deprecated `transform` form and ignores `ts-built`; test files are excluded from the `api` build. The client has no `test` script until Jest arrives in Phase 2 (`--if-present`).
- **Problems / blockers / findings:** `lint` has no scripts in `api`/`lib` yet (task 0.4). Developers must delete old per-package `node_modules` and run `npm install` at the root.
- **Next step:** task 0.8 (security hotfix), then 0.7, 0.4, 0.5, 0.6.
- **Verify with:** `npm install && npm run typecheck && npm test && npm run build`

### 2026-10-11 — task 0.8: security hotfix of the legacy API
- **Tasks:** 0.8
- **Branch:** `feature/0.8-security-hotfix` — done
- **Decisions / deviations from the plan:**
  - (a) `GET/PUT /api/private/users` are admin-only. `PUT` accepts `name`, `subscription`, `status`, `active`, `password`; the last three need an owner, and an admin cannot edit admin/owner accounts. The list takes typed filters (`status`, `active`, `email`, `page`, `results`, max 100); the JSON `filters` parameter is ignored. The cluster/node aggregation queries (leftovers of another project) were deleted.
  - (b) New `createIsAuthorized` / `createIsSocketAuthorized` (`middlewares/authorization.ts`) load the user from the database on every request; ban, unverified email and a deleted user are rejected (403/401), and `req.user` is built from the database row, so roles in the token are ignored. Login and refresh reject banned and unverified users too. The unused `isActive`, `hasUserStatus`, `isAuthorizedNotRequired` and `userHasAccess` guards were removed.
  - (c) `/api/private/debug/*` returns 404 outside `NODE_ENV=development` and only accepts known entity names.
  - (d) The Socket.IO handshake rejects expired (`Token expired`, the client then refreshes and reconnects) and invalid tokens; handlers validate `botId` and run behind a guard that turns failures into an error acknowledgement. `unhandledRejection` is logged next to `uncaughtException`.
  - (e) Token payloads are parsed by `utils/jwtPayload.ts` (only a 24-hex user id is trusted); tokens are verified with `algorithms: ['HS256']`.
  - (f) `express-rate-limit` (in memory, per IP, `RATE_LIMIT_WINDOW_MS`/`RATE_LIMIT_AUTH_MAX`) on signup, login and refresh, 429 on excess. The shared store comes in 8.2.
  - Runtime values imported from `lib` use relative paths in `api` (the `@lib` alias is only resolved by `tsc`, not at runtime); the client got a Vite alias for `@lib`. `services/users.ts` no longer receives an Express `Response` (AGENTS.md §3.2).
- **Problems / blockers / findings:** `services/users.ts` has no tests yet (needs a database; integration tests arrive with the PostgreSQL repositories in Phase 1). `ts-built` in a local checkout may hold a stale layout (`ts-built/api/index.js` vs the `prod` script `ts-built/index`) — to be fixed with the NestJS migration. `trust proxy` is not configured, so behind a reverse proxy the rate limit would see the proxy IP; configure it when deployment is defined.
- **Next step:** task 0.7 (Docker PostgreSQL).
- **Verify with:** `npm run typecheck && npm test && npm run build`
