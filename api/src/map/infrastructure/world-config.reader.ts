import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../domain/world-config'

type Env = Record<string, string | undefined>

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

export function readWorldConfig(env: Env): WorldConfig {
  const resourceChance = readNumber(env.WORLD_RESOURCE_CHANCE, DEFAULT_WORLD_CONFIG.resourceChance)

  return {
    resourceChance: Math.min(resourceChance, 1),
    spawnMaxDistance: Math.floor(readNumber(env.WORLD_SPAWN_MAX_DISTANCE, DEFAULT_WORLD_CONFIG.spawnMaxDistance)),
    spawnAttempts: Math.max(1, Math.floor(readNumber(env.WORLD_SPAWN_ATTEMPTS, DEFAULT_WORLD_CONFIG.spawnAttempts)))
  }
}
