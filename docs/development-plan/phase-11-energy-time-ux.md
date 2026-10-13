[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 11 — Energy balance, day/night, connection resilience & play-feel polish (47 SP)

**Status:** 🟡 In progress · **Branches:** see the [implementation log](#implementation-log) · **Work log:** [phase-11-log](./work-logs/phase-11-log.md)

**Development order:** this phase is numbered after Phase 10 so that the task numbers of Phases 8–10 stay unchanged, but it
is **developed right after Phase 7**, before Phases 8–10 (see "Order of development" in the [plan index](../DEVELOPMENT-PLAN.md)).
It needs nothing from Phases 8–10.

The first hands-on session with the finished Phases 0–7 showed that a default base cannot live on its own: it idles
away its battery, burns its 50 oil within minutes and then goes dark (no radio link, no operations), and the game kept
telling the player so on every tick. This phase makes the starting economy of energy sustainable and strategic, adds the
day/night cycle that drives it, removes the notification spam of per-tick events, and fixes the rough edges found in the
GUI (connection loss, the control window, the terminal scroll).

Already fixed outside this plan (bugfix PR [#114](https://github.com/AndLD/bot-rts/pull/114), merged or merging before
this phase starts): coalescing and caps of notifications, `OutOfFuel` and `EnergyLow` told once (the state kept in the
generator and battery properties), one control window per bot, relative times in the notification center, the deploy-base
page layout. Task 11.1 builds on that and covers everything else.

| # | Task | SP | Status |
| --- | --- | --- | --- |
| 11.1 | **Event spam audit.** Inventory every game event type and notification kind (`lib` `GameEvent`, `candidatesOf`, the engine's publishers) and classify each as an action result, an edge (a state that begins) or a level (a state that lasts). Level-triggered ones must be told once per state with the state **persisted** (so a restart does not repeat it), the way `OutOfFuel` and `EnergyLow` are now: check `LiveScanStopped`, `LinkLost` / `LinkWeak` / `LinkRestored`, `ModuleBroken`, `ShotHit`, `PasswordAttemptFailed` and the execution events, and fix what repeats. A reusable contract test runs a bot through N ticks in an unchanged bad state and asserts that no event type fires more than once; the classification table goes into design §24 | 5 | ✅ |
| 11.2 | **Game clock and day/night model.** A pure module in `lib` (no runtime deps, no `Date.now()`): a world day length, the in-game hour of a timestamp, the day phase (night, morning, day, evening) and the **sunlight factor** of a timestamp, all from a typed config (balance in config, design §12.4). The server exposes the time config and the current instant through `/api/v1` (OpenAPI), so the client derives the same time from its server-synced clock (`useServerClock`); the engine uses the injected clock. Design §12 (time) and §4 (world) updated | 5 | ✅ |
| 11.3 | **Power sources split.** `PowerSourceModule` as the abstraction (cycle, enabled flag, last cycle, energy per cycle; `enable` / `disable`), with `GeneratorModule` (burns oil from storage; type `generator`) and the new `SolarPanelModule` (type `solarPanel`, no fuel, output scaled by the sunlight factor of 11.2). Module type, registry, catalogue entry `solar-panel-class1`, recipe, script API `enable` / `disable` for both, power handler, map look, module names (English and Russian), generated player documentation, energy model runs both kinds (open/closed: adding a source type does not touch the others) | 8 | ✅ |
| 11.4 | **Energy balance and starter kit.** The starter kit gets `solar-panel-class1` **instead of** `generator-class1` (new bases only; there is no migration of existing ones, see decision 5). Numbers (tunable, in the catalogue) satisfy the acceptance rules: the solar panel alone sustains the idle drain of the starter base plus a basic duty (scanning, a few crafts and assemblies) over a full game day; continuous heavy work (mining, moving, shooting, live scan) drains the battery faster than the panel renews it; the oil generator class 1 is **at least 5× more powerful** than the solar panel at its peak, but needs oil delivered by hand or by a bot (the strategic difference). A simulation test over a game day checks all three rules, so a later tweak that breaks the balance fails CI. Design §6 (starter kit), §7 (modules), §12.5 and the catalogue in the player docs updated | 5 | ✅ |
| 11.5 | **Power-on hysteresis for every bot.** A bot whose battery reaches 0 becomes *unpowered* and powers on again only when the stored energy has grown to a resume threshold (10, config), not at the first unit above 0, so a bot at the edge does not flap between working and out of energy. The state is persisted in the batteries (like `isLowReported`), and applies to the radio link (no `LinkLost` / `LinkRestored` flapping), operations (`spend` is refused while unpowered), suspended executions and factory / maintenance jobs, which continue by themselves after the resume. A bot with 20 energy works down to 0; unit tests for the edge, restart and flapping cases; design §12.5 updated | 5 | ⬜ |
| 11.6 | **Day/night UI.** An in-game clock in the HUD (time and the day phase), and a **dark-blue, high-opacity night filter** over the map canvas whose strength follows the phase (strong at night, light in the morning and evening, none by day, smooth transitions, honours reduced motion). The filter layer lets pointer events through, so map clicks, hover and the cell inspector work unchanged. i18n (English, Russian); component tests | 5 | ⬜ |
| 11.7 | **Automatic reconnection.** The client reconnects when the server goes down or the network drops, without a page refresh: Socket.IO reconnection with backoff, re-subscription of everything that was open (map stream, terminal sessions, notifications, live scan), the engine's view of the bot resumes, a connection banner (lost / reconnecting / restored) in both languages, RTK Query retries and refetch on reconnect, no duplicate toasts or windows after it. Cypress spec that stops and restarts the API | 5 | ⬜ |
| 11.8 | **Control window layout.** Wider default window and a wider inputs column (the inputs share the free width, with a sensible minimum), so placeholders and values are readable; the saved layout of an old narrow window is migrated | 2 | ⬜ |
| 11.9 | **Terminal auto-scroll.** New output scrolls the terminal down **only if it was already scrolled to the bottom** just before the lines arrived; a player who scrolled up to read is not pulled down, and scrolling to the bottom again resumes following. Component tests | 2 | ⬜ |
| 11.10 | **E2E and documentation.** Cypress specs for the day/night filter that does not block map clicks and the clock, solar panel versus oil generator behaviour in the base, no event repeated while the state lasts, the power-on hysteresis, the reconnection (11.7), the control window layout and the terminal scrolling; the end-to-end matrix in `testing-strategy.md`, design docs (§4, §6, §7, §12.5, §15, §24), the player documentation concepts page "Energy and time", and the Russian translation updated; the work log closed | 5 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Order inside the phase:** 11.1 → 11.2 → 11.3 → 11.4 → 11.5 → 11.6 → 11.7 → 11.8 → 11.9 → 11.10 (11.2 is needed by 11.3, 11.4
and 11.6; 11.5 uses the persisted-state pattern of 11.1; 11.7–11.9 are independent of the rest).

## Decisions proposed for approval

These defaults are used unless changed before the phase starts; each is a config value, not code.

1. **Time scale:** one in-game hour is one real minute, so a day is **24 real minutes**. The world clock starts from the Unix
   epoch, so every player sees the same time (no per-player offset).
2. **Day phases and sunlight factor:** night 21:00–05:00 → 0.1; morning 05:00–09:00 and evening 17:00–21:00 → 0.6;
   day 09:00–17:00 → 1.0 (a day averages about 0.57).
3. **Night filter:** opacity about 0.65 at night, about 0.25 in the morning and evening, 0 by day.
4. **Starting numbers (to be proven by the balance test of 11.4):** the starter base idles at about 2.6 energy per second
   (0.26 per 100 ms tick); `solar-panel-class1` peaks at about **8 energy per second**; the oil generator class 1 stays at
   its current 48 per second (6× the panel's peak) while burning 0.08 oil per second; the battery stays at 3000.
5. **Existing bases:** no migration. The game is not released, so the developer's local database is cleared of all game data
   (`npm run db:reset`, `npm run db:migrate -w api`, `npm run db:seed -w api`) and the next manual session starts with a fresh
   base that has the new starter kit. Decided by the owner on 2026-10-13; the reset of the local database was done that day.
6. **Starting oil:** the starter storage keeps its 50 oil, so crafting an oil generator is possible straight away.
7. **Resume threshold:** 10 energy for every bot, as a single config value.
8. **A bot out of reach of the base** keeps buffering events as today (design §24.1); this phase does not change that.

## Exit criteria

A fresh base runs indefinitely on its solar panel under a light duty, and runs out of energy under a continuous heavy
one; the oil generator is clearly the stronger but manual (or bot-fed) option; the day/night cycle visibly dims the map
at night without blocking any click and changes the solar output accordingly; a bot at the edge of its energy no longer
flaps between working and out of energy; no event or notification repeats while its state lasts, including after a
restart; the page recovers from a server restart on its own; the control window and the terminal behave as described —
all covered by unit, integration and Cypress tests, with the coverage gate (≥ 97 %) green.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/11.1-event-spam-audit` | 11.1 | [#118](https://github.com/AndLD/bot-rts/pull/118) | ✅ merged |
| `feature/11.2-game-clock` | 11.2 | [#119](https://github.com/AndLD/bot-rts/pull/119) | ✅ merged |
| `feature/11.3-power-sources` | 11.3 | [#120](https://github.com/AndLD/bot-rts/pull/120) | ✅ merged |
| `feature/11.4-energy-balance` | 11.4 | _this PR_ | 🟡 |
