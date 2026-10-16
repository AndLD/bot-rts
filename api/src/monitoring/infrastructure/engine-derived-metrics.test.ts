import { EngineMetricsSnapshot } from '../../engine/application/engine-metrics'
import { engineDerivedMetrics } from './engine-derived-metrics'

const snapshot = (overrides: Partial<EngineMetricsSnapshot> = {}): EngineMetricsSnapshot => ({
  tick: 100,
  lastTickMs: 1,
  p95TickMs: 1,
  overrunTicks: 0,
  cutTicks: 0,
  queuedExecutions: 0,
  deferredExecutions: 0,
  maxWaitTicks: 0,
  executions: 0,
  memoryBytes: 0,
  uptimeMs: 10_000,
  slowTicks: [],
  tickBuckets: [],
  slowestTicks: [],
  counters: {},
  gauges: {},
  ...overrides
})

describe('engineDerivedMetrics', () => {
  it('gives the gauges as they are from the first reading, and nothing that needs an earlier one', () => {
    const values = engineDerivedMetrics(
      null,
      snapshot({
        gauges: {
          flushMs: 12,
          flushPending: 300,
          flushLagTicks: 30,
          waitSpreadTicks: 4,
          activeBots: 9,
          activePlayers: 3,
          liveAreas: 2,
          liveWatchers: 1
        }
      }),
      10,
      100
    )

    expect(values).toEqual({
      'engine.flushMs': 12,
      'engine.flushPending': 300,
      'engine.flushLagMs': 3000,
      'scripts.waitSpreadTicks': 4,
      'world.activeBots': 9,
      'world.activePlayers': 3,
      'world.botsPerPlayer': 3,
      'world.liveAreas': 2,
      'world.liveWatchers': 1
    })
  })

  it('leaves out a gauge the engine has not reported, and has no bots per player without players', () => {
    const values = engineDerivedMetrics(null, snapshot({ gauges: { activeBots: 4, activePlayers: 0 } }), 10, 100)

    expect(values['world.botsPerPlayer']).toBe(0)
    expect(values).not.toHaveProperty('engine.flushMs')
    expect(values).not.toHaveProperty('engine.flushLagMs')
  })

  it('works out rates and ratios between two readings', () => {
    const previous = snapshot({
      tick: 100,
      counters: {
        commandsApplied: 100,
        conflicts: 10,
        opsUsed: 50,
        opsBudget: 100,
        cacheHits: 80,
        cacheMisses: 20,
        events: 1000,
        visionDiffs: 500
      }
    })
    const current = snapshot({
      tick: 200,
      uptimeMs: 20_000,
      counters: {
        commandsApplied: 300,
        conflicts: 30,
        opsUsed: 150,
        opsBudget: 300,
        cacheHits: 380,
        cacheMisses: 120,
        events: 1200,
        visionDiffs: 540,
        ticksSkipped: 3,
        crashLoopKills: 1,
        killedBySlice: 2
      }
    })

    expect(engineDerivedMetrics(previous, current, 10, 100)).toMatchObject({
      'engine.restarts': 0,
      'engine.ticksSkipped': 3,
      'engine.crashLoopKills': 1,
      'scripts.killedBySlice': 2,
      'engine.commandsPerTick': 2,
      'engine.conflictRate': 0.1,
      'scripts.opsUsedRatio': 0.5,
      'world.chunkCacheHitRate': 0.75,
      'world.visionDiffsPerSecond': 4,
      'world.eventsPerSecond': 20
    })
  })

  it('counts everything since the start of an engine that restarted, and says so', () => {
    const previous = snapshot({ tick: 5000, uptimeMs: 500_000, counters: { commandsApplied: 9000, events: 9000 } })
    const current = snapshot({
      tick: 50,
      uptimeMs: 5_000,
      counters: { commandsApplied: 100, conflicts: 5, events: 100 }
    })

    expect(engineDerivedMetrics(previous, current, 10, 100)).toMatchObject({
      'engine.restarts': 1,
      'engine.commandsPerTick': 2,
      'engine.conflictRate': 0.05,
      'world.eventsPerSecond': 10
    })
  })

  it('has no ratio for a period in which nothing was applied, used or looked up', () => {
    const values = engineDerivedMetrics(snapshot(), snapshot({ tick: 100 }), 0, 100)

    expect(values).toMatchObject({ 'engine.restarts': 0, 'engine.ticksSkipped': 0 })
    for (const absent of [
      'engine.commandsPerTick',
      'engine.conflictRate',
      'scripts.opsUsedRatio',
      'world.chunkCacheHitRate',
      'world.eventsPerSecond'
    ]) {
      expect(values).not.toHaveProperty(absent)
    }
  })
})
