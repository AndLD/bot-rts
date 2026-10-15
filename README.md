# Bot RTS

A multiplayer **real-time strategy game** where every unit is a **programmable robot** assembled from an arbitrary
combination of pre-defined modules (scanner, weapon, engine, tracks, drill, battery, storage, memory, processor,
wireless adapter, …). Players can micromanage bots by hand from the GUI, or write JavaScript scripts in an in-game terminal that
automate them; scripts execute on the server in a fair, sandboxed, tick-based runtime.

> Status: **feature-complete through Phase 8; Phases 9 and 10 are planned.** Phases 0–8 and 11 are delivered: a NestJS
> backend with PostgreSQL, a sandboxed script engine, the full game GUI, the landing page, achievements, notifications,
> English and Russian UI, player documentation, a public API with API keys, an MCP server, and production hardening.
> The admin console (Phase 9) and the market, currency, chat and transfers (Phase 10) are not implemented yet.
>
> The game design is in [`docs/GAME-DESIGN.md`](./docs/GAME-DESIGN.md) and the roadmap (phases 0–11, with story
> points per task; Phase 11 was developed after Phase 7) in [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md). Engineering rules for contributors and
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

**Game**

- Deploy a base with an **access password** and an optional **spawn seed**: a free cell far from every other base and the
  starter kit (gun, scanner, factory, armor, battery, **solar panel**, storage, processor, memory, wireless adapter). One living
  base per player; a lost base stays as a corpse base that can be restored or redeployed.
- A procedural, unbounded map in chunks with six **resource deposits**, **per-user fog of war** and live vision from scanners.
- **Modules with real behavior** (scanner, weapon, engine, tracks, drill, battery, power sources, repair, wireless adapter, …),
  energy accounting, module condition and breakage, and a **day/night cycle** that drives solar power.
- **Crafting and assembly:** data-driven recipes, blueprints (research, loot, `learn`), bot assembly and repair.
- **Scripts:** write JavaScript or TypeScript in the in-game editor and run it on a bot. Scripts execute on the server in a
  **QuickJS (WASM) sandbox** inside a tick-based **engine** with a fair scheduler, deterministic ordering and typed game events.
- **BotOS terminal** with filesystem, `connect`, `run`, `top`, `kill`, `shell`, `passwd` and `adopt`; the **radio network** gates
  remote access; every session is stored (30 days).
- **Achievements**, **notifications** (coalescing, caps, preferences) and a skippable **tutorial**.

**Backend (`api`)**

- NestJS on a clean-architecture layout, versioned `/api/v1`, PostgreSQL through Prisma, JWT access + refresh tokens with
  email verification, privacy consent and database-checked roles.
- OpenAPI document (`api/openapi.json`, `/api/docs`) generated from the code; the web client's endpoints are generated from it.
  Third-party clients and AI assistants use **API keys** with scopes ([docs/integrations/API.md](./docs/integrations/API.md)), and the **MCP server** in
  `mcp/` lets an AI play as a regular player ([docs/integrations/MCP.md](./docs/integrations/MCP.md)).
- Production hardening: rate limits, request limits and security headers, request ids, JSON logs, Prometheus metrics, health
  checks, a scheduled data-lifecycle job, and a horizontally scalable API tier with one engine node
  ([docs/operations/DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md), measured in [docs/testing/load-testing.md](./docs/testing/load-testing.md)); a Docker image, a
  release flow ([docs/operations/RELEASING.md](./docs/operations/RELEASING.md)), and the web client on Vercel.

**Frontend (`client`)**

- Next.js: a statically rendered **landing page**, **privacy policy** and **player documentation** (English at `/`, Russian at
  `/ru`), and the game rendered on the client only. The whole UI is translated (`next-intl`).
- The game: a **canvas map** with sprites, animations and the night filter, a draggable **window manager** (terminals, code
  editor, bot control panel, storage, factory, in-game Help), settings, achievements, notification center, API-key management,
  an in-game clock and **automatic reconnection**.

---

## Planned

- **Phase 9 — Admin console:** supervision, monitoring, moderation and operations.
- **Phase 10 — Market, currency, chat and transfers.**

---

## Architecture

The repository is a lightweight multi-package TypeScript project (`api`, `client` and `lib`, each with its own
`package.json`, plus a root `package.json` for formatting, sharing one Git repo):

