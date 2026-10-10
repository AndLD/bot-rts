# Bot RTS

A multiplayer **real-time strategy game** where every unit is a **programmable robot** assembled from an arbitrary
combination of pre-defined modules (scanner, weapon, engine, tracks, drill, battery, storage, memory, processor,
wireless adapter, …). Players can micromanage bots by hand from the GUI, or write JavaScript scripts in an in-game terminal that
automate them; scripts execute on the server in a fair, sandboxed, tick-based runtime.

> Status: **Early prototype / vertical slice.** Auth, email verification, base deployment, procedural map generation,
> a module model (scanner is functional), Socket.IO transport and a partial BotOS terminal + code editor exist.
> The script-execution engine (the heart of the game), most module behaviors, crafting/factory, the canvas map and
> automated tests are **not implemented yet**. See [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md).

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
- Game page: a draggable **Code Editor** (CodeMirror + prettier format) and a **BotOS terminal**
  (`ls`/`dir`, `cd`, `clear`, `shell`, `exit`, `list`, `modules` are partially wired to Socket.IO).

---

## Architecture

The repository is a lightweight multi-package TypeScript project (three `package.json`s sharing one Git repo):

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────┐
│   client/   │  HTTP  │        api/          │        │    MongoDB  │
│ React+Vite  │◄──────►│ NestJS + Socket.IO   │◄──────►│  (users,    │
│ RTK Query   │  WS    │ controllers/services │        │   bots,     │
└──────┬──────┘        └──────────┬───────────┘        │   modules,  │
       │                          │                    │   map,      │
       └──────────► lib/ ◄────────┘                    │   files)    │
         shared TS interfaces                          └─────────────┘
```

**Layering (target, see `AGENTS.md`):** clean architecture on NestJS.

```
presentation (controllers, gateways, DTOs) → application (use cases + ports) → domain
infrastructure (Mongo repositories, JWT, email, engine bridge) implements the application ports
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
| Testing      | Jest + `ts-jest` (installed, **not configured to run**), planned `mongodb-memory-server` + Cypress |

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
├── .prettierrc.json
```

---

## Getting started

### Prerequisites

- Node.js ≥ 18 (backend targets CommonJS; client uses Vite 5)
- MongoDB running locally, or a MongoDB URI
- (optional) SMTP credentials for email verification — without them the email service is a no-op

### 1. Install dependencies

The repo is moving to **npm workspaces** (Plan 0.3): a single `npm install` at the root will install `api`, `client`
and `lib`. Until that lands, each package has its own lockfile:

```bash
npm install --prefix api
npm install --prefix client
npm install --prefix lib
```

### 2. Configure environment

Copy the existing env templates into place (or create fresh files) and fill in real values:

```bash
cp api/.env.development api/.env.development.local   # or set values directly
```

> **Note:** the env keys currently in `api/.env.*` (`JWT_ACCESS_TOKEN_SECRET`, …) do **not** match the keys the code
> reads (`JWT_ACCESS_SECRET`, …). Until this is fixed (see [Phase 0](./docs/development-plan/phase-0-stabilize-ci.md)), the app silently falls back
> to hardcoded dev secrets. Do **not** run this against a real database or expose it publicly.

### 3. Run in development

```bash
# Terminal 1 — backend (nodemon + ts-node)
npm run dev --prefix api

# Terminal 2 — frontend (Vite dev server, proxies /api to :8080)
npm run dev --prefix client
```

Open <http://localhost:5173>. Sign up, confirm the email link (or set the user active in the DB during development),
then open the `/game` route.

### 4. Production build

```bash
npm run build --prefix api     # tsc → api/ts-built
npm run build --prefix client  # tsc + vite build
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
| `MONGO_DB_URI`                        | api          | MongoDB connection string                            | `mongodb://localhost:27017` |
| `MONGO_DB_NAME`                       | api          | Database name                                        | `bot-rts`               |
| `JWT_ACCESS_SECRET` / `_EXPIRES_IN`   | api          | Access-token secret / TTL                            | `super_secret1` / `10m` |
| `JWT_REFRESH_SECRET` / `_EXPIRES_IN`  | api          | Refresh-token secret / TTL                           | `super_secret2` / `24h` |
| `JWT_EMAIL_VERIFICATION_SECRET` / `_EXPIRES_IN` | api | Email-verification secret / TTL                      | `super_secret3` / `24h` |
| `EMAIL_SMTP_USER` / `EMAIL_SMTP_PASS` | api          | SMTP credentials (host is hardcoded to Gmail today; `SMTP_HOST`/`SMTP_PORT`/`SMTP_SECURE` are planned, Plan 0.2) | — |
| `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD` | api       | Auto-created root/admin user                         | `root@root.root`        |
| `VITE_API_URL`                        | client       | Backend base URL (Vite env)                          | `http://localhost:8080` |

> **Warning (known bug):** `api/.env.*` currently names the JWT secrets `JWT_ACCESS_TOKEN_SECRET`,
> `JWT_REFRESH_TOKEN_SECRET`, `JWT_EMAIL_VERIFICATION_TOKEN_SECRET` — the code reads `JWT_ACCESS_SECRET`,
> `JWT_REFRESH_SECRET`, `JWT_EMAIL_VERIFICATION_SECRET`. Rename the env keys or the code, and add a `.env.example`.

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
  The plan is to use `mongodb-memory-server` for integration tests against a real (in-memory) MongoDB.
- **E2E:** Cypress (not installed yet).
- **Coverage gate:** ≥ 97 % (see `AGENTS.md`).

See [Phase 2](./docs/development-plan/phase-2-test-infrastructure.md) of the development plan for the rollout.

---

## Branching / Git Flow

The project uses a feature-branch model (feature branches merged to `main` via pull requests). The target model is
full **Git Flow**:

- `main` — always releasable, tagged with versions.
- `develop` — integration branch (does not exist yet).
- `feature/*`, `bugfix/*`, `release/*`, `hotfix/*`.

Full rules live in `AGENTS.md`.

---

## Documentation

- [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) — full game documentation: mechanics, modules, script API, terminal, scheduler,
  screens, in-game scenarios, and the implementation status matrix.
- [`AGENTS.md`](./AGENTS.md) — engineering rules for AI/human contributors (SOLID, testing, Git Flow, DoD).
- [`docs/CODE-QUALITY-REVIEW.md`](./docs/CODE-QUALITY-REVIEW.md) — quality assessment of the original prototype (historical).
- [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md) — refactoring, test, and feature roadmap with story points (phases 0–8).
- [`docs/archived-docs/`](./docs/archived-docs/UNCERTAINTIES.md) — the decision log from the planning pass and the original product notes.
