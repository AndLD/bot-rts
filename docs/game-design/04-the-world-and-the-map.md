[← Game design index](../GAME-DESIGN.md)

# 4. The world and the map

## 4.1 Grid

- The world is a 2D grid of **cells**, addressed by integer `Location { x, y }` (an optional `z` exists in the data
  model for future layering). ✅ The world is **2D**: `z` is **reserved** in the type but has no gameplay meaning, is
  never set by the game, and is ignored by movement, scanning and the map.
- ✅ **The world is unbounded.** There is no border: coordinates may be negative and cells are generated lazily on
  first scan. Storage must therefore be sparse (only materialized cells are stored) and indexed by location.
- Each cell has a **type** and an optional content reference. Implemented point types (`MapPointType`):

  | Type | Meaning |
  | --- | --- |
  | `resource` | A natural deposit (e.g. gold, iron) that can be mined |
  | `item` | A loose item lying on the ground |
  | `bot` | A bot occupies the cell |
  | `base` | A player base occupies the cell |
  | `null` | Empty passable cell |
  | *unknown* | Never scanned by this player → rendered black |

- ✅ **One solid entity per cell.** Bots, bases (including corpse bases) and resource deposits are solid and block
  movement; ground **items** do not block. `move()` into an occupied cell fails with `BLOCKED` — there is no pushing
  or ramming. Resource cells are worked from an adjacent cell. Blockers can only be removed by destroying them
  (combat) or, for deposits, by depleting them.
- ✅ **Base spawn:** a new base is placed on a **free cell** (not occupied, not a deposit) that is at least
  `minBaseDistance` cells (default 30, tunable) from every living base and every corpse base. Candidates are drawn at
  random inside a ring around the world origin whose radius grows with the number of bases; on conflict the search
  retries. This replaces the current prototype behavior (random cell in `[0,10]²` with no occupancy check, see
  `spawnMaxDistance` in `api/services/bots.ts`), which only works for a handful of players. A redeploy after base
  destruction (§6.3) uses the same rule. Players may also deploy with a [spawn seed](./22-public-api-integrations.md#223-spawn-seeds) to start near
  friends.

## 4.2 Two layers: real points and user points

The map is stored in two logical layers:

| Layer | Stored with | Who sees it | Purpose |
| --- | --- | --- | --- |
| **Real map points** | no `userId` | everyone | authoritative shared world |
| **User map points** | with `userId` | only that player | that player's fog of war / knowledge snapshot |

Rules:

- When a player scans, cells they have never seen are **generated** by the server. Generation is probabilistic —
  currently each new cell has a **20 %** chance to be a `resource` (`Math.random() < 0.2`). 🟡
- If the cell already exists as a real point, its **current contents are read from the game database** — not re-rolled.
  This keeps the world consistent for every player. ✅
- The player's user-point layer is synced from the real layer: when the real cell's `contentId` or `type` differs from
  the player's cached copy, the cache is updated. ✅
- ✅ Map knowledge is **private per player**. There are no teams or alliances in the initial release; players may only
  cooperate by exchanging messages (`sendMessage`). Alliances / shared fog are a possible future extension.
- ✅ **Knowledge is a snapshot.** Every known cell stores the contents it had when it was last seen and a **`seenAt`
  timestamp** (the game tick). Nothing refreshes it between scans: there is no passive sight and no continuous scanning.
  A cell's **age** is the current tick minus `seenAt` (shown in seconds through `tickIntervalMs`).
- ✅ **What refreshes a cell:** a `scan()` that covers it, and the direct result of an action of the player's own bot on it
  (the cell it moved into, dug, shot at or dropped an item on), stamped with the current tick. Nothing else.
- ✅ **Stale data is expected, not an error.** Other bots, dropped items and deposits can change after `seenAt`. Actions are
  always checked against the **real** world, so acting on a stale cell returns an ordinary error value (`BLOCKED`,
  `EMPTY`, `GONE`); a script that cares about freshness re-scans and compares `seenAt`. Scanning every tick is not
  possible by design: each scan costs ops and energy and waits for the scanner's cooldown (§7.2).
- Rendering a map view is therefore a *merge* of: real points in the viewport + the player's knowledge + black unknown
  cells (fog of war).

## 4.3 Map rendering (monitor / canvas)

✅ The map is drawn on a canvas with **sprites**, one per cell, not flat coloured squares.

**Assets and rendering**

- Sprites come from a **free/open-licence top-down tileset** (the licence is recorded in the repo), packed into **one
  sprite atlas** with a JSON index, so the art can be swapped later without code changes. The atlas lives in the client
  assets.
- Rendering uses the plain **Canvas 2D API** with a **32 px** tile size.
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
| Known cell (a snapshot) | the same sprite, **dimmed by age** since `seenAt` (full strength for the first moments, fading to a minimum for old data); a tooltip shows "seen N s ago"; a remembered bot or item is drawn as a last-seen ghost |

- **Bot sprite:** the base picture is chosen from the bot's chassis (wheels, tracks, or the immobile base body). Small
  **overlay icons** for its key modules are layered on top, and a **broken or damaged module** shows as a cracked
  overlay (§8.4.1). Everything is **tinted by ownership**: own = green, enemy = red; bases: own = blue, enemy = purple.
- **Fallback palette** (used for missing images and at low zoom): fog black, empty dark grey, gold yellow, iron steel
  grey, other resources per-resource colour, item cyan, own bot green, enemy bot red, own base blue, enemy base purple.

Interaction: pan and zoom the viewport; clicking a cell shows its stored content; clicking one of your bots opens its
control panel (§15.1). 🔴
