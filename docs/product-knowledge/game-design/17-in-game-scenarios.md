[← Game design index](./GAME-DESIGN.md)

# 17. In-game scenarios

Each scenario is a short narrative walkthrough of a mechanic, in the order a player meets it.

## Scenario A — "Deploy your base"

1. Alice signs up and confirms her email link.
2. The game shows a red **"Deploy your base to start"** button.
3. She clicks it. The server places `Alice base` on a free cell chosen by the spawn rule (§4.1), attaches the starting
   module kit, credits her wallet with the starter grant (§26.1), and writes the base's map point.
4. The monitor opens, showing mostly black cells (fog of war) and her base sprite tinted blue.
5. **Design intent:** onboarding must end with the player looking at a world they want to explore.

## Scenario B — "First light" (scanning)

1. Alice opens the base terminal, enters `shell` and runs `await bot.scan()` (§11.1: there is no `scan` command; the call is
   the script function of §10.2).
2. The `scanner-class1` (radius 1) reveals the 8 neighbours around the base (§7.2).
3. The server stores any newly discovered cells as **real** map points, each a resource with the chance `WORLD_RESOURCE_CHANCE`
   drawn from the seeded world RNG (§4.2), and caches them in Alice's **user** layer.
4. Her monitor updates: black cells turn into known colours (yellow for gold, grey for iron, dark grey for empty).
5. Scanning again returns the **stored** contents — the world does not re-roll.

## Scenario C — "Gold prospector" (the canonical script)

Alice crafts a mobile bot, connects to it, writes `prospector.js`:

