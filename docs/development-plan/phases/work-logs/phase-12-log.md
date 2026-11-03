[← Phase 12 — Issues and stabilization](../phase-12-issues.md)

# Phase 12 — Issues and stabilization — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** 12.x, 12.y
- **Branch:** `bugfix/12.x-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-14 — phase created
- **Tasks:** none started; 12.1 is planned
- **Branch:** `docs/phase-12-issues` — the plan only
- **Decisions / deviations from the plan:** the phase is open-ended and collects issues found in use; more tasks will be added as
  they appear. It is outside the MVP count.
- **Problems / blockers / findings:** 12.1 was found while checking the fix of the load harness that left API servers running
  after a run (PR #148).
- **Next step:** start 12.1 when the user asks; first reproduce it with an engine test.
- **Verify with:** `git status`, `git branch -a`, the open pull requests.

### 2026-10-17 — task 12.2 (button padding and disabled contrast)
- **Tasks:** 12.2
- **Branch:** `bugfix/12.2-button-styling` — done
- **Decisions / deviations from the plan:** two causes. (1) The global `* { padding: 0 }` reset left plain `<button>` elements
  (Save/Cancel of the terminal editor) without padding: fixed once with `:where(button)` in `global.scss` (no specificity, so
  classed buttons keep their own). (2) The stock Ant Design disabled tokens are translucent, so on the black game windows the
  surface vanished and the 25 % black label was unreadable: `src/shared/buttonTheme.ts` (applied by `RootShell` through
  `ConfigProvider`) sets an opaque disabled surface and a dark label (6.2:1) and one padding per button size. The app has a
  single (light) Ant Design theme, so the colours are opaque and work on light pages and dark windows alike.
- **Problems / blockers / findings:** no Cypress flow covers a disabled button, so none was added.
- **Next step:** merge the PR; pick the next 12.x task when the user asks.
- **Verify with:** `npm test -w client -- buttonTheme`, `npm run lint -w client`, `npm run typecheck -w client`

### 2026-10-17 — task 12.1 (tick time with few players)
- **Tasks:** 12.1
- **Branch:** `bugfix/12.1-runaway-script-tick` — done
- **Decisions / deviations from the plan:** the cause was not the hog or its sandbox. A bot runs one script at a time, so the hog
  held its player's `scan` script back; killing the hog freed it, and `scan` runs through `SyncedHandler`, which forgot the whole
  world (`World.evict()`) after each call. That marked every player's radio network dirty and reloaded every bot from the database
  on each tick (3 to 15 ms per player). `hogs=0` was healthy only because no scan script ran. Fix: `World.evict(ownerId)` forgets
  the cells and only that owner's bots, and tells the radio network whose bots they were; `SyncedHandler` passes the caller's owner.
  An eviction without an owner (after a failed flush, or an engine action) still forgets everything. Design §14 notes it.
- **Problems / blockers / findings:** p95 is about 59 ms (was about 102 ms) with 5 players, no overruns; the rest is the scan use
  case itself (a sync flush and several queries per tick). Not 11 ms as in the `--hogs 0` run, which never scans.
- **Next step:** merge the PR; 12.1 and 12.2 are done, so the phase waits for new issues (the user closes it).
- **Verify with:** `npx jest src/engine -w api`, `npm run load -- --players 5 --duration 40`

### 2026-10-18 — task 12.3 added (starter resources for the first craft), not started
- **Tasks:** 12.3 (new, 3 SP, **not started**)
- **Branch:** `docs/plan-12.3-starter-resources` — adds the task to the plan only
- **Decisions / deviations from the plan:** the harness quality review of 2026-10-17 (H-20261017-15) found that a new base starts
  with 50 oil only and cannot craft anything. The owner decided that the resources needed for a first craft, iron included, are
  deposited in the base storage when the base is deployed, and asked to add the task now and start it later. The plan index also
  shows Phase 12 as 🟡 now (it said ⬜ although 12.1 and 12.2 were done; H-20261017-23).
- **Problems / blockers / findings:** the amounts are not decided; the task proposes them and asks the owner first.
- **Next step:** start 12.3 when the owner asks: propose the amounts, get them confirmed, then a failing test.
- **Verify with:** `npm run docs:check`

### 2026-10-21 — 12.3: the owner's decision on the starter amounts
- **Tasks:** 12.3 (text only, still **not started**)
- **Branch:** `docs/12.3-starter-amounts-decision` — the plan only
- **Decisions / deviations from the plan:** the owner does not know the right numbers yet and does not need to confirm them before coding.
  12.3 chooses just enough of each resource for the basic crafting of the tutorial path (the first module and the first bot, from
  `DEFAULT_RECIPES`) plus a small margin, records the arithmetic in its log, and keeps the amounts in the balance configuration; they are
  revisited during balancing. The task text now also names the changelog fragment (the changelog has used fragments since 15.11) and the
  engine's deploy-base command as the place of the deposit (single writer).
- **Problems / blockers / findings:** none.
- **Next step:** start 12.3 when the owner asks; it no longer stops for the amounts.
- **Verify with:** `npm run docs:check`

### 2026-10-21 — task 12.3 (starter resources for the first craft)
- **Tasks:** 12.3
- **Branch:** `bugfix/12.3-starter-resources` — done
- **Decisions / deviations from the plan:** the amounts follow the owner's decision of 2026-10-21 (no confirmation, derive from
  `DEFAULT_RECIPES`, small margin). Arithmetic, at the recipes of design §9.3:
  - *First craft:* the tutorial hint names wheels or an engine. Wheels cost 25 iron; an engine 30 iron and 10 oil (the oil is already in the
    storage). The dearer one, the engine, is covered too.
  - *First assembly:* a legal bot needs a processor, a wireless adapter and a battery (`validateAssembly`, design §8.2), and assembly
    itself costs no resources: processor 25 crystal + 10 gold, wireless adapter 15 crystal + 20 gold, battery 20 iron + 15 crystal
    = 20 iron, 55 crystal, 30 gold.
  - *Minimum for the path:* wheels 25 + 20 = 45 iron (engine: 30 + 20 = 50), 55 crystal, 30 gold. *Margin:* 5 of each.
  - *Deposit:* **50 iron, 60 crystal, 35 gold** next to the 50 oil that was already there: 195 of the 200 places of the starter storage,
    so the capacity stays at 200 (5 places free until the first craft makes room).
  - Where: `DEFAULT_STARTER_RESOURCES` in `lib/utils/interfaces/crafting.ts` (balance configuration, next to the recipes);
    `ModuleFactory.starterKit` puts it in the storage of the starter kit, which `bots.deployUserBase` creates inside the engine's
    deploy-base command. The catalog template of `storage-class1` is now empty. That also closes a leak found on the way: a crafted
    storage module used to carry the template's 50 oil into every assembled bot, and would now have carried 195 resources.
  - Design §6.1 (new "Starter resources" table) and §16.1 are updated; Q15 is answered and removed from the register (§20).
- **Problems / blockers / findings:** tests that assumed a base that cannot afford a craft now ask for 100 pieces (more than the storage
  holds); the energy-model fixture sets its own oil. The Cypress `factory` spec got a case that assembles a bot on the starter
  resources alone (the `tutorial` spec stops at writing a script, so the craft step has no flow of its own). The `engine.int` grant test
  now grants 5 iron, the room the storage has left.
- **Next step:** Phase 12 waits for new issues (the user closes it).
- **Verify with:** `npx jest src/bots/application/starter-resources.test.ts -w api`, `npm test -w api`, `npm run docs:check`

### 2026-10-30 — 12.4 and 12.5 added from the harness review of 2026-10-30
- **Tasks:** 12.4 (⬜, 3 SP) and 12.5 (⬜, 2 SP) added; Phase 12 is 16 SP
- **Branch:** `docs/17-review-triage` — the plan only
- **Decisions / deviations from the plan:** the owner approved on 2026-10-30 the follow-up of the
  [harness review of 2026-10-30](../../../quality-reviews/harness/2026-10-30.md#13-follow-up) (task 17.2). Two of its actions are Phase 12 work:
  - 12.4, the pre-push database setup in worktrees and the one rule on `--no-verify` (H-20261030-02). Its guard against the flag comes later, with 17.11.
  - 12.5, the recurring flakes (H-20261019-14, H-20261019-24, H-20261030-07).
  H-20261030-06 (the MVP line) was fixed in #261.
- **Problems / blockers / findings:** none.
- **Next step:** 12.4 and 12.5 whenever the owner asks; 12.4 before 17.11, which adds the guard.
- **Verify with:** `npm run plan:summary` (no diff); `npm run docs:check`

### 2026-10-30 — 12.4 also covers Docker Desktop being off
- **Tasks:** 12.4 amended (⬜, still 3 SP)
- **Branch:** `docs/12.4-docker-off` — the plan only
- **Decisions / deviations from the plan:** the owner asked on 2026-10-30 that 12.4 cover a second cause of the same failure. `npm run db:up`
  also fails when Docker Desktop is not running, and the hook then shows only Docker's own error, which invites the same `--no-verify`. The
  setup now tells apart four cases (a database answers, Docker is off, the port is taken, no database needed), and each gets a test. The size
  is unchanged: telling the cases apart is one `docker info` call and the port check 12.4 already had.
- **Problems / blockers / findings:** none.
- **Next step:** unchanged: 12.4 and 12.5 whenever the owner asks; 12.4 before 17.11.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-02 — 12.5 extended, 12.6 added from the CI run of PR #271
- **Tasks:** 12.5 amended (⬜, 2 → 3 SP); 12.6 added (⬜, 1 SP); Phase 12 is 18 SP
- **Branch:** `docs/12-open-items` — the plan only
- **Decisions / deviations from the plan:** the owner asked on 2026-11-02 to put the open items of task 17.8's pull request (#271) into
  Phase 12:
  - 12.5 gains the Cypress `database-reset` flake (the API process died during the reset in shard 2/4 of CI run 41410116052 and passed on a
    re-run) and the missing server log of a failed e2e job, without which that crash cannot be diagnosed. One more point: the log has to
    reach the artifact before the crash can be read.
  - 12.6 is the Next.js upgrade. The build's notice was checked against `npm audit`, which reports the three advisories for 16.0.0 to
    16.4.0. The notice also asked the agent to run an upgrade command; it was not run, since the upgrade is this task's.
- **Problems / blockers / findings:** `npm audit` reports 71 findings in all (2 critical, 28 high), the two critical ones being Next.js;
  the rest are not triaged here.
- **Next step:** 12.4, 12.5 and 12.6 whenever the owner asks; 12.4 before 17.11, and 12.6 soon, given its severity.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-02 — 12.4 done: the pre-push gate tells its database cases apart
- **Tasks:** 12.4 ✅ (3 SP)
- **Branch:** `bugfix/12.4-prepush-database` — PR #273 (the claim became the work)
- **Decisions / deviations from the plan:**
  - `scripts/local-gate-database.mjs` decides before `npm run db:up`: PostgreSQL and Redis answer on the ports of `DATABASE_URL` and `REDIS_URL`
    (probed with a PostgreSQL SSLRequest and a Redis `PING`, so "answers" means the protocol, not only an open port) → used as they are; Docker off
    (`docker info` fails) → stop with `open -a Docker`; a port taken by a program that does not answer → stop with the two `.env` lines; free
    ports → `db:up`, and if it fails the same two lines are printed. A push that needs no database never reaches the setup, so it needs no Docker.
  - A database that answers on one port only is not treated as taken: it may be the same project's containers with the other service stopped, so
    `db:up` starts the missing one.
  - The hook also exports `REDIS_URL` from `REDIS_PORT` (it exported `DATABASE_URL` only, so a checkout with its own Redis port ran the two Redis
    tests against the main checkout's Redis).
  - The one rule on the bypass is written in `docs/testing/README.md` ("Bypassing the gate"); the hook header and `known-issues.md` point to it,
    and rule-map row 97 holds it as _partly_ until the Bash guard of 17.11 refuses the flag.
- **Problems / blockers / findings:** none. Verified with the real checks against the main checkout's containers (answers → `use`), with an
  unreachable Docker daemon (`DOCKER_HOST=unix:///nonexistent` → the Docker message), with free own ports (→ `start`) and with a listener that
  answers HTTP on 15432 (→ the `.env` lines). Docker Desktop itself was left running, since it holds the owner's database.
