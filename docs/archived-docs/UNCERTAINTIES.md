# Uncertainties (ARCHIVED — all points resolved)

> **Archived.** This was the working list used to settle every open assumption in the game design and development
> plan. All decisions are now recorded in [`../GAME-DESIGN.md`](../GAME-DESIGN.md) and
> [`../DEVELOPMENT-PLAN.md`](../development-plan/DEVELOPMENT-PLAN.md); this file is kept as a decision log. Section numbers (`GD §…`) refer
> to the files under [`../game-design/`](../game-design/), and `Plan x.y` to the tasks under
> [`../development-plan/`](../development-plan/). **Task numbers in this log are from the time of archiving:** the plan later
> split Phase 6, so old tasks 6.12–6.19 are now 7.1–7.8, and the old Phase 7 (multiplayer, public API, hardening) is
> now Phase 8 (tasks 8.x).

Working list of unapproved assumptions in `GAME-DESIGN.md` and `DEVELOPMENT-PLAN.md`.
Process: one point at a time → owner answers → point is marked ✅ Resolved here → the decision is written into
`GAME-DESIGN.md` / `DEVELOPMENT-PLAN.md` as a fact (💡 marker removed). (Archived instead of deleted.)

Status: ⬜ Open · ✅ Resolved

All points are resolved.

## A. World & game scope

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| A1 | ✅ | Win / score condition: endless sandbox vs. victory condition | Not defined (GD §20.11) |
| A2 | ✅ | Map size: unbounded procedural vs. fixed world with border | Not defined (GD §20.12) |
| A3 | ✅ | Offline behavior: do scripts keep running while the player is logged out? | "Suggests yes" (GD §20.10) |
| A4 | ✅ | Fog-of-war sharing / alliances / teams | Private per player (GD §20.13) |
| A5 | ✅ | PvP rules & base loss: what happens when the base is destroyed (respawn, elimination, penalties)? | Undefined; "one base per player" only |
| A6 | ✅ | Resource deposits: finite or infinite, regenerate? | Finite, no regen (GD §14.1, §20.5) |
| A7 | ✅ | Resource set (gold, iron, oil, crystal, stone, wood) and spawn probabilities (currently flat 20 % "resource") | 💡 GD §9.1 |
| A8 | ✅ | Bot collision: do bots block cells, can they push/attack blockers; one entity per cell? | One entity per cell (GD §14.1, §20.7) |
| A9 | ✅ | Coordinates: 2D only, or is `z` (GPS `{x,y,z?}`) a real dimension? | 2D grid (GD §10.2) |
| A10 | ✅ | Bot security model: passwords, other protocols, brute-force/hacking mechanics, attempt costs, which modules are needed (spawned by A5) | Owner: brute-force password "or other things if set up in the bot" |
| A11 | ✅ | Repair ("fixing") module: functions, speed, cost, resource use, can it repair ordinary bots/modules too, restoration time of a corpse base (spawned by A5) | Exists; mechanics open |
| A12 | ✅ | Stale bots: do their scripts keep running? who owns them? is the former owner locked out? decay/despawn? (spawned by A5) | Unaffiliated with new base; otherwise open |
| A13 | ✅ | When does a base become a corpse base under the no-death model (e.g. wireless adapter broken? all modules disassembled? factory lost?) — conflicts with A5/B1 loot wording (spawned by C9) | Open |
| A14 | ✅ | Base protection and capture: do new bases get a mandatory password, can a live base be brute-forced and claimed, what does capturing a base do to its owner and to the 'one living base' rule (spawned by A10) | Open |

## B. Economy & progression

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| B1 | ✅ | Blueprint acquisition: found / researched / awarded / traded | Open (GD §20.1) |
| B2 | ✅ | Recipes, costs, craft times | Placeholder numbers (GD §9.3) |
| B3 | ✅ | Base kit has no processor / memory / wireless adapter, yet the base runs a terminal and scripts — contradiction | 💡 GD §6.1 note |
| B4 | ✅ | Progression stages & balance | 💡 GD §16 |
| B5 | ✅ | Blueprint details: research costs/times per class, world drop chances, loot rules from destroyed bots/bases, is a looted blueprint consumed or copied (spawned by B1) | Mixed model decided; numbers open |

