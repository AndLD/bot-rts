[← Game design index](./GAME-DESIGN.md)

# 12. Real-time execution model

This is the heart of the game and the open question in the notes: how to run many players' scripts **fairly**, in
**real time**, with **per-hardware limits**, **without letting code touch the server**, and **without races**.

## 12.1 Goals

1. **Fairness across players** — within one unit of time, scripts belonging to *all* players must run. It must never
   be the case that one player's entire fleet finishes before another player's scripts get any time.
2. **Hardware-bound execution** — a processor module defines:
   - **operations per tick** (how many API calls the bot may make per tick),
   - **parallel executions** (how many scripts/executions may run concurrently).
3. **Isolation** — player code cannot reach the server, the filesystem, or the DB directly; only approved functions
   may query game state.
4. **No race conditions** — many bots may issue commands that indirectly affect the same map cells.

## 12.2 Tick-based round-robin scheduling

The world advances in **ticks**. Default **10 ticks/s (a 100 ms tick)**, stored in config (`tickIntervalMs`) so it can be
changed without code edits. Module timings (`delay`, `cooldown`, read/write delays) are in milliseconds and are
converted to ticks, so they scale with the tick rate. Whether the default fits is to be revisited after load tests (Q2).

```
for each tick:
    players := all players with at least one active execution (online or offline), in a stable shuffled order
    for each player P in players:              # interleave players
        budget_P := P.processor ops this tick
        for each ready execution E of P:
            run E for min(E.remaining, budget_P / parallel(E))
            E.remaining -= consumed
        P.credit += processor throughput
```

- The scheduler iterates **player-by-player**, not bot-by-bot across one player, so time is interleaved fairly.
- Each bot has an **ops-per-tick budget** derived from its processor module; when exhausted, the execution suspends
  until the next tick (this is what makes `sleep()` and long loops fair).
- `parallelExecutions` on the processor allows several scripts to progress within the same tick.
- A bot with no processor cannot run scripts at all.

**Scheduler rules:**

- Each **bot** has its own `opsPerTick` budget from its processor (§12.2.1); budgets are per bot, so a larger fleet
  gives more total throughput (hardware = capability). Unspent ops do **not** carry over to the next tick.
- Each tick, players are processed in a **seeded shuffled order** (seed derived from the tick number), and each
  player's bots in a stable order, so no player systematically runs first.
- Each execution has a **wall-clock slice** per tick, and the tick has a **global time cap**. If the cap is hit,
  unprocessed work resumes next tick from a **round-robin resume point**, so nobody is starved.
- **How it is scheduled:** the players with a live execution take turns **one execution each per round** (not
  all of one player first), in a seeded shuffle drawn per tick, so a tick cut short by the global cap has served every player
  alike; the executions the cap kept from running go first next tick. A bot runs at most `parallelExecutions` of its
  executions; the others stay `queued`. A bot's game calls are let through up to its `opsPerTick` per tick, oldest first
  (several processors add up); the rest wait for the next tick, and a bot without a working processor runs nothing. The
  scheduler never looks at whether the player is online.
- Commands produced during a tick are collected and applied in a deterministic order (§12.4), not by arrival time.

## 12.2.1 Processor model

A processor module defines two numbers:

| Property | Meaning | Class-1 default (tunable config) |
| --- | --- | --- |
| `opsPerTick` | how many game-API calls the bot may make per tick, summed over all its executions | 2 |
| `parallelExecutions` | how many scripts may run at the same time on the bot | 1 |

- Every game-API call (`scan`, `move`, `shoot`, …) consumes ops; the cost per function is configurable and defaults to 1.
- Plain JavaScript computation between API calls does **not** consume ops, but each execution has a fixed wall-clock
  slice per tick; exceeding it suspends or kills the execution. Defaults (tunable): **5 ms** wall-clock slice per execution per tick and a
  global tick time cap of **80 % of `tickIntervalMs`** (80 ms at 10 ticks/s).
- When a bot's ops are spent, its executions suspend until the next tick.
- Executions above `parallelExecutions` wait in the `queued` state.
- Higher processor classes raise both numbers; values live in the balance config, not in code.

## 12.2.2 Threading topology

There is **one authoritative engine process** for the whole world: it alone runs scripts, owns the world state and writes to the
database (in batches, not one query per command). The player-facing API scales horizontally, the engine vertically; if the engine
process dies, the game pauses until it restarts and reloads the world from the database.

Scripts never touch the world directly: an API call such as `move()` spends ops and **queues a command**, and the engine applies all
commands for the tick in the deterministic order (§12.4); results resolve the script's pending promises at the start of the next
tick. Sharding the world by region across several engines remains possible later (backlog, §21), but it is not built.

