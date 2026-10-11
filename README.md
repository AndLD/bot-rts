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
- Deploy a user base (creates a `BOT_TYPE.BASE`, attaches the initial module kit, upserts a map point).
- Procedural map: real map points + **per-user fog-of-war points**, generated on demand.
- Module model: abstract `Module` base class + a **working `ScannerModule`**; `WeaponModule` is a stub.
- Socket.IO server with authenticated events: `get-user-bases`, `get-user-bots`, `get-bot-modules`.

**Frontend (`client`)**

- Auth page (login / sign-up), verification page, inactive-user ("check your email") page.
- RTK Query API slices with automatic access-token refresh (`baseQueryWithRefresh`).
- Game page: a **BotOS terminal** (`ls`/`dir`, `cd`, `clear`, `shell`, `exit`, `list`, `modules` are partially wired to
  Socket.IO). A draggable **code editor** component (CodeMirror + prettier format) exists in `components/Game/FileEditor`,
  but it is a stub and is not mounted on the game page yet.

---

## Architecture

The repository is a lightweight multi-package TypeScript project (`api`, `client` and `lib`, each with its own
`package.json`, plus a root `package.json` for formatting, sharing one Git repo):

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────┐
│   client/   │  HTTP  │        api/          │        │    MongoDB  │
│ React+Vite  │◄──────►│ Express + Socket.IO  │◄──────►│  (users,    │
│ RTK Query   │  WS    │ controllers/services │        │   bots,     │
└──────┬──────┘        └──────────┬───────────┘        │   modules,  │
       │                          │                    │   map,      │
       └──────────► lib/ ◄────────┘                    │   files)    │
         shared TS interfaces                          └─────────────┘
