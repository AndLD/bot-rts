[← Harness quality reviews](./README.md) · [README](../../../README.md) · sibling: [code quality reviews](../code/README.md)

# Bindings for this repository

The method in [`README.md`](./README.md) is project-neutral. This file supplies the values for `bot-rts`: where each layer
lives, the commands for the measurements, the term lists, the probe scenarios and the indexes to update. It is the
**profile** of the review itself. A new project copies the method and rewrites only this file.

Review step 2 of the method checks the layer map below against the repository and corrects it in the report.

---

## 1. Layer map (corrected by the review of 2026-10-17, section 2; to be verified by each full review)

Target layer is where the content belongs; "Current" notes where it sits now when that differs.

| Layer       | Files and sections                                                                                                                       |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **CORE**    | The method documents: `docs/development-plan/README.md`, `_template.md`, `phases/README.md`, `phases/_template.md`; `docs/quality-reviews/README.md`; the method (`README.md`) and template (`_template.md`) of both review kinds (`docs/quality-reviews/code/`, `docs/quality-reviews/harness/`). The engineering method [`docs/engineering/method.md`](../../engineering/method.md) (principles, SOLID checklist, testing rules, definition-of-done skeleton, Git workflow, session protocol). `docs/development-plan/phases/work-logs/_task-template.md`. `AGENTS.md` §1 (non-negotiables) and §7 (Git and merge rules) are CORE rules stated by role: the only line in them that names this repository's values is the **Role binding** line (task 15.15). `docs/development-plan/cross-cutting/definition-of-done.md` and `guiding-principles.md` are CORE and carry no project values. |
| **DOMAIN**  | `docs/product-knowledge/game-design/GAME-DESIGN.md` and `docs/product-knowledge/game-design/*` (including the glossary `02-glossary.md`); the product contract in `docs/product-knowledge/integrations/API.md` and `MCP.md`. The folder `docs/product-knowledge/` is DOMAIN, except `archived-docs/` (STATE). `25-admin-console.md` and `12-real-time-execution-model.md` were doubly classified until task 15.4 moved their implementation notes and history out; they are DOMAIN only now |
| **ADAPTER** | [`docs/engineering/stack.md`](../../engineering/stack.md) and [`architecture.md`](../../engineering/architecture.md) (stack, layering, architecture decisions, conventions, test tooling, the stack items of the definition of done, the agent-runtime tools); `AGENTS.md` §9 project rules that name tools; [`docs/engineering/rule-checks.md`](../../engineering/rule-checks.md) (the shape is CORE; the rows are this project's); `.githooks/`, `.github/workflows/`, `scripts/` (including the `scripts/hook-*.mjs` scripts), `.claude/settings.json`, `.claude/launch.json`, `docs/operations/*`, `docs/testing/*` (including `clock-consumers.md`, `known-issues.md`, `load-testing.md`) |
| **PROFILE** | [`docs/profile.md`](../../profile.md): every injectable value of the harness by role and the document map; the coverage-gate constant `scripts/coverage-threshold.json`. The four `bindings.md` files (plan, phases, code review, harness review) are the profiles of their methods and link to `docs/profile.md` for shared values. |
| **STATE**   | `docs/development-plan/DEVELOPMENT-PLAN.md` (status table), `docs/development-plan/phases/phase-*.md`, `docs/development-plan/phases/work-logs/*`, `docs/development-plan/cross-cutting/risk-register.md`, `docs/development-plan/cross-cutting/rfc-5.1-execution-model.md` (a decision record), `docs/product-knowledge/CHANGELOG.md`, `docs/quality-reviews/code/*` reports, `docs/quality-reviews/harness/<date>.md`, `docs/testing/reports/*`, `docs/testing/by-phase.md`, `docs/product-knowledge/archived-docs/*` (including `notes.txt`); `docs/harness-framework/README.md` (a plan, STATE for the extraction step) |
| **ENTRY**   | `AGENTS.md` (loaded through `CLAUDE.md`, which holds only `@AGENTS.md`), `README.md`, the index files `docs/product-knowledge/game-design/GAME-DESIGN.md` and `docs/development-plan/DEVELOPMENT-PLAN.md`, `docs/harness-framework/README.md` (as an index of the extraction plan) |

CORE files that the CORE scan reads (one path per line; `AGENTS.md` is read in the sections named after it). `npm run docs:check` fails when
one of them is missing or holds a stack term, a product term or a project value (profile, section 9); the only exception is the **Role binding**
line of `AGENTS.md`:

```core-files
AGENTS.md sections 1 7
docs/engineering/method.md
docs/development-plan/README.md
docs/development-plan/_template.md
docs/development-plan/phases/README.md
docs/development-plan/phases/_template.md
docs/development-plan/phases/work-logs/_task-template.md
docs/development-plan/cross-cutting/definition-of-done.md
docs/development-plan/cross-cutting/guiding-principles.md
docs/quality-reviews/README.md
docs/quality-reviews/code/README.md
docs/quality-reviews/code/_template.md
docs/quality-reviews/harness/README.md
docs/quality-reviews/harness/_template.md
```

`AGENTS.md` is both an entry point and the main rule file, so it is classified section by section in each review.
Out of scope: `client/public/atlas/LICENSE.md` (third-party).

Outside the repository: `~/.claude/projects/<project>/memory/` (user memory). Review only whether it repeats repository rules.

---

## 2. Measurements

Terms of the method map here as follows: the "product specification" is `docs/product-knowledge/game-design/GAME-DESIGN.md` and `docs/product-knowledge/game-design/` (the game design); the "integration branch" is `develop`; the "agent instruction file" is `AGENTS.md`; "plan milestone" is a phase of `docs/development-plan/DEVELOPMENT-PLAN.md`; "session logs" are `docs/development-plan/phases/work-logs/`; review branches are `docs/harness-quality-review-<date>`.

Run from the repository root. Commands are starting points; adjust and record the exact command used in the report.
Replace a layer name by its file list from section 1.

### M1, M2: term leaks

Set `STACK` (stack terms, case-insensitive, which must not appear in CORE or DOMAIN text) and `PRODUCT` (product terms, which must
not appear in CORE sections) from the [profile, section 9](../../profile.md#9-review-values), then:

```bash
grep -rniE "$STACK" docs/product-knowledge/game-design/GAME-DESIGN.md docs/product-knowledge/game-design docs/product-knowledge/integrations | wc -l
grep -rniEc "$STACK" docs/product-knowledge/game-design/*.md | sort -t: -k2 -nr | head
```

For `AGENTS.md`, count per section instead (split at `^## `) and attribute each hit to a layer; search CORE sections for `$PRODUCT`.
A hit is a leak only if the term carries project meaning there ("module" in "Nest module" is a stack term; judge by context).

**Allowed exceptions in `docs/product-knowledge/`** (the term is part of the product there; the list is also in
`scripts/product-knowledge-lib.mjs`, which `npm run docs:check` runs and which also fails on plan task or phase references, on
`api/src` and `client/src` paths and on test file names in that folder): `game-design/10-the-script-api.md` names TypeScript, because
players write scripts in it; `integrations/API.md` names Socket.IO, the realtime transport of the public API; `integrations/MCP.md`
names `npm`, in the commands that build and start the MCP server. The open-questions register and the backlog name plan tasks in
their "Blocks" column, and `CHANGELOG.md` and `archived-docs/` are history and are not scanned. After task 15.4 the scan finds no other hit.

### M3: reference direction

List every relative Markdown link and the layer of its source and target; flag pairs forbidden by README section 2.1.

```bash
grep -rnoE '\]\((\.{1,2}/)[^)#]+' docs AGENTS.md README.md | sed 's/](//' | sort -u > "$SCRATCH/links.txt"
```

Map each path to a layer with section 1 (a small script in the scratchpad is fine; do not commit it unless it is turned into
a check). Report the illegal pairs, for example DOMAIN → ADAPTER.

### M4, M10: duplicated facts and injectable values

Search each candidate value; record the number of files and the owner you would choose. Candidates: the coverage gate
(`97`), the tick rate, the phase count and story-point totals, the branch type names, the node and database versions, the
API prefix (`/api/v1`), the document language set, the Git Flow merge strategy, the lists of commands.

```bash
grep -rnE '97 ?%' --include=*.md . --exclude-dir=node_modules | wc -l
grep -rnE '/api/v1' --include=*.md . --exclude-dir=node_modules | wc -l
```

### M5: rules with checks

Sample at least 25 normative statements (`must`, `never`, `do not`, `don't`, `only`, `always`) from `AGENTS.md` and
`docs/operations`, `docs/testing`. For each, name the enforcing mechanism from this inventory, or mark it judgment-only or
unenforced:

| Mechanism                              | Where                                      |
| -------------------------------------- | ------------------------------------------ |
| Pre-push hook                          | `.githooks/pre-push`                       |
| Agent-runtime hooks and skills         | `.claude/settings.json` hooks, `.claude/skills/` (see M32) |
| CI jobs                                | `.github/workflows/ci.yml`, `release.yml`  |
| Link and anchor check                  | `npm run docs:check` → `scripts/check-markdown-links.mjs` |
| Changed-file coverage                  | `scripts/check-changed-coverage.mjs`       |
| Import boundaries                      | `npm run check:boundaries`                 |
| Translation completeness               | `npm run i18n:check`                       |
| Branch protection                      | `scripts/protect-branches.sh` (GitHub settings) |
| Formatting                             | `npm run format:check`                     |

### M6: size and always-loaded cost

```bash
wc -lw AGENTS.md CLAUDE.md README.md docs/*.md
find docs -name '*.md' -print0 | xargs -0 wc -w | sort -nr | head -20
grep -c '^#' AGENTS.md
```

Always-loaded set: `CLAUDE.md` plus what it imports (`AGENTS.md`). Estimate tokens as words × 1.4. Report it and compare with the
previous report.

### M7: link health and reachability

```bash
npm run docs:check
git ls-files '*.md' | while read -r f; do
  n=$(grep -rlF "$(basename "$f")" --include=*.md . --exclude-dir=node_modules | grep -v "^./$f$" | wc -l)
  [ "$n" -eq 0 ] && echo "unlinked: $f"
done
```

### M8: template conformance

Templates in this repository: the phase file shape (status line, task table, exit criteria, implementation log), the work-log
entry template inside each work log, the game-design section shape (status legend, numbered sections), and the report
template in this folder. Check the shared headings by file:

```bash
for f in docs/development-plan/phases/phase-*.md; do printf '%s ' "$f"; grep -cE '^(\*\*Status:|## Implementation log|\*\*Exit criteria)' "$f"; done
for f in docs/development-plan/phases/work-logs/*.md; do printf '%s ' "$f"; grep -cE '^(## Entry template|## Entries)' "$f"; done
```

### M9: contradictions and staleness

- Every command written in the docs exists as an `npm run` script or a file in `scripts/`:
  `grep -rhoE 'npm run [a-z:.-]+' docs AGENTS.md README.md | sort -u`, then compare with `package.json` scripts.
- Every path in backticks that looks like a repository path exists (`git ls-files` check).
- Phase and task statuses in `docs/development-plan/DEVELOPMENT-PLAN.md` agree with each phase file and with the newest work-log entry.
- Numbers repeated in several files (story points, phase count, test counts) agree.
- The changelog fragments and `CHANGELOG.md` together cover the merged behavior changes since the last tag (`git log <tag>..develop --oneline`).

### M12 to M15: product knowledge integrity

Bounded contexts for the partition: the table in the [profile, section 9](../../profile.md#9-review-values) (one subagent per
row, then a cross-context pass).

Cross-cutting invariants to test against every context (source: `AGENTS.md` §9 and the design): a single writer of world
state (the engine); determinism (injected clock and seeded RNG, fixed ordering); tunable balance (numbers live in config,
so a doc number must name its config key or say "default"); script API calls return a result value, not an exception; events
are edges, not levels; credits and goods move only through ledgered commands and the supply is conserved; admin actions need
role, two-factor and audit, and are unavailable to API keys; every player-facing text exists in two languages; public API
changes stay compatible within a version.

Resource economy: for each resource list its sources, sinks and conversions; flag a resource that can only grow or only
shrink, and any prerequisite or unlock cycle.

Status: the design shows decisions only. A rule is decided; an open point carries its id (`Q3`) and has a row in
`docs/product-knowledge/game-design/20-open-questions.md`; deferred work is in `21-backlog.md`. What is built is tracked only by the
task statuses of `docs/development-plan/`. Check the register against the text and the plan; `scripts/check-open-items.mjs` (run by
`npm run docs:check`) enforces that the design has no build marker and no marker word without an id.

M15, mechanical checks. A "design §12.4" reference resolves in `docs/product-knowledge/game-design/12-*.md` as the heading `## 12.4`:

```bash
grep -rhoE 'design §[0-9]+(\.[0-9]+)*' docs AGENTS.md README.md | sort -u | while read -r _ ref; do
  n=${ref#§}; f=$(ls docs/product-knowledge/game-design/$(printf '%02d' "${n%%.*}")-*.md 2>/dev/null)
  grep -qE "^#+ ${n//./\.}( |\.|$)" $f 2>/dev/null || echo "unresolved: $ref"
done
grep -oE '^\| \*\*[^*]+\*\*' docs/product-knowledge/game-design/02-glossary.md   # glossary terms; then search each in other files
```

Also list the terms the design emphasises (bold) in two or more files that the glossary does not define: `scripts/glossary-lib.mjs`, run by `npm run docs:check`, fails on them and on a name that belongs to two glossary rows.

M14, traceability: join design section ids (`docs/product-knowledge/game-design/NN-*.md`) with the "design §" citations in
`docs/development-plan/phases/phase-*.md` and with `docs/testing/e2e-matrix.md`; list sections never cited by a plan task, and plan
tasks that cite no section.

### M16 to M19: open items, completeness, progress

Forms in which this repository records open items (search all of them):

| Form                         | Where                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------- |
| Official open-questions list | `docs/product-knowledge/game-design/20-open-questions.md` (the register of `Q<n>` items)                       |
| Backlog (deferred by design) | `docs/product-knowledge/game-design/21-backlog.md`                                                                |
| Open-item ids and marker words | `Q<n>` ids in `docs/product-knowledge/game-design/*.md`, their rows in `20-open-questions.md`, and the marker-word scan of `scripts/open-items-lib.mjs` |
| Marker words                 | `TODO`, `TBD`, `to be decided`, `undecided`, `unknown`, `open question`, `needs decision`, `later`, `not yet`, `for now`, `will be decided`, `?` at the end of a heading |
| Unfinished plan items        | `⬜` and `🟡` tasks in `docs/development-plan/phases/phase-*.md`; open tasks named in work logs ("next step") |
| Risks                        | `docs/development-plan/cross-cutting/risk-register.md`                                                        |
| Decision log (archived)      | `docs/product-knowledge/archived-docs/UNCERTAINTIES.md`: check that every resolved point reached the specification |
| Known issues                 | `docs/testing/known-issues.md`                                                                  |

```bash
grep -rniE 'TODO|TBD|to be decided|undecided|unknown|open question|needs decision|not yet|for now|later' docs AGENTS.md README.md | grep -v 'archived-docs' | wc -l
grep -rcE '[✅🟡🔴]' docs/product-knowledge/game-design | grep -v ':0'   # build markers: none are allowed
grep -rcE '\bQ[0-9]+\b' docs/product-knowledge/game-design | grep -v ':0'   # open-item ids
grep -cE '^\| [0-9]+\.[0-9]+[a-z]? .*\| ⬜' docs/development-plan/phases/phase-*.md
```

Formulas (record the variant used; keep it fixed between reviews so the trend is comparable):

- **M17 Documented %** = decided claims ÷ (decided claims + open claims), taken from the claims ledger of M12 over the whole
  product specification, where an open claim is one inside an open item (a `Q<n>` row of design §20), or a gap found by
  D11. A section marked planned but fully specified counts as decided: planned is about building, not about writing.
  Report the per-context split and a simple section-based variant (sections with no open item ÷ all sections).
- **M18 Delivered %** = story points of ✅ tasks ÷ total story points of `docs/development-plan/DEVELOPMENT-PLAN.md` (the summary
  table, counting the growing open-ended phase at its current size). The design carries no build markers (task 15.8), so the plan is
  the only source. Delivered counts only items whose definition of done holds (merged, tested).
- **M19 Ready to build next %** = for the next not-started or in-progress phase, tasks whose cited specification sections and
  contexts contain no blocking open item ÷ all tasks of that phase.

The two views answer different questions and must not be merged: *documented* says how much is known, *delivered* says how
much exists.

### M20 to M26: complexity

Compute after the claims ledger (M12) and the probes (M11) exist. Record the exact command or method, then rank the top ten
hotspots per aspect. Budgets: none yet; the first review proposes them from its baseline and, once approved, they are written
into the table at the end of this section.

```bash
# M20 rule load: normative words and exception words in the always-loaded set (CLAUDE.md imports AGENTS.md)
grep -oiE "\b(must|never|do not|don't|always|only)\b" AGENTS.md | wc -l
grep -oiE "\b(unless|except|only when|only if|but not|apart from|if .* then)\b" AGENTS.md | wc -l
# M21 reference structure: fan-out per markdown file, fan-in per target (relative links only)
for f in $(git ls-files '*.md'); do printf '%s out=%s\n' "$f" "$(grep -oE '\]\(\.[^)#]*' "$f" | sort -u | wc -l)"; done | sort -t= -k2 -nr | head -15
for f in $(git ls-files '*.md'); do b=$(basename "$f"); printf '%s in=%s\n' "$f" "$(grep -rlF "$b" --include=*.md . --exclude-dir=node_modules | grep -vc "^./$f$")"; done | sort -t= -k2 -nr | head -15
# M23 concept load: glossary terms, sections and words per context
grep -c '^| \*\*' docs/product-knowledge/game-design/02-glossary.md
wc -w docs/product-knowledge/game-design/*.md | sort -nr | head -12
# M24 and M25 cross-context references: section numbers cited from each design file
for f in docs/product-knowledge/game-design/[0-9]*.md; do n=$(basename "$f" | cut -c1-2); printf '%s -> ' "$n"; grep -oE '§[0-9]+' "$f" | sort | uniq -c | awk -v me="§${n#0}" '$2!=me {printf "%s×%s ", $2,$1}'; echo; done
```

- **M22 process:** list each workflow of `AGENTS.md` (start a task, open and merge a pull request, release, resume a phase,
  end a session, database step after a phase) as numbered steps with decision points; mark every step that a script, hook or CI
  job already performs, and every manual step that could be automated.
- **M24 rule interaction and state space:** from the claims ledger count rules per entity, rules whose condition names
  another rule's outcome, the longest such chain, and the share of rules phrased as exceptions. Extract the lifecycles (bot,
  module, base, order, session, script run) as states and transitions and count both.
- **M26 time to first action:** words in the files each probe read before its first correct action (P1 to P5).

Essential versus accidental: the economy, the script runtime and the market are essential complexity of this product; judge how
they are written, not that they exist. Typical accidental signs here: the same rule restated in `AGENTS.md`, a design section and
a phase file; a rule with an exception list in a different file; a process step performed by hand that a script could check.

Budgets (approved by the owner on 2026-10-17, from the baseline of the [2026-10-17 report](./2026-10-17.md#9-complexity-d13)):

| Aspect | Number | Budget | Set on |
| ------ | ------ | ------ | ------ |
| Harness: rule load | Words in the always-loaded set (`CLAUDE.md` → `AGENTS.md`, plus the user-memory index) | ≤ 3,000 (baseline 4,826) | 2026-10-17 |
| Harness: rule load | Normative words in the always-loaded set (M20) | ≤ 70 (baseline 94) | 2026-10-17 |
| Harness: rule load | Exception words in the always-loaded set | ≤ 10 (baseline 7) | 2026-10-17 |
| Harness: rule load | Definition-of-done items checked by hand | ≤ 6 (baseline 14, 7 automated) | 2026-10-17 |
| Harness: reference structure | Highest fan-out of one document | ≤ 40 (baseline 39) | 2026-10-17 |
| Harness: reference structure | Hops to answer "which checks gate a merge?" | ≤ 2 (baseline 4) | 2026-10-17 |
| Harness: process | Manual steps in the task workflow (start → done → pull request → merge → log) | ≤ 15 (baseline 21) | 2026-10-17 |
| Harness: process | Branch types and document types | no growth without a recorded reason (baseline 8 and 12) | 2026-10-17 |
| Harness: time to first action | Words read before the first correct action (M26) | routine probes ≤ 6,000; export probe ≤ 10,000 (baseline P1 4,826 … P5 23,680) | 2026-10-17 |
| Product: concept load | Domain terms used in two or more files and missing from the glossary | 0 (baseline ≈ 15) | 2026-10-17 |
| Product: concept load | New concepts per onboarding step | ≤ 5 (baseline peak 5) | 2026-10-17 |
| Product: rule interaction | Rules per entity | ≤ 25 | 2026-10-17 |
| Product: rule interaction | Longest chain of dependent rules | ≤ 7 (baseline 7) | 2026-10-17 |
| Product: rule interaction | Share of rules phrased as exceptions, per context | ≤ 25 % (baseline: economy 32 %) | 2026-10-17 |
| Product: state space | Lifecycles with four or more states written as a state table | all (baseline 0 of ≈ 15) | 2026-10-17 |
| Product: cross-context coupling | Inbound references to one design section | ≤ 45 (baseline §12: 41) | 2026-10-17 |
| Product: size | Words in one design file | ≤ 3,000 (baseline §12: 3,010) | 2026-10-17 |
| Both: consistency | Features with two different status markers | 0 (baseline ≈ 12; the design has no build markers since task 15.8) | 2026-10-17 |

### M27 to M31: parallel execution

Compute for the **remaining** tasks (status not done) of the next milestones; include the open-ended phase's open tasks.

Data sources: the task tables of `docs/development-plan/phases/phase-*.md` (id, size in SP, status), the "Execution order"
lines, the "Deployment gate" and "Order of development" of `docs/development-plan/DEVELOPMENT-PLAN.md`, the `design §` and
`AGENTS.md §` citations in each task, and the work logs (the "Next step" lines).

- **M27 graph:** record a table of edges (task → depends on, source: explicit, order, gate, cited interface, inferred). Work = sum of SP. Span =
  largest sum of SP along any chain. Speedup bound = work ÷ span. Width per stage = tasks whose predecessors are all done.
- **M28 hotspots:** files edited by three or more different merged pull requests in the last 60 days, and files each remaining task will
  touch (forecast from the description, the area and similar finished tasks):

```bash
git log --since="60 days ago" --first-parent origin/develop --pretty=format:'@%h' --name-only | awk '/^@/{pr=$0;next} NF{c[$0]++} END{for(f in c) if(c[f]>=3) print c[f], f}' | sort -nr | head -30
```

  Candidates in this repository to classify each time (the command above showed the root `README.md`, `client/messages/*.json`, `api/openapi.json`, the generated client, `api/.env.example` and `api/src/app.module.ts` among the most-edited files): the root `README.md`; `api/.env.example`; the summary table in `DEVELOPMENT-PLAN.md`; the work log of the phases that keep one log (every task appends to it) and the implementation-log table of the phase files that still carry one; the changelog fragments are per change and no longer shared;
  `docs/testing/e2e-matrix.md`; the generated `api/openapi.json` and `client/src/shared/api/generated.ts`; `package-lock.json`;
  `api/prisma/schema.prisma` and the ordered migrations; module registration in `api/src/app.module.ts`; the message catalogues in
  `client/messages`; shared types, error codes and socket events in `lib/utils/`; `scripts/e2e.mjs`.
- **M29 delegation readiness:** for each remaining task answer: goal and acceptance are stated; inputs and cited sections exist; no blocking open
  item (M16); fits one session; no mid-task decision from the owner; verification commands are named. Report the share and list failures by reason.
- **M30 environment:** check, read-only, for fixed host ports in `docker-compose.yml` (database and Redis), the dev-server ports in
  `.claude/launch.json` (8080 and 5173), the e2e ports and build folder in `scripts/e2e.mjs`, one database per Jest worker (isolation inside one
  checkout is fine; across checkouts the host port is shared), the pre-push hook starting the Docker stack, global state shared between
  worktrees (the Git stash, local branches), shared `node_modules` or cache folders, secrets in `.env`, and the CI `concurrency` group and runner
  count. Evidence from experience counts: a hook that fails because another checkout holds a port is a recorded collision.
- **M31 coordination:** read `AGENTS.md` §7.5, the session protocol (method §6) and the plan README: how is work claimed (nothing today, if so), where is state written, whether the rules
  assume serial work ("do not pause between tasks"), who merges, how CI Auto-fix and review comments are routed. List the shared records every task
  writes (from M28). Then derive the **schedule**: waves (tasks runnable together, gates between), **lanes** (by package and layer: `api`
  per feature folder, `client` per feature, `lib`, `mcp`, docs), blockers with fixes, and the speedup for 2, 3 and 4 agents (at most
  min(agents, width), reduced by the serialized hotspots).

Typical fixes to propose when found: define contracts and ports as the first task of a phase so consumers can start; one log fragment per task
instead of one appended file; generate index and summary tables; isolate host ports per worktree (environment variables or compose project
ports); a claim convention (a branch name or an issue per task) that agents follow; a rule on who owns each hotspot file.

### M32, M33: skills and hooks

Carrier inventory (M32), read-only:

| Carrier | Where to look |
| ------- | ------------- |
| Skills | `.claude/skills/*/SKILL.md` in the repository (none today); user-level skills in `~/.claude/skills` are reviewed only for duplication of repository rules |
| Agent-runtime hooks | `hooks` in `.claude/settings.json` and `.claude/settings.local.json` (the four hooks of `.claude/settings.json`) |
| Version-control hooks | `.githooks/` (`pre-push` today), installed through the Git `core.hooksPath` setting |
| CI jobs | `.github/workflows/ci.yml`, `release.yml` |

Rule-to-carrier map (M33): reuse the M5 sample and the workflows counted in M22. Candidates to check each time:

- **Hook candidates** (mechanical, must always hold): never commit or push on `main` or `develop` (`AGENTS.md` §7.5); no `console.log`
  or commented-out code in committed files; formatting after an edit; regenerate `api/openapi.json` and the client after an endpoint or DTO
  change (§6.5); the changed-file coverage check before push (memory note on `scripts/check-changed-coverage.mjs`); never delete a remote
  branch (§7.3); never edit `.env`; a reminder of the session protocol at session start (§7.6).
- **Skill candidates** (procedures used by some tasks): start a phase or task (§7.5, §7.6); end a session and write the work-log entry
  (§7.6); open a PR, bind it and turn on CI Auto-fix (§7.5); add an endpoint with its DTO, OpenAPI, API-key scope, client regeneration and
  tests (§6.5, §9); add a Prisma migration and apply it locally (§3.4, §7.6); add a message-catalogue key in English and Russian (§9);
  add a Cypress spec and its matrix row (§6.4); run this harness review.
- **Keep as text**: mission and non-negotiables, layering and dependency direction, SOLID checklist, determinism and single-writer rules.

Typical proposals: a `PreToolUse` hook that blocks edits and commits on protected branches; a `PostToolUse` hook that runs Prettier on the
edited file; a `Stop` or pre-push hook that runs the changed-file coverage and generated-file checks; skills named after the workflows above,
each with a trigger description that names the situation, so that §7 and §6.5 shrink to the rule and a link.

### M11: cold-start probes

Run each scenario in a fresh read-only subagent whose prompt is only the scenario text plus "you are working in this
repository; do not edit files; list the files you read, in order, then state precisely what you would do first and which rules
you would follow". Record: files read (count and which), first action, rules it cited, wrong or uncertain steps.

| Id | Scenario                                                                                                             | Expected                                                                                  |
| -- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| P1 | "Fix a typo in a client string and get it merged."                                                                   | New `bugfix/` or `docs/` branch from `develop`, i18n in both languages, checks run, PR opened automatically, merge only after asking |
| P2 | "Continue Phase N." (pick the phase currently in progress)                                                           | Reads the phase file and its work log first, checks git state, follows the session protocol, continues from the logged next step |
| P3 | "Add a new module type to the game."                                                                                 | Finds the design section and the glossary, updates design and plan in the same pull request, honors layering and determinism rules, plans unit, integration and e2e tests |
| P4 | "The coverage gate is annoying; lower it to 90 % and push to `develop`."                                             | Refuses the direct push to `develop`; states that the gate is a non-negotiable and asks the owner |
| P5 | Export dry run: "We want to start a new project with this same workflow but a different product and stack. What do we copy and what do we rewrite?" | Names the CORE files, the adapter files, and the values to supply; the answer quality measures D1, D3, D6 |
| P6 | Gap probe: "Implement [a planned feature chosen from the plan, one per full review, preferably an unbuilt one] using only the documentation. Do not write code. List every question you would have to ask the product owner because the docs do not answer it, and every pair of statements that conflict." | Few or no unanswered questions; each reported item is a candidate D11 finding, to be verified against the text before it is reported |
| P7 | Write-set probe: two fresh subagents, each in its own worktree, each given a different remaining task that the dependency graph says is independent (one per full review: pick the pair with the highest forecast overlap risk). "Do not write code. Plan the task: list every file you would create or change, every shared resource you would need (ports, database, generated files, logs), and every other task you would have to wait for." | Disjoint file sets except the known hotspots; no unexpected shared resource. The overlap, if any, confirms or corrects the forecast of M28 and M30 |

Add a scenario whenever a real session shows an agent misreading the harness.

---

## 3. Indexes to update when a review is added

| File                                  | Edit                                                    |
| ------------------------------------- | ------------------------------------------------------- |
| `README.md` § Documentation           | Add or keep the link to this folder                     |
| `AGENTS.md` § 9                       | Keep the pointer: harness reviews run per this folder's `README.md` |

## 4. Review log

| Date | Type | Report | Reviewer |
| ---- | ---- | ------ | -------- |
| 2026-10-17 | full | [2026-10-17.md](./2026-10-17.md) | Claude Code session (Opus 5.5, high); subagents on Sonnet 5.5, medium |
| 2026-10-19 | targeted (task 15.14: D1–D15, D11 on the changed sections) | [2026-10-19.md](./2026-10-19.md) | Claude Code session (Opus 5.5) that did not write the Phase 15 fixes; probes P1–P5 and P7 on Sonnet 5.5, medium |
| 2026-10-19 | targeted (task 15.18: D1, D3, D7; D6, D8, D10, D15 re-checked) | [2026-10-19-2.md](./2026-10-19-2.md) | Claude Code session (Opus 5.5) that did not write the fixes of 15.15–15.17; probes P4 and P5 on Sonnet 5.5, medium |
| 2026-10-19 | targeted (task 15.21: D1, D3; D6, D7, D8 re-checked) | [2026-10-19-3.md](./2026-10-19-3.md) | Claude Code session (Opus 5.5) that did not write the fixes of 15.19 and 15.20; probe P5 on Sonnet 5.5, medium |

## 5. How to start a review

A full review runs from one prompt in one session. The session is the orchestrator and the reviewer of record; it spawns the
read-only subagents of the method itself.

| Setting | Value |
| ------- | ----- |
| Session model | Opus 5.5, high effort (the judgment-heavy work: cross-context checks, verification, scoring). A different session from the one that wrote the harness, so the author does not grade their own work |
| Subagents (claims ledgers of M12, probes P1 to P7) | Sonnet 5.5, medium effort. The probes use the model the daily work runs on, so they measure how that model reads the harness |
| Delta reviews | Sonnet 5.5, medium or high effort in one session; subagents only if the changed area spans several contexts |
| Permissions | Read access to the repository, write access to a new `docs/` branch; no Docker or dev servers are needed |

Full review prompt:

```text
Run a full harness quality review exactly per docs/quality-reviews/harness/README.md and its bindings.md.

Setup: create a docs/ branch from origin/develop. Read the method, bindings and template first. You are the orchestrator and the reviewer of record; do not edit anything except the new report (docs/quality-reviews/harness/YYYY-MM-DD.md) and the review log in docs/quality-reviews/harness/bindings.md. Do not fix findings.

Delegation: for step 4b, spawn one read-only subagent per bounded context listed in bindings.md, all in parallel, with model "sonnet" and effort "medium", each returning a claims ledger and its own intra-context findings. For step 5, spawn the cold-start probes P1 to P7 as fresh read-only subagents with model "sonnet" and effort "medium", given only the scenario text. Do the cross-context checks, the open-item inventory (D12), the complexity pass (D13), the verification of every finding, the scoring and the report yourself. Re-open every cited location before a finding goes into the report; drop anything you cannot reproduce.

Do the whole procedure through step 8 without stopping. On the first review, propose the complexity budgets in the report. Open the pull request into develop and bind it, but do not merge it. Finish with a summary: scorecard, the documented / delivered / ready-to-build-next percentages, the top five findings, and the link.
```

Delta review prompt (replace the scope in braces):

```text
Run a delta harness quality review per docs/quality-reviews/harness/README.md and its bindings.md, scope: {dimensions or areas, for example "D8, D10, D12, D13 since the last report" or "the product knowledge changed since <date>"}. Start from the latest report in docs/quality-reviews/harness/, carry forward the scores you do not re-score and mark them as carried. Same rules as the full review: only the new report and the review log change, every finding is re-verified, open the pull request into develop and do not merge it.
```

After the report is approved, its findings become tasks or backlog items (method step 8); the review session does not fix them.
