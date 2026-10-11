import { IItem } from './items'
import { IResourceStack, RESOURCE } from './resources'

// What it takes to build one module at a factory (design §9.3). Data, not logic: tuned in configuration.
export interface IRecipe {
  // The name of the module in the catalog, e.g. `scanner-class1`
  module: string
  // 1 for the base set every player knows from the start; higher classes are researched
  classLevel: number
  resources: IResourceStack[]
  // Time the factory needs, in ms
  craftTimeMs: number
}

// A piece of production the factory of a base works on, done at `readyAt` (ms)
export interface IFactoryJob {
  kind: 'craft' | 'research'
  module: string
  readyAt: number
}

// What the factory of a base holds for its owner
export interface IFactoryStatus {
  // The game clock when the status was taken, in ms
  now: number
  jobs: IFactoryJob[]
  // Finished modules, ready to be assembled into a bot
  parts: IItem[]
  // Blueprints found or looted, not yet learned
  blueprintItems: IItem[]
}

// Where a player's knowledge of a blueprint came from (the base set is known without a record)
export enum BlueprintSource {
  RESEARCH = 'research',
  ITEM = 'item'
}

// A blueprint a player has learned
export interface IBlueprint {
  userId: string
  module: string
  source: BlueprintSource
}

// The most modules one craft order may ask for
export const MAX_CRAFT_COUNT = 100

// The tunable numbers of crafting and research (design §9.3)
export interface ICraftingBalance {
  // Research costs this many times the resources of the target recipe …
  researchCostFactor: number
  // … and this many times its craft time
  researchTimeFactor: number
  // Chance that a newly generated empty cell holds a blueprint item
  worldBlueprintChance: number
  // Chance that disassembling a module also yields a blueprint item for its class
  lootBlueprintChance: number
  // A module can be repaired while its condition is at least this share of its maximum; a broken one (0) can be
  // repaired as well, anything in between is too far gone and can only be disassembled (design §8.4.2)
  repairThreshold: number
  // Repairing a module completely costs this share of its recipe resources; a partial repair costs less in proportion
  repairCostFactor: number
  // Disassembly yields a random share of the recipe resources, between these two
  scrapMinShare: number
  scrapMaxShare: number
}

export const DEFAULT_CRAFTING_BALANCE: ICraftingBalance = {
  researchCostFactor: 5,
  researchTimeFactor: 10,
  worldBlueprintChance: 0.01,
  lootBlueprintChance: 0.1,
  repairThreshold: 0.2,
  repairCostFactor: 0.5,
  scrapMinShare: 0.3,
  scrapMaxShare: 0.5
}

const stack = (resource: RESOURCE, amount: number): IResourceStack => ({ resource, amount })
const { IRON, OIL, CRYSTAL, GOLD } = RESOURCE

// Initial defaults, balance TBD after playtesting (design §9.3). Class-1 recipes are the base set.
export const DEFAULT_RECIPES: readonly IRecipe[] = [
  { module: 'scanner-class1', classLevel: 1, resources: [stack(IRON, 20), stack(CRYSTAL, 5)], craftTimeMs: 10_000 },
  { module: 'gun-class1', classLevel: 1, resources: [stack(IRON, 50)], craftTimeMs: 20_000 },
  { module: 'engine-class1', classLevel: 1, resources: [stack(IRON, 30), stack(OIL, 10)], craftTimeMs: 15_000 },
  { module: 'wheels-class1', classLevel: 1, resources: [stack(IRON, 25)], craftTimeMs: 10_000 },
  { module: 'drill-class1', classLevel: 1, resources: [stack(IRON, 40), stack(CRYSTAL, 10)], craftTimeMs: 20_000 },
  { module: 'battery-class1', classLevel: 1, resources: [stack(IRON, 20), stack(CRYSTAL, 15)], craftTimeMs: 15_000 },
  { module: 'storage-class1', classLevel: 1, resources: [stack(IRON, 30)], craftTimeMs: 10_000 },
  { module: 'memory-class1', classLevel: 1, resources: [stack(CRYSTAL, 10)], craftTimeMs: 10_000 },
  { module: 'processor-class1', classLevel: 1, resources: [stack(CRYSTAL, 25), stack(GOLD, 10)], craftTimeMs: 25_000 },
  {
    module: 'wireless-adapter-class1',
    classLevel: 1,
    resources: [stack(CRYSTAL, 15), stack(GOLD, 20)],
    craftTimeMs: 20_000
  },
  { module: 'armor-class1', classLevel: 1, resources: [stack(IRON, 35)], craftTimeMs: 15_000 },
  { module: 'generator-class1', classLevel: 1, resources: [stack(IRON, 30), stack(CRYSTAL, 5)], craftTimeMs: 15_000 },
  { module: 'manipulator-class1', classLevel: 1, resources: [stack(IRON, 25), stack(CRYSTAL, 5)], craftTimeMs: 15_000 },
  { module: 'gps-class1', classLevel: 1, resources: [stack(CRYSTAL, 10), stack(GOLD, 5)], craftTimeMs: 15_000 },
  { module: 'repair-class1', classLevel: 1, resources: [stack(IRON, 30), stack(CRYSTAL, 5)], craftTimeMs: 15_000 },
  { module: 'factory-class1', classLevel: 1, resources: [stack(IRON, 60), stack(CRYSTAL, 20)], craftTimeMs: 30_000 },
  { module: 'scanner-class2', classLevel: 2, resources: [stack(IRON, 40), stack(CRYSTAL, 15)], craftTimeMs: 20_000 },
  { module: 'gun-class2', classLevel: 2, resources: [stack(IRON, 100), stack(CRYSTAL, 10)], craftTimeMs: 40_000 },
  { module: 'drill-class2', classLevel: 2, resources: [stack(IRON, 80), stack(CRYSTAL, 30)], craftTimeMs: 40_000 },
  { module: 'battery-class2', classLevel: 2, resources: [stack(IRON, 40), stack(CRYSTAL, 40)], craftTimeMs: 30_000 }
]
