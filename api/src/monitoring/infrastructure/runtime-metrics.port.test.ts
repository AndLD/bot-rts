import { FakeClock } from '../../../tests/fakes/fakes'
import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { EnginePort } from '../../engine/application/engine-port'
import { HttpMetrics } from '../../metrics/application/http-metrics'
import { RuntimeMetricsPort } from './runtime-metrics.port'

const snapshot = (overrides: Partial<EngineMetricsSnapshot> = {}): EngineMetricsSnapshot => ({
  tick: 100,
  lastTickMs: 10,
  p95TickMs: 50,
  overrunTicks: 0,
  cutTicks: 0,
  queuedExecutions: 1,
  deferredExecutions: 2,
  maxWaitTicks: 3,
  executions: 4,
  memoryBytes: 5,
  ...overrides
})

function setup() {
  const state: { engine: EngineMetricsSnapshot | Error } = { engine: snapshot() }
  const engine = {
    metrics: async () => {
      if (state.engine instanceof Error) throw state.engine
      return state.engine
    }
  } as unknown as EnginePort
  const http = new HttpMetrics()
  const clock = new FakeClock()
  const port = new RuntimeMetricsPort(engine, http, () => ({ rssBytes: 7, heapUsedBytes: 8 }), 100, clock)

  return { state, http, clock, port }
}

describe('RuntimeMetricsPort', () => {
  it('reads the engine, the scheduler and the process', async () => {
    const { port } = setup()
    const { at, values } = await port.sample()

    expect(at).toEqual(new FakeClock().now())
    expect(values).toMatchObject({
      'engine.up': 1,
      'engine.lastTickMs': 10,
      'engine.tickP95Ms': 50,
      'engine.tickP95Ratio': 0.5,
      'engine.cutTicks': 0,
      'scripts.running': 4,
      'scripts.queued': 1,
      'scripts.deferred': 2,
      'scripts.maxWaitTicks': 3,
      'scripts.sandboxMemoryBytes': 5,
      'infrastructure.rssBytes': 7,
      'infrastructure.heapUsedBytes': 8
    })
    // no rates yet: there is no earlier reading, and no requests
    expect(values).not.toHaveProperty('engine.overrunRate')
    expect(values).not.toHaveProperty('api.errorRate5xx')
  })

  it('works out the overrun rate between two readings', async () => {
    const { port, state, clock } = setup()
    await port.sample()
    clock.current = new Date(clock.current.getTime() + 10_000)
    state.engine = snapshot({ tick: 200, overrunTicks: 5 })

    expect((await port.sample()).values['engine.overrunRate']).toBe(0.05)

    clock.current = new Date(clock.current.getTime() + 10_000)
    expect((await port.sample()).values).not.toHaveProperty('engine.overrunRate')
  })

  it('marks the engine down and leaves its numbers out', async () => {
    const { port, state } = setup()
    state.engine = new Error('engine is down')
    const { values } = await port.sample()

    expect(values['engine.up']).toBe(0)
    expect(values).not.toHaveProperty('engine.lastTickMs')
  })

  it('works out request rate, error shares and the latency percentile between readings', async () => {
    const { port, http, clock } = setup()
    await port.sample()
    for (let i = 0; i < 18; i += 1) http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 4 })
    http.observe({ method: 'GET', route: '/a', status: 404, durationMs: 4 })
    http.observe({ method: 'GET', route: '/a', status: 500, durationMs: 400 })
    clock.current = new Date(clock.current.getTime() + 10_000)
    const { values } = await port.sample()

    expect(values['api.requestsPerSecond']).toBe(2)
    expect(values['api.errorRate5xx']).toBe(0.05)
    expect(values['api.errorRate4xx']).toBe(0.05)
    expect(values['api.latencyP95Ms']).toBe(5)

    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 60_000 })
    clock.current = new Date(clock.current.getTime() + 10_000)
    expect((await port.sample()).values['api.latencyP95Ms']).toBe(30_000)

    // a repeated reading at the same instant has no rate
    expect((await port.sample()).values).not.toHaveProperty('api.requestsPerSecond')
  })
})
