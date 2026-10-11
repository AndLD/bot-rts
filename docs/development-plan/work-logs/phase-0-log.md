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
