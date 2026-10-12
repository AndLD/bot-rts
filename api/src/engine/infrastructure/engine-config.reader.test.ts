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
        ENGINE_SCRIPT_MEMORY_BYTES: '1048576',
        ENGINE_SCRIPT_STACK_BYTES: '65536',
        ENGINE_MAX_RESTARTS: '5',
        ENGINE_HEALTHY_TICKS: '100'
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
      memoryBytes: 1048576,
      stackBytes: 65536,
      maxRestarts: 5,
      healthyTicks: 100
    })
    expect(problems).toEqual([])
  })

  it('switches the engine off explicitly', () => {
    expect(readEngineSettings({ ENGINE_ENABLED: 'false' }, false, []).isEnabled).toBe(false)
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