```
┌─────────────┐        ┌──────────────────────┐        ┌─────────────┐
│   client/   │  HTTP  │        api/          │        │ PostgreSQL  │
│ Next.js     │◄──────►│ NestJS + Socket.IO   │◄──────►│ (users,     │
│ RTK Query   │  WS    │ controllers → use    │        │  world,     │
└──────┬──────┘        │ cases → ports        │        │  files,     │
       │               └───┬──────────────┬───┘        │  logs, …)   │
       │      ┌────────────┘              │ port       └─────────────┘
       │      │ /api/v1 + API key    ┌────▼──────────┐
┌──────┴──────┴─┐                    │ engine        │  tick loop, scheduler,
│ mcp/ (AI      │                    │ (worker or    │  QuickJS sandbox,
│ players)      │                    │  own node)    │  write-behind to DB
└───────────────┘                    └───────────────┘
       └──────────► lib/ (shared types, game clock, pure functions)
```

The engine is the single writer of world state. In a scaled deployment the API nodes reach it through Redis ([docs/operations/DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md)); PostgreSQL sits behind repository ports, accessed with Prisma and run in Docker locally.

**Layering (see `AGENTS.md`):** clean architecture on NestJS.

```
presentation (controllers, gateways, DTOs) → application (use cases + ports) → domain
infrastructure (Prisma/PostgreSQL repositories, JWT, email, engine bridge) implements the application ports
```

The backend runs on NestJS (`api/src/app.module.ts`, versioned `/api/v1`, OpenAPI at `/api/docs`). The use cases, ports, domain and Prisma adapters live in `api/src/<feature>/`
(`users`, `auth`, `bots`, `modules`, `files`, `map`, `engine`, `terminal`, `achievements`, `notifications`, `apikeys`, `time`, `persistence`, …) with `domain`, `application`, `infrastructure` and
`presentation` folders; the controllers and the Socket.IO gateway are in the `presentation` folders. `npm run check:boundaries`
enforces the layer rules.

- `lib/` holds **shared TypeScript interfaces/types** used by both `api` and `client` via the `@lib/*` path alias.
- `api/` is a CommonJS TypeScript project compiled with `tsc` to `api/ts-built`.
- `mcp/` is the MCP server, a thin client of `/api/v1` with an API key.
- `client/` is a Next.js (App Router) application: the public pages (landing, privacy policy and player documentation) are static routes in two language trees (`(site-en)` at `/`, `(site-ru)` at `/ru`), each with its own root layout, and the game (`(game)` routes) is rendered on the client only. It talks to the API at `NEXT_PUBLIC_API_URL`.

---

## Tech stack

| Layer       | Technology                                                                                                                              |
| ----------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Backend     | Node.js 20, NestJS (Express adapter), TypeScript 5 (strict), Socket.IO 4, Prisma + PostgreSQL, Redis (scaled deployments)               |
| Engine      | Tick loop and fair scheduler in a worker thread (or its own node), **QuickJS compiled to WASM** as the script sandbox                    |
| Auth        | JWT access + refresh tokens behind an identity-provider port, `bcrypt`, API keys with scopes                                            |
| Email       | `nodemailer` (SMTP)                                                                                                                     |
| Observability | `log4js` JSON logs, Prometheus metrics, health checks                                                                                  |
| Frontend    | Next.js (App Router) with React 19, Redux Toolkit (RTK Query), Ant Design 5, CodeMirror 6, `next-intl` (English, Russian), canvas map   |
| AI access   | MCP server (`mcp/`) over the public API                                                                                                 |
| Shared      | `lib/` (types, constants, game clock and other pure functions)                                                                          |
| Testing     | Jest (`api` with `ts-jest`, `client` with `next/jest`), integration tests on PostgreSQL in Docker (no in-memory databases), Cypress e2e |
| Deployment  | Docker image and compose stack, web client on Vercel, API and engine on a long-running host                                             |

---

## Repository layout

