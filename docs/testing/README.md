[← README](../../README.md)

# Testing

The rules (what every feature must ship with) are in [`AGENTS.md` §6](../../AGENTS.md). This folder describes how testing
works in practice.

| Page | What it holds |
| --- | --- |
| This page | Test types, commands, CI gates, conventions |
| [e2e-matrix.md](./e2e-matrix.md) | Every core user and game flow and the Cypress spec that covers it. Update it in the same PR as a flow |
| [load-testing.md](./load-testing.md) | The load and soak harness, measured capacity, tuning |
| [known-issues.md](./known-issues.md) | Flaky-test notes and output that looks like an error but is expected |
| [reports/](./reports) | Dated one-off reports, such as the quality sweep of a phase |
| [by-phase.md](./by-phase.md) | Historical: what each phase scheduled |

## Test types

| Type | Tooling | What it covers | Database |
| --- | --- | --- | --- |
| **Unit** | Jest, mocks and small fakes of the ports | Pure functions, domain rules, use cases, the engine, scheduler, combat and energy rules (clock and RNG are injected, so results are deterministic) | none, ever |
| **Integration** | Jest + `supertest`, Nest testing module | Prisma repositories, use cases with real data, HTTP and socket slices | real PostgreSQL in Docker, one database per test file |
| **End-to-end** | Cypress against a seeded backend | **Every core user and game flow** ([matrix](./e2e-matrix.md)) | real PostgreSQL in Docker |
| **Quality gates in CI** | Lighthouse CI, import-boundary check, migration check, OpenAPI drift check, missing-translation check, Markdown link check | Landing-page SEO and performance, layering rules, migrations apply to an empty database, the committed OpenAPI spec equals the generated one, translation keys are complete, no broken links | — |

## Commands

| Command | What it does |
| --- | --- |
| `npm test` | Jest of every package (`npm run db:up` first: integration tests need PostgreSQL) |
| `npm run test:coverage` | The same with coverage; fails below 97 % per package |
| `npm run e2e` | Cypress against a fresh database, the API and the built client (`--open` for the runner, `--skip-build` to reuse the build) |
| `npm run check:boundaries` | Import-boundary rules of the layered `api/src` |
| `npm run i18n:check` | English and Russian message catalogues are complete |
| `npm run docs:check` | Markdown links |
| `npm run lighthouse` | Lighthouse CI on the landing page |
| `npm run load` | The load and soak harness ([load-testing.md](./load-testing.md)) |

The pre-push hook (`.githooks/pre-push`) runs the typecheck and the coverage gate before code leaves the machine; pushes that
change only Markdown skip it.

## Coverage

- **≥ 97 %** statements, branches, functions and lines, separately for `api`, `client` and `mcp`.
- CI also blocks a PR whose **changed files** are below 97 % (`scripts/check-changed-coverage.mjs`).
- Every task ships its own tests; the story points include them. Exclusions are listed with their reason in the Jest configs, or
  are a targeted `/* istanbul ignore next */` with a comment.

## Conventions

- Unit tests are `*.test.ts` next to the code; integration tests are `*.int.test.ts`; contract tests and fakes of ports live in
  `api/tests/` (`contracts`, `fakes`, `integration`).
- Fakes are hand-written for ports or `jest.fn`. No in-memory or embedded database is ever used.
- Game logic never calls `Date.now()` or `Math.random()`; tests inject the clock and the seeded RNG, so a run is repeatable.
- An event is an edge, not a level: a test runs many ticks in an unchanged state and asserts the event fires once
  (design §24.1).
- Cypress specs are in `client/cypress/e2e/<flow>.cy.ts`, run against a seeded backend with deterministic data, and are listed
  in the [matrix](./e2e-matrix.md).
- Test bounds on real time must be generous (a busy machine runs everything in parallel); measure real cost with the load
  harness, not with a unit test ([known-issues.md](./known-issues.md)).

## Feature-specific test requirements

Some designs define their own tests: determinism and fairness ([§12](../game-design/12-real-time-execution-model.md)), sandbox
attacks ([§13](../game-design/13-security-sandboxing.md)), race conditions
([§14](../game-design/14-concurrency-race-conditions.md)), events ([§24](../game-design/24-notifications-and-events.md)), and
for the planned phases the admin authorization matrix ([§25](../game-design/25-admin-console.md)) and money conservation
([§26](../game-design/26-market-and-currency.md)). The MCP server's tests are described in
[MCP.md](../integrations/MCP.md#tests).
