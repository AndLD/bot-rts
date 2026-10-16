import { EngineMetrics, NO_RECORDER, TICK_BOUNDS_MS } from './engine-metrics'

const EMPTY_BUCKETS = TICK_BOUNDS_MS.map(() => 0).concat(0)

const sample = (tick: number, durationMs: number, isCut = false, scheduler = {}) => ({
  tick,
  durationMs,
  intervalMs: 100,
  isCut,
  queuedExecutions: 0,
  deferredExecutions: 0,
  maxWaitTicks: 0,
  ...scheduler
})

describe('EngineMetrics', () => {
  it('starts empty', () => {
    expect(new EngineMetrics().snapshot()).toEqual({
      tick: 0,
      lastTickMs: 0,
      p95TickMs: 0,
      overrunTicks: 0,
      cutTicks: 0,
      queuedExecutions: 0,
      deferredExecutions: 0,
      maxWaitTicks: 0,
      slowTicks: [],
      tickBuckets: EMPTY_BUCKETS,
      slowestTicks: [],
      counters: {},
      gauges: {}
    })
  })

  it('reports the last tick, the 95th percentile and the overruns and cuts', () => {
    const metrics = new EngineMetrics()
    for (let tick = 1; tick <= 20; tick++) metrics.record(sample(tick, tick))
    metrics.record(sample(21, 150, true))

    expect(metrics.snapshot()).toEqual({
      tick: 21,
      lastTickMs: 150,
      p95TickMs: 20,
      overrunTicks: 1,
      cutTicks: 1,
      queuedExecutions: 0,
      deferredExecutions: 0,
      maxWaitTicks: 0,
      slowTicks: [
        { tick: 21, durationMs: 150, intervalMs: 100, isCut: true, queuedExecutions: 0, deferredExecutions: 0 }
      ],
      // ticks of 1 to 20 ms: 1 | 2 | 3-5 (3) | 6-10 (5) | 11-20 (10); 150 ms is in the bucket up to 200
      tickBuckets: [1, 1, 3, 5, 10, 0, 0, 1, 0, 0, 0],
      slowestTicks: [{ tick: 21, durationMs: 150, traceId: null }],
      counters: {},
      gauges: {}
    })
  })

  it('keeps the newest twenty slow ticks only', () => {
    const metrics = new EngineMetrics()
    for (let tick = 1; tick <= 25; tick++) metrics.record(sample(tick, 200))

    const slow = metrics.snapshot().slowTicks
    expect(slow).toHaveLength(20)
    expect(slow[0].tick).toBe(6)
    expect(slow[19].tick).toBe(25)
  })

  it('looks at the latest hundred ticks only', () => {
    const metrics = new EngineMetrics()
    metrics.record(sample(1, 90))
    for (let tick = 2; tick <= 102; tick++) metrics.record(sample(tick, 1))

    expect(metrics.snapshot().p95TickMs).toBe(1)
  })

  it('reports the scheduler state of the last tick', () => {
    const metrics = new EngineMetrics()
    metrics.record(sample(1, 5, false, { queuedExecutions: 4, deferredExecutions: 2, maxWaitTicks: 3 }))
    metrics.record(sample(2, 5, false, { queuedExecutions: 1, deferredExecutions: 0, maxWaitTicks: 0 }))

    expect(metrics.snapshot()).toMatchObject({ queuedExecutions: 1, deferredExecutions: 0, maxWaitTicks: 0 })
  })

  it('counts the ticks per duration bucket, with one bucket above the last bound', () => {
    const metrics = new EngineMetrics()
    for (const [tick, ms] of [
      [1, 0.5],
      [2, 1],
      [3, 7],
      [4, 999],
      [5, 5000]
    ])
      metrics.record(sample(tick, ms))

    expect(metrics.snapshot().tickBuckets).toEqual([2, 0, 0, 1, 0, 0, 0, 0, 0, 1, 1])
  })

  it('keeps the slowest tick of each block of a hundred ticks with its trace, and the newest twelve blocks', () => {
    const metrics = new EngineMetrics()
    metrics.record({ ...sample(1, 4), traceId: 'a'.repeat(32) })
    metrics.record({ ...sample(2, 9), traceId: 'b'.repeat(32) })
    metrics.record({ ...sample(3, 6), traceId: 'c'.repeat(32) })
    metrics.record(sample(101, 2))
    for (let block = 2; block <= 14; block++) metrics.record(sample(block * 100 + 1, block))

    const slowest = metrics.snapshot().slowestTicks
    expect(slowest).toHaveLength(12)
    expect(slowest[0]).toEqual({ tick: 301, durationMs: 3, traceId: null })
    const first = new EngineMetrics()
    first.record({ ...sample(1, 4), traceId: 'a'.repeat(32) })
    first.record({ ...sample(2, 9), traceId: 'b'.repeat(32) })
    first.record({ ...sample(3, 6), traceId: 'c'.repeat(32) })
    expect(first.snapshot().slowestTicks).toEqual([{ tick: 2, durationMs: 9, traceId: 'b'.repeat(32) }])
  })

  it('counts and gauges by name: counters add up, gauges keep the last value', () => {
    const metrics = new EngineMetrics()

    metrics.count('events')
    metrics.count('events', 4)
    metrics.count('conflicts', 2)
    metrics.gauge('activeBots', 7)
    metrics.gauge('activeBots', 5)

    expect(metrics.snapshot()).toMatchObject({ counters: { events: 5, conflicts: 2 }, gauges: { activeBots: 5 } })
    expect(() => NO_RECORDER.count('x', 2)).not.toThrow()
    expect(() => NO_RECORDER.gauge('x', 2)).not.toThrow()
  })
})
