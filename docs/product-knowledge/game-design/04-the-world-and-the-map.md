[← Game design index](./GAME-DESIGN.md)

# 4. The world and the map

## 4.1 Grid

- The world is a 2D grid of **cells**, addressed by integer `Location { x, y }` (an optional `z` exists in the data
  model for future layering). The world is **2D**: `z` is **reserved** in the type but has no gameplay meaning, is
  never set by the game, and is ignored by movement, scanning and the map.
- **The world is unbounded.** There is no border: coordinates may be negative and cells are generated lazily on
  first scan. Storage must therefore be sparse (only materialized cells are stored) and indexed by location. The map is addressed in **chunks** (square blocks of `chunkSize` cells, default 16, `WORLD_CHUNK_SIZE`) in the domain model, so generation and later sharding work chunk by chunk; negative cells belong to negative chunks.
- Each cell has a **type** and an optional content reference. Implemented point types (`MapPointType`):

  | Type | Meaning |
  | --- | --- |
  | `resource` | A natural deposit (e.g. gold, iron) that can be mined |
  | `item` | A loose item lying on the ground |
  | `bot` | A bot occupies the cell |
  | `base` | A player base occupies the cell |
  | `null` | Empty passable cell |
  | *unknown* | Never scanned by this player → rendered black |

- **One solid entity per cell.** Bots, bases (including corpse bases) and resource deposits are solid and block
  movement; ground **items** do not block. `move()` into an occupied cell fails with `BLOCKED` — there is no pushing
  or ramming. Resource cells are worked from an adjacent cell. Blockers can only be removed by destroying them
  (combat) or, for deposits, by depleting them.
- **Base spawn:** a new base is placed on a **free cell** (not occupied, not a deposit) that is at least
  `minBaseDistance` cells (default 30, tunable) from every living base and every corpse base. Candidates are drawn at
  random inside a ring around the world origin whose radius grows with the number of bases; on conflict the search
  retries; what a deploy answers when the attempts run out is open (Q11). The numbers are configuration (`WORLD_MIN_BASE_DISTANCE`, `WORLD_SPAWN_RADIUS`, `WORLD_SPAWN_RADIUS_PER_BASE`, `WORLD_SPAWN_ATTEMPTS`); the ring is a square of half-width `radius + radiusPerBase × bases` around the origin. A redeploy after base
  destruction (§6.3) uses the same rule. Players may also deploy with a [spawn seed](./22-public-api-integrations.md#223-spawn-seeds) to start near
  friends.

## 4.2 Two layers: real points and user points

The map is stored in two logical layers:

| Layer | Stored with | Who sees it | Purpose |
| --- | --- | --- | --- |
| **Real map points** | no `userId` | everyone | authoritative shared world |
| **User map points** | with `userId` | only that player | that player's fog of war / knowledge snapshot |

Rules:

- When a player scans, cells they have never seen are **generated** by the server. Generation is probabilistic and
  deterministic for a world seed: it draws from the world's **seeded RNG** (§12.4), never from `Math.random()`. Each new cell
  is a `resource` with the chance `WORLD_RESOURCE_CHANCE` (default 20 %); which resource it holds follows the spawn weights of
  §9.1, and a new empty cell may hold a blueprint item with the chance `worldBlueprintChance` (§9.3).
- If the cell already exists as a real point, its **current contents are read from the game database** — not re-rolled.
  This keeps the world consistent for every player.
- The player's user-point layer is synced from the real layer: when the real cell's `contentId` or `type` differs from
  the player's cached copy, the cache is updated.
- Map knowledge is **private per player**. There are no teams or alliances in the initial release; players may only
  cooperate by exchanging messages (`sendMessage`). Alliances / shared fog are a possible future extension.
- **Knowledge is a snapshot, except inside a live area.** Every known cell stores the contents it had when it was last
  seen and a **`seenAt` timestamp** (the game tick). A cell's **age** is the current tick minus `seenAt` (shown in seconds
  through `tickIntervalMs`).
- **What refreshes a cell:** a `scan()` that covers it; the direct result of an action of the player's own bot on it (the
  cell it moved into, dug, shot at or dropped an item on); and **continuous scanning** (§4.4), which keeps the cells inside a
  scanner's radius live. There is **no passive sight**: a bot without a running scanner sees nothing of its surroundings.
- **A disconnected bot does not feed the player's map** (§11.2.1): its scans are buffered and applied with their original
  `seenAt` when the link returns.
- **Stale data is expected, not an error.** Other bots, dropped items and deposits can change after `seenAt`. Actions are
  always checked against the **real** world, so acting on a stale cell returns an ordinary error value (`BLOCKED`,
  `EMPTY`, `GONE`); a script that cares about freshness re-scans and compares `seenAt`. A one-shot `scan()` is not
  meant to be repeated every tick: it costs ops and energy and waits for the scanner's cooldown (§7.2). To keep an area
  fresh, switch the scanner to continuous mode (§4.4).
- Rendering a map view is therefore a *merge* of: real points in the viewport + the player's knowledge + black unknown
  cells (fog of war).

## 4.4 Live vision: continuous scanning

- **A scanner works in one of two modes, and both stay in the game.** In **one-time mode** (the default) it does a
  snapshot `scan()` (§7.2). In **live mode** it keeps an area live. A scanner is in exactly one mode at a time: **while it is
  live, `scan()` fails with `BUSY`**; switch it back with `disable()` to scan again, and `view()` fails with `NOT_LIVE`
  while it is in one-time mode. A bot with several scanner modules can run each in a different mode (for example one
  live and one for occasional scans).
