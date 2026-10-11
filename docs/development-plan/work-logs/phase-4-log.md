[← Phase 4 — Module system & crafting](../phase-4-modules-crafting.md)

# Phase 4 — Module system & crafting — work log

Append-only log used to resume the phase in a new session (AGENTS.md §7.6). Newest entry at the bottom. Add an entry
whenever a session ends or pauses, or a task finishes; commit it in the same pull request as the work.

## Entry template

```markdown
### YYYY-MM-DD — short summary
- **Tasks:** x.y, x.z
- **Branch:** `feature/x.y-slug` — done | WIP (what remains, what is uncommitted/unpushed)
- **Decisions / deviations from the plan:** …
- **Problems / blockers / findings:** …
- **Next step:** the exact next action
- **Verify with:** commands that show the current state is healthy
```

## Entries

### 2026-10-12 — task 4.1: module behaviour classes
- **Tasks:** 4.1
- **Branch:** `feature/4.1-module-behaviours` — done
- **Decisions / deviations from the plan:** `Result<T>` / `ResultCode` / `ok` / `fail` live in `lib/utils/result.ts` (the closed code set of design §10.3). The script-facing `IModule*` interfaces in `lib/utils/interfaces/modules.ts` now return `Promise<Result<T>>` (callbacks removed). The domain classes in `api/src/modules/domain/game-module.ts` carry the typed props and the **pure rules** that return a `Result` (`ensureWorking`, `BatteryModule.discharge/charge`, `StorageModule.add/remove`, `MiningModule.extract`); the world-bound async calls (`move`, `shoot`, `scan`, …) are bound to a bot by the engine in phase 5, so the interfaces describe them and the classes do not implement them yet. New type `movement` (wheels/tracks) and the catalog entries `engine-class1`, `wheels-class1`, `drill-class1`, `manipulator-class1`, `gps-class1`; `PlainModule` is gone, every type has its own class.
- **Next step:** task 4.2 (`WeaponModule` shoot/aim/reload rules and scanner polish).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 4.2: weapon and scanner rules
- **Tasks:** 4.2
- **Branch:** `feature/4.2-weapon-scanner` — done
- **Decisions / deviations from the plan:** `WeaponModule` and `ScannerModule` moved into `weapon-module.ts` / `scanner-module.ts`. Weapon rules (`aim`, `shoot`, `reload`, `hitChance`, `resolve`, `damageAgainst`) follow design §12.6 and return a `Result`; a shot returns a `Shot` with its energy cost and the state `patch` (`loaded`, `readyAt`) for the caller to store; `CombatBalance` (`minDamage`, `accuracyFalloff`) is passed in, the engine injects the configured values in phase 5. Ammunition is a magazine (`magazine` / `loaded` props of the weapon); where the ammunition in the storage comes from is decided with the weapon commands. The scanner has a cooldown (`readyAt`), an area-scaled `energyCost` (`operationCost` × cells of the square), and live mode rules (`enable` / `disable` / `view`, `scan` is `BUSY` while live); the live-area machinery stays in 5.12. `ScanService.scan` now enforces cooldown / broken / live and stores the cooldown (new `ModuleRepository.update`); a failed `Result` becomes an `ActionFailedError` (`unwrap`) with the result code as the API error code, so `ErrorCode` now includes every `ResultCode` and `errors.*` has English messages for them (the Russian catalogue is still a placeholder until phase 7). Armor got a `protection` prop.
- **Not done here, by design:** deducting the scan energy from the battery is task 4.3 (the energy accounting); refreshing the cell an action touched (design §4.2) comes with the actions themselves (4.6 commands / phase 5 engine), `MapService.observe` over one cell already does it.
- **Next step:** task 4.3 (energy accounting).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 4.3: energy accounting
- **Tasks:** 4.3
- **Branch:** `feature/4.3-energy-accounting` — done
- **Decisions / deviations from the plan:** `EnergyModel` (`modules/domain/energy-model.ts`) is a stateless domain service over a bot's module records: `stored` / `capacity` / `isDepleted`, `spend` (operation drain, `NO_ENERGY` leaves the batteries untouched) and `tick(records, now, ticks)`, which in this order drains the idle cost of the working modules (clamped at zero), runs the enabled generators, charges every live scanner its refresh (`energyCost`) or switches it off, and reports `EnergyLow`, `OutOfFuel` and `LiveScanStopped` events (typed `ENERGY_EVENT`; the consumers are design §24). A generator runs `floor(elapsed / delay)` cycles from its `lastCycleAt`, never more than the battery has room for or the oil allows; each cycle burns `fuelPerCycle` oil from the working storages and adds `energyPerCycle` (12 energy for 0.02 oil, the placeholder of design §12.5; the old `energyPerOperation` prop is renamed). `GeneratorModule.enable(now)` restarts the cycle clock so a generator that was off does not catch up. The base's storage starts with 50 oil and its generator enabled. `EnergyService` persists the changed records (`pay`, `tick`); `ScanService` now pays the scan energy. `lowThreshold` (10 %) is the only balance number; it is a constructor argument, the engine injects configured values in phase 5.
- **Not done here, by design:** nobody calls `EnergyService.tick` yet, the engine's tick loop does in phase 5 (5.x); until then the batteries only drain by operations. Suspending running executions on an empty battery needs the runtime (5.4).
- **Next step:** task 4.4 (blueprints and recipes).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 4.4: recipes, blueprints and items
- **Tasks:** 4.4
- **Branch:** `feature/4.4-blueprints-recipes` — done
- **Decisions / deviations from the plan:** new `crafting` Nest module. `DEFAULT_RECIPES` and `DEFAULT_CRAFTING_BALANCE` (research ×5 cost / ×10 time, 1 % world blueprints, 10 % loot) live in `lib/utils/interfaces/crafting.ts`; `CRAFTING_RECIPES_FILE` overrides recipes by module name and the balance, and `validateRecipes` (every catalog module has exactly one recipe, positive numbers, a class above 1 has the class below) stops the start with a `ConfigError` on a bad file. Added defaults for the modules the design table does not price (armor, generator, manipulator, gps, factory) and four class-2 modules (scanner, gun, drill, battery) with catalog entries, so research has something to reach. `RecipeBook` is the domain lookup (`known`, `previousClass`, `researchCost`). Persistence: tables `blueprints` (per player, composite key; the class-1 base set needs no row) and `items` (type, name = the module of a blueprint item, `botId` when carried; an item on the map is a map point of type item pointing at it), migration `blueprints_and_items`, `Prisma*` repositories with integration tests. `GET /api/v1/crafting/recipes` shows each recipe with `isKnown`, `canResearch` and the research cost. Blueprint items still have no way into the world or a storage: spawning them is 4.9, learning them 4.6.
- **Findings:** the local development database had a stale migration history (a phase-3 migration was renamed), so the migration SQL was produced with `prisma migrate diff` against the previous schema instead of `migrate dev`; CI and the tests apply the migrations from scratch.
- **Next step:** task 4.5 (bot assembly rules and the movement rule).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 4.5: bot assembly and the movement rule
- **Tasks:** 4.5
- **Branch:** `feature/4.5-bot-assembly` — done
- **Decisions / deviations from the plan:** `bots/domain/assembly.ts` (`validateAssembly`: processor, wireless adapter and battery are required; a bot with an engine or a chassis needs both and a chassis that carries it) and `bots/domain/movement.ts` (`movementOf`: working engine and chassis, `totalWeight` ≤ the chassis `loadCapacity`, `ticksPerCell = clamp(ceil(weight / speed), 1, maxTicksPerCell)`; `MovementBalance.maxTicksPerCell` = 20 is a constructor argument the engine configures in phase 5). New result code `TOO_HEAVY`. **Crafted modules are `part` items** of the base (`ItemType.PART`, `name` = the catalog module): crafting (4.6) will produce them, `AssemblyService.assemble` turns the chosen parts into the modules of a new bot next to the base and removes them in the same transaction (`createBot` got `consumedItemIds`, the unit of work got the `items` repository). Assembly needs a working factory on the base and parts the base holds.
- **Not done here, by design:** no endpoint, socket event or terminal command yet; those come with 4.6, where the factory also gets the craft and research operations.
- **Next step:** task 4.6 (crafting API, sockets, terminal commands).
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