## C. Hardware & simulation rules

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| C1 | ✅ | Processor model: ops/tick and parallel executions per tier | Open (GD §20.3) |
| C2 | ✅ | Energy model: per tick vs. per operation, generator vs. capacity | Both; open (GD §20.4) |
| C3 | ✅ | Memory / drive model: capacity limits, are files DB documents or bot-local storage | Open (GD §20.9) |
| C4 | ✅ | Weight → speed / range formula | 💡 GD §8.5 |
| C5 | ✅ | Minimum bot assembly requirements | processor + control block + power (+ mobility) 💡 GD §8.2 |
| C6 | ✅ | Combat: damage/armor/accuracy resolution, artillery/splash, module damage & repair | Open (GD §20.6) |
| C7 | ✅ | Communication range for `connect` / `sendMessage` / `ping` | Open (GD §20.8) |
| C8 | ✅ | Spawn location of base ("semi-random") and of assembled bots ("adjacent to base") | GD §5, §8.3 |
| C9 | ✅ | Bot destruction: when is a bot dead (control block lost? all modules?), what drops as loot (modules, storage items, blueprints), wreck/corpse for ordinary bots (spawned by C6) | Open |
| C10 | ✅ | Disassembly & repair mechanics: who/what can disassemble (repair module? separate module?), scrap/resource yields, repair threshold and speed, time and energy cost, can a soft-deleted memory be recovered by repairing it, how blueprints/storage items are looted (spawned by C9) | Open |

## D. Runtime, scheduler & sandbox

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| D1 | ✅ | Tick rate | 10 ticks/s (GD §12.2, §20.2) |
| D2 | ✅ | Scheduler algorithm (player-interleaved round-robin, ops budget) | 💡 GD §12.2 |
| D3 | ✅ | Sandbox technology (`isolated-vm` vs `vm` vs Worker threads) | `isolated-vm` leaning (Plan 5.2) |
| D4 | ✅ | Script language & file contract: JS only, `main(bot, ...args)` export | GD §10.1 |
| D5 | ✅ | API return convention `{ok, data}` / `{ok:false, code}` and function list/signatures | 💡 GD §10.2–10.3 |
| D6 | ✅ | Determinism: collect-then-apply per tick, seeded RNG | 💡 GD §12.4 |
| D7 | ✅ | Concurrency mechanism: Mongo transactions / optimistic versioning / per-cell queues (Mongo transactions need a replica set) | 💡 GD §14.2 |
| D8 | ✅ | Running executions across server restart / crash: persisted, resumed or killed? | Undefined |
| D9 | ✅ | Single authoritative game-loop process vs. horizontal scaling (conflicts with Plan 7.1) | Undefined |
| D10 | ✅ | Threading topology: where the tick coordinator, world mutations and QuickJS contexts run (spawned by D3) | Proposed: API thread / simulation thread / script worker pool |
| D11 | ✅ | Script tooling details: TS transpiler choice, can imports cross drives, bundle/resolve on every run or cache, editor typings/autocomplete for the `bot` API, per-file size limit (spawned by D4) | Open |

## E. Terminal & UI

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| E1 | ✅ | Final BotOS command set (merge of 2024 + 2026 notes) | GD §11.1 |
| E2 | ✅ | Terminal session log retention | Open (GD §20.14) |
| E3 | ✅ | GUI scope: observe-only map vs. any direct commands from GUI; map palette; click-cell behavior | 💡 GD §4.3, §15 |
| E4 | ✅ | Desktop-only or mobile support | Undefined |
| E5 | ✅ | Micromanagement categories: the list, which actions belong to which, defaults (spawned by E3) | Examples only: movement, combat, mining, logistics, fabrication, communication |
| E6 | ✅ | Precedence of global vs personal category switches (can a player enable what the game disabled? is it an allowlist/ceiling?) (spawned by E3) | Open |
| E7 | ✅ | Do manual actions consume the processor `opsPerTick` budget / need a processor, or only energy and cooldowns? Manual-vs-script fairness and anti-APM concerns (spawned by E3) | Open |

## F. Engineering & process

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| F1 | ✅ | Client test runner: Vitest vs Jest | "Vitest (or Jest)" (Plan 2.1) |
| F2 | ✅ | Monorepo tooling: npm workspaces vs. separate installs | "or" (Plan 0.3) |
| F3 | ✅ | 97 % coverage gate scope (incl. client, UI, sandbox code?) | Global (AGENTS §6.1) |
| F4 | ✅ | Email provider (hardcoded Gmail SMTP) & deploy target (PM2 host) | Current code |
| F5 | ✅ | Story-point estimates & phase order (stabilize/refactor/tests before features) | Plan summary |

