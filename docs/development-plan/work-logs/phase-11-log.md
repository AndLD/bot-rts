[← Phase 11 — Energy balance, day/night, connection resilience & play-feel polish](../phases/phase-11-energy-time-ux.md)

# Phase 11 — Energy balance, day/night, connection resilience & play-feel polish — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-13 — phase planned and approved
- **Tasks:** none started
- **Branch:** `docs/plan-phase-11-energy-time-ux` — the plan only
- **Decisions / deviations from the plan:** the phase is numbered 11 to keep the task numbers of Phases 8–10 stable, and is
  developed after Phase 7 (see the plan index). The proposed defaults are listed under "Decisions proposed for approval".
- **Problems / blockers / findings:** the first hands-on run of the finished Phases 0–7 found the energy starvation of the
  default base, per-tick event spam, a missing automatic reconnection and layout problems; the notification fixes already
  delivered are in PR #114.
- **Next step:** the plan and its decisions are approved (existing bases: no migration, the local database is reset instead, see decision 5); start with 11.1.
- **Verify with:** `git status`, `git branch -a`, the open pull requests.

### 2026-10-13 — task 11.1 event spam audit
- **Tasks:** 11.1
- **Branch:** `feature/11.1-event-spam-audit` — done
- **Decisions / deviations from the plan:** the audit found nothing besides `OutOfFuel` / `EnergyLow` (fixed in #114) that repeats while a state lasts: link events compare with the previous refresh, `ModuleBroken` is guarded by the condition edge, `LiveScanStopped` disables the scanner, executions end once. The only flapping source is the energy edge of the radio link, which task 11.5 removes.
- **Problems / blockers / findings:** none.
- **Next step:** 11.2, the game clock and day/night model in `lib`.
- **Verify with:** `npm test -w api -- energy-events radio-network`

### 2026-10-14 — task 11.2 game clock and day/night model
- **Tasks:** 11.2
- **Branch:** `feature/11.2-game-clock` — done
- **Decisions / deviations from the plan:** the clock is `lib/utils/game-time.ts` (pure; defaults from the plan's decisions 1-2, stepwise sunlight per day part). `GET /api/v1/time` (authenticated, new `time` Nest module) returns `{ now, config }`; the config is the `DEFAULT_GAME_TIME` constant (the balance lives in `lib`, like the other typed defaults), not an env variable. The client derives the time from `now` with `useServerClock` in 11.6.
- **Problems / blockers / findings:** none.
- **Next step:** 11.3, split the power sources (`PowerSourceModule`, `GeneratorModule`, `SolarPanelModule`).
- **Verify with:** `npm test -w api -- game-time`; `npx jest src/api.int.test.ts -t "game time"` in `api`

### 2026-10-14 — task 11.3 power sources split
- **Tasks:** 11.3 (also removes the duplicate §12.5.1 that the 11.2 PR added to the design: the section already existed from the plan)
- **Branch:** `feature/11.3-power-sources` — done
- **Decisions / deviations from the plan:** `PowerSourceModule` carries `isOutOfFuel` and a zero `fuelPerCycle`, so the energy model has one loop for every kind and the solar panel never raises `OutOfFuel`. `outputAt(now, time)` is the polymorphic part (generator 1, solar panel the sunlight). `EnergyModel` takes the `GameTimeConfig` as its third constructor argument. The panel has a map icon (`solar`, new atlas sprite). The recipe is 15 iron + 20 crystal, 20 s. The starter kit is untouched (11.4).
- **Problems / blockers / findings:** the client test `GamePage › shows the terminal to a player with a base` is flaky in the parallel run and passes alone.
- **Next step:** 11.4, swap the starter kit and prove the balance with a simulation test over a game day.
- **Verify with:** `npm test -w api -- energy-model game-module map-look`

### 2026-10-14 — task 11.4 energy balance and starter kit
- **Tasks:** 11.4
- **Branch:** `feature/11.4-energy-balance` — done
- **Decisions / deviations from the plan:** the numbers of decision 4 were kept (panel 2 energy per 250 ms = 8/s peak, generator 48/s = 6×). `energy-balance.test.ts` simulates three game days with the starter kit and duties priced from the catalogue's operation costs: light duty (a look every 20 s, a craft every 4 minutes) never empties the battery, a continuous heavy duty (mining, driving, shooting) empties it within five minutes. The energy-service tests that exercise the oil generator now swap the starter panel for a generator.
- **Problems / blockers / findings:** none. Existing bases are not migrated (decision 5).
- **Next step:** 11.5, power-on hysteresis for every bot.
- **Verify with:** `npm test -w api -- energy-balance energy.service`

### 2026-10-14 — task 11.5 power-on hysteresis
- **Tasks:** 11.5
- **Branch:** `feature/11.5-power-on-hysteresis` — done
- **Decisions / deviations from the plan:** the rule lives in `EnergyModel` (one place for the API's factory / maintenance services and the engine): `isUnpowered` on the battery, `isDepleted` / `available`, `resumeThreshold` 10. A dark bot drains no idle cost (otherwise it could not recover at night). Executions are not suspended by a separate mechanism: they get `NO_ENERGY` from `spend` as before.
- **Problems / blockers / findings:** none.
- **Next step:** 11.6, day/night UI (HUD clock and night filter).
- **Verify with:** `npm test -w api -- energy-model radio-network`

### 2026-10-14 — task 11.6 day/night UI
- **Tasks:** 11.6
- **Branch:** `feature/11.6-day-night-ui` — done
- **Decisions / deviations from the plan:** the night filter is a child layer of `MapCanvas` (a new `children` prop, drawn under the cell inspector), not a canvas effect, so it is plain CSS with `pointer-events: none` (also set inline so a stylesheet change cannot make it swallow clicks). The smooth transition is a 20 s linear CSS opacity fade (a third of the in-game hour is a real minute), off under reduced motion. Strengths are in `nightFilterStyle.ts` (client presentation constants).
- **Problems / blockers / findings:** none.
- **Next step:** 11.7, automatic reconnection.
- **Verify with:** `npm test -w client -- daynight GameMap MapCanvas`

### 2026-10-14 — task 11.7 automatic reconnection
- **Tasks:** 11.7
- **Branch:** `feature/11.7-auto-reconnection` — done
- **Decisions / deviations from the plan:** Socket.IO already reconnects by itself; what was missing is handled in the client: the status and banner, an RTK Query tag invalidation once the connection is back (plus `refetchOnReconnect` with `setupListeners` for the browser's online event), a retry of reads that never reached the server (`retryCondition`: `FETCH_ERROR` and GET, three retries), a new terminal session after a reconnection, and a guard so that a failed re-read of the bases does not unmount the game. The Cypress spec stops and starts the API through two tasks (`stopApi` / `startApi`, which use the launch description that `scripts/e2e.mjs` passes in `E2E_API_LAUNCH`; `lsof` finds the process). Live areas are not re-sent by the server after a reconnection; the client keeps what it had and the map reloads.
- **Problems / blockers / findings:** the reconnection Cypress spec could not be run locally because the developer's servers hold ports 8080 and 5173; it runs in CI. The e2e `map.cy.ts` was made to wait until the base is drawn before it clicks (a flake seen in PR 123).
- **Next step:** 11.8, control window layout.
- **Verify with:** `npm test -w client -- SocketProvider ConnectionBanner useTerminal empty-api GamePage`; `npm run e2e -- --skip-build -- --spec cypress/e2e/reconnection.cy.ts`
### 2026-10-14 — tasks 11.8 control window layout and 11.9 terminal auto-scroll
- **Tasks:** 11.8, 11.9 (one branch: both are small and independent of the rest)
- **Branch:** `feature/11.8-control-window-layout` — done
- **Decisions / deviations from the plan:** the old narrow windows are migrated once, by a version key next to the saved layouts, so a width the player sets afterwards is kept. The terminal now scrolls inside itself (it was the window body that scrolled, with nothing following new lines); `useStickyScroll` decides from the last scroll event, so the position "just before the lines arrived" is what counts.
- **Problems / blockers / findings:** the CSS of the control window was not looked at in a browser (the developer's database has no base); the layout rules are plain grid rules.
- **Next step:** 11.10, the Cypress specs of the phase, the end-to-end matrix, the docs and the Russian translation; then the end-of-phase database step of AGENTS.md §7.6.
- **Verify with:** `npm test -w client -- windows.slice useStickyScroll Terminal`

### 2026-10-14 — task 11.10 end-to-end specs and documentation; phase 11 closed
- **Tasks:** 11.10
- **Branch:** `feature/11.10-e2e-and-docs` — done
- **Decisions / deviations from the plan:** new specs `daynight.cy.ts` (clock, filter that lets clicks through), `energy.cy.ts` (solar start without a generator and with the oil untouched, energy low told once, a bot out of energy off the radio until 12 energy: the engine's in-memory radio state only changes inside a tick, so the spec drains a bot of 1 unit instead of loading it at 0), `interface.cy.ts` (control window width, a layout saved narrow, terminal following) next to `reconnection.cy.ts` (11.7). The player documentation page "Energy" is now "Energy and time". `scripts/e2e.mjs` can use other ports (`E2E_API_PORT`, `E2E_CLIENT_PORT`), builds into `.next-e2e` with `tsconfig.typecheck.json`, so a run no longer collides with a development server.
- **Problems / blockers / findings:** a local run of the new specs next to the developer's servers built and rendered (the screenshot showed the clock and the banner), but the socket handshake did not complete there, so the specs are verified by CI. No Prisma migration came with this phase; the local database needs only the reset of decision 5 (`npm run db:up`, `npm run db:migrate -w api` run after the merge, see the final summary).
- **Next step:** none in this phase. Phases 8-10 are next in the plan.
- **Verify with:** `npm run e2e -- -- --spec 'cypress/e2e/{daynight,energy,interface,reconnection}.cy.ts'`; `npm run lint && npm run docs:check`