```js
export async function main(bot) {
  while (true) {
    const scan = await bot.scan()
    if (!scan.ok) {
      bot.log(`Scan failed: ${scan.code}`)
      break
    }

    const gold = scan.data.find((cell) => cell.type === 'resource' && cell.resource?.resource === 'gold')
    if (gold) {
      bot.log(`Gold found in location [${gold.x}, ${gold.y}]`)
      break
    }

    const moved = await bot.move(1)
    if (!moved.ok) {
      bot.log(`I'm stuck: ${moved.code}`)
      break
    }

    await bot.sleep(1000)
  }
}
```

1. Scan → no gold.
2. `move(1)` → the bot advances one cell.
3. If the move fails (`BLOCKED`, `NO_ENERGY`, …), the result says why, so the bot is **stuck**: it logs the reason and
   stops (§10.3). (In the original notes the script compared two `getLocation()` readings to detect this; the result object now
   makes that unnecessary.)
4. Otherwise it sleeps 1 s and loops.
5. When gold appears in the scan (a cell of type `resource` holding gold, §4.2), it logs the coordinates and exits.

**Design intent:** the whole game is legible in ~20 lines of code, and every failure mode is something the player can
program around.

## Scenario D — "The haul" (mining loop)

Bob has a bot with drill + manipulator + storage. His script (see [Miner + hauler loop](./18-example-scripts.md#182-miner--hauler-loop))
scans for iron, digs it, stores it, and otherwise moves on, checking each result's `ok` flag.

Design intent: extraction + logistics is where the economy loop becomes visible, and where storage capacity, energy,
and travel time force trade-offs.

## Scenario E — "Assemble a specialist" (craft → assemble)

1. Carol opens the Factory GUI and selects the **Craft table**.
2. Recipe: `processor-class1` needs 25 crystal + 10 gold and 25 s of factory time; she has the blueprint.
3. She confirms, the resources are deducted, and the module appears in the base's module inventory.
4. She repeats for memory, wireless adapter, engine, chassis, scanner and storage.
5. She opens **Assemble**, drags the required modules in (processor, control block, power, mobility + payload), names
   the bot `Carol-1`, and confirms.
6. The bot spawns next to the base; its control-block id is registered in the base registry; the fleet list shows it.

## Scenario F — "Remote control" (connect)

1. Carol runs `list` in the base terminal and sees her own bot `Carol-1` (`list` shows the player's bots only, §11.1).
2. She runs `connect <botId>`; her own bot needs no password (§11.2.2).
3. The server checks the target bot has an **enabled wireless adapter** and is connected to the base (§11.2.1); it is, so a
   draggable terminal opens for that bot.
4. She writes a script with `edit miner.js`, then `run miner.js` (§11.1).
5. Her own internet connection drops (this is the player's client, not the bot's radio link): the bot terminal shows **"Connection interrupted"** in the centre, while the script **keeps
   running on the server** (§12.3).
6. On reconnect, the client opens a **new stored session** on the bot and says so (§15.6); the lines of the earlier session and
   of the script stay in the bot's stored history (§11.2.3).

## Scenario G — "Out of range"

1. Frank's scout walks away from the base and leaves the range of its wireless adapter.
2. On the map the scout turns grey with diagonal hatching at its last known position; its terminal shows "Connection
   interrupted" and he gets a `LinkLost` notification. His manual commands to the scout are refused (`NO_SIGNAL`).
3. The scout's script keeps running. It calls `getLinkStatus()`, sees `connected: false`, and walks back toward the base.
4. A relay tower built earlier also runs out of oil, so two more bots behind it are hatched as well.
5. Frank refuels the tower; the link returns by itself, the terminals resume, the scout's buffered scans appear on the map
   with their real times, and a summary of the missed events arrives.

## Scenario H — "Debugging in the field"

1. Eve's hauler keeps getting stuck.
2. She runs `top` and sees three executions with their id, bot, file and state: `miner.js` (running), `hauler.js`
   (suspended), `scout.js` (awaiting), and a restart count for each (§11.1; `top` shows no operations count).
3. She notices `hauler.js` has restarted many times, so it keeps failing and being started again (§12.3.1).
4. She runs `kill <execId>` on that execution (the id may be shortened to 8 characters), edits the script, and `run`s it again.
5. Because her processor's ops/tick is the limit (§12.2.1), the other scripts were never starved.

## Scenario I — "Two players, one deposit"

1. Frank's and Gina's prospectors both detect the same gold deposit in the same tick. A deposit is solid: nobody can enter it,
   it is mined from the next cell (§4.1, §9.2).
2. Both issue `move()` toward the same free cell next to it.
3. The scheduler applies the tick's commands in deterministic order (§12.4, §14.2): Frank's bot enters the cell, Gina's gets
   `BLOCKED`.
4. Gina's script handles the value (`if (!result.ok) …`), turning toward a different deposit instead of crashing (§10.3).
5. **Design intent:** competition is resolved by rules, not by luck of arrival order — and well-written scripts adapt.

## Scenario J — "Defend the base"

1. An enemy bot approaches the base.
2. The base's `gun-class1` (range 5, damage 50, cooldown 2 s) is driven by its defensive script: `scan` → detect enemy
   bot → `aim` → `shoot` while it is in range.
3. Because the base is armored and immobile, its job is to out-sustain attackers until they run out of energy or ammo.
4. Late game, the player adds dedicated defender bots with weapons + armor to intercept further out.

## Scenario K — "Energy crisis"

1. A heavy bot (lots of armor + storage) runs out of energy mid-haul and becomes unpowered (§12.5.2).
2. Its script is not suspended: every call that costs energy returns `NO_ENERGY`, and the bot pays no idle cost, so it can recover (§12.5.2).
3. Its power source slowly refills the battery: a solar panel (its output follows the time of day, so the night is the
   dangerous time, §12.5.1) or an oil generator (strong, but it needs oil in a storage, §7.2.1). The bot powers on again only
   when the stored energy has grown to the resume threshold (§12.5.2), so it does not flap at the edge, and the haul resumes.
4. The player responds by adding a bigger battery to carry the bot through the night, a second power source, or an oil
   generator fed by a logistics bot — a hardware fix to a software problem.
