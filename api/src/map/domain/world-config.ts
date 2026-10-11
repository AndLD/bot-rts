// Tunable world-generation numbers (AGENTS.md §9): they live in configuration, not in game code
export interface WorldConfig {
  // Probability that a freshly generated cell holds a resource
  resourceChance: number
  // A new base appears within this distance (inclusive) of the origin on both axes
  spawnMaxDistance: number
  // How many random cells are tried before a base spawn fails
  spawnAttempts: number
}

export const WORLD_CONFIG = Symbol('WorldConfig')

export const DEFAULT_WORLD_CONFIG: WorldConfig = {
  resourceChance: 0.2,
  spawnMaxDistance: 10,
  spawnAttempts: 20
}
