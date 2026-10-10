[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 6 — Core game GUI & map animations (72 SP)

Surface the game state in the browser.

| # | Task                                                                                                       | SP |
| --- | --------------------------------------------------------------------------------------------------------- | -- |
| 6.1 | Canvas 2D map renderer, kept framework-free and reusable (also used by the ambient scene), with sprites (32 px tiles): sprite atlas + JSON index loader, chassis-based bot sprites with module overlays and ownership tint, resource/item/base/corpse/stale variants, damaged-module overlays, dimming for remembered cells, level-of-detail colours at low zoom, solid-colour fallback; fog of war; viewport pan/zoom; free tileset with its licence recorded | 13 |
| 6.2 | Map state streaming over sockets (incremental updates, fog-of-war per user) | 5 |
| 6.3 | Physical storage GUI (items list, take/drop) | 5 |
| 6.4 | Factory GUI → craft table → assemble (blueprint picker, resource cost, assemble button) | 8 |
| 6.5 | Terminal `connect <botId>` + draggable bot terminal with wirelessAdapter gating, range check with relay-chain pathfinding through own bots, and "Connection interrupted" handling | 5 |
| 6.6 | E2E tests for all new GUIs | 5 |
| 6.7 | Bot control panel: manual micromanagement of every script-API action from the GUI, grouped into seven switchable categories (movement, combat, extraction, logistics, fabrication, maintenance, communication; observation always on); actions sent as engine commands that consume the bot's `opsPerTick` budget and obey the same rules as scripts | 8 |
| 6.8 | Settings: global game settings and per-user profile settings for micromanagement category switches (effective availability = global AND personal, enforced by the engine); settings storage and API | 5 |
| 6.9 | Skippable tutorial: overlay checklist (deploy → terminal → `modules` → scan → first script → craft → assemble), step completion detected from real game events, skip/reopen from profile settings, progress in the user profile; Cypress spec | 5 |
| 6.10 | Window manager: layered, draggable, focus-managed windows for terminals, editor and panels (multiple bot terminals at once), position persistence; used by 6.5 and 6.7 | 5 |
| 6.11 | Map animation system (GD §15.2): tweened movement, shot/hit, dig, repair, disassemble, scan pulse, craft/assemble, module-broken smoke, link and energy effects, driven by the game event bus; effect cap, level of detail, reduced-motion setting | 8 |

**Exit criteria:** the notes' "Monitor / map GUI + physical storage GUI + factory GUI" are functional, the control panel
and tutorial work, and map actions are animated from game events — all tested.
