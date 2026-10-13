# Bot RTS

A multiplayer **real-time strategy game** where every unit is a **programmable robot** assembled from an arbitrary
combination of pre-defined modules (scanner, weapon, engine, tracks, drill, battery, storage, memory, processor,
wireless adapter, …). Players can micromanage bots by hand from the GUI, or write JavaScript scripts in an in-game terminal that
automate them; scripts execute on the server in a fair, sandboxed, tick-based runtime.

> Status: **Early prototype / vertical slice.** Auth, email verification, base deployment, procedural map generation,
> a module model (scanner is functional), Socket.IO transport and a partial BotOS terminal exist; a code-editor
> component exists but is not mounted yet. The script-execution engine (the heart of the game), most module behaviors,
> crafting/factory, the canvas map and automated tests are **not implemented yet**. The client build currently fails on
> broken imports and unused variables (fixed in Phase 0, task 0.1).
>
> Planning is complete: the game design is in [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) and the roadmap (phases 0–8, with story
> points per task) in [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md). Engineering rules for contributors and
> agents are in [`AGENTS.md`](./AGENTS.md).

---

## Table of contents

- [What works today](#what-works-today)
- [Architecture](#architecture)
- [Tech stack](#tech-stack)
- [Repository layout](#repository-layout)
- [Getting started](#getting-started)
- [Environment variables](#environment-variables)
- [Scripts](#scripts)
- [Testing](#testing)
- [Branching / Git Flow](#branching--git-flow)
- [Documentation](#documentation)

---

## What works today

**Backend (`api`)**

- Sign-up, login, logout with **JWT access + refresh tokens** (httpOnly refresh cookie).
- Email verification flow (`nodemailer`), 24 h token validity.
- Role model: `admin`, `owner`, `user`, `unlimited`, `banned` (enforced in auth middlewares).
- Deploy a base with an **access password** and an optional **spawn seed**: a free cell at least 30 cells from every other
  base, the starter kit (gun, scanner, factory, armor, battery, generator, storage, processor, memory, wireless adapter);
  one living base per player, a lost base stays on the map as a corpse base and its owner can redeploy.
- Procedural map in chunks, with **deposits** of six resources and **per-user fog-of-war points**, generated on demand.
- Module classes by type with a registry and a factory; the **bot filesystem** (a drive per memory module with a byte
  quota, directories, `.js` / `.ts` / `.json` / `.txt` files) over REST and the terminal.
- **BotOS commands on the server** (`help`, `ls`, `cd`, `mkdir`, `cat`, `edit`, `rm`, `list`, `modules`, `clear`, `exit`) over
  Socket.IO; every terminal session and its lines are stored in the database (30 days, 5,000 lines per bot).
- OpenAPI document (`api/openapi.json`, `/api/docs`) generated from the code; the web client's endpoints are generated from it.

**Frontend (`client`)**

- Auth page (login / sign-up), verification page, inactive-user ("check your email") page.
- RTK Query endpoints generated from the OpenAPI document, with automatic access-token refresh (`baseQueryWithRefresh`).
- Game page: the **deploy dialog** for a new player, then the **BotOS terminal** with the file commands and a plain editor
  for `edit` (the CodeMirror editor window arrives with the GUI, phase 6).

---

## Architecture

The repository is a lightweight multi-package TypeScript project (`api`, `client` and `lib`, each with its own
`package.json`, plus a root `package.json` for formatting, sharing one Git repo):

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────┐
│   client/   │  HTTP  │        api/          │        │ PostgreSQL  │
│ React+Next  │◄──────►│ NestJS + Socket.IO   │◄──────►│  (users,    │
│ RTK Query   │  WS    │ controllers → use    │        │   bots,     │
└──────┬──────┘        └──────────┬───────────┘        │   modules,  │
       │                          │                    │   map,      │
       └──────────► lib/ ◄────────┘                    │   files)    │
         shared TS interfaces                          └─────────────┘
```

(The database is PostgreSQL behind repository ports, accessed with Prisma and run in Docker locally. See the development plan.)

**Layering (target, see `AGENTS.md`):** clean architecture on NestJS.

```
presentation (controllers, gateways, DTOs) → application (use cases + ports) → domain
infrastructure (Prisma/PostgreSQL repositories, JWT, email, engine bridge) implements the application ports
```

The backend runs on NestJS (`api/src/app.module.ts`, versioned `/api/v1`, OpenAPI at `/api/docs`). The use cases, ports, domain and Prisma adapters live in `api/src/<feature>/`
(`users`, `auth`, `bots`, `modules`, `files`, `map`, `persistence`, …) with `domain`, `application`, `infrastructure` and
`presentation` folders; the controllers and the Socket.IO gateway are in the `presentation` folders. `npm run check:boundaries`
enforces the layer rules.

- `lib/` holds **shared TypeScript interfaces/types** used by both `api` and `client` via the `@lib/*` path alias.
- `api/` is a CommonJS TypeScript project compiled with `tsc` to `api/ts-built`.
- `client/` is a Next.js (App Router) application: the public pages (landing, later the privacy policy and the documentation) are static routes in two language trees (`(site-en)` at `/`, `(site-ru)` at `/ru`), each with its own root layout, and the game (`(game)` routes) is rendered on the client only. It talks to the API at `NEXT_PUBLIC_API_URL`.

---

## Tech stack

| Layer        | Technology                                                                                                                                                                              |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend      | Node.js, Express 4, TypeScript 5 (strict), Socket.IO 4, Prisma + PostgreSQL (**moving to NestJS on the Express adapter**, see the development plan)                                     |
| Auth         | `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `helmet`                                                                                                                             |
| Email        | `nodemailer` (SMTP)                                                                                                                                                                     |
| Logging      | `log4js`                                                                                                                                                                                |
| Frontend     | React, TypeScript 5, Redux Toolkit (RTK Query), Ant Design 5, Next.js (App Router) with React 19, which also hosts the landing page                                                     |
| Code editor  | CodeMirror 6 (planned for the script editor; verified to work with Next 16 / React 19)                                                                                                  |
| Shared       | `lib/` (plain TS interfaces)                                                                                                                                                            |
| Testing      | Jest (`api` with `ts-jest`, `client` with `next/jest`), integration tests on PostgreSQL in Docker (no in-memory databases), Cypress end-to-end                                          |
| Target stack | NestJS (clean architecture), PostgreSQL + Prisma (in Docker locally), Next.js, `next-intl`, QuickJS (WASM) script sandbox, Jest everywhere + Cypress; see [`AGENTS.md`](./AGENTS.md) §2 |

---

## Repository layout

```
bot-rts/
├── api/                          # Backend service
│   ├── controllers/  (public, private)
│   ├── middlewares/  (auth, validation, error, logger)
│   ├── models/modules/           # Module domain classes
│   ├── routers/      (public, private)
│   ├── services/     (db, users, bots, map, modules, email)
│   ├── setup/        (app, server, routers, socket)
│   ├── utils/        (jwt, api, constants, decorators, …)
│   ├── validation/   (public)
│   ├── tests/        (db-helpers only — no test files yet)
│   ├── index.ts
│   ├── jest.config.ts
│   └── tsconfig.json
├── client/                       # React SPA
│   └── src/
│       ├── components/ (Auth, Game/Terminal, Game/FileEditor)
│       ├── hooks/      (auth, pages/Game, store/*)
│       ├── pages/      (Auth, Game, Verification, Forbidden)
│       ├── routes/     (public, private, inactive)
│       ├── store/      (Redux slice + RTK Query APIs)
│       └── utils/
├── lib/                          # Shared TS interfaces
│   └── utils/ (types.ts, interfaces/{auth,bots,files,map,modules,users}.ts)
├── docs/                         # Game design, development plan, quality review
│   └── archived-docs/            # Decision log (UNCERTAINTIES.md) and original product notes (notes.txt)
├── ecosystem.config.json         # PM2 process definition (prod)
├── AGENTS.md                     # Engineering rules for contributors and agents
├── README.md
├── package.json                  # Root: Prettier `format` script
└── .prettierrc.json
```

---

## Getting started

### Prerequisites

- Node.js ≥ 18 (Node 20 LTS is the target, Plan 1.0)
- Docker (for the local PostgreSQL)
- (optional) SMTP credentials for email verification — without them the email service is a no-op

### 1. Install dependencies

The repo is an **npm workspaces** monorepo (`lib`, `api`, `client`): one install at the root, one lockfile.

```bash
npm install
```

Root scripts run in every workspace that defines them: `npm run lint` (ESLint per package plus a Prettier check), `npm run typecheck`, `npm test`, `npm run build`; `npm run format` rewrites files with Prettier.

### 2. Configure environment

Copy the examples and adjust them (`.env*` files are git-ignored, `*.env.example` files are committed):

```bash
cp api/.env.example api/.env.development
cp client/.env.example client/.env
```

Without them the app runs on hardcoded development fallbacks.

> **Warning:** use exactly the variable names in the table (and in the examples); email settings are `SMTP_*` now. Older local `api/.env.*` files named the JWT secrets
> `JWT_ACCESS_TOKEN_SECRET` etc., which the code does not read, so the app silently fell back to hardcoded dev secrets.
> Do **not** run this against a real database or expose it publicly.

#### Local PostgreSQL (Docker)

`docker-compose.yml` starts a pinned PostgreSQL 16.4 with a named volume and a healthcheck. Defaults
(`botrts` / `botrts` / `botrts`, port 5432) can be overridden with `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` and
`POSTGRES_PORT` in a root `.env`; keep `DATABASE_URL` in `api/.env.development` in sync.

```bash
npm run db:up      # start and wait until healthy
npm run db:down    # stop (data is kept in the volume)
npm run db:reset   # drop the volume and start a fresh database
npm run db:migrate -w api   # apply the Prisma migrations to the local database
npm run db:seed -w api      # create the root user (needs ROOT_USER_PASSWORD)
```

### 3. Run in development

```bash
# Terminal 1 — backend (nodemon + ts-node)
npm run dev -w api

# Terminal 2 — frontend (Next.js dev server on :5173)
npm run dev -w client
```

Open <http://localhost:5173>. Sign up and confirm the emailed link. Without SMTP settings no mail is sent in development; mark
the account as verified with `UPDATE local_credentials SET email_verified = true;` instead. Then open the `/game` route.

### 4. Production build

```bash
npm run build  # api: tsc → api/ts-built, client: next build
pm2 start ecosystem.config.json
```

---

## Environment variables

| Variable                                            | Used by | Purpose                                                                                                                                                        | Default (fallback)                                 |
| --------------------------------------------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `PORT`                                              | api     | HTTP/Socket.IO listen port                                                                                                                                     | `8080`                                             |
| `NODE_ENV`                                          | api     | `development` / `production` / `test`                                                                                                                          | `development`                                      |
| `WHITELIST_URLS`                                    | api     | Comma-separated CORS origins                                                                                                                                   | `FRONTEND_URL`                                     |
| `FRONTEND_URL`                                      | api     | Base URL used in email links                                                                                                                                   | `http://localhost:5173`                            |
| `ADMIN_URL`                                         | api     | Allowed CORS origin of the Socket.IO server                                                                                                                    | `FRONTEND_URL`                                     |
| `DATABASE_URL`                                      | api     | PostgreSQL connection string (Prisma, integration tests)                                                                                                       | `postgresql://botrts:botrts@localhost:5432/botrts` |
| `WORLD_SEED`                                        | api     | Seed of the world-generation random numbers                                                                                                                    | random per start                                   |
| `CRAFTING_RECIPES_FILE`                             | api     | JSON file that overrides recipes (by module name) and the crafting numbers                                                                                     | built-in recipes                                   |
| `WORLD_RESOURCE_CHANCE`                             | api     | Chance that a generated map cell holds a resource                                                                                                              | `0.2`                                              |
| `WORLD_SPAWN_MAX_DISTANCE` / `WORLD_SPAWN_ATTEMPTS` | api     | Where a new base may appear / how many cells are tried                                                                                                         | `10` / `20`                                        |
| `ENGINE_ENABLED` and the other `ENGINE_*`           | api     | The game engine thread (tick interval, script slice and memory, restart limits), see `api/.env.example`; the engine is off when `NODE_ENV=test` unless enabled | on                                                 |
| `AUTH_PROVIDER`                                     | api     | Identity adapter (`local` = email + password)                                                                                                                  | `local`                                            |
| `JWT_ACCESS_SECRET`                                 | api     | Signs access tokens; **required in production**                                                                                                                | dev-only value                                     |
| `JWT_ACCESS_EXPIRES_IN`                             | api     | Access-token lifetime                                                                                                                                          | `10m`                                              |
| `JWT_REFRESH_EXPIRES_IN`                            | api     | Session lifetime without use (the refresh cookie)                                                                                                              | `30d`                                              |
| `TRUST_PROXY`                                       | api     | `true` behind a reverse proxy (client IPs for rate limits)                                                                                                     | `false`                                            |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_AUTH_MAX`      | api     | Rate limit of the auth routes (per IP, in memory)                                                                                                              | `900000` / `20`                                    |
| `SMTP_HOST`                                         | api     | SMTP host (required in production)                                                                                                                             | `smtp.gmail.com` outside production                |
| `SMTP_PORT` / `SMTP_SECURE`                         | api     | SMTP port / implicit TLS flag                                                                                                                                  | `465` / `true` when the port is 465                |
| `SMTP_USER` / `SMTP_PASS`                           | api     | SMTP credentials; without them the email service is a no-op                                                                                                    | —                                                  |
| `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD`            | api     | Auto-created root/admin user                                                                                                                                   | `root@root.root` / none                            |
| `NEXT_PUBLIC_API_URL`                               | client  | Backend base URL (read in the browser)                                                                                                                         | `http://localhost:8080`                            |
| `NEXT_PUBLIC_SITE_URL`                              | client  | Public address of the site, for canonical links, the sitemap and social previews (read at build time)                                                           | `http://localhost:5173`                            |

---

## Scripts

| Package | Command                    | Description                                                                                                                 |
| ------- | -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| root    | `npm run lint`             | ESLint of every package and a Prettier check                                                                                |
| root    | `npm run typecheck`        | TypeScript of every package                                                                                                 |
| root    | `npm test`                 | Jest of `api` (needs `npm run db:up`) and `client`                                                                          |
| root    | `npm run test:coverage`    | The same with coverage; fails below 97 % per package                                                                        |
| root    | `npm run e2e`              | Cypress against a fresh database, the API and the built client (`--open` for the runner, `--skip-build` to reuse the build) |
| root    | `npm run check:boundaries` | Import-boundary rules of the layered `api/src`                                                                              |
| root    | `npm run docs:check`       | Markdown link check                                                                                                         |
| root    | `npm run format`           | Prettier across the repo                                                                                                    |
| api     | `npm run dev`              | nodemon + ts-node                                                                                                           |
| api     | `npm run build`            | `tsc` → `ts-built`                                                                                                          |
| api     | `npm run openapi:generate` | Writes `api/openapi.json` from the controllers and DTOs (a test and CI fail when it is stale)                               |
| api     | `npm run prod`             | `node ts-built/api/index`                                                                                                   |
| client  | `npm run dev`              | Next.js dev server on port 5173                                                                                             |
| client  | `npm run api:generate`     | Generates the RTK Query client `src/shared/api/generated.ts` from `api/openapi.json`                                        |
| client  | `npm run build`            | `next build`                                                                                                                |
| client  | `npm run start`            | `next start` on port 5173                                                                                                   |

---

## Testing

- **Unit tests:** Jest in `api` (`*.test.ts`, fakes of the ports, no I/O). The client gets Jest in Phase 2.
- **Integration tests:** `*.int.test.ts` run against a real PostgreSQL in Docker (`npm run db:up`); every test file gets its own
  database cloned from a migrated template, and no in-memory database is used. They include the safety-net suite that drives
  the whole API over HTTP and Socket.IO.
- **E2E:** Cypress in `client/cypress`, run by `npm run e2e`; a pre-push hook (`.githooks/pre-push`) runs the coverage gate.
- **Coverage gate:** ≥ 97 % on the files a pull request changes (blocking in CI); the per-package gate arrives in Phase 2.

See [Phase 2](./docs/development-plan/phase-2-test-infrastructure.md) of the development plan for the rollout.

---

## Branching / Git Flow

The project uses **Git Flow**:

- `main` — always releasable, tagged with versions.
- `develop` — integration branch; all work starts here.
- `feature/<task>-<slug>`, `bugfix/*`, `docs/*`, `chore/*` branch from `develop` and are squash-merged back through a pull request.
- `release/*` and `hotfix/*` merge into `main` and back into `develop`.
- Merged branches are kept on GitHub for history.

Full rules (merge strategy, commit format, agent rules) are in [`AGENTS.md`](./AGENTS.md) §7.

---

## Documentation

- [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) — full game documentation: mechanics, modules, script API, terminal, scheduler,
  screens, in-game scenarios, and examples.
- [`AGENTS.md`](./AGENTS.md) — engineering rules for AI/human contributors (SOLID, testing, Git Flow, DoD).
- [`docs/CODE-QUALITY-REVIEW.md`](./docs/CODE-QUALITY-REVIEW.md) — quality assessment of the original prototype (historical).
- [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md) — refactoring, test, and feature roadmap with story points (phases 0–8).
- [`docs/archived-docs/`](./docs/archived-docs/UNCERTAINTIES.md) — the decision log from the planning pass and the original product notes.
