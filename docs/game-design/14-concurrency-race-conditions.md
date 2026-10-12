[← Game design index](../GAME-DESIGN.md)

# 14. Concurrency & race conditions

Many bots from many players can issue commands that touch the same map cells at the same tick.

## 14.1 Conflict classes

| Conflict | Example | Resolution |
| --- | --- | --- |
| Two bots move into one cell | A and B both `move()` into (5,5) | Deterministic ordering; first succeeds, other gets `BLOCKED` |
| Two bots mine one deposit | A and B `dig()` the same gold | Deposit has finite amount; decremented atomically; over-draw gets `EMPTY` |
| Pick up / drop the same item | A picks the item B is about to take | Item ownership is atomic; loser gets `GONE` |
| Two bots occupy one cell | B moves into the cell A occupies | Occupancy check + atomic reservation |
| Combat ordering | A shoots B while B shoots A | Commands applied in tick order; simultaneous fire resolved consistently |

## 14.2 Mechanisms ✅

Because the **engine thread is the only writer of world state** (§12.2.2), conflicts are resolved **in memory**; no
database transactions, row locks, versioned writes or per-cell queues are needed for gameplay conflicts.

- **Single writer rule:** *every change to the game world goes through the engine as a command* — scripts, the
  terminal, and API requests (deploy base, edit a file, craft, assemble) alike. The API thread forwards the request to the
  engine and returns its result; it never writes world tables directly.
- **Collect-then-apply:** commands are gathered for the tick and applied in the deterministic order (§12.4).
- **Reservations:** moving bots reserve the target cell during the apply phase; the loser of a contested action gets an
  error value (`BLOCKED`, `EMPTY`, `GONE`).
- **Deterministic RNG:** seeded per tick, so results are reproducible and testable.
- **Persistence:** the engine flushes changed state to the database in **batched bulk writes** (write-behind), each flush in a single database
  transaction so a crash never leaves a half-applied tick. The flush interval is 1 second and
  crash recovery relaunches running executions (§12.3.1).
- ✅ **Implementation (Plan 5.5):** the engine holds the cells, bots and items in use in memory (`World`), loaded in chunks on
  demand, and applies the commands of a tick one after the other, so a cell a bot moved into is occupied for the next command
  and the loser gets `BLOCKED` / `EMPTY` / `GONE`. The order of a tick's commands does not depend on how they were collected:
  the bots take turns in a shuffle of their sorted ids seeded by `worldSeed` and the tick, and the commands of one bot go in
  the order of their execution and call numbers. Use cases that work on the database (scan, the factory, repairs) are called
  between a flush of the memory and an eviction of it.
- ✅ **The single writer for API requests (Plan 5.5):** with the engine switched on, the use cases that change the world — deploy
  a base, scan, craft / research / learn, assemble, repair / disassemble and the writes of files — are not run in the API
  process: the services the controllers, gateways and terminal commands get send them to the engine (`EnginePort.act`), which
  runs them between its ticks, after writing its memory and before forgetting it. Reads stay in the API process. With the engine
  switched off (the unit and integration tests, a build without game logic) the same services run the use cases themselves.
  Known gap: deleting an account still removes its bases from the API process.
