import { DEFAULT_SPAWN_CONFIG, SpawnConfig } from '../domain/spawn-config'

type Env = Record<string, string | undefined>

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : fallback
}

export function readSpawnConfig(env: Env): SpawnConfig {
  const defaults = DEFAULT_SPAWN_CONFIG

  return {
    minBaseDistance: positiveInt(env.WORLD_MIN_BASE_DISTANCE, defaults.minBaseDistance),
    attempts: positiveInt(env.WORLD_SPAWN_ATTEMPTS, defaults.attempts),
    radius: positiveInt(env.WORLD_SPAWN_RADIUS, defaults.radius),
    radiusPerBase: positiveInt(env.WORLD_SPAWN_RADIUS_PER_BASE, defaults.radiusPerBase),
    seedRadius: positiveInt(env.SPAWN_SEED_RADIUS, defaults.seedRadius),
    seedMaxPlayers: positiveInt(env.SPAWN_SEED_MAX_PLAYERS, defaults.seedMaxPlayers),
    seedTtlHours: positiveInt(env.SPAWN_SEED_TTL_HOURS, defaults.seedTtlHours)
  }
}
