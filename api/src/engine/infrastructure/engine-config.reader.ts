import { DEFAULT_ENGINE_CONFIG, EngineConfig } from '../domain/engine-config'

type Env = Record<string, string | undefined>

// The engine switch and its tunable numbers
export interface EngineSettings extends EngineConfig {
  // Whether the API process starts the engine thread; the integration tests run without it
  isEnabled: boolean
}

function positive(env: Env, name: string, fallback: number, problems: string[]): number {
  const raw = env[name]
  if (raw === undefined || raw === '') {
    return fallback
  }
  const value = Number(raw)
  if (!Number.isFinite(value) || value <= 0) {
    problems.push(`${name} must be a positive number`)
    return fallback
  }
  return value
}

export function readEngineSettings(env: Env, isTest: boolean, problems: string[]): EngineSettings {
  const defaults = DEFAULT_ENGINE_CONFIG
  const tickCapRatio = positive(env, 'ENGINE_TICK_CAP_RATIO', defaults.tickCapRatio, problems)
  if (tickCapRatio > 1) {
    problems.push('ENGINE_TICK_CAP_RATIO must be at most 1')
  }
  const enabled = env.ENGINE_ENABLED
  if (enabled !== undefined && enabled !== '' && enabled !== 'true' && enabled !== 'false') {
    problems.push('ENGINE_ENABLED must be true or false')
  }

  return {
    isEnabled: enabled ? enabled === 'true' : !isTest,
    tickIntervalMs: positive(env, 'ENGINE_TICK_INTERVAL_MS', defaults.tickIntervalMs, problems),
    sliceMs: positive(env, 'ENGINE_SLICE_MS', defaults.sliceMs, problems),
    tickCapRatio,
    flushEveryTicks: Math.floor(positive(env, 'ENGINE_FLUSH_EVERY_TICKS', defaults.flushEveryTicks, problems)),
    memoryBytes: Math.floor(positive(env, 'ENGINE_SCRIPT_MEMORY_BYTES', defaults.memoryBytes, problems)),
    stackBytes: Math.floor(positive(env, 'ENGINE_SCRIPT_STACK_BYTES', defaults.stackBytes, problems)),
    maxRestarts: Math.floor(positive(env, 'ENGINE_MAX_RESTARTS', defaults.maxRestarts, problems)),
    healthyTicks: Math.floor(positive(env, 'ENGINE_HEALTHY_TICKS', defaults.healthyTicks, problems)),
    maxChunks: Math.floor(positive(env, 'ENGINE_MAX_CHUNKS', defaults.maxChunks, problems)),
    movement: {
      maxTicksPerCell: Math.floor(
        positive(env, 'ENGINE_MAX_TICKS_PER_CELL', defaults.movement.maxTicksPerCell, problems)
      )
    },
    combat: {
      minDamage: positive(env, 'ENGINE_MIN_DAMAGE', defaults.combat.minDamage, problems),
      accuracyFalloff: positive(env, 'ENGINE_ACCURACY_FALLOFF', defaults.combat.accuracyFalloff, problems)
    }
  }
}
