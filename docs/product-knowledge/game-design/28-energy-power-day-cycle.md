[← Game design index](./GAME-DESIGN.md)

# 28. Energy, power and the day cycle

Every bot lives on energy: its modules drain it, power sources make it, and the sun decides how much a solar panel makes. This
section holds the energy model (§28.1), the shared game clock with the day and the night (§28.2) and what happens when a battery
runs out (§28.3). It was section 12.5 of the execution model; §12.5 keeps a pointer, so older references still resolve.

## 28.1 Energy model

**Energy model:**

- **Idle drain:** every tick, each attached module drains its `idleCost` from the battery.
- **Operation drain:** each executed action additionally drains the acting module's `operationCost`.
- **Battery:** stores energy up to its `capacity`; it can never exceed it or go below zero.
- **Generator:** while enabled, each cycle (every `delay` ms) **burns `fuelPerCycle` oil taken from the bot's storage**
  and adds `energyPerCycle` to the battery, capped at `capacity`. Without oil it produces nothing (an `OutOfFuel` event is
  raised once, when it runs dry, see "States are told once" below). It is a module like any other and pays its own `idleCost`. Class-1 defaults
  (tunable, in the catalogue): 12 energy per 250 ms cycle (48 per second) for 0.02 oil per cycle, about 600 energy per oil.
- **Solar panel:** class 1 makes 2 energy per 250 ms cycle at full sun (8 per second at its peak), 0.8 per second at night; the oil generator is 6× the panel's peak. A simulation test over game days pins the balance: the starter base (idle 2.6 per second) lives on its panel alone under a light duty and runs dry in minutes under a continuous heavy one.
- **Live scanner:** a scanner in live mode pays its area-scaled energy cost on every tick; if the battery cannot pay, it switches itself off and a `LiveScanStopped` event is raised.
- **Empty battery:** the bot is unpowered; what that means is stated once, in §28.3. Charging happens inside the tick,
  after commands are applied.

- `sleep(ms)` costs no operations but consumes the bot's idle energy (`idleCost` per tick).
- Every executed operation consumes `operationCost` energy from the battery.

**States are told once.** A state that lasts (a generator without oil, a battery that is low) raises its event **when it
begins**, not on every tick or cycle it stays true. The state is kept in the module properties (`isOutOfFuel` on the generator,
`isLowReported` on the batteries), so a **restart does not tell it again**; the flag is cleared when the state ends (the
generator ran on oil again, the energy is not low any more) and the state is then told again if it recurs. The rule for every
level-triggered event is in §24.1.

**Power sources.** Generators are one kind of power source next to the solar panel (§7.2.1); the
energy model runs every working, enabled source on its own cycle (`delay`), so adding a kind does not change the others. A
solar panel burns nothing and adds `energyPerCycle × sunlight(now)` per cycle (§28.2).

## 28.2 Game time and day/night

The world has one shared clock derived from the engine's injected clock (never
`Date.now()` in game logic, §12.4); every player sees the same time.

- **Scale (tunable config):** one in-game hour is one real minute, so a **day lasts 24 real minutes**; the world clock counts
  from the Unix epoch. The scale is a runtime setting that the engine, the API nodes and the
  clients all follow, changed from the admin console: the day length from 1 minute to 24 hours (48 minutes, 6 h 30 min or a
  24-hour day), the time of day set to a chosen hour, or the clock synced to the real-world time of a chosen time zone. A change
  re-anchors the cycle so the time of day does not jump, and connected players are told by a `game-time-changed` socket event. The
  rules of the game read a separate `GAME_CLOCK`, so a change of the game's time never touches sessions, logins or the audit trail.
- **Phases and sunlight factor:** night 21:00–05:00 → **0.1**; morning 05:00–09:00 and evening 17:00–21:00 → **0.6**; day
  09:00–17:00 → **1.0** (a day averages about 0.57). The factor multiplies the output of solar panels (§7.2.1) and nothing else.
- **One computation:** the time of day, the phase and the factor are computed by the same code on the server and in the client; the API serves the time
  configuration and the current instant, and the client derives the same time from its server-synced clock (§15.1).
- **Presentation:** an in-game clock in the HUD and a night filter over the map (§15.6); both are cosmetic and never touch the
  simulation.

## 28.3 Power-on hysteresis

A bot whose battery reaches **0** becomes *unpowered*. This section is the only statement of what that means:

- It **cannot spend energy**, so every call that costs energy returns `NO_ENERGY` (§10.3). Its executions are **not suspended and
  not killed**: the script goes on, and the same calls work again after the resume.
- Its **radio link is down** (§11.2.1).
- A factory or maintenance job that was **already queued finishes on its own timer**; a new order is refused with `NO_ENERGY`.
- A dark bot **drains no idle cost**, so a generator or a solar panel can bring it back.
- It powers on again only when the stored energy has grown to a **resume threshold (10 energy, one config value for every bot)**,
  not at the first unit above 0, so a bot at the edge does not flap between working and out of energy (and the radio link does not
  flap between lost and restored). A bot with 20 energy works until 0. The state is persisted in the batteries like the other
  states of this section.