```
bot-rts/
├── api/                          # Backend (NestJS, clean architecture)
│   ├── src/<feature>/            # users, auth, bots, modules, files, map, engine, terminal, achievements,
│   │                             #   notifications, apikeys, time, … each with domain / application /
│   │                             #   infrastructure / presentation
│   ├── prisma/                   # Schema and migrations
│   ├── scripts/                  # OpenAPI generation, helpers
│   ├── openapi.json              # Generated API document
│   └── Dockerfile
├── client/                       # Next.js app
│   ├── src/app/                  # (site-en), (site-ru) static pages; (game) client-only routes
│   ├── src/features/             # map, terminal, windows, control, factory, storage, achievements, …
│   ├── messages/                 # English and Russian strings
│   └── cypress/                  # End-to-end specs
├── mcp/                          # MCP server: lets an AI play with an API key (docs/integrations/MCP.md)
├── lib/                          # Shared types, constants, pure functions
├── docs/                         # Game design, development plan, testing, API, MCP, deployment, CHANGELOG.md
├── scripts/                      # e2e, load test, release, docs and i18n checks
├── docker-compose.yml            # PostgreSQL, Redis; optional full stack (profile `stack`)
├── ecosystem.config.json         # PM2 process definition (prod)
├── AGENTS.md                     # Engineering rules for contributors and agents
└── README.md
```

---

## Getting started

### Prerequisites

- Node.js ≥ 20
- Docker (for the local PostgreSQL)
- (optional) SMTP credentials for email verification — without them the email service is a no-op

### 1. Install dependencies

The repo is an **npm workspaces** monorepo (`lib`, `api`, `client`, `mcp`): one install at the root, one lockfile.

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

In the Claude desktop app the same two servers start from `.claude/launch.json` (`api` on :8080, `client` on :5173).

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
| `WHITELIST_URLS`                                    | api     | Comma-separated CORS and Socket.IO origins; one wildcard in the first host label is allowed (`https://bot-rts-*.vercel.app`)                                                                                                                                   | `FRONTEND_URL`                                     |
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
| `AUTH_CACHE_TTL_MS`                                 | api     | How long a token's owner is remembered between requests (0 = off; a ban takes effect this much later) | `2000` (`0` in tests) |
| `COOKIE_SAME_SITE` / `COOKIE_DOMAIN`                | api     | `lax` \| `strict` \| `none` for the refresh cookie (default `none` in production, `lax` otherwise) / parent domain to share it with sibling hosts | – |
| `ADMIN_2FA_TTL` / `ADMIN_IP_ALLOWLIST` / `ADMIN_SECRET` | api  | How long an admin session stays verified by the second factor (default `8h`) / addresses the admin console may be used from (default: any) / key that encrypts the TOTP secrets (default `JWT_ACCESS_SECRET`) | – |
| `MONITORING_ENABLED` / `MONITORING_INTERVAL_MS` / `ADMIN_ALERT_EMAILS` / `ADMIN_ALERT_THRESHOLDS` | api | Sample the health metrics for the admin console (default on outside tests) / how often (default `10000`) / who is emailed about red alerts / JSON overrides of the alert thresholds | – |
| `LOG_BUFFER_SIZE`                                   | api     | How many of the newest log lines are kept in memory for the admin console's log search (default `5000`) | – |
| `TRUST_PROXY`                                       | api     | `true` behind a reverse proxy (client IPs for rate limits)                                                                                                     | `false`                                            |
| `APP_ROLE`                                          | api     | `all` (default), `api` or `engine`: what this process does in a scaled deployment, see [DEPLOYMENT.md](./docs/operations/DEPLOYMENT.md) | `all`                                              |
| `REDIS_URL` / `ENGINE_REQUEST_TIMEOUT_MS`           | api     | Redis for the Socket.IO adapter and the link to the engine node (required for `api` and `engine`) / how long an API node waits for it | – / `15000`                                        |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_AUTH_MAX`      | api     | Rate limit of the auth routes (per IP; shared across nodes with Redis)                                                                                                              | `900000` / `20`                                    |
| `RATE_LIMIT_API_WINDOW_MS` / `RATE_LIMIT_API_MAX`    | api     | Rate limit of every other route (per IP; default 600 per minute) | `60000` / `600` |
| `HTTP_BODY_LIMIT_BYTES`, `HTTP_HANDLER_TIMEOUT_MS`, `HTTP_REQUEST_TIMEOUT_MS`, `HTTP_HEADERS_TIMEOUT_MS`, `HTTP_KEEP_ALIVE_TIMEOUT_MS` | api | Largest JSON body, handler time before `503 REQUEST_TIMEOUT`, and Node's slow-client limits | `262144`, `30000`, `60000`, `15000`, `65000` |
| `LOG_FORMAT` / `LOG_FILE`                           | api     | `json` or `text` log lines (`json` in production) / `false` logs to the console only | `text`, `true` |
| `METRICS_TOKEN`                                     | api     | Bearer token of `GET /api/v1/metrics`; unset disables the endpoint | – |
| `LIFECYCLE_ENABLED` / `LIFECYCLE_INTERVAL_MS`       | api     | The data lifecycle job (cleanup of old data and inactive accounts), default on except in tests / its interval | – / `3600000` |
| `UNVERIFIED_ACCOUNT_DAYS`, `INACTIVE_ACCOUNT_DAYS`, `INACTIVE_ACCOUNT_NOTICE_DAYS`, `EXECUTION_RETENTION_DAYS`, `AUTH_DATA_RETENTION_DAYS` | api | Retention numbers of the job (`INACTIVE_ACCOUNT_DAYS=0` switches inactivity erasure off) | `7`, `365`, `30`, `30`, `7` |
| `SMTP_HOST`                                         | api     | SMTP host (required in production)                                                                                                                             | `smtp.gmail.com` outside production                |
| `SMTP_PORT` / `SMTP_SECURE`                         | api     | SMTP port / implicit TLS flag                                                                                                                                  | `465` / `true` when the port is 465                |
| `SMTP_USER` / `SMTP_PASS`                           | api     | SMTP credentials; without them the email service is a no-op                                                                                                    | —                                                  |
| `ROOT_USER_EMAIL` / `ROOT_USER_PASSWORD`            | api     | Auto-created root/admin user                                                                                                                                   | `root@root.root` / none                            |
| `NEXT_PUBLIC_API_URL`                               | client  | Backend base URL (read in the browser)                                                                                                                         | `http://localhost:8080`                            |
| `NOTIFICATION_RETENTION_DAYS`                       | api     | How long the notifications of the players are kept                                                                                                              | `30`                                               |
| `NOTIFICATION_COALESCE_MS`                          | api     | Repeated events of one kind about one bot within this time are one notification with a count                                                                    | `30000`                                            |
| `NOTIFICATION_CAP_PER_MINUTE`                       | api     | The most notifications of one category a player gets in a minute                                                                                                | `30`                                               |
| `NEXT_PUBLIC_CONTACT_EMAIL`                         | client  | The address the privacy policy tells players to write to about their data (read at build time)                                                                  | `privacy@botrts.example`                           |
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

