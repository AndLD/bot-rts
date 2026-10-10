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
MongoDB transactions, replica set, versioned writes or per-cell queues are needed.

- **Single writer rule:** *every change to the game world goes through the engine as a command* — scripts, the
  terminal, and API requests (deploy base, edit a file, craft, assemble) alike. The API thread forwards the request to the
  engine and returns its result; it never writes world collections directly.
- **Collect-then-apply:** commands are gathered for the tick and applied in the deterministic order (§12.4).
- **Reservations:** moving bots reserve the target cell during the apply phase; the loser of a contested action gets an
  error value (`BLOCKED`, `EMPTY`, `GONE`).
- **Deterministic RNG:** seeded per tick, so results are reproducible and testable.
- **Persistence:** the engine flushes changed state to MongoDB in **batched bulk writes** (write-behind). The flush interval is 1 second and
  crash recovery relaunches running executions (§12.3.1).
