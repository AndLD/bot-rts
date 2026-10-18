[← Code quality reviews](./README.md)

# Bindings for this repository

The method in [`README.md`](./README.md) is project-neutral. This file supplies the values for `bot-rts`: the bar, packages,
layers, commands, thresholds and exclusions. A new project copies the method and rewrites only this file.

---

## 1. The bar

The declared quality bar is [`AGENTS.md`](../../../AGENTS.md) with the [method](../../engineering/method.md) and the
[stack file](../../engineering/stack.md); the § numbers below are those of `AGENTS.md`, whose moved sections point to their new
place (§2–§5 to the stack file and the method, §6 to method §3–§4 and stack §4–§5): §1 mission and non-negotiables, §3 layering and its forbidden
imports, §4 SOLID checklist, §5 conventions, §6 testing and the definition of done, §7 Git Flow, §9 project rules (single writer
of world state, determinism, tunable balance, result values, events as edges, public API stability, two languages, operations,
admin, ledger). Targets for the scorecard come from it:

| Dimension | Target | Source |
| --------- | ------ | ------ |
| C1 | 5 | §3.1–3.4: zero boundary violations, persistence confined to infrastructure |
| C2 | 4 | §4 |
| C3 | 5 | §6.1: the coverage gate of the [profile](../../profile.md#2-quality-gates) on statements, branches, functions and lines, per package; §6.2–6.4 test types |
| C4 | 5 | §1 testability, §8: injected clock, random generator, logger; no module-level singletons |
| C5 | 4 | §1 scalability: stateless API tier, indexed access; the engine is the single in-memory owner of world state by design |
| C6 | 4 | §1 maintainability, §5, non-negotiable 4 (no dead code, no `console.log`) |
| C7 | 4 | §3.3 identity, §9 admin and API-key rules, non-negotiable 5 (no secrets in the repository) |
| C8 | 4 | §5.2: typed `AppError`, logger port, no string-matching of messages |
| C9 | 4 | §2: workspaces, pinned runtime, generated files current |
| C10 | 5 | §6.5 definition of done, §7.3–7.4: required CI, protected branches |

The previous generation of this bar differed (MongoDB, Express, Vite); the report of 2026-10-10 is the baseline of the old
prototype and is historical.

---

## 2. Packages and layers

| Package  | Role                                              | Layers and rules |
| -------- | ------------------------------------------------- | ---------------- |
| `api`    | NestJS backend, engine (`api/src/engine`)         | per feature folder under `api/src`: `domain`, `application`, `infrastructure`, `presentation`; `*.module.ts`, `app.*`, `bootstrap.ts` are composition code |
| `client` | Next.js frontend                                  | features, shared, app routes; presentation only, no business logic in route handlers |
| `lib`    | Shared types, constants, pure functions           | no runtime dependencies, no I/O, no persistence types |
| `mcp`    | MCP server, a thin client of the public API       | calls `/api/v1` only; no database or engine access |

Boundary rules are executable: `api/.dependency-cruiser.cjs` (`npm run check:boundaries`). The reviewer also checks, by search,
that the other packages obey the same spirit (for example that `client` and `mcp` import nothing from `api`).

## 3. Excluded from size and quality counts

Generated or vendored: `api/openapi.json`, `client/src/shared/api/generated.ts`, Prisma client output, `**/dist`, `**/ts-built`,
`**/coverage`, `package-lock.json`, migration SQL (counted for review, not for size). Freshness (K15):
`npm run openapi:generate -w api` and `npm run api:generate -w client`, then `git diff --exit-code`.

---

## 4. Commands

Run from the repository root on a clean checkout, with Docker running for the database.

| Measurement | Command |
| ----------- | ------- |
| K1 install | `npm ci` |
| K1 lint | `npm run lint` |
| K1 typecheck | `npm run typecheck` |
| K1 / K4 boundaries | `npm run check:boundaries` |
| K1 translations | `npm run i18n:check` |
| K1 build | `npm run build` |
| K1 / K2 / K3 tests and coverage | `npm run db:up && npm run test:coverage` (summary per package in `*/coverage/coverage-summary.json`) |
| K2 files below the gate | `node scripts/check-changed-coverage.mjs origin/develop api client mcp` plus per-file figures from `coverage-summary.json` |
| K15 generated files | see section 3 |
| K13 dependencies | `npm outdated --workspaces`, `npm ls --all 2>&1 \| grep -i "deduped\|invalid"`, search for deprecated notices in `npm ci` output |

CI definition of the same gates: `.github/workflows/ci.yml`; local gate: `.githooks/pre-push`.

### Searches

```bash
SRC='api/src client/src lib mcp/src'
# K3 types, skipped tests
git ls-files | grep -cE '\.test\.tsx?$';  git ls-files | grep -cE '\.int\.test\.ts$'; git ls-files | grep -cE '\.cy\.ts$'
grep -rnE '\b(it|test|describe)\.(skip|only)\b|\bxit\(|\bxdescribe\(' $SRC cypress 2>/dev/null
# K5 size (source files over 400 lines, tests excluded)
git ls-files 'api/src/*.ts' 'client/src/*.ts*' 'lib/*.ts' 'mcp/src/*.ts' | grep -vE '\.test\.|generated' | xargs wc -l | sort -nr | awk '$1>400' | head -25
# K6 dead code and debug output
grep -rnE 'console\.(log|debug|info)' $SRC --include=*.ts --include=*.tsx | grep -v '\.test\.'
grep -rnE '^\s*//\s*(const|let|if|for|return|await|import|export|function)\b' $SRC --include=*.ts --include=*.tsx | head -30
# K7 type escapes
grep -rnE ':\s*any\b|<any>|as any\b|@ts-(ignore|expect-error|nocheck)|eslint-disable' $SRC --include=*.ts --include=*.tsx | grep -v '\.test\.' | wc -l
# K9 hidden dependencies
grep -rnE 'Date\.now\(\)|new Date\(\)|Math\.random\(\)' api/src lib --include=*.ts | grep -v '\.test\.'
grep -rnE 'process\.env' api/src --include=*.ts | grep -v '\.test\.\|config/'
# K11 security: routes without guards, secrets
grep -rnE '@(Get|Post|Put|Patch|Delete)\(' api/src --include=*.controller.ts | wc -l
git ls-files | grep -E '(^|/)\.env($|\.)' | grep -v '\.example$'
grep -rniE '(secret|password|api[_-]?key|token)\s*[:=]\s*["'"'"'][^"'"'"']{8,}' $SRC --include=*.ts | grep -v '\.test\.' | head
# K12 errors
grep -rnE 'catch\s*\(\w*\)\s*\{\s*\}|catch\s*\{\s*\}' $SRC --include=*.ts --include=*.tsx | grep -v '\.test\.'
grep -rnE 'throw new Error\(' api/src --include=*.ts | grep -v '\.test\.' | wc -l
# K14 churn over 90 days, crossed with size
git log --since="90 days ago" --name-only --pretty=format: -- api/src client/src lib mcp/src | grep -v '^$' | sort | uniq -c | sort -nr | head -30
```

Thresholds to flag (judge in context): source file over 400 lines; function over 60 lines or cyclomatic complexity over 15;
a use case with more than 6 constructor dependencies; an interface with more than 12 members; a test file over 800 lines.

Specific checks for this repository (each is a direct test of a rule, not an assumption):

- **Single writer:** search for writes to world tables outside `api/src/engine` and its persistence adapter (§9).
- **Determinism:** clock and random-generator calls in game logic (K9).
- **Persistence isolation:** `@prisma/client` imported outside infrastructure adapters (K4).
- **Result values:** script API functions that throw instead of returning a result (§9).
- **Admin and API keys:** every `/api/v1/admin/*` handler carries the role, two-factor and audit decorators, and none accepts an API key (§9); the authorization matrix test exists and covers every handler.
- **Public API stability:** `api/openapi.json` diff against the last release tag shows no breaking change inside `/api/v1`.
- **Two languages:** `npm run i18n:check` passes; error codes have messages in both catalogues.
- **Hardcoded values:** literals for URLs, hosts, ports and tunable balance numbers in code (§9 tunable balance).

---

## 5. Hotspot sampling

Rank by size × churn (K14), include every file on the engine tick path, the identity and authorization path, the money and goods
path and the persistence flush. Read the top 15 in full and at least 5 random files per package.

## 6. Indexes to update when a review is added

| File | Edit |
| ---- | ---- |
| `README.md` § Documentation | Keep the link to `docs/quality-reviews/` |
| `docs/quality-reviews/README.md` | Add the report to the list of reports |

## 7. Review log

| Date | Type | Report | Reviewer |
| ---- | ---- | ------ | -------- |
| 2026-10-10 | full (historical, old prototype, before the method existed) | [2026-10-10.md](./2026-10-10.md) | a person and an agent |
