[← Development plan index](../DEVELOPMENT-PLAN.md)

# Phase 6 — Core game GUI & map animations (72 SP)

Surface the game state in the browser.

| # | Task                                                                                                       | SP |
| --- | --------------------------------------------------------------------------------------------------------- | -- |
| 6.1 | Canvas 2D map renderer with sprites per design §4.3: sprite atlas + JSON index loader, chassis-based bot sprites with module overlays and ownership tint, variants (corpse, stale, damaged), dimming, level of detail and colour fallback, fog of war, pan/zoom; framework-free so the ambient scene can reuse it; free tileset with its licence recorded | 13 |
| 6.2 | Map state streaming over sockets (incremental updates, fog-of-war per user) | 5 |
| 6.3 | Physical storage GUI (items list, take/drop) | 5 |
| 6.4 | Factory GUI → craft table → assemble (blueprint picker, resource cost, assemble button) | 8 |
| 6.5 | Terminal `connect <botId>` + draggable bot terminal with wirelessAdapter gating, range check with relay-chain pathfinding through own bots, and "Connection interrupted" handling | 5 |
| 6.6 | E2E tests for all new GUIs | 5 |
| 6.7 | Bot control panel per design §15.1: manual control of every script-API action in seven switchable categories, sent as engine commands that obey the same rules as scripts | 8 |
| 6.8 | Settings: global game settings and per-user profile settings for micromanagement category switches (effective availability = global AND personal, enforced by the engine); settings storage and API | 5 |
| 6.9 | Skippable tutorial per design §16.1: overlay checklist with steps completed by real game events, progress in the user profile; Cypress spec | 5 |
| 6.10 | Window manager: layered, draggable, focus-managed windows for terminals, editor and panels (multiple bot terminals at once), position persistence; used by 6.5 and 6.7 | 5 |
| 6.11 | Map animation system per design §15.2, driven by the game event bus, with effect cap, level of detail and reduced-motion setting | 8 |

**Exit criteria:** the notes' "Monitor / map GUI + physical storage GUI + factory GUI" are functional, the control panel
and tutorial work, and map actions are animated from game events — all tested.
