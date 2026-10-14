import type { HealthStatus, MonitorArea } from '../../../../lib/utils/admin'

// The metrics the console samples (design §25.5). A metric is a number per sample; rates are computed between two samples.
export interface MetricDefinition {
  id: string
  area: MonitorArea
  unit: 'ms' | 'ratio' | 'count' | 'perSecond' | 'bytes' | 'ticks' | 'flag'
}

export const METRIC_CATALOG: readonly MetricDefinition[] = [
  { id: 'engine.up', area: 'engine', unit: 'flag' },
  { id: 'engine.lastTickMs', area: 'engine', unit: 'ms' },
  { id: 'engine.tickP95Ms', area: 'engine', unit: 'ms' },
  // The 95th percentile tick as a share of the tick interval
  { id: 'engine.tickP95Ratio', area: 'engine', unit: 'ratio' },
  // Ticks over the interval, as a share of the ticks since the previous sample
  { id: 'engine.overrunRate', area: 'engine', unit: 'ratio' },
  { id: 'engine.cutTicks', area: 'engine', unit: 'count' },
  { id: 'scripts.running', area: 'scripts', unit: 'count' },
  { id: 'scripts.queued', area: 'scripts', unit: 'count' },
  { id: 'scripts.deferred', area: 'scripts', unit: 'count' },
  { id: 'scripts.maxWaitTicks', area: 'scripts', unit: 'ticks' },
  { id: 'scripts.sandboxMemoryBytes', area: 'scripts', unit: 'bytes' },
  { id: 'api.requestsPerSecond', area: 'api', unit: 'perSecond' },
  { id: 'api.errorRate5xx', area: 'api', unit: 'ratio' },
  { id: 'api.errorRate4xx', area: 'api', unit: 'ratio' },
  { id: 'api.latencyP95Ms', area: 'api', unit: 'ms' },
  { id: 'infrastructure.rssBytes', area: 'infrastructure', unit: 'bytes' },
  { id: 'infrastructure.heapUsedBytes', area: 'infrastructure', unit: 'bytes' }
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
  { metric: 'scripts.maxWaitTicks', direction: 'above', defaults: { yellow: 50, red: 200 } },
  { metric: 'api.errorRate5xx', direction: 'above', defaults: { yellow: 0.01, red: 0.05 } },
  { metric: 'api.latencyP95Ms', direction: 'above', defaults: { yellow: 500, red: 2000 } }
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