## G. New feature requests (added after the first pass)

| # | Status | Uncertainty | Current assumption (where) |
| --- | --- | --- | --- |
| G1 | ✅ | Skippable tutorial for new players: form, content, where progress is stored, replay. **Reverses B4** ("no tutorial/quests") | Requested; undefined |
| G2 | ✅ | Public API with API keys so developers can build their own clients: scope, key model, scopes/permissions, rate limits, docs, versioning | Requested; undefined |
| G3 | ✅ | MCP server so an AI can play as a regular player: tools exposed, auth (via G2 keys), fairness/limits, packaging | Requested; depends on G2 |
| G4 | ✅ | Spawn seeds so several players can spawn near each other: seed model, distance rules (conflicts with C8's 30-cell minimum), abuse limits | Requested; undefined |

## Resolution log

- **A1** — Endless sandbox; no victory condition, seasons, resets or leaderboard. → GD §1 (Goal), §16, §20; Plan guiding principle 0.
- **A2** — Unbounded procedural world, no border, negative coords, sparse storage. → GD §4.1, §20; Plan 3.3.
- **A3** — Scripts/bots always run, online or offline; offline bases can be attacked. → GD §1, §12.2, §20; Plan 5.4, 7.4.
- **A4** — Fog of war private per player; no alliances in v1. → GD §4.2, §20.
- **A5** — Destroyed base becomes a corpse base keeping the owner name; owner loses control, may only deploy a new base; old bots become stale and are not auto-affiliated; stale bots can be taken over by bypassing security; own corpse is repairable by bots with a repair module. → GD §5, §6.3, §7.2; Plan 3.10, 4.8 (+10 SP, total 322). Spawned A10, A11, A12.
- **A6** — Deposits finite, no regeneration; cell empties at zero. → GD §9.1, §20; Plan 3.1.
- **A7** — Six resources (gold, iron, oil, crystal, stone, wood) with rarity tiers and data-driven balance config; initial weights are tunable defaults. → GD §9.1; Plan 3.1.
- **A8** — One solid entity per cell (bots, bases, corpses, deposits); items non-blocking; no pushing/ramming; deposits worked from adjacent cell. → GD §4.1, §20; Plan 5.5.
- **A9** — World is 2D; `z` stays reserved in the type, unused. → GD §4.1, §10.2.
- **B1** — Blueprints: base set (class 1) + factory research + found in world / looted from destroyed bots & bases (PvP). → GD §9.3, §20; Plan 4.4, 4.9 (+5 SP, total 327). Spawned B5.
- **B2** — Recipes are data-driven config; current table = initial defaults, balance TBD after playtesting. → GD §9.3; Plan 4.4.
- **B3** — Base starter kit includes class-1 processor, memory and wireless adapter (no special-cased root OS); their stats come from C1/C3/C7. → GD §6.1; Plan 3.9.
- **B4** — Progression stages dropped; no tutorial/quests; players self-discover. → GD §16.
- **C1** — Processor = `opsPerTick` (API calls/tick, per-function cost default 1) + `parallelExecutions`; plain JS free but wall-clock capped; class-1 default 2 ops / 1 slot, tunable. → GD §12.2.1, §7.2, §20; Plan 5.1, 5.4.
- **C2** — Energy: per-tick idle drain + per-action drain; battery clamped; generator refills per cycle up to capacity; empty battery suspends executions. → GD §12.5, §20; Plan 4.3.
- **C3** — Each memory module (`drive` type) is its own drive with a byte quota (class-1 = 64 KB); files live in MongoDB; editor is a view. Docs fixed: `drive` = disk, wheels/tracks = `movement`. → GD §6.1, §7.2, §11.4, §20; Plan 3.6.
- **C4** — Movement: needs engine + chassis and totalWeight <= loadCapacity; ticksPerCell = clamp(ceil(totalWeight/engine.speed),1,max); terrain moved to backlog (GD §21). → GD §8.5, §21; Plan 4.5.
- **C5** — Assembly rules accepted (processor + wireless adapter + battery for all; engine + chassis for mobile). Physical port module (wired connection) added to backlog. → GD §8.2, §21; Plan 4.5.
- **C6** — Combat: range/cooldown/ammo gate, seeded hit roll with accuracy falloff, damage minus armor to a random module, artillery arc + half-damage splash. → GD §12.6, §20; Plan 4.2. Spawned C9.
- **C7** — Adapter range in cells (Chebyshev, class-1 = 20), relay chains via the player's own bots, link loss → "Connection interrupted". → GD §6.1, §11.2.1, §20; Plan 6.5.
- **C8** — Base spawn on free cell ≥ 30 cells from all bases/corpses within a growing ring; assembled bots spawn on a free adjacent cell. → GD §4.1, §8.3; Plan 3.11 (+3 SP, total 330).
- **C9** — Bots are never dead: broken modules stop working (processor → no scripts, memory → files inaccessible, adapter → no connections), repairable above a threshold by another bot's repair module, disassemblable into scrap (removed from DB); module-less bot keeps record with lastPosition and no map reference. → GD §8.4.1; Plan 4.10 (+5 SP, total 335). Spawned C10, A13.
- **D1** — Tick rate 10/s (100 ms) default, configurable (`tickIntervalMs`); ms timings converted to ticks; revisit after load tests. → GD §12.2, §20; Plan 5.1.
- **D2** — Scheduler: per-bot opsPerTick (no carry-over), seeded player shuffle each tick, wall-clock slice per execution, global tick cap with round-robin resume. → GD §12.2; Plan 5.4.
- **D3** — Sandbox = QuickJS (WASM) behind a `ScriptRuntime` interface; Node `vm` rejected; isolated-vm not chosen. → GD §13; Plan 5.2. Spawned D10.
- **D10** — MVP threading: API thread + one engine thread (tick loop, world, QuickJS, DB writes); scripts only queue commands; pool-ready boundary; capacity estimate ~hundreds–1000 active bots pending benchmark. → GD §12.2.2; Plan 5.1, 5.4a (+8 SP, total 343).
- **D6** — Deterministic collect-then-apply, seeded shuffle + RNG, no clock/Math.random in scripts; guarantee scoped to command list (wall-clock preemption may vary). → GD §12.4; Plan 5.5.
- **D7** — Single-writer engine: conflicts resolved in memory, no transactions/replica set; all world changes (incl. API requests) go through engine commands; batched write-behind. → GD §14.2; Plan 5.5.
- **D9** — One authoritative engine process; API tier scales horizontally; chunk-addressed map; region sharding in backlog. → GD §12.2.2, §21; Plan 7.1.
- **D8** — Execution records durable; world flushed every 1 s; running executions auto-relaunched from start of `main` after restart (state lost, "rebooted" log note); crash-loop guard kills repeat offenders. → GD §12.3.1; Plan 5.4a.
- **D4** — Scripts: JS + TypeScript (transpile only) + local imports from the bot's filesystem; entry `async main(bot, ...args)`; file types `.js/.ts/.json/.txt`. → GD §10.1.1, §11.1; Plan 3.6, 5.8 (+8 SP, total 351). Spawned D11.
- **D5** — API calls return `Result<T>` ({ok,data} / {ok:false,code,msg}) with a typed error-code set; only misuse/sandbox violations throw; callback interfaces migrated. → GD §10.3; Plan 5.3.
- **A13** — Corpse base = base the owner lost control of (derived): no working wireless adapter / no modules / taken over (A10); repairing the adapter restores control; broken processor alone = crippled, not corpse. → GD §6.3, §8.4.1.
- **A10** — Per-bot optional access password, brute-force through the API (ops/energy cost, logs, lockout), `claim` transfers ownership; no hacking modules for now; default = no password. → GD §6.3, §11.2.2; Plan 5.9 (+5 SP, total 356). Spawned A14.
- **A14** — Bases cannot be claimed; mandatory owner-set password at deploy; foreign authentication on a base gives a terminal only. A13's takeover clause removed. → GD §5, §11.2.2; Plan 3.8, 5.9.
- **A12** — Stale bots keep running, no decay, appear in no registry; anyone who gets access can `adopt` them into their own base. **Model change:** ordinary bots belong to a base (`baseId`); only bases belong to a user (`userId`); `claim` renamed `adopt`. → GD §6.3, §8.1, §11.2.1–2, glossary; Plan 3.4, 3.10, 5.9.
- **A11 + C10** — One `repair` module: `repair()` (needs condition ≥ 20 % of max, consumes scrap) and `disassemble()` (30–50 % of recipe resources as scrap); both on an adjacent bot's module; disassembly only of broken modules or the actor's own. Blueprint loot stays in B5. → GD §7.2, §8.4.1–2, §10.2; Plan 4.8, 4.10.
- **B5** — Research = 5× recipe cost, 10× time; blueprint items on ~1 % of new empty cells; 10 % chance per disassembled module; blueprint item consumed on `learn`, tradable until then; corpse bases drop none. → GD §9.3; Plan 4.9.
- **D11** — Sucrase-style type-stripping transpiler (no type-check), same-drive relative imports, graph resolved at start with content-hash cache, editor typings via `.d.ts`, limits 32 KB / 20 files / depth 5. → GD §10.1.1; Plan 5.8 (+2 SP, total 358).
- **E1** — Final command set = unified set + `passwd`, `adopt`, `learn`, and factory commands `craft`/`assemble`/`research` (also script-API functions); MVP core subset first. → GD §9.3, §10.2, §11.1; Plan 3.7, 4.6 (+3 SP, total 361).
- **E2** — Session logs 30 days, max 5,000 lines/bot, security events 90 days, TTL index. → GD §11.2.3, §20; Plan 7.4.
- **E3** — All micromanagement is available by hand from the GUI; scripts automate on top; the UI is split into categories switchable in global game settings and personal profile settings. Pillar 'no manual control' reversed. → GD intro, §1, §4.3, §15, §15.1; Plan 6.7, 6.8 (+13 SP, total 374). Spawned E5, E6, E7.
- **E5** — Seven categories by module role (movement, combat, extraction, logistics, fabrication, maintenance, communication); observation always on; default all on. → GD §15.1; Plan 6.7.
- **E6** — Global switches are a ceiling; personal switches can only narrow; enforced server-side in the engine; scripts unaffected. → GD §15.1; Plan 6.8.
- **E7** — Manual actions follow the same rules as script calls, including processor `opsPerTick`; no separate manual budget. → GD §15.1; Plan 6.7.
- **E4** — Desktop-first; no mobile layout in v1; read-only mobile view in backlog. → GD §1, §21.
- **F1** — Jest for both api and client (no Vitest); Cypress for e2e (already required in AGENTS.md §2, §6.4, DoD). → AGENTS §2; Plan 2.1.
- **F2** — npm workspaces for api/client/lib. → Plan 0.3, README.
- **F3** — 97 % gate per package (api, client) on all logic and components; exclusions only for entry/bootstrap, config, type-only, generated; one justified list. → AGENTS §6.1; Plan 2.2.
- **F4** — SMTP configurable via env behind an `EmailSender` interface (Gmail dev default); MVP deploy = Linux host + PM2; Docker/compose in Phase 7. → Plan 0.2, 7.7 (+3 SP, total 377).
- **G1** — Skippable guided in-game checklist tutorial, no rewards, progress in profile, reopenable. B4's "no tutorial" revised accordingly. → GD §16, §16.1; Plan 6.9 (+5 SP, total 382).
- **G2** — Versioned `/api/v1` REST + WS over the same commands as the official client; per-player API keys (hashed, shown once, narrowing scopes, rate limit, revocable); same game rules; OpenAPI published; no admin/account ops via keys. → GD §22.1; Plan 7.9, 7.10 (+16 SP, total 398).
- **G3** — Separate `mcp/` package over `/api/v1` with the player's API key; tools mirror the game; AI = regular player with the same rules, restricted keys possible; no AI labelling; stdio + streamable HTTP. → GD §22.2; Plan 7.11 (+8 SP, total 406).
- **G4** — Group seed codes: anchor from first deploy, spawn within 12 cells, 30-cell exemption only among same-seed bases, max 8 players, 24 h expiry, no gameplay bonus. → GD §4.1, §22.3; Plan 3.11 (+2 SP, total 408).
- **G2 (amended)** — The official client is built on the same `/api/v1` as custom clients (no private endpoints); two auth methods (JWT session for the official client, API keys for third parties/MCP); all new endpoints created under `/api/v1` from the start. → GD §22.1; AGENTS §3.0; Plan 3.12 (new, 5 SP), 7.10 reduced to 3 SP (total unchanged, 408).
- **F5** — Plan order unchanged; the MVP is the whole plan, Phases 0–7 (408 SP), with no intermediate milestone. → Plan "MVP definition".