- **Unit tests:** Jest in `api`, `client` and `mcp`. **Integration tests:** `*.int.test.ts` on a real PostgreSQL in Docker
  (`npm run db:up`), no in-memory database. **E2E:** Cypress (`npm run e2e`).
- **Coverage gate:** ≥ 97 % per package, enforced in CI and by the pre-push hook. Further gates: import boundaries, OpenAPI drift,
  translations, Markdown links, Lighthouse, and the load and soak harness (`npm run load`).

Commands, conventions, the end-to-end coverage matrix and known issues: [`docs/testing/`](./docs/testing/README.md).

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
- [`docs/testing/`](./docs/testing/README.md) — testing: types, commands, CI gates, the end-to-end coverage matrix, known issues, and the
  [load and soak harness](./docs/testing/load-testing.md) with measured capacity and tuning of the scheduler budget.
- [`docs/integrations/MCP.md`](./docs/integrations/MCP.md) — the MCP server that lets an AI play with an API key: tools, scopes, stdio and HTTP.
- [`docs/integrations/API.md`](./docs/integrations/API.md) — the public API: API keys and scopes, limits, errors, stability and deprecation policy.
- [`docs/operations/RELEASING.md`](./docs/operations/RELEASING.md) — versioning, the changelog, and how to cut a release or a hotfix.
- [`docs/CHANGELOG.md`](./docs/CHANGELOG.md) — release notes.
- [`docs/operations/DEPLOYMENT.md`](./docs/operations/DEPLOYMENT.md) — how the processes are laid out and scaled (roles, Redis, sticky routing).
- [`AGENTS.md`](./AGENTS.md) — engineering rules for AI/human contributors (SOLID, testing, Git Flow, DoD).
- [`docs/code-quality-reviews/2026-10-10.md`](./docs/code-quality-reviews/2026-10-10.md) — quality assessment of the original prototype (historical).
- [`docs/DEVELOPMENT-PLAN.md`](./docs/DEVELOPMENT-PLAN.md) — refactoring, test, and feature roadmap with story points (phases 0–11; Phase 11 was developed after Phase 7; Phases 0–8 and 11 are done).
- [`docs/archived-docs/`](./docs/archived-docs/UNCERTAINTIES.md) — the decision log from the planning pass and the original product notes.
