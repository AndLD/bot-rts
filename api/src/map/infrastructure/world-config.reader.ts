import { readFileSync } from 'fs'
import { RESOURCES, ResourceBalance } from '../../../../lib/utils/interfaces/resources'
import { validateResourceBalance } from '../domain/resource-balance'
import { DEFAULT_WORLD_CONFIG, WorldConfig } from '../domain/world-config'

type Env = Record<string, string | undefined>
type ReadFile = (path: string) => string

const readUtf8: ReadFile = (path) => readFileSync(path, 'utf8')

function readNumber(value: string | undefined, fallback: number): number {
  const parsed = value === undefined || value === '' ? NaN : Number(value)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback
}

// The defaults, overridden per resource by the JSON file named in WORLD_RESOURCE_BALANCE_FILE (any subset of fields)
function readResourceBalance(path: string | undefined, readFile: ReadFile, problems: string[]): ResourceBalance {
  const defaults = DEFAULT_WORLD_CONFIG.resources
  if (!path) {
    return defaults
  }

  let overrides: Partial<Record<string, Partial<ResourceBalance[keyof ResourceBalance]>>>
  try {
    overrides = JSON.parse(readFile(path))
  } catch {
    problems.push(`WORLD_RESOURCE_BALANCE_FILE ${path} must be a readable JSON file`)
    return defaults
  }

  const balance = Object.fromEntries(
    RESOURCES.map((resource) => [resource, { ...defaults[resource], ...overrides[resource] }])
  ) as ResourceBalance
  const invalid = validateResourceBalance(balance).map((problem) => `WORLD_RESOURCE_BALANCE_FILE: ${problem}`)
  problems.push(...invalid)
  return invalid.length ? defaults : balance
}

export function readWorldConfig(env: Env, problems: string[] = [], readFile: ReadFile = readUtf8) {
  const resourceChance = readNumber(env.WORLD_RESOURCE_CHANCE, DEFAULT_WORLD_CONFIG.resourceChance)

  const config: WorldConfig = {
    chunkSize: Math.max(1, Math.floor(readNumber(env.WORLD_CHUNK_SIZE, DEFAULT_WORLD_CONFIG.chunkSize))),
    resourceChance: Math.min(resourceChance, 1),
    resources: readResourceBalance(env.WORLD_RESOURCE_BALANCE_FILE, readFile, problems),
    spawnMaxDistance: Math.floor(readNumber(env.WORLD_SPAWN_MAX_DISTANCE, DEFAULT_WORLD_CONFIG.spawnMaxDistance)),
    spawnAttempts: Math.max(1, Math.floor(readNumber(env.WORLD_SPAWN_ATTEMPTS, DEFAULT_WORLD_CONFIG.spawnAttempts)))
  }
  return config
}
