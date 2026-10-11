import { DEFAULT_RESOURCE_BALANCE, ResourceBalance } from '../../../../lib/utils/interfaces/resources'

// Tunable world-generation numbers (AGENTS.md §9): they live in configuration, not in game code
export interface WorldConfig {
  // Side of a map chunk in cells: the unit the map is generated and (later) sharded by (design §12.2.2)
  chunkSize: number
  // Probability that a freshly generated cell holds a resource
  resourceChance: number
  // Spawn weight, deposit size and hardness per resource (design §9.1)
  resources: ResourceBalance
}

export const WORLD_CONFIG = Symbol('WorldConfig')

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  chunkSize: 16,
  resourceChance: 0.2,
  resources: DEFAULT_RESOURCE_BALANCE
}
