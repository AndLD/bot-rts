import { ENGINE_COUNTER, ENGINE_GAUGE, EngineMetricsSnapshot } from '../../engine/application/engine-metrics'

// What the console shows of the engine and the world that is not a plain reading (design §25.5): rates and ratios between two readings
// of the engine's counters, and its gauges as they are. The first reading has no earlier one, so it gives the gauges only; a reading
// from an engine that restarted since the earlier one counts everything since the restart.
export function engineDerivedMetrics(
  previous: EngineMetricsSnapshot | null,
  current: EngineMetricsSnapshot,
  seconds: number,
  tickIntervalMs: number
): Record<string, number> {
  const values: Record<string, number> = {}
  const gauge = (name: string) => current.gauges[name]
  const put = (id: string, value: number | undefined) => {
    if (value !== undefined && Number.isFinite(value)) {
      values[id] = value
    }
  }

  put('engine.flushMs', gauge(ENGINE_GAUGE.flushMs))
  put('engine.flushPending', gauge(ENGINE_GAUGE.flushPending))
  put('engine.flushLagMs', gauge(ENGINE_GAUGE.flushLagTicks) * tickIntervalMs)
  put('scripts.waitSpreadTicks', gauge(ENGINE_GAUGE.waitSpreadTicks))
  put('world.activeBots', gauge(ENGINE_GAUGE.activeBots))
  put('world.activePlayers', gauge(ENGINE_GAUGE.activePlayers))
  put(
    'world.botsPerPlayer',
    gauge(ENGINE_GAUGE.activePlayers) > 0 ? gauge(ENGINE_GAUGE.activeBots) / gauge(ENGINE_GAUGE.activePlayers) : 0
  )
  put('world.liveAreas', gauge(ENGINE_GAUGE.liveAreas))
  put('world.liveWatchers', gauge(ENGINE_GAUGE.liveWatchers))
  if (!previous) {
    return values
  }
  const isRestart = current.tick < previous.tick || current.uptimeMs < previous.uptimeMs
  const delta = (name: string) => (current.counters[name] ?? 0) - (isRestart ? 0 : (previous.counters[name] ?? 0))
  const ticks = current.tick - (isRestart ? 0 : previous.tick)
  const commands = delta(ENGINE_COUNTER.commandsApplied)
  const lookups = delta(ENGINE_COUNTER.cacheHits) + delta(ENGINE_COUNTER.cacheMisses)

  values['engine.restarts'] = isRestart ? 1 : 0
  put('engine.ticksSkipped', delta(ENGINE_COUNTER.ticksSkipped))
  put('engine.crashLoopKills', delta(ENGINE_COUNTER.crashLoopKills))
  put('scripts.killedBySlice', delta(ENGINE_COUNTER.killedBySlice))
  if (ticks > 0) {
    put('engine.commandsPerTick', commands / ticks)
  }
  if (commands > 0) {
    put('engine.conflictRate', delta(ENGINE_COUNTER.conflicts) / commands)
  }
  if (delta(ENGINE_COUNTER.opsBudget) > 0) {
    put('scripts.opsUsedRatio', delta(ENGINE_COUNTER.opsUsed) / delta(ENGINE_COUNTER.opsBudget))
  }
  if (lookups > 0) {
    put('world.chunkCacheHitRate', delta(ENGINE_COUNTER.cacheHits) / lookups)
  }
  if (seconds > 0) {
    put('world.visionDiffsPerSecond', delta(ENGINE_COUNTER.visionDiffs) / seconds)
    put('world.eventsPerSecond', delta(ENGINE_COUNTER.events) / seconds)
  }

  return values
}