- `enable()` switches a scanner to live mode (and `disable()` back to one-time mode). While **enabled** it keeps every cell inside its
  radius **live**: the player's knowledge of those cells follows the real world, refreshed in batches every scanner `delay`.
  The union of a player's enabled scanners is their **live area**.
- Continuous scanning costs **energy only**: each refresh drains the module's `operationCost` scaled by the scanned area
  (`operationCost × (2R+1)² / 9`, tunable), so a large radius is expensive. It uses **no script ops**. Scripts read the
  live view with `view()` (1 op), which returns the cells and, with `since`, only what changed since a tick (§10.2).
- Cells in the live area show their true current state; their age is below one `delay`. When a cell leaves the live area (the
  scanner is switched off, runs out of energy or breaks, or its bot moves away), it becomes a normal snapshot stamped with the
  last moment it was live.
- **Energy during live scanning:** the scanner drains its `idleCost` every tick in either mode, and while live it pays
  the refresh cost (above) from the bot's battery in the tick's apply phase, in the deterministic order (§12.4). Live
  scanning never uses script ops; `view()` costs 1 op and no energy. **If the battery cannot pay for a refresh, the scanner
  switches itself off** and returns to one-time mode (the area becomes ordinary snapshots, `view()` then fails with
  `NOT_LIVE`); it must be enabled again, and the owner gets a `LiveScanStopped` event (§24.1).
- Events inside the live area are delivered to the player and animated (§24.1), including those caused by other players.
- **It stays cheap:** live vision is a subscription, not polling, so a quiet world costs nothing, and clients and scripts receive diffs.

## 4.5 Day and night

_The clock: §28.2; the filter and the HUD clock: §15.6._ The world has a day/night cycle on a shared clock (§28.2). It does not change
the map or the rules of movement and vision; it changes how much energy solar panels make (§7.2.1) and how the map looks: a
**dark-blue, high-opacity filter** lies over the map canvas at night, lighter in the morning and evening, absent by day. The
filter is purely visual and lets pointer events through, so clicking and inspecting cells works at any hour (§15.6).

## 4.3 Map rendering (monitor / canvas)

The map is drawn on a canvas with **sprites**, one per cell, not flat coloured squares.

**Assets and rendering**

- Sprites come from a free/open-licence top-down tileset, so the art can be swapped later without code changes.
- If an image is missing, the cell falls back to a solid colour from the fallback palette below, so the map never
  breaks on a missing asset.
- At low zoom levels the renderer draws simplified solid colours instead of sprites (**level of detail**).

**What is drawn**

| Cell state | Rendering |
| --- | --- |
| Unknown / never scanned (fog of war) | black, no sprite |
| Empty (known) | ground tile |
| Resource | one sprite per resource type (gold, iron, oil, crystal, stone, wood), reflecting how much is left |
| Item | one sprite per item type; blueprint items have their own sprite |
| Bot | **chassis-based sprite** (wheels, tracks, immobile) plus **overlay icons** for key modules (weapon, drill, scanner, antenna), see below |
| Base | base sprite; **corpse base** has its own broken variant (§6.3) |
| Stale bot (§6.3) | the bot sprite in a greyed variant |
| Connected bot | its sprite with a small **signal-strength indicator** (0–4 bars, colour from green to red) in a corner, updated live; hidden at low zoom (§11.2.1) |
| Bot without a radio link to its base (§11.2.1) | the bot at its last known position, **greyed with diagonal hatching**, tooltip "connection lost N s ago"; optional link overlay shows the broken relay |
| Cell in the live area (§4.4) | the sprite at full strength, with a subtle live outline |
| Known cell (a snapshot) | the same sprite, **dimmed by age** since `seenAt` (full strength for the first moments, fading to a minimum for old data); a tooltip shows "seen N s ago"; a remembered bot or item is drawn as a last-seen ghost |

- **Bot sprite:** the base picture is chosen from the bot's chassis (wheels, tracks, or the immobile base body). Small
  **overlay icons** for its key modules are layered on top, and a **broken or damaged module** shows as a cracked
  overlay (§8.4.1). Everything is **tinted by ownership**: own = green, enemy = red; bases: own = blue, enemy = purple.
- **Fallback palette** (used for missing images and at low zoom): fog black, empty dark grey, gold yellow, iron steel
  grey, other resources per-resource colour, item cyan, own bot green, enemy bot red, own base blue, enemy base purple.

**States of a cell as a player knows it** (the lifecycle in one table):

| State | How it begins | What the player has | How it ends |
| --- | --- | --- | --- |
| Unknown | nothing has seen the cell yet | nothing: fog of war, drawn black | a scan, or an action of the player's own bot, covers it |
| Known (a snapshot) | a scan or an action of the player's own bot covered it | the contents it had at `seenAt`, drawn dimmed by age | covered again (the snapshot is replaced), or a live area reaches it |
| Live | it lies inside the area of a scanner in live mode (§4.4) | its current contents, younger than one scanner `delay` | the scanner is switched off, runs out of energy, breaks, or its bot moves away |
| Stale | time passes on a snapshot | the same contents drawn at the minimum strength, a remembered bot or item as a last-seen ghost | covered again by a scan, an action or a live area |

Interaction: pan and zoom the viewport; clicking a cell shows its stored content; clicking one of your bots opens its
control panel (§15.1).
