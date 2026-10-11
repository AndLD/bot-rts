// Tunable numbers of where players start (design §4.1, §22.3); configuration, not game code (AGENTS.md §9)
export interface SpawnConfig {
  // A new base keeps at least this many cells (Chebyshev distance) from every living and corpse base
  minBaseDistance: number
  // How many random cells are tried before a spawn fails
  attempts: number
  // Candidates are drawn inside a square around the origin of this half-width, plus `radiusPerBase` for every base
  radius: number
  radiusPerBase: number
  // Spawn seeds: how far from the anchor later players start, how many players one seed takes, and how long it stays open
  seedRadius: number
  seedMaxPlayers: number
  seedTtlHours: number
}

export const SPAWN_CONFIG = Symbol('SpawnConfig')

export const DEFAULT_SPAWN_CONFIG: SpawnConfig = {
  minBaseDistance: 30,
  attempts: 50,
  radius: 60,
  radiusPerBase: 10,
  seedRadius: 12,
  seedMaxPlayers: 8,
  seedTtlHours: 24
}