**Capacity guard-rails** (rough estimates to be validated by a benchmark spike, not promises; Q3): an engine should
handle a few hundred up to about 1,000 *actively running* bots at 10 ticks/s; idle bots are almost free. Per-bot limits
(`opsPerTick`, wall-clock slice, script memory limit) cap the cost of any single bot, a tick that overruns its time
cap is cut and resumed next tick (§12.2), and tick duration / active executions / context memory are exported as
metrics.

## 12.3 Execution lifecycle

| State | Meaning |
| --- | --- |
| `queued` | submitted via `run`/`execute`, waiting for budget |
| `running` | currently consuming tick budget |
| `suspended` | awaiting `sleep()`, or budget exhausted this tick |
| `awaiting` | blocked on an API operation (e.g. a move in progress) |
| `finished` | completed normally |
| `killed` | terminated via `kill`, `reboot` or a fault (an empty battery does not kill, §12.5.2) |

`top` shows the `queued`/`running`/`suspended`/`awaiting` executions; `kill` moves one to `killed`.

## 12.3.1 Engine restart and crash recovery

- **Execution records are durable.** Starting, finishing or killing an execution is written to the database immediately
  (file, args, bot, state), so the engine always knows what was running.
- **World state is flushed every second** (every 10 ticks) in a batched bulk write. A crash loses at most about one
  second of game time; the world reloads from the last flush.
- **After a restart, executions that were running are automatically relaunched from the beginning of `main`** with their
  original arguments. Script variables and the point where the script was paused are **not** preserved, so scripts
  should be restartable (read the world, then decide again). The relaunched script's log shows a "rebooted" note.
- **Crash-loop guard:** an execution that was running during several consecutive engine crashes is marked `killed`
  instead of being relaunched again (threshold: tunable config; the default value is open, Q4).

**Watchdog.** A step that does not finish within `ENGINE_WATCHDOG_STALL_MS` (default 2 s, against a 5 ms slice) means the sandbox is stuck
inside a builtin it cannot interrupt. The execution is killed with the reason `stalled the engine`, the player is told in the
script's log, and the engine restarts and relaunches the other executions as after any crash (§12.3.1). Ticks keep their budget and
bots are served about equally even with scripts that never stop among honest ones.

## 12.4 Determinism & ordering

- All bots' commands for a tick are **collected first**, then applied in a deterministic order (a stable per-tick
  shuffle seeded by the tick number).
- Conflicting commands are resolved by the rules in §14, not by arrival order.
- Random outcomes (spawn probabilities, accuracy, mining yields) use a **seeded RNG**, so replays and tests are
  deterministic.
- Scripts have **no clock**: `Date` does not exist, `Math.random()` is the engine's seeded random function and `bot.time()` is the game time (§10.2).
- **Scope of the guarantee:** the outcome is deterministic for a given world state and command list. Whether a script
  is preempted by the wall-clock slice (§12.2.1) depends on machine speed, so script preemption under overload may
  differ between runs; this is accepted.

- **Two clocks:** the rules of the game (timers of crafting, research and the factory, the energy of the bots,
  radio and combat, the times on the map, the due times of notifications) read the **game clock** (`GAME_CLOCK`); sessions, logins,
  rate limits, bans, the audit trail and database timestamps read the **real clock** (`CLOCK`). The game clock is the real one plus an
  offset that is always 0 in production, and the day cycle (length, anchor, mode) is a runtime setting in the game settings that the
  engine, the API nodes and the clients follow; the tick loop stays on real time.

## 12.5 Time, energy and sleep

_Moved to [§28 Energy, power and the day cycle](./28-energy-power-day-cycle.md). `sleep(ms)` costs no operations (§28.1)._

### 12.5.1 Game time and day/night

_Moved to [§28.2](./28-energy-power-day-cycle.md#282-game-time-and-daynight)._

### 12.5.2 Power-on hysteresis

_Moved to [§28.3](./28-energy-power-day-cycle.md#283-power-on-hysteresis)._

## 12.6 Combat model

- **Firing:** `shoot(x, y)` is allowed only if the target is within the weapon's `distance`, the weapon is off
  `cooldown` and loaded, and the bot has energy. Weapons that fire batches follow `batchSize` / `batchCooldown`.
- **Hit roll:** the chance to hit is the weapon's `accuracy`, reduced with distance; resolved with the seeded per-tick RNG
  (§12.4), so results are reproducible.
- **Damage:** on a hit, `max(minDamage, damage - target armor)` is applied to **one randomly chosen attached module**
  of the target (its `condition` falls; at 0 the module is destroyed and stops working). `minDamage` and the armor
  formula are tunable config.
- **Ammo:** each shot consumes ammunition of the weapon's `caliber` from the bot's storage; no ammo → `shoot` fails
  with an error value.
- **Artillery** (`isArtillery`): the shot is not blocked by intermediate entities and also damages the 8 neighbouring
  cells at half damage (friendly fire applies).
- **Bot destruction and loot:** bots are never "dead"; see module damage and disassembly in §8.4.1.
