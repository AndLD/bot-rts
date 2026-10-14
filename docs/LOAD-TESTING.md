[← README](../README.md)

# Load and soak testing

`scripts/load-test.mjs` starts a throwaway stack (a fresh database `botrts_load` and the API) and plays many players against it:
every player registers, confirms the email, deploys a base, opens a terminal over a Socket.IO connection, saves a script and
runs it. The harness then scrapes `/api/v1/metrics` and reports what the engine did.

```bash
npm run db:up
npm run load -- --players 300 --scripts 1 --duration 60
npm run load -- --players 150 --duration 3600 --report .load/soak.json      # a soak run
npm run load -- --players 300 -- ENGINE_TICK_CAP_RATIO=0.6                  # settings of the API after `--`
```

| Option | Default | Meaning |
| --- | --- | --- |
| `--players` | 50 | Players, each with a base and a socket |
| `--scripts` | 2 | Scripts per player (a bot runs `parallelExecutions` at once, the rest are queued) |
| `--hogs` | 0.1 | Share of scripts that never yield (`for (;;) {}`); the sandbox must cut them without hurting others |
| `--scenario` | `mixed` | `compute` (arithmetic and log lines), `scan` (a world command every cycle) or `mixed` |
| `--duration`, `--warmup` | 60, 10 | Seconds measured, and seconds not measured after the scripts started |
| `--max-p95`, `--max-wait`, `--max-overrun-share` | 80, 20, 0.05 | Limits; the run exits with 1 when one is exceeded |

The report (`.load/report.json`, also printed) has the tick rate, the median and worst 95th-percentile tick duration, the share of
ticks that overran the interval or were cut at the cap, the longest unserved wait of any execution (scheduler fairness), the
queue depth, the sandbox memory and the resident memory of the API at the start and at the end.

## What is measured

- **Tick budget:** a tick is `ENGINE_TICK_INTERVAL_MS` (100 ms). The scheduler stops running scripts at `ENGINE_TICK_CAP_RATIO` (80 %)
  of it; what is left is the engine's own work (applying commands, the flush, vision, radio).
- **Fairness:** `botrts_engine_max_wait_ticks` is the longest an execution that could run went without being stepped because the
  tick was cut. It must stay near zero, and below the number of players when the cap is reached.
- **Hogs:** the share of executions that are alive at the end must be the share that are not hogs.

## Results

A development laptop (Apple silicon, API, PostgreSQL in Docker and the generator on one machine), `mixed` scenario, 10 % hogs,
one script per player, `ts-node` API. The numbers are a reference for comparing changes, not a promise for a server.

| Players (scripts) | Duration | Tick p95 (median / worst) | Overran | Cut | Longest wait | Heap / RSS |
| --- | --- | --- | --- | --- | --- | --- |
| 50 (100, half queued) | 40 s | 11.9 / 13.1 ms | 0 % | 0 % | 0 ticks | 820 MB RSS |
| 300 (300) | 40 s | 52.7 / 54.2 ms | 0 % | 0 % | 0 ticks | 865 MB RSS |
| 600 (600) | 40 s | 99.3 / 102.7 ms | 3.9 % | 0 % | 0 ticks | 1255 MB RSS |
| 600, `ENGINE_TICK_CAP_RATIO=0.6` | 40 s | 97.9 / 99.5 ms | 1.7 % | 24.4 % | 1 tick | 1117 MB RSS |
| 150 (150), soak | 200 s | 25.9 / 27.4 ms | 0 % | 0 % | 0 ticks | heap flat at about 400 MB, RSS 873 MB |

In every run the hogs (10 % of the scripts) were cut by the sandbox and the other executions stayed alive; the engine ticked at
10 per second.

## Tuning

- **Capacity.** On this machine one engine thread runs about 300 actively running scripts at half the tick and about 600 at the
  full tick; that is the knee of the curve, and it matches the guard-rails of design §12.2.2. Past it the API stays responsive
  (the engine runs in its own thread) but the game gets slower.
- **The scheduler budget stays at `ENGINE_TICK_CAP_RATIO=0.8`.** Below the knee the cap is never reached, so lowering it changes
  nothing. At the knee the cap decides who waits: with 0.6 about a quarter of the ticks were cut and the overruns halved, while
  fairness held (no execution waited more than one tick), because whoever is left out goes first in the next tick. A deployment that
  runs near the knee can lower the ratio to keep the tick on time at the price of slower scripts; one that runs far below it needs
  no change. Alert on `botrts_engine_tick_p95_milliseconds` above 80 and on `botrts_engine_max_wait_ticks` above a few ticks.
- **What the soak run found.** The first soak run (150 players, 7 minutes) showed the heap of the API growing by about 1 MB per
  second while the sandboxes stayed flat. The cause was the recorder that stores script output in the terminal log: it stored
  every line with its own statements through one chain of promises, and at about 1,400 lines a second the chain grew without end.
  Lines are now collected per bot and stored every 250 ms in one batch, capped at the bot's line limit while they wait; the same
  run is flat afterwards and its tick p95 is lower.
- **Not tested here:** several API nodes, a remote database, and many more than 600 scripts; run the harness against such a stack
  before sizing a deployment (the harness starts its own API, so point `LOAD_ADMIN_DATABASE_URL` at the database to use).