```

(Planned: the client moves to Next.js, the API to NestJS, and MongoDB is replaced by PostgreSQL with Prisma behind
repository ports; the local database runs in Docker. See the development plan.)

**Layering (target, see `AGENTS.md`):** clean architecture on NestJS.

```
presentation (controllers, gateways, DTOs) → application (use cases + ports) → domain
infrastructure (Prisma/PostgreSQL repositories, JWT, email, engine bridge) implements the application ports
```

(The current code is still the older Express layout: routers → middlewares → controllers → services → MongoDB.)

- `lib/` holds **shared TypeScript interfaces/types** used by both `api` and `client` via the `@lib/*` path alias.
- `api/` is a CommonJS TypeScript project compiled with `tsc` to `api/ts-built`.
- `client/` is a Vite + React SPA proxying `/api` to the backend in dev (migrating to Next.js, see the development plan).

---

## Tech stack

| Layer        | Technology                                                                   |
| ------------ | ---------------------------------------------------------------------------- |
| Backend      | Node.js, Express 4, TypeScript 4.7 (strict), Socket.IO 4, mongodb driver 5 (**moving to NestJS on the Express adapter, TypeScript 5.x**, see the development plan) |
| Auth         | `jsonwebtoken`, `bcrypt`, `cookie-parser`, `cors`, `helmet`                   |
| Email        | `nodemailer` (SMTP)                                                           |
| Logging      | `log4js`                                                                      |
| Frontend     | React, TypeScript 5, Redux Toolkit (RTK Query), Ant Design 5; today Vite 5, **moving to Next.js (App Router)** in Phase 1, which will also host the landing page |
| Code editor  | CodeMirror 6 (`@uiw/react-codemirror`), `prettier-standalone`                |
| Shared       | `lib/` (plain TS interfaces)                                                  |
| Testing      | Jest + `ts-jest` (installed, **not configured to run**); planned: PostgreSQL in Docker for integration tests (no in-memory databases), Cypress |
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
- MongoDB running locally, or a MongoDB URI (current code; replaced by PostgreSQL in Docker at the start of Phase 1 — Docker will then be required)
- (optional) SMTP credentials for email verification — without them the email service is a no-op

### 1. Install dependencies

The repo is an **npm workspaces** monorepo (`lib`, `api`, `client`): one install at the root, one lockfile.

```bash
npm install
```

Root scripts run in every workspace that defines them: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`.

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

### 3. Run in development

```bash
# Terminal 1 — backend (nodemon + ts-node)
npm run dev -w api

# Terminal 2 — frontend (Vite dev server, proxies /api to :8080)
npm run dev -w client
```

Open <http://localhost:5173>. Sign up, confirm the email link (or set the user active in the DB during development),
then open the `/game` route.

### 4. Production build

```bash
npm run build  # api: tsc → api/ts-built, client: tsc + vite build
pm2 start ecosystem.config.json
```

---

## Environment variables

| Variable                              | Used by      | Purpose                                              | Default (fallback)      |
| ------------------------------------- | ------------ | ---------------------------------------------------- | ----------------------- |
| `PORT`                                | api          | HTTP/Socket.IO listen port                           | `8080`                  |
| `NODE_ENV`                            | api          | `development` / `production` / `test`                | `development`           |
| `WHITELIST_URLS`                      | api          | Comma-separated CORS origins                         | —                       |
| `FRONTEND_URL`                        | api          | Base URL used in email links                         | `http://localhost:5173` |
| `ADMIN_URL`                           | api          | Allowed CORS origin of the Socket.IO server          | `http://localhost:5173` |
| `MONGO_DB_URI`                        | api          | MongoDB connection string                            | `mongodb://localhost:27017` |
| `MONGO_DB_NAME`                       | api          | Database name                                        | `bot-rts`               |
| `JWT_ACCESS_SECRET` / `_EXPIRES_IN`   | api          | Access-token secret / TTL                            | `super_secret1` / `10m` |
| `JWT_REFRESH_SECRET` / `_EXPIRES_IN`  | api          | Refresh-token secret / TTL (also the refresh cookie max age) | `super_secret2` / `24h` |
| `JWT_EMAIL_VERIFICATION_SECRET` / `_EXPIRES_IN` | api | Email-verification secret / TTL                      | `super_secret3` / `24h` |
| `SMTP_HOST`                           | api          | SMTP host (required in production)                   | `smtp.gmail.com` outside production |
| `SMTP_PORT` / `SMTP_SECURE`           | api          | SMTP port / implicit TLS flag                        | `465` / `true` when the port is 465 |
| `SMTP_USER` / `SMTP_PASS`             | api          | SMTP credentials; without them the email service is a no-op | — |
| `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD` | api       | Auto-created root/admin user                         | `root@root.root` / none |
| `VITE_API_URL`                        | client       | Backend base URL (Vite env)                          | `http://localhost:8080` |

> **Planned:** `DATABASE_URL` (PostgreSQL) replaces `MONGO_DB_URI` / `MONGO_DB_NAME` when the persistence layer is switched
> (Phase 1, task 1.1a).

---

## Scripts

| Package | Command               | Description                              |
| ------- | --------------------- | ---------------------------------------- |
| root    | `npm run format`      | Prettier across the repo                 |
| api     | `npm run dev`         | nodemon + ts-node                        |
| api     | `npm run build`       | `tsc` → `ts-built`                       |
| api     | `npm run prod`        | `node ts-built/index`                    |
| client  | `npm run dev`         | Vite dev server                          |
| client  | `npm run build`       | `tsc && vite build`                      |
| client  | `npm run lint`        | ESLint (ts, tsx)                         |
| client  | `npm run preview`     | Vite preview                             |

> There is currently **no `test` script** anywhere and **no root `lint`/`typecheck`**. Adding them is Phase 0 of the plan.

---

## Testing

- **Unit / integration:** Jest (`api/jest.config.ts`) is installed but there are **no test files** and no `test` script.
  Integration tests will run against a real PostgreSQL in Docker; no in-memory database is used.
- **E2E:** Cypress (not installed yet).
- **Coverage gate:** ≥ 97 % (see `AGENTS.md`).

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
