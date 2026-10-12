import { DEFAULT_ENGINE_CONFIG, EngineConfig } from '../domain/engine-config'
import { RadioBalance } from '../domain/radio'

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

// "0.75,0.5,0.25": three margins, each below the one before
function barMargins(env: Env, fallback: RadioBalance['barMargins'], problems: string[]): RadioBalance['barMargins'] {
  const raw = env.ENGINE_RADIO_BAR_MARGINS
  if (!raw) {
    return fallback
  }
  const margins = raw.split(',').map((part) => Number(part.trim()))
  const valid =
    margins.length === 3 &&
    margins.every((margin, index) => margin > 0 && margin <= 1 && (index === 0 || margin < margins[index - 1]))
  if (!valid) {
    problems.push('ENGINE_RADIO_BAR_MARGINS must be three falling numbers between 0 and 1, like 0.75,0.5,0.25')
    return fallback
  }
  return margins as unknown as RadioBalance['barMargins']
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
    flushMaxFailures: Math.floor(positive(env, 'ENGINE_FLUSH_MAX_FAILURES', defaults.flushMaxFailures, problems)),
    memoryBytes: Math.floor(positive(env, 'ENGINE_SCRIPT_MEMORY_BYTES', defaults.memoryBytes, problems)),
    stackBytes: Math.floor(positive(env, 'ENGINE_SCRIPT_STACK_BYTES', defaults.stackBytes, problems)),
    maxRestarts: Math.floor(positive(env, 'ENGINE_MAX_RESTARTS', defaults.maxRestarts, problems)),
    healthyTicks: Math.floor(positive(env, 'ENGINE_HEALTHY_TICKS', defaults.healthyTicks, problems)),
    modules: {
      maxFileBytes: Math.floor(positive(env, 'ENGINE_MODULE_MAX_FILE_BYTES', defaults.modules.maxFileBytes, problems)),
      maxFiles: Math.floor(positive(env, 'ENGINE_MODULE_MAX_FILES', defaults.modules.maxFiles, problems)),
      maxDepth: Math.floor(positive(env, 'ENGINE_MODULE_MAX_DEPTH', defaults.modules.maxDepth, problems)),
      cacheEntries: Math.floor(positive(env, 'ENGINE_MODULE_CACHE_ENTRIES', defaults.modules.cacheEntries, problems))
    },
    maxChunks: Math.floor(positive(env, 'ENGINE_MAX_CHUNKS', defaults.maxChunks, problems)),
    movement: {
      maxTicksPerCell: Math.floor(
        positive(env, 'ENGINE_MAX_TICKS_PER_CELL', defaults.movement.maxTicksPerCell, problems)
      )
    },
    radio: {
      barMargins: barMargins(env, defaults.radio.barMargins, problems),
      bufferScans: Math.floor(positive(env, 'ENGINE_RADIO_BUFFER_SCANS', defaults.radio.bufferScans, problems)),
      bufferEvents: Math.floor(positive(env, 'ENGINE_RADIO_BUFFER_EVENTS', defaults.radio.bufferEvents, problems))
    },
    combat: {
      minDamage: positive(env, 'ENGINE_MIN_DAMAGE', defaults.combat.minDamage, problems),
      accuracyFalloff: positive(env, 'ENGINE_ACCURACY_FALLOFF', defaults.combat.accuracyFalloff, problems)
    }
  }
}