### 2026-10-12 — task 4.6: factory API, sockets and terminal commands
- **Tasks:** 4.6
- **Branch:** `feature/4.6-crafting-api` — done
- **Decisions / deviations from the plan:** `FactoryService` (`bots/application`) is the one use case behind every transport — `craft`, `research`, `learn`, `status` (and `AssemblyService.assemble`); the REST controller (`/api/v1/bots/:baseId/factory`: `GET`, `POST craft | research | learn | assemble`), the socket gateway (`get-factory`, `craft-module`, `research-module`, `learn-blueprint`, `assemble-bot`) and the terminal commands (`recipes`, `factory`, `craft`, `research`, `learn`, `assemble`) are thin callers. Script bindings arrive with the runtime in 5.5: `IFactoryModule` in `lib` already has the `Promise<Result<…>>` signatures (`craft`, `assemble`, `research`, `learn`). **Time without a scheduler:** the factory keeps a queue in its `jobs` prop (`FactoryModule.enqueue` / `settle`), each job done at a `readyAt` on the injected clock; jobs are settled lazily at the next factory operation or status read (crafted modules become `part` items, researched blueprints become known). Resources (`storage-stock.ts`, `withdrawStacks`, shared with the generator's oil) and the factory's `operationCost` energy are paid when the order is placed, all in one transaction; the unit of work now has `blueprints` too. New result code `NO_BLUEPRINT`; `Blueprint` carries `learnedAt`. `status` reports the game clock (`now`) so a client can show the time left.
- **Open points:** the starter storage (200) is too small to hold the resources of a research (5× a class-2 recipe); more storage modules, or balance, is a playtest topic. A craft order's modules appear as parts only after the queue time passes, so the e2e flow in 4.7 moves the factory's `readyAt` in the database as the HTTP integration test does.
- **Next step:** task 4.7 (unit + integration + e2e for fabrication and maintenance through the terminal commands). Maintenance (repair, disassemble, corpse-base restoration) needs 4.8 and 4.10 first; 4.7 covers what exists and is completed after them.
- **Verify with:** `npm run typecheck && npm run test:coverage -w api`

