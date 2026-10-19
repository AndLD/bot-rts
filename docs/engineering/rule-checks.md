[← Engineering documents](../profile.md#10-document-map)

# Rule-to-check map

Every normative rule of the repository with the mechanism that holds it. A rule with a mechanism cannot be broken without a red
check or a refused call; a rule marked _judgment_ is held by review and by the tests the feature brings. Values are in the
[profile](../profile.md); the rules are in [`AGENTS.md`](../../AGENTS.md), the [method](./method.md) and the [stack file](./stack.md).
The 27 rules of the sample of the [harness review of 2026-10-17](../quality-reviews/harness/2026-10-17.md#d7-enforceability--3) are the
first 27 rows; the hooks and checks added by the harness-fixes phase follow.

**Mechanisms.** _CI_: a job of the pipeline that gates the merge (the profile lists the required checks). _Pre-push_: `.githooks/pre-push`
(code changes only). _Lint_: `npm run lint`. _Hook_: a script of `.claude/settings.json`, which refuses the call or acts on it in the
agent runtime. _Protection_: the repository ruleset of `scripts/protect-branches.sh`.

| # | Rule | Mechanism | Status |
| - | ---- | --------- | ------ |
| 1 | Coverage stays at or above the coverage gate (AGENTS §1) | Jest thresholds read from `scripts/coverage-threshold.json`; CI `verify`; pre-push | enforced |
| 2 | Every changed file meets the gate too (AGENTS §1, method §3) | `scripts/check-changed-coverage.mjs`; CI; pre-push | enforced |
| 3 | No `any` at public boundaries (AGENTS §1) | `@typescript-eslint/no-explicit-any` with `--max-warnings 0`; Lint | enforced |
| 4 | Import boundaries and layering (stack §2) | `npm run check:boundaries` (dependency-cruiser); CI | enforced |
| 5 | Prisma only in infrastructure (architecture §2) | dependency-cruiser; CI | enforced |
| 6 | Lint, typecheck, message catalogues, documentation links (definition of done) | CI `verify` | enforced |
| 7 | Generated files are current after an endpoint or DTO change (stack §5) | CI steps "API document and generated client are up to date" and "Documentation data is up to date"; pre-push runs the same | enforced |
| 8 | Migrations match the Prisma schema (architecture §2) | CI step | enforced |
| 9 | A pull request title is a Conventional Commit (AGENTS §7.4) | CI `pr-title` | enforced |
| 10 | Branches are kept after merging (AGENTS §7.3) | repository setting "delete head branches" off; the Hook refuses a remote deletion | enforced |
| 11 | No force-push or deletion of `main` or `develop` (AGENTS §7.3) | Protection | enforced |
| 12 | A pull request needs the required checks green (AGENTS §7.3, §7.4) | Protection lists the required status contexts | enforced; the owner may bypass when merging (profile) |
| 13 | No commits or pushes directly on `main` or `develop` (AGENTS §7.5) | Protection (administrators bypass it); the Hook `hook-guard-bash` refuses `git commit` and `git push` on them and any push naming them | enforced |
| 14 | Formatting (stack §3) | Prettier check inside Lint; the Hook `hook-format-edited` formats each edited file | enforced |
| 15 | No `console.log` in committed code (AGENTS §1) | ESLint `no-console` in `api`, `client`, `lib`, `mcp` (tests, command-line scripts and the seed excepted); Lint | enforced |
| 16 | No `Date.now()` or `Math.random()` in game logic (AGENTS §9) | ESLint `no-restricted-properties` in `api/src/**/domain`, `api/src/engine` and `lib/utils` (tests and the engine supervisor excepted; the clock and generator adapters are in `api/src/shared/infrastructure`, outside the scope); `docs/testing/clock-consumers.md` classifies who reads which clock | enforced |
| 17 | No dead code or commented-out blocks (AGENTS §1) | `@typescript-eslint/no-unused-vars`; review | partly |
| 18 | Single writer of world state (AGENTS §9) | architecture and review; the engine port is the only way in | judgment |
| 19 | Events are edges, not levels (AGENTS §9) | the per-feature test over many ticks that the rule asks for | judgment |
| 20 | Tunable balance lives in config (AGENTS §9) | review | judgment |
| 21 | Every UI string, error code and page exists in every user-facing language (AGENTS §9) | `npm run i18n:check`; CI | enforced |
| 22 | A user-visible flow has an end-to-end spec and a row in the e2e matrix (method §3.4) | none | unenforced |
| 23 | A behaviour change adds a changelog fragment (AGENTS §9) | `scripts/check-changelog-fragments.mjs` in `npm run docs:check` checks the format of each fragment; whether a change needs one is review | partly |
| 24 | The task status, the task log and the phase file are updated in the task's pull request (method §6) | none; the Hook `hook-session-start` prints the phase in progress and the last "Next step" at the start of a session | unenforced |
| 25 | The local database is migrated after a phase (method §6) | none | unenforced |
| 26 | Ask the owner before merging a pull request that is not plan work (AGENTS §7.5) | agent judgment | judgment |
| 27 | No secrets in the repository, `.env` never committed (AGENTS §1) | `.gitignore`; the Hook `hook-guard-edit` refuses edits of `.env` files except `.env.example` | enforced |
| 28 | Design status shows decisions only; every open point has a register row (AGENTS §9) | `scripts/check-open-items.mjs` in `npm run docs:check` | enforced |
| 29 | One name for one concept; terms emphasised in two design files are defined (AGENTS §9) | `scripts/check-glossary.mjs` in `npm run docs:check` | enforced |
| 30 | The product knowledge names no stack term, plan task or implementation path (AGENTS §9) | `scripts/check-product-knowledge.mjs` in `npm run docs:check` | enforced |
| 31 | Documentation links and anchors resolve | `scripts/check-markdown-links.mjs` in `npm run docs:check`; CI | enforced |
| 32 | The changed-file coverage and the generated files are checked before a push (AGENTS §7.5) | Pre-push | enforced |
| 33 | Never delete a remote branch (AGENTS §7.3, §7.5) | the Hook `hook-guard-bash` refuses `git push --delete`, `git push origin :branch` and the API call that deletes a ref | enforced |
| 34 | A task, branch, worktree and session start from the integration branch on the remote (method §5, AGENTS §7.5) | agent judgment; the session-start hook prints the branch | judgment |
| 35 | A change to a non-negotiable needs the owner's explicit confirmation, recorded in the pull request (AGENTS §1) | agent judgment | judgment |
| 36 | The CORE files name no stack term, product term or project value; the rules of AGENTS §1 and §7 cite roles, and one line binds them (method §5) | `scripts/check-core-leaks.mjs` in `npm run docs:check` | enforced |

Rows 22 to 25 are the open ones. The harness review scores them: they are the next candidates for a check or a skill.