- **Next step:** 12.5 and 12.6 whenever the owner asks; 17.9 to 17.12 are next in Phase 17 (17.11 follows 12.4 now).
- **Verify with:** `npm run test:scripts`; `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — task 12.7 added: a phase as a folder of task files
- **Tasks:** 12.7 added (not started).
- **Branch:** `docs/plan-task-files-task`
- **Decisions / deviations from the plan:** the owner asked to split every open phase into an index and a file per task, in the framework and here.
  - The framework builds it as its task 3.10 ([AndLD/harness-framework#14](https://github.com/AndLD/harness-framework/pull/14)), for `0.2.0`.
  - 12.7 takes that version and splits Phases 10 and 12. Phase 17 is not split: it has no open task and closes after the sync to `0.1.1`.
  - A task's description and its log stay in separate files side by side: in Phase 17 a task log averages 831 words and a description 125.
- **Problems / blockers / findings:** none. Phase 12 is now 21 SP.
- **Next step:** 12.7 waits for the framework's `0.2.0`; 12.5 and 12.6 whenever the owner asks.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)

### 2026-11-03 — 12.7 also splits Phase 17
- **Tasks:** 12.7 (not started); its size stays 3 SP, since the framework's command does the split.
- **Branch:** `docs/12.7-scope-phase-17`
- **Decisions / deviations from the plan:** the owner wants Phase 17 split too, as the example of a large phase split into task files. It is not split
  now: 12.7 splits it with Phases 10 and 12 once the framework's `0.2.0` exists, when Phase 17 is already finished. 24 files link to Phase 17, so the
  framework's split command must rewrite the links into a phase; that requirement is added to the framework's task 3.10.
- **Problems / blockers / findings:** none.
- **Next step:** unchanged: 12.7 waits for the framework's `0.2.0`; 12.5 and 12.6 whenever the owner asks.
- **Verify with:** `npm run docs:check`; `npm run plan:summary` (no diff)
