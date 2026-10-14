import type { ICraftingBalance, IRecipe } from './interfaces/crafting'
import type { IResourceBalance } from './interfaces/resources'

// The balance of the game that an admin can change from the console (design §25.3, Economy and balance). A document holds only
// what differs from the defaults of the server: a partial resource, a partial recipe, some crafting numbers.
export interface IBalanceDocument {
  // By resource name (iron, stone, …)
  resources?: Record<string, Partial<IResourceBalance>>
  // By the name of the module the recipe makes
  recipes?: Record<string, Partial<IRecipe>>
  crafting?: Partial<ICraftingBalance>
}

export interface IBalanceChange {
  // Where it is, like `resources.iron.spawnWeight`, `recipes.scanner-class1.craftTimeMs` or `crafting.repairThreshold`
  path: string
  // The values as text; null where one side does not have the path
  from: string | null
  to: string | null
}

export interface IBalanceValue {
  path: string
  value: string
}

export interface IBalanceVersion {
  version: number
  reason: string
  createdBy: string
  // Milliseconds since the epoch
  createdAt: number
  isActive: boolean
}

export interface IBalanceState {
  // The version stored as active, and the one this server runs with (they differ until the server restarts)
  activeVersion: number | null
  runningVersion: number | null
  // Why the stored version could not be used when the server started, if it could not
  problem: string | null
  // The document of the active version, as JSON text for the editor
  documentJson: string
  // What the game uses with that document: the defaults with it laid over them, flattened to paths
  effective: IBalanceValue[]
  versions: IBalanceVersion[]
}

export interface IBalancePreview {
  problems: string[]
  changes: IBalanceChange[]
}

// The global switches of the categories of manual control are part of the same page
export interface IEconomyStat {
  resource: string
  // Deposits on the map, how many are used up, and what is left in them against what they held when generated
  deposits: number
  depleted: number
  remaining: number
  capacity: number
  // What the bases and bots carry
  stored: number
}

export interface IBlueprintStat {
  module: string
  research: number
  item: number
}

export interface IModuleStat {
  type: string
  name: string
  count: number
}

export interface IEconomyOverview {
  resources: IEconomyStat[]
  blueprints: IBlueprintStat[]
  modules: IModuleStat[]
}
