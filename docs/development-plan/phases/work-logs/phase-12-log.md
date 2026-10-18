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
