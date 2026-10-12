import { EngineMetrics } from './engine-metrics'

const sample = (tick: number, durationMs: number, isCut = false) => ({ tick, durationMs, intervalMs: 100, isCut })

describe('EngineMetrics', () => {
  it('starts empty', () => {
    expect(new EngineMetrics().snapshot()).toEqual({
      tick: 0,
      lastTickMs: 0,
      p95TickMs: 0,
      overrunTicks: 0,
      cutTicks: 0
    })
  })

  it('reports the last tick, the 95th percentile and the overruns and cuts', () => {
    const metrics = new EngineMetrics()
    for (let tick = 1; tick <= 20; tick++) metrics.record(sample(tick, tick))
    metrics.record(sample(21, 150, true))

    expect(metrics.snapshot()).toEqual({ tick: 21, lastTickMs: 150, p95TickMs: 20, overrunTicks: 1, cutTicks: 1 })
  })

  it('looks at the latest hundred ticks only', () => {
    const metrics = new EngineMetrics()
    metrics.record(sample(1, 90))
    for (let tick = 2; tick <= 102; tick++) metrics.record(sample(tick, 1))

    expect(metrics.snapshot().p95TickMs).toBe(1)
  })
})
