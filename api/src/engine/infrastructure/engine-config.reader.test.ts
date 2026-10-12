import { DEFAULT_ENGINE_CONFIG } from '../domain/engine-config'
import { readEngineSettings } from './engine-config.reader'

describe('readEngineSettings', () => {
  it('uses the defaults, with the engine on outside the tests and off in them', () => {
    const problems: string[] = []

    expect(readEngineSettings({}, false, problems)).toEqual({ ...DEFAULT_ENGINE_CONFIG, isEnabled: true })
    expect(readEngineSettings({}, true, problems).isEnabled).toBe(false)
    expect(problems).toEqual([])
  })

  it('reads every number from the environment', () => {
    const problems: string[] = []

    const settings = readEngineSettings(
      {
        ENGINE_ENABLED: 'true',
        ENGINE_TICK_INTERVAL_MS: '50',
        ENGINE_SLICE_MS: '2.5',
        ENGINE_TICK_CAP_RATIO: '0.5',
        ENGINE_FLUSH_EVERY_TICKS: '20.7',
        ENGINE_FLUSH_MAX_FAILURES: '5',
        ENGINE_SCRIPT_MEMORY_BYTES: '1048576',
        ENGINE_SCRIPT_STACK_BYTES: '65536',
        ENGINE_MAX_RESTARTS: '5',
        ENGINE_HEALTHY_TICKS: '100',
        ENGINE_MODULE_MAX_FILE_BYTES: '1000',
        ENGINE_MODULE_MAX_FILES: '3',
        ENGINE_MODULE_MAX_DEPTH: '2',
        ENGINE_MODULE_CACHE_ENTRIES: '10',
        ENGINE_WATCHDOG_STALL_MS: '3000',
        ENGINE_WATCHDOG_POLL_MS: '100',
        ENGINE_LOG_MAX_LINES_PER_TICK: '5',
        ENGINE_LOG_MAX_CHARS: '50',
        ENGINE_MAX_CHUNKS: '64',
        ENGINE_MAX_TICKS_PER_CELL: '8',
        ENGINE_MIN_DAMAGE: '2',
        ENGINE_ACCURACY_FALLOFF: '0.25',
        ENGINE_RADIO_BAR_MARGINS: '0.9, 0.6, 0.3',
        ENGINE_RADIO_BUFFER_SCANS: '10',
        ENGINE_RADIO_BUFFER_EVENTS: '5'
      },
      true,
      problems
    )

    expect(settings).toEqual({
      isEnabled: true,
      tickIntervalMs: 50,
      sliceMs: 2.5,
      tickCapRatio: 0.5,
      flushEveryTicks: 20,
      flushMaxFailures: 5,
      memoryBytes: 1048576,
      stackBytes: 65536,
      maxRestarts: 5,
      healthyTicks: 100,
      modules: { maxFileBytes: 1000, maxFiles: 3, maxDepth: 2, cacheEntries: 10 },
      watchdog: { stallMs: 3000, pollMs: 100 },
      log: { maxLinesPerTick: 5, maxChars: 50 },
      maxChunks: 64,
      movement: { maxTicksPerCell: 8 },
      combat: { minDamage: 2, accuracyFalloff: 0.25 },
      radio: { barMargins: [0.9, 0.6, 0.3], bufferScans: 10, bufferEvents: 5 }
    })
    expect(problems).toEqual([])
  })

  it('switches the engine off explicitly', () => {
    expect(readEngineSettings({ ENGINE_ENABLED: 'false' }, false, []).isEnabled).toBe(false)
  })

  it('rejects margins that are not three falling numbers', () => {
    for (const bad of ['0.5,0.75,0.25', '0.9,0.5', '1.5,0.5,0.25', 'a,b,c']) {
      const problems: string[] = []
      const settings = readEngineSettings({ ENGINE_RADIO_BAR_MARGINS: bad }, false, problems)

      expect(problems).toEqual([expect.stringContaining('ENGINE_RADIO_BAR_MARGINS')])
      expect(settings.radio.barMargins).toEqual([0.75, 0.5, 0.25])
    }
  })

  it('reports bad values and keeps the defaults', () => {
    const problems: string[] = []

    const settings = readEngineSettings(
      { ENGINE_ENABLED: 'yes', ENGINE_TICK_INTERVAL_MS: '0', ENGINE_SLICE_MS: 'abc', ENGINE_TICK_CAP_RATIO: '1.5' },
      false,
      problems
    )

    expect(problems).toEqual([
      'ENGINE_TICK_CAP_RATIO must be at most 1',
      'ENGINE_ENABLED must be true or false',
      'ENGINE_TICK_INTERVAL_MS must be a positive number',
      'ENGINE_SLICE_MS must be a positive number'
    ])
    expect(settings.tickIntervalMs).toBe(DEFAULT_ENGINE_CONFIG.tickIntervalMs)
    expect(settings.sliceMs).toBe(DEFAULT_ENGINE_CONFIG.sliceMs)
  })
})
