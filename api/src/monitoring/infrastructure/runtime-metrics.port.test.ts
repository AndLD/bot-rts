import { FakeClock } from '../../../tests/fakes/fakes'
import { EngineMetricsSnapshot, TICK_BOUNDS_MS } from '../../engine/application/engine-metrics'
import { EnginePort } from '../../engine/application/engine-port'
import { HttpMetrics } from '../../metrics/application/http-metrics'
import { RuntimeMetricsPort } from './runtime-metrics.port'

const TICKS_NONE = TICK_BOUNDS_MS.map(() => 0).concat(0)

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
  uptimeMs: 6,
  slowTicks: [],
  tickBuckets: TICKS_NONE,
  slowestTicks: [],
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

describe('RuntimeMetricsPort and the gateway', () => {
  const withGateway = (reading: { isUp: boolean; queueSize: number | null }) =>
    new RuntimeMetricsPort(
      { metrics: async () => snapshot() } as unknown as EnginePort,
      new HttpMetrics(),
      () => ({ rssBytes: 7, heapUsedBytes: 8 }),
      100,
      new FakeClock(),
      { read: async () => reading }
    )

  it('reports whether the gateway is up and how full its queue is', async () => {
    const { values } = await withGateway({ isUp: true, queueSize: 12 }).sample()

    expect(values).toMatchObject({ 'infrastructure.gatewayUp': 1, 'infrastructure.gatewayQueueSize': 12 })
  })

  it('reports a gateway that is down without a queue size, and nothing when there is no gateway to watch', async () => {
    const down = (await withGateway({ isUp: false, queueSize: null }).sample()).values

    expect(down['infrastructure.gatewayUp']).toBe(0)
    expect(down).not.toHaveProperty('infrastructure.gatewayQueueSize')
    expect((await setup().port.sample()).values).not.toHaveProperty('infrastructure.gatewayUp')
  })
})

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

describe('RuntimeMetricsPort distributions', () => {
  it('counts the requests of the period per latency bucket, with the slowest and its trace', async () => {
    const { port, http, clock } = setup()
    await port.sample()
    clock.current = new Date(clock.current.getTime() + 10_000)
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 3, traceId: 'a'.repeat(32) })
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 40, traceId: 'b'.repeat(32) })
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 60_000, traceId: 'c'.repeat(32) })

    const { histograms } = await port.sample()

    // bounds 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 30000 and above
    expect(histograms?.['api.latencyMs']).toEqual({
      counts: [1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
      slowestMs: 60_000,
      slowestTraceId: 'c'.repeat(32)
    })
  })

  it('keeps no distribution for a period without requests, and starts the slowest over each time', async () => {
    const { port, http, clock } = setup()
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 90 })
    clock.current = new Date(clock.current.getTime() + 10_000)
    const first = await port.sample()
    clock.current = new Date(clock.current.getTime() + 10_000)
    const second = await port.sample()

    expect(first.histograms?.['api.latencyMs']).toMatchObject({ slowestMs: 90, slowestTraceId: null })
    expect(second.histograms).not.toHaveProperty('api.latencyMs')
  })

  it('counts the ticks of the period per duration bucket, from the second reading on, with the slowest tick and its trace', async () => {
    const { port, state } = setup()
    expect((await port.sample()).histograms).not.toHaveProperty('engine.tickMs')
    state.engine = snapshot({
      tick: 200,
      tickBuckets: [0, 0, 0, 90, 8, 1, 1, 0, 0, 0, 0],
      slowestTicks: [
        { tick: 50, durationMs: 400, traceId: 'old'.padEnd(32, '0') },
        { tick: 150, durationMs: 90, traceId: 'a'.repeat(32) },
        { tick: 180, durationMs: 120, traceId: 'b'.repeat(32) }
      ]
    })

    const { histograms } = await port.sample()

    expect(histograms?.['engine.tickMs']).toEqual({
      counts: [0, 0, 0, 90, 8, 1, 1, 0, 0, 0, 0],
      slowestMs: 120,
      slowestTraceId: 'b'.repeat(32)
    })
  })

  it('takes the counts of a restarted engine as all of the period, and ignores a period in which no tick ran', async () => {
    const { port, state } = setup()
    state.engine = snapshot({ tick: 500, tickBuckets: [0, 0, 0, 500, 0, 0, 0, 0, 0, 0, 0] })
    await port.sample()
    state.engine = snapshot({
      tick: 10,
      tickBuckets: [0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0],
      slowestTicks: [{ tick: 3, durationMs: 9, traceId: null }]
    })

    const restarted = await port.sample()
    const idle = await port.sample()

    expect(restarted.histograms?.['engine.tickMs']).toMatchObject({
      counts: [0, 0, 0, 10, 0, 0, 0, 0, 0, 0, 0],
      slowestMs: 9
    })
    expect(idle.histograms).not.toHaveProperty('engine.tickMs')
  })

  it('keeps the slowest tick of the period when a later block was quicker, and reports requests whose slowest was already taken', async () => {
    const { port, http, clock, state } = setup()
    await port.sample()
    clock.current = new Date(clock.current.getTime() + 10_000)
    state.engine = snapshot({
      tick: 300,
      tickBuckets: [0, 0, 0, 200, 0, 0, 0, 0, 0, 0, 0],
      slowestTicks: [
        { tick: 150, durationMs: 80, traceId: 'a'.repeat(32) },
        { tick: 250, durationMs: 30, traceId: 'b'.repeat(32) }
      ]
    })
    http.observe({ method: 'GET', route: '/a', status: 200, durationMs: 9 })
    http.takeSlowest()

    const { histograms } = await port.sample()

    expect(histograms?.['engine.tickMs']).toMatchObject({ slowestMs: 80, slowestTraceId: 'a'.repeat(32) })
    expect(histograms?.['api.latencyMs']).toMatchObject({ slowestMs: null, slowestTraceId: null })
  })

  it('has no slowest tick for a period whose blocks the engine did not report', async () => {
    const { port, state } = setup()
    await port.sample()
    state.engine = snapshot({ tick: 120, tickBuckets: [0, 0, 0, 20, 0, 0, 0, 0, 0, 0, 0], slowestTicks: [] })

    const { histograms } = await port.sample()

    expect(histograms?.['engine.tickMs']).toMatchObject({ slowestMs: null, slowestTraceId: null })
  })
})
