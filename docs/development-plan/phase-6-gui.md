[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 6 — Core game GUI & map animations (96 SP)

**Status:** 🟡 In progress · **Branches:** see (see the [implementation log](#implementation-log)) · **Work log:** [phase-6-log](./work-logs/phase-6-log.md)

Surface the game state in the browser.

**Execution order:** 6.1 → 6.2 → 6.10 (window manager) → 6.3, 6.4, 6.5, 6.7, 6.8 → 6.9 → 6.11 → 6.6 → 6.12.

| # | Task                                                                                                       | SP | Status |
| --- | --------------------------------------------------------------------------------------------------------- | -- | --- |
| 6.1 | Canvas 2D map renderer with sprites per design §4.3: sprite atlas + JSON index loader, chassis-based bot sprites with module overlays and ownership tint, variants (corpse, stale, damaged), dimming, level of detail and colour fallback, fog of war, pan/zoom; framework-free so the ambient scene can reuse it; free tileset with its licence recorded; known cells fade with age since `seenAt` with a "seen N s ago" tooltip and last-seen ghosts for bots and items; cells in the live area are drawn at full strength with a live outline; hatched grey bots without a radio link and an optional link overlay (design §11.2.1); live signal-strength bars on connected bots | 16 | ✅ |
| 6.2 | Map state streaming over sockets (incremental updates, fog-of-war per user) | 5 | ✅ |
| 6.3 | Physical storage GUI (items list, take/drop) | 5 | ✅ |
| 6.4 | Factory GUI → craft table → assemble (blueprint picker, resource cost, assemble button) | 8 | ⬜ |
| 6.5 | Terminal `connect <botId>` + draggable bot terminal with wirelessAdapter gating, range check with relay-chain pathfinding through own bots, and "Connection interrupted" handling; the connected / disconnected state, automatic terminal resume and the reconnection summary | 5 | ⬜ |
| 6.6 | E2E (Cypress) for every Phase 6 screen: map (fog of war, pan/zoom, cell inspection, opening a bot), storage take/drop, factory craft and assemble, windows, `connect` with range / relay / password / lockout, `adopt` of a stale bot, control panel and the global/personal category switches, animation smoke test; also relay chains, `sendMessage` / `ping`, world consistency across players and negative coordinates, page reload / socket reconnect / token expiry mid-session, two tabs on one account, the ops budget on manual actions, and an admin changing the global category switches; also link loss and recovery: a bot leaving range, a relay destroyed and repaired, a tower out of oil, the terminal resuming, buffered scans appearing with their real times; also the signal bars changing as a bot walks away from its base | 13 | ⬜ |
| 6.7 | Bot control panel per design §15.1: manual control of every script-API action in eight switchable categories, sent as engine commands that obey the same rules as scripts | 8 | ⬜ |
| 6.8 | Settings: global game settings and per-user profile settings for micromanagement category switches (effective availability = global AND personal, enforced by the engine); settings storage and API | 5 | ⬜ |
| 6.9 | Skippable tutorial per design §16.1: overlay checklist with steps completed by real game events, progress in the user profile; Cypress spec | 5 | ⬜ |
| 6.10 | Window manager: layered, draggable, focus-managed windows for terminals, editor and panels (multiple bot terminals at once), position persistence; used by 6.5 and 6.7 | 5 | ✅ |
| 6.11 | Map animation system per design §15.2, driven by the game event bus, with effect cap, level of detail and reduced-motion setting | 8 | ⬜ |
| 6.12 | E2E (Cypress) for the core gameplay journeys: assemble a miner, script a mining loop, resources arrive in storage; two bots fight until a module breaks; a bot runs out of energy and stops; a corpse base is restored by a repair bot; also deposit depletion and contest (`EMPTY`), combat details (ammo, armor, cooldown, artillery splash, friendly fire), items and blueprint items; also a script acting on a stale scan (the target moved or the deposit is gone) and handling `BLOCKED` / `EMPTY` / `GONE` by re-scanning; also scanning: `scan()` is refused with `BUSY` while the scanner is live; a scanner in live mode reveals an approaching bot, its movement animates, and switching the scanner off turns the area into ageing snapshots | 13 | ⬜ |

Task status: ⬜ not started · 🟡 in progress (branch noted in the work log) · ✅ done.

**Exit criteria:** the notes' "Monitor / map GUI + physical storage GUI + factory GUI" are functional, the control panel
and tutorial work, and map actions are animated from game events — all tested.

## Implementation log

Branches and pull requests that implemented this phase's tasks, added when each one is merged (branch names follow
AGENTS.md §7.1).

| Branch | Tasks | PR | Status |
| --- | --- | --- | --- |
| `feature/6.1-map-renderer` | 6.1 | [#88](https://github.com/AndLD/bot-rts/pull/88) | merged |
| `feature/6.2-map-streaming` | 6.2 | [#89](https://github.com/AndLD/bot-rts/pull/89) | merged |
| `feature/6.10-window-manager` | 6.10 | [#90](https://github.com/AndLD/bot-rts/pull/90) | merged |
