import type { HealthStatus, MonitorArea } from '../../../../lib/utils/admin'

// The metrics the console samples (design §25.5). A metric is a number per sample; rates are computed between two samples.
export interface MetricDefinition {
  id: string
  area: MonitorArea
  unit: 'ms' | 'ratio' | 'count' | 'number' | 'perSecond' | 'bytes' | 'ticks' | 'flag'
}

export const METRIC_CATALOG: readonly MetricDefinition[] = [
  { id: 'engine.up', area: 'engine', unit: 'flag' },
  { id: 'engine.lastTickMs', area: 'engine', unit: 'ms' },
  { id: 'engine.tickP50Ms', area: 'engine', unit: 'ms' },
  { id: 'engine.tickP95Ms', area: 'engine', unit: 'ms' },
  { id: 'engine.tickP99Ms', area: 'engine', unit: 'ms' },
  // The 95th percentile tick as a share of the tick interval
  { id: 'engine.tickP95Ratio', area: 'engine', unit: 'ratio' },
  // Ticks over the interval, as a share of the ticks since the previous sample
  { id: 'engine.overrunRate', area: 'engine', unit: 'ratio' },
  { id: 'engine.cutTicks', area: 'engine', unit: 'count' },
  // Ticks that never ran because the loop was late by more than an interval, per sample
  { id: 'engine.ticksSkipped', area: 'engine', unit: 'count' },
  // How long the last write of the world took, how long the world has gone without one, and how many rows it held
  { id: 'engine.flushMs', area: 'engine', unit: 'ms' },
  { id: 'engine.flushLagMs', area: 'engine', unit: 'ms' },
  { id: 'engine.flushPending', area: 'engine', unit: 'count' },
  // Executions killed at the start for having been restarted too often, and restarts of the engine seen
  { id: 'engine.crashLoopKills', area: 'engine', unit: 'count' },
  { id: 'engine.restarts', area: 'engine', unit: 'count' },
  // Game calls applied per tick, and the share the world answered BLOCKED or EMPTY
  { id: 'engine.commandsPerTick', area: 'engine', unit: 'number' },
  { id: 'engine.conflictRate', area: 'engine', unit: 'ratio' },
  { id: 'scripts.running', area: 'scripts', unit: 'count' },
  { id: 'scripts.queued', area: 'scripts', unit: 'count' },
  { id: 'scripts.deferred', area: 'scripts', unit: 'count' },
  { id: 'scripts.maxWaitTicks', area: 'scripts', unit: 'ticks' },
  { id: 'scripts.sandboxMemoryBytes', area: 'scripts', unit: 'bytes' },
  // Operations used against the budget of the bots that made calls, and scripts stopped for using more than the slice of a tick
  { id: 'scripts.opsUsedRatio', area: 'scripts', unit: 'ratio' },
  { id: 'scripts.killedBySlice', area: 'scripts', unit: 'count' },
  // The longest wait for a turn of one player less the shortest of another (fairness between players)
  { id: 'scripts.waitSpreadTicks', area: 'scripts', unit: 'ticks' },
  { id: 'world.activeBots', area: 'world', unit: 'count' },
  { id: 'world.activePlayers', area: 'world', unit: 'count' },
  { id: 'world.botsPerPlayer', area: 'world', unit: 'number' },
  { id: 'world.liveAreas', area: 'world', unit: 'count' },
  { id: 'world.liveWatchers', area: 'world', unit: 'count' },
  { id: 'world.visionDiffsPerSecond', area: 'world', unit: 'perSecond' },
  { id: 'world.eventsPerSecond', area: 'world', unit: 'perSecond' },
  { id: 'world.chunkCacheHitRate', area: 'world', unit: 'ratio' },
  { id: 'api.requestsPerSecond', area: 'api', unit: 'perSecond' },
  { id: 'api.errorRate5xx', area: 'api', unit: 'ratio' },
  { id: 'api.errorRate4xx', area: 'api', unit: 'ratio' },
  { id: 'api.latencyP50Ms', area: 'api', unit: 'ms' },
  { id: 'api.latencyP95Ms', area: 'api', unit: 'ms' },
  { id: 'api.latencyP99Ms', area: 'api', unit: 'ms' },
  { id: 'infrastructure.rssBytes', area: 'infrastructure', unit: 'bytes' },
  { id: 'infrastructure.heapUsedBytes', area: 'infrastructure', unit: 'bytes' },
  // The collector gateway for logs and traces: whether it answers, and the batches waiting in its export queue
  { id: 'infrastructure.gatewayUp', area: 'infrastructure', unit: 'flag' },
  { id: 'infrastructure.gatewayQueueSize', area: 'infrastructure', unit: 'count' }
]

export const METRIC_IDS = METRIC_CATALOG.map((metric) => metric.id)

export interface Threshold {
  yellow?: number
  red?: number
}

// `above`: bad when the value is higher than the threshold; `below`: bad when it is lower
export interface AlertRule {
  metric: string
  direction: 'above' | 'below'
  defaults: Threshold
}

// The defaults of design §25.5, tunable through ADMIN_ALERT_THRESHOLDS
export const ALERT_RULES: readonly AlertRule[] = [
  { metric: 'engine.up', direction: 'below', defaults: { red: 1 } },
  { metric: 'engine.tickP95Ratio', direction: 'above', defaults: { yellow: 0.8 } },
  { metric: 'engine.overrunRate', direction: 'above', defaults: { red: 0.01 } },
  // The world is written behind: a write that takes longer than this, or a world that has gone this long without one, is a danger to it
  { metric: 'engine.flushMs', direction: 'above', defaults: { red: 5000 } },
  { metric: 'engine.flushLagMs', direction: 'above', defaults: { red: 5000 } },
  { metric: 'scripts.maxWaitTicks', direction: 'above', defaults: { yellow: 50, red: 200 } },
  { metric: 'api.errorRate5xx', direction: 'above', defaults: { yellow: 0.01, red: 0.05 } },
  { metric: 'api.latencyP95Ms', direction: 'above', defaults: { yellow: 500, red: 2000 } },
  // The game works without the gateway, so a gateway that is down is a warning; the queue holds 10,000 batches
  { metric: 'infrastructure.gatewayUp', direction: 'below', defaults: { yellow: 1 } },
  { metric: 'infrastructure.gatewayQueueSize', direction: 'above', defaults: { yellow: 5000, red: 9000 } }
]

export type Severity = Exclude<HealthStatus, 'green'>

export interface Breach {
  severity: Severity
  threshold: number
}

// Which threshold, if any, the value crosses; the red one wins
export function evaluateRule(rule: AlertRule, threshold: Threshold, value: number): Breach | null {
  const crosses = (limit: number) => (rule.direction === 'above' ? value > limit : value < limit)

  if (threshold.red !== undefined && crosses(threshold.red)) {
    return { severity: 'red', threshold: threshold.red }
  }
  if (threshold.yellow !== undefined && crosses(threshold.yellow)) {
    return { severity: 'yellow', threshold: threshold.yellow }
  }

  return null
}

export function worstOf(statuses: readonly HealthStatus[]): HealthStatus {
  return statuses.includes('red') ? 'red' : statuses.includes('yellow') ? 'yellow' : 'green'
}
